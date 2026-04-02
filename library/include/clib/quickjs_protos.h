#ifndef CLIB_QUICKJS_PROTOS_H
#define CLIB_QUICKJS_PROTOS_H

/*
**  $VER: quickjs_protos.h 0.49 (27.3.2026)
**
**  C prototypes for quickjs.library — the QuickJS JavaScript engine
**  as an AmigaOS shared library.
**
**  quickjs.library exposes the QuickJS-ng API through the standard
**  AmigaOS shared library mechanism (OpenLibrary/CloseLibrary).
**  All functions use the QJS_ prefix instead of the upstream JS_ prefix.
**
**  CALLING CONVENTIONS (read this first):
**
**  1. JSValue is a 12-byte struct on 68k. It cannot be returned in
**     registers, so functions that upstream return JSValue instead
**     take a pointer to caller-allocated storage as the FIRST argument:
**
**       Upstream:  JSValue val = JS_NewString(ctx, "hello");
**       Library:   JSValue val; QJS_NewString(&val, ctx, "hello");
**
**  2. JSValueConst (same as JSValue) parameters are passed as
**     const JSValue pointers:
**
**       Upstream:  JS_FreeValue(ctx, val);
**       Library:   QJS_FreeValue(ctx, &val);
**
**  3. Floating-point parameters (double) are passed as const double
**     pointers, because AmigaOS pragmas do not support FPU registers:
**
**       Upstream:  JSValue n = JS_NewFloat64(ctx, 3.14);
**       Library:   double d = 3.14; QJS_NewFloat64(&n, ctx, &d);
**
**  4. All other types (pointers, ints, enums) are unchanged from
**     the upstream quickjs.h API.
**
**  QUICK START:
**
**     #include <proto/quickjs.h>
**
**     struct Library *QuickJSBase;
**     QuickJSBase = OpenLibrary("quickjs.library", 0);
**     if (QuickJSBase) {
**         JSRuntime *rt = QJS_NewRuntime();
**         JSContext *ctx = QJS_NewContext(rt);
**         JSValue result;
**         QJS_Eval(&result, ctx, "1+1", 3, "<input>", 0);
**         // ... use result ...
**         QJS_FreeValue(ctx, &result);
**         QJS_FreeContext(ctx);
**         QJS_FreeRuntime(rt);
**         CloseLibrary(QuickJSBase);
**     }
*/

#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif

/*
** Type definitions
**
** These mirror the upstream quickjs.h types but are self-contained
** so you don't need to include quickjs.h when using the library.
*/

/* Opaque engine types — you only ever use pointers to these */
typedef struct JSRuntime JSRuntime;   /* JS engine instance      */
typedef struct JSContext JSContext;   /* JS execution context    */
typedef struct JSObject JSObject;    /* internal, don't touch   */

typedef unsigned long JSClassID;     /* class identifier (uint32) */
typedef unsigned long JSAtom;        /* interned string ID (uint32) */

/*
** JSValue — the universal JavaScript value type (12 bytes on 68k).
**
** You generally treat this as opaque. Use QJS_NewInt32(), QJS_NewString(),
** etc. to create values, and QJS_ToInt32(), QJS_ToCString() etc. to
** read them. Check types with QJS_IsNumber(), QJS_IsString(), etc.
**
** IMPORTANT: Every JSValue you receive from a QJS_New, QJS_Get, or QJS_Eval
** function must eventually be freed with QJS_FreeValue() or passed to
** a function that consumes it (like QJS_SetPropertyStr).
*/
typedef union JSValueUnion {
    long int32;          /* integer payload   */
    double float64;      /* float payload     */
    void *ptr;           /* object/string ptr */
    long short_big_int;  /* small bigint      */
} JSValueUnion;

typedef struct JSValue {
    JSValueUnion u;      /* value payload (8 bytes) */
    long tag;            /* type tag (4 bytes)      */
} JSValue;

/* JSValueConst is the same type; the "const" is a documentation hint */
#define JSValueConst JSValue

