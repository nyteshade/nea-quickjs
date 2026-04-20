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
    ULONG iNetCaps;             /* W7: bitmask of QJS_NET_* probed at init */
};

/* Networking capability bits — set by CustomLibInit via probe of
 * bsdsocket.library (v4) and amisslmaster.library. Queryable via
 * QJS_GetNetCapabilities LVO and from JS via the "qjs:net" module.
 * fetch() checks these before attempting a request and throws a
 * clear TypeError naming the missing library when a cap is absent. */
#define QJS_NET_TCP  0x01
#define QJS_NET_TLS  0x02

/* ---- Steering defines ---- */

#define LIBRARY_NAME "quickjs.library"

/* QJS_VARIANT_NAME is injected by the Makefile per CPU/FPU variant
 * as an UNQUOTED token: 020fpu, 020soft, 040fpu, 040soft, 060fpu, 060soft.
 * QJS_STR() stringifies it (two-level macro is required for token
 * concatenation → string literal conversion to work with passed-in defines).
 *
 * Appears in the $VER string so each library instance is self-identifying
 * even after being copied to LIBS:quickjs.library (where the filename
 * no longer carries the variant info). */
#ifndef QJS_VARIANT_NAME
#define QJS_VARIANT_NAME unknown
#endif
#define _QJS_STR(x) #x
#define QJS_STR(x) _QJS_STR(x)

/* ===== Packed-decimal versioning =====
 *
 * AmigaOS's lib_Version field is a single UWORD checked by OpenLibrary's
 * gate. A naive split (major in lib_Version, minor in lib_Revision) has
 * two failure modes: (1) minor bumps don't evict resident old copies
 * (lib_Version stays the same), and (2) bumping to "1.0" culturally
 * signals a release we haven't earned yet.
 *
 * Solution: lib_Version holds a PACKED decimal number  M*1000 + R, where
 *   M = major digit (0..65)    — pre-release while 0, released when ≥1
 *   R = revision   (000..999)  — monotonic within a major; always displayed
 *                                as three digits (leading zeros preserved)
 *
 * Examples:
 *   lib_Version = 70   → displays "0.070"  — pre-release, has Worker API
 *   lib_Version = 120  → displays "0.120"  — future dev state
 *   lib_Version = 1000 → displays "1.000"  — first real release
 *   lib_Version = 1005 → displays "1.005"  — first post-release bugfix
 *   lib_Version = 1050 → displays "1.050"  — NOT "1.05"; always 3-digit rev
 *
 * Properties:
 *   - Integer monotonic: OpenLibrary's version check and exec's resident
 *     eviction both work correctly — any newer version is strictly greater.
 *   - No cultural overclaim: we stay under 1000 until genuinely releasing
 *     v1. The $VER string matches the packed encoding.
 *   - Consumer API gate: OpenLibrary("quickjs.library", 70) means "I need
 *     at least the 0.070 API (which has Worker LVOs)". When we add a new
 *     capability (e.g. child_process at packed 200), consumers who need
 *     that pass 200.
 *
 * Bump rules:
 *   - Any bugfix, feature, LVO addition → lib_Version += 1
 *   - Cutting a real v1 release         → lib_Version jumps to 1000
 *   - v1 post-release patches           → 1001, 1002, ...
 *   - Next major (v2)                   → 2000
 *
 * lib_Revision (the Library struct field) is redundant with the packed
 * encoding; we mirror the revision part there purely for anything that
 * naively prints "lib_Version.lib_Revision" (not much does on AmigaOS —
 * the 'version' command reads $VER).
 *
 * Worker API milestone is lib_Version = 70 ("0.070").
 */
#define LIBRARY_VERSION_STRING \
    "\0$VER: quickjs." QJS_STR(QJS_VARIANT_NAME) ".library 0.132 (20.4.2026)\r\n"
