/*
 * medium_lib_nolibfd.c — Test library WITHOUT slink LIBFD
 *
 * Provides the function table manually instead of relying on
 * slink's LIBFD mechanism. This tests whether LIBFD is causing
 * the crash by generating wrong relocations or hunk layouts.
 */
#include <exec/types.h>
#include <exec/memory.h>
#include <exec/libraries.h>
#include <exec/resident.h>
#include <proto/exec.h>
#include <string.h>
#include "cutils.h"
#include "quickjs.h"

static const char ver[] = "$VER: qjs_medium.library 2.10 (31.3.2026)";

/* _LibName and _LibID are referenced by libent.o for the RomTag.
 * _LibVersion and _LibRevision are provided by slink via
 * LIBVERSION/LIBREVISION flags, so we don't define them here. */
char __far _LibName[] = "medium.library";
char __far _LibID[] = "medium.library 3.1 (30.3.2026)\r\n";

/* --- AllocMem allocator (same as before) --- */
typedef struct { ULONG size; ULONG magic; } AllocHeader;
#define ALLOC_MAGIC 0x514A5321UL
#define HDR_SIZE ((sizeof(AllocHeader) + 7) & ~7)

static void *a_calloc(void *op, size_t count, size_t sz) {
    ULONG total = (ULONG)(count * sz + HDR_SIZE);
    AllocHeader *h = (AllocHeader *)AllocMem(total, MEMF_PUBLIC|MEMF_CLEAR);
    if (!h) return NULL;
    h->size = total; h->magic = ALLOC_MAGIC;
    return (char *)h + HDR_SIZE;
}
static void *a_malloc(void *op, size_t sz) {
    ULONG total = (ULONG)(sz + HDR_SIZE);
    AllocHeader *h = (AllocHeader *)AllocMem(total, MEMF_PUBLIC);
    if (!h) return NULL;
    h->size = total; h->magic = ALLOC_MAGIC;
    return (char *)h + HDR_SIZE;
}
static void a_free(void *op, void *ptr) {
    AllocHeader *h;
    if (!ptr) return;
    h = (AllocHeader *)((char *)ptr - HDR_SIZE);
    if (h->magic != ALLOC_MAGIC) return;
    h->magic = 0; FreeMem(h, h->size);
}
static void *a_realloc(void *op, void *ptr, size_t ns) {
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
    memcpy(np, ptr, cs); a_free(op, ptr); return np;
}
static size_t a_usable(const void *ptr) {
    const AllocHeader *h;
    if (!ptr) return 0;
    h = (const AllocHeader *)((const char *)ptr - HDR_SIZE);
    return (h->magic == ALLOC_MAGIC) ? (size_t)(h->size - HDR_SIZE) : 0;
}
static const JSMallocFunctions amiga_mf = {
    a_calloc, a_malloc, a_free, a_realloc, a_usable
};

/* --- Library functions --- */

static JSRuntime * __asm myNewRuntime(void)
{ return JS_NewRuntime2(&amiga_mf, NULL); }

static void __asm myFreeRuntime(
    register __a0 JSRuntime *rt)
{ JS_FreeRuntime(rt); }

static JSContext * __asm myNewContext(
    register __a0 JSRuntime *rt)
{ return JS_NewContext(rt); }

static JSContext * __asm myNewContextRaw(
    register __a0 JSRuntime *rt)
{ return JS_NewContextRaw(rt); }

static void __asm myFreeContext(
    register __a0 JSContext *ctx)
{ JS_FreeContext(ctx); }

static const char * __asm myGetVersion(void)
{ return JS_GetVersion(); }

static int __asm myAddBaseObjects(
    register __a0 JSContext *ctx)
{ return JS_AddIntrinsicBaseObjects(ctx); }

static int __asm myAddEval(
    register __a0 JSContext *ctx)
{ return JS_AddIntrinsicEval(ctx); }

static void __asm myRunGC(
    register __a0 JSRuntime *rt)
{ JS_RunGC(rt); }

static void __asm mySetMemoryLimit(
    register __a0 JSRuntime *rt,
    register __d0 ULONG limit)
{ JS_SetMemoryLimit(rt, (size_t)limit); }

