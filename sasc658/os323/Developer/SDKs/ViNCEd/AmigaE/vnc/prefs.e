OPT MODULE
OPT EXPORT
OPT PREPROCESS

/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2000 THOR-Software inc.                      **
 ** Version 3.70                                        **
 **                                                     **
 ** program version 3.70 27 Apr 2000    THOR            **
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
 **                                                     **
 ** AmigaE version: Tomasz Wiszkowski                   **
 **                                                     **
 *********************************************************/

MODULE 'vnc/keyboard'

/*************************************************
 ** VNCPrefs                                    **
 ** contains the preferences of                 **
 ** all VNC-windows                             **
 *************************************************/

CONST VPF_HEADERLONG          = $70004e75      /* moveq #0,d0:rts */
CONST VPF_MAGIC1              = "VNC©"
CONST VPF_MAGIC2              = "THOR"
CONST VPF_PREFVERSION         = 3
CONST VPF_PREFREVISION        = 3
                /* current version information */

CONST VPF_MAXBUTTONS          = 16
        /* maximal number of buttons here */

CONST VPF_MACROS              = 24
        /* current number of macros. DO NOT DEPEND ON THIS NUMBER !
           read the number of available macros from the structures
           below. */

CONST VPF_FUNCLENGTH          = 126
        /* maximal size of a macro */

CONST VPF_SHORTLENGTH         = 16
        /* maximal size of a button title */

CONST VPF_MACROLENGHT         = 32
        /* maximal size of a macro shortcut. This is only used internally.
           The display is cut down to this size, and an ellipsis is appended
           if oversized. */


OBJECT vicolorentry
   flags:INT   // color entry flags, see below
   red:INT
   green:INT   // 16 bit color
   blue:INT
ENDOBJECT

CONST VCE_SET_BIT     = 0
        /*set this to allocate the color */
CONST VCE_SET_MASK    = 1<<0

CONST VCE_ANSI_BIT    = 1
        /*set if this defines an ANSI pen */
CONST VCE_ANSI_MASK   = 1<<1


/* Keeps the TAB settings for one TAB expansion function */

OBJECT vitabpriors
   pathpri:CHAR      // priority for ordinary files in the path
   commandpri:CHAR   // priority for commands in C:
   residentpri:CHAR  // priority for resident commands
   infopri:CHAR      // priority for icons

   devicepri:CHAR    // priority for devices
   assignpri:CHAR    // priority for assigns
   volumepri:CHAR    // priority for volumes
   dirpri:CHAR       // priority for directories

   filepri:CHAR      // priority for ordinary files
   execpri:CHAR      // priority for executables
   scriptpri:CHAR    // priority for scipts

   expandflgs:CHAR   // flags, see below
ENDOBJECT

/* Enable doube TAB requester? */
CONST VTPF_DOUBLETAB_BIT      = 0
CONST VTPF_DOUBLETAB_MASK     = 1<<0

/* Enable first TAB expands fully? */
CONST VTPF_FULLFIRSTTAB_BIT   = 1
CONST VTPF_FULLFIRSTTAB_MASK  = 1<<1

/* Enable add VNC matches to requester? */
CONST VTPF_FOUNDREQ_BIT       = 2
CONST VTPF_FOUNDREQ_MASK      = 1<<2

/* Enable request if ambigous? */
CONST VTPF_AMBIGREQ_BIT       = 3
CONST VTPF_AMBIGREQ_MASK      = 1<<3


