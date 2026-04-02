/*
 * medium_lib.c — Diagnostic test library for quickjs.library development
 *
 * Uses AllocMem-based allocator (no C runtime heap needed).
 * No dos.library calls, no printf, no C runtime dependencies.
 * Uses exec.library RawDoFmt for diagnostics (always available).
 */
#include <exec/types.h>
#include <exec/memory.h>
#include <exec/libraries.h>
#include <proto/exec.h>
#include <string.h>
#include "cutils.h"
#include "quickjs.h"

static const char ver[] = "$VER: qjs_medium.library 2.11 (31.3.2026)";

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
    AllocHeader *oh; void *np; ULONG os, cs;
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

/* --- Library functions ---
 *
 * With LIBCODE + STRMER, use __saveds on all entry points. The compiler may assign
 * register parameters to A4, and __saveds overwrites A4 with
 * _LinkerDB, destroying the parameter. The caller's A4 (set by
 * their c.o startup) remains valid for any scnb.lib calls.
 */

__saveds __asm JSRuntime *LIBNewRuntime(void)
{
    return JS_NewRuntime2(&amiga_mf, NULL);
}

__saveds __asm void LIBFreeRuntime(register __a0 JSRuntime *rt)
{
    JS_FreeRuntime(rt);
}

__saveds __asm JSContext *LIBNewContext(register __a0 JSRuntime *rt)
{
    return JS_NewContext(rt);
}

__saveds __asm JSContext *LIBNewContextRaw(register __a0 JSRuntime *rt)
{
    return JS_NewContextRaw(rt);
}

__saveds __asm void LIBFreeContext(register __a0 JSContext *ctx)
{
    JS_FreeContext(ctx);
}

__saveds __asm const char *LIBGetVersion(void)
{
    return JS_GetVersion();
}

/* Just call directly — no static inline functions from quickjs.h */
__saveds __asm int LIBAddBaseObjects(register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicBaseObjects(ctx);
}

__saveds __asm int LIBAddEval(register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicEval(ctx);
}

__saveds __asm void LIBRunGC(register __a0 JSRuntime *rt)
{
    JS_RunGC(rt);
}

__saveds __asm void LIBSetMemoryLimit(
    register __a0 JSRuntime *rt,
    register __d0 ULONG limit)
{
    JS_SetMemoryLimit(rt, (size_t)limit);
}

__saveds __asm void LIBSetMaxStackSize(
    register __a0 JSRuntime *rt,
    register __d0 ULONG stack_size)
{
    JS_SetMaxStackSize(rt, (size_t)stack_size);
}

__saveds __asm void LIBEval(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *input,
    register __d0 ULONG input_len,
    register __a3 const char *filename,
    register __d1 int eval_flags)
{
    *result = JS_Eval(ctx, input, (size_t)input_len, filename, eval_flags);
}