/*
** Callback function types — used with QJS_NewCFunction2() etc.
** to register C functions callable from JavaScript.
*/

/* Standard C callback: function(this, arg1, arg2, ...) */
typedef JSValue JSCFunction(JSContext *ctx, JSValueConst this_val,
                            int argc, JSValueConst *argv);

/* Data-carrying callback: includes magic number and closure data */
typedef JSValue JSCFunctionData(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv,
                                int magic, JSValue *func_data);
typedef int JSCFunctionEnum;

/* Module types */
typedef struct JSModuleDef JSModuleDef;
typedef int JSModuleInitFunc(JSContext *ctx, JSModuleDef *m);
typedef char *JSModuleNormalizeFunc(JSContext *ctx, const char *module_base_name,
                                    const char *module_name, void *opaque);
typedef JSModuleDef *JSModuleLoaderFunc(JSContext *ctx, const char *module_name,
                                        void *opaque);

/* Interrupt handler */
typedef int JSInterruptHandler(JSRuntime *rt, void *opaque);

/* Job function */
typedef JSValue JSJobFunc(JSContext *ctx, int argc, JSValueConst *argv);

/* Runtime finalizer */
typedef void JSRuntimeFinalizer(JSRuntime *rt, void *arg);

/* Mark function */
typedef void JS_MarkFunc(JSRuntime *rt, JSValueConst val);

/* Property enumeration */
typedef struct JSPropertyEnum {
    int is_enumerable;
    JSAtom atom;
} JSPropertyEnum;

/* Property descriptor */
typedef struct JSPropertyDescriptor {
    int flags;
    JSValue value;
    JSValue getter;
    JSValue setter;
} JSPropertyDescriptor;

/* Memory usage */
typedef struct JSMemoryUsage {
    long malloc_size, malloc_limit, memory_used_size;
    long malloc_count;
    long memory_used_count;
    long atom_count, atom_size;
    long str_count, str_size;
    long obj_count, obj_size;
    long prop_count, prop_size;
    long shape_count, shape_size;
    long js_func_count, js_func_size, js_func_code_size;
    long js_func_pc2line_count, js_func_pc2line_size;
    long c_func_count, fast_array_count, fast_array_elements;
    long binary_object_count, binary_object_size;
} JSMemoryUsage;

/* Class definition */
typedef struct JSClassDef {
    const char *class_name;
    void (*finalizer)(JSRuntime *rt, JSValue val);
    void (*gc_mark)(JSRuntime *rt, JSValueConst val, JS_MarkFunc *mark_func);
    JSValue (*call)(JSContext *ctx, JSValueConst func_obj,
                    JSValueConst this_val, int argc, JSValueConst *argv,
                    int flags);
    void *exotic;  /* JSExoticMethods * */
} JSClassDef;

/* C function list entry (opaque, use JS_CFUNC_* macros) */
typedef struct JSCFunctionListEntry JSCFunctionListEntry;

/* Eval options */
typedef struct JSEvalOptions JSEvalOptions;

/* PrintValue callback and options */
typedef void JSPrintValueWrite(const char *str, void *opaque);

typedef struct JSPrintValueOptions {
    int indent;           /* indentation level (default 0) */
    int max_depth;        /* max recursion depth (default 2) */
    int show_hidden;      /* show non-enumerable (default 0) */
    int color;            /* ANSI color output (default 0) */
    int compact;          /* compact output (default 0) */
} JSPrintValueOptions;

/* Promise state enum */
typedef enum JSPromiseStateEnum {
    JS_PROMISE_PENDING,
    JS_PROMISE_FULFILLED,
    JS_PROMISE_REJECTED
} JSPromiseStateEnum;

