/*
 * qjs_stack_chunk.h - the AmigaOS side of the growable JavaScript
 * stack: the task's own stack bounds, and blocks of memory to continue
 * on. Used by quickjs-master/amiga/stack/stack-chain.h, which decides
 * when; this side only knows how. See docs/STACK.md.
 */
#ifndef QJS_STACK_CHUNK_H
#define QJS_STACK_CHUNK_H

/* What stays free below the lowest address the engine lets the stack
 * pointer reach, in the task's stack and in every block. The reasons
 * and the measurements are in qjs_stack_chunk.c. */
#define QJS_STACK_MARGIN 16384UL

/* The bounds of the stack the calling task is on (tc_SPLower,
 * tc_SPUpper). Returns 0 and sets nothing when they do not describe
 * the stack the caller is really running on. */
int qjs_amiga_stack_bounds(unsigned long *lower, unsigned long *upper);

/* A block of `size` bytes to use as stack. Returns a handle, or NULL
 * when there is no memory; *lower and *upper receive the bounds of the
 * part the stack pointer may be in (a little less than `size`). */
void *qjs_stack_chunk_alloc(unsigned long size, unsigned long *lower,
                            unsigned long *upper);
void qjs_stack_chunk_bounds(void *chunk, unsigned long *lower,
                            unsigned long *upper);
void qjs_stack_chunk_free(void *chunk);

/* Call fn(arg) on the block and come back when it returns. */
void qjs_stack_chunk_run(void *chunk, void (*fn)(void *), void *arg);

#endif /* QJS_STACK_CHUNK_H */
