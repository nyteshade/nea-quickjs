/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2000 THOR-Software inc.                      **
 ** Version 3.73                                        **
 **                                                     **
 ** program version 3.73 30 Jul 2000    THOR            **
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
 **                                                     **
 ** AmigaE version: Tomasz Wiszkowski                   **
 **                                                     **
 *********************************************************/


OPT MODULE
OPT EXPORT

MODULE 'exec/semaphores',
       'exec/io',
       'exec/devices',
       'exec/ports',
       'exec/lists',
       'devices/timer',
       'devices/console',
       'devices/conunit',       
       'devices/keymap',
       'graphics/clip',
       'graphics/gfx',
       'graphics/rastport',
       'graphics/text',
       'intuition/intuition',
       'intuition/screens',
       'dos/dos',
       'dos/dosextens',
       'workbench/workbench',
       'vnc/keyboard',
       'vnc/dynamics',
       'vnc/prefs',
       'vnc/owner',
       'vnc/vncbase',
       'utility/tagitem'



/* This is the description of the main structure of ViNCEd, the
   ViNCWindow. It is linked to a group of "owners" that share
   a common output window. This window is described by this structure */

OBJECT vincwindow
   succ:PTR TO vincwindow  // linked list in
   pred:PTR TO vincwindow  // library base
   version:INT             // version information
   revision:INT            // access grant. DO NOT TOUCH.
                           // Use LockWindow(), UnLockWindow()!
   opencount:INT           // times DOS Open'd this. No lock count, no asyncs here

/* base pointers */
   vncbase:PTR TO vncbase  // library base
   reserved1:PTR TO CHAR   // used to be the user node, is now obsolete

/* important flags */
   flags
   extflags                // even more
   eventflags              // received events
   dosflags                // much more
   requestedevents         // receive which input events

/* links to the system */
   window:PTR TO window             // the intuition window, if open
   newwindow:PTR TO vincnewwindow   // temporary for reopen
   rastport:PTR TO rastport         // private one, for drawing
   layer:PTR TO layer               // the layer
   screen:PTR TO screen             // the screen the window is
                                    // displayed on, if open
   tmpras:PTR TO tmpras             // used to speedup scrolling
   textfont:PTR TO textfont         // text used for rendering
   mempool:PTR TO CHAR              // ViNCEd's private memory
                                    // pool. Do not touch, THIS
                                    // IS NOT EXEC COMPATIBLE
                                    // Use AllocEdMem(),
                                    // FreeEdMem() to make use
                                    // of this pool
   devicenode:PTR TO doslist        // no BPTR! Pointer to dos device entry
   conunit:PTR TO conunit           // ConUnit for backwards compatibility.
                                    // Do not use this.
   keymap:PTR TO keymap             // used keyboard. This is a console
                                    // compatible keyboard, not the VNC
                                    // extensions
   tabstops:PTR TO INT              // array of TAB positions


/* size of window and font */
   txsize:INT           //
   tysize:INT           // Size of the font
   tbaseline:INT        // text base line
   totalcount:INT       // total open count of all structures. The handler
                        // is allowed to leave not until this is zero
   leftoffset:INT       // text starting offset in the window
   topoffset:INT        // same, but vertical
   rightoffset:INT      //
   bottomoffset:INT     // for mini clipping
   width:INT            //
   height:INT           // available area for drawing in pixels
   cwidth:INT           //
   cheight:INT          // same in characters
   bprotleft:INT        // border protection
   bprottop:INT         // zone, used to avoid
   bprotright:INT       // printing of italics
   bprotbottom:INT      // into the border

   rightscroll:INT      //
   leftscroll:INT       // scrolling margins

/* system lists. None of these lists should be used directly. Use the
   library functions to modify them. */

   reservedlist:mlh     // not yet used
   memblocklist:mlh     // dynamic memory pool
   inputblist:mlh       // history
   buttonlist:mlh       // buttons
   receivedreads:mlh    // Read() pkt's Q here
   receivedwrites:mlh   // Write()'s Q here
   ownerlist:mlh        // list of owners, i.e. named consoles.
                        // !WARNING! Semaphore protected! DO NOT TOUCH!
                        // LockWindow() is NOT ENOUGH here!
   upperlinelist:mlh    // upper lines
   lowerlinelist:mlh    // lower lines
   spare2list:mlh       // also free
   hooklist:mlh         // window wide hooks, to be removed...
   macrolist:mlh        // user macros


