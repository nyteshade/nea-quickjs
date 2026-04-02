/*
 * quickjs_libinit.c — Minimal library initialization for quickjs.library
 *
 * This replaces the standard SAS/C libinit.o/libinitr.o modules with
 * a minimal implementation that does NOT copy or relocate the data
 * segment. This is necessary because quickjs.library uses DATA=FARONLY
 * (absolute 32-bit data addresses), so the data must stay wherever
 * LoadSeg placed it.
 *
 * The standard libinit.o copies the __MERGED near-data section to
 * after the library base and applies relocations.  With DATA=FARONLY,
 * the engine code uses absolute 32-bit references (not A4-relative),
 * so copying would leave CODE still pointing at the original data.
 *
 * NOTE: scnb.lib functions (vsprintf, etc.) are compiled with default
 * DATA=NEAR and access internal tables via A4-relative offsets.  All
 * library entry points must use __saveds so that A4 = _LinkerDB
 * before any scnb.lib call.  Link with SD (smalldata) so slink merges
 * all data/BSS hunks and _LinkerDB encompasses the scnb.lib near data.
 */

#define _USEOLDEXEC_ 1
#include <exec/types.h>
#include <exec/nodes.h>
#include <exec/memory.h>
#include <exec/resident.h>
#include <exec/libraries.h>
#include <proto/exec.h>
#include <string.h>

typedef LONG (*myPFL)();

/* Linker-generated symbols */
extern char __far _LibID[];
extern char __far _LibName[];
extern char __far RESLEN;
extern myPFL _LibFuncTab[];
extern long __far _LibVersion;
extern long __far _LibRevision;

#define MYVERSION  ((long)&_LibVersion)
#define MYREVISION ((long)&_LibRevision)

/* Library initialization table — referenced by libent.o */
struct InitTable {
    ULONG   *it_DataSize;
    myPFL   *it_FuncTable;
    APTR    it_DataInit;
    myPFL   it_InitFunc;
};

/* Forward declarations */
ULONG __asm _LibInit(register __a0 APTR seglist,
                     register __d0 struct Library *libbase);

/* C runtime init/term — normally called by c.o startup.
 * __fpinit runs _STI auto-constructors (FPU setup, library bases, etc.)
 * __fpterm runs _STD auto-destructors */
extern void __fpinit(void);
extern void __fpterm(void);

/* User hooks called by libinit.o — we provide them */
int  __saveds __asm __UserLibInit(register __a6 struct Library *libbase);
void __saveds __asm __UserLibCleanup(register __a6 struct Library *libbase);

struct InitTable __far _LibInitTab = {
    (long *)(&RESLEN + ((sizeof(struct Library) + 3) & ~3)),
    _LibFuncTab,
    NULL,
    _LibInit,
};

/*
 * _LibInit — called once when the library is first loaded.
 * Initializes the Library structure and runs C runtime auto-init.
 * Does NOT copy data (DATA=FARONLY uses absolute addresses).
 */
ULONG __asm _LibInit(register __a0 APTR seglist,
                     register __d0 struct Library *libbase)
{
    libbase->lib_Node.ln_Type = NT_LIBRARY;
    libbase->lib_Node.ln_Name = _LibName;
    libbase->lib_Flags = LIBF_SUMUSED | LIBF_CHANGED;
    libbase->lib_Version = MYVERSION;
    libbase->lib_Revision = MYREVISION;
    libbase->lib_IdString = (APTR)_LibID;

    return (ULONG)libbase;
}

/*
 * _LibOpen — called each time a task opens the library.
 */
LONG __asm _LibOpen(register __a6 struct Library *libbase)
{
    libbase->lib_OpenCnt++;
    libbase->lib_Flags &= ~LIBF_DELEXP;
    return (LONG)libbase;
}

/*
 * _LibClose — called each time a task closes the library.
 */
ULONG __asm _LibClose(register __a6 struct Library *libbase)
{
    ULONG retval = 0;

    if (--libbase->lib_OpenCnt == 0 &&
        (libbase->lib_Flags & LIBF_DELEXP))
    {
        /* Forward declare */
        ULONG __asm _LibExpunge(register __a6 struct Library *);
        retval = _LibExpunge(libbase);
    }
    return retval;
}

/*
 * _LibExpunge — called when Exec wants to free memory.
 * Returns the SegList if the library can be removed, 0 otherwise.
 */
ULONG __asm _LibExpunge(register __a6 struct Library *libbase)
{
    LONG libsize;

    libbase->lib_Flags |= LIBF_DELEXP;

    if (libbase->lib_OpenCnt > 0)
        return 0;  /* still in use, can't expunge */

    Remove((struct Node *)libbase);

    libsize = libbase->lib_NegSize + libbase->lib_PosSize;
    FreeMem((char *)libbase - libbase->lib_NegSize, (ULONG)libsize);

    return 0;
}
