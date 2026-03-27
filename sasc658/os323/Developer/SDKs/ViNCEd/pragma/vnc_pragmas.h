#ifndef _INCLUDE_PRAGMA_VNC_LIB_H
#define _INCLUDE_PRAGMA_VNC_LIB_H

#ifndef CLIB_VNC_PROTOS_H
#include <clib/vnc_protos.h>
#endif

#if defined(AZTEC_C) || defined(__MAXON__) || defined(__STORM__)
#pragma amicall(VNCBase,0x030,VNCRawKeyConvert(a0,a1,d1,a2,d0))
#pragma amicall(VNCBase,0x05A,InstallGlobalHooks(a5))
#pragma amicall(VNCBase,0x060,SwitchTabExpansion(a5,d0))
#pragma amicall(VNCBase,0x066,HandleTabExpansion(a5,d0,d1,d4,a0,a1))
#pragma amicall(VNCBase,0x06C,AbortTabExpansion(a5))
#pragma amicall(VNCBase,0x0A2,LockWindow(a5))
#pragma amicall(VNCBase,0x0A8,UnLockWindow(a5))
#pragma amicall(VNCBase,0x0D2,FindCNWindow(d1))
#pragma amicall(VNCBase,0x0D8,UnFindCNWindow(d1))
#pragma amicall(VNCBase,0x0F0,GetVNCPrefs(a0,d0))
#pragma amicall(VNCBase,0x0F6,GetVNCDefaultPrefs(a0,d0))
#pragma amicall(VNCBase,0x0FC,LoadPrefs(a0,d0))
#pragma amicall(VNCBase,0x102,SetWindowPrefs(a5,a0,d0))
#pragma amicall(VNCBase,0x108,GetWindowPrefs(a5,a0,d0))
#pragma amicall(VNCBase,0x12C,LoadPrefsFrom(a0,d0,a1))
#pragma amicall(VNCBase,0x132,List2Prefs(a5,a0,a2,a1,d0,d2,d1,d3))
#pragma amicall(VNCBase,0x138,Prefs2List(a5,a0,a2,a1,d0,d2,d1,d3))
#pragma amicall(VNCBase,0x13E,AllocPrefsBuffer())
#pragma amicall(VNCBase,0x144,FreePrefsBuffer(a1))
#pragma amicall(VNCBase,0x16E,SendRequestPattern(a5,a0))
#pragma amicall(VNCBase,0x174,SendWindowOpens(a5))
#pragma amicall(VNCBase,0x17A,SendWindowCloses(a5))
#pragma amicall(VNCBase,0x180,SendWindowQuits(a5))
#pragma amicall(VNCBase,0x1B6,VNCRequestFile(a5,a0))
#pragma amicall(VNCBase,0x1BC,CtrlZSuspend(a5,a4))
#pragma amicall(VNCBase,0x1C2,VNCUniqueID())
#pragma amicall(VNCBase,0x1C8,GetNodeN(a0,d0))
#pragma amicall(VNCBase,0x1CE,AllocEdMem(a5,d0,d1))
#pragma amicall(VNCBase,0x1D4,FreeEdMem(a5,a1))
#pragma amicall(VNCBase,0x1DA,AllocLine(a5,d0))
#pragma amicall(VNCBase,0x1E0,FreeLine(a5,a0))
#pragma amicall(VNCBase,0x216,NotifyChOwner(a5,a0,a1,d0))
#pragma amicall(VNCBase,0x21C,NotifyClearScreen(a5))
#pragma amicall(VNCBase,0x222,VNCAtoI(a0))
#pragma amicall(VNCBase,0x228,VNCHtoI(a0))
#pragma amicall(VNCBase,0x22E,VNCStrToL(a0,d0))
#pragma amicall(VNCBase,0x23A,VNCItoA(d0,a0))
#pragma amicall(VNCBase,0x24C,VNCStrCmp(a0,a1))
#pragma amicall(VNCBase,0x252,VNCStrICmp(a0,a1,d0))
#pragma amicall(VNCBase,0x258,VNCToUpper(d0))
#pragma amicall(VNCBase,0x25E,VNCSPrintf(a0,a1,a2))
#pragma amicall(VNCBase,0x270,ConvertWindowTitle(a5,a4,a0,a1))
#pragma amicall(VNCBase,0x276,FindCloseMacro(a5,a4))
#pragma amicall(VNCBase,0x27C,PrintSuspend(a5,a0,a4))
#pragma amicall(VNCBase,0x3BA,AllocAsyncPacket(d0,d1))
#pragma amicall(VNCBase,0x3C0,QueueOwnerLine(a5,a4,a0,d0))
#pragma amicall(VNCBase,0x3C6,PushOwnerLine(a5,a4,a0,d0))
#pragma amicall(VNCBase,0x3CC,GetLineData(a5,a4,a0,d0))
#pragma amicall(VNCBase,0x3D2,PutLineData(a5,a4,a0,d0))
#pragma amicall(VNCBase,0x3E4,SendAsyncPacket(d1,d2,a1,a0,d0))
#pragma amicall(VNCBase,0x3EA,VNCDoPacket(d0,d1,d2,d3,d4,d5,d6,d7,a0))
#pragma amicall(VNCBase,0x420,Foreground(d0,d1))
#pragma amicall(VNCBase,0x426,Background(d0,d1))
#pragma amicall(VNCBase,0x4BC,ConvertString(a5,a0,a1))
#pragma amicall(VNCBase,0x4DA,FreeMacroList(a5,a0))
#pragma amicall(VNCBase,0x55E,PoolCreateExtIO(a5,a1,d0))
#pragma amicall(VNCBase,0x564,PoolDeleteExtIO(a5,a1))
#pragma amicall(VNCBase,0x56A,PoolCreateStdIO(a5,a1))
#pragma amicall(VNCBase,0x570,PoolDeleteStdIO(a5,a1))
#pragma amicall(VNCBase,0x576,PoolCreatePort(a5,a1,d0))
#pragma amicall(VNCBase,0x57C,PoolDeletePort(a5,a1))
#pragma amicall(VNCBase,0x59A,VNCFOpen(a0,d0,d1))
#pragma amicall(VNCBase,0x5A0,VNCFClose(a0))
#pragma amicall(VNCBase,0x5A6,VNCFRead(a0,a1,d1))
#pragma amicall(VNCBase,0x5AC,VNCFWrite(a0,a1,d1))
#pragma amicall(VNCBase,0x5B2,VNCFSeek(a0,d0,d1))
#pragma amicall(VNCBase,0x5B8,VNCOneRequester(a0))
#pragma amicall(VNCBase,0x5BE,VNCTwoRequester(a0))
#pragma amicall(VNCBase,0x5C4,VNCBuildFailureString(d0,a1,a2,a0))
#pragma amicall(VNCBase,0x5CA,GetHistory(a0,d0))
#pragma amicall(VNCBase,0x5D0,GetScreen(a0,d0))
#pragma amicall(VNCBase,0x5D6,PutHistory(a0,d0))
#pragma amicall(VNCBase,0x5DC,PutScreen(a0,d0))
#pragma amicall(VNCBase,0x5FA,SavePrefs(a0,d0))
#pragma amicall(VNCBase,0x600,SavePrefsTo(a0,d0,a1))
#pragma amicall(VNCBase,0x606,UsePrefs(a0,d0))
#pragma amicall(VNCBase,0x612,NameOfFunction(d0))
#pragma amicall(VNCBase,0x618,NameOfKey(d0))
#endif
#if defined(_DCC) || defined(__SASC)
#pragma  libcall VNCBase VNCRawKeyConvert     030 0A19805
#pragma  libcall VNCBase InstallGlobalHooks   05A D01
#pragma  libcall VNCBase SwitchTabExpansion   060 0D02
#pragma  libcall VNCBase HandleTabExpansion   066 98410D06
#pragma  libcall VNCBase AbortTabExpansion    06C D01
#pragma  libcall VNCBase LockWindow           0A2 D01
#pragma  libcall VNCBase UnLockWindow         0A8 D01
#pragma  libcall VNCBase FindCNWindow         0D2 101
#pragma  libcall VNCBase UnFindCNWindow       0D8 101
#pragma  libcall VNCBase GetVNCPrefs          0F0 0802
#pragma  libcall VNCBase GetVNCDefaultPrefs   0F6 0802
#pragma  libcall VNCBase LoadPrefs            0FC 0802
#pragma  libcall VNCBase SetWindowPrefs       102 08D03
#pragma  libcall VNCBase GetWindowPrefs       108 08D03
#pragma  libcall VNCBase LoadPrefsFrom        12C 90803
#pragma  libcall VNCBase List2Prefs           132 31209A8D08
#pragma  libcall VNCBase Prefs2List           138 31209A8D08
#pragma  libcall VNCBase AllocPrefsBuffer     13E 00
#pragma  libcall VNCBase FreePrefsBuffer      144 901
#pragma  libcall VNCBase SendRequestPattern   16E 8D02
#pragma  libcall VNCBase SendWindowOpens      174 D01
#pragma  libcall VNCBase SendWindowCloses     17A D01
#pragma  libcall VNCBase SendWindowQuits      180 D01
#pragma  libcall VNCBase VNCRequestFile       1B6 8D02
#pragma  libcall VNCBase CtrlZSuspend         1BC CD02
#pragma  libcall VNCBase VNCUniqueID          1C2 00
#pragma  libcall VNCBase GetNodeN             1C8 0802
#pragma  libcall VNCBase AllocEdMem           1CE 10D03
#pragma  libcall VNCBase FreeEdMem            1D4 9D02
#pragma  libcall VNCBase AllocLine            1DA 0D02
#pragma  libcall VNCBase FreeLine             1E0 8D02
#pragma  libcall VNCBase NotifyChOwner        216 098D04
#pragma  libcall VNCBase NotifyClearScreen    21C D01
#pragma  libcall VNCBase VNCAtoI              222 801
#pragma  libcall VNCBase VNCHtoI              228 801
#pragma  libcall VNCBase VNCStrToL            22E 0802
#pragma  libcall VNCBase VNCItoA              23A 8002
#pragma  libcall VNCBase VNCStrCmp            24C 9802
#pragma  libcall VNCBase VNCStrICmp           252 09803
#pragma  libcall VNCBase VNCToUpper           258 001
#pragma  libcall VNCBase VNCSPrintf           25E A9803
#pragma  libcall VNCBase ConvertWindowTitle   270 98CD04
#pragma  libcall VNCBase FindCloseMacro       276 CD02
#pragma  libcall VNCBase PrintSuspend         27C C8D03
#pragma  libcall VNCBase AllocAsyncPacket     3BA 1002
#pragma  libcall VNCBase QueueOwnerLine       3C0 08CD04
#pragma  libcall VNCBase PushOwnerLine        3C6 08CD04
#pragma  libcall VNCBase GetLineData          3CC 08CD04
#pragma  libcall VNCBase PutLineData          3D2 08CD04
#pragma  libcall VNCBase SendAsyncPacket      3E4 0892105
#pragma  libcall VNCBase VNCDoPacket          3EA 87654321009
#pragma  libcall VNCBase Foreground           420 1002
#pragma  libcall VNCBase Background           426 1002
#pragma  libcall VNCBase ConvertString        4BC 98D03
#pragma  libcall VNCBase FreeMacroList        4DA 8D02
#pragma  libcall VNCBase PoolCreateExtIO      55E 09D03
#pragma  libcall VNCBase PoolDeleteExtIO      564 9D02
#pragma  libcall VNCBase PoolCreateStdIO      56A 9D02
#pragma  libcall VNCBase PoolDeleteStdIO      570 9D02
#pragma  libcall VNCBase PoolCreatePort       576 09D03
#pragma  libcall VNCBase PoolDeletePort       57C 9D02
#pragma  libcall VNCBase VNCFOpen             59A 10803
#pragma  libcall VNCBase VNCFClose            5A0 801
#pragma  libcall VNCBase VNCFRead             5A6 19803
#pragma  libcall VNCBase VNCFWrite            5AC 19803
#pragma  libcall VNCBase VNCFSeek             5B2 10803
#pragma  libcall VNCBase VNCOneRequester      5B8 801
#pragma  libcall VNCBase VNCTwoRequester      5BE 801
#pragma  libcall VNCBase VNCBuildFailureString 5C4 8A9004
#pragma  libcall VNCBase GetHistory           5CA 0802
#pragma  libcall VNCBase GetScreen            5D0 0802
#pragma  libcall VNCBase PutHistory           5D6 0802
#pragma  libcall VNCBase PutScreen            5DC 0802
#pragma  libcall VNCBase SavePrefs            5FA 0802
#pragma  libcall VNCBase SavePrefsTo          600 90803
#pragma  libcall VNCBase UsePrefs             606 0802
#pragma  libcall VNCBase NameOfFunction       612 001
#pragma  libcall VNCBase NameOfKey            618 001
#endif
#ifdef __STORM__
#pragma tagcall(VNCBase,0x23A,VNCIto(d0,a0))
#endif
#ifdef __SASC_60
#pragma  tagcall VNCBase VNCIto               23A 8002
#endif

#endif	/*  _INCLUDE_PRAGMA_VNC_LIB_H  */