/* Typed array enum */
typedef enum JSTypedArrayEnum {
    JS_TYPED_ARRAY_UINT8C = 0,
    JS_TYPED_ARRAY_INT8,
    JS_TYPED_ARRAY_UINT8,
    JS_TYPED_ARRAY_INT16,
    JS_TYPED_ARRAY_UINT16,
    JS_TYPED_ARRAY_INT32,
    JS_TYPED_ARRAY_UINT32,
    JS_TYPED_ARRAY_BIG_INT64,
    JS_TYPED_ARRAY_BIG_UINT64,
    JS_TYPED_ARRAY_FLOAT32,
    JS_TYPED_ARRAY_FLOAT64
} JSTypedArrayEnum;


/* ===================================================================
**  RUNTIME — create/destroy the JS engine, set global limits
**
**  Typical usage:
**    JSRuntime *rt = QJS_NewRuntime();
**    QJS_SetMemoryLimit(rt, 4*1024*1024);  // 4 MB heap
**    QJS_SetMaxStackSize(rt, 256*1024);    // 256 KB stack
**    ...
**    QJS_FreeRuntime(rt);
** =================================================================== */
JSRuntime *QJS_NewRuntime(void);
void QJS_FreeRuntime(JSRuntime *rt);
void QJS_SetMemoryLimit(JSRuntime *rt, ULONG limit);
void QJS_SetMaxStackSize(JSRuntime *rt, ULONG stack_size);
void QJS_RunGC(JSRuntime *rt);
void QJS_SetRuntimeInfo(JSRuntime *rt, const char *info);
void *QJS_GetRuntimeOpaque(JSRuntime *rt);
void QJS_SetRuntimeOpaque(JSRuntime *rt, void *opaque);
void QJS_UpdateStackTop(JSRuntime *rt);
int QJS_IsLiveObject(JSRuntime *rt, const JSValue *obj);

/* ===================================================================
**  CONTEXT — each context is an independent JS global environment
**
**  One runtime can host multiple contexts. Each context has its own
**  global object, but they share the same heap (runtime).
**
**    JSContext *ctx = QJS_NewContext(rt);
**    ...
**    QJS_FreeContext(ctx);
** =================================================================== */
JSContext *QJS_NewContext(JSRuntime *rt);
void QJS_FreeContext(JSContext *ctx);
JSContext *QJS_DupContext(JSContext *ctx);
JSRuntime *QJS_GetRuntime(JSContext *ctx);
void *QJS_GetContextOpaque(JSContext *ctx);
void QJS_SetContextOpaque(JSContext *ctx, void *opaque);
JSContext *QJS_NewContextRaw(JSRuntime *rt);

/* ===================================================================
**  INTRINSICS — add built-in JS objects to a raw context
**
**  QJS_NewContext() adds all intrinsics automatically.
**  QJS_NewContextRaw() creates a bare context — call these to
**  selectively enable features (useful for sandboxing).
** =================================================================== */
int QJS_AddIntrinsicBaseObjects(JSContext *ctx);
int QJS_AddIntrinsicDate(JSContext *ctx);
int QJS_AddIntrinsicEval(JSContext *ctx);
void QJS_AddIntrinsicRegExpCompiler(JSContext *ctx);
int QJS_AddIntrinsicRegExp(JSContext *ctx);
int QJS_AddIntrinsicJSON(JSContext *ctx);
int QJS_AddIntrinsicProxy(JSContext *ctx);
int QJS_AddIntrinsicMapSet(JSContext *ctx);
int QJS_AddIntrinsicTypedArrays(JSContext *ctx);
int QJS_AddIntrinsicPromise(JSContext *ctx);
int QJS_AddIntrinsicBigInt(JSContext *ctx);
int QJS_AddIntrinsicWeakRef(JSContext *ctx);
int QJS_AddPerformance(JSContext *ctx);
int QJS_AddIntrinsicDOMException(JSContext *ctx);

/* ===================================================================
**  EVAL — compile and execute JavaScript code
**
**    JSValue result;
**    QJS_Eval(&result, ctx, "2+2", 3, "<input>", JS_EVAL_TYPE_GLOBAL);
**    // result now holds the JS number 4
**    QJS_FreeValue(ctx, &result);
** =================================================================== */
void QJS_Eval(JSValue *result, JSContext *ctx, const char *input,
              ULONG input_len, const char *filename, int eval_flags);
