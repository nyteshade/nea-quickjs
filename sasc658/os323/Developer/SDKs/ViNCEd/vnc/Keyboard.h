#ifndef VNC_KEYBOARD_H
#define VNC_KEYBOARD_H
/*********************************************************
 ** ViNCEd                                              **
 ** a DOS - window handler                              **
 **                                                     **
 ** © 1991-2001 THOR-Software inc.                      **
 ** Version 3.85                                        **
 **                                                     **
 ** program version 3.85 31 May 2001    THOR            **
 **                                                     **
 ** ViNCEd Keyboard Definitions                         **
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

#ifndef DEVICES_INPUTEVENT_H
#include <devices/inputevent.h>
#endif

/* This defines one entry in the keyboard definition */

struct ViKey {
        UBYTE   vik_Flags;              /* flags, see below */
        UBYTE   vik_Code;               /* raw keyboard code or
                                           ASCII value */
        UBYTE   vik_Qualifier;          /* see below */
        UBYTE   vik_ID;                 /* function ID */
};

/* The following bits are defined for vik_Flags: */

/* This is a valid, assigned definition.
   Must be set or this entry is vacant */
#define VPKF_ASSIGNED_BIT       7
#define VPKF_ASSIGNED_MASK      (1<<7)

/* This is an ASCII match and not a match by the
   keyboard raw key code */
#define VPKF_ASCII_BIT          3
#define VPKF_ASCII_MASK         (1<<3)

/* Be warned: ViNCEd will pass more flags in this variable, but
   these are INTENTIONALLY undocumented. Especially, do not
   set these and do not play with them. */


/* ViNCEd qualifier masks */

#define VEQUALIFIER_LSHIFT              IEQUALIFIER_LSHIFT
#define VEQUALIFIER_RSHIFT              IEQUALIFIER_RSHIFT
#define VEQUALIFIER_SHIFT               (VEQUALIFIER_LSHIFT|VEQUALIFIER_RSHIFT)

#define VEQUALIFIER_NUMLOCK             0x0004

#define VEQUALIFIER_CONTROL             IEQUALIFIER_CONTROL

#define VEQUALIFIER_LALT                IEQUALIFIER_LALT
#define VEQUALIFIER_RALT                IEQUALIFIER_RALT
#define VEQUALIFIER_ALT                 (VEQUALIFIER_LALT|VEQUALIFIER_RALT)

#define VEQUALIFIER_LCOMMAND            IEQUALIFIER_LCOMMAND
#define VEQUALIFIER_RCOMMAND            IEQUALIFIER_RCOMMAND


/* The extended keymap definition structure */

struct ViNCExtMap {
        struct ViKey    vi_entry[256];
};

/* Keyboard function IDs */

#define KF_CURSOR_LEFT                  0x00
#define KF_CURSOR_RIGHT                 0x01
#define KF_CURSOR_UP                    0x02
#define KF_CURSOR_DOWN                  0x03
#define KF_HISTORY_UP                   0x04
#define KF_HISTORY_DOWN                 0x05
#define KF_SEARCH_PARTIAL_UPWARDS       0x06
#define KF_SEARCH_PARTIAL_DOWNWARDS     0x07
#define KF_SEARCH_HISTORY_UPWARDS       0x08
#define KF_SEARCH_HISTORY_DOWNWARDS     0x09
#define KF_HALF_SCREEN_LEFT             0x0a
#define KF_HALF_SCREEN_RIGHT            0x0b
#define KF_HALF_SCREEN_UP               0x0c
#define KF_HALF_SCREEN_DOWN             0x0d
#define KF_TO_LEFT_BORDER               0x0e
#define KF_TO_RIGHT_BORDER              0x0f
#define KF_TO_TOP_OF_SCREEN             0x10
#define KF_TO_BOTTOM_OF_SCREEN          0x11
#define KF_PREV_WORD                    0x12
#define KF_NEXT_WORD                    0x13
#define KF_PREV_COMPONENT               0x14
#define KF_NEXT_COMPONENT               0x15
#define KF_HOME                         0x16
#define KF_END                          0x17
#define KF_SCROLL_UP                    0x18
#define KF_SCROLL_DOWN                  0x19
#define KF_SCROLL_HALF_SCREEN_UP        0x1a
#define KF_SCROLL_HALF_SCREEN_DOWN      0x1b

