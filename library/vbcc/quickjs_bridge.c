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

static JSValue _br; /* shared JSValue result - must be static, not stack-local */

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

JSRuntime *JS_NewRuntime(void) {
    typedef JSRuntime *(*F)(R6);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,30,F)((void*)QJSBase); RA6; return _r; }
}

void JS_FreeRuntime(JSRuntime *rt) {
    typedef void (*F)(R6, RA0 JSRuntime *);
    SA6; LVO(QJSBase,36,F)((void*)QJSBase, rt); RA6;
}

JSContext *JS_NewContext(JSRuntime *rt) {
    typedef JSContext *(*F)(R6, RA0 JSRuntime *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,42,F)((void*)QJSBase, rt); RA6; return _r; }
}

JSContext *JS_NewContextRaw(JSRuntime *rt) {
    typedef JSContext *(*F)(R6, RA0 JSRuntime *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,48,F)((void*)QJSBase, rt); RA6; return _r; }
}

void JS_FreeContext(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,54,F)((void*)QJSBase, ctx); RA6;
}

const char *JS_GetVersion(void) {
    typedef const char *(*F)(R6);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,60,F)((void*)QJSBase); RA6; return _r; }
}

void JS_SetMemoryLimit(JSRuntime *rt, size_t limit) {
    typedef void (*F)(R6, RA0 JSRuntime *, RD0 ULONG);
    SA6; LVO(QJSBase,66,F)((void*)QJSBase, rt, (ULONG)limit); RA6;
}

void JS_SetMaxStackSize(JSRuntime *rt, size_t stack_size) {
    typedef void (*F)(R6, RA0 JSRuntime *, RD0 ULONG);
    SA6; LVO(QJSBase,72,F)((void*)QJSBase, rt, (ULONG)stack_size); RA6;
}

void JS_RunGC(JSRuntime *rt) {
    typedef void (*F)(R6, RA0 JSRuntime *);
    SA6; LVO(QJSBase,78,F)((void*)QJSBase, rt); RA6;
}

/* Stub: JS_NewRuntime2 — ignore custom malloc, use default */
JSRuntime *JS_NewRuntime2(const JSMallocFunctions *mf, void *opaque) {
    return JS_NewRuntime();
}

/* ===================================================================
 * 2. Intrinsics (LVO -84 to -150)
 * =================================================================== */

void JS_AddIntrinsicBaseObjects(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,84,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicEval(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,90,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicDate(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,96,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicRegExp(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,102,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicJSON(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,108,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicProxy(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,114,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicMapSet(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,120,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicTypedArrays(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,126,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicPromise(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,132,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicWeakRef(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,138,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicDOMException(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,144,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddPerformance(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,150,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicBigInt(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,264,F)((void*)QJSBase, ctx); RA6;
}

void JS_AddIntrinsicRegExpCompiler(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSContext *);
    SA6; LVO(QJSBase,270,F)((void*)QJSBase, ctx); RA6;
}

/* ===================================================================
 * 3. Eval (LVO -156, -162)
 * =================================================================== */

/* QJS_EvalSimple not mapped to a JS_* function */

JSValue JS_Eval(JSContext *ctx, const char *input, size_t input_len,
                const char *filename, int eval_flags) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const char *,
                      RD0 ULONG, RA3 const char *, RD1 int);
    LVO(QJSBase,162,F)((void*)QJSBase, &_br, ctx, input,
                        (ULONG)input_len, filename, eval_flags);
    return _br;
}

JSValue JS_EvalFunction(JSContext *ctx, JSValue fun_obj) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,762,F)((void*)QJSBase, &_br, ctx, &fun_obj); RA6;
    return _br;
}

/* ===================================================================
 * 4. Runtime info/opaque (LVO -168 to -210)
 * =================================================================== */

void JS_SetRuntimeInfo(JSRuntime *rt, const char *info) {
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 const char *);
    SA6; LVO(QJSBase,168,F)((void*)QJSBase, rt, info); RA6;
}

void *JS_GetRuntimeOpaque(JSRuntime *rt) {
    typedef void *(*F)(R6, RA0 JSRuntime *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,174,F)((void*)QJSBase, rt); RA6; return _r; }
}

void JS_SetRuntimeOpaque(JSRuntime *rt, void *opaque) {
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 void *);
    SA6; LVO(QJSBase,180,F)((void*)QJSBase, rt, opaque); RA6;
}

void JS_UpdateStackTop(JSRuntime *rt) {
    typedef void (*F)(R6, RA0 JSRuntime *);
    SA6; LVO(QJSBase,186,F)((void*)QJSBase, rt); RA6;
}

void JS_SetDumpFlags(JSRuntime *rt, uint64_t flags) {
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 uint64_t *);
    SA6; LVO(QJSBase,192,F)((void*)QJSBase, rt, &flags); RA6;
}

uint64_t JS_GetDumpFlags(JSRuntime *rt) {
    uint64_t result;
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 uint64_t *);
    SA6; LVO(QJSBase,198,F)((void*)QJSBase, rt, &result); RA6;
    return result;
}

size_t JS_GetGCThreshold(JSRuntime *rt) {
    typedef ULONG (*F)(R6, RA0 JSRuntime *);
    { int _r; SA6; _r = (int)(size_t)LVO(QJSBase,204,F)((void*)QJSBase, rt); RA6; return _r; }
}

void JS_SetGCThreshold(JSRuntime *rt, size_t threshold) {
    typedef void (*F)(R6, RA0 JSRuntime *, RD0 ULONG);
    SA6; LVO(QJSBase,210,F)((void*)QJSBase, rt, (ULONG)threshold); RA6;
}

int JS_IsLiveObject(JSRuntime *rt, JSValueConst obj) {
    typedef int (*F)(R6, RA0 JSRuntime *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,216,F)((void*)QJSBase, rt, &obj); RA6; return _r; }
}

