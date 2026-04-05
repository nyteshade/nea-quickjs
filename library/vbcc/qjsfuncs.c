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

/* --- Batch 2 engine externs --- */
extern JSValue JS_DupValue(JSContext *ctx, JSValue v);
extern JSValue JS_DupValueRT(JSRuntime *rt, JSValue v);
extern void JS_FreeValueRT(JSRuntime *rt, JSValue v);
extern JSValue JS_NewNumber(JSContext *ctx, double d);
extern JSValue JS_NewBigInt64(JSContext *ctx, long long v);
extern JSValue JS_NewBigUint64(JSContext *ctx, unsigned long long v);
extern JSValue JS_NewStringLen(JSContext *ctx, const char *str1, size_t len1);
extern JSValue JS_NewAtomString(JSContext *ctx, const char *str);
extern JSValue JS_ToString(JSContext *ctx, JSValue val);
extern JSValue JS_ToPropertyKey(JSContext *ctx, JSValue val);
extern const char *JS_ToCStringLen2(JSContext *ctx, size_t *plen,
                                    JSValue val1, int cesu8);
extern void JS_FreeCString(JSContext *ctx, const char *ptr);
extern int JS_ToBool(JSContext *ctx, JSValue val);
extern int JS_ToInt64(JSContext *ctx, long long *pres, JSValue val);
extern int JS_ToFloat64(JSContext *ctx, double *pres, JSValue val);
extern JSValue JS_ToNumber(JSContext *ctx, JSValue val);
extern JSValue JS_NewObject(JSContext *ctx);
extern JSValue JS_NewObjectClass(JSContext *ctx, unsigned long class_id);
extern JSValue JS_NewObjectProto(JSContext *ctx, JSValue proto);
extern JSValue JS_NewArray(JSContext *ctx);
extern int JS_IsArray(JSValue val);
extern int JS_IsFunction(JSContext *ctx, JSValue val);
extern int JS_IsConstructor(JSContext *ctx, JSValue val);
extern JSValue JS_GetGlobalObject(JSContext *ctx);
extern JSValue JS_ToObject(JSContext *ctx, JSValue val);
extern JSValue JS_Throw(JSContext *ctx, JSValue obj);
extern int JS_HasException(JSContext *ctx);
extern int JS_IsError(JSValue val);
extern JSValue JS_NewError(JSContext *ctx);
extern JSValue JS_ThrowOutOfMemory(JSContext *ctx);
extern int JS_DetectModule(const char *input, size_t input_len);
extern void *js_malloc(JSContext *ctx, size_t size);
extern void js_free(JSContext *ctx, void *ptr);
extern void *js_realloc(JSContext *ctx, void *ptr, size_t size);
extern void *js_calloc(JSContext *ctx, size_t count, size_t size);
extern void *js_mallocz(JSContext *ctx, size_t size);
extern char *js_strdup(JSContext *ctx, const char *str);

/* --- Batch 3 engine externs --- */
extern JSValue JS_GetProperty(JSContext *ctx, JSValue this_obj, unsigned long prop);
extern JSValue JS_GetPropertyUint32(JSContext *ctx, JSValue this_obj, unsigned long idx);
extern JSValue JS_GetPropertyInt64(JSContext *ctx, JSValue this_obj, long long idx);
extern JSValue JS_GetPropertyStr(JSContext *ctx, JSValue this_obj, const char *prop);
extern int JS_SetProperty(JSContext *ctx, JSValue this_obj, unsigned long prop, JSValue val);
extern int JS_SetPropertyUint32(JSContext *ctx, JSValue this_obj, unsigned long idx, JSValue val);
extern int JS_SetPropertyStr(JSContext *ctx, JSValue this_obj, const char *prop, JSValue val);
extern int JS_HasProperty(JSContext *ctx, JSValue this_obj, unsigned long prop);
extern int JS_DeleteProperty(JSContext *ctx, JSValue obj, unsigned long prop, int flags);
extern int JS_SetPrototype(JSContext *ctx, JSValue obj, JSValue proto_val);
extern JSValue JS_GetPrototype(JSContext *ctx, JSValue val);
extern int JS_GetLength(JSContext *ctx, JSValue obj, long long *pres);
extern int JS_SetLength(JSContext *ctx, JSValue obj, long long len);
extern int JS_IsExtensible(JSContext *ctx, JSValue obj);
extern int JS_PreventExtensions(JSContext *ctx, JSValue obj);
extern int JS_SealObject(JSContext *ctx, JSValue obj);
extern int JS_FreezeObject(JSContext *ctx, JSValue obj);
extern int JS_DefinePropertyValue(JSContext *ctx, JSValue this_obj,
                                   unsigned long prop, JSValue val, int flags);
