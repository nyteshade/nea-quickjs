/*
 * inline/quickjs_lib.h -- VBCC inline stubs for quickjs.library
 *
 * Auto-generated from libraryconfig.h -- 170 functions
 * LVO offsets: bias 30, increment 6
 *
 * Usage:
 *   #include <proto/exec.h>
 *   #include <inline/quickjs_lib.h>
 *   struct Library *QJSBase;
 *   QJSBase = OpenLibrary("quickjs.library", 0);
 */

#ifndef INLINE_QUICKJS_LIB_H
#define INLINE_QUICKJS_LIB_H

#include <exec/types.h>
#include <exec/libraries.h>

/* Forward declarations for QuickJS types */
struct JSRuntime;
struct JSContext;
typedef union { long int32; double float64; void *ptr; long sbi; } JSValueUnion;
typedef struct { JSValueUnion u; long tag; } JSValue;

extern struct Library *QJSBase;

/* QJS_NewRuntime -- LVO -30 */
static inline struct JSRuntime * QJS_NewRuntime(void)
{
    typedef struct JSRuntime * (*_ftype)(__reg("a6") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 30);
    return _f((void *)QJSBase);
}

/* QJS_FreeRuntime -- LVO -36 */
static inline void QJS_FreeRuntime(struct JSRuntime * rt)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *);
    _ftype _f = (_ftype)((char *)QJSBase - 36);
    _f((void *)QJSBase, rt);
}

/* QJS_NewContext -- LVO -42 */
static inline struct JSContext * QJS_NewContext(struct JSRuntime * rt)
{
    typedef struct JSContext * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *);
    _ftype _f = (_ftype)((char *)QJSBase - 42);
    return _f((void *)QJSBase, rt);
}

/* QJS_NewContextRaw -- LVO -48 */
static inline struct JSContext * QJS_NewContextRaw(struct JSRuntime * rt)
{
    typedef struct JSContext * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *);
    _ftype _f = (_ftype)((char *)QJSBase - 48);
    return _f((void *)QJSBase, rt);
}

/* QJS_FreeContext -- LVO -54 */
static inline void QJS_FreeContext(struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 54);
    _f((void *)QJSBase, ctx);
}

/* QJS_GetVersion -- LVO -60 */
static inline const char * QJS_GetVersion(void)
{
    typedef const char * (*_ftype)(__reg("a6") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 60);
    return _f((void *)QJSBase);
}

/* QJS_SetMemoryLimit -- LVO -66 */
static inline void QJS_SetMemoryLimit(struct JSRuntime * rt, ULONG limit)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 66);
    _f((void *)QJSBase, rt, limit);
}

/* QJS_SetMaxStackSize -- LVO -72 */
static inline void QJS_SetMaxStackSize(struct JSRuntime * rt, ULONG stack_size)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 72);
    _f((void *)QJSBase, rt, stack_size);
}

/* QJS_RunGC -- LVO -78 */
static inline void QJS_RunGC(struct JSRuntime * rt)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *);
    _ftype _f = (_ftype)((char *)QJSBase - 78);
    _f((void *)QJSBase, rt);
}

/* QJS_AddBaseObjects -- LVO -84 */
static inline int QJS_AddBaseObjects(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 84);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddEval -- LVO -90 */
static inline int QJS_AddEval(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 90);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddDate -- LVO -96 */
static inline int QJS_AddDate(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 96);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddRegExp -- LVO -102 */
static inline int QJS_AddRegExp(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 102);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddJSON -- LVO -108 */
static inline int QJS_AddJSON(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 108);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddProxy -- LVO -114 */
static inline int QJS_AddProxy(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 114);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddMapSet -- LVO -120 */
static inline int QJS_AddMapSet(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 120);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddTypedArrays -- LVO -126 */
static inline int QJS_AddTypedArrays(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 126);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddPromise -- LVO -132 */
static inline int QJS_AddPromise(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 132);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddWeakRef -- LVO -138 */
static inline int QJS_AddWeakRef(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 138);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddDOMException -- LVO -144 */
static inline int QJS_AddDOMException(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 144);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddPerformance -- LVO -150 */
static inline int QJS_AddPerformance(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 150);
    return _f((void *)QJSBase, ctx);
}

/* QJS_EvalSimple -- LVO -156 */
static inline long QJS_EvalSimple(struct JSContext * ctx, const char * input, ULONG input_len)
{
    typedef long (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") const char *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 156);
    return _f((void *)QJSBase, ctx, input, input_len);
}

/* QJS_Eval -- LVO -162 */
static inline void QJS_Eval(JSValue * result, struct JSContext * ctx, const char * input, ULONG input_len, const char * filename, int eval_flags)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const char *, __reg("d0") ULONG, __reg("a3") const char *, __reg("d1") int);
    _ftype _f = (_ftype)((char *)QJSBase - 162);
    _f((void *)QJSBase, result, ctx, input, input_len, filename, eval_flags);
}

/* QJS_SetRuntimeInfo -- LVO -168 */
static inline void QJS_SetRuntimeInfo(struct JSRuntime * rt, const char * info)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") const char *);
    _ftype _f = (_ftype)((char *)QJSBase - 168);
    _f((void *)QJSBase, rt, info);
}

/* QJS_GetRuntimeOpaque -- LVO -174 */
static inline void * QJS_GetRuntimeOpaque(struct JSRuntime * rt)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *);
    _ftype _f = (_ftype)((char *)QJSBase - 174);
    return _f((void *)QJSBase, rt);
}