/* ===================================================================
 * 5. Context (LVO -222 to -240)
 * =================================================================== */

JSContext *JS_DupContext(JSContext *ctx) {
    typedef JSContext *(*F)(R6, RA0 JSContext *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,222,F)((void*)QJSBase, ctx); RA6; return _r; }
}

void *JS_GetContextOpaque(JSContext *ctx) {
    typedef void *(*F)(R6, RA0 JSContext *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,228,F)((void*)QJSBase, ctx); RA6; return _r; }
}

void JS_SetContextOpaque(JSContext *ctx, void *opaque) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 void *);
    SA6; LVO(QJSBase,234,F)((void*)QJSBase, ctx, opaque); RA6;
}

JSRuntime *JS_GetRuntime(JSContext *ctx) {
    typedef JSRuntime *(*F)(R6, RA0 JSContext *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,240,F)((void*)QJSBase, ctx); RA6; return _r; }
}

/* ===================================================================
 * 6. Class/Proto (LVO -246 to -258)
 * =================================================================== */

void JS_SetClassProto(JSContext *ctx, JSClassID class_id, JSValue obj) {
    typedef void (*F)(R6, RA0 JSContext *, RD0 ULONG, RA2 JSValue *);
    SA6; LVO(QJSBase,246,F)((void*)QJSBase, ctx, (ULONG)class_id, &obj); RA6;
}

JSValue JS_GetClassProto(JSContext *ctx, JSClassID class_id) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RD0 ULONG);
    SA6; LVO(QJSBase,252,F)((void*)QJSBase, &_br, ctx, (ULONG)class_id); RA6;
    return _br;
}

JSValue JS_GetFunctionProto(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
    SA6; LVO(QJSBase,258,F)((void*)QJSBase, &_br, ctx); RA6;
    return _br;
}

/* ===================================================================
 * 7. Comparison (LVO -276 to -294)
 * =================================================================== */

int JS_IsEqual(JSContext *ctx, JSValueConst op1, JSValueConst op2) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,276,F)((void*)QJSBase, ctx, &op1, &op2); RA6; return _r; }
}

int JS_IsStrictEqual(JSContext *ctx, JSValueConst op1, JSValueConst op2) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,282,F)((void*)QJSBase, ctx, &op1, &op2); RA6; return _r; }
}

int JS_IsSameValue(JSContext *ctx, JSValueConst op1, JSValueConst op2) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,288,F)((void*)QJSBase, ctx, &op1, &op2); RA6; return _r; }
}

int JS_IsSameValueZero(JSContext *ctx, JSValueConst op1, JSValueConst op2) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,294,F)((void*)QJSBase, ctx, &op1, &op2); RA6; return _r; }
}

/* ===================================================================
 * 8. Memory usage / finalizer (LVO -300, -306)
 * =================================================================== */

void JS_ComputeMemoryUsage(JSRuntime *rt, JSMemoryUsage *s) {
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 JSMemoryUsage *);
    SA6; LVO(QJSBase,300,F)((void*)QJSBase, rt, s); RA6;
}

int JS_AddRuntimeFinalizer(JSRuntime *rt,
                           JSRuntimeFinalizer *finalizer, void *arg) {
    typedef int (*F)(R6, RA0 JSRuntime *, RA1 JSRuntimeFinalizer *, RA2 void *);
    { int _r; SA6; _r = (int)LVO(QJSBase,306,F)((void*)QJSBase, rt, finalizer, arg); RA6; return _r; }
}

/* Stub: JS_DumpMemoryUsage */
void JS_DumpMemoryUsage(FILE *fp, const JSMemoryUsage *s, JSRuntime *rt) {
    /* No-op on AmigaOS library bridge */
}

/* ===================================================================
 * 9. Value lifecycle (LVO -312 to -330)
 * =================================================================== */

void JS_FreeValue(JSContext *ctx, JSValue val) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    SA6; LVO(QJSBase,312,F)((void*)QJSBase, ctx, &val); RA6;
}

void JS_FreeValueRT(JSRuntime *rt, JSValue val) {
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 JSValue *);
    SA6; LVO(QJSBase,318,F)((void*)QJSBase, rt, &val); RA6;
}

JSValue JS_DupValue(JSContext *ctx, JSValueConst val) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,324,F)((void*)QJSBase, &_br, ctx, &val); RA6;
    return _br;
}

JSValue JS_DupValueRT(JSRuntime *rt, JSValueConst val) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSRuntime *, RA2 JSValue *);
    SA6; LVO(QJSBase,330,F)((void*)QJSBase, &_br, rt, &val); RA6;
    return _br;
}

/* ===================================================================
 * 10. Value creation (LVO -336 to -360)
 * =================================================================== */

JSValue JS_NewNumber(JSContext *ctx, double d) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 double *);
    SA6; LVO(QJSBase,336,F)((void*)QJSBase, &_br, ctx, &d); RA6;
    return _br;
}

JSValue JS_NewBigInt64(JSContext *ctx, int64_t v) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 int64_t *);
    SA6; LVO(QJSBase,342,F)((void*)QJSBase, &_br, ctx, &v); RA6;
    return _br;
}

JSValue JS_NewBigUint64(JSContext *ctx, uint64_t v) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 uint64_t *);
    SA6; LVO(QJSBase,348,F)((void*)QJSBase, &_br, ctx, &v); RA6;
    return _br;
}

JSValue JS_NewStringLen(JSContext *ctx, const char *str, size_t len) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const char *, RD0 ULONG);
    SA6; LVO(QJSBase,354,F)((void*)QJSBase, &_br, ctx, str, (ULONG)len); RA6;
    return _br;
}

JSValue JS_NewAtomString(JSContext *ctx, const char *str) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const char *);
    SA6; LVO(QJSBase,360,F)((void*)QJSBase, &_br, ctx, str); RA6;
    return _br;
}

