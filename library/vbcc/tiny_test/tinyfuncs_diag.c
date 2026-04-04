/*
 * tinyfuncs_diag.c — Diagnostic: replicate quickjs.library's
 * CustomLibInit step by step to find the crash.
 *
 * Each step writes to serial debug via RawPutChar.
 * GetAnswer returns which step we reached.
 */
#include <exec/types.h>
#include <exec/memory.h>
#include <dos/dos.h>
#include "execinline.h"
#include "libraryconfig.h"  /* picked up from -I/tmp */

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
    for (i = 28; i >= 0; i -= 4)
        dbg_char(sys, hex[(v >> i) & 0xf]);
}

BOOL CustomLibInit(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;

    dbg_str(sys, "DIAG: step 1 - open dos.library\n");
    last_step = 1;
    aBase->iDOSBase = __OpenLibrary(sys, "dos.library", 36);
    if (!aBase->iDOSBase) {
        dbg_str(sys, "DIAG: dos.library FAILED\n");
        return TRUE;
    }
    dbg_str(sys, "DIAG: dos.library OK = ");
    dbg_hex(sys, (unsigned long)aBase->iDOSBase);
    dbg_str(sys, "\n");

    dbg_str(sys, "DIAG: step 2 - open mathieeedoubbas.library\n");
    last_step = 2;
    aBase->iMathDoubBasBase = __OpenLibrary(sys,
        "mathieeedoubbas.library", 34);
    if (!aBase->iMathDoubBasBase) {
        dbg_str(sys, "DIAG: mathieeedoubbas FAILED\n");
        return TRUE;
    }
    dbg_str(sys, "DIAG: mathieeedoubbas OK\n");

    dbg_str(sys, "DIAG: step 3 - open mathieeedoubtrans.library\n");
    last_step = 3;
    aBase->iMathDoubTransBase = __OpenLibrary(sys,
        "mathieeedoubtrans.library", 34);
    if (!aBase->iMathDoubTransBase) {
        dbg_str(sys, "DIAG: mathieeedoubtrans FAILED\n");
        return TRUE;
    }
    dbg_str(sys, "DIAG: mathieeedoubtrans OK\n");

    dbg_str(sys, "DIAG: step 4 - CreatePool\n");
    last_step = 4;
    aBase->iMemPool = __CreatePool(sys, MEMF_PUBLIC, 65536, 16384);
    if (!aBase->iMemPool) {
        dbg_str(sys, "DIAG: CreatePool FAILED\n");
        return TRUE;
    }
    dbg_str(sys, "DIAG: pool OK = ");
    dbg_hex(sys, (unsigned long)aBase->iMemPool);
    dbg_str(sys, "\n");

    dbg_str(sys, "DIAG: step 5 - AllocPooled test\n");
    last_step = 5;
    {
        void *test = __AllocPooled(sys, aBase->iMemPool, 256);
        if (!test) {
            dbg_str(sys, "DIAG: AllocPooled FAILED\n");
            return TRUE;
        }
        dbg_str(sys, "DIAG: AllocPooled OK = ");
        dbg_hex(sys, (unsigned long)test);
        dbg_str(sys, "\n");
        __FreePooled(sys, aBase->iMemPool, test, 256);
        dbg_str(sys, "DIAG: FreePooled OK\n");
    }

    dbg_str(sys, "DIAG: CustomLibInit complete!\n");
    last_step = 6;
    return FALSE;
}

VOID CustomLibCleanup(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;
    dbg_str(sys, "DIAG: cleanup\n");
    if (aBase->iMemPool) {
        __DeletePool(sys, aBase->iMemPool);
        aBase->iMemPool = NULL;
    }
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

LONG TT_GetAnswer(__reg("a6") LIBRARY_BASE_TYPE *base)
{
    return last_step;
}