/* QJS_SetRuntimeOpaque -- LVO -180 */
static inline void QJS_SetRuntimeOpaque(struct JSRuntime * rt, void * opaque)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 180);
    _f((void *)QJSBase, rt, opaque);
}

/* QJS_UpdateStackTop -- LVO -186 */
static inline void QJS_UpdateStackTop(struct JSRuntime * rt)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *);
    _ftype _f = (_ftype)((char *)QJSBase - 186);
    _f((void *)QJSBase, rt);
}

/* QJS_SetDumpFlags -- LVO -192 */
static inline void QJS_SetDumpFlags(struct JSRuntime * rt, unsigned long long * flags_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") unsigned long long *);
    _ftype _f = (_ftype)((char *)QJSBase - 192);
    _f((void *)QJSBase, rt, flags_ptr);
}

/* QJS_GetDumpFlags -- LVO -198 */
static inline void QJS_GetDumpFlags(struct JSRuntime * rt, unsigned long long * result_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") unsigned long long *);
    _ftype _f = (_ftype)((char *)QJSBase - 198);
    _f((void *)QJSBase, rt, result_ptr);
}

/* QJS_GetGCThreshold -- LVO -204 */
static inline ULONG QJS_GetGCThreshold(struct JSRuntime * rt)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *);
    _ftype _f = (_ftype)((char *)QJSBase - 204);
    return _f((void *)QJSBase, rt);
}

/* QJS_SetGCThreshold -- LVO -210 */
static inline void QJS_SetGCThreshold(struct JSRuntime * rt, ULONG threshold)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 210);
    _f((void *)QJSBase, rt, threshold);
}

/* QJS_IsLiveObject -- LVO -216 */
static inline int QJS_IsLiveObject(struct JSRuntime * rt, JSValue * obj_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 216);
    return _f((void *)QJSBase, rt, obj_ptr);
}

/* QJS_DupContext -- LVO -222 */
static inline struct JSContext * QJS_DupContext(struct JSContext * ctx)
{
    typedef struct JSContext * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 222);
    return _f((void *)QJSBase, ctx);
}

/* QJS_GetContextOpaque -- LVO -228 */
static inline void * QJS_GetContextOpaque(struct JSContext * ctx)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 228);
    return _f((void *)QJSBase, ctx);
}

/* QJS_SetContextOpaque -- LVO -234 */
static inline void QJS_SetContextOpaque(struct JSContext * ctx, void * opaque)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 234);
    _f((void *)QJSBase, ctx, opaque);
}

/* QJS_GetRuntime -- LVO -240 */
static inline struct JSRuntime * QJS_GetRuntime(struct JSContext * ctx)
{
    typedef struct JSRuntime * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 240);
    return _f((void *)QJSBase, ctx);
}

/* QJS_SetClassProto -- LVO -246 */
static inline void QJS_SetClassProto(struct JSContext * ctx, ULONG class_id, JSValue * obj_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("d0") ULONG, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 246);
    _f((void *)QJSBase, ctx, class_id, obj_ptr);
}

/* QJS_GetClassProto -- LVO -252 */
static inline void QJS_GetClassProto(JSValue * result, struct JSContext * ctx, ULONG class_id)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 252);
    _f((void *)QJSBase, result, ctx, class_id);
}

/* QJS_GetFunctionProto -- LVO -258 */
static inline void QJS_GetFunctionProto(JSValue * result, struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 258);
    _f((void *)QJSBase, result, ctx);
}

/* QJS_AddBigInt -- LVO -264 */
static inline int QJS_AddBigInt(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 264);
    return _f((void *)QJSBase, ctx);
}

/* QJS_AddRegExpCompiler -- LVO -270 */
static inline void QJS_AddRegExpCompiler(struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 270);
    _f((void *)QJSBase, ctx);
}

/* QJS_IsEqual -- LVO -276 */
static inline int QJS_IsEqual(struct JSContext * ctx, JSValue * op1_ptr, JSValue * op2_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 276);
    return _f((void *)QJSBase, ctx, op1_ptr, op2_ptr);
}

/* QJS_IsStrictEqual -- LVO -282 */
static inline int QJS_IsStrictEqual(struct JSContext * ctx, JSValue * op1_ptr, JSValue * op2_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 282);
    return _f((void *)QJSBase, ctx, op1_ptr, op2_ptr);
}

/* QJS_IsSameValue -- LVO -288 */
static inline int QJS_IsSameValue(struct JSContext * ctx, JSValue * op1_ptr, JSValue * op2_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 288);
    return _f((void *)QJSBase, ctx, op1_ptr, op2_ptr);
}

/* QJS_IsSameValueZero -- LVO -294 */
static inline int QJS_IsSameValueZero(struct JSContext * ctx, JSValue * op1_ptr, JSValue * op2_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 294);
    return _f((void *)QJSBase, ctx, op1_ptr, op2_ptr);
}

/* QJS_ComputeMemoryUsage -- LVO -300 */
static inline void QJS_ComputeMemoryUsage(struct JSRuntime * rt, void * s)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 300);
    _f((void *)QJSBase, rt, s);
}

/* QJS_AddRuntimeFinalizer -- LVO -306 */
static inline int QJS_AddRuntimeFinalizer(struct JSRuntime * rt, void * finalizer, void * arg)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") void *, __reg("a2") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 306);
    return _f((void *)QJSBase, rt, finalizer, arg);
}

