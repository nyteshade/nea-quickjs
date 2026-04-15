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
/* Use VBCC inline assembly syntax to avoid __reg("a6") frame
 * pointer corruption from function-pointer dispatch. */
static void __dbg_char(__reg("a6") struct ExecBase *sys,
                       __reg("d0") UBYTE c) = "\tjsr\t-516(a6)";
#define dbg_char(sys, c) __dbg_char((sys), (UBYTE)(c))

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

/* From sharedlib_posix.c — POSIX shims using dos.library for quickjs-libc */
extern void sharedlib_posix_init(struct Library *dosBase);
extern void sharedlib_posix_cleanup(void);

/* From quickjs_libc_lib.c — DOSBase for proto/dos.h inline calls */
extern void quickjs_libc_lib_init(struct Library *dosBase);
extern void quickjs_libc_lib_cleanup(void);

/* From sharedlib_stdio.c — dos.library-based stdio for quickjs-libc */
extern void sharedlib_stdio_init(void);
extern void sharedlib_stdio_cleanup(void);

/* From sharedlib_clib.c — fd table init */
extern void sharedlib_clib_init(void);

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

/* ---- _qjs_time_us — called from cutils.h for Date.now/os.now ---- */

/* Global DOSBase for time functions. NOT static — avoids BSS issues
 * that affected sharedlib_time.c's static sl_DOSBase (writes from init
 * didn't persist to reads from _qjs_time_us due to apparent per-file
 * BSS relocation problems). Using a global in qjsfuncs.c sidesteps it. */
struct Library *_qjs_DOSBase;

/* DateStamp — dos.library LVO -192 */
static struct DateStamp * __qjs_DateStamp(
    __reg("a6") struct Library *base,
    __reg("d1") struct DateStamp *ds) = "\tjsr\t-192(a6)";

static struct DateStamp _qjs_ds;

#define QJS_AMIGA_UNIX_EPOCH_DIFF 252460800L

long long _qjs_time_us(void)
{
    long sec, usec;

    if (!_qjs_DOSBase)
        return 0;

    __qjs_DateStamp(_qjs_DOSBase, &_qjs_ds);

    sec = (long)_qjs_ds.ds_Days * 86400L
        + (long)_qjs_ds.ds_Minute * 60L
        + (long)_qjs_ds.ds_Tick / 50L
        + QJS_AMIGA_UNIX_EPOCH_DIFF;
    usec = ((long)_qjs_ds.ds_Tick % 50L) * 20000L;

    return (long long)sec * 1000000LL + (long long)usec;
}

/* ---- W7: networking capability probe ----
 *
 * Opens bsdsocket.library v4 and amisslmaster.library (the versioned
 * version broker, NOT a specific amissl_v*.library — see decision in
 * Fina / library/vbcc/sharedlib_worker.c) once at library load, closes
 * them immediately, and records which succeeded in aBase->iNetCaps.
 * Never fails library load: a system with no networking libs still
 * gets a usable qjs for non-net scripts.
 *
 * AmiSSL master min-version: 5 per the v5.26 SDK
 * (sdks/AmiSSL-v5.26-SDK/Developer/include/libraries/amisslmaster.h).
 * Hardcoded to avoid pulling the SDK header into this TU. */
#define QJS_AMISSL_MASTER_MIN_VERSION 5

static void qjs_probe_net_caps(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;
    struct Library *probe;

    aBase->iNetCaps = 0;

    probe = __OpenLibrary(sys, "bsdsocket.library", 4);
    if (probe) {
        aBase->iNetCaps |= QJS_NET_TCP;
        __CloseLibrary(sys, probe);
    }

    probe = __OpenLibrary(sys, "amisslmaster.library",
                          QJS_AMISSL_MASTER_MIN_VERSION);
    if (probe) {
        aBase->iNetCaps |= QJS_NET_TLS;
        __CloseLibrary(sys, probe);
    }
}

/* QJS_GetNetCapabilities_impl — returns the cached iNetCaps bitmask.
 * Called from the asm trampoline which pushes the library base.
 * Re-probe is available via Networking.reprobe() in the qjs:net module. */
