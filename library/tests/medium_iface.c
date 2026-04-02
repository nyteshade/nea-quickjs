/*
 * medium_iface.c — Option C: Interface struct library
 *
 * Single jump table entry: LIBGetInterface()
 * Returns a heap-allocated struct of function pointers.
 * The engine code is in this library but called through
 * the struct, not through the AmigaOS jump table.
 *
 * This avoids slink's LIBFD creating a complex 212-entry
 * function table which causes relocation issues in large binaries.
 */
#include <exec/types.h>
#include <exec/memory.h>
#include <exec/libraries.h>
#include <proto/exec.h>
#include <string.h>
#include "cutils.h"
#include "quickjs.h"
#include "quickjs-libc.h"

static const char ver[] = "$VER: qjs_medium.library 3.0 (01.4.2026)";

int __asm __UserLibInit(register __a6 struct Library *lb)
{
    return 0;
}

void __asm __UserLibCleanup(register __a6 struct Library *lb)
{
}

/* --- AllocMem-based allocator --- */

typedef struct { ULONG size; ULONG magic; } AllocHeader;
#define ALLOC_MAGIC 0x514A5321UL
#define HDR_SIZE ((sizeof(AllocHeader) + 7) & ~7)

static void *a_calloc(void *op, size_t count, size_t sz)
{
    ULONG total = (ULONG)(count * sz + HDR_SIZE);
    AllocHeader *h = (AllocHeader *)AllocMem(total, MEMF_PUBLIC|MEMF_CLEAR);
    if (!h) return NULL;
    h->size = total; h->magic = ALLOC_MAGIC;
    return (char *)h + HDR_SIZE;
}

static void *a_malloc(void *op, size_t sz)
{
    ULONG total = (ULONG)(sz + HDR_SIZE);
    AllocHeader *h = (AllocHeader *)AllocMem(total, MEMF_PUBLIC);
    if (!h) return NULL;
    h->size = total; h->magic = ALLOC_MAGIC;
    return (char *)h + HDR_SIZE;
}

static void a_free(void *op, void *ptr)
{
    AllocHeader *h;
    if (!ptr) return;
    h = (AllocHeader *)((char *)ptr - HDR_SIZE);
    if (h->magic != ALLOC_MAGIC) return;
    h->magic = 0;
    FreeMem(h, h->size);
}

static void *a_realloc(void *op, void *ptr, size_t ns)
{
    AllocHeader *oh;
    void *np;
    ULONG os, cs;
    if (!ptr) return a_malloc(op, ns);
    if (!ns) { a_free(op, ptr); return NULL; }
    oh = (AllocHeader *)((char *)ptr - HDR_SIZE);
    if (oh->magic != ALLOC_MAGIC) return NULL;
    os = oh->size - HDR_SIZE;
    if (ns <= os) return ptr;
    np = a_malloc(op, ns);
    if (!np) return NULL;
    cs = os < (ULONG)ns ? os : (ULONG)ns;
    memcpy(np, ptr, cs);
    a_free(op, ptr);
    return np;
}

static size_t a_usable(const void *ptr)
{
    const AllocHeader *h;
    if (!ptr) return 0;
    h = (const AllocHeader *)((const char *)ptr - HDR_SIZE);
    return (h->magic == ALLOC_MAGIC) ? (size_t)(h->size - HDR_SIZE) : 0;
}

static const JSMallocFunctions amiga_mf = {
    a_calloc, a_malloc, a_free, a_realloc, a_usable
};

/* --- Wrapper functions (called through interface, not jump table) --- */

static JSRuntime *w_NewRuntime(void)
{
    return JS_NewRuntime2(&amiga_mf, NULL);
}

static void w_FreeRuntime(JSRuntime *rt)
{
    JS_FreeRuntime(rt);
}

static void w_SetMemoryLimit(JSRuntime *rt, unsigned long limit)
{
    JS_SetMemoryLimit(rt, (size_t)limit);
}

static void w_SetMaxStackSize(JSRuntime *rt, unsigned long ss)
{
    JS_SetMaxStackSize(rt, (size_t)ss);
}

static void w_RunGC(JSRuntime *rt)
{
    JS_RunGC(rt);
}

static JSContext *w_NewContext(JSRuntime *rt)
{
    return JS_NewContext(rt);
}

static JSContext *w_NewContextRaw(JSRuntime *rt)
{
    return JS_NewContextRaw(rt);
}

static void w_FreeContext(JSContext *ctx)
{
    JS_FreeContext(ctx);
}

static JSRuntime *w_GetRuntime(JSContext *ctx)
{
    return JS_GetRuntime(ctx);
}

static void w_Eval(JSValue *result, JSContext *ctx, const char *input,
                   unsigned long input_len, const char *filename, int eval_flags)
{
    *result = JS_Eval(ctx, input, (size_t)input_len, filename, eval_flags);
}

static void w_NewInt32(JSValue *result, JSContext *ctx, int val)
{
    *result = JS_NewInt32(ctx, val);
}