/* QJS_FreeValue -- LVO -312 */
static inline void QJS_FreeValue(struct JSContext * ctx, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 312);
    _f((void *)QJSBase, ctx, val_ptr);
}

/* QJS_FreeValueRT -- LVO -318 */
static inline void QJS_FreeValueRT(struct JSRuntime * rt, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 318);
    _f((void *)QJSBase, rt, val_ptr);
}

/* QJS_DupValue -- LVO -324 */
static inline void QJS_DupValue(JSValue * result, struct JSContext * ctx, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 324);
    _f((void *)QJSBase, result, ctx, val_ptr);
}

/* QJS_DupValueRT -- LVO -330 */
static inline void QJS_DupValueRT(JSValue * result, struct JSRuntime * rt, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSRuntime *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 330);
    _f((void *)QJSBase, result, rt, val_ptr);
}

/* QJS_NewNumber -- LVO -336 */
static inline void QJS_NewNumber(JSValue * result, struct JSContext * ctx, double * d_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") double *);
    _ftype _f = (_ftype)((char *)QJSBase - 336);
    _f((void *)QJSBase, result, ctx, d_ptr);
}

/* QJS_NewBigInt64 -- LVO -342 */
static inline void QJS_NewBigInt64(JSValue * result, struct JSContext * ctx, long long * v_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") long long *);
    _ftype _f = (_ftype)((char *)QJSBase - 342);
    _f((void *)QJSBase, result, ctx, v_ptr);
}

/* QJS_NewBigUint64 -- LVO -348 */
static inline void QJS_NewBigUint64(JSValue * result, struct JSContext * ctx, unsigned long long * v_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") unsigned long long *);
    _ftype _f = (_ftype)((char *)QJSBase - 348);
    _f((void *)QJSBase, result, ctx, v_ptr);
}

/* QJS_NewStringLen -- LVO -354 */
static inline void QJS_NewStringLen(JSValue * result, struct JSContext * ctx, const char * str, ULONG len)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const char *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 354);
    _f((void *)QJSBase, result, ctx, str, len);
}

/* QJS_NewAtomString -- LVO -360 */
static inline void QJS_NewAtomString(JSValue * result, struct JSContext * ctx, const char * str)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const char *);
    _ftype _f = (_ftype)((char *)QJSBase - 360);
    _f((void *)QJSBase, result, ctx, str);
}

/* QJS_ToString -- LVO -366 */
static inline void QJS_ToString(JSValue * result, struct JSContext * ctx, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 366);
    _f((void *)QJSBase, result, ctx, val_ptr);
}

/* QJS_ToPropertyKey -- LVO -372 */
static inline void QJS_ToPropertyKey(JSValue * result, struct JSContext * ctx, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 372);
    _f((void *)QJSBase, result, ctx, val_ptr);
}

/* QJS_ToCStringLen2 -- LVO -378 */
static inline const char * QJS_ToCStringLen2(struct JSContext * ctx, ULONG * plen, JSValue * val_ptr, int cesu8)
{
    typedef const char * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a2") ULONG *, __reg("a1") JSValue *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 378);
    return _f((void *)QJSBase, ctx, plen, val_ptr, cesu8);
}

/* QJS_FreeCString -- LVO -384 */
static inline void QJS_FreeCString(struct JSContext * ctx, const char * ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") const char *);
    _ftype _f = (_ftype)((char *)QJSBase - 384);
    _f((void *)QJSBase, ctx, ptr);
}

/* QJS_ToBool -- LVO -390 */
static inline int QJS_ToBool(struct JSContext * ctx, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 390);
    return _f((void *)QJSBase, ctx, val_ptr);
}

/* QJS_ToInt32 -- LVO -396 */
static inline int QJS_ToInt32(struct JSContext * ctx, long * pres, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a2") long *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 396);
    return _f((void *)QJSBase, ctx, pres, val_ptr);
}

/* QJS_ToInt64 -- LVO -402 */
static inline int QJS_ToInt64(struct JSContext * ctx, long long * pres, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a2") long long *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 402);
    return _f((void *)QJSBase, ctx, pres, val_ptr);
}

/* QJS_ToFloat64 -- LVO -408 */
static inline int QJS_ToFloat64(struct JSContext * ctx, double * pres, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a2") double *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 408);
    return _f((void *)QJSBase, ctx, pres, val_ptr);
}

/* QJS_ToNumber -- LVO -414 */
static inline void QJS_ToNumber(JSValue * result, struct JSContext * ctx, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 414);
    _f((void *)QJSBase, result, ctx, val_ptr);
}

/* QJS_NewObject -- LVO -420 */
static inline void QJS_NewObject(JSValue * result, struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 420);
    _f((void *)QJSBase, result, ctx);
}

/* QJS_NewObjectClass -- LVO -426 */
static inline void QJS_NewObjectClass(JSValue * result, struct JSContext * ctx, ULONG class_id)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 426);
    _f((void *)QJSBase, result, ctx, class_id);
}

/* QJS_NewObjectProto -- LVO -432 */
static inline void QJS_NewObjectProto(JSValue * result, struct JSContext * ctx, JSValue * proto_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 432);
    _f((void *)QJSBase, result, ctx, proto_ptr);
}

