/*
 * sharedlib_mem.c — AmigaAlloc/AmigaFree implementation.
 *
 * Uses exec memory pools (CreatePool/AllocPooled/FreePooled) for
 * efficient allocation of the many small objects QuickJS creates.
 * Each allocation has a small header to track size (needed by
 * FreePooled and realloc).
 *
 * No globals. All state lives on the library base struct.
 * SysBase and pool pointer accessed through the base.
 */

#include <exec/types.h>
#include <exec/memory.h>
#include <stddef.h>

#include "libraryconfig.h"
#include "execinline.h"
#include "sharedlib_mem.h"

/* ---- Allocation header ----
 * Prepended to every allocation. 8 bytes for 68k alignment.
 * Stores total size (header + payload) for FreePooled. */
typedef struct {
    ULONG total;    /* total bytes including this header */
    ULONG magic;    /* sanity check */
} AAHeader;

#define AA_MAGIC    0x41416D61UL   /* "AAma" */
#define AA_HDR_SIZE 8              /* sizeof(AAHeader), 8-byte aligned */

/* Pool tuning:
 * puddleSize:  size of each pool chunk exec allocates (64KB)
 * threshSize:  allocations larger than this bypass the pool
 *              and get their own AllocMem (16KB).
 *              exec's pool code handles this transparently. */
#define POOL_PUDDLE  (64 * 1024)
#define POOL_THRESH  (16 * 1024)

/* ---- Pool lifecycle ---- */

BOOL AmigaPoolInit(struct QJSLibBase *base)
{
    base->iMemPool = __CreatePool(base->iSysBase,
        MEMF_PUBLIC, POOL_PUDDLE, POOL_THRESH);
    return (base->iMemPool == NULL) ? TRUE : FALSE;
}

void AmigaPoolCleanup(struct QJSLibBase *base)
{
    if (base->iMemPool) {
        __DeletePool(base->iSysBase, base->iMemPool);
        base->iMemPool = NULL;
    }
}

/* ---- Internal helpers ---- */

static void *aa_alloc(struct QJSLibBase *base, ULONG size)
{
    ULONG total = size + AA_HDR_SIZE;
    AAHeader *h;

    if (!base->iMemPool)
        return NULL;

    h = (AAHeader *)__AllocPooled(base->iSysBase, base->iMemPool, total);
    if (!h) return NULL;

    h->total = total;
    h->magic = AA_MAGIC;
    return (char *)h + AA_HDR_SIZE;
}

static void aa_free(struct QJSLibBase *base, void *ptr)
{
    AAHeader *h;
    if (!ptr) return;

    h = (AAHeader *)((char *)ptr - AA_HDR_SIZE);
    if (h->magic != AA_MAGIC) return;  /* bad pointer */

    h->magic = 0;  /* poison for double-free detection */
    __FreePooled(base->iSysBase, base->iMemPool, h, h->total);
}

static ULONG aa_usable(const void *ptr)
{
    const AAHeader *h;
    if (!ptr) return 0;
    h = (const AAHeader *)((const char *)ptr - AA_HDR_SIZE);
    return (h->magic == AA_MAGIC) ? (h->total - AA_HDR_SIZE) : 0;
}

/* Simple zero-fill since we can't rely on any libc memset */
static void aa_zero(void *ptr, ULONG size)
{
    ULONG *lp = (ULONG *)ptr;
    ULONG longs = size >> 2;
    unsigned char *bp;
    ULONG rem;

    while (longs--)
        *lp++ = 0;

    bp = (unsigned char *)lp;
    rem = size & 3;
    while (rem--)
        *bp++ = 0;
}

/* ---- Public interface ---- */