#define KF_SEND_INPUTS                  0x20
#define KF_SPLIT_LINE                   0x21
#define KF_INSERT_CTRL_J                0x22
#define KF_SEND_COMPLETE_LINE           0x23
#define KF_LINE_FEED                    0x24

#define KF_TAB_FORWARDS                 0x32
#define KF_TAB_BACKWARDS                0x33
#define KF_EXPAND_PATH                  0x34
#define KF_EXPAND_BACKWARDS             0x35
#define KF_EXPAND_SHORT                 0x36
#define KF_EXPAND_SHORT_BKWDS           0x37
#define KF_EXPAND_DEVICES               0x38
#define KF_EXPAND_DEVS_BKWDS            0x39
#define KF_EXPAND_DIRS                  0x3a
#define KF_EXPAND_DIRS_BKWDS            0x3b
#define KF_EXPAND_ICONS                 0x3c
#define KF_EXPAND_ICONS_BKWDS           0x3d
#define KF_EXPAND_ALT                   0x3e
#define KF_EXPAND_ALT_BKWDS             0x3f

#define KF_SEND_CTRL_C                  0x40
#define KF_SEND_CTRL_D                  0x41
#define KF_SEND_CTRL_E                  0x42
#define KF_SEND_CTRL_F                  0x43
#define KF_SEND_CTRL_C_TO_ALL           0x44
#define KF_SEND_CTRL_D_TO_ALL           0x45
#define KF_SEND_CTRL_E_TO_ALL           0x46
#define KF_SEND_CTRL_F_TO_ALL           0x47

#define KF_DELETE_FORWARDS              0x50
#define KF_DELETE_BACKWARDS             0x51
#define KF_DELETE_FULL_LINE             0x52
#define KF_CUT_FULL_LINE                0x53
#define KF_DELETE_INPUTS                0x54
#define KF_CUT_INPUTS                   0x55
#define KF_DELETE_WORD_FWDS             0x56
#define KF_CUT_WORD_FWDS                0x57
#define KF_DELETE_WORD_BKWDS            0x58
#define KF_CUT_WORD_BKWDS               0x59
#define KF_DELETE_COMPONENT_FWDS        0x5a
#define KF_CUT_COMPONENT_FWDS           0x5b
#define KF_DELETE_COMPONENT_BKWDS       0x5c
#define KF_CUT_COMPONENT_BKWDS          0x5d
#define KF_DELETE_END_OF_LINE           0x5e
#define KF_CUT_END_OF_LINE              0x5f
#define KF_DELETE_START_OF_LINE         0x60
#define KF_CUT_START_OF_LINE            0x61
#define KF_DELETE_END_OF_DISPLAY        0x62
#define KF_FORM_FEED                    0x63
#define KF_CLEAR_SCREEN                 0x64

#define KF_CUT                          0x70
#define KF_COPY                         0x71
#define KF_PASTE                        0x72
#define KF_UNMARK                       0x73
#define KF_SELECT_ALL                   0x74
#define KF_COPY_QUIET                   0x75
#define KF_RESET                        0x76
#define KF_FULL_RESET                   0x77
#define KF_ICONIFY			0x78

#define KF_TOGGLE_ESC                   0x80
#define KF_TOGGLE_NUMLOCK               0x81
#define KF_TOGGLE_OVERWRITE             0x82
#define KF_SUSPEND                      0x83
#define KF_RESUME                       0x84
#define KF_ABORT_EXPANSION              0x85
#define KF_SCROLL_TO_CURSOR             0x86
#define KF_REWIND_HISTORY               0x87
#define KF_YANK                         0x88
#define KF_GENERATE_EOF                 0x89
#define KF_DISPLAY_BEEP                 0x8c
#define KF_TOGGLE_PAUSE                 0x8d
#define KF_HELP                         0x8e
#define KF_FORK_NEW_SHELL               0x8f
#define KF_INSERT_CSI                   0x90
#define KF_INSERT_ESC                   0x91

#endif
