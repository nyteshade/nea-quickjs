/*
 * execinline.c — Direct exec.library calls via explicit SysBase
 *
 * These call through the exec jump table using VBCC's __reg() syntax.
 * Used by the library template code which can't use the global SysBase.
 */
#include <exec/types.h>
#include <exec/execbase.h>
#include <exec/libraries.h>
#include <exec/nodes.h>

/* Remove() — exec LVO -252 */
void __Remove(struct ExecBase *sysBase, struct Node *node)
{
    ((void (*)(
        __reg("a6") struct ExecBase *,
        __reg("a1") struct Node *))
     *((APTR *)((char *)sysBase - 252)))(sysBase, node);
}

/* FreeMem() — exec LVO -210 */
void __FreeMem(struct ExecBase *sysBase, UBYTE *mem, ULONG size)
{
    ((void (*)(
        __reg("a6") struct ExecBase *,
        __reg("a1") APTR,
        __reg("d0") ULONG))
     *((APTR *)((char *)sysBase - 210)))(sysBase, (APTR)mem, size);
}

/* OpenLibrary() — exec LVO -552 */
struct Library *__OpenLibrary(struct ExecBase *sysBase,
                               const char *name, ULONG version)
{
    return ((struct Library *(*)(
        __reg("a6") struct ExecBase *,
        __reg("a1") const char *,
        __reg("d0") ULONG))
     *((APTR *)((char *)sysBase - 552)))(sysBase, name, version);
}

/* CloseLibrary() — exec LVO -414 */
void __CloseLibrary(struct ExecBase *sysBase, struct Library *lib)
{
    ((void (*)(
        __reg("a6") struct ExecBase *,
        __reg("a1") struct Library *))
     *((APTR *)((char *)sysBase - 414)))(sysBase, lib);
}