void QJS_EvalThis(JSValue *result, JSContext *ctx, const JSValue *this_obj,
                  const char *input, ULONG input_len,
                  const char *filename, int eval_flags);
void QJS_EvalFunction(JSValue *result, JSContext *ctx, JSValue *fun_obj);
int QJS_DetectModule(const char *input, ULONG input_len);
int QJS_ResolveModule(JSContext *ctx, const JSValue *obj);

/* ===================================================================
**  VALUE CREATION — construct JavaScript values from C data
**
**  All creators write to a caller-supplied JSValue*:
**    JSValue mystr;
**    QJS_NewString(&mystr, ctx, "hello, Amiga!");
**    // mystr is now a JS string — remember to free it later
** =================================================================== */
void QJS_NewInt32(JSValue *result, JSContext *ctx, int val);
void QJS_NewFloat64(JSValue *result, JSContext *ctx, const double *dval);
void QJS_NewString(JSValue *result, JSContext *ctx, const char *str);
void QJS_NewStringLen(JSValue *result, JSContext *ctx,
                      const char *str, ULONG len);
void QJS_NewBool(JSValue *result, JSContext *ctx, int val);
void QJS_NewObject(JSValue *result, JSContext *ctx);
void QJS_NewArray(JSValue *result, JSContext *ctx);
void QJS_NewNumber(JSValue *result, JSContext *ctx, const double *dval);
void QJS_NewAtomString(JSValue *result, JSContext *ctx, const char *str);
void QJS_NewObjectProto(JSValue *result, JSContext *ctx,
                        const JSValue *proto);
void QJS_NewObjectClass(JSValue *result, JSContext *ctx,
                        JSClassID class_id);
void QJS_NewObjectProtoClass(JSValue *result, JSContext *ctx,
                             const JSValue *proto, JSClassID class_id);
void QJS_NewError(JSValue *result, JSContext *ctx);
void QJS_NewDate(JSValue *result, JSContext *ctx,
                 const double *epoch_ms);
void QJS_NewSymbol(JSValue *result, JSContext *ctx,
                   const char *description, int is_global);

/* ===================================================================
**  VALUE EXTRACTION — read C data from JavaScript values
**
**  ToCString returns a string you MUST free with FreeCString:
**    const char *s = QJS_ToCString(ctx, &val);
**    printf("%s\n", s);
**    QJS_FreeCString(ctx, s);
** =================================================================== */
const char *QJS_ToCString(JSContext *ctx, const JSValue *val);
void QJS_FreeCString(JSContext *ctx, const char *str);
const char *QJS_ToCStringLen2(JSContext *ctx, ULONG *plen,
                               const JSValue *val, int cesu8);
int QJS_ToInt32(JSContext *ctx, long *pres, const JSValue *val);
int QJS_ToFloat64(JSContext *ctx, double *pres, const JSValue *val);
int QJS_ToBool(JSContext *ctx, const JSValue *val);
void QJS_ToNumber(JSValue *result, JSContext *ctx, const JSValue *val);
void QJS_ToString(JSValue *result, JSContext *ctx, const JSValue *val);
void QJS_ToPropertyKey(JSValue *result, JSContext *ctx,
                       const JSValue *val);
void QJS_ToObject(JSValue *result, JSContext *ctx, const JSValue *val);

