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
 ** program version 3.60 20 Aug 1998    THOR            **
 **                                                     **
 ** ViNCEd Macro functions                              **
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

/* A macro. The whole structure is allocvec'd, with the name attached
  at the END of this structure */

OBJECT vincmacro
   succ:PTR TO vincmacro
   pred:PTR TO vincmacro   // linked list
   type:CHAR               // set to VINC_MACROTYPE
   count:CHAR              // set to the NEGATED number
                           // of the macro, e.g -5
                           // is macro 5
   text:PTR TO CHAR        // pointer to the name
   shortcut:PTR TO CHAR    // this is filled in by
                           // the library, do not
                           // care about it. It
                           // shortens the name to
                           // max. displayable,
                           // probably with an
                           // ellipsis.
ENDOBJECT

/* This macro holds, too, the system strings. vmac_shortcut should not
   be expected to be available in those cases. The size of the menu
   shortcut is internal. Do not care about it, and do not access the
   shortcut pointer at all. */

/* A button. Looks almost the same, and is allocated in the same way. */

OBJECT vincbutton
   succ:PTR TO vincbutton
   pred:PTR TO vincbutton  // linked list
   type:CHAR               // set to VINC_MACROTYPE
   count:CHAR              // set to the NEGATED number
                           // of the button, e.g -5
                           // is button 5
   text:PTR TO CHAR        // pointer to the name
   title:PTR TO CHAR       // what to put into the
                           // title bar
ENDOBJECT

CONST VINC_MACROTYPE  = $1e

/* The sizes of all strings are limited. The size of a macro body and the
   button body is limited to VPF_FUNCLENGTH, the size of the button title
   is limited to VPF_SHORTLENGTH. See vnc/prefs.h for the defines */

