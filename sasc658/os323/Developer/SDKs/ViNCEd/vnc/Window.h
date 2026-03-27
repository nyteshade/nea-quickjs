#ifndef VNC_WINDOW_H
#define VNC_WINDOW_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2001 THOR-Software inc.                      **
 ** Version 3.85                                        **
 **                                                     **
 ** program version 3.85 13 May 2001    THOR            **
 **                                                     **
 ** ViNCEd Window: The main structure (ViNCWindow)      **
 **-----------------------------------------------------**
 **                                                     **
 ** all use at your own risk,etc.,etc.                  **
 **                                                     **
 ** Everything declared as "reserved" or                **
 ** "not used" is NOT free for your use,                **
 ** it will propably used in a later release.           **
 ** All FREE entries are free for public                **
 ** use and are, if not otherwise noted,                **
 ** initialized with ZERO                               **
 *********************************************************/

#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif

#ifndef EXEC_LIBRARIES_H
#include <exec/libraries.h>
#endif

#ifndef EXEC_PORTS_H
#include <exec/ports.h>
#endif

#ifndef EXEC_SEMAPHORES_H
#include <exec/semaphores.h>
#endif

#ifndef EXEC_IO_H
#include <exec/io.h>
#endif

#ifndef EXEC_DEVICES_H
#include <exec/devices.h>
#endif

#ifndef DEVICES_TIMER_H
#include <devices/timer.h>
#endif

#ifndef DEVICES_CONSOLE_H
#include <devices/console.h>
#endif

#ifndef DEVICES_CONUNIT_H
#include <devices/conunit.h>
#endif

#ifndef DEVICES_KEYMAP_H
#include <devices/keymap.h>
#endif

#ifndef GRAPHICS_CLIP_H
#include <graphics/clip.h>
#endif

#ifndef GRAPHICS_GFX_H
#include <graphics/gfx.h>
#endif

#ifndef GRAPHICS_RASTPORT_H
#include <graphics/rastport.h>
#endif

#ifndef GRAPHICS_TEXT_H
#include <graphics/text.h>
#endif

#ifndef UTILITY_TAGITEM_H
#include <utility/tagitem.h>
#endif

#ifndef INTUITION_INTUITION_H
#include <intuition/intuition.h>
#endif

#ifndef INTUITION_SCREENS_H
#include <intuition/screens.h>
#endif

#ifndef DOS_DOS_H
#include <dos/dos.h>
#endif

#ifndef DOS_DOSEXTENS_H
#include <dos/dosextens.h>
#endif

#ifndef WORKBENCH_WORKBENCH_H
#include <workbench/workbench.h>
#endif

#ifndef VNC_VNCBASE_H
#include <vnc/vncbase.h>
#endif

#ifndef VNC_PREFS_H
#include <vnc/prefs.h>
#endif

#ifndef VNC_OWNER_H
#include <vnc/owner.h>
#endif

#ifndef VNC_DYNAMICS_H
#include <vnc/dynamics.h>
#endif

#ifndef VNC_KEYBOARD_H
#include <vnc/keyboard.h>
#endif


/* This is the description of the main structure of ViNCEd, the
   ViNCWindow. It is linked to a group of "owners" that share
   a common output window. This window is described by this structure */

struct ViNCWindow {
        struct ViNCWindow       *vcn_succ,*vcn_pred; /* linked list in
                                                        library base */
        UWORD                    vcn_Version;        /* version information */
        UWORD                    vcn_Revision;
        struct SignalSemaphore   vcn_Semaphore;      /* access grant. DO
                                                        NOT TOUCH. Use
                                                        LockWindow(),
                                                        UnLockWindow()! */
        UWORD                    vcn_OpenCount;      /* times DOS Open'd
                                                        this. No lock count,
                                                        no asyncs here */

/* base pointers */
        struct VNCBase          *vcn_VNCBase;        /* library base */
        void                    *reserved;           

/* important flags */
        ULONG                    vcn_Flags;
        ULONG                    vcn_ExtFlags;       /* even more */
        ULONG                    vnc_EventFlags;     /* received events */
        ULONG                    vcn_DOSFlags;       /* much more */
        ULONG                    vcn_RequestedEvents;/* receive which input
                                                        events */

/* links to the system */
        struct Window           *vcn_Window;    /* the intuition window,
                                                   if open */
        struct ViNCNewWindow    *vcn_NewWindow; /* temporary for reopen */
        struct RastPort         *vcn_RastPort;  /* private one, for drawing*/
        struct Layer            *vcn_Layer;     /* the layer */
        struct Screen           *vcn_Screen;    /* the screen the window is
                                                   displayed on, if open */
        struct TmpRas           *vcn_TmpRas;    /* used to speedup
                                                   scrolling */
        struct TextFont         *vcn_TextFont;  /* text used for rendering*/
        void                    *vcn_MemPool;   /* ViNCEd's private memory
                                                   pool. Do not touch, THIS
                                                   IS NOT EXEC COMPATIBLE
                                                   Use AllocEdMem(),
                                                   FreeEdMem() to make use
                                                   of this pool */

