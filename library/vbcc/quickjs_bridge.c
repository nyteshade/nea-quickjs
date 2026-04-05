/*
 * quickjs_bridge.c -- JS_* to QJS_* bridge for quickjs.library
 *
 * Provides all JS_EXTERN function symbols from quickjs.h by calling
 * the corresponding QJS_* library functions via LVO jump table.
 * Link this instead of quickjs.o/dtoa.o/libregexp.o/libunicode.o.
 *
 * At runtime, call quickjs_bridge_init() before any JS_* function.
 *
 * JSValue convention:
 *   - NAN_BOXING enabled: JSValue = uint64_t (8 bytes)
 *   - Library takes JSValue* for params, JSValue* result for returns
 *   - Bridge converts between by-value and by-pointer
 */

#ifdef __VBCC__
#include "amiga_compat_vbcc.h"
#endif

#include "quickjs.h"
#include "quickjs-libc.h"
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <exec/types.h>
#include <exec/libraries.h>

/* Library base — set by quickjs_bridge_init() */
struct Library *QJSBase = NULL;

/* A6 save/restore — LVO calls clobber A6 via __reg("a6") */
extern void bridge_save_a6(void);
extern void bridge_restore_a6(void);
#define SA6 bridge_save_a6()
#define RA6 bridge_restore_a6()

/*
 * ALL LVO call parameters must come from static memory, not the stack.
 * VBCC sets A6=QJSBase (__reg("a6")) BEFORE loading other register params.
 * Since A6 is the frame pointer, any stack-relative address (&local, param)
 * computed after A6 is clobbered points to garbage.
 *
 * Solution: shared static parameter slots. Reentrant because params are
 * loaded into CPU registers before the JSR — by the time a callback
 * could overwrite the statics, the registers are already set.
 */
static JSValue _br;                       /* JSValue result */
static JSValue _sv0, _sv1, _sv2;          /* JSValue param slots */
static void *_sp0, *_sp1, *_sp2, *_sp3;   /* pointer param slots */
static ULONG _si0, _si1, _si2;            /* integer param slots */

/* LVO call macro */
#define LVO(base, off, type) ((type)((char *)(base) - (off)))

/* Register shorthand */
#define R6  __reg("a6") void *
#define RA0 __reg("a0")
#define RA1 __reg("a1")
#define RA2 __reg("a2")
#define RA3 __reg("a3")
#define RD0 __reg("d0")
#define RD1 __reg("d1")
#define RD2 __reg("d2")

/* ===================================================================
 * Bridge init/cleanup
 * =================================================================== */

static struct Library *_bridge_open(const char *name, ULONG ver)
{
    struct ExecBase *sys = *(struct ExecBase **)4;
    typedef struct Library *(*_olt)(R6, RA1 const char *, RD0 ULONG);
    return LVO(sys, 552, _olt)((void *)sys, name, ver);
}

static void _bridge_close(struct Library *lib)
{
    struct ExecBase *sys = *(struct ExecBase **)4;
    typedef void (*_clt)(R6, RA1 struct Library *);
    LVO(sys, 414, _clt)((void *)sys, lib);
}

int quickjs_bridge_init(void)
{
    QJSBase = _bridge_open("quickjs.library", 0);
    return QJSBase ? 0 : -1;
}

void quickjs_bridge_cleanup(void)
{
    if (QJSBase) { _bridge_close(QJSBase); QJSBase = NULL; }
}

/* ===================================================================
 * 1. Runtime management (LVO -30 to -78)
 * =================================================================== */

/* JS_NewRuntime: implemented in assembly (bridge_asm*.s) */

/* JS_FreeRuntime: implemented in assembly (bridge_asm*.s) */

/* JS_NewContext: implemented in assembly (bridge_asm*.s) */

/* JS_NewContextRaw: implemented in assembly (bridge_asm*.s) */

/* JS_FreeContext: implemented in assembly (bridge_asm*.s) */

/* JS_GetVersion: implemented in assembly (bridge_asm*.s) */

/* JS_SetMemoryLimit: implemented in assembly (bridge_asm*.s) */

/* JS_SetMaxStackSize: implemented in assembly (bridge_asm*.s) */

/* JS_RunGC: implemented in assembly (bridge_asm*.s) */

/* Stub: JS_NewRuntime2 — ignore custom malloc, use default */
JSRuntime *JS_NewRuntime2(const JSMallocFunctions *mf, void *opaque) {
/* JS_NewRuntime: implemented in assembly (bridge_asm*.s) */
}

