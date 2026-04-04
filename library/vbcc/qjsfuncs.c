/*
 * qjsfuncs.c — QuickJS library function implementations for VBCC
 *
 * Does NOT include quickjs.h (SAS/C-specific headers).
 * Instead declares extern functions and minimal types.
 * The engine .o files (compiled by SAS/C) provide the implementations.
 */
#include <exec/types.h>
#include <exec/memory.h>
#include <exec/execbase.h>
/* No proto/exec.h — use explicit SysBase from library base instead */

#include <stddef.h>  /* size_t */

#include "libraryconfig.h"

/* ---- Minimal QuickJS types (matching quickjs.h non-NAN_BOXING 32-bit) ---- */
/* Note: JSValue/JSValueUnion also defined in libraryconfig.h for the
 * function declarations. We use those — don't redefine here. */

typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;
typedef unsigned long JSAtom;

/* JS_TAG values */
#define JS_TAG_INT    0
#define JS_TAG_EXCEPTION 6

/* JSMallocFunctions — must match quickjs.h exactly */
typedef struct JSMallocFunctions {
    void *(*js_calloc)(void *opaque, size_t count, size_t size);
    void *(*js_malloc)(void *opaque, size_t size);
    void (*js_free)(void *opaque, void *ptr);
    void *(*js_realloc)(void *opaque, void *ptr, size_t size);
    size_t (*js_malloc_usable_size)(const void *ptr);
} JSMallocFunctions;

/* ---- Extern engine functions (from VBCC-compiled .o files) ---- */

extern JSRuntime *JS_NewRuntime2(const JSMallocFunctions *mf, void *opaque);
extern void JS_FreeRuntime(JSRuntime *rt);
extern JSContext *JS_NewContext(JSRuntime *rt);
extern JSContext *JS_NewContextRaw(JSRuntime *rt);
extern void JS_FreeContext(JSContext *ctx);
extern const char *JS_GetVersion(void);
extern void JS_SetMemoryLimit(JSRuntime *rt, size_t limit);
extern void JS_SetMaxStackSize(JSRuntime *rt, size_t stack_size);
extern void JS_RunGC(JSRuntime *rt);
extern int JS_AddIntrinsicBaseObjects(JSContext *ctx);
extern int JS_AddIntrinsicDate(JSContext *ctx);
extern int JS_AddIntrinsicEval(JSContext *ctx);
extern int JS_AddIntrinsicRegExp(JSContext *ctx);
extern int JS_AddIntrinsicJSON(JSContext *ctx);
extern int JS_AddIntrinsicProxy(JSContext *ctx);
extern int JS_AddIntrinsicMapSet(JSContext *ctx);
extern int JS_AddIntrinsicTypedArrays(JSContext *ctx);
extern int JS_AddIntrinsicPromise(JSContext *ctx);
extern int JS_AddIntrinsicWeakRef(JSContext *ctx);
extern int JS_AddIntrinsicDOMException(JSContext *ctx);
extern int JS_AddPerformance(JSContext *ctx);
extern JSValue JS_Eval(JSContext *ctx, const char *input, size_t input_len,
                        const char *filename, int eval_flags);
extern void JS_FreeValue(JSContext *ctx, JSValue v);
extern JSValue JS_GetException(JSContext *ctx);
extern int JS_ToInt32(JSContext *ctx, long *pres, JSValue val);

