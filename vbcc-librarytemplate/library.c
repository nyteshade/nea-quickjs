#include <exec/resident.h>

#include "library.h"

/* Resident tag rt_Version is UBYTE (exec/resident.h). Some
 * Kickstart/exec code paths (and debugging tools) signed-compare
 * this field, so values >= 128 are treated as negative and the
 * resident is rejected — OpenLibrary then returns NULL even though
 * LoadSeg succeeded and `version file` can still read the $VER
 * string. Cap rt_Version at a small stable value; the real
 * consumer-visible version lives in lib_Version (UWORD) below via
 * _LibInit, and in the $VER string. */
#ifndef RESIDENT_VERSION
#  if LIBRARY_VERSION <= 127
#    define RESIDENT_VERSION LIBRARY_VERSION
#  else
#    define RESIDENT_VERSION 1
#  endif
#endif

/**
 * Data structure identifying the library.
 */
const struct Resident RomTag =
  {
  RTC_MATCHWORD,
  ( struct Resident* ) &RomTag,
  ( struct Resident* ) &RomTag + 1,
  RTF_AUTOINIT,
  RESIDENT_VERSION,
  NT_LIBRARY,
  0,
  ( BYTE* ) LibName,
  LIBRARY_VERSION_OUTPUT,
  (APTR) InitTable
  };

/**
 * Library initialisation table steering the initialisation of the library.
 */
const APTR InitTable[4] =
  {
  ( APTR ) sizeof( LIBRARY_BASE_TYPE ),
  ( APTR ) &LibraryFunctions,
  ( APTR ) NULL,
  ( APTR ) _LibInit
  };

/**
 * Name of the library.
 */
const BYTE LibName[] = LIBRARY_NAME;

/**
 * Id/Version string of the library.
 */
const BYTE LibIdString[] = LIBRARY_VERSION_STRING;

/**
 * Function pointer table of the library.
 */
const APTR LibraryFunctions[] =
  {
  ( APTR ) _LibOpen,
  ( APTR ) _LibClose,
  ( APTR ) _LibExpunge,
  ( APTR ) _LibReserved,
  LIBRARY_FUNCTIONS,
  ( APTR ) -1
  };

/**
 * Empty startup function.
 */
LONG _start( VOID )
  {
  return -1;
  }

/**
 * Library base structure factory function.
 */
LIBRARY_BASE_TYPE* _LibInit(
  __reg("a6") struct ExecBase* aSysBase,
  __reg("a0") BPTR aSegmentList,
  __reg("d0") LIBRARY_BASE_TYPE* aBase
  ) {
  aBase->iLibrary.lib_Node.ln_Type = NT_LIBRARY;
  aBase->iLibrary.lib_Node.ln_Name = ( BYTE* ) LibName;
  aBase->iLibrary.lib_Flags = LIBF_SUMUSED | LIBF_CHANGED;
  aBase->iLibrary.lib_Version = LIBRARY_VERSION;
  aBase->iLibrary.lib_Revision = LIBRARY_REVISION;
  aBase->iLibrary.lib_IdString = LIBRARY_VERSION_OUTPUT;
  aBase->iSegmentList = aSegmentList;
  aBase->iSysBase = aSysBase;

  /* Do all custom library initialisation. */
  if( CustomLibInit( aBase ) )
    {
    /* Clean up everything if custom library initialisation failed. */
    _LibExpunge( aBase );
    return NULL;
    }

  return aBase;
}

/**
 * Entry point called by the function OpenLibrary().
 */
LIBRARY_BASE_TYPE* _LibOpen( __reg("a6") LIBRARY_BASE_TYPE* aBase )
  {
  aBase->iLibrary.lib_Flags &= ~LIBF_DELEXP;
  aBase->iLibrary.lib_OpenCnt++;

  return aBase;
  }

/**
 * Entry point called by the function CloseLibrary().
 */
BPTR _LibClose( __reg("a6") LIBRARY_BASE_TYPE* aBase )
  {
  aBase->iLibrary.lib_OpenCnt--;

  if( !( aBase->iLibrary.lib_OpenCnt ) )
    {
    if( aBase->iLibrary.lib_Flags & LIBF_DELEXP )
      {
      return _LibExpunge( aBase );
      }
    }
  return NULL;
  }

/**
 * Prepares the library for removal from the system.
 */
BPTR _LibExpunge( __reg("a6") LIBRARY_BASE_TYPE* aBase )
  {
  if( !( aBase->iLibrary.lib_OpenCnt ) )
    {
    struct ExecBase* sysBase = aBase->iSysBase;
    ULONG negSize = aBase->iLibrary.lib_NegSize;
    ULONG posSize = aBase->iLibrary.lib_PosSize;
    BPTR segmentList = aBase->iSegmentList;

    /* Check, if already added to the library list. */
    if( aBase->iLibrary.lib_Node.ln_Succ )
      {
     /* Remove own library base from library list */
      __Remove( sysBase, (struct Node* ) aBase );
      }

    /* Do all custom library cleanup.*/
    CustomLibCleanup( aBase );

    __FreeMem( sysBase, ( UBYTE* ) aBase - negSize, negSize + posSize );
    return segmentList;
    }
  aBase->iLibrary.lib_Flags |= LIBF_DELEXP;
  return NULL;
  }

/**
 * Fourth function vector reserved for future use.
 */
ULONG _LibReserved( __reg("a6") LIBRARY_BASE_TYPE* aBase )
  {
  return 0;
  }