/* ===================================================================
 * 2. Intrinsics (LVO -84 to -150)
 * =================================================================== */

/* JS_AddIntrinsicBaseObjects: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicEval: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicDate: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicRegExp: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicJSON: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicProxy: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicMapSet: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicTypedArrays: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicPromise: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicWeakRef: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicDOMException: implemented in assembly (bridge_asm*.s) */

void JS_AddPerformance(JSContext *ctx) {
    typedef void (*F)(R6, RA0 void *);
    _sp0 = (void *)ctx;
    SA6; LVO(QJSBase,150,F)((void*)QJSBase, _sp0); RA6;
}

/* JS_AddIntrinsicBigInt: implemented in assembly (bridge_asm*.s) */

/* JS_AddIntrinsicRegExpCompiler: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 3. Eval (LVO -156, -162)
 * =================================================================== */

/* QJS_EvalSimple not mapped to a JS_* function */

/* JS_Eval: implemented in bridge_asm.s */

/* JS_EvalFunction: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 4. Runtime info/opaque (LVO -168 to -210)
 * =================================================================== */

/* JS_SetRuntimeInfo: implemented in assembly (bridge_asm*.s) */

/* JS_GetRuntimeOpaque: implemented in assembly (bridge_asm*.s) */

/* JS_SetRuntimeOpaque: implemented in assembly (bridge_asm*.s) */

/* JS_UpdateStackTop: implemented in assembly (bridge_asm*.s) */

/* JS_SetDumpFlags: implemented in assembly (bridge_asm*.s) */

/* JS_GetDumpFlags: implemented in assembly (bridge_asm*.s) */

/* JS_GetGCThreshold: implemented in assembly (bridge_asm*.s) */

/* JS_SetGCThreshold: implemented in assembly (bridge_asm*.s) */

/* JS_IsLiveObject: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 5. Context (LVO -222 to -240)
 * =================================================================== */

/* JS_DupContext: implemented in assembly (bridge_asm*.s) */

/* JS_GetContextOpaque: implemented in assembly (bridge_asm*.s) */

/* JS_SetContextOpaque: implemented in assembly (bridge_asm*.s) */

/* JS_GetRuntime: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 6. Class/Proto (LVO -246 to -258)
 * =================================================================== */

/* JS_SetClassProto: implemented in assembly (bridge_asm*.s) */

/* JS_GetClassProto: implemented in assembly (bridge_asm*.s) */

/* JS_GetFunctionProto: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 7. Comparison (LVO -276 to -294)
 * =================================================================== */

/* JS_IsEqual: implemented in assembly (bridge_asm*.s) */

/* JS_IsStrictEqual: implemented in assembly (bridge_asm*.s) */

/* JS_IsSameValue: implemented in assembly (bridge_asm*.s) */

/* JS_IsSameValueZero: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 8. Memory usage / finalizer (LVO -300, -306)
 * =================================================================== */

/* JS_ComputeMemoryUsage: implemented in assembly (bridge_asm*.s) */

/* JS_AddRuntimeFinalizer: implemented in assembly (bridge_asm*.s) */

/* Stub: JS_DumpMemoryUsage */
void JS_DumpMemoryUsage(FILE *fp, const JSMemoryUsage *s, JSRuntime *rt) {
    /* No-op on AmigaOS library bridge */
}

/* ===================================================================
 * 9. Value lifecycle (LVO -312 to -330)
 * =================================================================== */

/* JS_FreeValue: implemented in bridge_asm.s */

/* JS_FreeValueRT: implemented in assembly (bridge_asm*.s) */

/* JS_DupValue: implemented in assembly (bridge_asm*.s) */

/* JS_DupValueRT: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 10. Value creation (LVO -336 to -360)
 * =================================================================== */

/* JS_NewNumber: implemented in assembly (bridge_asm*.s) */

/* JS_NewBigInt64: implemented in assembly (bridge_asm*.s) */

/* JS_NewBigUint64: implemented in assembly (bridge_asm*.s) */

/* JS_NewStringLen: implemented in bridge_asm.s */

/* JS_NewAtomString: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 11. Value conversion (LVO -366 to -414)
 * =================================================================== */

/* JS_ToString: implemented in assembly (bridge_asm*.s) */