        struct DosList          *vcn_DeviceNode; /* no BPTR! Pointer to
                                                    dos device entry */

        struct ConUnit          *vcn_ConUnit;   /* ConUnit for backwards
                                                   compatibility. Do not
                                                   use this. */

        struct KeyMap           *vcn_KeyMap;    /* used keyboard. This is
                                                   a console compatible
                                                   keyboard, not the
                                                   VNC extensions */

        UWORD                   *vcn_TabStops;  /* array of TAB positions*/


/* size of window and font */

        UWORD                    vcn_TXSize;
        UWORD                    vcn_TYSize;    /* Size of the font */

        UWORD                    vcn_TBaseLine; /* text base line */

        UWORD                    vcn_TotalCount;/* total open count of
                                                   all structures.
                                                   The handler is allowed
                                                   to leave not until this
                                                   is zero */
        UWORD                    vcn_LeftOffset;/* text starting offset
                                                   in the window */
        UWORD                    vcn_TopOffset; /* same, but vertical */
        UWORD                    vcn_RightOffset;
        UWORD                    vcn_BottomOffset; /* for mini clipping */

        UWORD                    vcn_Width;
        UWORD                    vcn_Height;    /* available area for
                                                   drawing in pixels */

        UWORD                    vcn_CWidth;
        UWORD                    vcn_CHeight;   /* same in characters */

        UWORD                    vcn_BProtLeft;
        UWORD                    vcn_BProtTop;
        UWORD                    vcn_BPropRight;
        UWORD                    vcn_BPortBottom;
                                                /* border protection
                                                   zone, used to avoid
                                                   printing of italics
                                                   into the border */
        UWORD                    vcn_RightScroll;
        UWORD                    vcn_LeftScroll;/* scrolling margins*/


/* system lists. None of these lists should be used directly. Use the
   library functions to modify them. */

        struct MinList           vcn_reservedlist; /* not yet used */
        struct MinList           vcn_MemBlockList; /* dynamic memory pool*/
        struct MinList           vcn_InputBList;   /* history */
        struct MinList           vcn_ButtonList;   /* buttons */
        struct MinList           vcn_ReceivedReads;/* Read() pkt's Q here */
        struct MinList           vcn_ReceivedWrites;/* Write()'s Q here */
        struct MinList           vcn_OwnerList;    /* list of owners, i.e.
                                                      named consoles.
                                                      !WARNING! Semaphore
                                                      protected! DO NOT
                                                      TOUCH! LockWindow()
                                                      is NOT ENOUGH here! */
        struct MinList           vcn_UpperLineList;/* upper lines */
        struct MinList           vcn_LowerLineList;/* lower lines */
        struct MinList           vcn_TopLineList;  /* lines above the scroll region */
        struct MinList           vcn_BottomLineList;/* lines below the scroll region */
        struct MinList           vcn_MacroList;    /* user macros */

/* position of window & cursor */

        UWORD                    vcn_CursorX;
        UWORD                    vcn_CursorY;      /* cursor position */
        UWORD                    vcn_ScrollX;      /* horizontal scrolling */
        UWORD                    vcn_GfxScrollX;   /* and what's seen on
                                                      the screen */

