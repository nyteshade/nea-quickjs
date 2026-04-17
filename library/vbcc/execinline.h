/*
 * execinline.h — Direct exec.library calls via explicit SysBase
 * for VBCC library code. No globals, no amiga.lib.
 *
 * Every function takes SysBase as the first parameter and
 * dispatches through the exec jump table.
 */
#ifndef EXECINLINE_H
#define EXECINLINE_H

#include <exec/types.h>
#include <exec/execbase.h>
#include <exec/libraries.h>
#include <exec/nodes.h>

/* ---- Library management ---- */
struct Library *__OpenLibrary(struct ExecBase *sysBase,
                               const char *name, ULONG version);
void __CloseLibrary(struct ExecBase *sysBase, struct Library *lib);

/* ---- Node management ---- */
void __Remove(struct ExecBase *sysBase, struct Node *node);

/* ---- Raw memory (caller tracks size) ---- */
void *__AllocMem(struct ExecBase *sysBase, ULONG size, ULONG attrs);
void __FreeMem(struct ExecBase *sysBase, void *mem, ULONG size);

/* ---- Vector memory (exec tracks size) ---- */
void *__AllocVec(struct ExecBase *sysBase, ULONG size, ULONG attrs);
void __FreeVec(struct ExecBase *sysBase, void *mem);

/* ---- Pool memory (V39+) ---- */
APTR __CreatePool(struct ExecBase *sysBase,
                  ULONG attrs, ULONG puddleSize, ULONG threshSize);
void __DeletePool(struct ExecBase *sysBase, APTR pool);
void *__AllocPooled(struct ExecBase *sysBase, APTR pool, ULONG size);
void __FreePooled(struct ExecBase *sysBase, APTR pool,
                  void *mem, ULONG size);

/* ---- Misc ---- */
void __CopyMem(struct ExecBase *sysBase,
               const void *src, void *dest, ULONG size);

/* ---- Signals / lists / devices (for timer.device setup) ---- */
LONG __AllocSignal(struct ExecBase *sysBase, LONG signalNum);
void __FreeSignal(struct ExecBase *sysBase, LONG signalNum);
void __NewList(struct ExecBase *sysBase, struct List *list);
LONG __OpenDevice(struct ExecBase *sysBase, const char *name, ULONG unit,
                  struct IORequest *ior, ULONG flags);
void __CloseDevice(struct ExecBase *sysBase, struct IORequest *ior);

#endif /* EXECINLINE_H */
