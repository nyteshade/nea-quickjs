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
 ** header file 24 Apr 1999     THOR                    **
 **                                                     **
 ** ViNCEd Packet List                                  **
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

/* ViNCEd defined packets */
/* For details about these packets, consult the ViNCEd guide */

CONST ACTION_UNDISK_INFO      = 513
CONST ACTION_SETLINE          = 2001
CONST ACTION_PUSHLINE         = 2002
CONST ACTION_QUEUELINE        = 2003
CONST ACTION_EXPANDLINE       = 2011
CONST ACTION_CLEARLINE        = 2012
CONST ACTION_SENDID           = 504
CONST ACTION_ABORT            = 512
CONST ACTION_GET_DISK_FSSM    = 4201

/* Console operation modes, forgot to define... */

/* Do not filter anything, report key codes literally and immediately */
CONST VNC_RAW_MODE            = 1

/* Standard line buffering without additional features */
CONST VNC_WELL_DONE_MODE      = 0

/* Enhanced raw-mode with ViNCEd keyboard CSI sequences for more functions */
CONST VNC_ENGLISH_MODE        = 3

/* Enhanced line buffer mode with sequences for TAB, history, etc.. */
CONST VNC_MEDIUM_MODE         = 2
