/*
 * qjs_interface.h — QuickJS interface struct for quickjs.library
 *
 * Instead of 212 jump table entries (which causes slink relocation
 * issues in large binaries), the library exposes ONE function:
 * QJS_GetInterface() which returns a pointer to this struct filled
 * with function pointers at runtime.
 *
 * Usage:
 *   #include "qjs_interface.h"
 *   struct Library *QJSMediumBase;
 *   QJSMediumBase = OpenLibrary("qjs_medium.library", 2);
 *   struct QJSInterface *qjs = QJS_GetInterface();
 *   JSRuntime *rt = qjs->NewRuntime();
 *   JSContext *ctx = qjs->NewContext(rt);
 *   ...
 *   qjs->FreeContext(ctx);
 *   qjs->FreeRuntime(rt);
 *   QJS_FreeInterface(qjs);
 *   CloseLibrary(QJSMediumBase);
 */

#ifndef QJS_INTERFACE_H
#define QJS_INTERFACE_H

/* If quickjs.h is already included, use its types.
 * Otherwise define minimal forward declarations. */
#ifndef QUICKJS_H
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;
typedef unsigned long JSAtom;
typedef unsigned long JSClassID;

typedef union JSValueUnion {
    long int32;
    double float64;
    void *ptr;
    long short_big_int;
} JSValueUnion;

typedef struct JSValue {
    JSValueUnion u;
    long tag;
} JSValue;

#define JSValueConst JSValue
#endif /* QUICKJS_H */

/* The interface struct — each field is a function pointer */
struct QJSInterface {
    /* Version info */
    unsigned long struct_size;     /* size of this struct for versioning */
    const char *(*GetVersion)(void);

    /* Runtime */
    JSRuntime *(*NewRuntime)(void);
    void (*FreeRuntime)(JSRuntime *rt);
    void (*SetMemoryLimit)(JSRuntime *rt, unsigned long limit);
    void (*SetMaxStackSize)(JSRuntime *rt, unsigned long stack_size);
    void (*RunGC)(JSRuntime *rt);

    /* Context */
    JSContext *(*NewContext)(JSRuntime *rt);
    JSContext *(*NewContextRaw)(JSRuntime *rt);
    void (*FreeContext)(JSContext *ctx);
    JSRuntime *(*GetRuntime)(JSContext *ctx);

    /* Eval */
    void (*Eval)(JSValue *result, JSContext *ctx, const char *input,
                 unsigned long input_len, const char *filename, int eval_flags);

    /* Value creation */
    void (*NewInt32)(JSValue *result, JSContext *ctx, int val);
    void (*NewFloat64)(JSValue *result, JSContext *ctx, const double *dval);
    void (*NewString)(JSValue *result, JSContext *ctx, const char *str);
    void (*NewStringLen)(JSValue *result, JSContext *ctx, const char *str, unsigned long len);
    void (*NewBool)(JSValue *result, JSContext *ctx, int val);
    void (*NewObject)(JSValue *result, JSContext *ctx);
    void (*NewArray)(JSValue *result, JSContext *ctx);

    /* Value extraction */
    const char *(*ToCString)(JSContext *ctx, const JSValue *val);
    void (*FreeCString)(JSContext *ctx, const char *str);
    int (*ToInt32)(JSContext *ctx, long *pres, const JSValue *val);
    int (*ToFloat64)(JSContext *ctx, double *pres, const JSValue *val);
    int (*ToBool)(JSContext *ctx, const JSValue *val);

    /* Type checking */
    int (*IsNumber)(const JSValue *val);
    int (*IsString)(const JSValue *val);
    int (*IsObject)(const JSValue *val);
    int (*IsUndefined)(const JSValue *val);
    int (*IsNull)(const JSValue *val);
    int (*IsException)(const JSValue *val);

    /* Value lifecycle */
    void (*FreeValue)(JSContext *ctx, JSValue *val);
    void (*DupValue)(JSValue *result, JSContext *ctx, const JSValue *val);

    /* Properties */
    void (*GetPropertyStr)(JSValue *result, JSContext *ctx,
                           const JSValue *this_obj, const char *prop);
    int (*SetPropertyStr)(JSContext *ctx, const JSValue *this_obj,
                          const char *prop, JSValue *val);

    /* Global */
    void (*GetGlobalObject)(JSValue *result, JSContext *ctx);

    /* Function calls */
    void (*Call)(JSValue *result, JSContext *ctx, const JSValue *func_obj,
                 const JSValue *this_obj, int argc, JSValueConst *argv);

    /* Error handling */
    void (*GetException)(JSValue *result, JSContext *ctx);
    int (*HasException)(JSContext *ctx);

    /* Intrinsics (for NewContextRaw users) */
    int (*AddIntrinsicBaseObjects)(JSContext *ctx);
    int (*AddIntrinsicDate)(JSContext *ctx);
    int (*AddIntrinsicEval)(JSContext *ctx);
    int (*AddIntrinsicRegExp)(JSContext *ctx);
    int (*AddIntrinsicJSON)(JSContext *ctx);
    int (*AddIntrinsicProxy)(JSContext *ctx);
    int (*AddIntrinsicMapSet)(JSContext *ctx);
    int (*AddIntrinsicTypedArrays)(JSContext *ctx);
    int (*AddIntrinsicPromise)(JSContext *ctx);

    /* JSON */
    void (*ParseJSON)(JSValue *result, JSContext *ctx, const char *buf,
                      unsigned long buf_len, const char *filename);

    /* Atoms */
    JSAtom (*NewAtom)(JSContext *ctx, const char *str);
    void (*FreeAtom)(JSContext *ctx, JSAtom v);

    /* std/os helpers */
    void *(*InitModuleStd)(JSContext *ctx, const char *name);
    void *(*InitModuleOs)(JSContext *ctx, const char *name);
    void (*StdAddHelpers)(JSContext *ctx, int argc, char **argv);
    void (*StdInitHandlers)(JSRuntime *rt);
    void (*StdFreeHandlers)(JSRuntime *rt);
    int (*StdLoop)(JSContext *ctx);
    void (*StdDumpError)(JSContext *ctx);

    /* Job queue */
    int (*IsJobPending)(JSRuntime *rt);
    int (*ExecutePendingJob)(JSRuntime *rt, JSContext **pctx);
};

#endif /* QJS_INTERFACE_H */
