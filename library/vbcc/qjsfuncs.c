/*
 * qjsfuncs.c — QuickJS library function implementations for VBCC
 *
 * Does NOT include quickjs.h (SAS/C-specific headers).
 * Instead declares extern functions and minimal types.
 * The engine .o files (compiled by SAS/C) provide the implementations.
 *
 * Functions that handle JSValue by-value (read *val_ptr or write *result)
 * are in qjsfuncs_asm_all.s — only stub-free C wrappers remain here.
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
extern size_t JS_GetGCThreshold(JSRuntime *rt);
extern void JS_SetGCThreshold(JSRuntime *rt, size_t gc_threshold);
extern JSContext *JS_DupContext(JSContext *ctx);
extern void *JS_GetContextOpaque(JSContext *ctx);
extern void JS_SetContextOpaque(JSContext *ctx, void *opaque);
extern JSRuntime *JS_GetRuntime(JSContext *ctx);
extern int JS_AddIntrinsicBigInt(JSContext *ctx);
extern void JS_AddIntrinsicRegExpCompiler(JSContext *ctx);
typedef struct JSMemoryUsage JSMemoryUsage;
extern void JS_ComputeMemoryUsage(JSRuntime *rt, JSMemoryUsage *s);
typedef void JSRuntimeFinalizer(JSRuntime *rt, void *arg);
extern int JS_AddRuntimeFinalizer(JSRuntime *rt,
                                  JSRuntimeFinalizer *finalizer, void *arg);

/* --- Batch 2 engine externs --- */
extern JSValue JS_NewNumber(JSContext *ctx, double d);
extern JSValue JS_NewStringLen(JSContext *ctx, const char *str1, size_t len1);
extern const char *JS_ToCStringLen2(JSContext *ctx, size_t *plen,
                                    JSValue val1, int cesu8);
extern void JS_FreeCString(JSContext *ctx, const char *ptr);
extern JSValue JS_GetGlobalObject(JSContext *ctx);
extern int JS_HasException(JSContext *ctx);
extern int JS_DetectModule(const char *input, size_t input_len);
extern void *js_malloc(JSContext *ctx, size_t size);
extern void js_free(JSContext *ctx, void *ptr);
extern void *js_realloc(JSContext *ctx, void *ptr, size_t size);
extern void *js_calloc(JSContext *ctx, size_t count, size_t size);
extern void *js_mallocz(JSContext *ctx, size_t size);
extern char *js_strdup(JSContext *ctx, const char *str);

/* --- Batch 3 engine externs --- */
extern JSValue JS_GetPropertyStr(JSContext *ctx, JSValue this_obj, const char *prop);
extern void JS_FreePropertyEnum(JSContext *ctx, void *tab, unsigned long len);

/* --- Batch 4 engine externs --- */
extern JSAtom JS_NewAtomLen(JSContext *ctx, const char *str, size_t len);
extern JSAtom JS_NewAtom(JSContext *ctx, const char *str);
extern JSAtom JS_NewAtomUInt32(JSContext *ctx, unsigned long n);
extern JSAtom JS_DupAtom(JSContext *ctx, JSAtom v);
extern void JS_FreeAtom(JSContext *ctx, JSAtom v);
extern const char *JS_AtomToCStringLen(JSContext *ctx, size_t *plen, JSAtom atom);
extern JSValue JS_CallConstructor(JSContext *ctx, JSValue func_obj,
                                  int argc, JSValue *argv);

/* --- Batch 5 engine externs and types --- */
typedef struct JSModuleDef JSModuleDef;
typedef char *JSModuleNormalizeFunc(JSContext *ctx,
    const char *module_base_name, const char *module_name, void *opaque);
typedef JSModuleDef *JSModuleLoaderFunc(JSContext *ctx,
    const char *module_name, void *opaque);
typedef int JSModuleInitFunc(JSContext *ctx, JSModuleDef *m);
typedef JSValue JSCFunction(JSContext *ctx, JSValue this_val,
    int argc, JSValue *argv);
typedef int JSInterruptHandler(JSRuntime *rt, void *opaque);
typedef void JSHostPromiseRejectionTracker(JSContext *ctx, JSValue promise,
    JSValue reason, int is_handled, void *opaque);
extern void JS_SetModuleLoaderFunc(JSRuntime *rt,
    JSModuleNormalizeFunc *module_normalize,
    JSModuleLoaderFunc *module_loader, void *opaque);