/* --- Batch 1 engine externs --- */
extern void JS_SetRuntimeInfo(JSRuntime *rt, const char *info);
extern void *JS_GetRuntimeOpaque(JSRuntime *rt);
extern void JS_SetRuntimeOpaque(JSRuntime *rt, void *opaque);
extern void JS_UpdateStackTop(JSRuntime *rt);
extern void JS_SetDumpFlags(JSRuntime *rt, unsigned long long flags);
extern unsigned long long JS_GetDumpFlags(JSRuntime *rt);
extern size_t JS_GetGCThreshold(JSRuntime *rt);
extern void JS_SetGCThreshold(JSRuntime *rt, size_t gc_threshold);
extern int JS_IsLiveObject(JSRuntime *rt, JSValue obj);
extern JSContext *JS_DupContext(JSContext *ctx);
extern void *JS_GetContextOpaque(JSContext *ctx);
extern void JS_SetContextOpaque(JSContext *ctx, void *opaque);
extern JSRuntime *JS_GetRuntime(JSContext *ctx);
extern void JS_SetClassProto(JSContext *ctx, unsigned long class_id, JSValue obj);
extern JSValue JS_GetClassProto(JSContext *ctx, unsigned long class_id);
extern JSValue JS_GetFunctionProto(JSContext *ctx);
extern int JS_AddIntrinsicBigInt(JSContext *ctx);
extern void JS_AddIntrinsicRegExpCompiler(JSContext *ctx);
extern int JS_IsEqual(JSContext *ctx, JSValue op1, JSValue op2);
extern int JS_IsStrictEqual(JSContext *ctx, JSValue op1, JSValue op2);
extern int JS_IsSameValue(JSContext *ctx, JSValue op1, JSValue op2);
extern int JS_IsSameValueZero(JSContext *ctx, JSValue op1, JSValue op2);
typedef struct JSMemoryUsage JSMemoryUsage;
extern void JS_ComputeMemoryUsage(JSRuntime *rt, JSMemoryUsage *s);
typedef void JSRuntimeFinalizer(JSRuntime *rt, void *arg);
extern int JS_AddRuntimeFinalizer(JSRuntime *rt,
                                  JSRuntimeFinalizer *finalizer, void *arg);

/* ---- Serial debug output via RawPutChar (exec LVO -516) ---- */
#define LVO_CALL(base, offset, type) ((type)((char *)(base) - (offset)))

static void dbg_char(struct ExecBase *sys, char c)
{
    LVO_CALL(sys, 516,
        void (*)(__reg("a6") struct ExecBase *,
                 __reg("d0") UBYTE))(sys, (UBYTE)c);
}

static void dbg_str(struct ExecBase *sys, const char *s)
{
    while (*s)
        dbg_char(sys, *s++);
}

/* Global SysBase pointer for debug — set during CustomLibInit.
 * Only used by dbg functions, not by engine code. */
static struct ExecBase *g_dbg_sys;

/* Inline checks */
#define JS_IsException(v) (((long)(v).tag) == JS_TAG_EXCEPTION)

/* ---- AmigaAlloc-based allocator ---- */

#include "sharedlib_mem.h"

/* From sharedlib_time.c — must be called during init so gettimeofday works */
extern void sharedlib_time_init(struct Library *dosBase);
extern void sharedlib_time_cleanup(void);

/* From sharedlib_math_soft.c or sharedlib_math.c — sets math library bases.
 * Soft-float build: sets MathIeeeDoubBasBase/MathIeeeDoubTransBase globals.
 * FPU build: no-op stubs. */
extern void sharedlib_math_soft_init(struct Library *basBase,
                                      struct Library *transBase);
extern void sharedlib_math_soft_cleanup(void);

/* The JSMallocFunctions callbacks receive 'opaque' which we set to
 * the library base pointer in QJS_NewRuntime. This gives every
 * allocation call access to SysBase and the memory pool. */

static void *a_calloc(void *op, size_t count, size_t sz)
{
    return AmigaAlloc((struct QJSLibBase *)op,
                      (ULONG)(count * sz), AA_CALLOC, NULL);
}

static void *a_malloc(void *op, size_t sz)
{
    return AmigaAlloc((struct QJSLibBase *)op,
                      (ULONG)sz, AA_MALLOC, NULL);
}

static void a_free(void *op, void *ptr)
{
    AmigaFree((struct QJSLibBase *)op, ptr, AA_MALLOC);
}

static void *a_realloc(void *op, void *ptr, size_t ns)
{
    return AmigaAlloc((struct QJSLibBase *)op,
                      (ULONG)ns, AA_REALLOC, ptr);
}

static size_t a_usable(const void *ptr)
{
    /* AmigaAllocUsable doesn't need the base — it reads the header.
     * But the JSMallocFunctions signature has no opaque here.
     * Cast away the base requirement. */
    return (size_t)AmigaAllocUsable(NULL, ptr);
}

static const JSMallocFunctions amiga_mf = {
    a_calloc, a_malloc, a_free, a_realloc, a_usable
};

/* ---- CustomLibInit / CustomLibCleanup ---- */