void *AmigaAlloc(struct QJSLibBase *base, ULONG size, ULONG tag, void *old)
{
    void *ptr;

    if (size == 0 && tag != AA_REALLOC)
        return NULL;

    switch (tag) {
    case AA_MALLOC:
    case AA_ALLOCA:
        return aa_alloc(base, size);

    case AA_CALLOC:
        ptr = aa_alloc(base, size);
        if (ptr)
            aa_zero(ptr, size);
        return ptr;

    case AA_REALLOC: {
        ULONG old_usable;

        if (!old) return aa_alloc(base, size);
        if (size == 0) { aa_free(base, old); return NULL; }

        old_usable = aa_usable(old);
        if (old_usable == 0) return NULL;  /* bad pointer */
        if (size <= old_usable) return old; /* already big enough */

        ptr = aa_alloc(base, size);
        if (!ptr) return NULL;

        __CopyMem(base->iSysBase, old, ptr, old_usable);
        aa_free(base, old);
        return ptr;
    }

    default:
        return NULL;
    }
}

void AmigaFree(struct QJSLibBase *base, void *ptr, ULONG tag)
{
    aa_free(base, ptr);
}

ULONG AmigaAllocUsable(struct QJSLibBase *base, const void *ptr)
{
    return aa_usable(ptr);
}

/* ---- libc malloc/free shims ----
 * The QuickJS engine has default allocator functions (js_def_malloc etc.)
 * that reference malloc/free/calloc/realloc. We use JS_NewRuntime2 which
 * bypasses them, but the linker still sees the symbols. These are also
 * needed by strtod, snprintf, etc.
 *
 * Since these have no library base context, they use AllocVec/FreeVec
 * directly via SysBase at address 4. This is safe because these are
 * only called AFTER the library is initialized (SysBase is valid at
 * the absolute address 4 on every Amiga). */

/* SysBase lives at absolute address 4 on every Amiga.
 * Safe to read anytime after boot. */
static struct ExecBase *get_sysbase(void)
{
    return *(struct ExecBase **)4;
}

/* ---- alloca replacement ----
 * Uses AllocVec via SysBase@4. Short-lived, must be freed by caller.
 * Returns NULL-safe (engine checks alloca returns). */
void *_vbcc_alloca(unsigned long size)
{
    if (size == 0) return NULL;
    return __AllocVec(get_sysbase(), (ULONG)size, MEMF_PUBLIC);
}

/* libc shims use AllocVec with our header prepended so realloc
 * can know the old size. Same header format as the pool allocator. */

void *malloc(size_t sz)
{
    ULONG total;
    AAHeader *h;
    if (sz == 0) return NULL;
    total = (ULONG)sz + AA_HDR_SIZE;
    h = (AAHeader *)__AllocVec(get_sysbase(), total, MEMF_PUBLIC);
    if (!h) return NULL;
    h->total = total;
    h->magic = AA_MAGIC;
    return (char *)h + AA_HDR_SIZE;
}

void *calloc(size_t count, size_t sz)
{
    ULONG payload = (ULONG)(count * sz);
    ULONG total = payload + AA_HDR_SIZE;
    AAHeader *h;
    if (payload == 0) return NULL;
    h = (AAHeader *)__AllocVec(get_sysbase(), total,
                                MEMF_PUBLIC | MEMF_CLEAR);
    if (!h) return NULL;
    h->total = total;
    h->magic = AA_MAGIC;
    return (char *)h + AA_HDR_SIZE;
}

void free(void *ptr)
{
    AAHeader *h;
    if (!ptr) return;
    h = (AAHeader *)((char *)ptr - AA_HDR_SIZE);
    if (h->magic != AA_MAGIC) return;
    h->magic = 0;
    __FreeVec(get_sysbase(), h);
}

void *realloc(void *ptr, size_t ns)
{
    AAHeader *oh;
    ULONG old_usable;
    void *np;

    if (!ptr) return malloc(ns);
    if (ns == 0) { free(ptr); return NULL; }

    oh = (AAHeader *)((char *)ptr - AA_HDR_SIZE);
    if (oh->magic != AA_MAGIC) return NULL;
    old_usable = oh->total - AA_HDR_SIZE;
    if (ns <= old_usable) return ptr;

    np = malloc(ns);
    if (!np) return NULL;
    __CopyMem(get_sysbase(), ptr, np, old_usable);
    free(ptr);
    return np;
}
