#ifndef VNC_VNCBASE_H
#define VNC_VNCBASE_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2021 THOR-Software inc.                      **
 ** Version 3.102                                       **
 **                                                     **
 ** program version 3.102 10 July 2021    THOR          **
 **                                                     **
 ** ViNCEd Library Base                                 **
 **-----------------------------------------------------**
 **                                                     **
 ** all use at your own risk,etc.,etc.                  **
 **                                                     **
 ** Everything declared as "reserved" or                **
 ** "not used" is NOT free for your use,                **
 ** it will propably used in a later release.           **
 ** All FREE entries are free for public                **
 ** use and are, if not otherwise noticed,              **
 ** initialized as ZERO                                 **
 *********************************************************/

#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif

#ifndef EXEC_LIBRARIES_H
#include <exec/libraries.h>
#endif

#ifndef EXEC_INTERRUPTS_H
#include <exec/interrupts.h>
#endif

#ifndef EXEC_PORTS_H
#include <exec/ports.h>
#endif

#ifndef EXEC_SEMAPHORES_H
#include <exec/semaphores.h>
#endif

#ifndef EXEC_EXECBASE_H
#include <exec/execbase.h>
#endif

#ifndef EXEC_IO_H
#include <exec/io.h>
#endif

#ifndef EXEC_DEVICES_H
#include <exec/devices.h>
#endif

#ifndef INTUITION_INTUITIONBASE_H
#include <intuition/IntuitionBase.h>
#endif

#ifndef GRAPHICS_GFXBASE_H
#include <graphics/GfxBase.h>
#endif

#ifndef DOS_DOS_H
#include <dos/dos.h>
#endif

#ifndef DOS_DOSEXTENS_H
#include <dos/dosextens.h>
#endif

#ifndef UTILITY_UTILITY_H
#include <utility/utility.h>
#endif

#ifndef VNC_PREFS_H
#include <vnc/prefs.h>
#endif

#ifndef VNC_WINDOW_H
#include <vnc/window.h>
#endif


/* The vnc.library base

        This one is READ ONLY!

        DO NOT TOUCH, use the library functions instead.

        Some of the library bases in here might get invalid,
        even if the library IS AVAILABLE.
        Disk based libraries are not held open by ViNCEd!
        BE WARNED!
*/

struct VNCBase {
        struct Library           vnc_Lib;       /* the exec lib node */
        UWORD                    vnc_wordfill1; /* LW alignment */
        struct IntuitionBase    *vnc_IntBase;   /* ptr to intuition */
        struct GfxBase          *vnc_GfxBase;   /* ptr to graphics */
        struct Library          *vnc_LayersBase;/* ptr to layers */
        struct DosLibrary       *vnc_DosBase;   /* ptr to dos */
        struct Device           *vnc_ConsoleBase; /* ptr to console */
        ULONG                    vnc_Flags;     /* see below */
        struct VNCPrefs         *vnc_Prefs;     /* current prefs.
                                                   DO NOT READ! Use
                                                   the library functions!*/

        BPTR                     vnc_Segment;   /* library segment */
        struct MsgPort          *vnc_InputPort; /* used for input.device */
        struct IOStdReq         *vnc_InputIO;   /* ditto */
        struct Interrupt        *vnc_Immediate; /* imm. input handler */
        struct Interrupt        *vnc_InputIRQ;  /* delayed input handler */
        struct IOStdReq         *vnc_ConsoleIO; /* console IO pkt */
        struct Library          *vnc_IffBase;   /* IFF if open.
                                                   DO NOT READ! Might get
                                                   invalid!*/
        struct ViNCWindow       *vnc_CurrentCN; /* foreground window */
        struct Library          *vnc_LocaleBase;/* locale.lib.
                                                   DO NOT READ! Might get
                                                   invalid!*/
        void                    *vnc_EdMenu;    /* Menu constructor, if
                                                   available */
        void                    *vnc_EditMenu;  /* reserved */
        char                    *vnc_ReqTitle;  /* TAB requester title */