BOOL CustomLibInit(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;

    aBase->iDOSBase = __OpenLibrary(sys, "dos.library", 36);
    if (!aBase->iDOSBase)
        return TRUE;

    /* Init time subsystem with DOSBase for gettimeofday/DateStamp */
    sharedlib_time_init(aBase->iDOSBase);

    aBase->iMathDoubBasBase = __OpenLibrary(sys,
        "mathieeedoubbas.library", 34);
    if (!aBase->iMathDoubBasBase)
        return TRUE;

    aBase->iMathDoubTransBase = __OpenLibrary(sys,
        "mathieeedoubtrans.library", 34);
    if (!aBase->iMathDoubTransBase)
        return TRUE;

    /* Init math subsystem — sets globals for soft-float LVO calls.
     * No-op for FPU build (stubs in sharedlib_math.c). */
    sharedlib_math_soft_init(aBase->iMathDoubBasBase,
                              aBase->iMathDoubTransBase);

    /* Create memory pool for all engine allocations */
    if (AmigaPoolInit(aBase))
        return TRUE;

    /* Save SysBase for debug output */
    g_dbg_sys = sys;

    return FALSE;
}

VOID CustomLibCleanup(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;

    /* Destroy pool first — frees all engine allocations */
    AmigaPoolCleanup(aBase);

    /* Tear down time subsystem */
    sharedlib_time_cleanup();

    /* Tear down math subsystem */
    sharedlib_math_soft_cleanup();

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

/* ---- Library functions ---- */

struct JSRuntime *QJS_NewRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base)
{
    /* Pass library base as opaque — allocator callbacks use it
     * to reach SysBase and the memory pool. */
    return JS_NewRuntime2(&amiga_mf, (void *)base);
}

void QJS_FreeRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    JS_FreeRuntime(rt);
}

struct JSContext *QJS_NewContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    JSContext *ctx;
    struct ExecBase *sys = g_dbg_sys;

    dbg_str(sys, "NC:Raw\n");
    ctx = JS_NewContextRaw(rt);
    if (!ctx) { dbg_str(sys, "NC:Raw FAIL\n"); return NULL; }

    dbg_str(sys, "NC:Base\n");
    if (JS_AddIntrinsicBaseObjects(ctx)) goto fail;

    dbg_str(sys, "NC:Date\n");
    if (JS_AddIntrinsicDate(ctx)) goto fail;

    dbg_str(sys, "NC:Eval\n");
    if (JS_AddIntrinsicEval(ctx)) goto fail;

    dbg_str(sys, "NC:RegExp\n");
    if (JS_AddIntrinsicRegExp(ctx)) goto fail;

    dbg_str(sys, "NC:JSON\n");
    if (JS_AddIntrinsicJSON(ctx)) goto fail;

    dbg_str(sys, "NC:Proxy\n");
    if (JS_AddIntrinsicProxy(ctx)) goto fail;

    dbg_str(sys, "NC:MapSet\n");
    if (JS_AddIntrinsicMapSet(ctx)) goto fail;

    dbg_str(sys, "NC:TypedArr\n");
    if (JS_AddIntrinsicTypedArrays(ctx)) goto fail;

    dbg_str(sys, "NC:Promise\n");
    if (JS_AddIntrinsicPromise(ctx)) goto fail;

    dbg_str(sys, "NC:WeakRef\n");
    if (JS_AddIntrinsicWeakRef(ctx)) goto fail;

    dbg_str(sys, "NC:DOMExc\n");
    if (JS_AddIntrinsicDOMException(ctx)) goto fail;

    dbg_str(sys, "NC:Perf\n");
    if (JS_AddPerformance(ctx)) goto fail;

    dbg_str(sys, "NC:DONE\n");
    return ctx;

fail:
    dbg_str(sys, "NC:FAIL\n");
    JS_FreeContext(ctx);
    return NULL;
}

struct JSContext *QJS_NewContextRaw(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    return JS_NewContextRaw(rt);
}

void QJS_FreeContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    JS_FreeContext(ctx);
}

const char *QJS_GetVersion(
    __reg("a6") LIBRARY_BASE_TYPE *base)
{
    return JS_GetVersion();
}

void QJS_SetMemoryLimit(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG limit)
{
    JS_SetMemoryLimit(rt, (size_t)limit);
}

void QJS_SetMaxStackSize(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG stack_size)
{
    JS_SetMaxStackSize(rt, (size_t)stack_size);
}

void QJS_RunGC(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    JS_RunGC(rt);
}

int QJS_AddBaseObjects(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicBaseObjects(ctx);
}

int QJS_AddEval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicEval(ctx);
}

int QJS_AddDate(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicDate(ctx);
}

int QJS_AddRegExp(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicRegExp(ctx);
}

int QJS_AddJSON(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicJSON(ctx);
}