/* JS_ToPropertyKey: implemented in assembly (bridge_asm*.s) */

/* SFD: ToCStringLen2(ctx,plen,val_ptr,cesu8)(a0/a2/a1/d0) — note swapped regs */
/* JS_ToCStringLen2: implemented in assembly (bridge_asm*.s) */
                              JSValueConst val, int cesu8) {
    typedef const char *(*F)(R6, RA0 void *, RA2 void *,
                             RA1 JSValue *, RD0 int);
    _sp0 = (void *)ctx; _sp1 = (void *)plen; _sv0 = val; _si0 = (ULONG)cesu8;
    { void *_r; SA6; _r = (void *)LVO(QJSBase,378,F)((void*)QJSBase, _sp0, _sp1, &_sv0, (int)_si0); RA6; return _r; }
}

/* JS_FreeCString: implemented in assembly (bridge_asm*.s) */

/* JS_ToBool: implemented in assembly (bridge_asm*.s) */

/* SFD: ToInt32(ctx,pres,val_ptr)(a0/a2/a1) — note swapped regs */
/* JS_ToInt32: implemented in assembly (bridge_asm*.s) */

/* JS_ToInt64: implemented in assembly (bridge_asm*.s) */

/* JS_ToFloat64: implemented in assembly (bridge_asm*.s) */

/* JS_ToNumber: implemented in assembly (bridge_asm*.s) */

/* Stubs for extended conversions */
int JS_ToInt64Ext(JSContext *ctx, int64_t *pres, JSValueConst val) {
/* JS_ToInt64: implemented in assembly (bridge_asm*.s) */
}

int JS_ToIndex(JSContext *ctx, uint64_t *plen, JSValueConst val) {
    int64_t v;
    if (JS_ToInt64(ctx, &v, val)) return -1;
    if (v < 0) { JS_ThrowRangeError(ctx, "invalid array index"); return -1; }
    *plen = (uint64_t)v;
    return 0;
}

/* ===================================================================
 * 12. Object creation (LVO -420 to -456)
 * =================================================================== */

/* JS_NewObject: implemented in bridge_asm.s */

/* JS_NewObjectClass: implemented in assembly (bridge_asm*.s) */

/* JS_NewObjectProto: implemented in assembly (bridge_asm*.s) */

JSValue JS_NewObjectProtoClass(JSContext *ctx, JSValueConst proto, JSClassID class_id) {
    JSValue obj = JS_NewObjectClass(ctx, class_id);
    if (!JS_IsException(obj)) JS_SetPrototype(ctx, obj, proto);
    return obj;
}

/* JS_NewArray: implemented in bridge_asm.s */

/* JS_IsArray: implemented in assembly (bridge_asm*.s) */

/* JS_IsFunction: implemented in assembly (bridge_asm*.s) */

/* JS_IsConstructor: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 13. Global object / conversion (LVO -462 to -468)
 * =================================================================== */

/* JS_GetGlobalObject: implemented in bridge_asm.s */

/* JS_ToObject: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 14. Errors (LVO -474 to -510)
 * =================================================================== */

/* JS_Throw: implemented in assembly (bridge_asm*.s) */

/* JS_GetException: implemented in assembly (bridge_asm*.s) */

/* JS_HasException: implemented in assembly (bridge_asm*.s) */

/* JS_IsError: implemented in assembly (bridge_asm*.s) */

/* JS_NewError: implemented in assembly (bridge_asm*.s) */

/* JS_ThrowOutOfMemory: implemented in assembly (bridge_asm*.s) */

/* --- Variadic throw functions (not in library) --- */

static JSValue js_throw_error_va(JSContext *ctx, int error_class,
                                  const char *fmt, va_list ap)
{
    char buf[256];
    JSValue msg, err, proto, ctor;

    vsnprintf(buf, sizeof(buf), fmt, ap);
    msg = JS_NewString(ctx, buf);
    if (JS_IsException(msg))
        return JS_EXCEPTION;

    /* Create error: get Error constructor, call with message */
    err = JS_NewError(ctx);
    if (!JS_IsException(err)) {
/* JS_DefinePropertyValueStr: implemented in assembly (bridge_asm*.s) */
                                  JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    } else {
/* JS_FreeValue: implemented in assembly (bridge_asm*.s) */
    }
/* JS_Throw: implemented in assembly (bridge_asm*.s) */
}