        struct UtilityBase      *vnc_UtilityBase; /* ptr to utility, if
                                                   available */
        struct ExecBase         *vnc_SysBase;   /* ptr to exec for
                                                   speedup */
        char                    *vnc_SnipVec;   /* snip data. DO NOT
                                                   touch */
        void                    *vnc_Obsolete2; /* no longer used.
                                                   DO NOT touch! */
        struct MinList           vnc_VNCList;   /* list of all windows */
        struct MinList           vnc_UserList;  /* reserved */
        struct MinList           vnc_SnipList;  /* all hooks to call at
                                                   snip time,
                                                   obsolete */
        struct MinList           vnc_HookList;  /* all added hooks,
                                                   obsolete */
        struct SignalSemaphore   vnc_PrefsSema; /* access to prefs */
        struct SignalSemaphore   vnc_ListSema;  /* access to hook list */
        struct SignalSemaphore   vnc_SnipSema;  /* access to sniplist */
        struct SignalSemaphore   vnc_WindowSema;/* access to windowlist */

        struct MsgPort          *vnc_Supervisor;/* link to supervisor task */
        struct MsgPort          *vnc_SuperPort; /* send msgs there */
        struct Message          *vnc_DeathMsg;  /* send this to kill super */

        struct Library          *vnc_WBBase;    /* ptr to workbench lib
                                                   if open */

        struct Library          *vnc_IconBase;  /* ptr to icon base */
        struct Library          *vnc_Obsolete3; /* private, not guaranteed to be legal */
        struct Library          *vnc_AslBase;   /* private, do not use */
        struct Library          *vnc_TBIBase;   /* title button base, private */
        struct Library          *vnc_GadToolsBase; /* private */
        struct Library          *vnc_BTBase;    /* ButtonTextClass, private */
        struct Device           *vnc_InputBase; /* private, do not use */
        struct Library          *vnc_IconifyBase; /* IconifyImage, private */

        ULONG                    vnc_Obsolete4; /* no longer used */

        char                    *vnc_SuspendStr;/* string for suspend msg */
        char                    *vnc_CloseRqBody; /* close requester body
                                                     string */
        char                    *vnc_CloseRqOK; /* positive gadget */
        char                    *vnc_CloseRqCn; /* negative gadget */
        char                    *vnc_NoErrorStr; /* "no error" or localized
                                                    version */

        char                    *vnc_LoadFromStr; /* the hail text of the Open... requester */
        char                    *vnc_SaveToStr;   /* ... of Save As */
        char                    *vnc_LdHistoryStr;/* ... of Open History */
        char                    *vnc_SvHistoryStr;/* ... of Save As History */
        char                    *vnc_FailedLoad;  /* contents of the open fail requester */
        char                    *vnc_FailedSave;  /* contents of the save fail requester */
        char                    *vnc_UnknownError;/* error message if unknown */
        char                    *vnc_AcceptStr;   /* the contents of the accept button */
                                                  /* in a failure requester */

        char                    *vnc_PrivateStr;  /* what to display if
                                                    screen is private */
        char                    *vnc_DefaultStr;  /* default public screen
                                                    name */

        /* more stuff beyond this point, do not touch!*/
};


/* Note: If you MUST hold more than one semaphore at once, lock them
   in the following order to prevent deadlocks:

highest:       vnc_WindowSema in library        list of ViNCEd windows
               vcn_Semaphore in window          access to single window
                                                LockWindow(),UnLockWindow()
               vnc_SnipSema in library          access to snipvec
               vcn_OwnerSema in window          access to ownerlist
               vnc_PrefsSema in library         access to prefs
                                                LockPrefs(),UnLockPrefs()
lowest:        vnc_ListSema in library          access to hooklist


   Use the library functions to grand access where available!
*/


/* Defined flags in vnc_Flags: */

/* Library should be removed ?*/
#define VNC_FLUSHING_BIT        1
#define VNC_FLUSHING_MASK       (1L<<1)

/* library localized ?*/
#define VNC_LOCALIZED_BIT       4
#define VNC_LOCALIZED_MASK      (1L<<4)

/* welcome message printed ?*/
#define VNC_STARTUP_BIT         7
#define VNC_STARTUP_MASK        (1L<<7)

/* more private flags in here, do not set,
   clear or depend on them! */

#endif