#define LIBRARY_VERSION_OUTPUT &LIBRARY_VERSION_STRING[7]
#define LIBRARY_VERSION   132  /* packed: major=0, revision=132 (struct placement refactor: struct wrappers now live at amiga.<libname>.<StructName> per NDK provenance — amiga.intuition.{Window,NewWindow,Screen,IntuiMessage,Image,Gadget}, amiga.graphics.{RastPort,TextAttr}, amiga.exec.MsgPort. Library wrappers stay at amiga.<ClassName>. Flat amiga.<StructName> aliases removed. Every struct class now exposes a static `signature` getter returning a human-readable constructor spec for REPL introspection.) */
#define LIBRARY_REVISION   0   /* redundant; kept for convention */
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

/* --- Batch 2: Value Management --- */

void QJS_FreeValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

void QJS_FreeValueRT(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") JSValue *val_ptr);

void QJS_DupValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

void QJS_DupValueRT(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSRuntime *rt,
    __reg("a2") JSValue *val_ptr);

/* --- Batch 2: Value Creation --- */

void QJS_NewNumber(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") double *d_ptr);

void QJS_NewBigInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") long long *v_ptr);

void QJS_NewBigUint64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") unsigned long long *v_ptr);

/* --- Batch 2: Strings --- */

void QJS_NewStringLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *str,
    __reg("d0") ULONG len);

void QJS_NewAtomString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *str);

void QJS_ToString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

void QJS_ToPropertyKey(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

const char *QJS_ToCStringLen2(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") ULONG *plen,
    __reg("a1") JSValue *val_ptr,
    __reg("d0") int cesu8);

void QJS_FreeCString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *ptr);

/* --- Batch 2: Conversion --- */

int QJS_ToBool(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

int QJS_ToInt32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") long *pres,
    __reg("a1") JSValue *val_ptr);

int QJS_ToInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") long long *pres,
    __reg("a1") JSValue *val_ptr);

int QJS_ToFloat64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") double *pres,
    __reg("a1") JSValue *val_ptr);

void QJS_ToNumber(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

/* --- Batch 2: Objects --- */

void QJS_NewObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

void QJS_NewObjectClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG class_id);

void QJS_NewObjectProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *proto_ptr);

void QJS_NewArray(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

int QJS_IsArray(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr);

int QJS_IsFunction(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

int QJS_IsConstructor(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

void QJS_GetGlobalObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

void QJS_ToObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

/* --- Batch 2: Exceptions --- */

void QJS_Throw(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *obj_ptr);

void QJS_GetException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

int QJS_HasException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_IsError(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr);

void QJS_NewError(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

void QJS_ThrowOutOfMemory(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

/* --- Batch 2: Detect Module --- */

int QJS_DetectModule(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") const char *input,
    __reg("d0") ULONG input_len);

/* --- Batch 2: Memory Allocation --- */

void *QJS_Malloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG size);

void QJS_Free(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *ptr);

void *QJS_Realloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *ptr,
    __reg("d0") ULONG size);

void *QJS_Calloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG count,
    __reg("d1") ULONG size);

void *QJS_Mallocz(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG size);

char *QJS_Strdup(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str);

/* --- Batch 3: Property Get --- */

void QJS_GetProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") ULONG prop);

void QJS_GetPropertyUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") ULONG idx);

void QJS_GetPropertyStr(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("a3") const char *prop_str);

void QJS_GetPropertyInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") LONG idx);

/* --- Batch 3: Property Set (engine CONSUMES val) --- */

int QJS_SetProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop,
    __reg("a2") JSValue *val_ptr);

int QJS_SetPropertyUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG idx,
    __reg("a2") JSValue *val_ptr);

int QJS_SetPropertyStr(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("a2") const char *prop_str,
    __reg("a3") JSValue *val_ptr);

/* --- Batch 3: Property Query/Delete --- */

int QJS_HasProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop);