extern int JS_DefinePropertyValueUint32(JSContext *ctx, JSValue this_obj,
                                         unsigned long idx, JSValue val, int flags);
extern int JS_DefinePropertyValueStr(JSContext *ctx, JSValue this_obj,
                                      const char *prop, JSValue val, int flags);
extern int JS_SetOpaque(JSValue obj, void *opaque);
extern void *JS_GetOpaque(JSValue obj, unsigned long class_id);
extern void *JS_GetOpaque2(JSContext *ctx, JSValue obj, unsigned long class_id);
extern int JS_GetOwnPropertyNames(JSContext *ctx, void **ptab,
                                   unsigned long *plen, JSValue obj, int flags);
extern void JS_FreePropertyEnum(JSContext *ctx, void *tab, unsigned long len);
extern int JS_IsInstanceOf(JSContext *ctx, JSValue val, JSValue obj);

/* --- Batch 4 engine externs --- */
#ifndef _JSATOM_DEFINED
#define _JSATOM_DEFINED
typedef unsigned long JSAtom;
#endif
extern JSAtom JS_NewAtomLen(JSContext *ctx, const char *str, size_t len);
extern JSAtom JS_NewAtom(JSContext *ctx, const char *str);
extern JSAtom JS_NewAtomUInt32(JSContext *ctx, unsigned long n);
extern JSAtom JS_DupAtom(JSContext *ctx, JSAtom v);
extern void JS_FreeAtom(JSContext *ctx, JSAtom v);
extern JSValue JS_AtomToValue(JSContext *ctx, JSAtom atom);
extern JSValue JS_AtomToString(JSContext *ctx, JSAtom atom);
extern const char *JS_AtomToCStringLen(JSContext *ctx, size_t *plen, JSAtom atom);
extern JSAtom JS_ValueToAtom(JSContext *ctx, JSValue val);
extern JSValue JS_EvalFunction(JSContext *ctx, JSValue fun_obj);
extern JSValue JS_Call(JSContext *ctx, JSValue func_obj,
                       JSValue this_obj, int argc, JSValue *argv);
extern JSValue JS_Invoke(JSContext *ctx, JSValue this_val, JSAtom atom,
                         int argc, JSValue *argv);
extern JSValue JS_CallConstructor(JSContext *ctx, JSValue func_obj,
                                  int argc, JSValue *argv);
extern JSValue JS_ParseJSON(JSContext *ctx, const char *buf, size_t buf_len,
                            const char *filename);
extern JSValue JS_JSONStringify(JSContext *ctx, JSValue obj,
                                JSValue replacer, JSValue space0);
extern unsigned char *JS_WriteObject(JSContext *ctx, size_t *psize,
                                     JSValue obj, int flags);
extern JSValue JS_ReadObject(JSContext *ctx, const unsigned char *buf,
                             size_t buf_len, int flags);
extern unsigned long JS_NewClassID(JSRuntime *rt, unsigned long *pclass_id);
extern int JS_NewClass(JSRuntime *rt, unsigned long class_id,
                       const void *class_def);
extern int JS_IsRegisteredClass(JSRuntime *rt, unsigned long class_id);
extern unsigned long JS_GetClassID(JSValue v);

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
extern JSValue JS_GetImportMeta(JSContext *ctx, JSModuleDef *m);
extern JSAtom JS_GetModuleName(JSContext *ctx, JSModuleDef *m);
extern JSValue JS_GetModuleNamespace(JSContext *ctx, JSModuleDef *m);
extern JSModuleDef *JS_NewCModule(JSContext *ctx, const char *name_str,
    JSModuleInitFunc *func);