static void w_NewFloat64(JSValue *result, JSContext *ctx, const double *dval)
{
    *result = JS_NewFloat64(ctx, *dval);
}

static void w_NewString(JSValue *result, JSContext *ctx, const char *str)
{
    *result = JS_NewString(ctx, str);
}

static void w_NewStringLen(JSValue *result, JSContext *ctx, const char *str, unsigned long len)
{
    *result = JS_NewStringLen(ctx, str, (size_t)len);
}

static void w_NewBool(JSValue *result, JSContext *ctx, int val)
{
    *result = JS_NewBool(ctx, val);
}

static void w_NewObject(JSValue *result, JSContext *ctx)
{
    *result = JS_NewObject(ctx);
}

static void w_NewArray(JSValue *result, JSContext *ctx)
{
    *result = JS_NewArray(ctx);
}

static const char *w_ToCString(JSContext *ctx, const JSValue *val)
{
    return JS_ToCString(ctx, *val);
}

static void w_FreeCString(JSContext *ctx, const char *str)
{
    JS_FreeCString(ctx, str);
}

static int w_ToInt32(JSContext *ctx, long *pres, const JSValue *val)
{
    int32_t res;
    int ret = JS_ToInt32(ctx, &res, *val);
    if (pres) *pres = (long)res;
    return ret;
}

static int w_ToFloat64(JSContext *ctx, double *pres, const JSValue *val)
{
    return JS_ToFloat64(ctx, pres, *val);
}

static int w_ToBool(JSContext *ctx, const JSValue *val)
{
    return JS_ToBool(ctx, *val);
}

static int w_IsNumber(const JSValue *v) { return JS_IsNumber(*v); }
static int w_IsString(const JSValue *v) { return JS_IsString(*v); }
static int w_IsObject(const JSValue *v) { return JS_IsObject(*v); }
static int w_IsUndefined(const JSValue *v) { return JS_IsUndefined(*v); }
static int w_IsNull(const JSValue *v) { return JS_IsNull(*v); }
static int w_IsException(const JSValue *v) { return JS_IsException(*v); }

static void w_FreeValue(JSContext *ctx, JSValue *val)
{
    JS_FreeValue(ctx, *val);
}

static void w_DupValue(JSValue *result, JSContext *ctx, const JSValue *val)
{
    *result = JS_DupValue(ctx, *val);
}

static void w_GetPropertyStr(JSValue *result, JSContext *ctx,
                              const JSValue *this_obj, const char *prop)
{
    *result = JS_GetPropertyStr(ctx, *this_obj, prop);
}

static int w_SetPropertyStr(JSContext *ctx, const JSValue *this_obj,
                             const char *prop, JSValue *val)
{
    return JS_SetPropertyStr(ctx, *this_obj, prop, *val);
}

static void w_GetGlobalObject(JSValue *result, JSContext *ctx)
{
    *result = JS_GetGlobalObject(ctx);
}

static void w_Call(JSValue *result, JSContext *ctx, const JSValue *func_obj,
                   const JSValue *this_obj, int argc, JSValueConst *argv)
{
    *result = JS_Call(ctx, *func_obj, *this_obj, argc, argv);
}

static void w_GetException(JSValue *result, JSContext *ctx)
{
    *result = JS_GetException(ctx);
}

static int w_HasException(JSContext *ctx)
{
    return JS_HasException(ctx);
}

static int w_AddIntrinsicBaseObjects(JSContext *ctx) { return JS_AddIntrinsicBaseObjects(ctx); }
static int w_AddIntrinsicDate(JSContext *ctx) { return JS_AddIntrinsicDate(ctx); }
static int w_AddIntrinsicEval(JSContext *ctx) { return JS_AddIntrinsicEval(ctx); }
static int w_AddIntrinsicRegExp(JSContext *ctx) { return JS_AddIntrinsicRegExp(ctx); }
static int w_AddIntrinsicJSON(JSContext *ctx) { return JS_AddIntrinsicJSON(ctx); }
static int w_AddIntrinsicProxy(JSContext *ctx) { return JS_AddIntrinsicProxy(ctx); }
static int w_AddIntrinsicMapSet(JSContext *ctx) { return JS_AddIntrinsicMapSet(ctx); }
static int w_AddIntrinsicTypedArrays(JSContext *ctx) { return JS_AddIntrinsicTypedArrays(ctx); }
static int w_AddIntrinsicPromise(JSContext *ctx) { return JS_AddIntrinsicPromise(ctx); }

static void w_ParseJSON(JSValue *result, JSContext *ctx, const char *buf,
                         unsigned long buf_len, const char *filename)
{
    *result = JS_ParseJSON(ctx, buf, (size_t)buf_len, filename);
}

static JSAtom w_NewAtom(JSContext *ctx, const char *str)
{
    return JS_NewAtom(ctx, str);
}

static void w_FreeAtom(JSContext *ctx, JSAtom v)
{
    JS_FreeAtom(ctx, v);
}