        UWORD                    vcn_SearchX;      /* private for history
                                                      searching */
        UWORD                    vcn_DOSX;         /* DOS cursor location for
                                                      mask input hack */

        UBYTE                    vcn_RefreshBits; /* window refresh mode,
                                                     see below */
        UBYTE                    vcn_RefreshCounter;/* times the refresh
                                                      was requested */
        WORD                     vcn_DeltaScroll;   /* amount of lines
                                                      scrolled while output
                                                      disabled */
        UWORD                    vcn_BlockX;
        UWORD                    vcn_BlockY;  /* position of end of block */

        UWORD                    vcn_MenuNumber; /* menu selected last */
        UWORD                    vcn_MenuQualifier; /* last menu qualifier */

        struct Gadget           *vcn_PressedGadget; /* gadget hold down, or
                                                      NULL */

/* colors and types. All come in packed version, see vnc/dynamics.h */

        UBYTE                    vcn_CurrentLineType; /* copy of cur. line */
        UBYTE                    vcn_CurrentLineMask; /* bitplane mask */

        UBYTE                    vcn_CurrentPenPair; /* colors and */
        UBYTE                    vcn_CurrentType;    /* draw mode, packed*/

        UBYTE                    vcn_UserPenPair;
        UBYTE                    vcn_UserType;   /* input style characters*/

        UBYTE                    vcn_DOSPenPair;
        UBYTE                    vcn_DOSType;    /* dos (output) char's */

        UBYTE                    vcn_BackFillPenPair;
        UBYTE                    vcn_BackFillType;  /* only BPen used */

        UBYTE                    vcn_PlaneMaskPenPair;
        UBYTE                    vcn_PlaneMaskType;
                                        /* used for concurrent mode */

/* current lines, in the screen and in the buffer,
   line pointers, get adjusted if lines move in memory.
   See dynamics.h */

        struct DynLine          *vcn_CurrentLine; /* or NULL */
        struct DynLine          *vcn_CurrentInput;/* current history line */
        struct DynLine          *vcn_LineObs;     /* obsolete */
        struct DynLine          *vcn_AnchorLine;  /* for block marking */

        UWORD                    vcn_CurrentY;    /* position of line in
                                                   buffer */
        UWORD                    vcn_AnchorLineX; /* reserved */
        UWORD                    vcn_AnchorX;
        UWORD                    vcn_AnchorY;    /* anchor position of
                                                   current block */

/* line counters and thresholds */
        UWORD                    vcn_InpCount;  /* current size of history */
        UWORD                    vcn_InpMax;    /* maximal size of history */

        UWORD                    vcn_UpperCount;
        UWORD                    vcn_UpperMax;   /* same for upper lines */

        UWORD                    vcn_LowerCount;
        UWORD                    vcn_LowerMax;   /* same for lower lines */


/* internal buffers and their size */
        struct  VCharLine       *vcn_EditBuffer; /* contains current line */
        char                    *vcn_SearchBuffer; /* for history search */
        char                    *vcn_RawKeyBuffer; /* for RawKeyConvert */

/* additional flags */
        ULONG                    vcn_MoreFlags;  /* even more flags */
        ULONG                    vcn_MoreDOSFlags;
        ULONG                    vcn_MoreExtFlags;
        ULONG                    vcn_obsolete1;

/* more buffers and buffer support */
        char                    *vcn_CutBuffer;  /* actually, the Yank buffer
                                                    for ^K, ^Y */
        char                    *vcn_CommandBuffer; /* reserved */
        char                    *vcn_WindowTitle;   /* untranslated */
        char                    *vcn_ScreenTitle;   /* untranslated */
        char                    *vcn_PubScreenName; /* like it says */

        char                    *vnc_ProjectName;   /* last name used for
                                                       open or empty string
                                                       256 bytes long */
        char                    *vcn_HistoryName;   /* last name used
                                                       for the history.
                                                       open or empty string
                                                       256 bytes long */
        struct Message          *vcn_CurrentSnip;   /* snip in progress. Private */
        struct DynLine          *vcn_TABLineObs;    /* obsolete */