/* ===================================================================
 * 11. Value conversion (LVO -366 to -414)
 * =================================================================== */

JSValue JS_ToString(JSContext *ctx, JSValueConst val) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,366,F)((void*)QJSBase, &_br, ctx, &val); RA6;
    return _br;
}

JSValue JS_ToPropertyKey(JSContext *ctx, JSValueConst val) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,372,F)((void*)QJSBase, &_br, ctx, &val); RA6;
    return _br;
}

/* SFD: ToCStringLen2(ctx,plen,val_ptr,cesu8)(a0/a2/a1/d0) — note swapped regs */
const char *JS_ToCStringLen2(JSContext *ctx, size_t *plen,
                              JSValueConst val, int cesu8) {
    typedef const char *(*F)(R6, RA0 JSContext *, RA2 size_t *,
                             RA1 JSValue *, RD0 int);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,378,F)((void*)QJSBase, ctx, plen, &val, cesu8); RA6; return _r; }
}

void JS_FreeCString(JSContext *ctx, const char *ptr) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 const char *);
    SA6; LVO(QJSBase,384,F)((void*)QJSBase, ctx, ptr); RA6;
}

int JS_ToBool(JSContext *ctx, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,390,F)((void*)QJSBase, ctx, &val); RA6; return _r; }
}

/* SFD: ToInt32(ctx,pres,val_ptr)(a0/a2/a1) — note swapped regs */
int JS_ToInt32(JSContext *ctx, int32_t *pres, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSContext *, RA2 int32_t *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,396,F)((void*)QJSBase, ctx, pres, &val); RA6; return _r; }
}

int JS_ToInt64(JSContext *ctx, int64_t *pres, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSContext *, RA2 int64_t *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,402,F)((void*)QJSBase, ctx, pres, &val); RA6; return _r; }
}

int JS_ToFloat64(JSContext *ctx, double *pres, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSContext *, RA2 double *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,408,F)((void*)QJSBase, ctx, pres, &val); RA6; return _r; }
}

JSValue JS_ToNumber(JSContext *ctx, JSValueConst val) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,414,F)((void*)QJSBase, &_br, ctx, &val); RA6;
    return _br;
}

/* Stubs for extended conversions */
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

/* ===================================================================
 * 12. Object creation (LVO -420 to -456)
 * =================================================================== */

JSValue JS_NewObject(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
    SA6; LVO(QJSBase,420,F)((void*)QJSBase, &_br, ctx); RA6;
    return _br;
}

JSValue JS_NewObjectClass(JSContext *ctx, int class_id) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RD0 int);
    SA6; LVO(QJSBase,426,F)((void*)QJSBase, &_br, ctx, class_id); RA6;
    return _br;
}

JSValue JS_NewObjectProto(JSContext *ctx, JSValueConst proto) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,432,F)((void*)QJSBase, &_br, ctx, &proto); RA6;
    return _br;
}

JSValue JS_NewObjectProtoClass(JSContext *ctx, JSValueConst proto, JSClassID class_id) {
    JSValue obj = JS_NewObjectClass(ctx, class_id);
    if (!JS_IsException(obj)) JS_SetPrototype(ctx, obj, proto);
    return obj;
}

JSValue JS_NewArray(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
    SA6; LVO(QJSBase,438,F)((void*)QJSBase, &_br, ctx); RA6;
    return _br;
}

int JS_IsArray(JSContext *ctx, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,444,F)((void*)QJSBase, &val); RA6; return _r; }
}

int JS_IsFunction(JSContext *ctx, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,450,F)((void*)QJSBase, ctx, &val); RA6; return _r; }
}

int JS_IsConstructor(JSContext *ctx, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,456,F)((void*)QJSBase, ctx, &val); RA6; return _r; }
}

/* ===================================================================
 * 13. Global object / conversion (LVO -462 to -468)
 * =================================================================== */

JSValue JS_GetGlobalObject(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
    SA6; LVO(QJSBase,462,F)((void*)QJSBase, &_br, ctx); RA6;
    return _br;
}

JSValue JS_ToObject(JSContext *ctx, JSValueConst val) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,468,F)((void*)QJSBase, &_br, ctx, &val); RA6;
    return _br;
}

/* ===================================================================
 * 14. Errors (LVO -474 to -510)
 * =================================================================== */

JSValue JS_Throw(JSContext *ctx, JSValue obj) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,474,F)((void*)QJSBase, &_br, ctx, &obj); RA6;
    return _br;
}

JSValue JS_GetException(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
    SA6; LVO(QJSBase,480,F)((void*)QJSBase, &_br, ctx); RA6;
    return _br;
}

int JS_HasException(JSContext *ctx) {
    typedef int (*F)(R6, RA0 JSContext *);
    { int _r; SA6; _r = (int)LVO(QJSBase,486,F)((void*)QJSBase, ctx); RA6; return _r; }
}

int JS_IsError(JSContext *ctx, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,492,F)((void*)QJSBase, &val); RA6; return _r; }
}

JSValue JS_NewError(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
    SA6; LVO(QJSBase,498,F)((void*)QJSBase, &_br, ctx); RA6;
    return _br;
}

JSValue JS_ThrowOutOfMemory(JSContext *ctx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
    SA6; LVO(QJSBase,504,F)((void*)QJSBase, &_br, ctx); RA6;
    return _br;
}

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
        JS_DefinePropertyValueStr(ctx, err, "message", msg,
                                  JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    } else {
        JS_FreeValue(ctx, msg);
    }
    return JS_Throw(ctx, err);
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

int JS_DetectModule(const char *input, size_t input_len) {
    typedef int (*F)(R6, RA0 const char *, RD0 ULONG);
    { int _r; SA6; _r = (int)LVO(QJSBase,510,F)((void*)QJSBase, input, (ULONG)input_len); RA6; return _r; }
}

/* ===================================================================
 * 15. Memory (LVO -516 to -546)
 * =================================================================== */