/* position of window & cursor */
   cursorx:INT                   //
   cursory:INT                   // cursor position
   scrollx:INT                   // horizontal scrolling
   gfxscrollx:INT                // and what's seen on the screen
   searchx:INT                   // private for history searching
   dosx:INT                      // DOS cursor location for mask input hack
   refreshbits:CHAR              // window refresh mode, see below
   refreshcounter:CHAR           // times the refresh was requested
   deltascroll:INT               // amount of lines scrolled while output disabled
   blockx:INT                    //
   blocky:INT                    // position of end of block
   menunumber:INT                // menu selected last
   menuqualifier:INT             // last menu qualifier
   pressedgadget:PTR TO gadget   // gadget hold down, or NULL

/* colors and types. All come in packed version, see vnc/dynamics.h */
   actuallinetype:CHAR  // copy of cur. line
   actuallinemask:CHAR  // bitplane mask
   actualpenpair:CHAR   // colors and
   actualtype:CHAR      // draw mode, packed
   userpenpair:CHAR     //
   usertype:CHAR        // input style characters
   dospenpair:CHAR      //
   dostype:CHAR         // dos (output) char's 
   backfillpenpair:CHAR //
   backfilltype:CHAR    // only BPen used 
   planemaskpenpair:CHAR//
   planemasktype:CHAR   // used for concurrent mode

/* actual lines, in the screen and in the buffer,
   line pointers, get adjusted if lines move in memory.
   See dynamics.h */

   actualline:PTR TO dynline     // or NULL
   actualinput:PTR TO dynline    // current history line
   lineptr:PTR TO dynline        // general purpose auto adjust pointer
   anchorline:PTR TO dynline     // for block marking

   actualy:INT                   // position of line in buffer
   anchorlinex:INT               // reserved
   anchorx:INT
   anchory:INT                   // anchor position of current block

/* line counters and thresholds */
   inpcount:INT      // current size of history
   inpmax:INT        // maximal size of history
                     //
   uppercount:INT    //
   uppermax:INT      // same for upper lines
                     //
   lowercount:INT    //
   lowermax:INT      // same for lower lines


/* internal buffers and their size */
   editbuffer:PTR TO vcharline   // contains current line
   searchbuffer:PTR TO CHAR      // for history search
   rawkeybuffer:PTR TO CHAR      // for RawKeyConvert

/* additional flags */
   moreflags      // even more flags
   moredosflags   // unused
   moreextflags   // unused
   obsolete1      //

/* more buffers and buffer support */
   cutbuffer:PTR TO CHAR      // actually, the Yank buffer for ^K, ^Y
   commandbuffer:PTR TO CHAR  // reserved
   windowtitle:PTR TO CHAR    // untranslated
   screentitle:PTR TO CHAR    // untranslated
   pubscreenname:PTR TO CHAR  // like it says
                              //
   projectname:PTR TO CHAR    // last name used for open or
                              // empty string 256 bytes long
   historyname:PTR TO CHAR    // last name used for the history.
                              // open or empty string 256 bytes long
   currentsnip:PTR TO mn      // snip in progress. Private
   tablineptr:PTR TO dynline  // strictly for the TABHook
                              //
   extkeymap:PTR TO vincextmap// the extended keymap definition
   keymapthread               // the keyboard parser thread for user input
   inputthread                // the keyboard parser thread for parsing external data
   macrothread                // keyboard parser thread for expanding macros
                              //
   reserved[2]:ARRAY OF LONG  //
   editsize:INT               // contents of the EditBuffer
   searchsize:INT             // private for history
   rawkeysize:INT             // cached keystrokes
   dossize:INT                // obsolete
   ascsize:INT                // obsolete
   cutsize:INT                //


/* ports, iorequests and signal masks */

   windowport:PTR TO mp       // not IDCMP, private!
   windowsignalmask           //
   dosport:PTR TO mp          // port of NULL owner
   dossignalmask              //
   ioport:PTR TO mp           // generic port for IO interaction
   iosignalmask               //
   consoleio:PTR TO iostd     // for console IO
   timerio:PTR TO timerequest //
   inputio:PTR TO iostd       //
   useriorequest:PTR TO iostd // given to user by dos packet for pseudo
                              // communication with the console device.
                              // Should not be relied on.