ULONG QJS_GetNetCapabilities_impl(LIBRARY_BASE_TYPE *base)
{
    if (!base) return 0;
    return base->iNetCaps;
}

/* Public helper for qjs:net reprobe — also updates iNetCaps in place. */
ULONG qjs_reprobe_net_caps(LIBRARY_BASE_TYPE *aBase)
{
    qjs_probe_net_caps(aBase);
    return aBase->iNetCaps;
}

/* ---- CustomLibInit / CustomLibCleanup ---- */

/* Global SysBase for code that uses VBCC's <proto/exec.h> inline
 * library calls (like amiga_ssl_lib.c calling OpenLibrary). */
extern struct Library *SysBase;

/* Library base accessible from within-library code that doesn't run
 * on an LVO entry (e.g. JS-callable C functions in qjs:net, js_fetch).
 * Set once in CustomLibInit; read-only afterward. */
LIBRARY_BASE_TYPE *_qjs_lib_base;

BOOL CustomLibInit(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;

    /* Set global SysBase BEFORE any code that might use proto/exec.h */
    SysBase = (struct Library *)sys;
    _qjs_lib_base = aBase;

    aBase->iDOSBase = __OpenLibrary(sys, "dos.library", 36);
    if (!aBase->iDOSBase)
        return TRUE;

    /* Set global DOSBase for _qjs_time_us (Date.now/os.now) */
    _qjs_DOSBase = aBase->iDOSBase;

    /* Init time subsystem with DOSBase for gettimeofday/DateStamp */
    sharedlib_time_init(aBase->iDOSBase);

    /* Init POSIX shim with DOSBase for file I/O, stat, getcwd, etc. */
    sharedlib_posix_init(aBase->iDOSBase);

    /* Init quickjs-libc DOSBase for proto/dos.h inline calls */
    quickjs_libc_lib_init(aBase->iDOSBase);

    /* Init stdio (fopen/fclose etc.) using dos.library — must be after posix init */
    sharedlib_stdio_init();

    /* Init fd table for open/close/read/write */
    sharedlib_clib_init();

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

    /* W7: probe networking caps (non-fatal — library loads without them) */
    qjs_probe_net_caps(aBase);

    return FALSE;
}

