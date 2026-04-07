/*
 * quickjs_bridge.c — Stubs and helpers for quickjs.library bridge
 *
 * All LVO-calling bridge functions are now in assembly:
 *   bridge_asm.s, bridge_asm_batch1.s, bridge_asm_batch2.s, bridge_dpvs.s
 *
 * This file contains only:
 *   - Library init/cleanup (OpenLibrary/CloseLibrary)
 *   - Stub functions not in the library (variadic throws, etc.)
 *   - Helper functions (js_std_cmd, js_load_file, etc.)
 */

#ifdef __VBCC__
#include "amiga_compat_vbcc.h"
#endif

#include "quickjs.h"
#include "quickjs-libc.h"
#include <string.h>
#include <stdio.h>

/* amiga_force_color — color control for terminal output.
 * Was in amiga_posix_stubs.c (removed from CLI). */
int amiga_force_color = 0;

/* js_module_set_import_meta / js_std_await — these are in quickjs-libc.c
 * (now inside the library). The CLI's eval_buf uses bridge_EvalBuf under
 * QJS_USE_LIBRARY, but the non-library #else path still references these.
 * Provide stubs so the CLI links. */
int js_module_set_import_meta(JSContext *ctx, JSValueConst func_val,
                              int use_realpath, int is_main)
{
    (void)ctx; (void)func_val; (void)use_realpath; (void)is_main;
    return 0;
}

JSValue js_std_await(JSContext *ctx, JSValue obj)
{
    (void)ctx;
    return obj;
}
#include <stdlib.h>
#include <stdarg.h>
#include <exec/types.h>
#include <exec/libraries.h>

/* Library base — set by quickjs_bridge_init() */
struct Library *QJSBase = NULL;

/* ===================================================================
 * Bridge init/cleanup
 * =================================================================== */

int quickjs_bridge_init(void)
{
    extern struct Library *OpenLibrary(const char *, unsigned long);
    QJSBase = OpenLibrary("quickjs.library", 0);
    if (QJSBase) {
        fprintf(stderr, "[bridge] quickjs.library opened at %p\n", (void *)QJSBase);
    }
    return QJSBase ? 0 : -1;
}

void quickjs_bridge_cleanup(void)
{
    extern void CloseLibrary(struct Library *);
    if (QJSBase) { CloseLibrary(QJSBase); QJSBase = NULL; }
}

/* ===================================================================
 * Stub: JS_NewRuntime2 — use default allocator
 * =================================================================== */

JSRuntime *JS_NewRuntime2(const JSMallocFunctions *mf, void *opaque) {
    return JS_NewRuntime();
}

/* ===================================================================
 * Stub: JS_SetModuleLoaderFunc2 — drop check_attributes param
 * =================================================================== */

void JS_SetModuleLoaderFunc2(JSRuntime *rt,
                              JSModuleNormalizeFunc *normalize,
                              JSModuleLoaderFunc2 *loader,
                              JSModuleCheckSupportedImportAttributes *check_attrs,
                              void *opaque) {
    JS_SetModuleLoaderFunc(rt, normalize, (JSModuleLoaderFunc *)loader, opaque);
}

/* ===================================================================
 * Stub: JS_DumpMemoryUsage
 * =================================================================== */

void JS_DumpMemoryUsage(FILE *fp, const JSMemoryUsage *s, JSRuntime *rt) {
    /* No-op */
}

/* ===================================================================
 * Variadic throw functions (can't go through LVO)
 * =================================================================== */

static JSValue js_throw_error_va(JSContext *ctx, const char *fmt, va_list ap)
{
    static char buf[256];
    JSValue msg, err;

    vsnprintf(buf, sizeof(buf), fmt, ap);
    msg = JS_NewString(ctx, buf);
    if (JS_IsException(msg))
        return JS_EXCEPTION;

    err = JS_NewError(ctx);
    if (!JS_IsException(err)) {
        JS_DefinePropertyValueStr(ctx, err, "message", msg,
                                  JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    } else {
        JS_FreeValue(ctx, msg);
    }
    return JS_Throw(ctx, err);
}

JSValue JS_ThrowTypeError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt); r = js_throw_error_va(ctx, fmt, ap); va_end(ap);
    return r;
}