/* colors and more. Added in V2.36 */

   menudetailpen:CHAR      //
   menublockpen:CHAR       //

   globalrastermask:CHAR   // used to speed up drawing
   globalinvertmask:CHAR   // used to draw the cursor

/* gadgets and more. Please do not touch - these aren't the
   actual gadgets if boopsis are available! */

   propxgadget:PTR TO gadget     //
   propygadget:PTR TO gadget     //
   commandgadget:PTR TO gadget   // reserved 
   menu:PTR TO menu              // the menu in the window 
   menuremember                  // memory management for menu structs,
                                 // ViNCEd internal, NOT INTUITION COMPATIBLE

/* link to the dos */

   actualdp:PTR TO dospacket  // packet in action
   longreserved               //
                              //
   actualowner:PTR TO viowner // in foreground
   breakowner:PTR TO viowner  // ^C whom ?
   openowner:PTR TO viowner   // opened this window

/* added these in 2.00 */

   dosline:PTR TO dynline     // dos set cursor here
                              //
   keepopencounter:INT        // window iconification forbid
   counterreserved:INT        //

/* added in 2.41 */

   toprows:INT                //
   bottomrows:INT             // scrolling borders, CSI R
   leftcolumns:INT            //
   rightcolumns:INT           // not yet used 
   italicleft:INT             //
   italicright:INT            // additional room for italic characters

/* io requests for delay */

   privatetimerio:PTR TO timerequest   // intuition delay
   delaytimerio:PTR TO timerequest     // for refresh
   scrolltimerio:PTR TO timerequest    // for scrolling
   blinktimerio:PTR TO timerequest     // for cursor blinking

/* delay times in micros, see prefs.h */

   delaymicros
   rebuildmicros
   slowmicros
   blinkmicros

/* time stamp the gadget was pressed down */

   timedown:timeval

/* added in 3.00 */

   selectedleftoffset:INT
   selectedtopoffset:INT
   selectedwidth:INT
   selectedheight:INT      // borders set by CBM CSI sequences

/* even more gadgets. DO NOT TOUCH! These aren't the actual gadgets
   if boopsis are available ! */

   leftgadget:PTR TO gadget      //
   rightgadget:PTR TO gadget     //
   upgadget:PTR TO gadget        //
   downgadget:PTR TO gadget      // arrows 
   iconicgadget:PTR TO gadget    // iconification 
   firstvncgadget:PTR TO gadget  // first private gadget added to the window
   vincnumgads:INT               // number of gad's added
   vincgadpos:INT                // at which position ?

/* dimensions of the sizing gadgets and arrows... */

   horwidth:INT
   horheight:INT
   vertwidth:INT
   vertheight:INT       // arrow gadgets
   sizingwidth:INT      // dimension of the
   sizingheight:INT     // system sizing gadget
   iconicwidth:INT      // dimension of the
   iconicheight:INT     // iconification gadget
   lefttitle:INT        // free position near close
   leftbutton:INT       // left edge of leftmost button, relative to rightmost edge 
   closewidth:INT       // width of the close gadget
   dimreserved:INT      //


/* Stuff needed for iconification */

   iconicdop:PTR TO diskobject   // icon for iconification
   appicon:PTR TO appicon        // the code we got from WB
   iconiccode:CHAR               // internal use...
   iconcres[3]:ARRAY OF CHAR     // reserved
   icontitle:PTR TO CHAR         // the title, untranslated

/* complete (unpacked) colors */

   userextapen:CHAR        //
   userextbpen:CHAR        // user input colors
   userextmode:CHAR        //
   userextreserved:CHAR    //

   dosextapen:CHAR         //
   dosextbpen:CHAR         //
   dosextmode:CHAR         // same for output
   dosextreserved:CHAR     //

   backextapen:CHAR        // unused
   backextbpen:CHAR        // backfill pen
   backextmode:CHAR        // unused
   backextreserved:CHAR    //