extern void JS_SetInterruptHandler(JSRuntime *rt, JSInterruptHandler *cb, void *opaque);
extern void JS_SetHostPromiseRejectionTracker(JSRuntime *rt,
    JSHostPromiseRejectionTracker *cb, void *opaque);
extern void JS_SetCanBlock(JSRuntime *rt, int can_block);
extern JSAtom JS_GetModuleName(JSContext *ctx, JSModuleDef *m);
extern JSModuleDef *JS_NewCModule(JSContext *ctx, const char *name_str,
    JSModuleInitFunc *func);
extern int JS_AddModuleExport(JSContext *ctx, JSModuleDef *m, const char *name_str);
extern JSAtom JS_GetScriptOrModuleName(JSContext *ctx, int n_stack_levels);
extern unsigned long JS_NewClassID(JSRuntime *rt, unsigned long *pclass_id);
extern int JS_NewClass(JSRuntime *rt, unsigned long class_id,
                       const void *class_def);
extern int JS_IsRegisteredClass(JSRuntime *rt, unsigned long class_id);
extern int JS_IsJobPending(JSRuntime *rt);
extern int JS_ExecutePendingJob(JSRuntime *rt, JSContext **pctx);

/* --- New function externs (post-v0.54) --- */
extern void *JS_GetLibcOpaque(struct JSRuntime *rt);
extern void JS_SetLibcOpaque(struct JSRuntime *rt, void *opaque);
extern int JS_AddModuleExportList(struct JSContext *ctx, void *m,
    const void *tab, int len);
extern int JS_SetModuleExportList(struct JSContext *ctx, void *m,
    const void *tab, int len);

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

/* ==================================================================
 * Library functions — C wrappers (pointer/int params only)
 * Functions that handle JSValue by-value are in qjsfuncs_asm_all.s
 * ================================================================== */

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

/* QJS_EvalBuf — eval with module support, runs entirely in library.
 * Returns 0 on success, -1 on exception. */
long QJS_EvalBuf(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *input,
    __reg("d0") ULONG input_len,
    __reg("a2") const char *filename,
    __reg("d1") int eval_flags)
{
    JSValue val;
    int ret;

    /* JS_Eval handles both global scripts and modules internally */
    val = JS_Eval(ctx, input, (size_t)input_len, filename, eval_flags);
    if (JS_IsException(val)) {
        ret = -1;
    } else {
        ret = 0;
    }
    JS_FreeValue(ctx, val);
    return ret;
}

/* QJS_Eval: in qjsfuncs_asm_all.s */

/* ---- Runtime functions ---- */

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

/* QJS_SetDumpFlags: in qjsfuncs_asm_all.s */
/* QJS_GetDumpFlags: in qjsfuncs_asm_all.s */

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

/* QJS_IsLiveObject: in qjsfuncs_asm_all.s */

/* ---- Context functions ---- */

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

/* QJS_SetClassProto: in qjsfuncs_asm_all.s */
/* QJS_GetClassProto: in qjsfuncs_asm_all.s */
/* QJS_GetFunctionProto: in qjsfuncs_asm_all.s */

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

/* QJS_IsEqual: in qjsfuncs_asm_all.s */
/* QJS_IsStrictEqual: in qjsfuncs_asm_all.s */
/* QJS_IsSameValue: in qjsfuncs_asm_all.s */
/* QJS_IsSameValueZero: in qjsfuncs_asm_all.s */

/* ---- Memory/Finalizer functions ---- */

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

/* ---- Value Management (all in qjsfuncs_asm_all.s) ---- */
/* QJS_FreeValue: in qjsfuncs_asm_all.s */
/* QJS_FreeValueRT: in qjsfuncs_asm_all.s */
/* QJS_DupValue: in qjsfuncs_asm_all.s */
/* QJS_DupValueRT: in qjsfuncs_asm_all.s */

/* ---- Value Creation (all in qjsfuncs_asm_all.s) ---- */
/* QJS_NewNumber: in qjsfuncs_asm_all.s */
/* QJS_NewBigInt64: in qjsfuncs_asm_all.s */
/* QJS_NewBigUint64: in qjsfuncs_asm_all.s */

/* ---- Strings ---- */
/* QJS_NewStringLen: in qjsfuncs_asm_all.s */
/* QJS_NewAtomString: in qjsfuncs_asm_all.s */
/* QJS_ToString: in qjsfuncs_asm_all.s */
/* QJS_ToPropertyKey: in qjsfuncs_asm_all.s */
/* QJS_ToCStringLen2: in qjsfuncs_asm_all.s */

void QJS_FreeCString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *ptr)
{
    JS_FreeCString(ctx, ptr);
}

