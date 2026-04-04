/*
 * diag_init.c — Diagnostic: replicate quickjs.library's
 * CustomLibInit step by step to find the crash.
 *
 * Uses the real quickjs libraryconfig.h (same base struct).
 * Reports last step reached via TT_GetAnswer (returns step number).
 * Debug output via exec RawPutChar to serial.
 */
#include <exec/types.h>
#include <exec/memory.h>

#include "libraryconfig.h"
#include "sharedlib_mem.h"

static int last_step;

/* RawPutChar — exec LVO -516 */
static void dbg_char(struct ExecBase *sys, char c)
{
    ((void (*)(
        __reg("a6") struct ExecBase *,
        __reg("d0") UBYTE))
     *((APTR *)((char *)sys - 516)))(sys, (UBYTE)c);
}

static void dbg_str(struct ExecBase *sys, const char *s)
{
    while (*s)
        dbg_char(sys, *s++);
}

static void dbg_hex(struct ExecBase *sys, unsigned long v)
{
    static const char hex[] = "0123456789abcdef";
    int i;
    dbg_str(sys, "0x");
    for (i = 28; i >= 0; i -= 4)
        dbg_char(sys, hex[(v >> i) & 0xf]);
}

BOOL CustomLibInit(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;

    dbg_str(sys, "QJS DIAG: step 1 - dos.library\n");
    last_step = 1;
    aBase->iDOSBase = __OpenLibrary(sys, "dos.library", 36);
    if (!aBase->iDOSBase) {
        dbg_str(sys, "QJS DIAG: FAIL dos\n");
        return TRUE;
    }
    dbg_str(sys, "QJS DIAG: dos OK ");
    dbg_hex(sys, (unsigned long)aBase->iDOSBase);
    dbg_str(sys, "\n");

    dbg_str(sys, "QJS DIAG: step 2 - mathieeedoubbas\n");
    last_step = 2;
    aBase->iMathDoubBasBase = __OpenLibrary(sys,
        "mathieeedoubbas.library", 34);
    if (!aBase->iMathDoubBasBase) {
        dbg_str(sys, "QJS DIAG: FAIL mathbas\n");
        return TRUE;
    }
    dbg_str(sys, "QJS DIAG: mathbas OK\n");

    dbg_str(sys, "QJS DIAG: step 3 - mathieeedoubtrans\n");
    last_step = 3;
    aBase->iMathDoubTransBase = __OpenLibrary(sys,
        "mathieeedoubtrans.library", 34);
    if (!aBase->iMathDoubTransBase) {
        dbg_str(sys, "QJS DIAG: FAIL mathtrans\n");
        return TRUE;
    }
    dbg_str(sys, "QJS DIAG: mathtrans OK\n");

    dbg_str(sys, "QJS DIAG: step 4 - CreatePool\n");
    last_step = 4;
    if (AmigaPoolInit(aBase)) {
        dbg_str(sys, "QJS DIAG: FAIL pool\n");
        return TRUE;
    }
    dbg_str(sys, "QJS DIAG: pool OK ");
    dbg_hex(sys, (unsigned long)aBase->iMemPool);
    dbg_str(sys, "\n");

    dbg_str(sys, "QJS DIAG: step 5 - test alloc\n");
    last_step = 5;
    {
        void *test = AmigaAlloc(aBase, 256, AA_MALLOC, NULL);
        if (!test) {
            dbg_str(sys, "QJS DIAG: FAIL alloc\n");
            return TRUE;
        }
        dbg_str(sys, "QJS DIAG: alloc OK ");
        dbg_hex(sys, (unsigned long)test);
        dbg_str(sys, "\n");
        AmigaFree(aBase, test, AA_MALLOC);
        dbg_str(sys, "QJS DIAG: free OK\n");
    }

    dbg_str(sys, "QJS DIAG: init complete!\n");
    last_step = 6;
    return FALSE;
}

VOID CustomLibCleanup(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;
    dbg_str(sys, "QJS DIAG: cleanup\n");
    AmigaPoolCleanup(aBase);
    if (aBase->iMathDoubTransBase) {
        __CloseLibrary(sys, aBase->iMathDoubTransBase);
        aBase->iMathDoubTransBase = NULL;
    }
    if (aBase->iMathDoubBasBase) {
        __CloseLibrary(sys, aBase->iMathDoubBasBase);
        aBase->iMathDoubBasBase = NULL;
    }
    if (aBase->iDOSBase) {
        __CloseLibrary(sys, aBase->iDOSBase);
        aBase->iDOSBase = NULL;
    }
}

/* Reuse the quickjs.library function table — but all stubs except GetVersion */
struct JSRuntime *QJS_NewRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base)
{ return NULL; }

void QJS_FreeRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{ }

struct JSContext *QJS_NewContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{ return NULL; }

struct JSContext *QJS_NewContextRaw(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{ return NULL; }

void QJS_FreeContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{ }

const char *QJS_GetVersion(
    __reg("a6") LIBRARY_BASE_TYPE *base)
{
    static char buf[16];
    buf[0] = '0' + last_step;
    buf[1] = '\0';
    return buf;
}

void QJS_SetMemoryLimit(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG limit)
{ }

void QJS_SetMaxStackSize(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG stack_size)
{ }

void QJS_RunGC(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{ }

int QJS_AddBaseObjects(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{ return 0; }

int QJS_AddEval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{ return 0; }

long QJS_EvalSimple(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *input,
    __reg("d0") ULONG input_len)
{ return -9999; }

void QJS_Eval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *input,
    __reg("d0") ULONG input_len,
    __reg("a3") const char *filename,
    __reg("d1") int eval_flags)
{
    if (result) { result->u.int32 = 0; result->tag = 0; }
}