void *js_malloc(JSContext *ctx, size_t size) {
    typedef void *(*F)(R6, RA0 JSContext *, RD0 ULONG);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,516,F)((void*)QJSBase, ctx, (ULONG)size); RA6; return _r; }
}

void js_free(JSContext *ctx, void *ptr) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 void *);
    SA6; LVO(QJSBase,522,F)((void*)QJSBase, ctx, ptr); RA6;
}

void *js_realloc(JSContext *ctx, void *ptr, size_t size) {
    typedef void *(*F)(R6, RA0 JSContext *, RA1 void *, RD0 ULONG);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,528,F)((void*)QJSBase, ctx, ptr, (ULONG)size); RA6; return _r; }
}

void *js_calloc(JSContext *ctx, size_t count, size_t size) {
    typedef void *(*F)(R6, RA0 JSContext *, RD0 ULONG, RD1 ULONG);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,534,F)((void*)QJSBase, ctx, (ULONG)count, (ULONG)size); RA6; return _r; }
}

void *js_mallocz(JSContext *ctx, size_t size) {
    typedef void *(*F)(R6, RA0 JSContext *, RD0 ULONG);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,540,F)((void*)QJSBase, ctx, (ULONG)size); RA6; return _r; }
}

char *js_strdup(JSContext *ctx, const char *str) {
    typedef char *(*F)(R6, RA0 JSContext *, RA1 const char *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,546,F)((void*)QJSBase, ctx, str); RA6; return _r; }
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
 * 16. Properties (LVO -552 to -666)
 * =================================================================== */

JSValue JS_GetProperty(JSContext *ctx, JSValueConst this_obj, JSAtom prop) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *, RD0 ULONG);
    SA6; LVO(QJSBase,552,F)((void*)QJSBase, &_br, ctx, &this_obj, (ULONG)prop); RA6;
    return _br;
}

JSValue JS_GetPropertyUint32(JSContext *ctx, JSValueConst this_obj, uint32_t idx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *, RD0 ULONG);
    SA6; LVO(QJSBase,558,F)((void*)QJSBase, &_br, ctx, &this_obj, idx); RA6;
    return _br;
}

JSValue JS_GetPropertyStr(JSContext *ctx, JSValueConst this_obj, const char *prop) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *, RA3 const char *);
    SA6; LVO(QJSBase,564,F)((void*)QJSBase, &_br, ctx, &this_obj, prop); RA6;
    return _br;
}

JSValue JS_GetPropertyInt64(JSContext *ctx, JSValueConst this_obj, int64_t idx) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *, RD0 LONG);
    SA6; LVO(QJSBase,570,F)((void*)QJSBase, &_br, ctx, &this_obj, (LONG)idx); RA6;
    return _br;
}

int JS_SetProperty(JSContext *ctx, JSValueConst this_obj, JSAtom prop, JSValue val) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 ULONG, RA2 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,576,F)((void*)QJSBase, ctx, &this_obj, (ULONG)prop, &val); RA6; return _r; }
}

int JS_SetPropertyUint32(JSContext *ctx, JSValueConst this_obj, uint32_t idx, JSValue val) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 ULONG, RA2 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,582,F)((void*)QJSBase, ctx, &this_obj, idx, &val); RA6; return _r; }
}

int JS_SetPropertyStr(JSContext *ctx, JSValueConst this_obj, const char *prop, JSValue val) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 const char *, RA3 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,588,F)((void*)QJSBase, ctx, &this_obj, prop, &val); RA6; return _r; }
}

int JS_HasProperty(JSContext *ctx, JSValueConst this_obj, JSAtom prop) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 ULONG);
    { int _r; SA6; _r = (int)LVO(QJSBase,594,F)((void*)QJSBase, ctx, &this_obj, (ULONG)prop); RA6; return _r; }
}

int JS_DeleteProperty(JSContext *ctx, JSValueConst obj, JSAtom prop, int flags) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 ULONG, RD1 int);
    { int _r; SA6; _r = (int)LVO(QJSBase,600,F)((void*)QJSBase, ctx, &obj, (ULONG)prop, flags); RA6; return _r; }
}

int JS_SetPrototype(JSContext *ctx, JSValueConst obj, JSValueConst proto) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,606,F)((void*)QJSBase, ctx, &obj, &proto); RA6; return _r; }
}

JSValue JS_GetPrototype(JSContext *ctx, JSValueConst val) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,612,F)((void*)QJSBase, &_br, ctx, &val); RA6;
    return _br;
}

int JS_GetLength(JSContext *ctx, JSValueConst obj, int64_t *pres) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 int64_t *);
    { int _r; SA6; _r = (int)LVO(QJSBase,618,F)((void*)QJSBase, ctx, &obj, pres); RA6; return _r; }
}

int JS_SetLength(JSContext *ctx, JSValueConst obj, int64_t len) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 LONG);
    { int _r; SA6; _r = (int)LVO(QJSBase,624,F)((void*)QJSBase, ctx, &obj, (LONG)len); RA6; return _r; }
}

int JS_IsExtensible(JSContext *ctx, JSValueConst obj) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,630,F)((void*)QJSBase, ctx, &obj); RA6; return _r; }
}

int JS_PreventExtensions(JSContext *ctx, JSValueConst obj) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,636,F)((void*)QJSBase, ctx, &obj); RA6; return _r; }
}

int JS_SealObject(JSContext *ctx, JSValueConst obj) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,642,F)((void*)QJSBase, ctx, &obj); RA6; return _r; }
}

int JS_FreezeObject(JSContext *ctx, JSValueConst obj) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,648,F)((void*)QJSBase, ctx, &obj); RA6; return _r; }
}

int JS_DefinePropertyValue(JSContext *ctx, JSValueConst this_obj,
                            JSAtom prop, JSValue val, int flags) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 ULONG, RA2 JSValue *, RD1 int);
    { int _r; SA6; _r = (int)LVO(QJSBase,654,F)((void*)QJSBase, ctx, &this_obj, (ULONG)prop, &val, flags); RA6; return _r; }
}