JSValue JS_ThrowTypeError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt);
    r = js_throw_error_va(ctx, 0, fmt, ap);
    va_end(ap);
    return r;
}

JSValue JS_ThrowRangeError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt);
    r = js_throw_error_va(ctx, 0, fmt, ap);
    va_end(ap);
    return r;
}

JSValue JS_ThrowReferenceError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt);
    r = js_throw_error_va(ctx, 0, fmt, ap);
    va_end(ap);
    return r;
}

JSValue JS_ThrowSyntaxError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt);
    r = js_throw_error_va(ctx, 0, fmt, ap);
    va_end(ap);
    return r;
}

JSValue JS_ThrowInternalError(JSContext *ctx, const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt);
    r = js_throw_error_va(ctx, 0, fmt, ap);
    va_end(ap);
    return r;
}

JSValue JS_ThrowPlainError(JSContext *ctx, int error_class,
                            const char *fmt, ...) {
    va_list ap; JSValue r;
    va_start(ap, fmt);
    r = js_throw_error_va(ctx, error_class, fmt, ap);
    va_end(ap);
    return r;
}

/* JS_DetectModule: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 15. Memory (LVO -516 to -546)
 * =================================================================== */

/* js_malloc: implemented in assembly (bridge_asm*.s) */

/* js_free: implemented in assembly (bridge_asm*.s) */

/* js_realloc: implemented in assembly (bridge_asm*.s) */

/* js_calloc: implemented in assembly (bridge_asm*.s) */

/* js_mallocz: implemented in assembly (bridge_asm*.s) */

/* js_strdup: implemented in assembly (bridge_asm*.s) */

size_t js_malloc_usable_size(JSContext *ctx, const void *ptr) { return 0; }
void *js_realloc2(JSContext *ctx, void *ptr, size_t size, size_t *pslack) {
    if (pslack) *pslack = 0;
/* js_realloc: implemented in assembly (bridge_asm*.s) */
}
char *js_strndup(JSContext *ctx, const char *s, size_t n) {
    char *r = js_malloc(ctx, n + 1);
    if (r) { memcpy(r, s, n); r[n] = '\0'; }
    return r;
}

/* ===================================================================
 * 16. Properties (LVO -552 to -666)
 * =================================================================== */

/* JS_GetProperty: implemented in assembly (bridge_asm*.s) */

/* JS_GetPropertyUint32: implemented in assembly (bridge_asm*.s) */

/* JS_GetPropertyStr: implemented in bridge_asm.s */

/* JS_GetPropertyInt64: implemented in assembly (bridge_asm*.s) */

/* JS_SetProperty: implemented in assembly (bridge_asm*.s) */

/* JS_SetPropertyUint32: implemented in bridge_asm.s */
}

/* JS_SetPropertyStr: implemented in bridge_asm.s */

/* JS_HasProperty: implemented in assembly (bridge_asm*.s) */

/* JS_DeleteProperty: implemented in assembly (bridge_asm*.s) */

/* JS_SetPrototype: implemented in assembly (bridge_asm*.s) */

/* JS_GetPrototype: implemented in assembly (bridge_asm*.s) */

/* JS_GetLength: implemented in assembly (bridge_asm*.s) */

/* JS_SetLength: implemented in assembly (bridge_asm*.s) */

/* JS_IsExtensible: implemented in assembly (bridge_asm*.s) */

/* JS_PreventExtensions: implemented in assembly (bridge_asm*.s) */

/* JS_SealObject: implemented in assembly (bridge_asm*.s) */

/* JS_FreezeObject: implemented in assembly (bridge_asm*.s) */

/* JS_DefinePropertyValue: implemented in assembly (bridge_asm*.s) */
                            JSAtom prop, JSValue val, int flags) {
    typedef int (*F)(R6, RA0 void *, RA1 JSValue *, RD0 ULONG, RA2 JSValue *, RD1 int);
    _sp0 = (void *)ctx; _sv0 = this_obj; _si0 = (ULONG)prop; _sv1 = val; _si1 = (ULONG)flags;
    { int _r; SA6; _r = (int)LVO(QJSBase,654,F)((void*)QJSBase, _sp0, &_sv0, _si0, &_sv1, (int)_si1); RA6; return _r; }
}

