#ifndef VNC_PACKETS_H
#define VNC_PACKETS_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2001 THOR-Software inc.                      **
 ** Version 3.85                                        **
 **                                                     **
 ** header file 13 May 2001     THOR                    **
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
 *********************************************************/

/* ViNCEd defined packets */
/* For details about these packets, consult the ViNCEd guide */

#define ACTION_UNDISK_INFO              513
#define ACTION_SETLINE                  2001
#define ACTION_PUSHLINE                 2002
#define ACTION_QUEUELINE                2003
#define ACTION_EXPANDLINE               2011
#define ACTION_CLEARLINE                2012
#define ACTION_SENDID                   504
#define ACTION_ABORT                    512
#define ACTION_GET_DISK_FSSM            4201

/* Console operation modes */

/* Do not filter anything, report key codes literally and immediately */
#define VNC_RAW_MODE			1

/* Standard line buffering without additional features */
#define VNC_WELL_DONE_MODE		0

/* Enhanced raw-mode with ViNCEd keyboard CSI sequences for more functions */
#define VNC_ENGLISH_MODE		3

/* Enhanced line buffer mode with sequences for TAB, history, etc.. */
#define VNC_MEDIUM_MODE			2

#endif