int JS_DefinePropertyValueUint32(JSContext *ctx, JSValueConst this_obj,
                                  uint32_t idx, JSValue val, int flags) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 ULONG, RA2 JSValue *, RD1 int);
    { int _r; SA6; _r = (int)LVO(QJSBase,660,F)((void*)QJSBase, ctx, &this_obj, idx, &val, flags); RA6; return _r; }
}

int JS_DefinePropertyValueStr(JSContext *ctx, JSValueConst this_obj,
                               const char *prop, JSValue val, int flags) {
    /* SFD: (ctx,this_ptr,val_ptr,prop_str,flags)(a0/a1/a2/a3/d0) */
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 JSValue *,
                     RA3 const char *, RD0 int);
    { int _r; SA6; _r = (int)LVO(QJSBase,666,F)((void*)QJSBase, ctx, &this_obj, &val, prop, flags); RA6; return _r; }
}

/* ===================================================================
 * 17. Opaque (LVO -672 to -696)
 * =================================================================== */

/* SFD: SetOpaque(obj_ptr,opaque)(a1/a0) — note a1 first! */
void JS_SetOpaque(JSValue obj, void *opaque) {
    typedef void (*F)(R6, RA1 JSValue *, RA0 void *);
    SA6; LVO(QJSBase,672,F)((void*)QJSBase, &obj, opaque); RA6;
}

void *JS_GetOpaque(JSValueConst obj, JSClassID class_id) {
    typedef void *(*F)(R6, RA0 JSValue *, RD0 ULONG);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,678,F)((void*)QJSBase, &obj, (ULONG)class_id); RA6; return _r; }
}

void *JS_GetOpaque2(JSContext *ctx, JSValueConst obj, JSClassID class_id) {
    typedef void *(*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 ULONG);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,684,F)((void*)QJSBase, ctx, &obj, (ULONG)class_id); RA6; return _r; }
}

int JS_GetOwnPropertyNames(JSContext *ctx, JSPropertyEnum **ptab,
                             uint32_t *plen, JSValueConst obj, int flags) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSPropertyEnum **, RA2 uint32_t *,
                     RA3 JSValue *, RD0 int);
    { int _r; SA6; _r = (int)LVO(QJSBase,690,F)((void*)QJSBase, ctx, ptab, plen, &obj, flags); RA6; return _r; }
}

void JS_FreePropertyEnum(JSContext *ctx, JSPropertyEnum *tab, uint32_t len) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 JSPropertyEnum *, RD0 ULONG);
    SA6; LVO(QJSBase,696,F)((void*)QJSBase, ctx, tab, len); RA6;
}

int JS_IsInstanceOf(JSContext *ctx, JSValueConst val, JSValueConst obj) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,702,F)((void*)QJSBase, ctx, &val, &obj); RA6; return _r; }
}

/* ===================================================================
 * 18. Atoms (LVO -708 to -756)
 * =================================================================== */

JSAtom JS_NewAtomLen(JSContext *ctx, const char *str, size_t len) {
    typedef ULONG (*F)(R6, RA0 JSContext *, RA1 const char *, RD0 ULONG);
    { int _r; SA6; _r = (int)(JSAtom)LVO(QJSBase,708,F)((void*)QJSBase, ctx, str, (ULONG)len); RA6; return _r; }
}

JSAtom JS_NewAtom(JSContext *ctx, const char *str) {
    typedef ULONG (*F)(R6, RA0 JSContext *, RA1 const char *);
    { int _r; SA6; _r = (int)(JSAtom)LVO(QJSBase,714,F)((void*)QJSBase, ctx, str); RA6; return _r; }
}

JSAtom JS_NewAtomUInt32(JSContext *ctx, uint32_t n) {
    typedef ULONG (*F)(R6, RA0 JSContext *, RD0 ULONG);
    { int _r; SA6; _r = (int)(JSAtom)LVO(QJSBase,720,F)((void*)QJSBase, ctx, n); RA6; return _r; }
}

JSAtom JS_DupAtom(JSContext *ctx, JSAtom v) {
    typedef ULONG (*F)(R6, RA0 JSContext *, RD0 ULONG);
    { int _r; SA6; _r = (int)(JSAtom)LVO(QJSBase,726,F)((void*)QJSBase, ctx, (ULONG)v); RA6; return _r; }
}

void JS_FreeAtom(JSContext *ctx, JSAtom v) {
    typedef void (*F)(R6, RA0 JSContext *, RD0 ULONG);
    SA6; LVO(QJSBase,732,F)((void*)QJSBase, ctx, (ULONG)v); RA6;
}

JSValue JS_AtomToValue(JSContext *ctx, JSAtom atom) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RD0 ULONG);
    SA6; LVO(QJSBase,738,F)((void*)QJSBase, &_br, ctx, (ULONG)atom); RA6;
    return _br;
}

JSValue JS_AtomToString(JSContext *ctx, JSAtom atom) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RD0 ULONG);
    SA6; LVO(QJSBase,744,F)((void*)QJSBase, &_br, ctx, (ULONG)atom); RA6;
    return _br;
}

const char *JS_AtomToCStringLen(JSContext *ctx, size_t *plen, JSAtom atom) {
    typedef const char *(*F)(R6, RA0 JSContext *, RA1 size_t *, RD0 ULONG);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,750,F)((void*)QJSBase, ctx, plen, (ULONG)atom); RA6; return _r; }
}

/* JS_AtomToCString is static inline in quickjs.h */

JSAtom JS_ValueToAtom(JSContext *ctx, JSValueConst val) {
    typedef ULONG (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)(JSAtom)LVO(QJSBase,756,F)((void*)QJSBase, ctx, &val); RA6; return _r; }
}

