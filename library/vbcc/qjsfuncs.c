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
#include <string.h>  /* memcpy */

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

/* ---- Extern engine functions (from SAS/C-compiled .o files) ---- */

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
extern int JS_AddIntrinsicEval(JSContext *ctx);
extern JSValue JS_Eval(JSContext *ctx, const char *input, size_t input_len,
                        const char *filename, int eval_flags);
extern void JS_FreeValue(JSContext *ctx, JSValue v);
extern JSValue JS_GetException(JSContext *ctx);
extern int JS_ToInt32(JSContext *ctx, long *pres, JSValue val);

/* Inline checks */
#define JS_IsException(v) (((long)(v).tag) == JS_TAG_EXCEPTION)

/* ---- AllocMem-based allocator ---- */

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

/* ---- CustomLibInit / CustomLibCleanup ---- */

/* Global DOSBase for dos.library calls within the engine */
struct Library *DOSBase = NULL;

BOOL CustomLibInit(LIBRARY_BASE_TYPE *aBase)
{
    aBase->iDOSBase = __OpenLibrary(aBase->iSysBase,
                                     "dos.library", 36);
    if (!aBase->iDOSBase)
        return TRUE;
    DOSBase = aBase->iDOSBase;
    return FALSE;
}

VOID CustomLibCleanup(LIBRARY_BASE_TYPE *aBase)
{
    if (aBase->iDOSBase) {
        __CloseLibrary(aBase->iSysBase, aBase->iDOSBase);
        aBase->iDOSBase = NULL;
    }
    DOSBase = NULL;
}

/* ---- Library functions ---- */

struct JSRuntime *QJS_NewRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base)
{
    return JS_NewRuntime2(&amiga_mf, NULL);
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
    return JS_NewContext(rt);
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

void QJS_Eval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *input,
    __reg("d0") ULONG input_len,
    __reg("a3") const char *filename,
    __reg("d1") int eval_flags)
{
    *result = JS_Eval(ctx, input, (size_t)input_len, filename, eval_flags);
}
