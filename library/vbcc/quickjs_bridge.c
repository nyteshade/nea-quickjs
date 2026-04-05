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

int JS_AddModuleExportList(JSContext *ctx, JSModuleDef *m,
                            const JSCFunctionListEntry *tab, int len) {
    int i;
    for (i = 0; i < len; i++) {
        if (JS_AddModuleExport(ctx, m, tab[i].name))
            return -1;
    }
    return 0;
}

int JS_SetModuleExportList(JSContext *ctx, JSModuleDef *m,
                            const JSCFunctionListEntry *tab, int len) {
    int i;
    for (i = 0; i < len; i++) {
        JS_SetModuleExport(ctx, m, tab[i].name, JS_UNDEFINED);
    }
    return 0;
}

/* ===================================================================
 * SetPropertyFunctionList — bridge implementation (library LVO hangs)
 * =================================================================== */

int JS_SetPropertyFunctionList(JSContext *ctx, JSValueConst obj,
                                const JSCFunctionListEntry *tab, int len) {
    int i;
    for (i = 0; i < len; i++) {
        const JSCFunctionListEntry *e = &tab[i];
        JSValue val;
        switch (e->def_type) {
        case 0: /* JS_DEF_CFUNC */
            val = JS_NewCFunction2(ctx, e->u.func.cfunc.generic, e->name,
                                   e->u.func.length, e->u.func.cproto, e->magic);
            break;
        case 1: /* JS_DEF_CGETSET */
        case 5: /* JS_DEF_CGETSET_MAGIC */
            if (e->u.getset.get.generic) {
                JSCFunction *getter = e->u.getset.get.generic;
                val = getter(ctx, obj, 0, NULL);
                JS_DefinePropertyValueStr(ctx, obj, e->name, val,
                    e->prop_flags & ~JS_PROP_WRITABLE);
            }
            continue;
        case 2: /* JS_DEF_PROP_STRING */
            val = JS_NewStringLen(ctx, e->u.str, strlen(e->u.str));
            break;
        case 3: /* JS_DEF_PROP_INT32 */
            val = JS_NewInt32(ctx, e->u.i32);
            break;
        case 4: /* JS_DEF_PROP_INT64 */
            val = JS_NewInt64(ctx, e->u.i64);
            break;
        case 6: /* JS_DEF_PROP_DOUBLE */
            val = JS_NewNumber(ctx, e->u.f64);
            break;
        case 8: /* JS_DEF_PROP_UNDEFINED */
            val = JS_UNDEFINED;
            break;
        case 10: /* JS_DEF_PROP_BOOL */
            val = JS_NewBool(ctx, e->u.i32);
            break;
        default:
            continue;
        }
        JS_DefinePropertyValueStr(ctx, obj, e->name, val, e->prop_flags);
    }
    return 0;
}

/* ===================================================================
 * js_std_cmd — thread state access for quickjs-libc.c
 * =================================================================== */

uintptr_t js_std_cmd(int cmd, ...) {
    va_list ap;
    uintptr_t rv = 0;
    va_start(ap, cmd);
    switch (cmd) {
    case 0: /* GetOpaque */
        {
            JSRuntime *rt = va_arg(ap, JSRuntime *);
            rv = (uintptr_t)JS_GetRuntimeOpaque(rt);
        }
        break;
    case 1: /* SetOpaque */
        {
            JSRuntime *rt = va_arg(ap, JSRuntime *);
            void *opaque = va_arg(ap, void *);
            JS_SetRuntimeOpaque(rt, opaque);
        }
        break;
    case 2: /* ErrorBackTrace */
        {
            JSContext *ctx = va_arg(ap, JSContext *);
            JSValue *pv = va_arg(ap, JSValue *);
            *pv = JS_UNDEFINED;
        }
        break;
    default:
        break;
    }
    va_end(ap);
    return rv;
}

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
                    const JSPrintValueOptions *options) { }
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