extern int JS_AddModuleExport(JSContext *ctx, JSModuleDef *m, const char *name_str);
extern int JS_SetModuleExport(JSContext *ctx, JSModuleDef *m,
    const char *export_name, JSValue val);
extern int JS_ResolveModule(JSContext *ctx, JSValue obj);
extern JSAtom JS_GetScriptOrModuleName(JSContext *ctx, int n_stack_levels);
extern JSValue JS_LoadModule(JSContext *ctx, const char *basename, const char *filename);
extern JSValue JS_NewCFunction2(JSContext *ctx, JSCFunction *func,
    const char *name, int length, int cproto, int magic);
extern int JS_SetConstructor(JSContext *ctx, JSValue func_obj, JSValue proto);
extern int JS_SetPropertyFunctionList(JSContext *ctx, JSValue obj, const void *tab, int len);
extern int JS_IsJobPending(JSRuntime *rt);
extern int JS_ExecutePendingJob(JSRuntime *rt, JSContext **pctx);
extern JSValue JS_NewPromiseCapability(JSContext *ctx, JSValue *resolving_funcs);
extern int JS_PromiseState(JSContext *ctx, JSValue promise);
extern JSValue JS_PromiseResult(JSContext *ctx, JSValue promise);
extern int JS_IsPromise(JSValue val);
extern JSValue JS_NewArrayBufferCopy(JSContext *ctx, const unsigned char *buf, size_t len);
extern unsigned char *JS_GetArrayBuffer(JSContext *ctx, size_t *psize, JSValue obj);
extern int JS_IsArrayBuffer(JSValue obj);
extern void JS_DetachArrayBuffer(JSContext *ctx, JSValue obj);
extern unsigned char *JS_GetUint8Array(JSContext *ctx, size_t *psize, JSValue obj);
extern JSValue JS_NewUint8ArrayCopy(JSContext *ctx, const unsigned char *buf, size_t len);
extern int JS_IsDate(JSValue val);
extern int JS_IsRegExp(JSValue val);
extern int JS_IsMap(JSValue val);
extern int JS_IsSet(JSValue val);
extern JSValue JS_NewSymbol(JSContext *ctx, const char *description, int is_global);
extern void JS_SetIsHTMLDDA(JSContext *ctx, JSValue obj);
extern int JS_SetConstructorBit(JSContext *ctx, JSValue func_obj, int val);

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

/* QJS_Eval: implemented in qjsfuncs_asm.s */

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

/* ---- Batch 2: Value Management ---- */

void QJS_FreeValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr)
{
    JS_FreeValue(ctx, *val_ptr);
}

void QJS_FreeValueRT(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") JSValue *val_ptr)
{
    JS_FreeValueRT(rt, *val_ptr);
}

void QJS_DupValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr)
{
    *result = JS_DupValue(ctx, *val_ptr);
}

void QJS_DupValueRT(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSRuntime *rt,
    __reg("a2") JSValue *val_ptr)
{
    *result = JS_DupValueRT(rt, *val_ptr);
}

/* ---- Batch 2: Value Creation ---- */

void QJS_NewNumber(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") double *d_ptr)
{
    *result = JS_NewNumber(ctx, *d_ptr);
}

void QJS_NewBigInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") long long *v_ptr)
{
    *result = JS_NewBigInt64(ctx, *v_ptr);
}

void QJS_NewBigUint64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") unsigned long long *v_ptr)
{
    *result = JS_NewBigUint64(ctx, *v_ptr);
}

/* ---- Batch 2: Strings ---- */

void QJS_NewStringLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *str,
    __reg("d0") ULONG len)
{
    *result = JS_NewStringLen(ctx, str, (size_t)len);
}

void QJS_NewAtomString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *str)
{
    *result = JS_NewAtomString(ctx, str);
}

void QJS_ToString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr)
{
    *result = JS_ToString(ctx, *val_ptr);
}

void QJS_ToPropertyKey(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr)
{
    *result = JS_ToPropertyKey(ctx, *val_ptr);
}

