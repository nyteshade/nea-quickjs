/*
 * execinline.c — Direct exec.library calls via VBCC inline assembly.
 *
 * The functions here are simple wrappers that take ExecBase as the
 * first argument and call the corresponding exec.library LVO. They
 * use VBCC's inline assembly syntax (`function = "asm";`) which
 * embeds the jsr directly at the call site, sidestepping any
 * __reg("a6") frame pointer issues.
 */
#include <exec/types.h>
#include <exec/execbase.h>
#include <exec/libraries.h>
#include <exec/nodes.h>

/* ---- Library management ---- */

struct Library *__OpenLibrary(__reg("a6") struct ExecBase *sysBase,
                              __reg("a1") const char *name,
                              __reg("d0") ULONG version)
                              = "\tjsr\t-552(a6)";

void __CloseLibrary(__reg("a6") struct ExecBase *sysBase,
                    __reg("a1") struct Library *lib) = "\tjsr\t-414(a6)";

/* ---- Node management ---- */

void __Remove(__reg("a6") struct ExecBase *sysBase,
              __reg("a1") struct Node *node) = "\tjsr\t-252(a6)";

/* ---- Raw memory ---- */

void *__AllocMem(__reg("a6") struct ExecBase *sysBase,
                 __reg("d0") ULONG size,
                 __reg("d1") ULONG attrs) = "\tjsr\t-198(a6)";

void __FreeMem(__reg("a6") struct ExecBase *sysBase,
               __reg("a1") APTR mem,
               __reg("d0") ULONG size) = "\tjsr\t-210(a6)";

/* ---- Vector memory ---- */

void *__AllocVec(__reg("a6") struct ExecBase *sysBase,
                 __reg("d0") ULONG size,
                 __reg("d1") ULONG attrs) = "\tjsr\t-684(a6)";

void __FreeVec(__reg("a6") struct ExecBase *sysBase,
               __reg("a1") APTR mem) = "\tjsr\t-690(a6)";

/* ---- Pool memory (V39+) ---- */

APTR __CreatePool(__reg("a6") struct ExecBase *sysBase,
                  __reg("d0") ULONG attrs,
                  __reg("d1") ULONG puddleSize,
                  __reg("d2") ULONG threshSize) = "\tjsr\t-696(a6)";

void __DeletePool(__reg("a6") struct ExecBase *sysBase,
                  __reg("a0") APTR pool) = "\tjsr\t-702(a6)";

void *__AllocPooled(__reg("a6") struct ExecBase *sysBase,
                    __reg("a0") APTR pool,
                    __reg("d0") ULONG size) = "\tjsr\t-708(a6)";

void __FreePooled(__reg("a6") struct ExecBase *sysBase,
                  __reg("a0") APTR pool,
                  __reg("a1") APTR mem,
                  __reg("d0") ULONG size) = "\tjsr\t-714(a6)";

/* ---- Misc ---- */

void __CopyMem(__reg("a6") struct ExecBase *sysBase,
               __reg("a0") const void *src,
               __reg("a1") void *dest,
               __reg("d0") ULONG size) = "\tjsr\t-624(a6)";
