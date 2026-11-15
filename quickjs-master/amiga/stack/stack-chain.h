/*
 * stack-chain.h - the growable JavaScript stack: limits, growing and
 * shrinking. AmigaOS / vbcc only. Read docs/STACK.md first.
 *
 * Not a header in the usual sense: quickjs.c includes it once, after
 * js_check_stack_overflow, because the code needs struct JSRuntime and
 * is called from the engine's stack checks. It is a file of its own so
 * that quickjs.c does not grow by it. The functions that carry one
 * particular engine call over to a new block are in
 * stack-chain-calls.h, included at the end of quickjs.c.
 *
 * In short. An AmigaOS stack is a fixed block of memory and cannot be
 * made longer. So when the block in use runs low, the next nested call
 * is run on a further block ("chunk") taken from the system, reached
 * with exec's StackSwap(), and the block is left again when that call
 * returns. The engine has always tested the stack pointer against
 * rt->stack_limit where recursion can happen; those tests are where the
 * decision is taken, and they cost what they cost before: one compare.
 *
 * Two limits per segment (a segment is the task's own stack or one
 * block):
 *
 *   rt->stack_limit ("soft")  compared by the checks that can continue
 *       on another block: a JavaScript or native function being
 *       called, the parser, JSON. Below it they ask for a block.
 *   chain.hard_limit          compared by all other checks
 *       (js_check_stack_overflow), and by the growing checks when no
 *       block can be had. Below it: RangeError.
 *
 * The soft limit lies JS_STACK_RESERVE above the hard one, so code that
 * runs after a growing check has passed finds at least that much room
 * for recursion that cannot grow (a regular expression being compiled,
 * a chain of proxies, a chain of prefix operators, ...). Below the hard limit
 * QJS_STACK_MARGIN bytes stay free in every segment, as before.
 */
#ifndef QJS_STACK_CHAIN_H
#define QJS_STACK_CHAIN_H

#include "qjs_stack_chunk.h"

/* Room between the soft and the hard limit; see above. */
#define JS_STACK_RESERVE 8192UL
/* A block must offer this much above its soft limit to be worth
 * entering: a few interpreter frames. With the margin and the reserve
 * it gives the least size of a block. */
#define JS_STACK_HEADROOM 8192UL
#define JS_STACK_CHUNK_MIN (QJS_STACK_MARGIN + JS_STACK_RESERVE + JS_STACK_HEADROOM)
/* A growing check that fails this close to the top of a block failed
 * on a block entered for this very call: growing again would not help
 * (the frame is larger than a block can hold, or the cap is reached). */
#define JS_STACK_FRESH 4096UL
/* What the parser's switch points want free above the soft limit: the
 * frames between one expression or statement and the next one nested
 * in it (the operator-precedence ladder). The parser's own check, in
 * next_token, is a hard one; this keeps it out of reach while growth
 * is possible. */
#define JS_STACK_PARSE_NEED 2048UL

/* What js_stack_enter did, for js_stack_leave to undo. It lives in the
 * frame of the function that switches, on the old segment. */
typedef struct JSStackSwitch {
    void *chunk;
    uintptr_t size;
    uintptr_t prev_top, prev_floor;
} JSStackSwitch;

/* The checks that can grow the stack. Same cost as
 * js_check_stack_overflow. */
static inline bool js_stack_low(JSRuntime *rt, size_t alloca_size)
{
    uintptr_t sp;
    sp = js_get_stack_pointer() - alloca_size;
    return unlikely(sp < rt->stack_limit);
}

/* Derive both limits of the current segment from the settings. */
static void js_stack_set_limits(JSRuntime *rt)
{
    JSStackChain *c = &rt->stack_chain;
    uintptr_t hard, soft;

    hard = c->seg_floor;
    /* The cap counts whole blocks (js_stack_enter), so inside a block
     * it needs no limit of its own. On the task's stack it is the
     * distance from where the runtime was created, as upstream. The
     * subtraction is guarded: a cap larger than the address would wrap
     * round to a limit near 4 GB. */
    if (c->depth == 0 && rt->stack_size != 0 &&
        rt->stack_size <= rt->stack_top) {
        uintptr_t cap_limit = rt->stack_top - rt->stack_size;
        if (cap_limit > hard)
            hard = cap_limit;
    }
    soft = hard;
    if (c->chunk_size != 0) {
        if (c->seg_floor != 0 && soft < c->seg_floor + JS_STACK_RESERVE)
            soft = c->seg_floor + JS_STACK_RESERVE;
        /* Below the floor, or of unknown size: leave the task's stack
         * at the first check that can. */
        if (c->depth == 0 && c->base_forced)
            soft = (uintptr_t)-1;
    }
    c->hard_limit = hard;
    rt->stack_limit = soft;
}

