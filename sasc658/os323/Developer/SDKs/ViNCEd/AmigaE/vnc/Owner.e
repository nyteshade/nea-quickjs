OPT MODULE
OPT EXPORT
OPT PREPROCESS

/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-98 THOR-Software inc.                        **
 ** Version 3.73                                        **
 **                                                     **
 ** program version 3.73 30 Jul 2000    THOR            **
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
 **                                                     **
 ** AmigaE version: Tomasz Wiszkowski                   **
 **                                                     **
 *********************************************************/

MODULE 'exec/lists',
       'exec/ports',
       'exec/tasks',
       'devices/timer',
       'dos/dos',
       'dos/dosextens',
       'vnc/window',
       'vnc/vncbase'

/* The next one is a ViNCEd owner, i.e. the structure assosiated
   to all processes using the same named console for printing/reading.
   Owners setup the foreground/background mechanism, see the guide. */

OBJECT viowner
   dosport:PTR TO mp;      // put messages here name is the name of the
                           // console associated to it
   usecount:INT            // counts # of times opened*/
   receivedoutnodes:lh     // keeps outnodes, i.e. this establishes
                           // the output buffer
   ownermode:INT           // console mode of this owner
   breakport:PTR TO mp     // send ^C where ?
   requestedevents         // send which input events ?
   outsize:INT             // size of the output buffer
   readpointer:INT         // file pointer in output buffer, set with SEEK
   timerio:timerequest     // used by WaitForChar
   messagedummy:PTR TO mn  // internal use only
   ownerport:PTR TO mp     // pointer to this structure
   type                    // always A_Timer. This fakes a DOSPacket
   resultdummy             // another dummy for faking 
   eventport:PTR TO mp     // for incoming events 
   waitingreads:INT        // counts number of read requests 
   parseflags              // see below
   readport:PTR TO mp      // last reading port, invalid if counter=0.
                           // Used for TAB expansion
   writeport:PTR TO mp     // last port writing here. Used for ^C
   pendingport:PTR TO mp   // suspended task in ^Z 
   ioblocknest:INT         // if <>0, all I/O by this owner is suspended
   waitingwrites:INT       // suspended write requests 
   subownerlist:mlh        // List of subowners 
   waitpacket:PTR TO dospacket// WaitForChar packet

        /* private data beyond this point... do not touch */
ENDOBJECT

/* The sub-owner structure is allocated once per stream (unlike the
   owner, which is allocated once per named console).
   This is what you find in your file handle */

OBJECT subowner
   succ:PTR TO subowner
   pred:PTR TO subowner       // linked list
   type:CHAR
   pri:CHAR
   name:PTR TO CHAR           // points to name of the owner, i.e. console name
   cludgefill:INT
   owner:PTR TO viowner         // subowner of which owner
   stream:PTR TO filehandle   // no BPTR! Stream of this SubOwner
   window:PTR TO vincwindow   // pointer to main structure
   vnclibbase:PTR TO vncbase
ENDOBJECT

/* flags defined in vow_ParseFlags */

/* something saved back ?*/
CONST VOW_SAVEDBACK_BIT       = 0
CONST VOW_SAVEDBACK_MASK      = 1<<0

/* parsing in ESC or CSI ?*/
CONST VOW_SEPARATEPARSE_BIT   = 8
CONST VOW_SEPARATEPARSE_MASK  = 1<<8

/* special character set codes */
CONST VOW_FOUNDSS2_BIT        = 12
CONST VOW_FOUNDSS3_MASK       = 1<<12

/* got new read request, title must be rebuild */
CONST VOW_GOTNEWREAD_BIT      = 29
CONST VOW_GOTNEWREAD_MASK     = 1<<29

/* owner is suspended, and message is printed */
CONST VOW_SUSPENDED_BIT       = 31
CONST VOW_SUSPENDED_MASK      = 1<<31