OBJECT vncprefs
   header            // should contain HEADERLONG
   magic1            // MUST contain MAGIC1 to be legal preferences
   magic2            // MUST contain MAGIC2
   version:INT       // version and...
   revision:INT      // revision of THIS structure, now 3.2
   flags             // bit settings, see below for definition
   fmask             // valid bits above
   dosflags          // more bit settings
   dosfmask          // valid bits
   historysize:INT   // # lines in the history
   macros:INT        // number of macro-strings defined here.
                     // NEED NOT to be VPF_MACROS!
   macrooffset       // offset of the macro-strings to the
                     // start-address of this structure,
                     // the strings are saved as NUL-
                     // terminated strings
   macrosize:INT     // max. length or macros: VPF_FUNCLENGTH

        /* The next ones are new to 2.00 */

   upperlines:INT    // upper display size
   lowerlines:INT    // lower display size

        /* New to 3.00 */

   delaymicros       // intuition delay micros,
                     // 320000 by default
   rebuildmicros     // rebuild delay
   slowmicros        // scroll threshold
   blinkmicros       // blink speed


   buttonoffset      // offset to button strings,
                     // NUL terminated strings, name and
                     // title alternating
   buttons:INT       // # of buttons
   buttonsize:INT    // VPF_SHORTLENGTH

        /* New to 3.30 */

   defmodeid         // default mode ID
   pathonlyq:INT     // path only icon drop modifier
   nameonlyq:INT     // name only icon drop modifier

   moreflags         // used since 3.40, see below
   morefmask         // mask for the field above. Now used

   reserved[2]:ARRAY OF LONG        // leave blank

   cursorcolor:vicolorentry         // the cursor color
   colors[16]:ARRAY OF vicolorentry // color definitions


        /* 3.60 expansions start here */

   tabexpmask:INT          // mask of valid bits in vtp_ExpandFlgs

   tabpriors:vitabpriors   // Expand Path
   srtpriors:vitabpriors   // Expand Short
   devpriors:vitabpriors   // Expand Devs
   dirpriors:vitabpriors   // Expand Dirs
   infpriors:vitabpriors   // Expand Icons
   altpriors:vitabpriors   // Expand Alt

   cachelines:INT          // size of the cache

   reqleft:INT             // requester position
   reqtop:INT              // default is -1,-1

   reqwidth:INT            // requester size
   reqheight:INT           // default is 0,0

   keyboard:vincextmap     // keyboard definition

/* More here... DO NOT ALLOCATE YOURSELF, USE THE vnc.library FUNCTIONS
   for handling or extracting the strings */
ENDOBJECT

/* Macros to extract the strings from this structure. Uhm, it's
   definitely easier to use the library functions Prefs2List and
   List2Prefs. */

#define VPF_FIRSTMACRO(prefs) (prefs+prefs::vncprefs.macrooffset)
                           /* How to get the first macro */

#define VPF_FIRSTBUTTON(prefs) (prefs+prefs::vncprefs.buttonoffset)
                           /* How to get the first button */

#define VPF_NEXTSTRING(macro)   (macro+StrLen(macro))
                           /* How to get the next string if you have one */


/* flags set in vpf_Flags:
   Huh, where did all these flags go in 3.60?
   Some of them are now TAB specific, and moved to
   ViTabPriors.vtp_ExpandFlgs.
   Some are simply obsolete because much more can be
   done with TAB priorities and the configurable keyboard */

/* DOS cursor mode */
CONST VPFF_DOSMODE_BIT                = 0
CONST VPFF_DOSMODE_MASK               = 1<<0

/* add close gadget by default */
CONST VPFF_NODEFAULTCLOSE_BIT         = 1
CONST VPFF_NODEFAULTCLOSE_MASK        = 1<<1

/* copy automatically ? */
CONST VPFF_AUTOCOPY_BIT               = 2
CONST VPFF_AUTOCOPY_MASK              = 1<<2

/* auto close queue ? */
CONST VPFF_ALLPENDING_BIT             = 3
CONST VPFF_ALLPENDING_MASK            = 1<<3

/* no middle mouse button ?*/
CONST VPFF_NOMMB_BIT                  = 9
CONST VPFF_NOMMB_MASK                 = 1<<9

/* shell mode by default ?*/
CONST VPFF_SHELLMODE_BIT              = 12
CONST VPFF_SHELLMODE_MASK             = 1<<12

/* CR inserts at line start?*/
CONST VPFF_CRMODE_BIT                 = 13
CONST VPFF_CRMODE_MASK                = 1<<13

/* cut inputs only ?*/
CONST VPFF_CUTMODE_BIT                = 15
CONST VPFF_CUTMODE_MASK               = 1<<15

/* disable iconify ?*/
CONST VPFF_NOICONIC_BIT               = 17
CONST VPFF_NOICONIC_MASK              = 1<<17

/* Early line feed ?*/
CONST VPFF_NCURSFIX_BIT               = 18
CONST VPFF_NCURSFIX_MASK              = 1<<18

/* keep bottom line adjusted ?*/
CONST VPFF_BOTTOMADJUST_BIT           = 21
CONST VPFF_BOTTOMADJUST_MASK          = 1<<21

/* overwrite mode ?*/
CONST VPFF_OVERWRITE_BIT              = 22
CONST VPFF_OVERWRITE_MASK             = 1<<22

/* delayed refresh ?*/
CONST VPFF_ALLOWDELAY_BIT             = 23
CONST VPFF_ALLOWDELAY_MASK            = 1<<23