int QJS_DeleteProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") ULONG prop,
    __reg("d1") int flags);

/* --- Batch 3: Prototype --- */

int QJS_SetPrototype(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("a2") JSValue *proto_ptr);

void QJS_GetPrototype(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

/* --- Batch 3: Length --- */

int QJS_GetLength(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("a2") long long *pres);

int QJS_SetLength(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") LONG len);

/* --- Batch 3: Extensibility/Seal/Freeze --- */

int QJS_IsExtensible(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr);

int QJS_PreventExtensions(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr);

int QJS_SealObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr);

int QJS_FreezeObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr);

/* --- Batch 3: Define Property (engine CONSUMES val) --- */

int QJS_DefinePropertyValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop,
    __reg("a2") JSValue *val_ptr,
    __reg("d1") int flags);

int QJS_DefinePropertyValueUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG idx,
    __reg("a2") JSValue *val_ptr,
    __reg("d1") int flags);

int QJS_DefinePropertyValueStr(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("a2") JSValue *val_ptr,
    __reg("a3") const char *prop_str,
    __reg("d0") int flags);

/* --- Batch 3: Opaque --- */

int QJS_SetOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a1") JSValue *obj_ptr,
    __reg("a0") void *opaque);

void *QJS_GetOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *obj_ptr,
    __reg("d0") ULONG class_id);

void *QJS_GetOpaque2(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") ULONG class_id);

/* --- Batch 3: Own Property Names --- */

int QJS_GetOwnPropertyNames(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void **ptab,
    __reg("a2") ULONG *plen,
    __reg("a3") JSValue *obj_ptr,
    __reg("d0") int flags);

void QJS_FreePropertyEnum(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *tab,
    __reg("d0") ULONG len);

/* --- Batch 3: InstanceOf --- */

int QJS_IsInstanceOf(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr,
    __reg("a2") JSValue *obj_ptr);

/* --- Batch 4: Atoms --- */

ULONG QJS_NewAtomLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str,
    __reg("d0") ULONG len);

ULONG QJS_NewAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str);

ULONG QJS_NewAtomUInt32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG n);

ULONG QJS_DupAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG v);

void QJS_FreeAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG v);

void QJS_AtomToValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG atom);

void QJS_AtomToString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG atom);

const char *QJS_AtomToCStringLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") ULONG *plen,
    __reg("d0") ULONG atom);

ULONG QJS_ValueToAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

/* --- Batch 4: Eval --- */

void QJS_EvalFunction(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *fun_ptr);

/* --- Batch 4: Call (argv via d1 as ULONG for >4 addr params) --- */

void QJS_Call(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *func_ptr,
    __reg("a3") JSValue *this_ptr,
    __reg("d0") int argc,
    __reg("d1") ULONG argv_addr);

void QJS_Invoke(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("a3") JSValue *argv,
    __reg("d0") ULONG atom,
    __reg("d1") int argc);

void QJS_CallConstructor(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *func_ptr,
    __reg("a3") JSValue *argv,
    __reg("d0") int argc);

/* --- Batch 4: JSON --- */

void QJS_ParseJSON(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *buf,
    __reg("a3") const char *filename,
    __reg("d0") ULONG buf_len);

void QJS_JSONStringify(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *obj_ptr);

/* --- Batch 4: Serialization --- */

unsigned char *QJS_WriteObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") ULONG *psize,
    __reg("a2") JSValue *obj_ptr,
    __reg("d0") int flags);

void QJS_ReadObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const unsigned char *buf,
    __reg("d0") ULONG buf_len,
    __reg("d1") int flags);

/* --- Batch 4: Class --- */

ULONG QJS_NewClassID(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") ULONG *pclass_id);

int QJS_NewClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *class_def,
    __reg("d0") ULONG class_id);

int QJS_IsRegisteredClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG class_id);

ULONG QJS_GetClassID(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr);

