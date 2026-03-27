#ifndef VNC_PREFS_H
#define VNC_PREFS_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2001 THOR-Software inc.                      **
 ** Version 3.85                                        **
 **                                                     **
 ** program version 3.85 13 May 2001    THOR            **
 **                                                     **
 ** ViNCEd Prefs Definitions                            **
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

#ifndef VNC_KEYBOARD_H
#include <vnc/keyboard.h>
#endif

/*************************************************
 ** VNCPrefs                                    **
 ** contains the preferences of                 **
 ** all VNC-windows                             **
 *************************************************/

#define VPF_HEADERLONG          0x70004e75      /* moveq #0,d0:rts */
#define VPF_MAGIC1              (('V'<<24L)|('N'<<16L)|('C'<<8L)|('©'))
#define VPF_MAGIC2              (('T'<<24L)|('H'<<16L)|('O'<<8L)|('R'))
#define VPF_PREFVERSION         3
#define VPF_PREFREVISION        3
                /* current version information */

#define VPF_MAXBUTTONS          16
        /* maximal number of buttons here */

#define VPF_MACROS              24
        /* current number of macros. DO NOT DEPEND ON THIS NUMBER !
           read the number of available macros from the structures
           below. */

#define VPF_FUNCLENGTH          126
        /* maximal size of a macro */

#define VPF_SHORTLENGTH         16
        /* maximal size of a button title */

#define VPF_MACROLENGHT         32
        /* maximal size of a macro shortcut. This is only used internally.
           The display is cut down to this size, and an ellipsis is appended
           if oversized. */


/* Definition of a color register */

struct ViColorEntry {
        UWORD   vce_Flags;      /* color entry flags, see below */
        UWORD   vce_Red,vce_Green,vce_Blue;        /* 16 bit color */
};

#define VCE_SET_BIT     0
        /*set this to allocate the color */
#define VCE_SET_MASK    (1L<<0)

#define VCE_ANSI_BIT    1
        /*set if this defines an ANSI pen */
#define VCE_ANSI_MASK   (1L<<1)


/* Keeps the TAB settings for one TAB expansion function */

struct ViTabPriors {
        BYTE    vtp_PathPri;    /* priority for ordinary files in the path */
        BYTE    vtp_CommandPri; /* priority for commands in C: */
        BYTE    vtp_ResidentPri;/* priority for resident commands */
        BYTE    vtp_InfoPri;    /* priority for icons */

        BYTE    vtp_DevicePri;  /* priority for devices */
        BYTE    vtp_AssignPri;  /* priority for assigns */
        BYTE    vtp_VolumePri;  /* priority for volumes */
        BYTE    vtp_DirPri;     /* priority for directories */

        BYTE    vtp_FilePri;    /* priority for ordinary files */
        BYTE    vtp_ExecPri;    /* priority for executables */
        BYTE    vtp_ScriptPri;  /* priority for scipts */

        UBYTE   vtp_ExpandFlgs; /* flags, see below */
};

/* Enable doube TAB requester? */
#define VTPF_DOUBLETAB_BIT      0
#define VTPF_DOUBLETAB_MASK     (1L<<0)

/* Enable first TAB expands fully? */
#define VTPF_FULLFIRSTTAB_BIT   1
#define VTPF_FULLFIRSTTAB_MASK  (1L<<1)

/* Enable add VNC matches to requester? */
#define VTPF_FOUNDREQ_BIT       2
#define VTPF_FOUNDREQ_MASK      (1L<<2)

/* Enable request if ambigous? */
#define VTPF_AMBIGREQ_BIT       3
#define VTPF_AMBIGREQ_MASK      (1L<<3)

/* Ignore inputs behind the cursor position? */
#define VTPF_PARTIAL_BIT        4
#define VTPF_PARTIAL_MASK       (1L<<4)

/* Print expansion results into the shell? */
#define VTPF_INTOSHELL_BIT      5
#define VTPF_INTOSHELL_MASK     (1L<<5)

struct VNCPrefs {
        ULONG vpf_Header;       /* should contain HEADERLONG */
        ULONG vpf_Magic1;       /* MUST contain MAGIC1 to be legal preferences */
        ULONG vpf_Magic2;       /* MUST contain MAGIC2 */
        UWORD vpf_Version;      /* version and... */
        UWORD vpf_Revision;     /* revision of THIS structure, now 3.3 */
        ULONG vpf_Flags;        /* bit settings, see below for definition */
        ULONG vpf_FMask;        /* valid bits above */
        ULONG vpf_DOSFlags;     /* more bit settings */
        ULONG vpf_DOSFMask;     /* valid bits */
        UWORD vpf_HistorySize;  /* # lines in the history */
        UWORD vpf_Macros;       /* number of macro-strings defined here.
                                   NEED NOT to be VPF_MACROS! */
        UWORD vpf_MacroOffset;   /* offset of the macro-strings to the
                                   start-address of this structure,
                                   the strings are saved as NUL-
                                   terminated strings */
        UWORD vpf_MacroSize;    /* max. length or macros: VPF_FUNCLENGTH */

