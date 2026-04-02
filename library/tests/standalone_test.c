/*
 * standalone_test.c — Same AllocMem allocator test as medium.library
 * but as a standalone executable (NOT a shared library).
 * If this works but the library crashes, the issue is in library loading.
 * If this also crashes, the issue is in our allocator or engine code.
 */
#include <stdio.h>
#include <string.h>
#include <exec/types.h>
#include <exec/memory.h>
#include <proto/exec.h>

#include "cutils.h"
#include "quickjs.h"

static const char ver[] = "$VER: standalone_test 1.0 (29.3.2026)";

/* Same AllocMem-based allocator as in the library */
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

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    const char *v;

    printf("Standalone AllocMem allocator test\n");
    printf("==================================\n");

    v = JS_GetVersion();
    printf("1. GetVersion = '%s'\n", v ? v : "(null)");

    rt = JS_NewRuntime2(&amiga_mf, NULL);
    printf("2. NewRuntime2 = 0x%lx\n", (unsigned long)rt);
    if (!rt) { printf("FATAL\n"); return 20; }

    JS_SetMemoryLimit(rt, 8 * 1024 * 1024);
    printf("3. SetMemoryLimit OK\n");

    JS_SetMaxStackSize(rt, 256 * 1024);
    printf("4. SetMaxStackSize OK\n");

    JS_RunGC(rt);
    printf("5. RunGC OK\n");

    printf("6. NewContextRaw...\n");
    ctx = JS_NewContextRaw(rt);
    printf("   = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) { printf("FATAL\n"); JS_FreeRuntime(rt); return 20; }

    JS_FreeContext(ctx);
    printf("7. FreeContext OK\n");

    printf("8. NewContextRaw + AddBaseObjects...\n");
    ctx = JS_NewContextRaw(rt);
    printf("   raw ctx = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) { printf("FATAL\n"); JS_FreeRuntime(rt); return 20; }
    printf("   AddBaseObjects...\n");
    {
        int ret = JS_AddIntrinsicBaseObjects(ctx);
        printf("   = %d\n", ret);
    }

    printf("9. AddEval...\n");
    {
        int ret = JS_AddIntrinsicEval(ctx);
        printf("   = %d\n", ret);
    }

    JS_FreeContext(ctx);
    printf("10. Full NewContext...\n");
    ctx = JS_NewContext(rt);
    printf("    = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) { printf("FATAL\n"); JS_FreeRuntime(rt); return 20; }

    printf("11. Eval('1+1')...\n");
    {
        JSValue result = JS_Eval(ctx, "1+1", 3, "<test>", 0);
        printf("    tag=%ld val=%ld\n", (long)result.tag, (long)result.u.int32);
        JS_FreeValue(ctx, result);
    }

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    printf("Done! All passed.\n");
    return 0;
}
