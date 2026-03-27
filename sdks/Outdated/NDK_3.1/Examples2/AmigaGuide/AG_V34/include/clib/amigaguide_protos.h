#ifndef	CLIB_AMIGAGUIDE_PROTOS_H
#define	CLIB_AMIGAGUIDE_PROTOS_H
/* amigaguide_protos.h --- function prototypes for the amigaguide.library
 * Copyright (C) 1990 Commodore-Amiga, Inc.
 * Written by David N. Junod
 */

#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif /* EXEC_TYPES_H */

#ifndef EXEC_LISTS_H
#include <exec/lists.h>
#endif /* EXEC_LISTS_H */

#ifndef EXEC_NODES_H
#include <exec/nodes.h>
#endif /* EXEC_NODES_H */

#ifndef EXEC_SEMAPHORES_H
#include <exec/semaphores.h>
#endif

#ifndef INTUITION_INTUITION_H
#include <intuition/intuition.h>
#endif

#ifndef INTUITION_SCREENS_H
#include <intuition/screens.h>
#endif

#ifndef LIBRARIES_DOS_H
#include <libraries/dos.h>
#endif

#ifndef UTILITY_TAGITEM_H
#include <utility/tagitem.h>
#endif

#ifndef	AMIGAGUIDEHOST
typedef struct AmigaGuideHost *AMIGAGUIDEHOST;
#endif

LONG LockAmigaGuideBase (AMIGAGUIDECONTEXT);
VOID UnlockAmigaGuideBase (LONG);
VOID ExpungeDataBases (BOOL);
AMIGAGUIDECONTEXT OpenAmigaGuide (struct NewAmigaGuide *, ULONG);
AMIGAGUIDECONTEXT OpenAmigaGuideAsync (struct NewAmigaGuide *, ULONG);
VOID CloseAmigaGuide (AMIGAGUIDECONTEXT);
ULONG AmigaGuideSignal (AMIGAGUIDECONTEXT);
struct AmigaGuideMsg *GetAmigaGuideMsg (AMIGAGUIDECONTEXT);
VOID ReplyAmigaGuideMsg (struct AmigaGuideMsg *);
LONG SetAmigaGuideContext (AMIGAGUIDECONTEXT, ULONG, ULONG);
LONG SendAmigaGuideContext (AMIGAGUIDECONTEXT, ULONG);
LONG SendAmigaGuideCmd (AMIGAGUIDECONTEXT, STRPTR, ULONG);
LONG SetAmigaGuideHook (AMIGAGUIDECONTEXT, ULONG, VOID *(*func()), VOID *);
LONG SetAmigaGuideAttrsA (VOID *handle, struct TagItem *attrlist);
LONG GetAmigaGuideAttr (ULONG tag, VOID * handle, ULONG *storage);
LONG LoadXRef (BPTR lock, STRPTR name);
VOID ExpungeXRef (VOID);
ULONG AddAmigaGuideHost (struct Hook *, STRPTR name, struct TagItem *);
LONG RemoveAmigaGuideHost (AMIGAGUIDEHOST, struct TagItem *);
BPTR LockE (BPTR path, STRPTR name, LONG mode);
BPTR OpenE (BPTR path, STRPTR name, LONG mode);
BPTR CopyPathList (BPTR path);
BPTR AddPathEntries (BPTR path, STRPTR *array);
VOID FreePathList (BPTR path);
ULONG ParsePathString (STRPTR string, STRPTR *array, ULONG max);
APTR OpenDataBase (BPTR lock, STRPTR name);
LONG LoadNode (APTR cl, APTR db, APTR hn);
LONG UnloadNode (APTR cl, APTR db, APTR hn);
LONG CloseDataBase(APTR);
STRPTR GetAmigaGuideString (LONG id);

#endif	/* CLIB_AMIGAGUIDE_PROTOS_H */