/* ---- Conversion (all in qjsfuncs_asm_all.s) ---- */
/* QJS_ToBool: in qjsfuncs_asm_all.s */
/* QJS_ToInt32: in qjsfuncs_asm_all.s */
/* QJS_ToInt64: in qjsfuncs_asm_all.s */
/* QJS_ToFloat64: in qjsfuncs_asm_all.s */
/* QJS_ToNumber: in qjsfuncs_asm_all.s */

/* ---- Objects (all in qjsfuncs_asm_all.s) ---- */
/* QJS_NewObject: in qjsfuncs_asm_all.s */
/* QJS_NewObjectClass: in qjsfuncs_asm_all.s */
/* QJS_NewObjectProto: in qjsfuncs_asm_all.s */
/* QJS_NewArray: in qjsfuncs_asm_all.s */
/* QJS_IsArray: in qjsfuncs_asm_all.s */
/* QJS_IsFunction: in qjsfuncs_asm_all.s */
/* QJS_IsConstructor: in qjsfuncs_asm_all.s */
/* QJS_GetGlobalObject: in qjsfuncs_asm_all.s */
/* QJS_ToObject: in qjsfuncs_asm_all.s */

/* ---- Exceptions ---- */
/* QJS_Throw: in qjsfuncs_asm_all.s */
/* QJS_GetException: in qjsfuncs_asm_all.s */

int QJS_HasException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return (int)JS_HasException(ctx);
}

/* QJS_IsError: in qjsfuncs_asm_all.s */
/* QJS_NewError: in qjsfuncs_asm_all.s */
/* QJS_ThrowOutOfMemory: in qjsfuncs_asm_all.s */

/* ---- Detect Module ---- */

int QJS_DetectModule(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") const char *input,
    __reg("d0") ULONG input_len)
{
    return (int)JS_DetectModule(input, (size_t)input_len);
}

/* ---- Memory Allocation ---- */

void *QJS_Malloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG size)
{
    return js_malloc(ctx, (size_t)size);
}

void QJS_Free(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *ptr)
{
    js_free(ctx, ptr);
}

void *QJS_Realloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *ptr,
    __reg("d0") ULONG size)
{
    return js_realloc(ctx, ptr, (size_t)size);
}

void *QJS_Calloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG count,
    __reg("d1") ULONG size)
{
    return js_calloc(ctx, (size_t)count, (size_t)size);
}

void *QJS_Mallocz(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG size)
{
    return js_mallocz(ctx, (size_t)size);
}

char *QJS_Strdup(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str)
{
    return js_strdup(ctx, str);
}

/* ---- Property access (all in qjsfuncs_asm_all.s) ---- */
/* QJS_GetProperty: in qjsfuncs_asm_all.s */
/* QJS_GetPropertyUint32: in qjsfuncs_asm_all.s */
/* QJS_GetPropertyStr: in qjsfuncs_asm_all.s */
/* QJS_GetPropertyInt64: in qjsfuncs_asm_all.s */
/* QJS_SetProperty: in qjsfuncs_asm_all.s */
/* QJS_SetPropertyUint32: in qjsfuncs_asm_all.s */
/* QJS_SetPropertyStr: in qjsfuncs_asm_all.s */
/* QJS_HasProperty: in qjsfuncs_asm_all.s */
/* QJS_DeleteProperty: in qjsfuncs_asm_all.s */

/* ---- Prototype (all in qjsfuncs_asm_all.s) ---- */
/* QJS_SetPrototype: in qjsfuncs_asm_all.s */
/* QJS_GetPrototype: in qjsfuncs_asm_all.s */

/* ---- Length (all in qjsfuncs_asm_all.s) ---- */
/* QJS_GetLength: in qjsfuncs_asm_all.s */
/* QJS_SetLength: in qjsfuncs_asm_all.s */

/* ---- Extensibility/Seal/Freeze (all in qjsfuncs_asm_all.s) ---- */
/* QJS_IsExtensible: in qjsfuncs_asm_all.s */
/* QJS_PreventExtensions: in qjsfuncs_asm_all.s */
/* QJS_SealObject: in qjsfuncs_asm_all.s */
/* QJS_FreezeObject: in qjsfuncs_asm_all.s */

/* ---- Define Property (all in qjsfuncs_asm_all.s) ---- */
/* QJS_DefinePropertyValue: in qjsfuncs_asm_all.s */
/* QJS_DefinePropertyValueUint32: in qjsfuncs_asm_all.s */
/* QJS_DefinePropertyValueStr: in qjsfuncs_asm_all.s */

