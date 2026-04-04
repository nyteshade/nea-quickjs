/*
 * sharedlib_mem.h — AmigaAlloc/AmigaFree memory interface for shared libraries.
 *
 * Single allocation entry point with tagged dispatch. All memory
 * allocation in the shared library goes through here. The strategy
 * (pool, AllocVec, etc.) is hidden behind the interface and can be
 * changed per-tag without touching callers.
 *
 * Usage:
 *   ptr = AmigaAlloc(base, 1024, AA_MALLOC, NULL);
 *   ptr = AmigaAlloc(base, 1024, AA_CALLOC, NULL);
 *   ptr = AmigaAlloc(base, 2048, AA_REALLOC, old_ptr);
 *   ptr = AmigaAlloc(base, 256,  AA_ALLOCA, NULL);
 *   AmigaFree(base, ptr, AA_MALLOC);
 */
#ifndef SHAREDLIB_MEM_H
#define SHAREDLIB_MEM_H

#include <exec/types.h>

/* Forward declare — full definition in libraryconfig.h */
struct QJSLibBase;

/* ---- Allocation tags ---- */

#define AA_MALLOC   0   /* Uninitialized block (like malloc) */
#define AA_CALLOC   1   /* Zero-filled block (like calloc) */
#define AA_REALLOC  2   /* Resize existing block (pass old ptr) */
#define AA_ALLOCA   3   /* Short-lived scratch (like alloca) */

/* ---- Interface ---- */

/*
 * AmigaAlloc — Allocate memory from the library's pool or exec.
 *
 * base:  Library base pointer (has pool, SysBase, etc.)
 * size:  Bytes to allocate (0 returns NULL)
 * tag:   AA_MALLOC, AA_CALLOC, AA_REALLOC, AA_ALLOCA
 * old:   Previous pointer for AA_REALLOC (NULL otherwise)
 *
 * Returns pointer to allocated memory, or NULL on failure.
 */
void *AmigaAlloc(struct QJSLibBase *base, ULONG size, ULONG tag, void *old);

/*
 * AmigaFree — Free memory allocated by AmigaAlloc.
 *
 * base:  Library base pointer
 * ptr:   Pointer to free (NULL is safe)
 * tag:   Same tag used for allocation (may affect strategy)
 */
void AmigaFree(struct QJSLibBase *base, void *ptr, ULONG tag);

/*
 * AmigaAllocUsable — Return usable size of an allocation.
 * Used by QuickJS js_malloc_usable_size callback.
 */
ULONG AmigaAllocUsable(struct QJSLibBase *base, const void *ptr);

/*
 * AmigaPoolInit — Create the memory pool. Called from CustomLibInit.
 * Returns FALSE on success, TRUE on failure (Amiga convention).
 */
BOOL AmigaPoolInit(struct QJSLibBase *base);

/*
 * AmigaPoolCleanup — Destroy the memory pool. Called from CustomLibCleanup.
 */
void AmigaPoolCleanup(struct QJSLibBase *base);

#endif /* SHAREDLIB_MEM_H */
