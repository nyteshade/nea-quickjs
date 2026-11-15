/*
 * qjs_stack_js.c - os.stackInfo(): the figures of the growable
 * JavaScript stack, for scripts. See docs/STACK.md.
 *
 * It exists so that amiga/tests/test_stack_chain.js can prove what the
 * stack did (how many blocks, how many taken from the system, how many
 * given back) instead of inferring it, and so that a script can see
 * the three sizes it is running with. Called without an argument it
 * only reads. os.stackInfo(n) is for that test alone: the next n
 * requests to the system for a stack block are refused, as if memory
 * were short (JS_StackRefuseNext); os.stackInfo(0) ends that.
 *
 * The function is listed in js_os_funcs in quickjs-libc.c; that one
 * line is all quickjs-libc.c knows about it.
 */
#include "amiga_compat_vbcc.h"
#include <exec/types.h>

#include "quickjs.h"
#include "amiga/stack/stack-chain-api.h"

/* One property per member of JSStackInfo, by the name used in
 * docs/STACK.md. Sizes are bytes. */
#define STACK_INFO_PROP(obj, name, value) \
    JS_SetPropertyStr(ctx, obj, name, JS_NewUint32(ctx, (uint32_t)(value)))

JSValue js_os_stack_info(JSContext *ctx, JSValueConst this_val,
                         int argc, JSValueConst *argv)
{
    JSStackInfo info;
    JSValue obj;
    uint32_t refuse;

    if (argc > 0 && !JS_IsUndefined(argv[0])) {
        if (JS_ToUint32(ctx, &refuse, argv[0]))
            return JS_EXCEPTION;
        JS_StackRefuseNext(JS_GetRuntime(ctx), refuse);
    }
    JS_GetStackInfo(JS_GetRuntime(ctx), &info, sizeof(info));
    obj = JS_NewObject(ctx);
    if (JS_IsException(obj))
        return obj;
    STACK_INFO_PROP(obj, "floor", info.floor_size);
    STACK_INFO_PROP(obj, "chunk", info.chunk_size);
    STACK_INFO_PROP(obj, "cap", info.cap_size);
    STACK_INFO_PROP(obj, "baseSize", info.base_size);
    JS_SetPropertyStr(ctx, obj, "baseForced",
                      JS_NewBool(ctx, info.base_forced != 0));
    STACK_INFO_PROP(obj, "depth", info.depth);
    STACK_INFO_PROP(obj, "depthMax", info.depth_max);
    STACK_INFO_PROP(obj, "bytesInUse", info.bytes_in_use);
    STACK_INFO_PROP(obj, "bytesCached", info.bytes_cached);
    STACK_INFO_PROP(obj, "bytesMax", info.bytes_max);
    STACK_INFO_PROP(obj, "switches", info.switches);
    STACK_INFO_PROP(obj, "allocations", info.allocations);
    STACK_INFO_PROP(obj, "frees", info.frees);
    STACK_INFO_PROP(obj, "refusals", info.refusals);
    STACK_INFO_PROP(obj, "marginUsed", info.margin_used);
    return obj;
}