/* ===================================================================
**  TYPE CHECKING — test what kind of value a JSValue holds
**
**  All return 1 (true) or 0 (false):
**    if (QJS_IsString(&val)) { ... }
**    if (QJS_IsException(&result)) { QJS_StdDumpError(ctx); }
** =================================================================== */
int QJS_IsNumber(const JSValue *val);
int QJS_IsString(const JSValue *val);
int QJS_IsObject(const JSValue *val);
int QJS_IsUndefined(const JSValue *val);
int QJS_IsNull(const JSValue *val);
int QJS_IsException(const JSValue *val);
int QJS_IsError(const JSValue *val);
int QJS_IsFunction(JSContext *ctx, const JSValue *val);
int QJS_IsConstructor(JSContext *ctx, const JSValue *val);
int QJS_IsArray(const JSValue *val);
int QJS_IsProxy(const JSValue *val);
int QJS_IsPromise(const JSValue *val);
int QJS_IsDate(const JSValue *val);
int QJS_IsRegExp(const JSValue *val);
int QJS_IsMap(const JSValue *val);
int QJS_IsSet(const JSValue *val);
int QJS_IsDataView(const JSValue *val);
int QJS_IsArrayBuffer(const JSValue *obj);

/* ===================================================================
**  VALUE LIFECYCLE — reference counting
**
**  QJS_FreeValue:  release a value you own (decrement refcount)
**  QJS_DupValue:   clone a value (increment refcount)
**
**  Rule of thumb: every QJS_New/Get/Eval/Dup needs a matching Free.
** =================================================================== */
void QJS_FreeValue(JSContext *ctx, JSValue *val);
void QJS_FreeValueRT(JSRuntime *rt, JSValue *val);
void QJS_DupValue(JSValue *result, JSContext *ctx, const JSValue *val);
void QJS_DupValueRT(JSValue *result, JSRuntime *rt, const JSValue *val);

/*--- Properties ---*/
void QJS_GetPropertyStr(JSValue *result, JSContext *ctx,
                        const JSValue *this_obj, const char *prop);
int QJS_SetPropertyStr(JSContext *ctx, const JSValue *this_obj,
                       const char *prop, JSValue *val);
void QJS_GetProperty(JSValue *result, JSContext *ctx,
                     const JSValue *this_obj, JSAtom prop);
int QJS_SetProperty(JSContext *ctx, const JSValue *this_obj,
                    JSAtom prop, JSValue *val);
void QJS_GetPropertyUint32(JSValue *result, JSContext *ctx,
                           const JSValue *this_obj, ULONG idx);
int QJS_SetPropertyUint32(JSContext *ctx, const JSValue *this_obj,
                          ULONG idx, JSValue *val);
int QJS_HasProperty(JSContext *ctx, const JSValue *this_obj, JSAtom prop);
int QJS_DeleteProperty(JSContext *ctx, const JSValue *obj,
                       JSAtom prop, int flags);
int QJS_GetOwnPropertyNames(JSContext *ctx, JSPropertyEnum **ptab,
                             ULONG *plen, const JSValue *obj, int flags);
void QJS_FreePropertyEnum(JSContext *ctx, JSPropertyEnum *tab, ULONG len);
int QJS_DefinePropertyValue(JSContext *ctx, const JSValue *this_obj,
                            JSAtom prop, JSValue *val, int flags);
int QJS_DefinePropertyValueStr(JSContext *ctx, const JSValue *this_obj,
                               const char *prop, JSValue *val, int flags);
int QJS_DefinePropertyValueUint32(JSContext *ctx, const JSValue *this_obj,
                                  ULONG idx, JSValue *val, int flags);
int QJS_DefinePropertyGetSet(JSContext *ctx, const JSValue *this_obj,
                             JSAtom prop, JSValue *getter,
                             JSValue *setter, int flags);
int QJS_GetOwnProperty(JSContext *ctx, JSPropertyDescriptor *desc,
                        const JSValue *obj, JSAtom prop);
int QJS_DefineProperty(JSContext *ctx, const JSValue *this_obj,
                       JSAtom prop, const JSValue *val,
                       const JSValue *getter, const JSValue *setter,
                       int flags);

/*--- Object operations ---*/
int QJS_SetPrototype(JSContext *ctx, const JSValue *obj,
                     const JSValue *proto_val);
void QJS_GetPrototype(JSValue *result, JSContext *ctx,
                      const JSValue *val);