const char *QJS_ToCStringLen2(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") ULONG *plen,
    __reg("a1") JSValue *val_ptr,
    __reg("d0") int cesu8)
{
    size_t slen;
    const char *r;
    r = JS_ToCStringLen2(ctx, plen ? &slen : NULL, *val_ptr, cesu8);
    if (plen && r)
        *plen = (ULONG)slen;
    return r;
}

void QJS_FreeCString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *ptr)
{
    JS_FreeCString(ctx, ptr);
}

/* ---- Batch 2: Conversion ---- */

int QJS_ToBool(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr)
{
    return JS_ToBool(ctx, *val_ptr);
}

int QJS_ToInt32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") long *pres,
    __reg("a1") JSValue *val_ptr)
{
    return JS_ToInt32(ctx, pres, *val_ptr);
}

int QJS_ToInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") long long *pres,
    __reg("a1") JSValue *val_ptr)
{
    return JS_ToInt64(ctx, pres, *val_ptr);
}

int QJS_ToFloat64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") double *pres,
    __reg("a1") JSValue *val_ptr)
{
    return JS_ToFloat64(ctx, pres, *val_ptr);
}

void QJS_ToNumber(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr)
{
    *result = JS_ToNumber(ctx, *val_ptr);
}

/* ---- Batch 2: Objects ---- */

void QJS_NewObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx)
{
    *result = JS_NewObject(ctx);
}

void QJS_NewObjectClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG class_id)
{
    *result = JS_NewObjectClass(ctx, (unsigned long)class_id);
}

void QJS_NewObjectProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *proto_ptr)
{
    *result = JS_NewObjectProto(ctx, *proto_ptr);
}

void QJS_NewArray(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx)
{
    *result = JS_NewArray(ctx);
}

int QJS_IsArray(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (int)JS_IsArray(*val_ptr);
}

int QJS_IsFunction(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr)
{
    return (int)JS_IsFunction(ctx, *val_ptr);
}

int QJS_IsConstructor(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr)
{
    return (int)JS_IsConstructor(ctx, *val_ptr);
}

void QJS_GetGlobalObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx)
{
    *result = JS_GetGlobalObject(ctx);
}

void QJS_ToObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr)
{
    *result = JS_ToObject(ctx, *val_ptr);
}

/* ---- Batch 2: Exceptions ---- */

void QJS_Throw(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *obj_ptr)
{
    *result = JS_Throw(ctx, *obj_ptr);
}

void QJS_GetException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx)
{
    *result = JS_GetException(ctx);
}

int QJS_HasException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx)
{
    return (int)JS_HasException(ctx);
}

int QJS_IsError(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (int)JS_IsError(*val_ptr);
}

void QJS_NewError(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx)
{
    *result = JS_NewError(ctx);
}

void QJS_ThrowOutOfMemory(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx)
{
    *result = JS_ThrowOutOfMemory(ctx);
}

/* ---- Batch 2: Detect Module ---- */

int QJS_DetectModule(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") const char *input,
    __reg("d0") ULONG input_len)
{
    return (int)JS_DetectModule(input, (size_t)input_len);
}

/* ---- Batch 2: Memory Allocation ---- */

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

/* ---- Batch 3: Property Get ---- */

void QJS_GetProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") ULONG prop)
{
    *result = JS_GetProperty(ctx, *this_ptr, (unsigned long)prop);
}

void QJS_GetPropertyUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") ULONG idx)
{
    *result = JS_GetPropertyUint32(ctx, *this_ptr, (unsigned long)idx);
}

void QJS_GetPropertyStr(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("a3") const char *prop_str)
{
    *result = JS_GetPropertyStr(ctx, *this_ptr, prop_str);
}

void QJS_GetPropertyInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") LONG idx)
{
    *result = JS_GetPropertyInt64(ctx, *this_ptr, (long long)idx);
}

/* ---- Batch 3: Property Set (engine CONSUMES val) ---- */

int QJS_SetProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop,
    __reg("a2") JSValue *val_ptr)
{
    return JS_SetProperty(ctx, *this_ptr, (unsigned long)prop, *val_ptr);
}