/* wrap around buffer?*/
CONST VPFF_WRAP_BIT                   = 25
CONST VPFF_WRAP_MASK                  = 1<<25

/* close requester ?*/
CONST VPFF_CLOSEREQ_BIT               = 29
CONST VPFF_CLOSEREQ_MASK              = 1<<29

/* safer close ?*/
CONST VPFF_SAFERCLOSE_BIT             = 30
CONST VPFF_SAFERCLOSE_MASK            = 1<<30

/* close with macro ?*/
CONST VPFF_CLEVERSHUT_BIT             = 31
CONST VPFF_CLEVERSHUT_MASK            = 1<<31


/* flags in vpf_DOSFlags */

/* VT-220 compatibility? */
CONST VPFD_VT220MODE_BIT              = 1
CONST VPFD_VT220MODE_MASK             = 1<<1

/* underscore cursor ?*/
CONST VPFD_UNDERSCORE_BIT             = 4
CONST VPFD_UNDERSCORE_MASK            = 1<<4

/* dos inserts */
CONST VPFD_DOSINSERT_BIT              = 5
CONST VPFD_DOSINSERT_MASK             = 1<<5

/* blinking cursor */
CONST VPFD_BLINKING_BIT               = 6
CONST VPFD_BLINKING_MASK              = 1<<6

/* ANSI reverse coloring */
CONST VPFD_ANSIINVERSE_BIT            = 8
CONST VPFD_ANDIINVERSE_MASK           = 1<<8

/* numeric keypad for cursor functions ? */
CONST VPFD_NUMPADMODE_BIT             = 9
CONST VPFD_NUMPADMODE_MASK            = 1<<9

/* extended colors instead of bold? */
CONST VPFD_BOLDEXT_BIT                = 12
CONST VPFD_BOLDEXT_MASK               = 1<<12

/* do not scroll into the border? */
CONST VPFD_SHORTWINDOW_BIT            = 13
CONST VPFD_SHORTWINDOW_MASK           = 1<<13

/* inhibit scrolling?*/
CONST VPFD_NOXSCROLL_BIT              = 18
CONST VPFD_NOXSCROLL_MASK             = 1<<18

/* don't scroll at right border, break line */
CONST VPFD_SMALLSCROLL_BIT            = 19
CONST VPFD_SMALLSCROLL_MASK           = 1<<19

/* no backspace at start of line */
CONST VPFD_NOLINEBACK_BIT             = 20
CONST VPFD_NOLINEBACK_MASK            = 1<<20

/* erasing backspace */
CONST VPFD_ERASEINGBS_BIT             = 24
CONST VPFD_ERASEINGBS_MASK            = 1<<24

/* automatic paste disable */
CONST VPFD_AUTOPASTE_BIT              = 25
CONST VPFD_AUTOPASTE_MASK             = 1<<25

/* XTerm mode */
CONST VPFD_XTERMMODE_BIT              = 30
CONST VPFD_XTERMMODE_MASK             = 1<<30

/* ANSI mode by default */
CONST VPFD_ANSIDEFAULT_BIT            = 31
CONST VPFD_ANSIDEFAULT_MASK           = 1<<31


/* flags in vpf_MoreFlags, used since 3.40 */

/* hard bounded scroll borders? */
CONST VPFM_PARTIALSCROLL_BIT          = 0
CONST VPFM_PARTIALSCROLL_MASK         = 1<<0

/* asynchronious type ahead? */
CONST VPFM_TYPEAHEAD_BIT              = 1
CONST VPFM_TYPEAHEAD_MASK             = 1<<1

/* don't add horizontal scroller by default? */
CONST VPFM_NODEFPROPX_BIT             = 3
CONST VPFM_NODEFPROPX_MASK            = 1<<3

/* don't add vertical scroller by default? */
CONST VPFM_NODEFPROPY_BIT             = 4
CONST VPFM_NODEFPROPY_MASK            = 1<<4

/* enable scrollers in raw mode? */
CONST VPFM_ALLOWPROPRAW_BIT           = 5
CONST VPFM_ALLOWPROPRAW_MASK          = 1<<5

/* keep duplicates in the history? */
CONST VPFM_KEEPDOUBLES_BIT            = 15
CONST VPFM_KEEPDOUBLES_MASK           = 1<<15

/* ignore requester position? */
CONST VPFM_NOREQUESTPOSITION_BIT      = 18
CONST VPFM_NOREQUESTPOSITION_MASK     = 1<<18