/* JS_DefinePropertyValueUint32: implemented in assembly (bridge_asm*.s) */
                                  uint32_t idx, JSValue val, int flags) {
    typedef int (*F)(R6, RA0 void *, RA1 JSValue *, RD0 ULONG, RA2 JSValue *, RD1 int);
    _sp0 = (void *)ctx; _sv0 = this_obj; _si0 = (ULONG)idx; _sv1 = val; _si1 = (ULONG)flags;
    { int _r; SA6; _r = (int)LVO(QJSBase,660,F)((void*)QJSBase, _sp0, &_sv0, _si0, &_sv1, (int)_si1); RA6; return _r; }
}

/* JS_DefinePropertyValueStr is implemented in bridge_dpvs.s (assembly)
 * to avoid A6/static variable issues in the C bridge. */

/* ===================================================================
 * 17. Opaque (LVO -672 to -696)
 * =================================================================== */

/* SFD: SetOpaque(obj_ptr,opaque)(a1/a0) — note a1 first! */
/* JS_SetOpaque: implemented in assembly (bridge_asm*.s) */

/* JS_GetOpaque: implemented in assembly (bridge_asm*.s) */

/* JS_GetOpaque2: implemented in assembly (bridge_asm*.s) */

/* JS_GetOwnPropertyNames: implemented in assembly (bridge_asm*.s) */
                             uint32_t *plen, JSValueConst obj, int flags) {
    typedef int (*F)(R6, RA0 void *, RA1 void *, RA2 void *,
                     RA3 JSValue *, RD0 int);
    _sp0 = (void *)ctx; _sp1 = (void *)ptab; _sp2 = (void *)plen; _sv0 = obj; _si0 = (ULONG)flags;
    { int _r; SA6; _r = (int)LVO(QJSBase,690,F)((void*)QJSBase, _sp0, _sp1, _sp2, &_sv0, (int)_si0); RA6; return _r; }
}

/* JS_FreePropertyEnum: implemented in assembly (bridge_asm*.s) */

/* JS_IsInstanceOf: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 18. Atoms (LVO -708 to -756)
 * =================================================================== */

/* JS_NewAtomLen: implemented in assembly (bridge_asm*.s) */

/* JS_NewAtom: implemented in assembly (bridge_asm*.s) */

/* JS_NewAtomUInt32: implemented in assembly (bridge_asm*.s) */

/* JS_DupAtom: implemented in assembly (bridge_asm*.s) */

/* JS_FreeAtom: implemented in assembly (bridge_asm*.s) */

/* JS_AtomToValue: implemented in assembly (bridge_asm*.s) */

/* JS_AtomToString: implemented in assembly (bridge_asm*.s) */

/* JS_AtomToCStringLen: implemented in assembly (bridge_asm*.s) */

/* JS_AtomToCString is static inline in quickjs.h */

/* JS_ValueToAtom: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 19. Call/Invoke (LVO -768 to -792)
 * =================================================================== */