int QJS_SetPropertyUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG idx,
    __reg("a2") JSValue *val_ptr)
{
    return JS_SetPropertyUint32(ctx, *this_ptr, (unsigned long)idx, *val_ptr);
}

/* QJS_SetPropertyStr: implemented in qjsfuncs_asm.s */

/* ---- Batch 3: Property Query/Delete ---- */

int QJS_HasProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop)
{
    return JS_HasProperty(ctx, *this_ptr, (unsigned long)prop);
}

int QJS_DeleteProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") ULONG prop,
    __reg("d1") int flags)
{
    return JS_DeleteProperty(ctx, *obj_ptr, (unsigned long)prop, flags);
}

/* ---- Batch 3: Prototype ---- */

int QJS_SetPrototype(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("a2") JSValue *proto_ptr)
{
    return JS_SetPrototype(ctx, *obj_ptr, *proto_ptr);
}

void QJS_GetPrototype(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr)
{
    *result = JS_GetPrototype(ctx, *val_ptr);
}

/* ---- Batch 3: Length ---- */

int QJS_GetLength(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("a2") long long *pres)
{
    return JS_GetLength(ctx, *obj_ptr, pres);
}

int QJS_SetLength(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") LONG len)
{
    return JS_SetLength(ctx, *obj_ptr, (long long)len);
}

/* ---- Batch 3: Extensibility/Seal/Freeze ---- */

int QJS_IsExtensible(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr)
{
    return JS_IsExtensible(ctx, *obj_ptr);
}

int QJS_PreventExtensions(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr)
{
    return JS_PreventExtensions(ctx, *obj_ptr);
}

int QJS_SealObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr)
{
    return JS_SealObject(ctx, *obj_ptr);
}

int QJS_FreezeObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr)
{
    return JS_FreezeObject(ctx, *obj_ptr);
}

/* ---- Batch 3: Define Property (engine CONSUMES val) ---- */

int QJS_DefinePropertyValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop,
    __reg("a2") JSValue *val_ptr,
    __reg("d1") int flags)
{
    return JS_DefinePropertyValue(ctx, *this_ptr, (unsigned long)prop,
                                  *val_ptr, flags);
}

int QJS_DefinePropertyValueUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG idx,
    __reg("a2") JSValue *val_ptr,
    __reg("d1") int flags)
{
    return JS_DefinePropertyValueUint32(ctx, *this_ptr, (unsigned long)idx,
                                        *val_ptr, flags);
}

int QJS_DefinePropertyValueStr(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("a2") JSValue *val_ptr,
    __reg("a3") const char *prop_str,
    __reg("d0") int flags)
{
    return JS_DefinePropertyValueStr(ctx, *this_ptr, prop_str,
                                     *val_ptr, flags);
}

/* ---- Batch 3: Opaque ---- */

int QJS_SetOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a1") JSValue *obj_ptr,
    __reg("a0") void *opaque)
{
    return JS_SetOpaque(*obj_ptr, opaque);
}

void *QJS_GetOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *obj_ptr,
    __reg("d0") ULONG class_id)
{
    return JS_GetOpaque(*obj_ptr, (unsigned long)class_id);
}

void *QJS_GetOpaque2(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") ULONG class_id)
{
    return JS_GetOpaque2(ctx, *obj_ptr, (unsigned long)class_id);
}

/* ---- Batch 3: Own Property Names ---- */

int QJS_GetOwnPropertyNames(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void **ptab,
    __reg("a2") ULONG *plen,
    __reg("a3") JSValue *obj_ptr,
    __reg("d0") int flags)
{
    return JS_GetOwnPropertyNames(ctx, ptab,
                                  (unsigned long *)plen, *obj_ptr, flags);
}

void QJS_FreePropertyEnum(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *tab,
    __reg("d0") ULONG len)
{
    JS_FreePropertyEnum(ctx, tab, (unsigned long)len);
}

/* ---- Batch 3: InstanceOf ---- */

int QJS_IsInstanceOf(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr,
    __reg("a2") JSValue *obj_ptr)
{
    return JS_IsInstanceOf(ctx, *val_ptr, *obj_ptr);
}

/* ---- Batch 4: Atoms ---- */

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

void QJS_AtomToValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG atom)
{
    *result = JS_AtomToValue(ctx, (JSAtom)atom);
}