int QJS_IsExtensible(JSContext *ctx, const JSValue *obj);
int QJS_PreventExtensions(JSContext *ctx, const JSValue *obj);
int QJS_SealObject(JSContext *ctx, const JSValue *obj);
int QJS_FreezeObject(JSContext *ctx, const JSValue *obj);
int QJS_SetConstructorBit(JSContext *ctx, const JSValue *func_obj, int val);
int QJS_SetConstructor(JSContext *ctx, const JSValue *func_obj,
                       const JSValue *proto);

/*--- Function calls ---*/
void QJS_Call(JSValue *result, JSContext *ctx, const JSValue *func_obj,
              const JSValue *this_obj, int argc, JSValueConst *argv);
void QJS_CallConstructor(JSValue *result, JSContext *ctx,
                         const JSValue *func_obj,
                         int argc, JSValueConst *argv);
void QJS_Invoke(JSValue *result, JSContext *ctx, const JSValue *this_val,
                JSAtom atom, int argc, JSValueConst *argv);

/*--- Error handling ---*/
void QJS_Throw(JSValue *result, JSContext *ctx, JSValue *obj);
void QJS_GetException(JSValue *result, JSContext *ctx);
int QJS_HasException(JSContext *ctx);
int QJS_IsUncatchableError(const JSValue *val);
void QJS_SetUncatchableError(JSContext *ctx, const JSValue *val);
void QJS_ClearUncatchableError(JSContext *ctx, const JSValue *val);
void QJS_ResetUncatchableError(JSContext *ctx);
void QJS_ThrowOutOfMemory(JSValue *result, JSContext *ctx);
void QJS_ThrowTypeErrorMsg(JSValue *result, JSContext *ctx, const char *msg);
void QJS_ThrowRangeErrorMsg(JSValue *result, JSContext *ctx, const char *msg);
void QJS_ThrowReferenceErrorMsg(JSValue *result, JSContext *ctx, const char *msg);
void QJS_ThrowSyntaxErrorMsg(JSValue *result, JSContext *ctx, const char *msg);
void QJS_ThrowInternalErrorMsg(JSValue *result, JSContext *ctx, const char *msg);

/*--- Atoms ---*/
JSAtom QJS_NewAtom(JSContext *ctx, const char *str);
JSAtom QJS_NewAtomLen(JSContext *ctx, const char *str, ULONG len);
JSAtom QJS_NewAtomUInt32(JSContext *ctx, ULONG n);
JSAtom QJS_DupAtom(JSContext *ctx, JSAtom v);
void QJS_FreeAtom(JSContext *ctx, JSAtom v);
void QJS_AtomToValue(JSValue *result, JSContext *ctx, JSAtom atom);
void QJS_AtomToString(JSValue *result, JSContext *ctx, JSAtom atom);
JSAtom QJS_ValueToAtom(JSContext *ctx, const JSValue *val);

/*--- Global object ---*/
void QJS_GetGlobalObject(JSValue *result, JSContext *ctx);

/*--- JSON ---*/
void QJS_ParseJSON(JSValue *result, JSContext *ctx, const char *buf,
                   ULONG buf_len, const char *filename);
void QJS_JSONStringify(JSValue *result, JSContext *ctx,
                       const JSValue *obj, const JSValue *replacer,
                       const JSValue *space);

/*--- ArrayBuffer and TypedArray ---*/
void QJS_NewArrayBufferCopy(JSValue *result, JSContext *ctx,
                            const UBYTE *buf, ULONG len);
UBYTE *QJS_GetArrayBuffer(JSContext *ctx, ULONG *psize,
                           const JSValue *obj);
void QJS_DetachArrayBuffer(JSContext *ctx, const JSValue *obj);
UBYTE *QJS_GetUint8Array(JSContext *ctx, ULONG *psize,
                          const JSValue *obj);
void QJS_NewUint8ArrayCopy(JSValue *result, JSContext *ctx,
                           const UBYTE *buf, ULONG len);
void QJS_NewTypedArray(JSValue *result, JSContext *ctx,
                       int argc, JSValueConst *argv, int array_type);