/* ===================================================================
 * 19. Call/Invoke (LVO -768 to -792)
 * =================================================================== */

JSValue JS_Call(JSContext *ctx, JSValueConst func_obj, JSValueConst this_obj,
                int argc, JSValueConst *argv) {
    /* SFD: Call(result,ctx,func_ptr,this_ptr,argc,argv_addr)(a0/a1/a2/a3/d0/d1) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *,
                      RA3 JSValue *, RD0 int, RD1 ULONG);
    LVO(QJSBase,768,F)((void*)QJSBase, &_br, ctx, &func_obj, &this_obj,
                        argc, (ULONG)argv);
    return _br;
}

JSValue JS_Invoke(JSContext *ctx, JSValueConst this_val, JSAtom atom,
                   int argc, JSValueConst *argv) {
    /* SFD: Invoke(result,ctx,this_ptr,argv,atom,argc)(a0/a1/a2/a3/d0/d1) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *,
                      RA3 JSValue *, RD0 ULONG, RD1 int);
    LVO(QJSBase,774,F)((void*)QJSBase, &_br, ctx, &this_val,
                        (JSValue *)argv, (ULONG)atom, argc);
    return _br;
}

JSValue JS_CallConstructor(JSContext *ctx, JSValueConst func_obj,
                            int argc, JSValueConst *argv) {
    /* SFD: CallConstructor(result,ctx,func_ptr,argv,argc)(a0/a1/a2/a3/d0) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *,
                      RA3 JSValue *, RD0 int);
    LVO(QJSBase,780,F)((void*)QJSBase, &_br, ctx, &func_obj,
                        (JSValue *)argv, argc);
    return _br;
}

/* Stub */
JSValue JS_CallConstructor2(JSContext *ctx, JSValueConst func_obj,
                             JSValueConst new_target,
                             int argc, JSValueConst *argv) {
    return JS_CallConstructor(ctx, func_obj, argc, argv);
}

/* ===================================================================
 * 20. JSON (LVO -786 to -792)
 * =================================================================== */

JSValue JS_ParseJSON(JSContext *ctx, const char *buf, size_t buf_len,
                      const char *filename) {
    /* SFD: ParseJSON(result,ctx,buf,filename,buf_len)(a0/a1/a2/a3/d0) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const char *,
                      RA3 const char *, RD0 ULONG);
    SA6; LVO(QJSBase,786,F)((void*)QJSBase, &_br, ctx, buf, filename, (ULONG)buf_len); RA6;
    return _br;
}

JSValue JS_JSONStringify(JSContext *ctx, JSValueConst obj,
                          JSValueConst replacer, JSValueConst space) {
    /* SFD simplified: JSONStringify(result,ctx,obj_ptr)(a0/a1/a2) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,792,F)((void*)QJSBase, &_br, ctx, &obj); RA6;
    return _br;
}

/* ===================================================================
 * 21. Serialization (LVO -798 to -804)
 * =================================================================== */

uint8_t *JS_WriteObject(JSContext *ctx, size_t *psize, JSValueConst obj, int flags) {
    typedef uint8_t *(*F)(R6, RA0 JSContext *, RA1 size_t *, RA2 JSValue *, RD0 int);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,798,F)((void*)QJSBase, ctx, psize, &obj, flags); RA6; return _r; }
}

uint8_t *JS_WriteObject2(JSContext *ctx, size_t *psize, JSValueConst obj,
                          int flags, uint8_t ***psab_tab, size_t *psab_tab_len) {
    return JS_WriteObject(ctx, psize, obj, flags);
}

JSValue JS_ReadObject(JSContext *ctx, const uint8_t *buf, size_t buf_len, int flags) {
    /* SFD: ReadObject(result,ctx,buf,buf_len,flags)(a0/a1/a2/d0/d1) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const uint8_t *,
                      RD0 ULONG, RD1 int);
    SA6; LVO(QJSBase,804,F)((void*)QJSBase, &_br, ctx, buf, (ULONG)buf_len, flags); RA6;
    return _br;
}

/* ===================================================================
 * 22. Classes (LVO -810 to -828)
 * =================================================================== */

JSClassID JS_NewClassID(JSRuntime *rt, JSClassID *pclass_id) {
    typedef ULONG (*F)(R6, RA0 JSRuntime *, RA1 JSClassID *);
    { int _r; SA6; _r = (int)(JSClassID)LVO(QJSBase,810,F)((void*)QJSBase, rt, pclass_id); RA6; return _r; }
}

int JS_NewClass(JSRuntime *rt, JSClassID class_id, const JSClassDef *class_def) {
    typedef int (*F)(R6, RA0 JSRuntime *, RA1 const JSClassDef *, RD0 ULONG);
    { int _r; SA6; _r = (int)LVO(QJSBase,816,F)((void*)QJSBase, rt, class_def, (ULONG)class_id); RA6; return _r; }
}

int JS_IsRegisteredClass(JSRuntime *rt, JSClassID class_id) {
    typedef int (*F)(R6, RA0 JSRuntime *, RD0 ULONG);
    { int _r; SA6; _r = (int)LVO(QJSBase,822,F)((void*)QJSBase, rt, (ULONG)class_id); RA6; return _r; }
}

JSClassID JS_GetClassID(JSValueConst val) {
    typedef ULONG (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)(JSClassID)LVO(QJSBase,828,F)((void*)QJSBase, &val); RA6; return _r; }
}

/* ===================================================================
 * 23. Modules (LVO -834 to -882)
 * =================================================================== */

void JS_SetModuleLoaderFunc(JSRuntime *rt,
                             JSModuleNormalizeFunc *normalize,
                             JSModuleLoaderFunc *loader, void *opaque) {
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 JSModuleNormalizeFunc *,
                      RA2 JSModuleLoaderFunc *, RA3 void *);
    SA6; LVO(QJSBase,834,F)((void*)QJSBase, rt, normalize, loader, opaque); RA6;
}

