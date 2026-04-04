/*
 * execinline.h — Direct exec.library calls via explicit SysBase
 * for VBCC library code (double-underscore convention).
 */
#ifndef EXECINLINE_H
#define EXECINLINE_H

#include <exec/types.h>
#include <exec/execbase.h>
#include <exec/libraries.h>
#include <exec/nodes.h>

/* Prototypes — implemented in execinline.c */
void __Remove(struct ExecBase *sysBase, struct Node *node);
void __FreeMem(struct ExecBase *sysBase, UBYTE *mem, ULONG size);
struct Library *__OpenLibrary(struct ExecBase *sysBase,
                               const char *name, ULONG version);
void __CloseLibrary(struct ExecBase *sysBase, struct Library *lib);

#endif /* EXECINLINE_H */