/* --- Batch 5: Modules --- */
void QJS_SetModuleLoaderFunc(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *normalize_func, __reg("a2") void *loader_func, __reg("a3") void *opaque);
void QJS_GetImportMeta(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") void *m);
ULONG QJS_GetModuleName(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m);
void QJS_GetModuleNamespace(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") void *m);
void *QJS_NewCModule(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *name_str, __reg("a2") void *func);
int QJS_AddModuleExport(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m, __reg("a2") const char *name_str);
int QJS_SetModuleExport(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m, __reg("a2") const char *export_name, __reg("a3") JSValue *val_ptr);
int QJS_ResolveModule(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *obj_ptr);
ULONG QJS_GetScriptOrModuleName(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("d0") int n_stack_levels);
/* --- Batch 5: C Functions --- */
void QJS_NewCFunction2(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") void *func, __reg("a3") const char *name, __reg("d0") int length, __reg("d1") int cproto, __reg("d2") int magic);
int QJS_SetConstructor(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *func_ptr, __reg("a2") JSValue *proto_ptr);
int QJS_SetPropertyFunctionList(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *obj_ptr, __reg("a2") void *tab, __reg("d0") int len);
/* --- Batch 5: Jobs --- */
int QJS_IsJobPending(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
int QJS_ExecutePendingJob(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *pctx);
/* --- Batch 5: Promise --- */
void QJS_NewPromiseCapability(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") JSValue *resolving_funcs);
int QJS_PromiseState(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *promise_ptr);
void QJS_PromiseResult(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") JSValue *promise_ptr);
int QJS_IsPromise(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
/* --- Batch 5: Callbacks --- */
void QJS_SetInterruptHandler(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *cb, __reg("a2") void *opaque);
void QJS_SetHostPromiseRejectionTracker(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *cb, __reg("a2") void *opaque);
void QJS_SetCanBlock(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("d0") int can_block);
/* --- Batch 5: ArrayBuffer --- */
void QJS_NewArrayBufferCopy(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") const unsigned char *buf, __reg("d0") ULONG len);
unsigned char *QJS_GetArrayBuffer(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") ULONG *psize, __reg("a2") JSValue *obj_ptr);
int QJS_IsArrayBuffer(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
void QJS_DetachArrayBuffer(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *obj_ptr);
unsigned char *QJS_GetUint8Array(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") ULONG *psize, __reg("a2") JSValue *obj_ptr);
void QJS_NewUint8ArrayCopy(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") const unsigned char *buf, __reg("d0") ULONG len);
/* --- Batch 5: Type checks, Symbol, Date, Misc --- */
int QJS_IsDate(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
int QJS_IsRegExp(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
int QJS_IsMap(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
int QJS_IsSet(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
void QJS_NewSymbol(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") const char *description, __reg("d0") int is_global);
void QJS_NewDate(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") double *epoch_ms_ptr);
void QJS_SetIsHTMLDDA(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *obj_ptr);
int QJS_SetConstructorBit(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *func_ptr, __reg("d0") int val);
void QJS_LoadModule(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") const char *basename, __reg("a3") const char *filename);
/* --- New functions (post-v0.54) --- */
void *QJS_GetLibcOpaque(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
void QJS_SetLibcOpaque(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *opaque);
int QJS_AddModuleExportList(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m, __reg("a2") void *tab, __reg("d0") int len);
int QJS_SetModuleExportList(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m, __reg("a2") void *tab, __reg("d0") int len);
long QJS_EvalBuf(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *input, __reg("d0") ULONG input_len, __reg("a2") const char *filename, __reg("d1") int eval_flags);
/* --- Module init / std helpers (quickjs-libc in library) --- */
void *QJS_InitModuleStd(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *module_name);
void *QJS_InitModuleOS(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *module_name);
void *QJS_InitModuleBJSON(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *module_name);
void QJS_StdInitHandlers(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
void QJS_StdFreeHandlers(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
void QJS_StdAddHelpers(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("d0") int argc, __reg("a1") char **argv);
int QJS_StdLoop(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx);
void QJS_StdEvalBinary(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const void *buf, __reg("d0") ULONG buf_len, __reg("d1") int flags);
void QJS_StdDumpError(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx);
void *QJS_LoadFile(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") ULONG *pbuf_len, __reg("a2") const char *filename);
void QJS_SetModuleLoader(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
void QJS_InstallExtended(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx);

/* Worker primitive — docs/WORKER_API.md */
struct QJSWorker;
typedef int (*QJSWorkerJobFn)(struct QJSWorker *worker, void *user_data);
struct QJSWorker *QJS_WorkerSpawn(__reg("a6") LIBRARY_BASE_TYPE *base,
                                  __reg("a0") QJSWorkerJobFn job_fn,
                                  __reg("a1") void *user_data,
                                  __reg("d0") unsigned long flags);
long QJS_WorkerPoll(__reg("a6") LIBRARY_BASE_TYPE *base,
                    __reg("a0") struct QJSWorker *worker);
long QJS_WorkerJoin(__reg("a6") LIBRARY_BASE_TYPE *base,
                    __reg("a0") struct QJSWorker *worker);
void QJS_WorkerDestroy(__reg("a6") LIBRARY_BASE_TYPE *base,
                       __reg("a0") struct QJSWorker *worker);
struct Library *QJS_WorkerGetBase(__reg("a6") LIBRARY_BASE_TYPE *base,
                                  __reg("a0") struct QJSWorker *worker,
                                  __reg("d0") unsigned long which);

/* W7 — networking capability probe + qjs:net module registration */
ULONG QJS_GetNetCapabilities(__reg("a6") LIBRARY_BASE_TYPE *base);
void *QJS_InitModuleNet(__reg("a6") LIBRARY_BASE_TYPE *base,
                        __reg("a0") struct JSContext *ctx,
                        __reg("a1") const char *module_name);

/* Expose already-opened math library bases so CLI/clients never
 * re-open them (architecture rule: all library management in the library).
 * which: 0=mathieeedoubbas, 1=mathieeedoubtrans, 2=mathieeesingbas. */
struct Library *QJS_GetMathBase(__reg("a6") LIBRARY_BASE_TYPE *base,
                                __reg("d0") unsigned long which);

/* D5 — install native spawnSync on globalThis.__qjs_spawnSync.
 * extended.js's child-process manifest wraps that in a Node API.
 * Called once from the CLI after context creation; no-op if called
 * twice (just replaces the global). */
void QJS_InstallChildProcessGlobal(__reg("a6") LIBRARY_BASE_TYPE *base,
                                   __reg("a0") struct JSContext *ctx);

/* E1 — install native hash + random on globalThis.
 * __qjs_cryptoDigest(alg, bytes) -> ArrayBuffer
 * __qjs_cryptoRandom(view)       -> fills view with pseudo-random bytes
 * extended.js wraps in WebCrypto shape (crypto.subtle.digest + getRandomValues). */
void QJS_InstallCryptoGlobal(__reg("a6") LIBRARY_BASE_TYPE *base,
                             __reg("a0") struct JSContext *ctx);

/* Q1 — install native Amiga FFI primitives on globalThis.
 * __qjs_amiga_openLibrary(name, ver)  -> lib handle
 * __qjs_amiga_closeLibrary(lib)       -> void
 * __qjs_amiga_call(lib, lvo, regs)    -> d0 via asm trampoline
 * __qjs_amiga_peek8/16/32/poke8/16/32 -> raw memory access
 * __qjs_amiga_peekString/pokeString   -> NUL-terminated ASCII
 * __qjs_amiga_allocMem/freeMem        -> exec MEMF_* allocation
 * __qjs_amiga_makeTags                -> TagItem array builder
 * extended.js wraps in globalThis.amiga with LVO constant tables. */
void QJS_InstallAmigaFFIGlobal(__reg("a6") LIBRARY_BASE_TYPE *base,
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
    (APTR) QJS_AddRuntimeFinalizer, \
    (APTR) QJS_FreeValue, \
    (APTR) QJS_FreeValueRT, \
    (APTR) QJS_DupValue, \
    (APTR) QJS_DupValueRT, \
    (APTR) QJS_NewNumber, \
    (APTR) QJS_NewBigInt64, \
    (APTR) QJS_NewBigUint64, \
    (APTR) QJS_NewStringLen, \
    (APTR) QJS_NewAtomString, \
    (APTR) QJS_ToString, \
    (APTR) QJS_ToPropertyKey, \
    (APTR) QJS_ToCStringLen2, \
    (APTR) QJS_FreeCString, \
    (APTR) QJS_ToBool, \
    (APTR) QJS_ToInt32, \
    (APTR) QJS_ToInt64, \
    (APTR) QJS_ToFloat64, \
    (APTR) QJS_ToNumber, \
    (APTR) QJS_NewObject, \
    (APTR) QJS_NewObjectClass, \
    (APTR) QJS_NewObjectProto, \
    (APTR) QJS_NewArray, \
    (APTR) QJS_IsArray, \
    (APTR) QJS_IsFunction, \
    (APTR) QJS_IsConstructor, \
    (APTR) QJS_GetGlobalObject, \
    (APTR) QJS_ToObject, \
    (APTR) QJS_Throw, \
    (APTR) QJS_GetException, \
    (APTR) QJS_HasException, \
    (APTR) QJS_IsError, \
    (APTR) QJS_NewError, \
    (APTR) QJS_ThrowOutOfMemory, \
    (APTR) QJS_DetectModule, \
    (APTR) QJS_Malloc, \
    (APTR) QJS_Free, \
    (APTR) QJS_Realloc, \
    (APTR) QJS_Calloc, \
    (APTR) QJS_Mallocz, \
    (APTR) QJS_Strdup, \
    (APTR) QJS_GetProperty, \
    (APTR) QJS_GetPropertyUint32, \
    (APTR) QJS_GetPropertyStr, \
    (APTR) QJS_GetPropertyInt64, \
    (APTR) QJS_SetProperty, \
    (APTR) QJS_SetPropertyUint32, \
    (APTR) QJS_SetPropertyStr, \
    (APTR) QJS_HasProperty, \
    (APTR) QJS_DeleteProperty, \
    (APTR) QJS_SetPrototype, \
    (APTR) QJS_GetPrototype, \
    (APTR) QJS_GetLength, \
    (APTR) QJS_SetLength, \
    (APTR) QJS_IsExtensible, \
    (APTR) QJS_PreventExtensions, \
    (APTR) QJS_SealObject, \
    (APTR) QJS_FreezeObject, \
    (APTR) QJS_DefinePropertyValue, \
    (APTR) QJS_DefinePropertyValueUint32, \
    (APTR) QJS_DefinePropertyValueStr, \
    (APTR) QJS_SetOpaque, \
    (APTR) QJS_GetOpaque, \
    (APTR) QJS_GetOpaque2, \
    (APTR) QJS_GetOwnPropertyNames, \
    (APTR) QJS_FreePropertyEnum, \
    (APTR) QJS_IsInstanceOf, \
    (APTR) QJS_NewAtomLen, \
    (APTR) QJS_NewAtom, \
    (APTR) QJS_NewAtomUInt32, \
    (APTR) QJS_DupAtom, \
    (APTR) QJS_FreeAtom, \
    (APTR) QJS_AtomToValue, \
    (APTR) QJS_AtomToString, \
    (APTR) QJS_AtomToCStringLen, \
    (APTR) QJS_ValueToAtom, \
    (APTR) QJS_EvalFunction, \
    (APTR) QJS_Call, \
    (APTR) QJS_Invoke, \
    (APTR) QJS_CallConstructor, \
    (APTR) QJS_ParseJSON, \
    (APTR) QJS_JSONStringify, \
    (APTR) QJS_WriteObject, \
    (APTR) QJS_ReadObject, \
    (APTR) QJS_NewClassID, \
    (APTR) QJS_NewClass, \
    (APTR) QJS_IsRegisteredClass, \
    (APTR) QJS_GetClassID, \
    (APTR) QJS_SetModuleLoaderFunc, \
    (APTR) QJS_GetImportMeta, \
    (APTR) QJS_GetModuleName, \
    (APTR) QJS_GetModuleNamespace, \
    (APTR) QJS_NewCModule, \
    (APTR) QJS_AddModuleExport, \
    (APTR) QJS_SetModuleExport, \
    (APTR) QJS_ResolveModule, \
    (APTR) QJS_GetScriptOrModuleName, \
    (APTR) QJS_NewCFunction2, \
    (APTR) QJS_SetConstructor, \
    (APTR) QJS_SetPropertyFunctionList, \
    (APTR) QJS_IsJobPending, \
    (APTR) QJS_ExecutePendingJob, \
    (APTR) QJS_NewPromiseCapability, \
    (APTR) QJS_PromiseState, \
    (APTR) QJS_PromiseResult, \
    (APTR) QJS_IsPromise, \
    (APTR) QJS_SetInterruptHandler, \
    (APTR) QJS_SetHostPromiseRejectionTracker, \
    (APTR) QJS_SetCanBlock, \
    (APTR) QJS_NewArrayBufferCopy, \
    (APTR) QJS_GetArrayBuffer, \
    (APTR) QJS_IsArrayBuffer, \
    (APTR) QJS_DetachArrayBuffer, \
    (APTR) QJS_GetUint8Array, \
    (APTR) QJS_NewUint8ArrayCopy, \
    (APTR) QJS_IsDate, \
    (APTR) QJS_IsRegExp, \
    (APTR) QJS_IsMap, \
    (APTR) QJS_IsSet, \
    (APTR) QJS_NewSymbol, \
    (APTR) QJS_NewDate, \
    (APTR) QJS_SetIsHTMLDDA, \
    (APTR) QJS_SetConstructorBit, \
    (APTR) QJS_LoadModule, \
    (APTR) QJS_GetLibcOpaque, \
    (APTR) QJS_SetLibcOpaque, \
    (APTR) QJS_AddModuleExportList, \
    (APTR) QJS_SetModuleExportList, \
    (APTR) QJS_EvalBuf, \
    (APTR) QJS_InitModuleStd, \
    (APTR) QJS_InitModuleOS, \
    (APTR) QJS_InitModuleBJSON, \
    (APTR) QJS_StdInitHandlers, \
    (APTR) QJS_StdFreeHandlers, \
    (APTR) QJS_StdAddHelpers, \
    (APTR) QJS_StdLoop, \
    (APTR) QJS_StdEvalBinary, \
    (APTR) QJS_StdDumpError, \
    (APTR) QJS_LoadFile, \
    (APTR) QJS_SetModuleLoader, \
    (APTR) QJS_InstallExtended, \
    (APTR) QJS_WorkerSpawn, \
    (APTR) QJS_WorkerPoll, \
    (APTR) QJS_WorkerJoin, \
    (APTR) QJS_WorkerDestroy, \
    (APTR) QJS_WorkerGetBase, \
    (APTR) QJS_GetNetCapabilities, \
    (APTR) QJS_InitModuleNet, \
    (APTR) QJS_GetMathBase, \
    (APTR) QJS_InstallChildProcessGlobal, \
    (APTR) QJS_InstallCryptoGlobal, \
    (APTR) QJS_InstallAmigaFFIGlobal

#endif /* LIBRARYCONFIG_H */