/* Look at the stack the task is on. Only while no block is in use:
 * then, and only then, is it the segment the stack pointer is in. */
static void js_stack_read_base(JSRuntime *rt)
{
    JSStackChain *c = &rt->stack_chain;
    unsigned long lower, upper;

    if (qjs_amiga_stack_bounds(&lower, &upper)) {
        /* The runtime was created on another stack than the one the
         * task is on now (the host moved with StackSwap, or this
         * runtime is being used from inside a native function of
         * another runtime that is on a block): "the top" is then
         * meaningless here. Measure the cap from where we are. */
        if (rt->stack_top <= lower || rt->stack_top > upper)
            rt->stack_top = js_get_stack_pointer();
        c->seg_floor = lower + QJS_STACK_MARGIN;
        c->base_size = upper - lower;
    } else {
        c->seg_floor = 0;
        c->base_size = 0;
    }
    c->seg_top = rt->stack_top;
    /* "Below the floor" with one eighth of tolerance, so that a stack
     * asked for as 64 KB and delivered a little short (start-up code
     * and Shells round differently) is not doubled by a block. */
    c->base_forced = c->chunk_size != 0 &&
        (c->base_size == 0 ||
         c->base_size < c->floor_size - c->floor_size / 8);
}

/* Called by update_stack_limit: at JS_NewRuntime, JS_SetMaxStackSize,
 * JS_UpdateStackTop and JS_SetStackSizes. */
static void js_stack_update(JSRuntime *rt)
{
    if (rt->stack_chain.depth == 0)
        js_stack_read_base(rt);
    js_stack_set_limits(rt);
}

static void js_stack_chain_init(JSRuntime *rt)
{
    rt->stack_chain.floor_size = JS_STACK_DEFAULT_FLOOR;
    rt->stack_chain.chunk_size = JS_STACK_DEFAULT_CHUNK;
}

/* Bytes of stack accounted to this runtime so far, for the cap: what
 * is in use of the task's stack plus every block in use, whole. */
static uintptr_t js_stack_accounted(JSRuntime *rt, uintptr_t sp)
{
    JSStackChain *c = &rt->stack_chain;

    if (c->depth != 0)
        return c->base_used + c->active_bytes;
    return rt->stack_top > sp ? rt->stack_top - sp : 0;
}

/* A growing check found the stack low. May the call go to another
 * block? When this says no, the caller falls back on the hard limit
 * (js_check_stack_overflow) and either goes on where it is or throws.
 * `need` is what the caller wants free on the C stack beyond its own
 * frame: nothing for a call (function frames are in the frame arena),
 * JS_STACK_PARSE_NEED for the parser. */
static bool js_stack_can_grow(JSRuntime *rt, size_t need)
{
    JSStackChain *c = &rt->stack_chain;
    uintptr_t sp = js_get_stack_pointer();
    uintptr_t used;

    if (c->chunk_size == 0)
        return false;
    if (c->depth == 0) {
        /* The limits were worked out when the runtime was created.
         * The host may have moved to another stack since (its own
         * StackSwap), so look again before believing them. */
        js_stack_read_base(rt);
        js_stack_set_limits(rt);
        if (sp >= need && sp - need >= rt->stack_limit)
            return false; /* not low after all */
    } else if (c->seg_top - sp < JS_STACK_FRESH) {
        return false;
    }
    used = js_stack_accounted(rt, sp);
    if (rt->stack_size != 0 &&
        (used >= rt->stack_size ||
         need >= rt->stack_size - used ||
         rt->stack_size - used - need < JS_STACK_CHUNK_MIN))
        return false; /* the cap */
    return true;
}

/* The margin at the bottom of every block is painted when the block is
 * taken from the system and looked at when it goes back: the first
 * word that no longer holds the paint shows how deep the stack went.
 * This is the only evidence there can be that the margin is large
 * enough - a stack that leaves its block is not noticed by anything -
 * so it is always on. It costs 16 KB of writes per block taken, which
 * is nothing next to what fills a block. JSStackInfo.margin_used
 * reports the worst case; amiga/tests/test_stack_chain.js requires the
 * lowest 4 KB to be untouched. */
