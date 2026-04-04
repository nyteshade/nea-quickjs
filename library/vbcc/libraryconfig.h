/*
 * libraryconfig.h — Configuration for quickjs.library via VBCC template
 *
 * This file is included by library.h from the vbcc-librarytemplate.
 * It defines the library base structure, version info, and function table.
 */
#ifndef LIBRARYCONFIG_H
#define LIBRARYCONFIG_H

#include <exec/types.h>
#include <exec/libraries.h>
#include <exec/execbase.h>
#include <dos/dos.h>
#include "execinline.h"

/* Forward declarations for QuickJS types */
struct JSRuntime;
struct JSContext;
typedef union { long int32; double float64; void *ptr; long sbi; } JSValueUnion;
typedef struct { JSValueUnion u; long tag; } JSValue;

/* ---- Library base structure ---- */

struct QJSLibBase {
    struct Library iLibrary;
    UWORD iPadding;
    BPTR iSegmentList;
    struct ExecBase *iSysBase;
    /* Custom fields — all opened/created in CustomLibInit */
    struct Library *iDOSBase;
    struct Library *iMathDoubBasBase;
    struct Library *iMathDoubTransBase;
    APTR iMemPool;              /* exec memory pool for allocations */
};

/* ---- Steering defines ---- */

#define LIBRARY_NAME "quickjs.library"
#define LIBRARY_VERSION_STRING "\0$VER: quickjs.library 0.54 (04.4.2026)\r\n"
#define LIBRARY_VERSION_OUTPUT &LIBRARY_VERSION_STRING[7]
#define LIBRARY_VERSION 0
#define LIBRARY_REVISION 54
#define LIBRARY_BASE_TYPE struct QJSLibBase

/* ---- Function declarations ---- */

/* These use VBCC's __reg() syntax for register parameters */

struct JSRuntime *QJS_NewRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base);

void QJS_FreeRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

struct JSContext *QJS_NewContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

struct JSContext *QJS_NewContextRaw(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

void QJS_FreeContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

const char *QJS_GetVersion(
    __reg("a6") LIBRARY_BASE_TYPE *base);

void QJS_SetMemoryLimit(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG limit);

void QJS_SetMaxStackSize(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG stack_size);

void QJS_RunGC(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

int QJS_AddBaseObjects(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddEval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddDate(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddRegExp(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddJSON(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddProxy(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddMapSet(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddTypedArrays(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddPromise(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddWeakRef(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddDOMException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddPerformance(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

/* EvalSimple: evaluate JS, return int32 result. -9999 on exception. */
long QJS_EvalSimple(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *input,
    __reg("d0") ULONG input_len);

/* Full Eval with JSValue output pointer */
void QJS_Eval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *input,
    __reg("d0") ULONG input_len,
    __reg("a3") const char *filename,
    __reg("d1") int eval_flags);

/* ---- Function pointer table ---- */

#define LIBRARY_FUNCTIONS \
    (APTR) QJS_NewRuntime, \
    (APTR) QJS_FreeRuntime, \
    (APTR) QJS_NewContext, \
    (APTR) QJS_NewContextRaw, \
    (APTR) QJS_FreeContext, \
    (APTR) QJS_GetVersion, \
    (APTR) QJS_SetMemoryLimit, \
    (APTR) QJS_SetMaxStackSize, \
    (APTR) QJS_RunGC, \
    (APTR) QJS_AddBaseObjects, \
    (APTR) QJS_AddEval, \
    (APTR) QJS_AddDate, \
    (APTR) QJS_AddRegExp, \
    (APTR) QJS_AddJSON, \
    (APTR) QJS_AddProxy, \
    (APTR) QJS_AddMapSet, \
    (APTR) QJS_AddTypedArrays, \
    (APTR) QJS_AddPromise, \
    (APTR) QJS_AddWeakRef, \
    (APTR) QJS_AddDOMException, \
    (APTR) QJS_AddPerformance, \
    (APTR) QJS_EvalSimple, \
    (APTR) QJS_Eval

#endif /* LIBRARYCONFIG_H */
