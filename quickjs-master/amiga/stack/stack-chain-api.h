/*
 * stack-chain-api.h - settings and figures of the growable JavaScript
 * stack (AmigaOS, vbcc). The design is described in docs/STACK.md.
 *
 * Included by the engine (quickjs.c) and by whoever reads or sets the
 * figures: library/vbcc/qjs_stack_vectors.c for the library vectors
 * QJS_SetStackSizes and QJS_GetStackInfo, and for os.stackInfo().
 */
#ifndef QJS_STACK_CHAIN_API_H
#define QJS_STACK_CHAIN_API_H

#include <stddef.h>

struct JSRuntime;

/* Defaults, in bytes. See docs/STACK.md, "The three sizes". */
#define JS_STACK_DEFAULT_FLOOR (64UL * 1024UL)
#define JS_STACK_DEFAULT_CHUNK (128UL * 1024UL)

/* Pass this to JS_SetStackSizes for a size that is to stay as it is. */
#define JS_STACK_KEEP ((size_t)-1)

/* Every member is 32 bits wide; members are only ever added at the end,
 * and JS_GetStackInfo copies no more than the caller asked for. */
typedef struct JSStackInfo {
    unsigned long floor_size;    /* setting: least stack JavaScript starts on */
    unsigned long chunk_size;    /* setting: size of a further block; 0 = never grow */
    unsigned long cap_size;      /* setting: most stack in all; 0 = no cap */
    unsigned long base_size;     /* the stack the task came with; 0 = not known */
    unsigned long base_forced;   /* 1: that stack is below the floor (or not
                                    known), so JavaScript runs on blocks of
                                    ours only */
    unsigned long depth;         /* blocks in use right now */
    unsigned long depth_max;     /* most blocks ever in use at once */
    unsigned long bytes_in_use;  /* memory of the blocks in use */
    unsigned long bytes_cached;  /* memory of the spare block kept for reuse */
    unsigned long bytes_max;     /* most memory ever held, in use plus spare */
    unsigned long switches;      /* times a call was continued on another block */
    unsigned long allocations;   /* blocks taken from the system */
    unsigned long frees;         /* blocks given back to the system */
    unsigned long refusals;      /* times growth was wanted and no block could
                                    be had (no memory) */
    unsigned long margin_used;   /* deepest the stack went into the 16 KB that
                                    must stay free at the bottom of a block,
                                    over all blocks given back so far */
} JSStackInfo;

/* Set the floor, the block size and the cap of a runtime, in bytes.
 * JS_STACK_KEEP leaves a size alone. chunk 0 turns growth off: the
 * stack is then the task's own and nothing else. cap is the number
 * JS_SetMaxStackSize sets (0 = no cap). Sizes too small to work are
 * raised to the least that does. Call it on the task that runs the
 * JavaScript, like JS_UpdateStackTop. */
void JS_SetStackSizes(struct JSRuntime *rt, size_t floor, size_t chunk,
                      size_t cap);

/* For tests. The next `count` requests to the system for a stack block
 * fail as if memory were short; 0 ends it. One attempt to grow makes
 * several requests, each for half the size of the one before, so a
 * count of 1 yields a block of half the usual size and a large count
 * yields RangeError. (An emulator that stops when memory runs out
 * cannot show either otherwise.) Reached from scripts as
 * os.stackInfo(count). */
void JS_StackRefuseNext(struct JSRuntime *rt, unsigned long count);

/* Copy at most `size` bytes of the figures above to `info`. */
void JS_GetStackInfo(struct JSRuntime *rt, JSStackInfo *info, size_t size);

#endif /* QJS_STACK_CHAIN_API_H */