#define JS_STACK_PAINT 0x5a5aa5a5UL

static void js_stack_paint_margin(unsigned long lower)
{
    uint32_t *p = (uint32_t *)lower;
    uint32_t *end = (uint32_t *)(lower + QJS_STACK_MARGIN);

    while (p < end)
        *p++ = JS_STACK_PAINT;
}

/* Give a block back to the system, noting how much of its margin was
 * used. */
static void js_stack_chunk_retire(JSRuntime *rt, void *chunk)
{
    JSStackChain *c = &rt->stack_chain;
    unsigned long lower, upper;
    uint32_t *p, *end;
    uintptr_t used;

    qjs_stack_chunk_bounds(chunk, &lower, &upper);
    p = (uint32_t *)lower;
    end = (uint32_t *)(lower + QJS_STACK_MARGIN);
    while (p < end && *p == JS_STACK_PAINT)
        p++;
    used = (uintptr_t)end - (uintptr_t)p;
    if (used > c->margin_used)
        c->margin_used = used;
    qjs_stack_chunk_free(chunk);
    c->frees++;
}

static void js_stack_release_spare(JSRuntime *rt)
{
    JSStackChain *c = &rt->stack_chain;

    if (c->spare) {
        js_stack_chunk_retire(rt, c->spare);
        c->spare = NULL;
        c->spare_size = 0;
    }
}

/* Make a block the current segment. False when none can be had: the
 * caller throws. On success the caller runs its call with
 * qjs_stack_chunk_run(sw->chunk, ...) and then calls js_stack_leave. */
static bool js_stack_enter(JSRuntime *rt, size_t need, JSStackSwitch *sw)
{
    JSStackChain *c = &rt->stack_chain;
    uintptr_t sp = js_get_stack_pointer();
    uintptr_t used, min_size, want, size;
    unsigned long lower, upper;
    bool first_forced = c->depth == 0 && c->base_forced;
    void *chunk;

    used = js_stack_accounted(rt, sp);
    min_size = (need + JS_STACK_CHUNK_MIN + 3) & ~(uintptr_t)3;
    want = c->chunk_size;
    /* The floor: when the task's stack was below it, the first block
     * is at least that large. */
    if (first_forced && want < c->floor_size)
        want = c->floor_size;
    if (want < min_size)
        want = min_size;
    if (rt->stack_size != 0) {
        uintptr_t budget;
        if (used >= rt->stack_size || rt->stack_size - used < min_size)
            return false;
        budget = (rt->stack_size - used) & ~(uintptr_t)3;
        if (want > budget)
            want = budget; /* the last block before the cap is shorter */
    }

    chunk = NULL;
    size = 0;
    if (c->spare) {
        if (c->spare_size >= min_size && c->spare_size <= want &&
            (!first_forced || c->spare_size >= want)) {
            chunk = c->spare;
            size = c->spare_size;
            c->spare = NULL;
            c->spare_size = 0;
            qjs_stack_chunk_bounds(chunk, &lower, &upper);
        } else {
            js_stack_release_spare(rt);
        }
    }
    if (!chunk) {
        /* Memory may be short or in pieces: rather a smaller block
         * than none. */
        size = want;
        for(;;) {
            if (c->refuse_next != 0) {
                c->refuse_next--; /* a test wants to see this fail */
                chunk = NULL;
            } else {
                chunk = qjs_stack_chunk_alloc(size, &lower, &upper);
            }
            if (chunk)
                break;
            if (size / 2 < min_size) {
                c->refusals++;
                return false;
            }
            size = (size / 2 + 3) & ~(uintptr_t)3;
        }
        c->allocations++;
        js_stack_paint_margin(lower);
    }

    if (c->depth == 0)
        c->base_used = used;
    sw->chunk = chunk;
    sw->size = size;
    sw->prev_top = c->seg_top;
    sw->prev_floor = c->seg_floor;
    c->seg_top = upper;
    c->seg_floor = lower + QJS_STACK_MARGIN;
    c->active_bytes += size;
    c->depth++;
    c->switches++;
    if (c->depth > c->depth_max)
        c->depth_max = c->depth;
    if (c->active_bytes + c->spare_size > c->bytes_max)
        c->bytes_max = c->active_bytes + c->spare_size;
    js_stack_set_limits(rt);
    return true;
}