/* ---- Opaque (all in qjsfuncs_asm_all.s) ---- */
/* QJS_SetOpaque: in qjsfuncs_asm_all.s */
/* QJS_GetOpaque: in qjsfuncs_asm_all.s */
/* QJS_GetOpaque2: in qjsfuncs_asm_all.s */

/* ---- Own Property Names ---- */
/* QJS_GetOwnPropertyNames: in qjsfuncs_asm_all.s */

void QJS_FreePropertyEnum(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *tab,
    __reg("d0") ULONG len)
{
    JS_FreePropertyEnum(ctx, tab, (unsigned long)len);
}

/* QJS_IsInstanceOf: in qjsfuncs_asm_all.s */

/* ---- Atoms ---- */

ULONG QJS_NewAtomLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str,
    __reg("d0") ULONG len)
{
    return (ULONG)JS_NewAtomLen(ctx, str, (size_t)len);
}

ULONG QJS_NewAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str)
{
    return (ULONG)JS_NewAtom(ctx, str);
}

ULONG QJS_NewAtomUInt32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG n)
{
    return (ULONG)JS_NewAtomUInt32(ctx, (unsigned long)n);
}

ULONG QJS_DupAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG v)
{
    return (ULONG)JS_DupAtom(ctx, (JSAtom)v);
}

void QJS_FreeAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG v)
{
    JS_FreeAtom(ctx, (JSAtom)v);
}

/* QJS_AtomToValue: in qjsfuncs_asm_all.s */
/* QJS_AtomToString: in qjsfuncs_asm_all.s */

const char *QJS_AtomToCStringLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") ULONG *plen,
    __reg("d0") ULONG atom)
{
    size_t slen;
    const char *r;
    r = JS_AtomToCStringLen(ctx, plen ? &slen : NULL, (JSAtom)atom);
    if (plen && r)
        *plen = (ULONG)slen;
    return r;
}

/* QJS_ValueToAtom: in qjsfuncs_asm_all.s */

/* ---- Eval/Call (all in qjsfuncs_asm_all.s) ---- */
/* QJS_EvalFunction: in qjsfuncs_asm_all.s */
/* QJS_Call: in qjsfuncs_asm_all.s */
/* QJS_Invoke: in qjsfuncs_asm_all.s */
/* QJS_CallConstructor: in qjsfuncs_asm_all.s */

/* ---- JSON (all in qjsfuncs_asm_all.s) ---- */
/* QJS_ParseJSON: in qjsfuncs_asm_all.s */
/* QJS_JSONStringify: in qjsfuncs_asm_all.s */

/* ---- Serialization (all in qjsfuncs_asm_all.s) ---- */
/* QJS_WriteObject: in qjsfuncs_asm_all.s */
/* QJS_ReadObject: in qjsfuncs_asm_all.s */

/* ---- Class ---- */

ULONG QJS_NewClassID(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") ULONG *pclass_id)
{
    return (ULONG)JS_NewClassID(rt, (unsigned long *)pclass_id);
}

int QJS_NewClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *class_def,
    __reg("d0") ULONG class_id)
{
    return JS_NewClass(rt, (unsigned long)class_id, class_def);
}

int QJS_IsRegisteredClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG class_id)
{
    return (int)JS_IsRegisteredClass(rt, (unsigned long)class_id);
}

/* QJS_GetClassID: in qjsfuncs_asm_all.s */

/* ---- Module functions ---- */

void QJS_SetModuleLoaderFunc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *normalize_func,
    __reg("a2") void *loader_func,
    __reg("a3") void *opaque)
{
    JS_SetModuleLoaderFunc(rt,
        (JSModuleNormalizeFunc *)normalize_func,
        (JSModuleLoaderFunc *)loader_func,
        opaque);
}

/* QJS_GetImportMeta: in qjsfuncs_asm_all.s */

ULONG QJS_GetModuleName(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *m)
{
    return (ULONG)JS_GetModuleName(ctx, (JSModuleDef *)m);
}

/* QJS_GetModuleNamespace: in qjsfuncs_asm_all.s */

void *QJS_NewCModule(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *name_str,
    __reg("a2") void *func)
{
    return (void *)JS_NewCModule(ctx, name_str, (JSModuleInitFunc *)func);
}

int QJS_AddModuleExport(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *m,
    __reg("a2") const char *name_str)
{
    return JS_AddModuleExport(ctx, (JSModuleDef *)m, name_str);
}