/* JS_Call: implemented in assembly (bridge_asm*.s) */
                int argc, JSValueConst *argv) {
    /* SFD: Call(result,ctx,func_ptr,this_ptr,argc,argv_addr)(a0/a1/a2/a3/d0/d1) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 void *, RA2 JSValue *,
                      RA3 JSValue *, RD0 int, RD1 ULONG);
    _sp0 = (void *)ctx; _sv0 = func_obj; _sv1 = this_obj;
    _si0 = (ULONG)argc; _si1 = (ULONG)argv;
    SA6; LVO(QJSBase,768,F)((void*)QJSBase, &_br, _sp0, &_sv0, &_sv1,
                        (int)_si0, _si1); RA6;
    return _br;
}

/* JS_Invoke: implemented in assembly (bridge_asm*.s) */

/* JS_CallConstructor: implemented in assembly (bridge_asm*.s) */

/* Stub */
JSValue JS_CallConstructor2(JSContext *ctx, JSValueConst func_obj,
                             JSValueConst new_target,
                             int argc, JSValueConst *argv) {
/* JS_CallConstructor: implemented in assembly (bridge_asm*.s) */
}

/* ===================================================================
 * 20. JSON (LVO -786 to -792)
 * =================================================================== */

/* JS_ParseJSON: implemented in assembly (bridge_asm*.s) */
                      const char *filename) {
    /* SFD: ParseJSON(result,ctx,buf,filename,buf_len)(a0/a1/a2/a3/d0) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 void *, RA2 void *,
                      RA3 void *, RD0 ULONG);
    _sp0 = (void *)ctx; _sp1 = (void *)buf; _sp2 = (void *)filename; _si0 = (ULONG)buf_len;
    SA6; LVO(QJSBase,786,F)((void*)QJSBase, &_br, _sp0, _sp1, _sp2, _si0); RA6;
    return _br;
}

/* JS_JSONStringify: implemented in assembly (bridge_asm*.s) */
                          JSValueConst replacer, JSValueConst space) {
    /* SFD simplified: JSONStringify(result,ctx,obj_ptr)(a0/a1/a2) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 void *, RA2 JSValue *);
    _sp0 = (void *)ctx; _sv0 = obj;
    SA6; LVO(QJSBase,792,F)((void*)QJSBase, &_br, _sp0, &_sv0); RA6;
    return _br;
}

/* ===================================================================
 * 21. Serialization (LVO -798 to -804)
 * =================================================================== */

/* JS_WriteObject: implemented in assembly (bridge_asm*.s) */

uint8_t *JS_WriteObject2(JSContext *ctx, size_t *psize, JSValueConst obj,
                          int flags, uint8_t ***psab_tab, size_t *psab_tab_len) {
/* JS_WriteObject: implemented in assembly (bridge_asm*.s) */
}

/* JS_ReadObject: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 22. Classes (LVO -810 to -828)
 * =================================================================== */

/* JS_NewClassID: implemented in assembly (bridge_asm*.s) */

/* JS_NewClass: implemented in assembly (bridge_asm*.s) */

/* JS_IsRegisteredClass: implemented in assembly (bridge_asm*.s) */

/* JS_GetClassID: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 23. Modules (LVO -834 to -882)
 * =================================================================== */

/* JS_SetModuleLoaderFunc: implemented in assembly (bridge_asm*.s) */
                             JSModuleNormalizeFunc *normalize,
                             JSModuleLoaderFunc *loader, void *opaque) {
    typedef void (*F)(R6, RA0 void *, RA1 void *,
                      RA2 void *, RA3 void *);
    _sp0 = (void *)rt; _sp1 = (void *)normalize; _sp2 = (void *)loader; _sp3 = (void *)opaque;
    SA6; LVO(QJSBase,834,F)((void*)QJSBase, _sp0, _sp1, _sp2, _sp3); RA6;
}

/* Stub: JS_SetModuleLoaderFunc2 — drop check_attributes param */
void JS_SetModuleLoaderFunc2(JSRuntime *rt,
                              JSModuleNormalizeFunc *normalize,
                              JSModuleLoaderFunc2 *loader,
                              JSModuleCheckSupportedImportAttributes *check_attrs,
                              void *opaque) {
/* JS_SetModuleLoaderFunc: implemented in assembly (bridge_asm*.s) */
}

/* JS_GetImportMeta: implemented in assembly (bridge_asm*.s) */

/* JS_GetModuleName: implemented in assembly (bridge_asm*.s) */

/* JS_GetModuleNamespace: implemented in assembly (bridge_asm*.s) */

/* JS_NewCModule: implemented in assembly (bridge_asm*.s) */
                            JSModuleInitFunc *func) {
    typedef JSModuleDef *(*F)(R6, RA0 void *, RA1 void *,
                              RA2 void *);
    _sp0 = (void *)ctx; _sp1 = (void *)name_str; _sp2 = (void *)func;
    { void *_r; SA6; _r = (void *)LVO(QJSBase,858,F)((void*)QJSBase, _sp0, _sp1, _sp2); RA6; return _r; }
}

/* JS_AddModuleExport: implemented in assembly (bridge_asm*.s) */

/* JS_SetModuleExport: implemented in assembly (bridge_asm*.s) */
                        const char *export_name, JSValue val) {
    typedef int (*F)(R6, RA0 void *, RA1 void *, RA2 void *,
                     RA3 JSValue *);
    _sp0 = (void *)ctx; _sp1 = (void *)m; _sp2 = (void *)export_name; _sv0 = val;
    { int _r; SA6; _r = (int)LVO(QJSBase,870,F)((void*)QJSBase, _sp0, _sp1, _sp2, &_sv0); RA6; return _r; }
}

/* JS_ResolveModule: implemented in assembly (bridge_asm*.s) */

/* JS_GetScriptOrModuleName: implemented in assembly (bridge_asm*.s) */

/* JS_LoadModule: implemented in assembly (bridge_asm*.s) */

