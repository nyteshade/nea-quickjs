/*
 * execinline.c — Direct exec.library calls via explicit SysBase.
 * No globals, no amiga.lib. Each function dispatches through the
 * exec jump table using VBCC's __reg() syntax.
 *
 * IMPORTANT: Amiga library LVO entries contain JMP instructions,
 * not function pointers. We cast (sysBase - offset) as a function
 * pointer and call it directly — the CPU executes the JMP at that
 * address which bounces to the real implementation.
 */
#include <exec/types.h>
#include <exec/execbase.h>
#include <exec/libraries.h>
#include <exec/nodes.h>

/* Helper macro: cast LVO address as callable function pointer.
 * base - offset gives the address of the JMP instruction in the
 * library's jump table. Calling it executes the JMP. */
#define LVO(base, offset, type) ((type)((char *)(base) - (offset)))

/* ---- Library management ---- */

/* OpenLibrary — LVO -552 */
struct Library *__OpenLibrary(struct ExecBase *sysBase,
                               const char *name, ULONG version)
{
    return LVO(sysBase, 552,
        struct Library *(*)(
            __reg("a6") struct ExecBase *,
            __reg("a1") const char *,
            __reg("d0") ULONG))(sysBase, name, version);
}

/* CloseLibrary — LVO -414 */
void __CloseLibrary(struct ExecBase *sysBase, struct Library *lib)
{
    LVO(sysBase, 414,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a1") struct Library *))(sysBase, lib);
}

/* ---- Node management ---- */

/* Remove — LVO -252 */
void __Remove(struct ExecBase *sysBase, struct Node *node)
{
    LVO(sysBase, 252,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a1") struct Node *))(sysBase, node);
}

/* ---- Raw memory ---- */

/* AllocMem — LVO -198 */
void *__AllocMem(struct ExecBase *sysBase, ULONG size, ULONG attrs)
{
    return LVO(sysBase, 198,
        void *(*)(
            __reg("a6") struct ExecBase *,
            __reg("d0") ULONG,
            __reg("d1") ULONG))(sysBase, size, attrs);
}

/* FreeMem — LVO -210 */
void __FreeMem(struct ExecBase *sysBase, void *mem, ULONG size)
{
    LVO(sysBase, 210,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a1") APTR,
            __reg("d0") ULONG))(sysBase, (APTR)mem, size);
}

/* ---- Vector memory ---- */

/* AllocVec — LVO -684 */
void *__AllocVec(struct ExecBase *sysBase, ULONG size, ULONG attrs)
{
    return LVO(sysBase, 684,
        void *(*)(
            __reg("a6") struct ExecBase *,
            __reg("d0") ULONG,
            __reg("d1") ULONG))(sysBase, size, attrs);
}

/* FreeVec — LVO -690 */
void __FreeVec(struct ExecBase *sysBase, void *mem)
{
    LVO(sysBase, 690,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a1") APTR))(sysBase, (APTR)mem);
}

/* ---- Pool memory (V39+) ---- */

/* CreatePool — LVO -696 */
APTR __CreatePool(struct ExecBase *sysBase,
                  ULONG attrs, ULONG puddleSize, ULONG threshSize)
{
    return LVO(sysBase, 696,
        APTR (*)(
            __reg("a6") struct ExecBase *,
            __reg("d0") ULONG,
            __reg("d1") ULONG,
            __reg("d2") ULONG))(sysBase, attrs, puddleSize, threshSize);
}

/* DeletePool — LVO -702 */
void __DeletePool(struct ExecBase *sysBase, APTR pool)
{
    LVO(sysBase, 702,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a0") APTR))(sysBase, pool);
}

/* AllocPooled — LVO -708 */
void *__AllocPooled(struct ExecBase *sysBase, APTR pool, ULONG size)
{
    return LVO(sysBase, 708,
        void *(*)(
            __reg("a6") struct ExecBase *,
            __reg("a0") APTR,
            __reg("d0") ULONG))(sysBase, pool, size);
}

/* FreePooled — LVO -714 */
void __FreePooled(struct ExecBase *sysBase, APTR pool,
                  void *mem, ULONG size)
{
    LVO(sysBase, 714,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a0") APTR,
            __reg("a1") APTR,
            __reg("d0") ULONG))(sysBase, pool, (APTR)mem, size);
}

/* ---- Misc ---- */

/* CopyMem — LVO -624 */
void __CopyMem(struct ExecBase *sysBase,
               const void *src, void *dest, ULONG size)
{
    LVO(sysBase, 624,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a0") const void *,
            __reg("a1") void *,
            __reg("d0") ULONG))(sysBase, src, dest, size);
}

/* ---- Signals / lists / devices (timer.device integration) ---- */

/* AllocSignal — LVO -330 */
LONG __AllocSignal(struct ExecBase *sysBase, LONG signalNum)
{
    return LVO(sysBase, 330,
        LONG (*)(
            __reg("a6") struct ExecBase *,
            __reg("d0") LONG))(sysBase, signalNum);
}

/* FreeSignal — LVO -336 */
void __FreeSignal(struct ExecBase *sysBase, LONG signalNum)
{
    LVO(sysBase, 336,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("d0") LONG))(sysBase, signalNum);
}

/* NewList — manual inline (it's really a macro that zeros head/tail) */
void __NewList(struct ExecBase *sysBase, struct List *list)
{
    (void)sysBase;
    list->lh_Head     = (struct Node *)&list->lh_Tail;
    list->lh_Tail     = NULL;
    list->lh_TailPred = (struct Node *)&list->lh_Head;
}

/* OpenDevice — LVO -444. Returns 0 on success, non-zero on error.
 * VBCC's BYTE return needs widening to LONG for sign-safety. */
LONG __OpenDevice(struct ExecBase *sysBase, const char *name, ULONG unit,
                  struct IORequest *ior, ULONG flags)
{
    BYTE r = LVO(sysBase, 444,
        BYTE (*)(
            __reg("a6") struct ExecBase *,
            __reg("a0") const char *,
            __reg("d0") ULONG,
            __reg("a1") struct IORequest *,
            __reg("d1") ULONG))(sysBase, name, unit, ior, flags);
    return (LONG)r;
}

/* CloseDevice — LVO -450 */
void __CloseDevice(struct ExecBase *sysBase, struct IORequest *ior)
{
    LVO(sysBase, 450,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a1") struct IORequest *))(sysBase, ior);
}
