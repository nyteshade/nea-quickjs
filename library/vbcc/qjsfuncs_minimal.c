/*
 * qjsfuncs_minimal.c — Minimal library functions for load-testing.
 * No engine dependency — just stubs to verify the library loads.
 */
#include <exec/types.h>
#include <exec/memory.h>
#include <exec/execbase.h>
#include <stddef.h>

#include "libraryconfig.h"

typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

/* Global SysBase/DOSBase — defined in libsyms.c */
extern struct ExecBase *SysBase;
extern struct Library *DOSBase;

BOOL CustomLibInit(LIBRARY_BASE_TYPE *aBase)
{
    SysBase = aBase->iSysBase;

    aBase->iDOSBase = __OpenLibrary(aBase->iSysBase,
                                     "dos.library", 36);
    if (!aBase->iDOSBase)
        return TRUE;
    DOSBase = aBase->iDOSBase;
    return FALSE;
}

VOID CustomLibCleanup(LIBRARY_BASE_TYPE *aBase)
{
    if (aBase->iDOSBase) {
        __CloseLibrary(aBase->iSysBase, aBase->iDOSBase);
        aBase->iDOSBase = NULL;
    }
    DOSBase = NULL;
    SysBase = NULL;
}

/* Stub implementations — return NULL/0 for everything */
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
{ return "0.50-stub"; }

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
    if (result) {
        result->u.int32 = 0;
        result->tag = 0;
    }
}
