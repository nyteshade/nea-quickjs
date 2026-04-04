/*
 * tinyfuncs_dbg.c — Tiny library with debug trace in init.
 * Uses dos.library Write() to output debug to stdout.
 *
 * Tests whether CustomLibInit runs and whether opening
 * dos.library works from library init context.
 */
#include <exec/types.h>
#include <dos/dos.h>
#include "../execinline.h"
#include "libraryconfig.h"

/* Write a string to the serial debug port (RawPutChar) */
static void dbg_char(struct ExecBase *sysBase, char c)
{
    /* exec RawPutChar — LVO -516 */
    ((void (*)(
        __reg("a6") struct ExecBase *,
        __reg("d0") UBYTE))
     *((APTR *)((char *)sysBase - 516)))(sysBase, (UBYTE)c);
}

static void dbg_str(struct ExecBase *sysBase, const char *s)
{
    while (*s)
        dbg_char(sysBase, *s++);
}

BOOL CustomLibInit(LIBRARY_BASE_TYPE *aBase)
{
    dbg_str(aBase->iSysBase, "TT: CustomLibInit enter\n");
    dbg_str(aBase->iSysBase, "TT: CustomLibInit done\n");
    return FALSE; /* success */
}

VOID CustomLibCleanup(LIBRARY_BASE_TYPE *aBase)
{
    dbg_str(aBase->iSysBase, "TT: CustomLibCleanup\n");
}

LONG TT_GetAnswer(__reg("a6") LIBRARY_BASE_TYPE *base)
{
    return 42;
}