VOID CustomLibCleanup(LIBRARY_BASE_TYPE *aBase)
{
    struct ExecBase *sys = aBase->iSysBase;

    /* Destroy pool first — frees all engine allocations */
    AmigaPoolCleanup(aBase);

    /* Tear down time subsystem */
    sharedlib_time_cleanup();

    /* Tear down POSIX shim */
    sharedlib_posix_cleanup();

    /* Tear down stdio */
    sharedlib_stdio_cleanup();

    /* Tear down quickjs-libc DOSBase */
    quickjs_libc_lib_cleanup();

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
 * Library functions — ALL moved to assembly (qjsfuncs_asm_all.s).
 * Only _impl functions for complex wrappers remain here.
 * ================================================================== */

/* QJS_NewRuntime_impl — called from assembly, no __reg */
struct JSRuntime *QJS_NewRuntime_impl(LIBRARY_BASE_TYPE *base)
{
    return JS_NewRuntime2(&amiga_mf, (void *)base);
}

/* QJS_NewContext_impl — called from assembly, no __reg */
struct JSContext *QJS_NewContext_impl(struct JSRuntime *rt)
{
    JSContext *ctx;

    ctx = JS_NewContextRaw(rt);
    if (!ctx) return NULL;

    if (JS_AddIntrinsicBaseObjects(ctx)) goto fail;
    if (JS_AddIntrinsicDate(ctx)) goto fail;
    if (JS_AddIntrinsicEval(ctx)) goto fail;
    if (JS_AddIntrinsicRegExp(ctx)) goto fail;
    if (JS_AddIntrinsicJSON(ctx)) goto fail;
    if (JS_AddIntrinsicProxy(ctx)) goto fail;
    if (JS_AddIntrinsicMapSet(ctx)) goto fail;
    if (JS_AddIntrinsicTypedArrays(ctx)) goto fail;
    if (JS_AddIntrinsicPromise(ctx)) goto fail;
    if (JS_AddIntrinsicWeakRef(ctx)) goto fail;
    if (JS_AddIntrinsicDOMException(ctx)) goto fail;
    if (JS_AddPerformance(ctx)) goto fail;

    return ctx;

fail:
    JS_FreeContext(ctx);
    return NULL;
}

/* QJS_EvalSimple_impl — called from assembly, no __reg */
long QJS_EvalSimple_impl(
    struct JSContext *ctx,
    const char *input,
    unsigned long input_len)
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

extern JSValue JS_EvalFunction(struct JSContext *ctx, JSValue fun_obj);
extern int JS_ResolveModule(struct JSContext *ctx, JSValue obj);

/* QJS_EvalBuf — eval with module support, runs entirely in library.
 * Returns 0 on success, -1 on exception.
 * Assembly wrapper _QJS_EvalBuf in qjsfuncs_asm_all.s calls this.
 * NO __reg params — avoids VBCC A6 frame pointer corruption on JSValue locals. */
long QJS_EvalBuf_impl(
    struct JSContext *ctx,
    const char *input,
    unsigned long input_len,
    const char *filename,
    int eval_flags)
{
    JSValue val;
    int ret;

    /* For modules: compile, resolve, then execute. For scripts: direct eval. */
    if ((eval_flags & 0x03) == 1) {
        /* JS_EVAL_TYPE_MODULE: compile, resolve, execute */
        val = JS_Eval(ctx, input, (size_t)input_len, filename,
                      eval_flags | 0x20); /* JS_EVAL_FLAG_COMPILE_ONLY */
        if (!JS_IsException(val)) {
            JS_ResolveModule(ctx, val);
            val = JS_EvalFunction(ctx, val);
        }
    } else {
        val = JS_Eval(ctx, input, (size_t)input_len, filename, eval_flags);
    }
    if (JS_IsException(val)) {
        ret = -1;
    } else {
        ret = 0;
    }
    JS_FreeValue(ctx, val);
    return ret;
}

/* ALL remaining QJS_* functions are now in qjsfuncs_asm_all.s */

/* QJS_SetModuleLoader_impl — sets up the standard module loader.
 * Called from assembly, no __reg. */
extern void *js_module_loader;
extern int js_module_set_import_meta(void *ctx, JSValue func_val,
                                     int use_realpath, int is_main);

void QJS_SetModuleLoader_impl(struct JSRuntime *rt)
{
    JS_SetModuleLoaderFunc(rt, NULL,
        (void *)js_module_loader, NULL);
}

/* QJS_InstallExtended_impl — runs precompiled extended.js bytecode.
 * Installs URL, TextEncoder, TextDecoder, console.*, process, path,
 * AbortController, structuredClone, etc. as globals.  The bytecode
 * imports qjs:std and qjs:os, so this must be called AFTER
 * QJS_StdAddHelpers + std/os module init.
 *
 * Lives in the library so that every app that opens quickjs.library
 * — not just the qjs CLI — gets the full extended JS surface. */
extern const unsigned char qjsc_extended[];
extern const unsigned long qjsc_extended_size;
extern void js_std_eval_binary(struct JSContext *ctx, const unsigned char *buf,
                               unsigned long buf_len, int flags);

void QJS_InstallExtended_impl(struct JSContext *ctx)
{
    js_std_eval_binary(ctx, qjsc_extended, qjsc_extended_size, 0);
}

/* QJS_NewDate_impl — called from assembly, no __reg.
 * Composite function: uses multiple JSValue locals. */
void QJS_NewDate_impl(
    JSValue *result,
    struct JSContext *ctx,
    double *epoch_ms_ptr)
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
/* QJS_GetLibcOpaque: in qjsfuncs_asm_all.s */
/* QJS_SetLibcOpaque: in qjsfuncs_asm_all.s */
/* QJS_AddModuleExportList: in qjsfuncs_asm_all.s */
/* QJS_SetModuleExportList: in qjsfuncs_asm_all.s */
