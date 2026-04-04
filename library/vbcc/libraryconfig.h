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

/* --- Batch 1: Runtime --- */

void QJS_SetRuntimeInfo(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") const char *info);

void *QJS_GetRuntimeOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

void QJS_SetRuntimeOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *opaque);

void QJS_UpdateStackTop(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

void QJS_SetDumpFlags(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") unsigned long long *flags_ptr);

void QJS_GetDumpFlags(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") unsigned long long *result_ptr);

ULONG QJS_GetGCThreshold(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

void QJS_SetGCThreshold(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG threshold);

int QJS_IsLiveObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") JSValue *obj_ptr);

/* --- Batch 1: Context --- */

struct JSContext *QJS_DupContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

void *QJS_GetContextOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

void QJS_SetContextOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *opaque);

struct JSRuntime *QJS_GetRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

void QJS_SetClassProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG class_id,
    __reg("a2") JSValue *obj_ptr);

void QJS_GetClassProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG class_id);

void QJS_GetFunctionProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

int QJS_AddBigInt(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

void QJS_AddRegExpCompiler(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

/* --- Batch 1: Comparison --- */

int QJS_IsEqual(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr);

int QJS_IsStrictEqual(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr);

int QJS_IsSameValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr);

int QJS_IsSameValueZero(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr);

/* --- Batch 1: Memory/Finalizer --- */

void QJS_ComputeMemoryUsage(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *s);

int QJS_AddRuntimeFinalizer(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *finalizer,
    __reg("a2") void *arg);

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
    (APTR) QJS_Eval, \
    (APTR) QJS_SetRuntimeInfo, \
    (APTR) QJS_GetRuntimeOpaque, \
    (APTR) QJS_SetRuntimeOpaque, \
    (APTR) QJS_UpdateStackTop, \
    (APTR) QJS_SetDumpFlags, \
    (APTR) QJS_GetDumpFlags, \
    (APTR) QJS_GetGCThreshold, \
    (APTR) QJS_SetGCThreshold, \
    (APTR) QJS_IsLiveObject, \
    (APTR) QJS_DupContext, \
    (APTR) QJS_GetContextOpaque, \
    (APTR) QJS_SetContextOpaque, \
    (APTR) QJS_GetRuntime, \
    (APTR) QJS_SetClassProto, \
    (APTR) QJS_GetClassProto, \
    (APTR) QJS_GetFunctionProto, \
    (APTR) QJS_AddBigInt, \
    (APTR) QJS_AddRegExpCompiler, \
    (APTR) QJS_IsEqual, \
    (APTR) QJS_IsStrictEqual, \
    (APTR) QJS_IsSameValue, \
    (APTR) QJS_IsSameValueZero, \
    (APTR) QJS_ComputeMemoryUsage, \
    (APTR) QJS_AddRuntimeFinalizer

#endif /* LIBRARYCONFIG_H */