        /* The next ones are new to 2.00 */

        UWORD vpf_UpperLines;   /* upper display size */
        UWORD vpf_LowerLines;   /* lower display size */

        /* New to 3.00 */

        ULONG vpf_TABMicros;    /* Double TAB micros */
        ULONG vpf_RebuildMicros;/* rebuild delay     */
        ULONG vpf_SlowMicros;   /* scroll threshold  */
        ULONG vpf_BlinkMicros;  /* blink speed       */


        UWORD vpf_ButtonOffset; /* offset to button strings,
                                   NUL terminated strings, name and
                                   title alternating */
        UWORD vpf_Buttons;      /* # of buttons */
        UWORD vpf_ButtonSize;   /* VPF_SHORTLENGTH */

        /* New to 3.30 */

        ULONG vpf_DefModeID;    /* default mode ID */
        UWORD vpf_PathOnlyQ;    /* path only icon drop modifier */
        UWORD vpf_NameOnlyQ;    /* name only icon drop modifier */

        ULONG vpf_MoreFlags;    /* used since 3.40, see below */
        ULONG vpf_MoreFMask;    /* mask for the field above. Now used */

        ULONG vpf_Reserved[2];  /* leave blank */

        struct ViColorEntry vpf_CursorColor;      /* the cursor color */
        struct ViColorEntry vpf_Colors[16];       /* color definitions */


        /* 3.60 expansions start here */

        UWORD vpf_TABExpMask;   /* mask of valid bits in vtp_ExpandFlgs */

        struct ViTabPriors vpf_TABPriors;       /* Expand Path */
        struct ViTabPriors vpf_SrtPriors;       /* Expand Short */
        struct ViTabPriors vpf_DevPriors;       /* Expand Devs */
        struct ViTabPriors vpf_DirPriors;       /* Expand Dirs */
        struct ViTabPriors vpf_InfPriors;       /* Expand Icons */
        struct ViTabPriors vpf_AltPriors;       /* Expand Alt */

        UWORD vpf_CacheLines;                   /* # of dirs in the cache */

        WORD vpf_ReqLeft;                       /* requester position */
        WORD vpf_ReqTop;                        /* default is -1,-1 */

        UWORD vpf_ReqWidth;                     /* requester size */
        UWORD vpf_ReqHeight;                    /* default is 0,0 */

        struct ViNCExtMap vpf_Keyboard;         /* keyboard definition */

/* More here... DO NOT ALLOCATE YOURSELF, USE THE vnc.library FUNCTIONS
   for handling or extracting the strings */

};

/* Macros to extract the strings from this structure. Uhm, it's
   definitely easier to use the library functions Prefs2List and
   List2Prefs. */

#define VPF_FIRSTMACRO(prefs) ((char *)(prefs)+(prefs)->vpf_MacroOffset)
                           /* How to get the first macro */

#define VPF_FIRSTBUTTON(prefs) ((char *)(prefs)+(prefs)->vpf_ButtonOffset)
                           /* How to get the first button */

#define VPF_NEXTSTRING(macro)   ((macro)+strlen(macro))
                           /* How to get the next string if you have one */


/* flags set in vpf_Flags:
   Huh, where did all these flags go in 3.60?
   Some of them are now TAB specific, and moved to
   ViTabPriors.vtp_ExpandFlgs.
   Some are simply obsolete because much more can be
   done with TAB priorities and the configurable keyboard */

/* DOS cursor mode */
#define VPFF_DOSMODE_BIT                0
#define VPFF_DOSMODE_MASK               (1L<<0)

/* add close gadget by default */
#define VPFF_NODEFAULTCLOSE_BIT         1
#define VPFF_NODEFAULTCLOSE_MASK        (1L<<1)

/* copy automatically ? */
#define VPFF_AUTOCOPY_BIT               2
#define VPFF_AUTOCOPY_MASK              (1L<<2)

/* auto close queue ? */
#define VPFF_ALLPENDING_BIT             3
#define VPFF_ALLPENDING_MASK            (1L<<3)

/* no middle mouse button ?*/
#define VPFF_NOMMB_BIT                  9
#define VPFF_NOMMB_MASK                 (1L<<9)

/* shell mode by default ?*/
#define VPFF_SHELLMODE_BIT              12
#define VPFF_SHELLMODE_MASK             (1L<<12)

/* CR inserts at line start?*/
#define VPFF_CRMODE_BIT                 13
#define VPFF_CRMODE_MASK                (1L<<13)

/* cut inputs only ?*/
#define VPFF_CUTMODE_BIT                15
#define VPFF_CUTMODE_MASK               (1L<<15)

/* disable iconify ?*/
#define VPFF_NOICONIC_BIT               17
#define VPFF_NOICONIC_MASK              (1L<<17)

/* Early line feed ?*/
#define VPFF_NCURSFIX_BIT               18
#define VPFF_NCURSFIX_MASK              (1L<<18)