        struct ViNCExtMap       *vcn_ExtKeyMap;     /* the extended keymap
                                                       definition */
        void                    *vcn_KeymapThread;  /* the keyboard parser
                                                       thread for user
                                                       input */
        void                    *vcn_InputThread;   /* the keyboard parser
                                                       thread for parsing
                                                       external data */
        void                    *vcn_MacroThread;   /* keyboard parser
                                                       thread for expanding
                                                       macros */

        UWORD                    vcn_reserved;

        UWORD                    vnc_ColumnCount;   /* extend of visible lines */
        UWORD                    vcn_EditSize;   /* contents of the EditBuffer */
        UWORD                    vcn_SearchSize; /* private for history */
        UWORD                    vcn_RawKeySize; /* cached keystrokes */
        UWORD                    vcn_DOSSize;    /* obsolete */
        UWORD                    vcn_ASCSize;    /* obsolete */
        UWORD                    vcn_CutSize;


/* ports, iorequests and signal masks */

        struct MsgPort          *vcn_WindowPort; /* not IDCMP, private!*/
        ULONG                    vcn_WindowSignalMask;

        struct MsgPort          *vcn_DOSPort;    /* port of NULL owner */
        ULONG                    vcn_DOSSignalMask;

        struct MsgPort          *vcn_IOPort;     /* generic port for
                                                   IO interaction */
        ULONG                    vcn_IOSignalMask;

        struct IOStdReq         *vcn_ConsoleIO; /* for console IO */
        struct timerequest      *vcn_TimerIO;
        struct IOStdReq         *vcn_InputIO;
        struct IOStdReq         *vcn_UserIORequest;
                                        /* given to user by dos packet
                                           for pseudo communication
                                           with the console device.
                                           Should not be relied on. */

/* colors and more. Added in V2.36 */

        UBYTE                    vcn_MenuDetailPen;
        UBYTE                    vcn_MenuBlockPen;

        UBYTE                    vcn_GlobalRasterMask;
                                        /* used to speed up drawing */

        UBYTE                    vcn_GlobalInvertMask;
                                        /* used to draw the cursor */

/* gadgets and more. Please do not touch - these aren't the
   actual gadgets if boopsis are available! */

        struct Gadget           *vcn_ObsPropXGadget;
        struct Gadget           *vcn_ObsPropYGadget;    /* no longer used */
        struct Gadget           *vcn_CommandGadget;     /* reserved */

        struct Menu             *vcn_Menu;      /* the menu in the window */

        void                    *vcn_MenuRemember;
                              /* memory management for menu structs,
                                 ViNCEd internal, NOT INTUITION COMPATIBLE */

/* link to the dos */

        struct DosPacket        *vcn_CurrentDP;  /* packet in action */
        ULONG                    vcn_longreserved;

        struct ViOwner          *vcn_CurrentOwner;/* in foreground */
        struct ViOwner          *vcn_BREAKOwner;  /* ^C whom ? */
        struct ViOwner          *vcn_OpenOwner;   /* opened this window */

/* added these in 2.00 */

        struct DynLine          *vcn_DOSLine;   /* dos set cursor here */

        UWORD                    vcn_KeepOpenCounter;
                                        /* window iconification forbid */
        UWORD                    vcn_counterreserved;

/* added in 2.41 */

        UWORD                    vcn_TopLinesLast;
                                        /* first line in the scroll region */
        UWORD                    vcn_BottomLinesFirst;
                                        /* first line below scroll region */

        UWORD                    vcn_LeftColumns;
        UWORD                    vcn_RightColumns;  /* not yet used */

        UWORD                    vcn_ItalicLeft;
        UWORD                    vcn_ItalicRight;
                                        /* additional room for
                                           italic characters */

/* io requests for delay */

        struct timerequest      *vcn_ReservedTimerIO;
        struct timerequest      *vcn_DelayTimerIO;  /* for refresh */
        struct timerequest      *vcn_ScrollTimerIO; /* for scrolling */
        struct timerequest      *vcn_BlinkTimerIO;  /* for cursor blinking */

/* delay times in micros, see prefs.h */

        ULONG                    vcn_DoubleTABMicros;
        ULONG                    vcn_RebuildMicros;
        ULONG                    vcn_SlowMicros;
        ULONG                    vcn_BlinkMicros;

/* time stamp the gadget was pressed down */