/* QJS_NewArray -- LVO -438 */
static inline void QJS_NewArray(JSValue * result, struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 438);
    _f((void *)QJSBase, result, ctx);
}

/* QJS_IsArray -- LVO -444 */
static inline int QJS_IsArray(JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 444);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_IsFunction -- LVO -450 */
static inline int QJS_IsFunction(struct JSContext * ctx, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 450);
    return _f((void *)QJSBase, ctx, val_ptr);
}

/* QJS_IsConstructor -- LVO -456 */
static inline int QJS_IsConstructor(struct JSContext * ctx, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 456);
    return _f((void *)QJSBase, ctx, val_ptr);
}

/* QJS_GetGlobalObject -- LVO -462 */
static inline void QJS_GetGlobalObject(JSValue * result, struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 462);
    _f((void *)QJSBase, result, ctx);
}

/* QJS_ToObject -- LVO -468 */
static inline void QJS_ToObject(JSValue * result, struct JSContext * ctx, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 468);
    _f((void *)QJSBase, result, ctx, val_ptr);
}

/* QJS_Throw -- LVO -474 */
static inline void QJS_Throw(JSValue * result, struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 474);
    _f((void *)QJSBase, result, ctx, obj_ptr);
}

/* QJS_GetException -- LVO -480 */
static inline void QJS_GetException(JSValue * result, struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 480);
    _f((void *)QJSBase, result, ctx);
}

/* QJS_HasException -- LVO -486 */
static inline int QJS_HasException(struct JSContext * ctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 486);
    return _f((void *)QJSBase, ctx);
}

/* QJS_IsError -- LVO -492 */
static inline int QJS_IsError(JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 492);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_NewError -- LVO -498 */
static inline void QJS_NewError(JSValue * result, struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 498);
    _f((void *)QJSBase, result, ctx);
}

/* QJS_ThrowOutOfMemory -- LVO -504 */
static inline void QJS_ThrowOutOfMemory(JSValue * result, struct JSContext * ctx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *);
    _ftype _f = (_ftype)((char *)QJSBase - 504);
    _f((void *)QJSBase, result, ctx);
}

/* QJS_DetectModule -- LVO -510 */
static inline int QJS_DetectModule(const char * input, ULONG input_len)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") const char *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 510);
    return _f((void *)QJSBase, input, input_len);
}

/* QJS_Malloc -- LVO -516 */
static inline void * QJS_Malloc(struct JSContext * ctx, ULONG size)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 516);
    return _f((void *)QJSBase, ctx, size);
}

/* QJS_Free -- LVO -522 */
static inline void QJS_Free(struct JSContext * ctx, void * ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 522);
    _f((void *)QJSBase, ctx, ptr);
}

/* QJS_Realloc -- LVO -528 */
static inline void * QJS_Realloc(struct JSContext * ctx, void * ptr, ULONG size)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") void *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 528);
    return _f((void *)QJSBase, ctx, ptr, size);
}

/* QJS_Calloc -- LVO -534 */
static inline void * QJS_Calloc(struct JSContext * ctx, ULONG count, ULONG size)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("d0") ULONG, __reg("d1") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 534);
    return _f((void *)QJSBase, ctx, count, size);
}

/* QJS_Mallocz -- LVO -540 */
static inline void * QJS_Mallocz(struct JSContext * ctx, ULONG size)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 540);
    return _f((void *)QJSBase, ctx, size);
}

/* QJS_Strdup -- LVO -546 */
static inline char * QJS_Strdup(struct JSContext * ctx, const char * str)
{
    typedef char * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") const char *);
    _ftype _f = (_ftype)((char *)QJSBase - 546);
    return _f((void *)QJSBase, ctx, str);
}

/* QJS_GetProperty -- LVO -552 */
static inline void QJS_GetProperty(JSValue * result, struct JSContext * ctx, JSValue * this_ptr, ULONG prop)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 552);
    _f((void *)QJSBase, result, ctx, this_ptr, prop);
}

/* QJS_GetPropertyUint32 -- LVO -558 */
static inline void QJS_GetPropertyUint32(JSValue * result, struct JSContext * ctx, JSValue * this_ptr, ULONG idx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 558);
    _f((void *)QJSBase, result, ctx, this_ptr, idx);
}

/* QJS_GetPropertyStr -- LVO -564 */
static inline void QJS_GetPropertyStr(JSValue * result, struct JSContext * ctx, JSValue * this_ptr, const char * prop_str)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *, __reg("a3") const char *);
    _ftype _f = (_ftype)((char *)QJSBase - 564);
    _f((void *)QJSBase, result, ctx, this_ptr, prop_str);
}

/* QJS_GetPropertyInt64 -- LVO -570 */
static inline void QJS_GetPropertyInt64(JSValue * result, struct JSContext * ctx, JSValue * this_ptr, LONG idx)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *, __reg("d0") LONG);
    _ftype _f = (_ftype)((char *)QJSBase - 570);
    _f((void *)QJSBase, result, ctx, this_ptr, idx);
}

/* QJS_SetProperty -- LVO -576 */
static inline int QJS_SetProperty(struct JSContext * ctx, JSValue * this_ptr, ULONG prop, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") ULONG, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 576);
    return _f((void *)QJSBase, ctx, this_ptr, prop, val_ptr);
}