void QJS_GetTypedArrayBuffer(JSValue *result, JSContext *ctx,
                             const JSValue *obj, ULONG *pbyte_offset,
                             ULONG *pbyte_length,
                             ULONG *pbytes_per_element);
int QJS_GetTypedArrayType(const JSValue *obj);

/*--- Promise ---*/
void QJS_NewPromiseCapability(JSValue *result, JSContext *ctx,
                              JSValue *resolving_funcs);
int QJS_PromiseState(JSContext *ctx, const JSValue *promise);
void QJS_PromiseResult(JSValue *result, JSContext *ctx,
                       const JSValue *promise);
void QJS_NewSettledPromise(JSValue *result, JSContext *ctx,
                           int is_reject, const JSValue *value);

/*--- Module system ---*/
JSModuleDef *QJS_NewCModule(JSContext *ctx, const char *name_str,
                             JSModuleInitFunc *func);
int QJS_AddModuleExport(JSContext *ctx, JSModuleDef *m,
                        const char *name_str);
int QJS_SetModuleExport(JSContext *ctx, JSModuleDef *m,
                        const char *export_name, JSValue *val);
JSAtom QJS_GetModuleName(JSContext *ctx, JSModuleDef *m);
void QJS_GetImportMeta(JSValue *result, JSContext *ctx, JSModuleDef *m);
void QJS_GetModuleNamespace(JSValue *result, JSContext *ctx,
                            JSModuleDef *m);
void QJS_LoadModule(JSValue *result, JSContext *ctx,
                    const char *basename, const char *filename);

/*--- C function creation ---*/
void QJS_NewCFunction2(JSValue *result, JSContext *ctx,
                       JSCFunction *func, const char *name,
                       int length, int cproto, int magic);
void QJS_NewCFunctionData(JSValue *result, JSContext *ctx,
                          JSCFunctionData *func, int length,
                          int magic, int data_len,
                          JSValueConst *data);
int QJS_SetPropertyFunctionList(JSContext *ctx, const JSValue *obj,
                                const JSCFunctionListEntry *tab, int len);

/*--- Class system ---*/
JSClassID QJS_NewClassID(JSRuntime *rt, JSClassID *pclass_id);
int QJS_NewClass(JSRuntime *rt, JSClassID class_id,
                 const JSClassDef *class_def);
JSClassID QJS_GetClassID(const JSValue *val);
int QJS_IsRegisteredClass(JSRuntime *rt, JSClassID class_id);
void QJS_SetClassProto(JSContext *ctx, JSClassID class_id,
                       JSValue *obj);
void QJS_GetClassProto(JSValue *result, JSContext *ctx,
                       JSClassID class_id);
int QJS_SetOpaque(const JSValue *obj, void *opaque);
void *QJS_GetOpaque(const JSValue *obj, JSClassID class_id);
void *QJS_GetOpaque2(JSContext *ctx, const JSValue *obj,
                     JSClassID class_id);
JSAtom QJS_GetClassName(JSRuntime *rt, JSClassID class_id);

/*--- Memory management ---*/
void *QJS_Malloc(JSContext *ctx, ULONG size);
void QJS_Free(JSContext *ctx, void *ptr);
void *QJS_Realloc(JSContext *ctx, void *ptr, ULONG size);
void *QJS_Mallocz(JSContext *ctx, ULONG size);
char *QJS_Strdup(JSContext *ctx, const char *str);
void QJS_FreeCStringRT(JSRuntime *rt, const char *ptr);

/*--- Serialization ---*/
UBYTE *QJS_WriteObject(JSContext *ctx, ULONG *psize,
                        const JSValue *obj, int flags);
void QJS_ReadObject(JSValue *result, JSContext *ctx, const UBYTE *buf,
                    ULONG buf_len, int flags);

/*--- Job queue ---*/
int QJS_IsJobPending(JSRuntime *rt);
int QJS_ExecutePendingJob(JSRuntime *rt, JSContext **pctx);