/* keep bottom line adjusted ?*/
#define VPFF_BOTTOMADJUST_BIT           21
#define VPFF_BOTTOMADJUST_MASK          (1L<<21)

/* overwrite mode ?*/
#define VPFF_OVERWRITE_BIT              22
#define VPFF_OVERWRITE_MASK             (1L<<22)

/* delayed refresh ?*/
#define VPFF_ALLOWDELAY_BIT             23
#define VPFF_ALLOWDELAY_MASK            (1L<<23)

/* wrap around buffer?*/
#define VPFF_WRAP_BIT                   25
#define VPFF_WRAP_MASK                  (1L<<25)

/* close requester ?*/
#define VPFF_CLOSEREQ_BIT               29
#define VPFF_CLOSEREQ_MASK              (1L<<29)

/* safer close ?*/
#define VPFF_SAFERCLOSE_BIT             30
#define VPFF_SAFERCLOSE_MASK            (1L<<30)

/* close with macro ?*/
#define VPFF_CLEVERSHUT_BIT             31
#define VPFF_CLEVERSHUT_MASK            (1L<<31)


/* flags in vpf_DOSFlags */

/* VT-220 compatibility? */
#define VPFD_VT220MODE_BIT              1
#define VPFD_VT220MODE_MASK             (1L<<1)

/* underscore cursor ?*/
#define VPFD_UNDERSCORE_BIT             4
#define VPFD_UNDERSCORE_MASK            (1L<<4)

/* dos inserts */
#define VPFD_DOSINSERT_BIT              5
#define VPFD_DOSINSERT_MASK             (1L<<5)

/* blinking cursor */
#define VPFD_BLINKING_BIT               6
#define VPFD_BLINKING_MASK              (1L<<6)

/* ANSI reverse coloring */
#define VPFD_ANSIINVERSE_BIT            8
#define VPFD_ANDIINVERSE_MASK           (1L<<8)

/* numeric keypad for cursor functions ? */
#define VPFD_NUMPADMODE_BIT             9
#define VPFD_NUMPADMODE_MASK            (1L<<9)

/* extended colors instead of bold? */
#define VPFD_BOLDEXT_BIT                12
#define VPFD_BOLDEXT_MASK               (1L<<12)

/* do not scroll into the border? */
#define VPFD_SHORTWINDOW_BIT            13
#define VPFD_SHORTWINDOW_MASK           (1L<<13)

/* inhibit scrolling?*/
#define VPFD_NOXSCROLL_BIT              18
#define VPFD_NOXSCROLL_MASK             (1L<<18)

/* don't scroll at right border, break line */
#define VPFD_SMALLSCROLL_BIT            19
#define VPFD_SMALLSCROLL_MASK           (1L<<19)

/* no backspace at start of line */
#define VPFD_NOLINEBACK_BIT             20
#define VPFD_NOLINEBACK_MASK            (1L<<20)

/* erasing backspace */
#define VPFD_ERASEINGBS_BIT             24
#define VPFD_ERASEINGBS_MASK            (1L<<24)

/* automatic paste disable */
#define VPFD_AUTOPASTE_BIT              25
#define VPFD_AUTOPASTE_MASK             (1L<<25)

/* XTerm mode */
#define VPFD_XTERMMODE_BIT              30
#define VPFD_XTERMMODE_MASK             (1L<<30)

/* ANSI mode by default */
#define VPFD_ANSIDEFAULT_BIT            31
#define VPFD_ANSIDEFAULT_MASK           (1L<<31)


/* flags in vpf_MoreFlags, used since 3.40 */

/* hard bounded scroll borders? */
#define VPFM_PARTIALSCROLL_BIT          0
#define VPFM_PARTIALSCROLL_MASK         (1L<<0)

/* asynchronious type ahead? */
#define VPFM_TYPEAHEAD_BIT              1
#define VPFM_TYPEAHEAD_MASK             (1L<<<1)

/* don't add horizontal scroller by default? */
#define VPFM_NODEFPROPX_BIT             3
#define VPFM_NODEFPROPX_MASK            (1L<<3)

/* don't add vertical scroller by default? */
#define VPFM_NODEFPROPY_BIT             4
#define VPFM_NODEFPROPY_MASK            (1L<<4)

/* enable scrollers in raw mode? */
#define VPFM_ALLOWPROPRAW_BIT           5
#define VPFM_ALLOWPROPRAW_MASK          (1L<<5)

/* restrictive XTerm mode, do not allow cursor repositioning */
#define VPFM_FREEZEXTERM_BIT            14
#define VPFM_FREEZEXTERM_MASK           (1L<<14)

/* keep duplicates in the history? */
#define VPFM_KEEPDOUBLES_BIT            15
#define VPFM_KEEPDOUBLES_MASK           (1L<<15)

/* ignore requester position? */
#define VPFM_NOREQUESTPOSITION_BIT      18
#define VPFM_NOREQUESTPOSITION_MASK     (1L<<18)

#endif