/* QJS_SetPropertyUint32 -- LVO -582 */
static inline int QJS_SetPropertyUint32(struct JSContext * ctx, JSValue * this_ptr, ULONG idx, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") ULONG, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 582);
    return _f((void *)QJSBase, ctx, this_ptr, idx, val_ptr);
}

/* QJS_SetPropertyStr -- LVO -588 */
static inline int QJS_SetPropertyStr(struct JSContext * ctx, JSValue * this_ptr, const char * prop_str, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") const char *, __reg("a3") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 588);
    return _f((void *)QJSBase, ctx, this_ptr, prop_str, val_ptr);
}

/* QJS_HasProperty -- LVO -594 */
static inline int QJS_HasProperty(struct JSContext * ctx, JSValue * this_ptr, ULONG prop)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 594);
    return _f((void *)QJSBase, ctx, this_ptr, prop);
}

/* QJS_DeleteProperty -- LVO -600 */
static inline int QJS_DeleteProperty(struct JSContext * ctx, JSValue * obj_ptr, ULONG prop, int flags)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") ULONG, __reg("d1") int);
    _ftype _f = (_ftype)((char *)QJSBase - 600);
    return _f((void *)QJSBase, ctx, obj_ptr, prop, flags);
}

/* QJS_SetPrototype -- LVO -606 */
static inline int QJS_SetPrototype(struct JSContext * ctx, JSValue * obj_ptr, JSValue * proto_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 606);
    return _f((void *)QJSBase, ctx, obj_ptr, proto_ptr);
}

/* QJS_GetPrototype -- LVO -612 */
static inline void QJS_GetPrototype(JSValue * result, struct JSContext * ctx, JSValue * val_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 612);
    _f((void *)QJSBase, result, ctx, val_ptr);
}

/* QJS_GetLength -- LVO -618 */
static inline int QJS_GetLength(struct JSContext * ctx, JSValue * obj_ptr, long long * pres)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") long long *);
    _ftype _f = (_ftype)((char *)QJSBase - 618);
    return _f((void *)QJSBase, ctx, obj_ptr, pres);
}

/* QJS_SetLength -- LVO -624 */
static inline int QJS_SetLength(struct JSContext * ctx, JSValue * obj_ptr, LONG len)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") LONG);
    _ftype _f = (_ftype)((char *)QJSBase - 624);
    return _f((void *)QJSBase, ctx, obj_ptr, len);
}

/* QJS_IsExtensible -- LVO -630 */
static inline int QJS_IsExtensible(struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 630);
    return _f((void *)QJSBase, ctx, obj_ptr);
}

/* QJS_PreventExtensions -- LVO -636 */
static inline int QJS_PreventExtensions(struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 636);
    return _f((void *)QJSBase, ctx, obj_ptr);
}

/* QJS_SealObject -- LVO -642 */
static inline int QJS_SealObject(struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 642);
    return _f((void *)QJSBase, ctx, obj_ptr);
}

/* QJS_FreezeObject -- LVO -648 */
static inline int QJS_FreezeObject(struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 648);
    return _f((void *)QJSBase, ctx, obj_ptr);
}

/* QJS_DefinePropertyValue -- LVO -654 */
static inline int QJS_DefinePropertyValue(struct JSContext * ctx, JSValue * this_ptr, ULONG prop, JSValue * val_ptr, int flags)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") ULONG, __reg("a2") JSValue *, __reg("d1") int);
    _ftype _f = (_ftype)((char *)QJSBase - 654);
    return _f((void *)QJSBase, ctx, this_ptr, prop, val_ptr, flags);
}

/* QJS_DefinePropertyValueUint32 -- LVO -660 */
static inline int QJS_DefinePropertyValueUint32(struct JSContext * ctx, JSValue * this_ptr, ULONG idx, JSValue * val_ptr, int flags)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") ULONG, __reg("a2") JSValue *, __reg("d1") int);
    _ftype _f = (_ftype)((char *)QJSBase - 660);
    return _f((void *)QJSBase, ctx, this_ptr, idx, val_ptr, flags);
}

/* QJS_DefinePropertyValueStr -- LVO -666 */
static inline int QJS_DefinePropertyValueStr(struct JSContext * ctx, JSValue * this_ptr, JSValue * val_ptr, const char * prop_str, int flags)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") JSValue *, __reg("a3") const char *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 666);
    return _f((void *)QJSBase, ctx, this_ptr, val_ptr, prop_str, flags);
}

/* QJS_SetOpaque -- LVO -672 */
static inline int QJS_SetOpaque(JSValue * obj_ptr, void * opaque)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a1") JSValue *, __reg("a0") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 672);
    return _f((void *)QJSBase, obj_ptr, opaque);
}

/* QJS_GetOpaque -- LVO -678 */
static inline void * QJS_GetOpaque(JSValue * obj_ptr, ULONG class_id)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 678);
    return _f((void *)QJSBase, obj_ptr, class_id);
}

/* QJS_GetOpaque2 -- LVO -684 */
static inline void * QJS_GetOpaque2(struct JSContext * ctx, JSValue * obj_ptr, ULONG class_id)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 684);
    return _f((void *)QJSBase, ctx, obj_ptr, class_id);
}

/* QJS_GetOwnPropertyNames -- LVO -690 */
static inline int QJS_GetOwnPropertyNames(struct JSContext * ctx, void ** ptab, ULONG * plen, JSValue * obj_ptr, int flags)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") void **, __reg("a2") ULONG *, __reg("a3") JSValue *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 690);
    return _f((void *)QJSBase, ctx, ptab, plen, obj_ptr, flags);
}