        struct timeval           vcn_TimeDown;

/* added in 3.00 */

        UWORD                    vcn_SelectedLeftOffset;
        UWORD                    vcn_SelectedTopOffset;
        UWORD                    vcn_SelectedWidth;
        UWORD                    vcn_SelectedHeight;
                                /* borders set by CBM CSI sequences */

/* even more gadgets. DO NOT TOUCH! These aren't the actual gadgets
   if boopsis are available ! */

        struct Gadget           *vcn_LeftGadget;
        struct Gadget           *vcn_RightGadget;
        struct Gadget           *vcn_UpGadget;
        struct Gadget           *vcn_DownGadget; /* arrows */

        struct Gadget           *vcn_IconicGadget; /* iconification */

        struct Gadget           *vcn_FirstVNCGadget;
                                        /* first private gadget added to
                                           the window */
        UWORD                    vcn_ViNCNumGads; /* number of gad's added */
        UWORD                    vcn_ViNCGadPos;  /* at which position ?*/

/* dimensions of the sizing gadgets and arrows... */

        UWORD                    vcn_HorWidth;
        UWORD                    vcn_HorHeight;
        UWORD                    vcn_VertWidth;
        UWORD                    vcn_VertHeight; /* arrow gadgets */

        UWORD                    vcn_SizingWidth; /* dimension of the */
        UWORD                    vcn_SizingHeight;/* system sizing gadget */

        UWORD                    vcn_IconicWidth; /* dimension of the */
        UWORD                    vcn_IconicHeight;/* iconification gadget */

        UWORD                    vcn_LeftTitle;  /* free position near close */

        UWORD                    vcn_LeftButton; /* left edge of leftmost
                                                    button, relative to
                                                    rightmost edge */

        UWORD                    vcn_CloseWidth; /* width of the close
                                                   gadget */

        UWORD                    vcn_DimReserved;


/* Stuff needed for iconification */

        struct DiskObject       *vcn_IconicDOP; /* icon for iconification */
        struct AppIcon          *vcn_AppIcon;   /* the code we got from WB */
        UBYTE                    vcn_IconicCode;/* internal use... */
        UBYTE                    vcn_IconcRes[3]; /* reserved */
        char                    *vcn_IconTitle; /* the title, untranslated */

/* complete (unpacked) colors */

        UBYTE                    vcn_UserExtAPen;
        UBYTE                    vcn_UserExtBPen; /* user input colors */
        UBYTE                    vcn_UserExtMode;
        UBYTE                    vcn_UserExtReserved;

        UBYTE                    vcn_DOSExtAPen;
        UBYTE                    vcn_DOSExtBPen;
        UBYTE                    vcn_DOSExtMode; /* same for output */
        UBYTE                    vcn_DOSExtReserved;

        UBYTE                    vcn_BackExtAPen; /* unused */
        UBYTE                    vcn_BackExtBPen; /* backfill pen */
        UBYTE                    vcn_BackExtMode; /* unused */
        UBYTE                    vcn_BackExtReserved;

/* colors for rendering. Used by ViNCEd and SetVNC */

        UBYTE                    vcn_LightColor; /* shine pen */
        UBYTE                    vcn_DarkColor;  /* shadow pen */
        UBYTE                    vcn_FillColor;  /* background. =0 */
        UBYTE                    vcn_TextColor;  /* used for text */
        UBYTE                    vcn_MarkColor;  /* special text */
        UBYTE                    vcn_ArrowColor; /* colors of arrows */
        UBYTE                    vcn_ArrowLight;
        UBYTE                    vcn_ArrowDark; /* usually shine & shadow
                                                   but not in 1.2/1.3 */
        UBYTE                    vcn_FillTextColor; /* text in the bar */
        UBYTE                    vcn_reservedCols[3];

/* even more master pointers for the DynLines. Get relocated if
   lines move. For private use only! */

        APTR                    *vcn_1Handles;
        APTR                    *vcn_2Handles;
        APTR                    *vcn_3Handles;

/* screen support */

        ULONG                    vcn_ScreenSignalMask;
        UBYTE                    vcn_ScreenSignalBit; /* for pubscreen
                                                        close */
        UBYTE                    vcn_ScreenRes[3];

