#ifndef  CLIB_VNC_PROTOS_H
#define  CLIB_VNC_PROTOS_H

/*
**      $VER: vnc_protos.h 41.1 (20.4.2000)
**      Includes Release 41.1
**
**      C prototypes. For use with 32 bit integers only.
**
**      (C) Copyright 1990-2000 THOR-Software, Thomas Richter
**          All Rights Reserved
*/

#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif
#ifndef EXEC_IO_H
#include <exec/io.h>
#endif
#ifndef VNC_WINDOW_H
#include <vnc/window.h>
#endif
#ifndef VNC_OWNER_H
#include <vnc/owner.h>
#endif
#ifndef VNC_PREFS_H
#include <vnc/window.h>
#endif
#ifndef VNC_DYNAMICS_H
#include <vnc/dynamics.h>
#endif
#ifndef VNC_KEYBOARD_H
#include <vnc/keyboard.h>
#endif
#ifndef VNC_IO_H
#include <vnc/io.h>
#endif

void SetCNWindow ( struct ViNCWindow * );
struct ViNCWindow * GetVNCWindow ( void );
struct InputEvent * VNCInputHandler ( struct InputEvent *, struct VNCLibrary *);
struct InputEvent * VNCImInputHandler ( struct InputEvent *, struct VNCLibrary *);
LONG VNCRawKeyConvert ( struct KeymapRequest * );
void InstallGlobalHooks ( struct ViNCWindow * );
void InstallGlobalHooks_CN ( void );
LONG SwitchTabExpansion ( struct ViNCWindow *, LONG );
LONG SwitchTabExpansion_CN ( LONG ) ;
LONG HandleTabExpansion ( struct ViNCWindow *, ULONG, ULONG, ULONG, char *, struct ViOwner *);
LONG HandleTabExpansion_CN ( ULONG, ULONG, ULONG, char *, struct ViOwner *);
LONG AbortTabExpansion ( struct ViNCWindow * );
LONG AbortTabExpansion_CN ( VOID );
VOID LockWindow ( struct ViNCWindow * );
VOID LockWindow_CN ( VOID );
VOID UnLockWindow ( struct ViNCWindow * );
VOID UnLockWindow_CN ( VOID );
struct ViNCWindow * FindCNWindow ( BPTR );
VOID UnFindCNWindow ( BPTR );
ULONG GetVNCPrefs ( struct VNCPrefs * , LONG );
ULONG GetVNCDefaultPrefs ( struct VNCPrefs * , LONG );
ULONG LoadPrefsFrom ( struct VNCPrefs * , LONG , char * );
ULONG LoadPrefs ( struct VNCPrefs * , LONG );
LONG SavePrefs ( struct VNCPrefs * , LONG );
LONG SavePrefsTo ( struct VNCPrefs * , LONG , char * );
LONG UsePrefs ( struct VNCPrefs * , LONG );
LONG SetWindowPrefs ( struct ViNCWindow , struct VNCPrefs * , LONG );
LONG SetWindowPrefs_CN ( struct VNCPrefs * , LONG );
LONG GetWindowPrefs ( struct ViNCWindow , struct VNCPrefs * , LONG );
LONG GetWindowPrefs_CN ( struct VNCPrefs * , LONG );
struct VNCPrefs * AllocPrefsBuffer ( VOID );
VOID FreePrefsBuffer ( struct VNCPrefs * );
LONG List2Prefs ( struct ViNCWindow * , struct List * , struct List * , struct VNCPrefs * , UWORD , UWORD , UWORD , UWORD );
LONG List2Prefs_CN ( struct List *  , struct List * , struct VNCPrefs * , UWORD , UWORD , UWORD , UWORD );
LONG Prefs2List ( struct ViNCWindow * , struct List * , struct List * , struct VNCPrefs * , UWORD , UWORD , UWORD , UWORD );
LONG Prefs2List_CN ( struct List *  , struct List * , struct VNCPrefs * , UWORD , UWORD , UWORD , UWORD );
VOID FreeMacroList ( struct ViNCWindow * , struct List * );
VOID FreeMacroList_CN ( struct List * );
BOOL SendRequestPattern ( struct ViNCWindow * , char * );
BOOL SendRequestPattern_CN ( char * );
BOOL SendWindowOpens ( struct ViNCWindow * );
BOOL SendWindowOpens_CN ( VOID );
BOOL SendWindowCloses ( struct ViNCWindow * );
BOOL SendWindowCloses_CN ( VOID );
BOOL SendWindowQuits ( struct ViNCWindow * );
BOOL SendWindowQuits_CN ( VOID );
LONG VNCRequestFile ( struct ViNCWindow * , struct ViRequest * );
LONG VNCRequestFile_CN ( struct ViRequest * );
LONG CtrlZSuspend ( struct ViNCWindow * , struct ViOwner * );
LONG CtrlZSuspend_CN ( struct ViOwner * );
ULONG VNCUniqueID ( VOID );
struct Node * GetNodeN ( struct List * , ULONG count );
void * AllocEdMem ( struct ViNCWindow * , ULONG , ULONG );
void * AllocEdMem_CN ( ULONG , ULONG );
VOID FreeEdMem ( struct ViNCWindow * , void * );
VOID FreeEdMem_CN ( void * );
struct DynNode * AllocLine ( struct ViNCWindow * , UWORD );
struct DynNode * AllocLine_CN ( UWORD );
VOID FreeLine ( struct ViNCWindow * , struct DynNode * );
VOID FreeLine_CN ( struct DynNode * );
BOOL NotifyChOwner ( struct ViNCWindow * , struct ViOwner * , struct ViOwner * , char cmd );
BOOL NotifyChOwner_CN ( struct ViOwner * , struct ViOwner * , char cmd );
BOOL NotifyClearScreen ( struct ViNCWindow * );
BOOL NotifyClearScreen_CN ( VOID );
LONG VNCAToI ( struct Convert * );
LONG VNCHToI ( struct Convert * );
LONG VNCStrToL ( struct Convert * , ULONG base );
VOID VNCIToA ( LONG , char * );
VOID VNCSPrintf ( char * , char * , char * );
LONG VNCStrCmp ( char * , char * );
LONG VNCStrICmp ( char * , char * , ULONG );
char VNCToUpper ( char );
VOID ConvertWindowTitle ( struct ViNCWindow * , struct ViOwner , char * , char * );
VOID ConvertWindowTitle_CN ( struct ViOwner * , char * , char * );
char * FindCloseMacro ( struct ViNCWindow * , struct ViOwner * );
char * FindCloseMacro_CN ( struct ViOwner * );
VOID PrintSuspend ( struct ViNCWindow * , struct MsgPort * , struct ViOwner * );
VOID PrintSuspend_CN ( struct ViNCWindow * , struct MsgPort * , struct ViOwner * );
BOOL QueueOwnerLine ( struct ViNCWindow * , struct ViOwner , char * buffer, UWORD size );
BOOL QueueOwnerLine_CN ( struct ViOwner , char * buffer, UWORD size );
BOOL PushOwnerLine ( struct ViNCWindow * , struct ViOwner , char * buffer, UWORD size );
BOOL PushOwnerLine_CN ( struct ViOwner , char * buffer, UWORD size );
ULONG PutLineData ( struct ViNCWindow * , struct ViOwner , char * buffer, ULONG size );
ULONG PutLineData_CN ( struct ViOwner , char * buffer, ULONG size );
ULONG GetLineData ( struct ViNCWindow * , struct ViOwner , char * buffer, ULONG size );
ULONG GetLineData_CN ( struct ViOwner , char * buffer, ULONG size );
LONG SendAsyncPacket ( BPTR , ULONG , void * , void * , ULONG );
struct StandardPacket * AllocAsyncPacket ( BPTR , ULONG );
LONG VNCDoPacket ( LONG , LONG , LONG , LONG , LONG , LONG , LONG , LONG , struct MsgPort * );
LONG Foreground ( ULONG , BPTR );
LONG Background ( ULONG , BPTR );
BOOL ConvertString ( struct ViNCWindow * , char * , char * );
BOOL ConvertString_CN ( char * , char * );
struct IORequest * PoolCreateExtIO ( struct ViNCWindow * , struct MsgPort * , UWORD size );
struct IORequest * PoolCreateExtIO_CN ( struct MsgPort * , UWORD size );
struct IOStdReq * PoolCreateStdIO ( struct ViNCWindow * , struct MsgPort * );
struct IOStdReq * PoolCreateStdIO_CN ( struct MsgPort * );
VOID PoolDeleteExtIO ( struct ViNCWindow * , struct IORequest * );
VOID PoolDeleteExtIO_CN ( struct IORequest * );
VOID PoolDeleteStdIO ( struct ViNCWindow * , struct IORequest * );
VOID PoolDeleteStdIO_CN ( struct IORequest * );
struct MsgPort * PoolCreatePort ( struct ViNCWindow * , char * , BYTE );
struct MsgPort * PoolCreatePort_CN ( char * , BYTE );
VOID PoolDeletePort ( struct ViNCWindow * , struct MsgPort * );
VOID PoolDeletePort_CN ( struct MsgPort * );
VncFileHandle* VNCFOpen ( char * , UBYTE , UWORD );
BOOL VNCFClose ( VncFileHandle * );
LONG VNCFRead ( VncFileHandle * , void * , ULONG );
LONG VNCFWrite ( VncFileHandle * , void * , ULONG );
LONG VNCFSeek ( VncFileHandle * , LONG , LONG );
VOID VNCOneRequester ( char * );
BOOL VNCTwoRequester ( char * );
char *VNCBuildFailureString(LONG , char *, char *, char *);
LONG GetHistory ( char * , ULONG );
LONG PutHistory ( char * , ULONG );
LONG GetScreen ( char * , ULONG );
LONG PutScreen ( char * , ULONG );
char * NameOfFunction ( UWORD );
char * NameOfKey ( UWORD );
VOID InstallGlobalHook ( struct ViNCWindow * );

#endif   /* CLIB_VNC_PROTOS_H */