void QJS_AtomToString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG atom)
{
    *result = JS_AtomToString(ctx, (JSAtom)atom);
}

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

ULONG QJS_ValueToAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr)
{
    return (ULONG)JS_ValueToAtom(ctx, *val_ptr);
}

/* ---- Batch 4: Eval ---- */

void QJS_EvalFunction(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *fun_ptr)
{
    *result = JS_EvalFunction(ctx, *fun_ptr);
}

/* ---- Batch 4: Call ---- */

void QJS_Call(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *func_ptr,
    __reg("a3") JSValue *this_ptr,
    __reg("d0") int argc,
    __reg("d1") ULONG argv_addr)
{
    JSValue *argv = (JSValue *)(void *)argv_addr;
    *result = JS_Call(ctx, *func_ptr, *this_ptr, argc, argv);
}

void QJS_Invoke(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("a3") JSValue *argv,
    __reg("d0") ULONG atom,
    __reg("d1") int argc)
{
    *result = JS_Invoke(ctx, *this_ptr, (JSAtom)atom, argc, argv);
}

void QJS_CallConstructor(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *func_ptr,
    __reg("a3") JSValue *argv,
    __reg("d0") int argc)
{
    *result = JS_CallConstructor(ctx, *func_ptr, argc, argv);
}

/* ---- Batch 4: JSON ---- */

void QJS_ParseJSON(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *buf,
    __reg("a3") const char *filename,
    __reg("d0") ULONG buf_len)
{
    *result = JS_ParseJSON(ctx, buf, (size_t)buf_len, filename);
}

void QJS_JSONStringify(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *obj_ptr)
{
    JSValue undef;
    undef.u.int32 = 0;
    undef.tag = 3; /* JS_TAG_UNDEFINED */
    *result = JS_JSONStringify(ctx, *obj_ptr, undef, undef);
}

/* ---- Batch 4: Serialization ---- */

unsigned char *QJS_WriteObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") ULONG *psize,
    __reg("a2") JSValue *obj_ptr,
    __reg("d0") int flags)
{
    size_t ssize;
    unsigned char *r;
    r = JS_WriteObject(ctx, &ssize, *obj_ptr, flags);
    if (psize)
        *psize = (ULONG)ssize;
    return r;
}

void QJS_ReadObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const unsigned char *buf,
    __reg("d0") ULONG buf_len,
    __reg("d1") int flags)
{
    *result = JS_ReadObject(ctx, buf, (size_t)buf_len, flags);
}

/* ---- Batch 4: Class ---- */

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

ULONG QJS_GetClassID(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (ULONG)JS_GetClassID(*val_ptr);
}
/* ---- Batch 5: Module wrapper implementations ---- */

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