        struct Screen           *vcn_PubScreen; /* our public screen again,
                                                   if open */
        struct TextAttr          vcn_PrivAttr;  /* not used, but reserved */

        struct ViNCNewWindow    *vcn_LastNewWindow;
                                                /* used for re-opening */

/* final (ready for use) titles after translation */

        char                    *vcn_FinalTitle;
        char                    *vcn_FinalScreenTitle;
        char                    *vcn_FinalIconTitle;

/* again screen support */

        ULONG                    vcn_DefaultModeID; /* for screens */
        struct ViColorEntry      vcn_Colors[16];    /* current colors */


/* TABHook support */

        struct MsgPort          *vcn_TABHookPort;   /* for communications
                                                       with the ViNCFiler */
        UWORD                    vcn_CacheCount;    /* directories cached */
        UWORD                    vcn_CacheMax;      /* max. cache size */
        ULONG                    vcn_TABreserved2;

        struct timeval           vcn_TABTime;   /* time of last TAB */
        ULONG                    vcn_TABFlags;  /* private flags for
                                                   the TABHook */
        struct MinList           vcn_TABExpansionList; /* what has been
                                                         found */
        void                    *vcn_TABCurrentNode;
                                                /* do not care about it */

        struct ViOwner          *vcn_TABOwner;  /* who pressed TAB ?*/

        UWORD                    vcn_TABLineLen;
        UWORD                    vcn_TABCursorPos; /* and where ?*/

        char                    *vcn_TABPatBuf; /* expanded pattern. */
        char                    *vcn_TABRemainder; /* rest of the line */

        UWORD                    vcn_GluePos; /* where to glue in again */
        UWORD                    vcn_ArgNum; /* which argument to expand */
        UWORD                    vcn_PatPos; /* where's #? ?*/
        UBYTE                    vcn_LastTAB; /* last TAB id used */
        UBYTE                    vcn_TABReserved;

        struct AppWindow        *vcn_AppWindow; /* for icon drop */
        BPTR                     vcn_TABLock;   /* expansion list is
                                                   relative to this one */

        UWORD                    vcn_PathOnlyQualifier;
        UWORD                    vcn_NameOnlyQualifier;

/* more color support, version 3.33 and up */

        UBYTE                   *vnc_ANSIPenColors;/* 16 for the pens, 16
                                                     for the block hilite */
        UBYTE                   *vcn_ANSIAlloc;    /* Each byte for an
                                                      allocated pen */
/* default pens saved with CSI SPC s */

        UBYTE                   vcn_DefaultExtAPen;
        UBYTE                   vcn_DefaultExtBPen;
        UBYTE                   vcn_DefaultExtMode;
        UBYTE                   vcn_DefaultExtReserved;

/* default colors */

        struct ViColorEntry     vcn_DefaultColors[16];
        struct ViColorEntry     vcn_CursorColor;
        struct ViColorEntry     vcn_DefaultCursorColor;

/* TAB expansion priorities */

        struct ViTabPriors      vcn_ActivePrioSet;      /* currently used.
                                                           copied over on
                                                           expansion */
        struct ViTabPriors      vcn_TABPriors[6];       /* priority set */

        /* private fields beyond this point, do not read! */
};

/* The next one is used for OpenAWindow(), to attach an intuition window
   to a ViNCWindow */

struct ViNCNewWindow {
        WORD                     vnw_LeftEdge;
        WORD                     vnw_TopEdge; /* position. Set top to -1
                                                 to adjust to drag bar */
        WORD                     vnw_Width;
        WORD                     vnw_Height; /* size. Set to -1 to get
                                                maximal size */

        UBYTE                    vnw_Pens[2]; /* reserved. Must be -1,-1 */

        ULONG                    vnw_ViNCFlags; /* see below. No IDCMP! */

        /* note that no IDCMP flags are here! ViNCEd does not use the
           IDCMP, instead an input handler is used ! */

        ULONG                    vnw_WindowFlags;
                                                /* passed to intuition as
                                                   window flags */
        WORD                     vnw_AltLeftEdge;
        WORD                     vnw_AltTopEdge;
        WORD                     vnw_AltWidth;
        WORD                     vnw_AltHeight; /* alternate position */

