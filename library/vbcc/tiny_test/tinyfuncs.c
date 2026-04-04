/*
 * tinyfuncs.c — One function, no .lib dependencies at all.
 */
#include <exec/types.h>
#include "libraryconfig.h"

BOOL CustomLibInit(LIBRARY_BASE_TYPE *aBase)
{
    return FALSE; /* success */
}

VOID CustomLibCleanup(LIBRARY_BASE_TYPE *aBase)
{
}

LONG TT_GetAnswer(__reg("a6") LIBRARY_BASE_TYPE *base)
{
    return 42;
}
