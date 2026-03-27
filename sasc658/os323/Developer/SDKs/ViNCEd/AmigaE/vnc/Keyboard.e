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
 ** program version 3.70 24 Apr 2000    THOR            **
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
 **                                                     **
 ** AmigaE version: Tomasz Wiszkowski                   **
 **                                                     **
 *********************************************************/

MODULE 'devices/inputevent'

/* This defines one entry in the keyboard definition */

OBJECT vikey
   flags:CHAR     // flags, see below
   code:CHAR      // raw keyboard code or
                  // ASCII value
   qualifier:CHAR // see below
   id:CHAR        // function ID
ENDOBJECT

/* The following bits are defined for vik_Flags: */

/* This is a valid, assigned definition.
   Must be set or this entry is vacant */
CONST VPKF_ASSIGNED_BIT       = 7
CONST VPKF_ASSIGNED_MASK      = 1<<7

/* This is an ASCII match and not a match by the
   keyboard raw key code */
CONST VPKF_ASCII_BIT          = 3
CONST VPKF_ASCII_MASK         = 1<<3

/* Be warned: ViNCEd will pass more flags in this variable, but
   these are INTENTIONALLY undocumented. Especially, do not
   set these and do not play with them. */


/* ViNCEd qualifier masks */

CONST VEQUALIFIER_LSHIFT              = IEQUALIFIER_LSHIFT
CONST VEQUALIFIER_RSHIFT              = IEQUALIFIER_RSHIFT
CONST VEQUALIFIER_SHIFT               = VEQUALIFIER_LSHIFT || VEQUALIFIER_RSHIFT

CONST VEQUALIFIER_NUMLOCK             = $0004

CONST VEQUALIFIER_CONTROL             = IEQUALIFIER_CONTROL

CONST VEQUALIFIER_LALT                = IEQUALIFIER_LALT
CONST VEQUALIFIER_RALT                = IEQUALIFIER_RALT
CONST VEQUALIFIER_ALT                 = VEQUALIFIER_LALT || VEQUALIFIER_RALT

CONST VEQUALIFIER_LCOMMAND            = IEQUALIFIER_LCOMMAND
CONST VEQUALIFIER_RCOMMAND            = IEQUALIFIER_RCOMMAND


/* The extended keymap definition structure */

OBJECT vincextmap
   entry[256]:ARRAY OF vikey
ENDOBJECT

/* Keyboard function IDs */

CONST KF_CURSOR_LEFT                  = $00
CONST KF_CURSOR_RIGHT                 = $01
CONST KF_CURSOR_UP                    = $02
CONST KF_CURSOR_DOWN                  = $03
CONST KF_HISTORY_UP                   = $04
CONST KF_HISTORY_DOWN                 = $05
CONST KF_SEARCH_PARTIAL_UPWARDS       = $06
CONST KF_SEARCH_PARTIAL_DOWNWARDS     = $07
CONST KF_SEARCH_HISTORY_UPWARDS       = $08
CONST KF_SEARCH_HISTORY_DOWNWARDS     = $09
CONST KF_HALF_SCREEN_LEFT             = $0a
CONST KF_HALF_SCREEN_RIGHT            = $0b
CONST KF_HALF_SCREEN_UP               = $0c
CONST KF_HALF_SCREEN_DOWN             = $0d
CONST KF_TO_LEFT_BORDER               = $0e
CONST KF_TO_RIGHT_BORDER              = $0f
CONST KF_TO_TOP_OF_SCREEN             = $10
CONST KF_TO_BOTTOM_OF_SCREEN          = $11
CONST KF_PREV_WORD                    = $12
CONST KF_NEXT_WORD                    = $13
CONST KF_PREV_COMPONENT               = $14
CONST KF_NEXT_COMPONENT               = $15
CONST KF_HOME                         = $16
CONST KF_END                          = $17
CONST KF_SCROLL_UP                    = $18
CONST KF_SCROLL_DOWN                  = $19
CONST KF_SCROLL_HALF_SCREEN_UP        = $1a
CONST KF_SCROLL_HALF_SCREEN_DOWN      = $1b