int QJS_AddProxy(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicProxy(ctx);
}

int QJS_AddMapSet(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicMapSet(ctx);
}

int QJS_AddTypedArrays(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicTypedArrays(ctx);
}

int QJS_AddPromise(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicPromise(ctx);
}

int QJS_AddWeakRef(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicWeakRef(ctx);
}

int QJS_AddDOMException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicDOMException(ctx);
}

int QJS_AddPerformance(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddPerformance(ctx);
}

long QJS_EvalSimple(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *input,
    __reg("d0") ULONG input_len)
{
    JSValue result;
    long ret;
    long ival;
    result = JS_Eval(ctx, input, (size_t)input_len, "<lib>", 0);
    if (JS_IsException(result)) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        return -9999;
    }
    if (JS_ToInt32(ctx, &ival, result) < 0)
        ret = -9998;
    else
        ret = ival;
    JS_FreeValue(ctx, result);
    return ret;
}

void QJS_Eval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *input,
    __reg("d0") ULONG input_len,
    __reg("a3") const char *filename,
    __reg("d1") int eval_flags)
{
    *result = JS_Eval(ctx, input, (size_t)input_len, filename, eval_flags);
}

/* ---- Batch 1: Runtime functions ---- */

void QJS_SetRuntimeInfo(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") const char *info)
{
    JS_SetRuntimeInfo(rt, info);
}

void *QJS_GetRuntimeOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    return JS_GetRuntimeOpaque(rt);
}

void QJS_SetRuntimeOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *opaque)
{
    JS_SetRuntimeOpaque(rt, opaque);
}

void QJS_UpdateStackTop(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    JS_UpdateStackTop(rt);
}

void QJS_SetDumpFlags(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") unsigned long long *flags_ptr)
{
    JS_SetDumpFlags(rt, *flags_ptr);
}

void QJS_GetDumpFlags(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") unsigned long long *result_ptr)
{
    *result_ptr = JS_GetDumpFlags(rt);
}

ULONG QJS_GetGCThreshold(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    return (ULONG)JS_GetGCThreshold(rt);
}

void QJS_SetGCThreshold(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG threshold)
{
    JS_SetGCThreshold(rt, (size_t)threshold);
}

int QJS_IsLiveObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") JSValue *obj_ptr)
{
    return (int)JS_IsLiveObject(rt, *obj_ptr);
}

/* ---- Batch 1: Context functions ---- */

struct JSContext *QJS_DupContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_DupContext(ctx);
}

void *QJS_GetContextOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_GetContextOpaque(ctx);
}

void QJS_SetContextOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *opaque)
{
    JS_SetContextOpaque(ctx, opaque);
}

struct JSRuntime *QJS_GetRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_GetRuntime(ctx);
}

void QJS_SetClassProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG class_id,
    __reg("a2") JSValue *obj_ptr)
{
    JS_SetClassProto(ctx, (unsigned long)class_id, *obj_ptr);
}

void QJS_GetClassProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG class_id)
{
    *result = JS_GetClassProto(ctx, (unsigned long)class_id);
}

void QJS_GetFunctionProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx)
{
    *result = JS_GetFunctionProto(ctx);
}

int QJS_AddBigInt(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return JS_AddIntrinsicBigInt(ctx);
}

void QJS_AddRegExpCompiler(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    JS_AddIntrinsicRegExpCompiler(ctx);
}

/* ---- Batch 1: Comparison functions ---- */

int QJS_IsEqual(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr)
{
    return JS_IsEqual(ctx, *op1_ptr, *op2_ptr);
}

int QJS_IsStrictEqual(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr)
{
    return (int)JS_IsStrictEqual(ctx, *op1_ptr, *op2_ptr);
}

int QJS_IsSameValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr)
{
    return (int)JS_IsSameValue(ctx, *op1_ptr, *op2_ptr);
}

int QJS_IsSameValueZero(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr)
{
    return (int)JS_IsSameValueZero(ctx, *op1_ptr, *op2_ptr);
}

/* ---- Batch 1: Memory/Finalizer functions ---- */

void QJS_ComputeMemoryUsage(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *s)
{
    JS_ComputeMemoryUsage(rt, (JSMemoryUsage *)s);
}

int QJS_AddRuntimeFinalizer(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *finalizer,
    __reg("a2") void *arg)
{
    return JS_AddRuntimeFinalizer(rt, (JSRuntimeFinalizer *)finalizer, arg);
}