static void __asm mySetMaxStackSize(
    register __a0 JSRuntime *rt,
    register __d0 ULONG stack_size)
{ JS_SetMaxStackSize(rt, (size_t)stack_size); }

static void __asm myEval(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *input,
    register __d0 ULONG input_len,
    register __a3 const char *filename,
    register __d1 int eval_flags)
{ *result = JS_Eval(ctx, input, (size_t)input_len, filename, eval_flags); }

/* --- Library init/open/close/expunge --- */

typedef LONG (*myPFL)();
static ULONG seglist_store;

/* NO __saveds on myLibInit — Fiona's bug: compiler assigns D0 param
 * to A4, then __saveds overwrites A4 with _LinkerDB, destroying libbase */
static ULONG __asm myLibInit(register __a0 APTR seglist,
                              register __d0 struct Library *libbase)
{
    seglist_store = (ULONG)seglist;
    libbase->lib_Node.ln_Type = NT_LIBRARY;
    libbase->lib_Node.ln_Name = _LibName;
    libbase->lib_Flags = LIBF_SUMUSED | LIBF_CHANGED;
    libbase->lib_Version = 2;
    libbase->lib_Revision = 10;
    libbase->lib_IdString = (APTR)_LibID;
    return (ULONG)libbase;
}

static LONG __asm myLibOpen(register __a6 struct Library *libbase)
{
    libbase->lib_OpenCnt++;
    libbase->lib_Flags &= ~LIBF_DELEXP;
    return (LONG)libbase;
}

static ULONG __asm myLibClose(register __a6 struct Library *libbase)
{
    if (--libbase->lib_OpenCnt == 0 &&
        (libbase->lib_Flags & LIBF_DELEXP)) {
        LONG libsize;
        Remove((struct Node *)libbase);
        libsize = libbase->lib_NegSize + libbase->lib_PosSize;
        FreeMem((char *)libbase - libbase->lib_NegSize, (ULONG)libsize);
        return seglist_store;
    }
    return 0;
}

static ULONG __asm myLibExpunge(register __a6 struct Library *libbase)
{
    libbase->lib_Flags |= LIBF_DELEXP;
    if (libbase->lib_OpenCnt > 0) return 0;
    Remove((struct Node *)libbase);
    {
        LONG libsize = libbase->lib_NegSize + libbase->lib_PosSize;
        FreeMem((char *)libbase - libbase->lib_NegSize, (ULONG)libsize);
    }
    return seglist_store;
}

/* --- Function table (manual, no LIBFD) ---
 * Order: Open, Close, Expunge, Reserved, then user functions.
 * Terminated by -1. */
static myPFL _LibFuncTab[] = {
    (myPFL)myLibOpen,
    (myPFL)myLibClose,
    (myPFL)myLibExpunge,
    NULL,
    (myPFL)myNewRuntime,      /* offset -30 (0x1e) */
    (myPFL)myFreeRuntime,     /* offset -36 (0x24) */
    (myPFL)myNewContext,      /* offset -42 (0x2a) */
    (myPFL)myNewContextRaw,   /* offset -48 (0x30) */
    (myPFL)myFreeContext,     /* offset -54 (0x36) */
    (myPFL)myGetVersion,      /* offset -60 (0x3c) */
    (myPFL)myAddBaseObjects,  /* offset -66 (0x42) */
    (myPFL)myAddEval,         /* offset -72 (0x48) */
    (myPFL)myRunGC,           /* offset -78 (0x4e) */
    (myPFL)mySetMemoryLimit,  /* offset -84 (0x54) */
    (myPFL)mySetMaxStackSize, /* offset -90 (0x5a) */
    (myPFL)myEval,            /* offset -96 (0x60) */
    (myPFL)-1
};

/* --- InitTable for libent.o --- */
struct InitTable {
    ULONG   *it_DataSize;
    myPFL   *it_FuncTable;
    APTR    it_DataInit;
    myPFL   it_InitFunc;
};

extern char __far RESLEN;

struct InitTable __far _LibInitTab = {
    (ULONG *)(&RESLEN + ((sizeof(struct Library) + 3) & ~3)),
    _LibFuncTab,
    NULL,
    (myPFL)myLibInit,
};
