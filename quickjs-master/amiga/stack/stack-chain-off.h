/*
 * stack-chain-off.h - the functions of stack-chain-api.h for a
 * library built with -DQJS_NO_CHAINED_STACK, in which the stack is the
 * task's own and never grows. They exist so that the library vectors
 * QJS_SetStackSizes and QJS_GetStackInfo and os.stackInfo() link and
 * answer truthfully. Included by quickjs.c in place of stack-chain.h.
 */
#ifndef QJS_STACK_CHAIN_OFF_H
#define QJS_STACK_CHAIN_OFF_H

#include "amiga/stack/stack-chain-api.h"

static void update_stack_limit(JSRuntime *rt);

/* Only the cap means anything here. */
void JS_SetStackSizes(JSRuntime *rt, size_t floor, size_t chunk, size_t cap)
{
    if (cap != JS_STACK_KEEP) {
        rt->stack_size = cap;
        update_stack_limit(rt);
    }
}

void JS_StackRefuseNext(JSRuntime *rt, unsigned long count)
{
}

/* chunk_size 0 says it: growth is off. */
void JS_GetStackInfo(JSRuntime *rt, JSStackInfo *info, size_t size)
{
    JSStackInfo i;

    memset(&i, 0, sizeof(i));
    i.cap_size = rt->stack_size;
    if (size > sizeof(i))
        size = sizeof(i);
    memcpy(info, &i, size);
}

#endif /* QJS_STACK_CHAIN_OFF_H */