/* Stub: JS_SetModuleLoaderFunc2 — drop check_attributes param */
void JS_SetModuleLoaderFunc2(JSRuntime *rt,
                              JSModuleNormalizeFunc *normalize,
                              JSModuleLoaderFunc2 *loader,
                              JSModuleCheckSupportedImportAttributes *check_attrs,
                              void *opaque) {
    JS_SetModuleLoaderFunc(rt, normalize, (JSModuleLoaderFunc *)loader, opaque);
}

JSValue JS_GetImportMeta(JSContext *ctx, JSModuleDef *m) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSModuleDef *);
    SA6; LVO(QJSBase,840,F)((void*)QJSBase, &_br, ctx, m); RA6;
    return _br;
}

JSAtom JS_GetModuleName(JSContext *ctx, JSModuleDef *m) {
    typedef ULONG (*F)(R6, RA0 JSContext *, RA1 JSModuleDef *);
    { int _r; SA6; _r = (int)(JSAtom)LVO(QJSBase,846,F)((void*)QJSBase, ctx, m); RA6; return _r; }
}

JSValue JS_GetModuleNamespace(JSContext *ctx, JSModuleDef *m) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSModuleDef *);
    SA6; LVO(QJSBase,852,F)((void*)QJSBase, &_br, ctx, m); RA6;
    return _br;
}

JSModuleDef *JS_NewCModule(JSContext *ctx, const char *name_str,
                            JSModuleInitFunc *func) {
    typedef JSModuleDef *(*F)(R6, RA0 JSContext *, RA1 const char *,
                              RA2 JSModuleInitFunc *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,858,F)((void*)QJSBase, ctx, name_str, func); RA6; return _r; }
}

int JS_AddModuleExport(JSContext *ctx, JSModuleDef *m, const char *name_str) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSModuleDef *, RA2 const char *);
    { int _r; SA6; _r = (int)LVO(QJSBase,864,F)((void*)QJSBase, ctx, m, name_str); RA6; return _r; }
}

int JS_SetModuleExport(JSContext *ctx, JSModuleDef *m,
                        const char *export_name, JSValue val) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSModuleDef *, RA2 const char *,
                     RA3 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,870,F)((void*)QJSBase, ctx, m, export_name, &val); RA6; return _r; }
}

int JS_ResolveModule(JSContext *ctx, JSValueConst obj) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,876,F)((void*)QJSBase, ctx, &obj); RA6; return _r; }
}

const char *JS_GetScriptOrModuleName(JSContext *ctx, int n_stack_levels) {
    typedef const char *(*F)(R6, RA0 JSContext *, RD0 int);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,882,F)((void*)QJSBase, ctx, n_stack_levels); RA6; return _r; }
}

JSValue JS_LoadModule(JSContext *ctx, const char *basename, const char *filename) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const char *,
                      RA3 const char *);
    SA6; LVO(QJSBase,1044,F)((void*)QJSBase, &_br, ctx, basename, filename); RA6;
    return _br;
}

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
        JS_SetModuleExport(ctx, m, tab[i].name, JS_UNDEFINED);
    }
    return 0;
}

/* Stubs for module private values */
JSValue JS_GetModulePrivateValue(JSContext *ctx, JSModuleDef *m) {
    return JS_UNDEFINED;
}
int JS_SetModulePrivateValue(JSContext *ctx, JSModuleDef *m, JSValue val) {
    JS_FreeValue(ctx, val);
    return 0;
}

/* ===================================================================
 * 24. C Functions (LVO -888 to -900)
 * =================================================================== */

JSValue JS_NewCFunction2(JSContext *ctx, JSCFunction *func, const char *name,
                          int length, JSCFunctionEnum cproto, int magic) {
    /* SFD: NewCFunction2(result,ctx,func,name,length,cproto,magic)(a0/a1/a2/a3/d0/d1/d2) */
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSCFunction *,
                      RA3 const char *, RD0 int, RD1 int, RD2 int);
    LVO(QJSBase,888,F)((void*)QJSBase, &_br, ctx, func, name,
                        length, (int)cproto, magic);
    return _br;
}

void JS_SetConstructor(JSContext *ctx, JSValueConst func, JSValueConst proto) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 JSValue *);
    SA6; LVO(QJSBase,894,F)((void*)QJSBase, ctx, &func, &proto); RA6;
}

void JS_SetPropertyFunctionList(JSContext *ctx, JSValueConst obj,
                                 const JSCFunctionListEntry *tab, int len) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 const JSCFunctionListEntry *,
                      RD0 int);
    SA6; LVO(QJSBase,900,F)((void*)QJSBase, ctx, &obj, tab, len); RA6;
}

/* Stubs for NewCFunctionData, NewCClosure, etc. */
JSValue JS_NewCFunctionData(JSContext *ctx, JSCFunctionData *func,
                             int length, int magic, int data_len,
                             JSValueConst *data) {
    return JS_UNDEFINED; /* stub */
}

/* ===================================================================
 * 25. Job/Promise (LVO -906 to -954)
 * =================================================================== */

int JS_IsJobPending(JSRuntime *rt) {
    typedef int (*F)(R6, RA0 JSRuntime *);
    { int _r; SA6; _r = (int)LVO(QJSBase,906,F)((void*)QJSBase, rt); RA6; return _r; }
}

int JS_ExecutePendingJob(JSRuntime *rt, JSContext **pctx) {
    typedef int (*F)(R6, RA0 JSRuntime *, RA1 JSContext **);
    { int _r; SA6; _r = (int)LVO(QJSBase,912,F)((void*)QJSBase, rt, pctx); RA6; return _r; }
}

JSValue JS_NewPromiseCapability(JSContext *ctx, JSValue *resolving_funcs) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,918,F)((void*)QJSBase, &_br, ctx, resolving_funcs); RA6;
    return _br;
}