/* Stub: AddModuleExportList — loop over entries */
int JS_AddModuleExportList(JSContext *ctx, JSModuleDef *m,
                            const JSCFunctionListEntry *tab, int len) {
    int i;
    for (i = 0; i < len; i++) {
        if (JS_AddModuleExport(ctx, m, tab[i].name))
            return -1;
    }
    return 0;
}

/* Stub: SetModuleExportList — loop */
int JS_SetModuleExportList(JSContext *ctx, JSModuleDef *m,
                            const JSCFunctionListEntry *tab, int len) {
    int i;
    for (i = 0; i < len; i++) {
        /* This is a simplification — only handles named exports */
/* JS_SetModuleExport: implemented in assembly (bridge_asm*.s) */
    }
    return 0;
}

/* Stubs for module private values */
JSValue JS_GetModulePrivateValue(JSContext *ctx, JSModuleDef *m) {
    return JS_UNDEFINED;
}
int JS_SetModulePrivateValue(JSContext *ctx, JSModuleDef *m, JSValue val) {
/* JS_FreeValue: implemented in assembly (bridge_asm*.s) */
    return 0;
}

/* ===================================================================
 * 24. C Functions (LVO -888 to -900)
 * =================================================================== */

/* JS_NewCFunction2: implemented in bridge_asm.s */

/* JS_SetConstructor: implemented in assembly (bridge_asm*.s) */

/* NOTE: Library's JS_SetPropertyFunctionList hangs when called via LVO
 * (works internally during NewContext but not from external code).
 * Workaround: implement using working primitives. */
/* JS_SetPropertyFunctionList: implemented in assembly (bridge_asm*.s) */
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
            /* Getter/setter: call getter immediately and set the value.
             * Full getter/setter support needs JS_DefineProperty which
             * isn't in the library yet. This covers read-only getters. */
            if (e->u.getset.get.generic) {
                JSCFunction *getter = e->u.getset.get.generic;
                val = getter(ctx, obj, 0, NULL);
/* JS_DefinePropertyValueStr: implemented in assembly (bridge_asm*.s) */
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
/* JS_DefinePropertyValueStr: implemented in assembly (bridge_asm*.s) */
    return JS_UNDEFINED; /* stub */
}

/* ===================================================================
 * 25. Job/Promise (LVO -906 to -954)
 * =================================================================== */

/* JS_IsJobPending: implemented in assembly (bridge_asm*.s) */

/* JS_ExecutePendingJob: implemented in assembly (bridge_asm*.s) */

/* JS_NewPromiseCapability: implemented in assembly (bridge_asm*.s) */

/* JS_PromiseState: implemented in assembly (bridge_asm*.s) */

/* JS_PromiseResult: implemented in assembly (bridge_asm*.s) */

/* JS_IsPromise: implemented in assembly (bridge_asm*.s) */

/* JS_SetInterruptHandler: implemented in assembly (bridge_asm*.s) */

/* JS_SetHostPromiseRejectionTracker: implemented in assembly (bridge_asm*.s) */
                                        JSHostPromiseRejectionTracker *cb,
                                        void *opaque) {
    typedef void (*F)(R6, RA0 void *, RA1 void *, RA2 void *);
    _sp0 = (void *)rt; _sp1 = (void *)cb; _sp2 = (void *)opaque;
    SA6; LVO(QJSBase,948,F)((void*)QJSBase, _sp0, _sp1, _sp2); RA6;
}

/* JS_SetCanBlock: implemented in assembly (bridge_asm*.s) */

/* Stub */
int JS_EnqueueJob(JSContext *ctx, JSJobFunc *job_func,
                   int argc, JSValueConst *argv) {
    return -1;
}

/* ===================================================================
 * 26. ArrayBuffer / TypedArrays (LVO -960 to -990)
 * =================================================================== */

/* JS_NewArrayBufferCopy: implemented in assembly (bridge_asm*.s) */

/* JS_GetArrayBuffer: implemented in assembly (bridge_asm*.s) */

/* JS_IsArrayBuffer: implemented in assembly (bridge_asm*.s) */

/* JS_DetachArrayBuffer: implemented in assembly (bridge_asm*.s) */

/* JS_GetUint8Array: implemented in assembly (bridge_asm*.s) */

/* JS_NewUint8ArrayCopy: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 27. Type checks (LVO -996 to -1014)
 * =================================================================== */

/* JS_IsDate: implemented in assembly (bridge_asm*.s) */