/* QJS_FreePropertyEnum -- LVO -696 */
static inline void QJS_FreePropertyEnum(struct JSContext * ctx, void * tab, ULONG len)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") void *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 696);
    _f((void *)QJSBase, ctx, tab, len);
}

/* QJS_IsInstanceOf -- LVO -702 */
static inline int QJS_IsInstanceOf(struct JSContext * ctx, JSValue * val_ptr, JSValue * obj_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 702);
    return _f((void *)QJSBase, ctx, val_ptr, obj_ptr);
}

/* QJS_NewAtomLen -- LVO -708 */
static inline ULONG QJS_NewAtomLen(struct JSContext * ctx, const char * str, ULONG len)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") const char *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 708);
    return _f((void *)QJSBase, ctx, str, len);
}

/* QJS_NewAtom -- LVO -714 */
static inline ULONG QJS_NewAtom(struct JSContext * ctx, const char * str)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") const char *);
    _ftype _f = (_ftype)((char *)QJSBase - 714);
    return _f((void *)QJSBase, ctx, str);
}

/* QJS_NewAtomUInt32 -- LVO -720 */
static inline ULONG QJS_NewAtomUInt32(struct JSContext * ctx, ULONG n)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 720);
    return _f((void *)QJSBase, ctx, n);
}

/* QJS_DupAtom -- LVO -726 */
static inline ULONG QJS_DupAtom(struct JSContext * ctx, ULONG v)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 726);
    return _f((void *)QJSBase, ctx, v);
}

/* QJS_FreeAtom -- LVO -732 */
static inline void QJS_FreeAtom(struct JSContext * ctx, ULONG v)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 732);
    _f((void *)QJSBase, ctx, v);
}

/* QJS_AtomToValue -- LVO -738 */
static inline void QJS_AtomToValue(JSValue * result, struct JSContext * ctx, ULONG atom)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 738);
    _f((void *)QJSBase, result, ctx, atom);
}

/* QJS_AtomToString -- LVO -744 */
static inline void QJS_AtomToString(JSValue * result, struct JSContext * ctx, ULONG atom)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 744);
    _f((void *)QJSBase, result, ctx, atom);
}

/* QJS_AtomToCStringLen -- LVO -750 */
static inline const char * QJS_AtomToCStringLen(struct JSContext * ctx, ULONG * plen, ULONG atom)
{
    typedef const char * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") ULONG *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 750);
    return _f((void *)QJSBase, ctx, plen, atom);
}

/* QJS_ValueToAtom -- LVO -756 */
static inline ULONG QJS_ValueToAtom(struct JSContext * ctx, JSValue * val_ptr)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 756);
    return _f((void *)QJSBase, ctx, val_ptr);
}

/* QJS_EvalFunction -- LVO -762 */
static inline void QJS_EvalFunction(JSValue * result, struct JSContext * ctx, JSValue * fun_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 762);
    _f((void *)QJSBase, result, ctx, fun_ptr);
}

/* QJS_Call -- LVO -768 */
static inline void QJS_Call(JSValue * result, struct JSContext * ctx, JSValue * func_ptr, JSValue * this_ptr, int argc, ULONG argv_addr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *, __reg("a3") JSValue *, __reg("d0") int, __reg("d1") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 768);
    _f((void *)QJSBase, result, ctx, func_ptr, this_ptr, argc, argv_addr);
}

/* QJS_Invoke -- LVO -774 */
static inline void QJS_Invoke(JSValue * result, struct JSContext * ctx, JSValue * this_ptr, JSValue * argv, ULONG atom, int argc)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *, __reg("a3") JSValue *, __reg("d0") ULONG, __reg("d1") int);
    _ftype _f = (_ftype)((char *)QJSBase - 774);
    _f((void *)QJSBase, result, ctx, this_ptr, argv, atom, argc);
}

/* QJS_CallConstructor -- LVO -780 */
static inline void QJS_CallConstructor(JSValue * result, struct JSContext * ctx, JSValue * func_ptr, JSValue * argv, int argc)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *, __reg("a3") JSValue *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 780);
    _f((void *)QJSBase, result, ctx, func_ptr, argv, argc);
}

/* QJS_ParseJSON -- LVO -786 */
static inline void QJS_ParseJSON(JSValue * result, struct JSContext * ctx, const char * buf, const char * filename, ULONG buf_len)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const char *, __reg("a3") const char *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 786);
    _f((void *)QJSBase, result, ctx, buf, filename, buf_len);
}

/* QJS_JSONStringify -- LVO -792 */
static inline void QJS_JSONStringify(JSValue * result, struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 792);
    _f((void *)QJSBase, result, ctx, obj_ptr);
}

/* QJS_WriteObject -- LVO -798 */
static inline unsigned char * QJS_WriteObject(struct JSContext * ctx, ULONG * psize, JSValue * obj_ptr, int flags)
{
    typedef unsigned char * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") ULONG *, __reg("a2") JSValue *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 798);
    return _f((void *)QJSBase, ctx, psize, obj_ptr, flags);
}

/* QJS_ReadObject -- LVO -804 */
static inline void QJS_ReadObject(JSValue * result, struct JSContext * ctx, const unsigned char * buf, ULONG buf_len, int flags)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const unsigned char *, __reg("d0") ULONG, __reg("d1") int);
    _ftype _f = (_ftype)((char *)QJSBase - 804);
    _f((void *)QJSBase, result, ctx, buf, buf_len, flags);
}

