#ifndef VNC_IO_H
#define VNC_IO_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2001 THOR-Software inc.                      **
 ** Version 3.85                                        **
 **                                                     **
 ** program version 3.85 13 May 2001    THOR            **
 **                                                     **
 ** ViNCEd I/O Functions and Definitions                **
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

#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif

#ifndef DOS_DOS_H
#include <dos/dos.h>
#endif

/* this structure is a file handle as used by ViNCEd I/O functions */

typedef  struct {
        BPTR fh_DOSHandle;              /* BPTR to DOS file structure */
        void *fh_Buffer;                /* buffer itself */
        UWORD fh_BufferLength;          /* its length */
        UWORD fh_BufferContents;        /* # of valid bytes */
        UWORD fh_BufferPos;             /* position of fileptr in buffer */
        UWORD fh_DOSOffset;             /* offset of buffer in total file */
        UBYTE fh_Mode;                  /* open mode, see below */
        UBYTE fh_Flags;                 /* additional flags, internal */
        char fh_RecordSep1;             /* record seperator, as LF or NUL */
        char fh_RecordSep2;             /* a second one... */
        ULONG fh_FilePointer;           /* absolute position in file */
} VncFileHandle;

/* definition of flags: READ ONLY */
#define FHFLG_CHANGED (1<<0)            /* buffer has been changed and must be written to disk */
#define FHFLG_INTERACTIVE (1<<1)        /* belongs to interactive file (should check for non-filing system files as well...) */

/* definition of mode-flags: READ ONLY in structure, used for open */
#define FHMOD_APPEND (1<<0)             /* append to end of file */
#define FHMOD_READ (1<<2)               /* open for reading */
#define FHMOD_WRITE (1<<3)              /* open for writing */
#define FHMOD_RECORD (1<<6)             /* record-oriented IO */
#define FHMOD_NONUL (1<<7)              /* don't write NULs on record IO */

/* this is implemented as a macro */
#define FTell(file) ((file)->fh_FilePointer)

#endif