JSValue JS_ThrowRangeError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt); r = js_throw_error_va(ctx, fmt, ap); va_end(ap);
    return r;
}

JSValue JS_ThrowReferenceError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt); r = js_throw_error_va(ctx, fmt, ap); va_end(ap);
    return r;
}

JSValue JS_ThrowSyntaxError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt); r = js_throw_error_va(ctx, fmt, ap); va_end(ap);
    return r;
}

JSValue JS_ThrowInternalError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt); r = js_throw_error_va(ctx, fmt, ap); va_end(ap);
    return r;
}

JSValue JS_ThrowPlainError(JSContext *ctx, int error_class,
                            const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt); r = js_throw_error_va(ctx, fmt, ap); va_end(ap);
    return r;
}

/* ===================================================================
 * Module export list helpers (loop over entries)
 * =================================================================== */

/* JS_AddModuleExportList: now via LVO -1062 (bridge_asm.s) */
/* JS_SetModuleExportList: now via LVO -1068 (bridge_asm.s) */

/* ===================================================================
 * SetPropertyFunctionList — now uses LVO -900 directly (assembly
 * wrappers in both bridge and library fix the A6/__reg bugs that
 * previously caused hangs).
 * The assembly trampoline is in bridge_asm.s.
 * =================================================================== */
/* JS_SetPropertyFunctionList: now via LVO -900 (bridge_asm.s + qjsfuncs_asm_all.s) */

/* ===================================================================
 * js_std_cmd — thread state access for quickjs-libc.c
 * =================================================================== */

/* js_std_cmd — now defined in quickjs.c (engine, inside library).
 * quickjs-libc.c is also in the library, so js_std_cmd resolves
 * directly to the engine's definition accessing rt->libc_opaque.
 * The bridge no longer needs its own copy. */

/* (end of removed SPFL workaround) */

/* ===================================================================
 * Missing function stubs
 * =================================================================== */

JSValue JS_NewArrayFrom(JSContext *ctx, int64_t len, JSValue *vals) {
    int64_t i;
    JSValue arr = JS_NewArray(ctx);
    if (JS_IsException(arr)) return arr;
    for (i = 0; i < len; i++)
        JS_SetPropertyUint32(ctx, arr, (uint32_t)i, vals[i]);
    return arr;
}

JSValue JS_NewUint8Array(JSContext *ctx, uint8_t *buf, size_t len,
                          JSFreeArrayBufferDataFunc *free_func, void *opaque,
                          int is_shared) {
    return JS_NewUint8ArrayCopy(ctx, buf, len);
}

JSValue JS_NewObjectProtoClass(JSContext *ctx, JSValueConst proto, JSClassID class_id) {
    JSValue obj = JS_NewObjectClass(ctx, class_id);
    if (!JS_IsException(obj)) JS_SetPrototype(ctx, obj, proto);
    return obj;
}

JSValue JS_CallConstructor2(JSContext *ctx, JSValueConst func_obj,
                             JSValueConst new_target,
                             int argc, JSValueConst *argv) {
    return JS_CallConstructor(ctx, func_obj, argc, argv);
}

uint8_t *JS_WriteObject2(JSContext *ctx, size_t *psize, JSValueConst obj,
                          int flags, uint8_t ***psab_tab, size_t *psab_tab_len) {
    return JS_WriteObject(ctx, psize, obj, flags);
}

int JS_ToInt64Ext(JSContext *ctx, int64_t *pres, JSValueConst val) {
    return JS_ToInt64(ctx, pres, val);
}

int JS_ToIndex(JSContext *ctx, uint64_t *plen, JSValueConst val) {
    int64_t v;
    if (JS_ToInt64(ctx, &v, val)) return -1;
    if (v < 0) { JS_ThrowRangeError(ctx, "invalid array index"); return -1; }
    *plen = (uint64_t)v;
    return 0;
}

