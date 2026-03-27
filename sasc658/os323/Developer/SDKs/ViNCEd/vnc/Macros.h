#ifndef VNC_MACROS_H
#define VNC_MACROS_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2001 THOR-Software inc.                      **
 ** Version 3.85                                        **
 **                                                     **
 ** program version 3.85 13 May 2001    THOR            **
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
 *********************************************************/

#ifndef EXEC_TYPES_H
#include <exec/types.h>
#endif

#ifndef VNC_WINDOW_H
#include <vnc/window.h>
#endif

/* A macro. The whole structure is allocvec'd, with the name attached
  at the END of this structure */

struct ViNCMacro {
        struct ViNCMacro        *vmac_succ;
        struct ViNCMacro        *vmac_pred;     /* linked list */
        UBYTE                    vmac_type;     /* set to VINC_MACROTYPE */
        BYTE                     vmac_count;    /* set to the NEGATED number
                                                   of the macro, e.g -5
                                                   is macro 5 */
        char                    *vmac_text;     /* pointer to the name */
        char                    *vmac_shortcut; /* this is filled in by
                                                   the library, do not
                                                   care about it. It
                                                   shortens the name to
                                                   max. displayable, 
                                                   probably with an 
                                                   ellipsis. */
};

/* This macro holds, too, the system strings. vmac_shortcut should not
   be expected to be available in those cases. The size of the menu
   shortcut is internal. Do not care about it, and do not access the
   shortcut pointer at all. */

/* A button. Looks almost the same, and is allocated in the same way. */

struct ViNCButton {
        struct ViNCButton       *vbut_succ;
        struct ViNCButton       *vbut_pred;     /* linked list */
        UBYTE                    vbut_type;     /* set to VINC_MACROTYPE */
        BYTE                     vbut_count;    /* set to the NEGATED number
                                                   of the button, e.g -5
                                                   is button 5 */
        char                    *vbut_text;     /* pointer to the name */
        char                    *vbut_title;    /* what to put into the
                                                   title bar */
};

#define VINC_MACROTYPE  0x1e

/* The sizes of all strings are limited. The size of a macro body and the
   button body is limited to VPF_FUNCLENGTH, the size of the button title
   is limited to VPF_SHORTLENGTH. See vnc/prefs.h for the defines */

#endif
