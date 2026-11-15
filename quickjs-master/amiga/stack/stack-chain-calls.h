/*
 * stack-chain-calls.h - carry one engine call over to a new stack
 * block. AmigaOS / vbcc only; see stack-chain.h and docs/STACK.md.
 *
 * Included once, at the end of quickjs.c, because each function here
 * calls a static function of the engine. One function per place where
 * the stack can grow ("switch point"). They all have the same shape:
 *
 *     take a block               js_stack_enter
 *     run the call on it         qjs_stack_chunk_run -> a small
 *                                function that unpacks the arguments
 *     give the block back        js_stack_leave
 *
 * The arguments travel in a structure in the frame of the function
 * that switches. That frame is on the old segment, which stays where
 * it is, so pointers into it (argument arrays, the caller's locals)
 * remain good while the call runs on the block.
 *
 * Every one of these is entered only after js_stack_can_grow said
 * yes, so js_stack_enter fails only when the system has no memory for
 * a block: that is a RangeError like any other exhausted stack.
 */
#ifndef QJS_STACK_CHAIN_CALLS_H
#define QJS_STACK_CHAIN_CALLS_H

/* ---- a function call: JS_CallInternal ---- */

typedef struct JSStackCallArgs {
    JSContext *ctx;
    JSValueConst func_obj, this_obj, new_target;
    int argc;
    JSValueConst *argv;
    int flags;
    JSValue ret;
} JSStackCallArgs;

static void js_stack_run_call(void *opaque)
{
    JSStackCallArgs *a = opaque;

    a->ret = JS_CallInternal(a->ctx, a->func_obj, a->this_obj, a->new_target,
                             a->argc, a->argv, a->flags);
}

/* Used for JavaScript functions and, with new_target undefined, for
 * native, bound and closure functions: JS_CallInternal hands those to
 * their class's call function with exactly these arguments, so going
 * through it again from the top of a new block repeats the call that
 * found the stack low. */
static JSValue js_call_on_more_stack(JSContext *ctx, JSValueConst func_obj,
                                     JSValueConst this_obj,
                                     JSValueConst new_target,
                                     int argc, JSValueConst *argv, int flags,
                                     size_t need)
{
    JSRuntime *rt = ctx->rt;
    JSStackSwitch sw;
    JSStackCallArgs a;

    if (!js_stack_enter(rt, need, &sw))
        return JS_ThrowStackOverflow(ctx);
    a.ctx = ctx;
    a.func_obj = func_obj;
    a.this_obj = this_obj;
    a.new_target = new_target;
    a.argc = argc;
    a.argv = argv;
    a.flags = flags;
    qjs_stack_chunk_run(sw.chunk, js_stack_run_call, &a);
    js_stack_leave(rt, &sw);
    return a.ret;
}

/* ---- resuming a generator or an async function ---- */

typedef struct JSStackResumeArgs {
    JSContext *ctx;
    JSAsyncFunctionState *s;
    JSValue ret;
} JSStackResumeArgs;

static void js_stack_run_resume(void *opaque)
{
    JSStackResumeArgs *a = opaque;

    a->ret = async_func_resume(a->ctx, a->s);
}

static JSValue js_async_resume_on_more_stack(JSContext *ctx,
                                             JSAsyncFunctionState *s)
{
    JSRuntime *rt = ctx->rt;
    JSStackSwitch sw;
    JSStackResumeArgs a;

    if (!js_stack_enter(rt, 0, &sw))
        return JS_ThrowStackOverflow(ctx);
    a.ctx = ctx;
    a.s = s;
    qjs_stack_chunk_run(sw.chunk, js_stack_run_resume, &a);
    js_stack_leave(rt, &sw);
    return a.ret;
}

/* ---- the parser: an expression or a statement ---- */

typedef struct JSStackParseArgs {
    JSParseState *s;
    int arg;
    int (*parse)(JSParseState *s, int arg);
    int ret;
} JSStackParseArgs;

static void js_stack_run_parse(void *opaque)
{
    JSStackParseArgs *a = opaque;

    a->ret = a->parse(a->s, a->arg);
}

static int js_parse_on_more_stack(JSParseState *s, int arg,
                                  int (*parse)(JSParseState *s, int arg))
{
    JSRuntime *rt = s->ctx->rt;
    JSStackSwitch sw;
    JSStackParseArgs a;

    if (!js_stack_enter(rt, JS_STACK_PARSE_NEED, &sw)) {
        JS_ThrowStackOverflow(s->ctx);
        return -1;
    }
    a.s = s;
    a.arg = arg;
    a.parse = parse;
    qjs_stack_chunk_run(sw.chunk, js_stack_run_parse, &a);
    js_stack_leave(rt, &sw);
    return a.ret;
}

/* ---- JSON.parse: one value ---- */

typedef struct JSStackJSONParseArgs {
    JSParseState *s;
    JSValue ret;
} JSStackJSONParseArgs;