        char                    *vnw_Title;     /* title of the screen,
                                                   including control code */
        void                    *vnw_Screen;    /* pointer to intuition
                                                   screen, or name of
                                                   public screen */
        struct BitMap           *vnw_BitMap;    /* for superbitmaps.
                                                   Works, but not
                                                   recommended */

        WORD                     vnw_MinWidth,vnw_MinHeight;
        WORD                     vnw_MaxWidth,vnw_MaxHeight;
                                                /* set to -1,-1 for maximal
                                                   dimension! */

        UWORD                    vnw_Type;      /* window type.
                                                   See below. */
        struct TagItem          *vnw_Tags;      /* expand on your own,
                                                   passed to intuition */

        struct Window           *vnw_UserWindow;
                                                /* set to install in own
                                                   window */

        char                    *vnw_ScreenTitle;

        ULONG                    vnw_MonitorID; /* for private screens */
        UWORD                    vnw_Depth;     /* for depth of screen */

        UBYTE                    vnw_Cols,vnw_Rows;
                                        /* dimensions in characters, if
                                           not zero */

        struct TextFont         *vnw_TextFont;
                                        /* Text Font to use */
};

/* Useful screen types */

/* open on workbench or on ViNCEd screen (set proper flags, see below) */
#define VNW_STYPE_WORKBENCH     1

/* open on custom screen */
#define VNW_STYPE_CUSTOM        15
/* vnw_Screen is a pointer to struct Screen */

/* open on public screen */
#define VNW_STYPE_PUBLIC        2
/* vnw_Screen is a pointer to char *, containing the name of
   the screen to open the window on */


/* Add the standard menu */
#define VNW_ADDMENU_BIT         30
#define VNW_ADDMENU_MASK        (1L<<30)

/* Add X prop gadget */
#define VNW_ADDPROPX_BIT        29
#define VNW_ADDPROPX_MASK       (1L<<29)

/* Add Y prop gadget */
#define VNW_ADDPROPY_BIT        28
#define VNW_ADDPROPY_MASK       (1L<<28)

/* Fall back to WB if custom/public screen not available */
#define VNW_PUBFALLBACK_BIT     27
#define VNW_PUBFALLBACK_MASK    (1L<<27)

/* screen title available */
#define VNW_WITHTITLE_BIT       26
#define VNW_WITHTITLE_MASK      (1L<<26)

/* chunky graphics ? This means that ViNCEd should not try to use
   graphics output optimizations. It will be usually smart enough
   not to turn them on on chunky screens anyways. */
#define VNW_CHUNKYPIXEL_BIT     25
#define VNW_CHUNKYPIXEL_MASK    (1L<<25)

/* shell window ? */
#define VNW_SHELL_BIT           24
#define VNW_SHELL_MASK          (1L<<24)

/* add buttons ? */
#define VNW_ADDBUTTONS_BIT      23
#define VNW_ADDBUTTONS_MASK     (1L<<23)

/* add iconify ? */
#define VNW_ADDICONIC_BIT       22
#define VNW_ADDICONIC_MASK      (1L<<22)

/* open on own screen? Set type to VNW_STYPE_WORKBENCH in this case */
#define VNW_PRIVSCREEN_BIT      21
#define VNW_PRIVSCREEN_MASK     (1L<<21)

/* remove dragbar ?*/
#define VNW_NODRAGBAR_BIT       20
#define VNW_NODRAGBAR_MASK      (1L<<20)

/* keep user window open ?*/
#define VNW_KEEPOPEN_BIT        19
#define VNW_KEEPOPEN_MASK       (1L<<19)

/* install ANSI colors ?*/
#define VNW_ANSIMODE_BIT        18
#define VNW_ANSIMODE_MASK       (1L<<18)

/* open window pre-iconified ?*/
#define VNW_ICONIFIED_BIT       17
#define VNW_ICONIFIED_MASK      (1L<<18)

/* Unlike with intuition windows, this structure MUST stay
   constant until the ViNCEd stream is closed down since
   it may happen that ViNCEd has to re-open the window. */

#endif