/* QJS_NewClassID -- LVO -810 */
static inline ULONG QJS_NewClassID(struct JSRuntime * rt, ULONG * pclass_id)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") ULONG *);
    _ftype _f = (_ftype)((char *)QJSBase - 810);
    return _f((void *)QJSBase, rt, pclass_id);
}

/* QJS_NewClass -- LVO -816 */
static inline int QJS_NewClass(struct JSRuntime * rt, void * class_def, ULONG class_id)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") void *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 816);
    return _f((void *)QJSBase, rt, class_def, class_id);
}

/* QJS_IsRegisteredClass -- LVO -822 */
static inline int QJS_IsRegisteredClass(struct JSRuntime * rt, ULONG class_id)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 822);
    return _f((void *)QJSBase, rt, class_id);
}

/* QJS_GetClassID -- LVO -828 */
static inline ULONG QJS_GetClassID(JSValue * val_ptr)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 828);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_SetModuleLoaderFunc -- LVO -834 */
static inline void QJS_SetModuleLoaderFunc(struct JSRuntime * rt, void * normalize_func, void * loader_func, void * opaque)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") void *, __reg("a2") void *, __reg("a3") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 834);
    _f((void *)QJSBase, rt, normalize_func, loader_func, opaque);
}

/* QJS_GetImportMeta -- LVO -840 */
static inline void QJS_GetImportMeta(JSValue * result, struct JSContext * ctx, void * m)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 840);
    _f((void *)QJSBase, result, ctx, m);
}

/* QJS_GetModuleName -- LVO -846 */
static inline ULONG QJS_GetModuleName(struct JSContext * ctx, void * m)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 846);
    return _f((void *)QJSBase, ctx, m);
}

/* QJS_GetModuleNamespace -- LVO -852 */
static inline void QJS_GetModuleNamespace(JSValue * result, struct JSContext * ctx, void * m)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 852);
    _f((void *)QJSBase, result, ctx, m);
}

/* QJS_NewCModule -- LVO -858 */
static inline void * QJS_NewCModule(struct JSContext * ctx, const char * name_str, void * func)
{
    typedef void * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") const char *, __reg("a2") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 858);
    return _f((void *)QJSBase, ctx, name_str, func);
}

/* QJS_AddModuleExport -- LVO -864 */
static inline int QJS_AddModuleExport(struct JSContext * ctx, void * m, const char * name_str)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") void *, __reg("a2") const char *);
    _ftype _f = (_ftype)((char *)QJSBase - 864);
    return _f((void *)QJSBase, ctx, m, name_str);
}

/* QJS_SetModuleExport -- LVO -870 */
static inline int QJS_SetModuleExport(struct JSContext * ctx, void * m, const char * export_name, JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") void *, __reg("a2") const char *, __reg("a3") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 870);
    return _f((void *)QJSBase, ctx, m, export_name, val_ptr);
}

/* QJS_ResolveModule -- LVO -876 */
static inline int QJS_ResolveModule(struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 876);
    return _f((void *)QJSBase, ctx, obj_ptr);
}

/* QJS_GetScriptOrModuleName -- LVO -882 */
static inline ULONG QJS_GetScriptOrModuleName(struct JSContext * ctx, int n_stack_levels)
{
    typedef ULONG (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 882);
    return _f((void *)QJSBase, ctx, n_stack_levels);
}

/* QJS_NewCFunction2 -- LVO -888 */
static inline void QJS_NewCFunction2(JSValue * result, struct JSContext * ctx, void * func, const char * name, int length, int cproto, int magic)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") void *, __reg("a3") const char *, __reg("d0") int, __reg("d1") int, __reg("d2") int);
    _ftype _f = (_ftype)((char *)QJSBase - 888);
    _f((void *)QJSBase, result, ctx, func, name, length, cproto, magic);
}

/* QJS_SetConstructor -- LVO -894 */
static inline int QJS_SetConstructor(struct JSContext * ctx, JSValue * func_ptr, JSValue * proto_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 894);
    return _f((void *)QJSBase, ctx, func_ptr, proto_ptr);
}

/* QJS_SetPropertyFunctionList -- LVO -900 */
static inline int QJS_SetPropertyFunctionList(struct JSContext * ctx, JSValue * obj_ptr, void * tab, int len)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("a2") void *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 900);
    return _f((void *)QJSBase, ctx, obj_ptr, tab, len);
}

/* QJS_IsJobPending -- LVO -906 */
static inline int QJS_IsJobPending(struct JSRuntime * rt)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *);
    _ftype _f = (_ftype)((char *)QJSBase - 906);
    return _f((void *)QJSBase, rt);
}

/* QJS_ExecutePendingJob -- LVO -912 */
static inline int QJS_ExecutePendingJob(struct JSRuntime * rt, void * pctx)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 912);
    return _f((void *)QJSBase, rt, pctx);
}

/* QJS_NewPromiseCapability -- LVO -918 */
static inline void QJS_NewPromiseCapability(JSValue * result, struct JSContext * ctx, JSValue * resolving_funcs)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 918);
    _f((void *)QJSBase, result, ctx, resolving_funcs);
}

/* QJS_PromiseState -- LVO -924 */
static inline int QJS_PromiseState(struct JSContext * ctx, JSValue * promise_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 924);
    return _f((void *)QJSBase, ctx, promise_ptr);
}

