/*
 * stack-chain-types.h - what a runtime remembers about its chained
 * stack. Included by quickjs.c just before struct JSRuntime, which
 * embeds one JSStackChain. The code is in stack-chain.h; the design is
 * in docs/STACK.md.
 */
#ifndef QJS_STACK_CHAIN_TYPES_H
#define QJS_STACK_CHAIN_TYPES_H

#include "amiga/stack/stack-chain-api.h"

typedef struct JSStackChain {
    /* ---- settings (the cap is JSRuntime.stack_size) ---- */
    uintptr_t floor_size;
    uintptr_t chunk_size;       /* 0: growth is off */

    /* ---- the segment the stack pointer is in now: the task's own
     *      stack while depth is 0, otherwise the newest block ---- */
    uintptr_t seg_top;          /* its highest address */
    uintptr_t seg_floor;        /* the lowest address the stack pointer may
                                   reach in it (bottom plus the margin);
                                   0 = not known (task's stack only) */
    /* Where the checks that cannot grow the stack give up. The checks
     * that can grow it compare with JSRuntime.stack_limit, which lies
     * JS_STACK_RESERVE higher. */
    uintptr_t hard_limit;

    /* ---- the chain ---- */
    uintptr_t base_size;        /* size of the task's stack, 0 = not known */
    uintptr_t base_used;        /* bytes of it in use below stack_top when
                                   the first block was entered */
    uintptr_t active_bytes;     /* memory of the blocks in use */
    uint32_t depth;             /* blocks in use */
    bool base_forced;           /* see JSStackInfo.base_forced */
    void *spare;                /* one block kept for reuse, or NULL */
    uintptr_t spare_size;

    /* ---- figures for JS_GetStackInfo ---- */
    uint32_t depth_max;
    uintptr_t bytes_max;
    uint32_t switches, allocations, frees, refusals;
    uintptr_t margin_used;

    /* For tests: this many requests to the system for a block are
     * answered "no memory" without asking (JS_StackRefuseNext). */
    uint32_t refuse_next;
} JSStackChain;

#endif /* QJS_STACK_CHAIN_TYPES_H */