int JS_EnqueueJob(JSContext *ctx, JSJobFunc *job_func,
                   int argc, JSValueConst *argv) { return -1; }

JSValue JS_NewCFunctionData(JSContext *ctx, JSCFunctionData *func,
                             int length, int magic, int data_len,
                             JSValueConst *data) { return JS_UNDEFINED; }

void JS_ResetUncatchableError(JSContext *ctx) { }
void JS_SetUncatchableError(JSContext *ctx, JSValueConst val) { }
void JS_SetSharedArrayBufferFunctions(JSRuntime *rt,
                                       const JSSharedArrayBufferFunctions *sf) { }
void JS_SetModuleNormalizeFunc2(JSRuntime *rt,
                                 JSModuleNormalizeFunc2 *module_normalize) { }

void JS_PrintValue(JSContext *ctx, JSPrintValueWrite *write_func,
                    void *opaque, JSValueConst val,
                    const JSPrintValueOptions *options) {
    /* Minimal implementation: convert to string and write */
    const char *str;
    fprintf(stderr, "[PrintValue] called, val=%08lx%08lx\n",
            (unsigned long)(val>>32), (unsigned long)val); fflush(stderr);
    str = JS_ToCString(ctx, val);
    fprintf(stderr, "[PrintValue] str=%p '%s'\n",
            (void*)str, str ? str : "(null)"); fflush(stderr);
    if (str) {
        if (write_func) {
            write_func(opaque, str, strlen(str));
        }
        JS_FreeCString(ctx, str);
    }
}
void JS_PrintValueSetDefaultOptions(JSPrintValueOptions *options) { }
void JS_PrintValueRT(JSRuntime *rt, JSPrintValueWrite *write_func,
                      void *opaque, JSValueConst val,
                      const JSPrintValueOptions *options) { }

JSValue JS_GetModulePrivateValue(JSContext *ctx, JSModuleDef *m) {
    return JS_UNDEFINED;
}
int JS_SetModulePrivateValue(JSContext *ctx, JSModuleDef *m, JSValue val) {
    JS_FreeValue(ctx, val);
    return 0;
}

const char *JS_ToCStringLenUTF16(JSContext *ctx, size_t *plen,
                                   JSValueConst val, int cesu8) {
    return JS_ToCStringLen2(ctx, plen, val, cesu8);
}
void JS_FreeCStringRT(JSRuntime *rt, const char *ptr) { }

/* ===================================================================
 * Runtime malloc stubs (use system malloc)
 * =================================================================== */

void *js_mallocz_rt(JSRuntime *rt, size_t size) {
    void *p = malloc(size);
    if (p) memset(p, 0, size);
    return p;
}
void *js_malloc_rt(JSRuntime *rt, size_t size) { return malloc(size); }
void js_free_rt(JSRuntime *rt, void *ptr) { free(ptr); }
void *js_realloc_rt(JSRuntime *rt, void *ptr, size_t size) {
    return realloc(ptr, size);
}
size_t js_malloc_usable_size(JSContext *ctx, const void *ptr) { return 0; }
void *js_realloc2(JSContext *ctx, void *ptr, size_t size, size_t *pslack) {
    if (pslack) *pslack = 0;
    return js_realloc(ctx, ptr, size);
}
char *js_strndup(JSContext *ctx, const char *s, size_t n) {
    char *r = js_malloc(ctx, n + 1);
    if (r) { memcpy(r, s, n); r[n] = '\0'; }
    return r;
}

/* ===================================================================
 * Helpers used by quickjs-libc.c
 * =================================================================== */

int js__has_suffix(const char *str, const char *suffix) {
    size_t len = strlen(str), slen = strlen(suffix);
    if (slen > len) return 0;
    return !memcmp(str + len - slen, suffix, slen);
}

uint64_t js__hrtime_ns(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (uint64_t)tv.tv_sec * 1000000000ULL + (uint64_t)tv.tv_usec * 1000ULL;
}
