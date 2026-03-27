#ifndef VNC_OWNER_H
#define VNC_OWNER_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2001 THOR-Software inc.                      **
 ** Version 3.85                                        **
 **                                                     **
 ** program version 3.85 13 May 2001    THOR            **
 **                                                     **
 ** ViNCEd Owner Definitions                            **
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

#ifndef EXEC_LISTS_H
#include <exec/lists.h>
#endif

#ifndef EXEC_PORTS_H
#include <exec/ports.h>
#endif

#ifndef EXEC_TASKS_H
#include <exec/tasks.h>
#endif

#ifndef DEVICES_TIMER_H
#include <devices/timer.h>
#endif

#ifndef DOS_DOS_H
#include <dos/dos.h>
#endif

#ifndef DOS_DOSEXTENS_H
#include <dos/dosextens.h>
#endif

#ifndef VNC_WINDOW_H
#include <vnc/window.h>
#endif

#ifndef VNC_VNCBASE_H
#include <vnc/vncbase.h>
#endif

/* The next one is a ViNCEd owner, i.e. the structure assosiated
   to all processes using the same named console for printing/reading.
   Owners setup the foreground/background mechanism, see the guide. */

struct ViOwner {
        struct MsgPort          vow_DOSPort;    /* put messages here */
                                                /* name is the name of the
                                                   console associated to it*/
        UWORD                   vow_UseCount;   /* counts # of times opened*/
        struct List             vow_ReceivedOutNodes;
                                                /* keeps outnodes, i.e. this
                                                   establishes the output
                                                   buffer */
        UWORD                   vow_OwnerMode;   /* console mode of
                                                    this owner */
        struct MsgPort         *vow_BreakPort;  /* send ^C where ?*/
        ULONG                   vow_RequestedEvents;
                                                /* send which
                                                   input events ?*/
        UWORD                   vow_OutSize;    /* size of the output
                                                   buffer */

        UWORD                   vow_ReadPointer;/* file pointer in output
                                                   buffer, set with SEEK */

        struct timerequest      vow_TimerIO;    /* used by WaitForChar */
        struct Message         *vow_messagedummy; /* internal use only */
        struct MsgPort         *vow_OwnerPort;  /* pointer to
                                                   this structure */
        ULONG                   vow_Type;       /* always A_Timer.
                                                   This fakes a DOSPacket */
        ULONG                   vow_resultdummy;/* another dummy for faking */

        struct MsgPort          vow_EventPort;  /* for incomming events */

        UWORD                   vow_WaitingReads; /* counts number of read
                                                     requests */

        ULONG                   vow_ParseFlags;   /* see below */
        struct MsgPort         *vow_ReadPort;   /* last reading port, invalid
                                                   if counter=0.
                                                   Used for TAB expansion */
        struct MsgPort         *vow_WritePort;  /* last port writing here.
                                                   Used for ^C */
        struct MsgPort         *vow_PendingPort; /* suspended task in ^Z */

        UWORD                   vow_IOBlockNest;   /* if <>0, all I/O of this
                                                      owner is suspended */
        UWORD                   vow_WaitingWrites; /* suspended write
                                                      requests */

        struct MinList          vow_SubOwnerList;  /* List of subowners */

        struct DosPacket       *vow_WaitPacket;    /* WaitForChar packet */

        /* private data beyond this point... do not touch */
};

/* The sub-owner structure is allocated once per stream (unlike the
   owner, which is allocated once per named console).
   This is what you find in your file handle */

struct SubOwner {
        struct SubOwner         *vsow_Next;
        struct SubOwner         *vsow_Pred;     /* linked list */
        UBYTE                    vsow_Type;
        UBYTE                    vsow_Pri;
        char                    *vsow_Name;     /* points to name of
                                                   the owner, i.e.
                                                   console name */
        UWORD                    vsow_cludgefill;
        struct Owner            *vsow_Owner;    /* subowner of which
                                                   owner */
        struct FileHandle       *vsow_Stream;   /* no BPTR! Stream
                                                   of this SubOwner */
        struct ViNCWindow       *vsow_Window;   /* pointer to main
                                                   structure */
        struct VNCBase          *vsow_VNCLibBase;
};

/* flags defined in vow_ParseFlags */

/* something saved back ? (ESC7,8) */
#define VOW_SAVEDBACK_BIT       0
#define VOW_SAVEDBACK_MASK      (1L<<0)

/* second screen buffer active ?*/
#define VOW_BUFFERTWO_BIT	1
#define VOW_BUFFERTWO_MASK	(1L<<1)

/* parsing in ESC or CSI ?*/
#define VOW_SEPARATEPARSE_BIT   8
#define VOW_SEPARATEPARSE_MASK  (1L<<8)

/* special character set codes */
#define VOW_FOUNDSS2_BIT        12
#define VOW_FOUNDSS3_MASK       (1L<<12)

/* special character set code 3 */
#define VOW_FOUNDSS3_BIT	13
#define VOW_FOOUNDSS3_MASK	(1L<<13)

/* got new read request, title must be rebuild */
#define VOW_GOTNEWREAD_BIT      29
#define VOW_GOTNEWREAD_MASK     (1L<<29)

/* owner is suspended, and message is printed */
#define VOW_SUSPENDED_BIT       31
#define VOW_SUSPENDED_MASK      (1L<<31)

#endif