/*--- Comparison ---*/
int QJS_IsEqual(JSContext *ctx, const JSValue *op1, const JSValue *op2);
int QJS_IsStrictEqual(JSContext *ctx, const JSValue *op1,
                      const JSValue *op2);
int QJS_IsSameValue(JSContext *ctx, const JSValue *op1,
                    const JSValue *op2);
int QJS_IsInstanceOf(JSContext *ctx, const JSValue *val,
                     const JSValue *obj);

/*--- std/os library helpers ---*/
void *QJS_InitModuleStd(JSContext *ctx, const char *name);
void *QJS_InitModuleOs(JSContext *ctx, const char *name);
void QJS_StdAddHelpers(JSContext *ctx, int argc, char **argv);
void QJS_StdInitHandlers(JSRuntime *rt);
void QJS_StdFreeHandlers(JSRuntime *rt);
int QJS_StdLoop(JSContext *ctx);
void QJS_StdDumpError(JSContext *ctx);
void QJS_StdEvalBinary(JSContext *ctx, const UBYTE *buf,
                       ULONG buf_len, int load_only);

/*--- Miscellaneous ---*/
const char *QJS_GetVersion(void);
void QJS_ComputeMemoryUsage(JSRuntime *rt, JSMemoryUsage *s);
JSAtom QJS_GetScriptOrModuleName(JSContext *ctx, int n_stack_levels);
void QJS_SetDumpFlags(JSRuntime *rt, ULONG flags);
ULONG QJS_GetGCThreshold(JSRuntime *rt);
void QJS_SetGCThreshold(JSRuntime *rt, ULONG gc_threshold);

/*--- Additional value operations ---*/
void QJS_NewProxy(JSValue *result, JSContext *ctx,
                  const JSValue *target, const JSValue *handler);
void QJS_GetProxyTarget(JSValue *result, JSContext *ctx,
                        const JSValue *proxy);
void QJS_GetProxyHandler(JSValue *result, JSContext *ctx,
                         const JSValue *proxy);
void QJS_SetIsHTMLDDA(JSContext *ctx, const JSValue *obj);

/*--- Callbacks ---*/
void QJS_SetInterruptHandler(JSRuntime *rt, JSInterruptHandler *cb,
                             void *opaque);
void QJS_SetModuleLoaderFunc(JSRuntime *rt,
                             JSModuleNormalizeFunc *module_normalize,
                             JSModuleLoaderFunc *module_loader,
                             void *opaque);
void QJS_SetCanBlock(JSRuntime *rt, int can_block);
int QJS_EnqueueJob(JSContext *ctx, JSJobFunc *job_func,
                   int argc, JSValueConst *argv);

/*--- Additional ---*/
void QJS_MarkValue(JSRuntime *rt, const JSValue *val,
                   JS_MarkFunc *mark_func);
int QJS_AddRuntimeFinalizer(JSRuntime *rt,
                            JSRuntimeFinalizer *finalizer, void *arg);
void QJS_NewObjectFrom(JSValue *result, JSContext *ctx, int count,
                       const JSAtom *props, const JSValue *values);
void QJS_NewObjectFromStr(JSValue *result, JSContext *ctx, int count,
                          const char **props, const JSValue *values);
void QJS_NewArrayFrom(JSValue *result, JSContext *ctx, int count,
                      const JSValue *values);
int QJS_SetLength(JSContext *ctx, const JSValue *obj, long len);
void QJS_PrintValue(JSContext *ctx, JSPrintValueWrite *write_func,
                    void *write_opaque, const JSValue *val,
                    const JSPrintValueOptions *options);
void QJS_Eval2(JSValue *result, JSContext *ctx, const char *input,
               ULONG input_len, JSEvalOptions *options);
int QJS_IsImmutableArrayBuffer(const JSValue *obj);
int QJS_SetImmutableArrayBuffer(const JSValue *obj, int immutable);

#endif /* CLIB_QUICKJS_PROTOS_H */