/* colors for rendering. Used by ViNCEd and SetVNC */

   lightcolor:CHAR      // shine pen
   darkcolor:CHAR       // shadow pen
   fillcolor:CHAR       // background. =0
   textcolor:CHAR       // used for text
   markcolor:CHAR       // special text
   arrowcolor:CHAR      // colors of arrows
   arrowlight:CHAR      //
   arrowdark:CHAR       // usually shine & shadow but not in 1.2/1.3
   filltextcolor:CHAR   // text in the bar
   reservedcols[3]:ARRAY OF CHAR

/* even more master pointers for the DynLines. Get relocated if
   lines move. For private use only! */

   lineptra:PTR TO dynline
   lineptrb:PTR TO dynline
   lineptrc:PTR TO dynline

/* screen support */

   screensignalmask                    //
   screensignalbit:CHAR                // for pubscreen close
   screenres[3]:ARRAY OF CHAR          //
                                       //
   pubscreen:PTR TO screen             // our public screen again, if open
   privattr:textattr                   // not used, but reserved
   lastnewwindow:PTR TO vincnewwindow  // used for re-opening

/* final (ready for use) titles after translation */

   finaltitle:PTR TO CHAR
   finalscreentitle:PTR TO CHAR
   finalicontitle:PTR TO CHAR

/* again screen support */

   defaultmodeid                       // for screens
   colors[16]:ARRAY OF vicolorentry    // current colors


/* TABHook support */

   tabhookport:PTR TO mp      // for communications with the ViNCFiler
   cachecount:INT             // directories cached
   cachemax:INT               // max. cache size
   tabreserved2               //
                              //
   tabtime:timeval            // time of last TAB
   tabflags                   // private flags for the TABHook
   tabexpansionlist:mlh       // what has been found
   tabcurrentnode             // do not care about it
                              //
   tabowner:PTR TO viowner    // who pressed TAB ?
                              // 
   tablinelen:INT             //
   tabcursorpos:INT           // and where ?
                              //
   tabpatbuf:PTR TO CHAR      // expanded pattern.
   tabremainder:PTR TO CHAR   // rest of the line
                              //
   gluepos:INT                // where to glue in again
   argnum:INT                 // which argument to expand
   patpos:INT                 // where's #? ?
   tabreserved:INT            //
                              //
   appwindow:PTR TO appwindow // for icon drop
   tablock                    // expansion list is relative to this one
                              //
   pathonlyqualifier:INT      //
   nameonlyqualifier:INT      //

/* more color support, version 3.33 and up */

   ansipencolors:PTR TO CHAR  // 16 for the pens, 16 for the block hilite
   ansialloc:PTR TO CHAR      // Each byte for an allocated pen

/* default pens saved with CSI SPC s */

   defaultextapen:CHAR
   defaultextbpen:CHAR
   defaultextmode:CHAR
   defaultextreserved:CHAR

/* default colors */

   defaultcolors[16]:ARRAY OF vicolorentry
   cursorcolor:vicolorentry
   defaultcursorcolor:vicolorentry

/* TAB expansion priorities */

   activeprioset:vitabpriors           // currently used. copied over on expansion
   tabpriors[6]:ARRAY OF vitabpriors   // priority set

        /* private fields beyond this point, do not read! */
ENDOBJECT

/* The next node is definitly for your private use! ViNCEd does not
   touch it, except for one line master pointer that gets adjusted if
   the line moves... */

/* Valid flags in vcn_Flags can be found in vpf_Flags, see Prefs.h.
   Same goes for vcn_DOSFlags.
   ExtFlags are for internal use. Not documented cause they will
   change in the future.... */

/* Refresh modes... */

/* horizontal line */
CONST VCNR_HOR_BIT         = 0

/* vertical screen */
CONST VCNR_VERT_BIT        = 1

/* total refresh */
CONST VCNR_TOTAL_BIT       = 2

/* layer must be refreshed */
CONST VCNR_LAYER_BIT       = 3

/* currently refreshing */
CONST VCNR_REFRESHING_BIT  = 6

/* masking forbidden, gets calculated */
CONST VNCR_FULLMASK_BIT    = 7


/* The next one is used for OpenAWindow(), to attach an intuition window
   to a ViNCWindow */