/* JS_IsRegExp: implemented in assembly (bridge_asm*.s) */

/* JS_IsMap: implemented in assembly (bridge_asm*.s) */

/* JS_IsSet: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 28. Symbol / Date / misc (LVO -1020 to -1038)
 * =================================================================== */

/* JS_NewSymbol: implemented in assembly (bridge_asm*.s) */

/* JS_SetIsHTMLDDA: implemented in assembly (bridge_asm*.s) */

/* JS_SetConstructorBit: implemented in assembly (bridge_asm*.s) */

/* ===================================================================
 * 29. Remaining stubs for functions not in library
 * =================================================================== */

void JS_ResetUncatchableError(JSContext *ctx) { /* stub */ }
void JS_SetUncatchableError(JSContext *ctx, JSValueConst val, int flag) { /* stub */ }

int JS_SetSharedArrayBufferFunctions(JSRuntime *rt,
                                      const JSSharedArrayBufferFunctions *sf) {
    return 0;
}

void JS_SetModuleNormalizeFunc2(JSRuntime *rt,
                                 JSModuleNormalizeFunc2 *module_normalize) {
    /* stub */
}

JSValue JS_PrintValue(JSContext *ctx, FILE *fp, JSValueConst val,
                       const JSPrintValueOptions *options) {
    return JS_UNDEFINED;
}

void JS_PrintValueSetDefaultOptions(const JSPrintValueOptions *options) { }

JSValue JS_PrintValueRT(JSRuntime *rt, FILE *fp, JSValueConst val,
                          const JSPrintValueOptions *options) {
    return JS_UNDEFINED;
}

/* js_load_file — provided by quickjs-libc.c, not needed here */
#if 0
uint8_t *js_load_file(JSContext *ctx, size_t *pbuf_len, const char *filename) {
    FILE *f;
    uint8_t *buf;
    long lret;

    f = fopen(filename, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    lret = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (lret < 0 || lret == LONG_MAX) { fclose(f); return NULL; }
    *pbuf_len = (size_t)lret;
    buf = js_malloc(ctx, *pbuf_len + 1);
    if (!buf) { fclose(f); return NULL; }
    if (fread(buf, 1, *pbuf_len, f) != *pbuf_len) {
/* js_free: implemented in assembly (bridge_asm*.s) */
        fclose(f);
        return NULL;
    }
    buf[*pbuf_len] = '\0';
    fclose(f);
    return buf;
}
#endif

/* js__has_suffix helper */
int js__has_suffix(const char *str, const char *suffix) {
    size_t len = strlen(str), slen = strlen(suffix);
    if (slen > len) return 0;
    return !memcmp(str + len - slen, suffix, slen);
}

/* js__hrtime_ns — used by event loop timing */
uint64_t js__hrtime_ns(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (uint64_t)tv.tv_sec * 1000000000ULL + (uint64_t)tv.tv_usec * 1000ULL;
}

/* === Missing function stubs (not in library) === */

JSValue JS_NewArrayFrom(JSContext *ctx, int64_t len, JSValue *vals) {
    int64_t i;
    JSValue arr = JS_NewArray(ctx);
    if (JS_IsException(arr)) return arr;
    for (i = 0; i < len; i++)
/* JS_SetPropertyUint32: implemented in assembly (bridge_asm*.s) */
    return arr;
}

JSValue JS_NewUint8Array(JSContext *ctx, uint8_t *buf, size_t len,
                          JSFreeArrayBufferDataFunc *free_func, void *opaque,
                          int is_shared) {
/* JS_NewUint8ArrayCopy: implemented in assembly (bridge_asm*.s) */
}

/* js_std_cmd dispatches GetOpaque/SetOpaque/ErrorBackTrace for quickjs-libc.
 * The real implementation is in quickjs.c (inside the library) and accesses
 * rt->libc_opaque. We implement it using the bridge's JS_Get/SetRuntimeOpaque. */
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
/* JS_SetRuntimeOpaque: implemented in assembly (bridge_asm*.s) */
        }
        break;
    case 2: /* ErrorBackTrace — not easily implemented via bridge */
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

const char *JS_ToCStringLenUTF16(JSContext *ctx, size_t *plen,
                                   JSValueConst val, int cesu8) {
/* JS_ToCStringLen2: implemented in assembly (bridge_asm*.s) */
}
void JS_FreeCStringRT(JSRuntime *rt, const char *ptr) { /* stub */ }