/* The call that was run on the block has returned; we are back on the
 * segment below. One block is kept so that a loop whose calls cross
 * the end of a segment does not allocate and free on every turn. */
static void js_stack_leave(JSRuntime *rt, JSStackSwitch *sw)
{
    JSStackChain *c = &rt->stack_chain;

    c->depth--;
    c->active_bytes -= sw->size;
    c->seg_top = sw->prev_top;
    c->seg_floor = sw->prev_floor;
    /* Of two candidates the larger is kept: where the first block is
     * a large floor block, that is the one entered again and again. */
    if (c->spare && sw->size > c->spare_size)
        js_stack_release_spare(rt);
    if (!c->spare) {
        c->spare = sw->chunk;
        c->spare_size = sw->size;
    } else {
        js_stack_chunk_retire(rt, sw->chunk);
    }
    js_stack_set_limits(rt);
}

void JS_SetStackSizes(JSRuntime *rt, size_t floor, size_t chunk, size_t cap)
{
    JSStackChain *c = &rt->stack_chain;

    if (floor != JS_STACK_KEEP)
        c->floor_size = floor;
    if (chunk != JS_STACK_KEEP) {
        if (chunk != 0 && chunk < JS_STACK_CHUNK_MIN)
            chunk = JS_STACK_CHUNK_MIN;
        c->chunk_size = chunk & ~(uintptr_t)3;
        if (c->chunk_size == 0)
            js_stack_release_spare(rt);
    }
    if (cap != JS_STACK_KEEP)
        rt->stack_size = cap;
    js_stack_update(rt);
}

void JS_StackRefuseNext(JSRuntime *rt, unsigned long count)
{
    rt->stack_chain.refuse_next = count;
    /* the spare block would satisfy the next request without asking */
    if (count != 0)
        js_stack_release_spare(rt);
}

void JS_GetStackInfo(JSRuntime *rt, JSStackInfo *info, size_t size)
{
    JSStackChain *c = &rt->stack_chain;
    JSStackInfo i;

    i.floor_size = c->floor_size;
    i.chunk_size = c->chunk_size;
    i.cap_size = rt->stack_size;
    i.base_size = c->base_size;
    i.base_forced = c->base_forced;
    i.depth = c->depth;
    i.depth_max = c->depth_max;
    i.bytes_in_use = c->active_bytes;
    i.bytes_cached = c->spare_size;
    i.bytes_max = c->bytes_max;
    i.switches = c->switches;
    i.allocations = c->allocations;
    i.frees = c->frees;
    i.refusals = c->refusals;
    i.margin_used = c->margin_used;
    if (size > sizeof(i))
        size = sizeof(i);
    memcpy(info, &i, size);
}

/* ---- carrying one call over to a new block: stack-chain-calls.h ---- */

struct JSParseState;
struct JSONStringifyContext;
struct JSAsyncFunctionState;

static JSValue js_call_on_more_stack(JSContext *ctx, JSValueConst func_obj,
                                     JSValueConst this_obj,
                                     JSValueConst new_target,
                                     int argc, JSValueConst *argv, int flags,
                                     size_t need);
static JSValue js_async_resume_on_more_stack(JSContext *ctx,
                                             struct JSAsyncFunctionState *s);
static int js_parse_on_more_stack(struct JSParseState *s, int arg,
                                  int (*parse)(struct JSParseState *s,
                                               int arg));
static JSValue json_parse_value_on_more_stack(struct JSParseState *s);
static int js_json_to_str_on_more_stack(JSContext *ctx,
                                        struct JSONStringifyContext *jsc,
                                        JSValueConst holder, JSValue val,
                                        JSValueConst indent);
static JSValue internalize_json_on_more_stack(JSContext *ctx,
                                              JSValueConst holder,
                                              JSAtom name,
                                              JSValueConst reviver);
static int64_t js_flatten_on_more_stack(JSContext *ctx, JSValueConst target,
                                        JSValueConst source,
                                        int64_t sourceLen,
                                        int64_t targetIndex, int depth,
                                        JSValueConst mapperFunction,
                                        JSValueConst thisArg);

#endif /* QJS_STACK_CHAIN_H */