CONST KF_SEND_INPUTS                  = $20
CONST KF_SPLIT_LINE                   = $21
CONST KF_INSERT_CTRL_J                = $22
CONST KF_SEND_COMPLETE_LINE           = $23
CONST KF_LINE_FEED                    = $24

CONST KF_TAB_FORWARDS                 = $32
CONST KF_TAB_BACKWARDS                = $33
CONST KF_EXPAND_PATH                  = $34
CONST KF_EXPAND_BACKWARDS             = $35
CONST KF_EXPAND_SHORT                 = $36
CONST KF_EXPAND_SHORT_BKWDS           = $37
CONST KF_EXPAND_DEVICES               = $38
CONST KF_EXPAND_DEVS_BKWDS            = $39
CONST KF_EXPAND_DIRS                  = $3a
CONST KF_EXPAND_DIRS_BKWDS            = $3b
CONST KF_EXPAND_ICONS                 = $3c
CONST KF_EXPAND_ICONS_BKWDS           = $3d
CONST KF_EXPAND_ALT                   = $3e
CONST KF_EXPAND_ALT_BKWDS             = $3f

CONST KF_SEND_CTRL_C                  = $40
CONST KF_SEND_CTRL_D                  = $41
CONST KF_SEND_CTRL_E                  = $42
CONST KF_SEND_CTRL_F                  = $43
CONST KF_SEND_CTRL_C_TO_ALL           = $44
CONST KF_SEND_CTRL_D_TO_ALL           = $45
CONST KF_SEND_CTRL_E_TO_ALL           = $46
CONST KF_SEND_CTRL_F_TO_ALL           = $47

CONST KF_DELETE_FORWARDS              = $50
CONST KF_DELETE_BACKWARDS             = $51
CONST KF_DELETE_FULL_LINE             = $52
CONST KF_CUT_FULL_LINE                = $53
CONST KF_DELETE_INPUTS                = $54
CONST KF_CUT_INPUTS                   = $55
CONST KF_DELETE_WORD_FWDS             = $56
CONST KF_CUT_WORD_FWDS                = $57
CONST KF_DELETE_WORD_BKWDS            = $58
CONST KF_CUT_WORD_BKWDS               = $59
CONST KF_DELETE_COMPONENT_FWDS        = $5a
CONST KF_CUT_COMPONENT_FWDS           = $5b
CONST KF_DELETE_COMPONENT_BKWDS       = $5c
CONST KF_CUT_COMPONENT_BKWDS          = $5d
CONST KF_DELETE_END_OF_LINE           = $5e
CONST KF_CUT_END_OF_LINE              = $5f
CONST KF_DELETE_START_OF_LINE         = $60
CONST KF_CUT_START_OF_LINE            = $61
CONST KF_DELETE_END_OF_DISPLAY        = $62
CONST KF_FORM_FEED                    = $63
CONST KF_CLEAR_SCREEN                 = $64

CONST KF_CUT                          = $70
CONST KF_COPY                         = $71
CONST KF_PASTE                        = $72
CONST KF_HIDE                         = $73
CONST KF_SELECT_ALL                   = $74
CONST KF_COPY_QUIET                   = $75
CONST KF_RESET                        = $76
CONST KF_FULL_RESET                   = $77
CONST KF_ICONIFY                      = $78

CONST KF_TOGGLE_ESC                   = $80
CONST KF_TOGGLE_NUMLOCK               = $81
CONST KF_TOGGLE_OVERWRITE             = $82
CONST KF_SUSPEND                      = $83
CONST KF_RESUME                       = $84
CONST KF_ABORT_EXPANSION              = $85
CONST KF_SCROLL_TO_CURSOR             = $86
CONST KF_REWIND_HISTORY               = $87
CONST KF_YANK                         = $88
CONST KF_GENERATE_EOF                 = $89
CONST KF_DISPLAY_BEEP                 = $8c
CONST KF_TOGGLE_PAUSE                 = $8d
CONST KF_HELP                         = $8e
CONST KF_FORK_NEW_SHELL               = $8f
CONST KF_INSERT_CSI                   = $90
CONST KF_INSERT_ESC                   = $91