/* QJS_PromiseResult -- LVO -930 */
static inline void QJS_PromiseResult(JSValue * result, struct JSContext * ctx, JSValue * promise_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 930);
    _f((void *)QJSBase, result, ctx, promise_ptr);
}

/* QJS_IsPromise -- LVO -936 */
static inline int QJS_IsPromise(JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 936);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_SetInterruptHandler -- LVO -942 */
static inline void QJS_SetInterruptHandler(struct JSRuntime * rt, void * cb, void * opaque)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") void *, __reg("a2") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 942);
    _f((void *)QJSBase, rt, cb, opaque);
}

/* QJS_SetHostPromiseRejectionTracker -- LVO -948 */
static inline void QJS_SetHostPromiseRejectionTracker(struct JSRuntime * rt, void * cb, void * opaque)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("a1") void *, __reg("a2") void *);
    _ftype _f = (_ftype)((char *)QJSBase - 948);
    _f((void *)QJSBase, rt, cb, opaque);
}

/* QJS_SetCanBlock -- LVO -954 */
static inline void QJS_SetCanBlock(struct JSRuntime * rt, int can_block)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSRuntime *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 954);
    _f((void *)QJSBase, rt, can_block);
}

/* QJS_NewArrayBufferCopy -- LVO -960 */
static inline void QJS_NewArrayBufferCopy(JSValue * result, struct JSContext * ctx, const unsigned char * buf, ULONG len)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const unsigned char *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 960);
    _f((void *)QJSBase, result, ctx, buf, len);
}

/* QJS_GetArrayBuffer -- LVO -966 */
static inline unsigned char * QJS_GetArrayBuffer(struct JSContext * ctx, ULONG * psize, JSValue * obj_ptr)
{
    typedef unsigned char * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") ULONG *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 966);
    return _f((void *)QJSBase, ctx, psize, obj_ptr);
}

/* QJS_IsArrayBuffer -- LVO -972 */
static inline int QJS_IsArrayBuffer(JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 972);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_DetachArrayBuffer -- LVO -978 */
static inline void QJS_DetachArrayBuffer(struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 978);
    _f((void *)QJSBase, ctx, obj_ptr);
}

/* QJS_GetUint8Array -- LVO -984 */
static inline unsigned char * QJS_GetUint8Array(struct JSContext * ctx, ULONG * psize, JSValue * obj_ptr)
{
    typedef unsigned char * (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") ULONG *, __reg("a2") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 984);
    return _f((void *)QJSBase, ctx, psize, obj_ptr);
}

/* QJS_NewUint8ArrayCopy -- LVO -990 */
static inline void QJS_NewUint8ArrayCopy(JSValue * result, struct JSContext * ctx, const unsigned char * buf, ULONG len)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const unsigned char *, __reg("d0") ULONG);
    _ftype _f = (_ftype)((char *)QJSBase - 990);
    _f((void *)QJSBase, result, ctx, buf, len);
}

/* QJS_IsDate -- LVO -996 */
static inline int QJS_IsDate(JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 996);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_IsRegExp -- LVO -1002 */
static inline int QJS_IsRegExp(JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 1002);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_IsMap -- LVO -1008 */
static inline int QJS_IsMap(JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 1008);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_IsSet -- LVO -1014 */
static inline int QJS_IsSet(JSValue * val_ptr)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 1014);
    return _f((void *)QJSBase, val_ptr);
}

/* QJS_NewSymbol -- LVO -1020 */
static inline void QJS_NewSymbol(JSValue * result, struct JSContext * ctx, const char * description, int is_global)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const char *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 1020);
    _f((void *)QJSBase, result, ctx, description, is_global);
}

/* QJS_NewDate -- LVO -1026 */
static inline void QJS_NewDate(JSValue * result, struct JSContext * ctx, double * epoch_ms_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") double *);
    _ftype _f = (_ftype)((char *)QJSBase - 1026);
    _f((void *)QJSBase, result, ctx, epoch_ms_ptr);
}

/* QJS_SetIsHTMLDDA -- LVO -1032 */
static inline void QJS_SetIsHTMLDDA(struct JSContext * ctx, JSValue * obj_ptr)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *);
    _ftype _f = (_ftype)((char *)QJSBase - 1032);
    _f((void *)QJSBase, ctx, obj_ptr);
}

/* QJS_SetConstructorBit -- LVO -1038 */
static inline int QJS_SetConstructorBit(struct JSContext * ctx, JSValue * func_ptr, int val)
{
    typedef int (*_ftype)(__reg("a6") void *, __reg("a0") struct JSContext *, __reg("a1") JSValue *, __reg("d0") int);
    _ftype _f = (_ftype)((char *)QJSBase - 1038);
    return _f((void *)QJSBase, ctx, func_ptr, val);
}

/* QJS_LoadModule -- LVO -1044 */
static inline void QJS_LoadModule(JSValue * result, struct JSContext * ctx, const char * basename, const char * filename)
{
    typedef void (*_ftype)(__reg("a6") void *, __reg("a0") JSValue *, __reg("a1") struct JSContext *, __reg("a2") const char *, __reg("a3") const char *);
    _ftype _f = (_ftype)((char *)QJSBase - 1044);
    _f((void *)QJSBase, result, ctx, basename, filename);
}

#endif /* INLINE_QUICKJS_LIB_H */