void QJS_GetImportMeta(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") void *m)
{
    *result = JS_GetImportMeta(ctx, (JSModuleDef *)m);
}

ULONG QJS_GetModuleName(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *m)
{
    return (ULONG)JS_GetModuleName(ctx, (JSModuleDef *)m);
}

void QJS_GetModuleNamespace(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") void *m)
{
    *result = JS_GetModuleNamespace(ctx, (JSModuleDef *)m);
}

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

int QJS_SetModuleExport(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *m,
    __reg("a2") const char *export_name,
    __reg("a3") JSValue *val_ptr)
{
    return JS_SetModuleExport(ctx, (JSModuleDef *)m, export_name, *val_ptr);
}

int QJS_ResolveModule(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr)
{
    return JS_ResolveModule(ctx, *obj_ptr);
}

ULONG QJS_GetScriptOrModuleName(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") int n_stack_levels)
{
    return (ULONG)JS_GetScriptOrModuleName(ctx, n_stack_levels);
}

/* ---- Batch 5: C Function wrapper implementations ---- */

void QJS_NewCFunction2(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") void *func,
    __reg("a3") const char *name,
    __reg("d0") int length,
    __reg("d1") int cproto,
    __reg("d2") int magic);
/* QJS_NewCFunction2: implemented in qjsfuncs_asm.s */

int QJS_SetConstructor(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *func_ptr,
    __reg("a2") JSValue *proto_ptr)
{
    return JS_SetConstructor(ctx, *func_ptr, *proto_ptr);
}

int QJS_SetPropertyFunctionList(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("a2") void *tab,
    __reg("d0") int len)
{
    return JS_SetPropertyFunctionList(ctx, *obj_ptr, tab, len);
}

/* ---- Batch 5: Jobs/Pending wrapper implementations ---- */

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

/* ---- Batch 5: Promise wrapper implementations ---- */

void QJS_NewPromiseCapability(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *resolving_funcs)
{
    *result = JS_NewPromiseCapability(ctx, resolving_funcs);
}

int QJS_PromiseState(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *promise_ptr)
{
    return (int)JS_PromiseState(ctx, *promise_ptr);
}

void QJS_PromiseResult(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *promise_ptr)
{
    *result = JS_PromiseResult(ctx, *promise_ptr);
}

int QJS_IsPromise(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (int)JS_IsPromise(*val_ptr);
}

/* ---- Batch 5: Callback wrapper implementations ---- */

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

/* ---- Batch 5: ArrayBuffer wrapper implementations ---- */

void QJS_NewArrayBufferCopy(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const unsigned char *buf,
    __reg("d0") ULONG len)
{
    *result = JS_NewArrayBufferCopy(ctx, buf, (size_t)len);
}

unsigned char *QJS_GetArrayBuffer(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") ULONG *psize,
    __reg("a2") JSValue *obj_ptr)
{
    size_t sz = 0;
    unsigned char *r = JS_GetArrayBuffer(ctx, &sz, *obj_ptr);
    if (psize) *psize = (ULONG)sz;
    return r;
}

int QJS_IsArrayBuffer(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (int)JS_IsArrayBuffer(*val_ptr);
}

void QJS_DetachArrayBuffer(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr)
{
    JS_DetachArrayBuffer(ctx, *obj_ptr);
}

unsigned char *QJS_GetUint8Array(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") ULONG *psize,
    __reg("a2") JSValue *obj_ptr)
{
    size_t sz = 0;
    unsigned char *r = JS_GetUint8Array(ctx, &sz, *obj_ptr);
    if (psize) *psize = (ULONG)sz;
    return r;
}

void QJS_NewUint8ArrayCopy(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const unsigned char *buf,
    __reg("d0") ULONG len)
{
    *result = JS_NewUint8ArrayCopy(ctx, buf, (size_t)len);
}

/* ---- Batch 5: Type check wrapper implementations ---- */

int QJS_IsDate(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (int)JS_IsDate(*val_ptr);
}

int QJS_IsRegExp(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (int)JS_IsRegExp(*val_ptr);
}

int QJS_IsMap(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (int)JS_IsMap(*val_ptr);
}

int QJS_IsSet(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr)
{
    return (int)JS_IsSet(*val_ptr);
}

/* ---- Batch 5: Symbol wrapper implementation ---- */

void QJS_NewSymbol(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *description,
    __reg("d0") int is_global)
{
    *result = JS_NewSymbol(ctx, description, is_global);
}

/* ---- Batch 5: NewDate wrapper implementation ---- */
/*
 * QuickJS-ng has no JS_NewDate() in its C API. We construct a Date object
 * by calling `new Date(epoch_ms)` through the engine's JS_CallConstructor.
 * The epoch_ms is passed as a double* because VBCC 68k can't pass doubles
 * in registers.
 */

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

/* ---- Batch 5: Misc wrapper implementations ---- */

void QJS_SetIsHTMLDDA(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr)
{
    JS_SetIsHTMLDDA(ctx, *obj_ptr);
}

int QJS_SetConstructorBit(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *func_ptr,
    __reg("d0") int val)
{
    return JS_SetConstructorBit(ctx, *func_ptr, val);
}

void QJS_LoadModule(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *basename,
    __reg("a3") const char *filename)
{
    *result = JS_LoadModule(ctx, basename, filename);
}