OBJECT vincnewwindow
   leftedge:INT
   topedge:INT             // position. Set top to -1 to adjust to drag bar
   width:INT
   height:INT              // size. Set to -1 to get maximal size
   pens[2]:ARRAY OF CHAR   // reserved. Must be -1,-1
   vincflags               // see below. No IDCMP!

        /* note that no IDCMP flags are here! ViNCEd does not use the
           IDCMP, instead an input handler is used ! */

   windowflags             // passed to intuition as window flags
   altleftedge:INT
   alttopedge:INT
   altwidth:INT
   altheight:INT           // alternate position

   title:PTR TO CHAR       // title of the screen, including control code
   screen                  // pointer to intuition screen, or name of public screen
   bitmap:PTR TO bitmap    // for superbitmaps. Works, but not recommended

   minwidth:INT
   minheight:INT
   maxwidth:INT
   maxheight:INT           // set to -1,-1 for maximal dimension!

   type:INT                // window type. See below.
   tags:PTR TO tagitem     // expand on your own, passed to intuition

   userwindow:PTR TO window// set to install in own window

   screentitle:PTR TO CHAR //
   monitorid               // for private screens
   depth:INT               // for depth of screen 
   cols:CHAR
   rows:CHAR               // dimensions in characters, if not zero

   textfont:PTR TO textfont// Text Font to use
ENDOBJECT

/* Useful screen types */

/* open on workbench or on ViNCEd screen (set proper flags, see below) */
CONST VNW_STYPE_WORKBENCH     = 1

/* open on custom screen */
CONST VNW_STYPE_CUSTOM        = 15
/* vnw_Screen is a pointer to struct Screen */

/* open on public screen */
CONST VNW_STYPE_PUBLIC        = 2
/* vnw_Screen is a pointer to char *, containing the name of
   the screen to open the window on */


/* Add the standard menu */
CONST VNW_ADDMENU_BIT         = 30
CONST VNW_ADDMENU_MASK        = 1<<30

/* Add X prop gadget */
CONST VNW_ADDPROPX_BIT        = 29
CONST VNW_ADDPROPX_MASK       = 1<<29

/* Add Y prop gadget */
CONST VNW_ADDPROPY_BIT        = 28
CONST VNW_ADDPROPY_MASK       = 1<<28

/* Fall back to WB if custom/public screen not available */
CONST VNW_PUBFALLBACK_BIT     = 27
CONST VNW_PUBFALLBACK_MASK    = 1<<27

/* screen title available */
CONST VNW_WITHTITLE_BIT       = 26
CONST VNW_WITHTITLE_MASK      = 1<<26

/* chunky graphics ? This means that ViNCEd should not try to use
   graphics output optimizations. It will be usually smart enough
   not to turn them on on chunky screens anyways. */
CONST VNW_CHUNKYPIXEL_BIT     = 25
CONST VNW_CHUNKYPIXEL_MASK    = 1<<25

/* shell window ? */
CONST VNW_SHELL_BIT           = 24
CONST VNW_SHELL_MASK          = 1<<24

/* add buttons ? */
CONST VNW_ADDBUTTONS_BIT      = 23
CONST VNW_ADDBUTTONS_MASK     = 1<<23

/* add iconify ? */
CONST VNW_ADDICONIC_BIT       = 22
CONST VNW_ADDICONIC_MASK      = 1<<22

/* open on own screen? Set type to VNW_STYPE_WORKBENCH in this case */
CONST VNW_PRIVSCREEN_BIT      = 21
CONST VNW_PRIVSCREEN_MASK     = 1<<21

/* remove dragbar ?*/
CONST VNW_NODRAGBAR_BIT       = 20
CONST VNW_NODRAGBAR_MASK      = 1<<20

/* keep user window open ?*/
CONST VNW_KEEPOPEN_BIT        = 19
CONST VNW_KEEPOPEN_MASK       = 1<<19

/* install ANSI colors ?*/
CONST VNW_ANSIMODE_BIT        = 18
CONST VNW_ANSIMODE_MASK       = 1<<18

/* open window pre-iconified ?*/
CONST VNW_ICONIFIED_BIT       = 17
CONST VNW_ICONIFIED_MASK      = 1<<17

/* Unlike with intuition windows, this structure MUST stay
   constant until the ViNCEd stream is closed down since
   it may happen that ViNCEd has to re-open the window. */



