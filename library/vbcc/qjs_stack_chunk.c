/*
 * qjs_stack_chunk.c - the AmigaOS side of the growable JavaScript
 * stack: where the calling task's stack ends, and blocks of memory to
 * continue on when it runs low. The policy (when to grow, the cap, the
 * spare block) is in quickjs-master/amiga/stack/stack-chain.h; the
 * design is in docs/STACK.md.
 *
 * ---- QJS_STACK_MARGIN ----
 *
 * QJS_STACK_MARGIN is what must stay free below the interpreter's
 * lowest limit in the task's stack and in every block. The engine
 * tests the stack pointer when a JavaScript function is entered and at
 * its other recursion points (parser, JSON, regexp compiler, toString
 * of nested values); between two tests the stack still grows by the
 * frame of the interpreter itself, by whatever C helpers that call
 * reaches before the next test, and by dos.library or another library
 * called from there. Measured on the 020soft library under vamos, on a
 * zero-filled 256 KB stack, by finding the lowest word written after
 * each kind of runaway recursion had been stopped: the stack pointer
 * went at most 6,008 bytes below the limit (plain calls 3.9 KB,
 * getters 4.1 KB, JSON.stringify 5.3 KB, toString and String.replace
 * callbacks 6.0 KB). 16 KB leaves 10 KB beyond that for a dos.library
 * call (handlers run on their own stacks) and for exec saving the
 * task's registers on this stack at a task switch.
 * amiga/tests/test_stack_limit.js paints the margin and reports how
 * far into it the stack went.
 */
#include <exec/types.h>
#include <exec/memory.h>
#include <exec/execbase.h>
#include <exec/tasks.h>

#include "execinline.h"
#include "libraryconfig.h"
#include "qjs_stack_chunk.h"

extern LIBRARY_BASE_TYPE *_qjs_lib_base;    /* qjsfuncs.c */

/* qjs_stack_switch.s */
extern void qjs_stack_switch(struct StackSwapStruct *sss,
                             void (*fn)(void *), void *arg,
                             struct ExecBase *sys);

/* The calling task - exec.library FindTask(NULL), LVO -294. */
static struct Task *__qjs_stack_FindTask(__reg("a6") struct ExecBase *sb,
                                         __reg("a1") const char *name)
                                         = "\tjsr\t-294(a6)";

/* The bounds of the stack the calling task is on.
 *
 * Returns 0, "unknown", when tc_SPLower/tc_SPUpper do not describe the
 * stack we are actually running on: vamos leaves them 0, and a program
 * that moved its stack by hand without StackSwap() leaves them
 * describing the old one. The engine then treats the stack as too
 * small to trust and moves JavaScript to a block of its own at the
 * first opportunity (or, with growth turned off, falls back to
 * assuming JS_DEFAULT_STACK_SIZE below the stack top, as it always
 * did).
 *
 * Always called on the task that runs the JavaScript, and only while
 * no block is in use: our own blocks' bounds the engine knows itself.
 */
int qjs_amiga_stack_bounds(unsigned long *lower_out, unsigned long *upper_out)
{
    /* static, not a local: vbcc loads a6 for the library call before
     * the other arguments, and a6 is what it addresses locals with */
    static struct ExecBase *sys;
    struct Task *task;
    unsigned long lower, upper, here;
    char marker;

    if (!_qjs_lib_base)
        return 0;

    sys = _qjs_lib_base->iSysBase;
    task = __qjs_stack_FindTask(sys, NULL);
    lower = (unsigned long)task->tc_SPLower;
    upper = (unsigned long)task->tc_SPUpper;
    here = (unsigned long)&marker;

    if (lower == 0 || upper <= lower || here <= lower || here > upper)
        return 0;

    *lower_out = lower;
    *upper_out = upper;
    return 1;
}

/* A block. The header sits at the HIGH end, above the part used as
 * stack: a stack that overran its block would run off the low end, so
 * up here the StackSwapStruct that leads back to the previous stack is
 * out of its way. */
struct QJSStackChunk {
    struct StackSwapStruct sss; /* exchanged by StackSwap() */
    void *mem;                  /* what AllocMem returned */
    ULONG mem_size;
    ULONG lower, upper;         /* the stack part: [lower, upper) */
};

/* MEMF_PUBLIC because exec itself writes to a task's stack: at every
 * task switch it saves the registers there, with interrupts disabled.
 * Memory that a virtual-memory system might page out is not allowed
 * for that (it is the same flag exec's own CreateTask examples and
 * dos.library use for stacks). Chip or fast does not matter; no
 * MEMF_CLEAR, a stack needs no particular contents. */
void *qjs_stack_chunk_alloc(unsigned long size, unsigned long *lower,
                            unsigned long *upper)
{
    struct QJSStackChunk *chunk;
    void *mem;

    if (!_qjs_lib_base || size < sizeof(*chunk) + 1024)
        return 0;
    size &= ~3UL;
    mem = __AllocMem(_qjs_lib_base->iSysBase, size, MEMF_PUBLIC);
    if (!mem)
        return 0;
    chunk = (struct QJSStackChunk *)((char *)mem + size - sizeof(*chunk));
    chunk->mem = mem;
    chunk->mem_size = size;
    chunk->lower = (ULONG)mem;
    chunk->upper = (ULONG)chunk;
    *lower = chunk->lower;
    *upper = chunk->upper;
    return chunk;
}

void qjs_stack_chunk_bounds(void *handle, unsigned long *lower,
                            unsigned long *upper)
{
    struct QJSStackChunk *chunk = handle;

    *lower = chunk->lower;
    *upper = chunk->upper;
}

void qjs_stack_chunk_free(void *handle)
{
    struct QJSStackChunk *chunk = handle;

    if (chunk && _qjs_lib_base)
        __FreeMem(_qjs_lib_base->iSysBase, chunk->mem, chunk->mem_size);
}

/* Run fn(arg) on the block. The block is empty when this is called
 * (a block carries one nested call at a time), so the stack pointer
 * starts at its top. */
void qjs_stack_chunk_run(void *handle, void (*fn)(void *), void *arg)
{
    struct QJSStackChunk *chunk = handle;

    chunk->sss.stk_Lower = (APTR)chunk->lower;
    chunk->sss.stk_Upper = chunk->upper;
    chunk->sss.stk_Pointer = (APTR)chunk->upper;
    qjs_stack_switch(&chunk->sss, fn, arg, _qjs_lib_base->iSysBase);
}
