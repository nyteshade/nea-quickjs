OPT MODULE
OPT EXPORT
OPT PREPROCESS

/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-98 THOR-Software inc.                        **
 ** Version 3.60                                        **
 **                                                     **
 ** program version 3.60 22 Aug 98      THOR            **
 **                                                     **
 ** ViNCEd Standard Requesters                          **
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

MODULE 'intuition/intuition'

/* This is a standard file requester. Either arp or asl (or reqtools)
   requesters are used to display them. This works in all OS revisions. */

OBJECT virequest
   hail:PTR TO CHAR     // title string
   file:PTR TO CHAR     // file name
   dir:PTR TO CHAR      // directory name
   window:PTR TO window // window to lock
   flags:INT            // flags, see below
   reserved             // must be zero
   pattern:PTR TO CHAR  // pattern matching string
   leftedge:INT         // requested positions
   topedge:INT
   width:INT            // requested size
   height:INT
ENDOBJECT


/* Split file name in file and directory, fill in dir automatically */
CONST VREQ_AUTOSPLIT_BIT      = 0
CONST VREQ_AUTOSPLIT_MASK     = 1<<0

/* Split file in dir and pattern, clear file */
CONST VREQ_AUTOPAT_BIT        = 1
CONST VREQ_AUTOPAT_MASK       = 1<<1

/* Join file and dir after requesting */
CONST VREQ_AUTOJOIN_BIT       = 2
CONST VREQ_AUTOJOIN_MASK      = 1<<2

/* Requester dimensions are valid. This bit must be set or
   the vreq_LeftEdge to vreq_Height fields are ignored. Strictly
   for backwards compatibility */
CONST VREQ_DIMENSIONS_BIT     = 8
CONST VREQ_DIMENSIONS_MASK    = 1<<8