JSPromiseStateEnum JS_PromiseState(JSContext *ctx, JSValue promise) {
    typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    { int _r; SA6; _r = (int)(JSPromiseStateEnum)LVO(QJSBase,924,F)((void*)QJSBase, ctx, &promise); RA6; return _r; }
}

JSValue JS_PromiseResult(JSContext *ctx, JSValue promise) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 JSValue *);
    SA6; LVO(QJSBase,930,F)((void*)QJSBase, &_br, ctx, &promise); RA6;
    return _br;
}

int JS_IsPromise(JSContext *ctx, JSValueConst val) {
    typedef int (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,936,F)((void*)QJSBase, &val); RA6; return _r; }
}

void JS_SetInterruptHandler(JSRuntime *rt, JSInterruptHandler *cb, void *opaque) {
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 JSInterruptHandler *, RA2 void *);
    SA6; LVO(QJSBase,942,F)((void*)QJSBase, rt, cb, opaque); RA6;
}

void JS_SetHostPromiseRejectionTracker(JSRuntime *rt,
                                        JSHostPromiseRejectionTracker *cb,
                                        void *opaque) {
    typedef void (*F)(R6, RA0 JSRuntime *, RA1 void *, RA2 void *);
    SA6; LVO(QJSBase,948,F)((void*)QJSBase, rt, (void *)cb, opaque); RA6;
}

void JS_SetCanBlock(JSRuntime *rt, int can_block) {
    typedef void (*F)(R6, RA0 JSRuntime *, RD0 int);
    SA6; LVO(QJSBase,954,F)((void*)QJSBase, rt, can_block); RA6;
}

/* Stub */
int JS_EnqueueJob(JSContext *ctx, JSJobFunc *job_func,
                   int argc, JSValueConst *argv) {
    return -1;
}

/* ===================================================================
 * 26. ArrayBuffer / TypedArrays (LVO -960 to -990)
 * =================================================================== */

JSValue JS_NewArrayBufferCopy(JSContext *ctx, const uint8_t *buf, size_t len) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const uint8_t *, RD0 ULONG);
    SA6; LVO(QJSBase,960,F)((void*)QJSBase, &_br, ctx, buf, (ULONG)len); RA6;
    return _br;
}

uint8_t *JS_GetArrayBuffer(JSContext *ctx, size_t *psize, JSValueConst obj) {
    typedef uint8_t *(*F)(R6, RA0 JSContext *, RA1 size_t *, RA2 JSValue *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,966,F)((void*)QJSBase, ctx, psize, &obj); RA6; return _r; }
}

int JS_IsArrayBuffer(JSValueConst val) {
    typedef int (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,972,F)((void*)QJSBase, &val); RA6; return _r; }
}

void JS_DetachArrayBuffer(JSContext *ctx, JSValueConst obj) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    SA6; LVO(QJSBase,978,F)((void*)QJSBase, ctx, &obj); RA6;
}

uint8_t *JS_GetUint8Array(JSContext *ctx, size_t *psize, JSValueConst obj) {
    typedef uint8_t *(*F)(R6, RA0 JSContext *, RA1 size_t *, RA2 JSValue *);
    { void *_r; SA6; _r = (void *)LVO(QJSBase,984,F)((void*)QJSBase, ctx, psize, &obj); RA6; return _r; }
}

JSValue JS_NewUint8ArrayCopy(JSContext *ctx, const uint8_t *buf, size_t len) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const uint8_t *, RD0 ULONG);
    SA6; LVO(QJSBase,990,F)((void*)QJSBase, &_br, ctx, buf, (ULONG)len); RA6;
    return _br;
}

/* ===================================================================
 * 27. Type checks (LVO -996 to -1014)
 * =================================================================== */

int JS_IsDate(JSValueConst val) {
    typedef int (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,996,F)((void*)QJSBase, &val); RA6; return _r; }
}

int JS_IsRegExp(JSValueConst val) {
    typedef int (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,1002,F)((void*)QJSBase, &val); RA6; return _r; }
}

int JS_IsMap(JSValueConst val) {
    typedef int (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,1008,F)((void*)QJSBase, &val); RA6; return _r; }
}

int JS_IsSet(JSValueConst val) {
    typedef int (*F)(R6, RA0 JSValue *);
    { int _r; SA6; _r = (int)LVO(QJSBase,1014,F)((void*)QJSBase, &val); RA6; return _r; }
}

/* ===================================================================
 * 28. Symbol / Date / misc (LVO -1020 to -1038)
 * =================================================================== */

JSValue JS_NewSymbol(JSContext *ctx, const char *description, int is_global) {
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const char *, RD0 int);
    SA6; LVO(QJSBase,1020,F)((void*)QJSBase, &_br, ctx, description, is_global); RA6;
    return _br;
}

void JS_SetIsHTMLDDA(JSContext *ctx, JSValueConst obj) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    SA6; LVO(QJSBase,1032,F)((void*)QJSBase, ctx, &obj); RA6;
}

void JS_SetConstructorBit(JSContext *ctx, JSValueConst func, int val) {
    typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *, RD0 int);
    SA6; LVO(QJSBase,1038,F)((void*)QJSBase, ctx, &func, val); RA6;
}

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
        js_free(ctx, buf);
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
        JS_SetPropertyUint32(ctx, arr, (uint32_t)i, vals[i]);
    return arr;
}

JSValue JS_NewUint8Array(JSContext *ctx, uint8_t *buf, size_t len,
                          JSFreeArrayBufferDataFunc *free_func, void *opaque,
                          int is_shared) {
    return JS_NewUint8ArrayCopy(ctx, buf, len);
}

int js_std_cmd(int cmd, ...) { return 0; }

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
    return JS_ToCStringLen2(ctx, plen, val, cesu8);
}
void JS_FreeCStringRT(JSRuntime *rt, const char *ptr) { /* stub */ }
