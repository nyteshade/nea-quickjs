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
 ** program version 3.60 22 Aug 1998    THOR            **
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
 **                                                     **
 ** AmigaE version: Tomasz Wiszkowski                   **
 **                                                     **
 *********************************************************/

MODULE 'dos/dos'

/* this structure is a file handle as used by ViNCEd I/O functions */

OBJECT filehandle
   doshandle              // BPTR to DOS file structure
   buffer:PTR TO CHAR     // buffer itself
   bufferlength:INT       // its length
   buffercontents:INT     // # of valid bytes
   bufferpos:INT          // position of fileptr in buffer
   dosoffset:INT          // offset of buffer in total file
   mode:CHAR              // open mode, see below
   flags:CHAR             // additional flags, internal
   recordsep1:CHAR        // record seperator, as LF or NUL
   recordsep2:CHAR        // a second one...
   filepointer            // absolute position in file
ENDOBJECT

/* definition of flags: READ ONLY */
CONST FHFLG_CHANGED     = 1<<0 // buffer has been changed and
                               // must be written to disk
CONST FHFLG_INTERACTIVE = 1<<1 // belongs to interactive file
                               // (should check for non-filing
                               // system files as well...)

/* definition of mode-flags: READ ONLY in structure, used for open */
CONST FHMOD_APPEND = 1<<0 // append to end of file */
CONST FHMOD_READ   = 1<<2 // open for reading */
CONST FHMOD_WRITE  = 1<<3 // open for writing */
CONST FHMOD_RECORD = 1<<6 // record-oriented IO */
CONST FHMOD_NONUL  = 1<<7 // don't write NULs on record IO */

/* this is implemented as a macro */

#define FTell(file) (file::filehandle.filepointer)