static void *w_InitModuleStd(JSContext *ctx, const char *name)
{
    return (void *)js_init_module_std(ctx, name);
}

static void *w_InitModuleOs(JSContext *ctx, const char *name)
{
    return (void *)js_init_module_os(ctx, name);
}

static void w_StdAddHelpers(JSContext *ctx, int argc, char **argv)
{
    js_std_add_helpers(ctx, argc, argv);
}

static void w_StdInitHandlers(JSRuntime *rt) { js_std_init_handlers(rt); }
static void w_StdFreeHandlers(JSRuntime *rt) { js_std_free_handlers(rt); }
static int w_StdLoop(JSContext *ctx) { return js_std_loop(ctx); }
static void w_StdDumpError(JSContext *ctx) { js_std_dump_error(ctx); }
static int w_IsJobPending(JSRuntime *rt) { return JS_IsJobPending(rt); }

static int w_ExecutePendingJob(JSRuntime *rt, JSContext **pctx)
{
    return JS_ExecutePendingJob(rt, pctx);
}

/* --- The ONE library function: fill and return the interface struct --- */

#include "qjs_interface.h"

__asm struct QJSInterface *LIBGetInterface(void)
{
    struct QJSInterface *iface;
    iface = (struct QJSInterface *)AllocMem(sizeof(struct QJSInterface),
                                             MEMF_PUBLIC | MEMF_CLEAR);
    if (!iface) return NULL;

    iface->struct_size = sizeof(struct QJSInterface);
    iface->GetVersion = (const char *(*)(void))JS_GetVersion;

    iface->NewRuntime = w_NewRuntime;
    iface->FreeRuntime = w_FreeRuntime;
    iface->SetMemoryLimit = w_SetMemoryLimit;
    iface->SetMaxStackSize = w_SetMaxStackSize;
    iface->RunGC = w_RunGC;

    iface->NewContext = w_NewContext;
    iface->NewContextRaw = w_NewContextRaw;
    iface->FreeContext = w_FreeContext;
    iface->GetRuntime = w_GetRuntime;

    iface->Eval = w_Eval;

    iface->NewInt32 = w_NewInt32;
    iface->NewFloat64 = w_NewFloat64;
    iface->NewString = w_NewString;
    iface->NewStringLen = w_NewStringLen;
    iface->NewBool = w_NewBool;
    iface->NewObject = w_NewObject;
    iface->NewArray = w_NewArray;

    iface->ToCString = w_ToCString;
    iface->FreeCString = w_FreeCString;
    iface->ToInt32 = w_ToInt32;
    iface->ToFloat64 = w_ToFloat64;
    iface->ToBool = w_ToBool;

    iface->IsNumber = w_IsNumber;
    iface->IsString = w_IsString;
    iface->IsObject = w_IsObject;
    iface->IsUndefined = w_IsUndefined;
    iface->IsNull = w_IsNull;
    iface->IsException = w_IsException;

    iface->FreeValue = w_FreeValue;
    iface->DupValue = w_DupValue;

    iface->GetPropertyStr = w_GetPropertyStr;
    iface->SetPropertyStr = w_SetPropertyStr;

    iface->GetGlobalObject = w_GetGlobalObject;

    iface->Call = w_Call;

    iface->GetException = w_GetException;
    iface->HasException = w_HasException;

    iface->AddIntrinsicBaseObjects = w_AddIntrinsicBaseObjects;
    iface->AddIntrinsicDate = w_AddIntrinsicDate;
    iface->AddIntrinsicEval = w_AddIntrinsicEval;
    iface->AddIntrinsicRegExp = w_AddIntrinsicRegExp;
    iface->AddIntrinsicJSON = w_AddIntrinsicJSON;
    iface->AddIntrinsicProxy = w_AddIntrinsicProxy;
    iface->AddIntrinsicMapSet = w_AddIntrinsicMapSet;
    iface->AddIntrinsicTypedArrays = w_AddIntrinsicTypedArrays;
    iface->AddIntrinsicPromise = w_AddIntrinsicPromise;

    iface->ParseJSON = w_ParseJSON;

    iface->NewAtom = w_NewAtom;
    iface->FreeAtom = w_FreeAtom;

    iface->InitModuleStd = w_InitModuleStd;
    iface->InitModuleOs = w_InitModuleOs;
    iface->StdAddHelpers = w_StdAddHelpers;
    iface->StdInitHandlers = w_StdInitHandlers;
    iface->StdFreeHandlers = w_StdFreeHandlers;
    iface->StdLoop = w_StdLoop;
    iface->StdDumpError = w_StdDumpError;

    iface->IsJobPending = w_IsJobPending;
    iface->ExecutePendingJob = w_ExecutePendingJob;

    return iface;
}

/* Free the interface struct */
__asm void LIBFreeInterface(register __a0 struct QJSInterface *iface)
{
    if (iface) FreeMem(iface, sizeof(struct QJSInterface));
}