static void js_stack_run_json_parse(void *opaque)
{
    JSStackJSONParseArgs *a = opaque;

    a->ret = json_parse_value(a->s);
}

static JSValue json_parse_value_on_more_stack(JSParseState *s)
{
    JSRuntime *rt = s->ctx->rt;
    JSStackSwitch sw;
    JSStackJSONParseArgs a;

    if (!js_stack_enter(rt, 0, &sw))
        return JS_ThrowStackOverflow(s->ctx);
    a.s = s;
    qjs_stack_chunk_run(sw.chunk, js_stack_run_json_parse, &a);
    js_stack_leave(rt, &sw);
    return a.ret;
}

/* ---- JSON.stringify: one value ---- */

typedef struct JSStackJSONStrArgs {
    JSContext *ctx;
    JSONStringifyContext *jsc;
    JSValueConst holder;
    JSValue val;
    JSValueConst indent;
    int ret;
} JSStackJSONStrArgs;

static void js_stack_run_json_str(void *opaque)
{
    JSStackJSONStrArgs *a = opaque;

    a->ret = js_json_to_str(a->ctx, a->jsc, a->holder, a->val, a->indent);
}

/* js_json_to_str owns `val` and frees it on every path; so must this. */
static int js_json_to_str_on_more_stack(JSContext *ctx,
                                        JSONStringifyContext *jsc,
                                        JSValueConst holder, JSValue val,
                                        JSValueConst indent)
{
    JSRuntime *rt = ctx->rt;
    JSStackSwitch sw;
    JSStackJSONStrArgs a;

    if (!js_stack_enter(rt, 0, &sw)) {
        JS_FreeValue(ctx, val);
        JS_ThrowStackOverflow(ctx);
        return -1;
    }
    a.ctx = ctx;
    a.jsc = jsc;
    a.holder = holder;
    a.val = val;
    a.indent = indent;
    qjs_stack_chunk_run(sw.chunk, js_stack_run_json_str, &a);
    js_stack_leave(rt, &sw);
    return a.ret;
}

/* ---- JSON.parse with a reviver: one property ---- */

typedef struct JSStackInternalizeArgs {
    JSContext *ctx;
    JSValueConst holder;
    JSAtom name;
    JSValueConst reviver;
    JSValue ret;
} JSStackInternalizeArgs;

static void js_stack_run_internalize(void *opaque)
{
    JSStackInternalizeArgs *a = opaque;

    a->ret = internalize_json_property(a->ctx, a->holder, a->name,
                                       a->reviver);
}

static JSValue internalize_json_on_more_stack(JSContext *ctx,
                                              JSValueConst holder,
                                              JSAtom name,
                                              JSValueConst reviver)
{
    JSRuntime *rt = ctx->rt;
    JSStackSwitch sw;
    JSStackInternalizeArgs a;

    if (!js_stack_enter(rt, 0, &sw))
        return JS_ThrowStackOverflow(ctx);
    a.ctx = ctx;
    a.holder = holder;
    a.name = name;
    a.reviver = reviver;
    qjs_stack_chunk_run(sw.chunk, js_stack_run_internalize, &a);
    js_stack_leave(rt, &sw);
    return a.ret;
}

/* ---- Array.prototype.flat / flatMap: one nested array ---- */

typedef struct JSStackFlattenArgs {
    JSContext *ctx;
    JSValueConst target, source;
    int64_t sourceLen, targetIndex;
    int depth;
    JSValueConst mapperFunction, thisArg;
    int64_t ret;
} JSStackFlattenArgs;

static void js_stack_run_flatten(void *opaque)
{
    JSStackFlattenArgs *a = opaque;

    a->ret = JS_FlattenIntoArray(a->ctx, a->target, a->source, a->sourceLen,
                                 a->targetIndex, a->depth,
                                 a->mapperFunction, a->thisArg);
}

static int64_t js_flatten_on_more_stack(JSContext *ctx, JSValueConst target,
                                        JSValueConst source,
                                        int64_t sourceLen,
                                        int64_t targetIndex, int depth,
                                        JSValueConst mapperFunction,
                                        JSValueConst thisArg)
{
    JSRuntime *rt = ctx->rt;
    JSStackSwitch sw;
    JSStackFlattenArgs a;

    if (!js_stack_enter(rt, 0, &sw)) {
        JS_ThrowStackOverflow(ctx);
        return -1;
    }
    a.ctx = ctx;
    a.target = target;
    a.source = source;
    a.sourceLen = sourceLen;
    a.targetIndex = targetIndex;
    a.depth = depth;
    a.mapperFunction = mapperFunction;
    a.thisArg = thisArg;
    qjs_stack_chunk_run(sw.chunk, js_stack_run_flatten, &a);
    js_stack_leave(rt, &sw);
    return a.ret;
}

#endif /* QJS_STACK_CHAIN_CALLS_H */