/* QJS_SetModuleExport: in qjsfuncs_asm_all.s */
/* QJS_ResolveModule: in qjsfuncs_asm_all.s */

ULONG QJS_GetScriptOrModuleName(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") int n_stack_levels)
{
    return (ULONG)JS_GetScriptOrModuleName(ctx, n_stack_levels);
}

/* ---- C Function / Constructor (all in qjsfuncs_asm_all.s) ---- */
/* QJS_NewCFunction2: in qjsfuncs_asm_all.s */
/* QJS_SetConstructor: in qjsfuncs_asm_all.s */
/* QJS_SetPropertyFunctionList: in qjsfuncs_asm_all.s */

/* ---- Jobs/Pending ---- */

int QJS_IsJobPending(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    return (int)JS_IsJobPending(rt);
}

int QJS_ExecutePendingJob(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *pctx)
{
    return JS_ExecutePendingJob(rt, (JSContext **)pctx);
}

/* ---- Promise (all in qjsfuncs_asm_all.s) ---- */
/* QJS_NewPromiseCapability: in qjsfuncs_asm_all.s */
/* QJS_PromiseState: in qjsfuncs_asm_all.s */
/* QJS_PromiseResult: in qjsfuncs_asm_all.s */
/* QJS_IsPromise: in qjsfuncs_asm_all.s */

/* ---- Callbacks ---- */

void QJS_SetInterruptHandler(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *cb,
    __reg("a2") void *opaque)
{
    JS_SetInterruptHandler(rt, (JSInterruptHandler *)cb, opaque);
}

void QJS_SetHostPromiseRejectionTracker(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *cb,
    __reg("a2") void *opaque)
{
    JS_SetHostPromiseRejectionTracker(rt,
        (JSHostPromiseRejectionTracker *)cb, opaque);
}

void QJS_SetCanBlock(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") int can_block)
{
    JS_SetCanBlock(rt, can_block);
}

/* ---- ArrayBuffer (all in qjsfuncs_asm_all.s) ---- */
/* QJS_NewArrayBufferCopy: in qjsfuncs_asm_all.s */
/* QJS_GetArrayBuffer: in qjsfuncs_asm_all.s */
/* QJS_IsArrayBuffer: in qjsfuncs_asm_all.s */
/* QJS_DetachArrayBuffer: in qjsfuncs_asm_all.s */
/* QJS_GetUint8Array: in qjsfuncs_asm_all.s */
/* QJS_NewUint8ArrayCopy: in qjsfuncs_asm_all.s */

/* ---- Type checks (all in qjsfuncs_asm_all.s) ---- */
/* QJS_IsDate: in qjsfuncs_asm_all.s */
/* QJS_IsRegExp: in qjsfuncs_asm_all.s */
/* QJS_IsMap: in qjsfuncs_asm_all.s */
/* QJS_IsSet: in qjsfuncs_asm_all.s */

/* ---- Symbol (in qjsfuncs_asm_all.s) ---- */
/* QJS_NewSymbol: in qjsfuncs_asm_all.s */

/* ---- NewDate (composite function — calls multiple JS_ internally) ---- */

void QJS_NewDate(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") double *epoch_ms_ptr)
{
    JSValue global, date_ctor, arg;
    global = JS_GetGlobalObject(ctx);
    date_ctor = JS_GetPropertyStr(ctx, global, "Date");
    arg = JS_NewNumber(ctx, *epoch_ms_ptr);
    *result = JS_CallConstructor(ctx, date_ctor, 1, &arg);
    JS_FreeValue(ctx, arg);
    JS_FreeValue(ctx, date_ctor);
    JS_FreeValue(ctx, global);
}

/* ---- Misc (all in qjsfuncs_asm_all.s) ---- */
/* QJS_SetIsHTMLDDA: in qjsfuncs_asm_all.s */
/* QJS_SetConstructorBit: in qjsfuncs_asm_all.s */
/* QJS_LoadModule: in qjsfuncs_asm_all.s */

/* ---- New functions (post-v0.54) ---- */

void *QJS_GetLibcOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt)
{
    return JS_GetLibcOpaque(rt);
}

void QJS_SetLibcOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *opaque)
{
    JS_SetLibcOpaque(rt, opaque);
}

int QJS_AddModuleExportList(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *m,
    __reg("a2") void *tab,
    __reg("d0") int len)
{
    return JS_AddModuleExportList(ctx, m, tab, len);
}

int QJS_SetModuleExportList(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *m,
    __reg("a2") void *tab,
    __reg("d0") int len)
{
    return JS_SetModuleExportList(ctx, m, tab, len);
}
