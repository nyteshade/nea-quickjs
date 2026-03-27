OPT MODULE
OPT EXPORT
OPT PREPROCESS

/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2000 THOR-Software inc.                      **
 ** Version 3.73                                        **
 **                                                     **
 ** program version 3.73 30 Jul 2000    THOR            **
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
 **                                                     **
 ** AmigaE version: Tomasz Wiszkowski                   **
 **                                                     **
 *********************************************************/

MODULE 'exec/interrupts',
       'exec/ports',
       'exec/semaphores',
       'exec/execbase',
       'exec/io',
       'exec/libraries',
       'exec/devices',
       'exec/lists',
       'intuition/intuitionbase',
       'graphics/gfxbase',
       'dos/dos',
       'dos/dosextens',
       'utility/utility',
       'vnc/prefs',
       'vnc/window'


/* The vnc.library base

        This one is READ ONLY!

        DO NOT TOUCH, use the library functions instead.

        Some of the library bases in here might get invalid,
        even if the library IS AVAILABLE.
        Disk based libraries are not held open by ViNCEd!
        BE WARNED!
*/

OBJECT vncbase
   lib:lib                          // the exec lib node
   wordfill1:INT                    // LW alignment
   intbase:PTR TO intuitionbase     // PTR TO intuition
   gfxbase:PTR TO gfxbase           // PTR TO graphics
   layersbase:PTR TO lib            // PTR TO layers
   dosbase:PTR TO doslibrary        // PTR TO dos
   consolebase:PTR TO dd            // PTR TO console
   flags                            // see below
   prefs:PTR TO vncprefs            // current prefs.
                                    // DO NOT READ! Use
                                    // the library functions!
   segment                          // library segment
   inputport:PTR TO mp              // used for input.device
   inputio:PTR TO iostd             // ditto
   immediate:PTR TO is              // imm. input handler
   inputirq:PTR TO is               // delayed input handler
   consoleio:PTR TO iostd           // console IO pkt
   iffbase:PTR TO lib               // IFF if open.
                                    // DO NOT READ! Might get
                                    // invalid!
   actualcn:PTR TO vincwindow       // foreground window
   localebase:PTR TO lib            // locale.lib.
                                    // DO NOT READ! Might get
                                    // invalid!
   edmenu                           // Menu constructor, if
                                    // available
   editmenu                         // reserved
   reqtitle:PTR TO CHAR             // TAB requester title
   utilitybase:PTR TO utilitybase   // PTR TO utility, if
                                    // available
   sysbase:PTR TO execbase          // PTR TO exec for
                                    // speedup
   snipvec:PTR TO CHAR              // snip data. DO NOT touch
   obsolete2:PTR TO CHAR            // no longer used. DO NOT touch!
   vnclist:mlh                      // list of all windows
   userlist:mlh                     // all registered users, reserved
   sniplist:mlh                     // all hooks to call at
                                    // snip time, obsolete
   hooklist:mlh                     // all added hooks, obsolete
   prefssema:ss                     // access to prefs
   listsema:ss                      // access to hook list
   snipsema:ss                      // access to sniplist
   windowsema:ss                    // access to windowlist
   supervisor:PTR TO mp             // link to supervisor task
   superport:PTR TO mp              // send msgs there
   deathmsg:PTR TO mn               // send this to kill super 
   wbbase:PTR TO lib                // PTR TO workbench lib if open 
   iconbase:PTR TO lib              // PTR TO icon base
   obsolete3:PTR TO lib             // private, not guaranteed to be legal
   aslbase:PTR TO lib               // private, do not use
   tbibase:PTR TO lib               // tool button base, private
   gadtoolsbase:PTR TO lib          // private
   btbase:PTR TO lib                // ButtonTextClass, private
   inputbase:PTR TO dd              // private, do not use
   morebases[1]:LONG                // reserved room
   obsolete4                        // no longer used 
   suspendstr:PTR TO CHAR           // string for suspend msg
   closerqbody:PTR TO CHAR          // close requester body string
   closerqok:PTR TO CHAR            // positive gadget
   closerqcn:PTR TO CHAR            // negative gadget
   noerrorstr:PTR TO CHAR           // "no error" or localized version 
   loadfromstr:PTR TO CHAR          // the hail text of the Open... requester
   savetostr:PTR TO CHAR            // ... of Save As
   ldhistorystr:PTR TO CHAR         // ... of Open History
   svhistorystr:PTR TO CHAR         // ... of Save As History
   failedload:PTR TO CHAR           // contents of the open fail requester
   failedsave:PTR TO CHAR           // contents of the save fail requester
   unknownerror:PTR TO CHAR         // error message if unknown
   acceptstr:PTR TO CHAR            // the contents of the accept button
                                    // in a failure requester
   privatestr:PTR TO CHAR           // what to display if screen is private
   defaultstr:PTR TO CHAR           // default public screen name

        /* more stuff beyond this point, do not touch!*/
ENDOBJECT


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

/* Input handler active ?*/
CONST VNC_INPUTENABLED_BIT    = 0
CONST VNC_INPUTENABLED_MASK   = 1<<0

/* Library should be removed ?*/
CONST VNC_FLUSHING_BIT        = 1
CONST VNC_FLUSHING_MASK       = 1<<1

/* snip vec up to date ? (obsolete) */
CONST VNC_UPDATE_BIT          = 2
CONST VNC_UPDATE_MASK         = 1<<2

/* external snip vec written? (obsolete) */
CONST VNC_WRITTEN_BIT         = 3
CONST VNC_WRITTEN_MASK        = 1<<3

/* library localized ?*/
CONST VNC_LOCALIZED_BIT       = 4
CONST VNC_LOCALIZED_MASK      = 1<<4

/* notification started ?*/
CONST VNC_NOTIFIED_BIT        = 5
CONST VNC_NOTIFIED_MASK       = 1<<5

/* running in 1.2/1.3 ? (obsolete in 3.70) */
CONST VNC_OLDOS_BIT           = 6
CONST VNC_OLDOS_MASK          = 1<<6

/* welcome message printed ?*/
CONST VNC_STARTUP_BIT         = 7
CONST VNC_STARTUP_MASK        = 1<<7
