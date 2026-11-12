/* quickjs-master/amiga/ffi/Asl.js
 *
 * Wrapper for asl.library. Covers the four standard requester types
 * (file, font, screenmode, arexx) via AllocAslRequest /
 * AslRequest / FreeAslRequest. Users can also pass a prepared tag
 * list through AslRequestA for finer control.
 *
 * The raw requester-return structs (FileRequester, FontRequester,
 * ScreenModeRequester, ArexxRequester) are accessed via their field
 * offsets on the returned pointer; full struct wrappers are pending
 * — for now the wrapper returns a struct-pointer + the common fields
 * you need (path, file, numArgs, argList).
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';

/**
 * asl.library — standard Amiga requester provider (file/font/
 * screenmode).
 */
export class Asl extends LibraryBase {
  /** @type {string} */
  static libraryName = 'asl.library';

  /** @type {number} */
  static libraryVersion = 39;

  /** @type {Object<string, number>} */
  static lvo = globalThis.amiga.asl.lvo;

  /**
   * Requester-type selectors and the most-used ASL_* tag IDs.
   *
   *   ASL_FileRequest       = 0
   *   ASL_FontRequest       = 1
   *   ASL_ScreenModeRequest = 2
   *   ASL_ArexxRequest      = 3
   *
   * Tag IDs. Every ASL tag, whichever requester it belongs to, is
   * ASL_TB + n with ASL_TB = TAG_USER + 0x80000 = 0x80080000; the
   * file, font and screen-mode requesters share one numbering. Values
   * below are from NDK3.2R4 Include_H/libraries/asl.h. (Until 0.213
   * they were hand-typed and seven of the file-requester tags were
   * wrong: InitialDrawer was really InitialFile's value, for one.)
   */
  static consts = CEnumeration.lazy('AslConsts', {
    /* consts-begin - written by scripts/gen_consts.py from the NDK headers; do not edit */
    /* Requester types (libraries/asl.h) */
    ASL_FileRequest:       0,
    ASL_FontRequest:       1,
    ASL_ScreenModeRequest: 2,

    /* File requester tags (libraries/asl.h) */
    ASLFR_Window:             0x80080002,   /* ASL_TB + 2 */
    ASLFR_Screen:             0x80080028,   /* ASL_TB + 40 */
    ASLFR_PubScreenName:      0x80080029,   /* ASL_TB + 41 */
    ASLFR_PrivateIDCMP:       0x8008002A,   /* ASL_TB + 42 */
    ASLFR_IntuiMsgFunc:       0x80080046,   /* ASL_TB + 70 */
    ASLFR_SleepWindow:        0x8008002B,   /* ASL_TB + 43 */
    ASLFR_UserData:           0x80080034,   /* ASL_TB + 52 */
    ASLFR_PopToFront:         0x80080083,   /* ASL_TB + 131 */
    ASLFR_Activate:           0x80080084,   /* ASL_TB + 132 */
    ASLFR_TextAttr:           0x80080033,   /* ASL_TB + 51 */
    ASLFR_Locale:             0x80080032,   /* ASL_TB + 50 */
    ASLFR_TitleText:          0x80080001,   /* ASL_TB + 1 */
    ASLFR_PositiveText:       0x80080012,   /* ASL_TB + 18 */
    ASLFR_NegativeText:       0x80080013,   /* ASL_TB + 19 */
    ASLFR_InitialLeftEdge:    0x80080003,   /* ASL_TB + 3 */
    ASLFR_InitialTopEdge:     0x80080004,   /* ASL_TB + 4 */
    ASLFR_InitialWidth:       0x80080005,   /* ASL_TB + 5 */
    ASLFR_InitialHeight:      0x80080006,   /* ASL_TB + 6 */
    ASLFR_InitialFile:        0x80080008,   /* ASL_TB + 8 */
    ASLFR_InitialDrawer:      0x80080009,   /* ASL_TB + 9 */
    ASLFR_InitialPattern:     0x8008000A,   /* ASL_TB + 10 */
    ASLFR_InitialShowVolumes: 0x80080082,   /* ASL_TB + 130 */
    ASLFR_Flags1:             0x80080014,   /* ASL_TB + 20 */
    ASLFR_Flags2:             0x80080016,   /* ASL_TB + 22 */
    ASLFR_DoSaveMode:         0x8008002C,   /* ASL_TB + 44 */
    ASLFR_DoMultiSelect:      0x8008002D,   /* ASL_TB + 45 */
    ASLFR_DoPatterns:         0x8008002E,   /* ASL_TB + 46 */
    ASLFR_DrawersOnly:        0x8008002F,   /* ASL_TB + 47 */
    ASLFR_FilterFunc:         0x80080031,   /* ASL_TB + 49 */
    ASLFR_RejectIcons:        0x8008003C,   /* ASL_TB + 60 */
    ASLFR_RejectPattern:      0x8008003D,   /* ASL_TB + 61 */
    ASLFR_AcceptPattern:      0x8008003E,   /* ASL_TB + 62 */
    ASLFR_FilterDrawers:      0x8008003F,   /* ASL_TB + 63 */
    ASLFR_HookFunc:           0x80080007,   /* ASL_TB + 7 */
    ASLFR_SetSortBy:          0x8008007C,   /* ASL_TB + 124 */
    ASLFR_GetSortBy:          0x8008007D,   /* ASL_TB + 125 */
    ASLFR_SetSortDrawers:     0x8008007E,   /* ASL_TB + 126 */
    ASLFR_GetSortDrawers:     0x8008007F,   /* ASL_TB + 127 */
    ASLFR_SetSortOrder:       0x80080080,   /* ASL_TB + 128 */
    ASLFR_GetSortOrder:       0x80080081,   /* ASL_TB + 129 */

    /* Font requester tags (libraries/asl.h) */
    ASLFO_Window:          0x80080002,   /* ASL_TB + 2 */
    ASLFO_Screen:          0x80080028,   /* ASL_TB + 40 */
    ASLFO_PubScreenName:   0x80080029,   /* ASL_TB + 41 */
    ASLFO_PrivateIDCMP:    0x8008002A,   /* ASL_TB + 42 */
    ASLFO_IntuiMsgFunc:    0x80080046,   /* ASL_TB + 70 */
    ASLFO_SleepWindow:     0x8008002B,   /* ASL_TB + 43 */
    ASLFO_UserData:        0x80080034,   /* ASL_TB + 52 */
    ASLFO_PopToFront:      0x80080083,   /* ASL_TB + 131 */
    ASLFO_Activate:        0x80080084,   /* ASL_TB + 132 */
    ASLFO_TextAttr:        0x80080033,   /* ASL_TB + 51 */
    ASLFO_Locale:          0x80080032,   /* ASL_TB + 50 */
    ASLFO_TitleText:       0x80080001,   /* ASL_TB + 1 */
    ASLFO_PositiveText:    0x80080012,   /* ASL_TB + 18 */
    ASLFO_NegativeText:    0x80080013,   /* ASL_TB + 19 */
    ASLFO_InitialLeftEdge: 0x80080003,   /* ASL_TB + 3 */
    ASLFO_InitialTopEdge:  0x80080004,   /* ASL_TB + 4 */
    ASLFO_InitialWidth:    0x80080005,   /* ASL_TB + 5 */
    ASLFO_InitialHeight:   0x80080006,   /* ASL_TB + 6 */
    ASLFO_InitialName:     0x8008000A,   /* ASL_TB + 10 */
    ASLFO_InitialSize:     0x8008000B,   /* ASL_TB + 11 */
    ASLFO_InitialStyle:    0x8008000C,   /* ASL_TB + 12 */
    ASLFO_InitialFlags:    0x8008000D,   /* ASL_TB + 13 */
    ASLFO_InitialFrontPen: 0x8008000E,   /* ASL_TB + 14 */
    ASLFO_InitialBackPen:  0x8008000F,   /* ASL_TB + 15 */
    ASLFO_InitialDrawMode: 0x8008003B,   /* ASL_TB + 59 */
    ASLFO_InitialSpecMode: 0x8008008B,   /* ASL_TB + 139 */
    ASLFO_InitialCharSet:  0x80080086,   /* ASL_TB + 134 */
    ASLFO_Flags:           0x80080014,   /* ASL_TB + 20 */
    ASLFO_DoFrontPen:      0x8008002C,   /* ASL_TB + 44 */
    ASLFO_DoBackPen:       0x8008002D,   /* ASL_TB + 45 */
    ASLFO_DoStyle:         0x8008002E,   /* ASL_TB + 46 */
    ASLFO_DoDrawMode:      0x8008002F,   /* ASL_TB + 47 */
    ASLFO_DoSpecialMode:   0x8008008C,   /* ASL_TB + 140 */
    ASLFO_DoCharSet:       0x80080087,   /* ASL_TB + 135 */
    ASLFO_SampleText:      0x80080085,   /* ASL_TB + 133 */
    ASLFO_FixedWidthOnly:  0x80080030,   /* ASL_TB + 48 */
    ASLFO_OTagOnly:        0x80080088,   /* ASL_TB + 136 */
    ASLFO_ScalableOnly:    0x80080089,   /* ASL_TB + 137 */
    ASLFO_MinHeight:       0x80080010,   /* ASL_TB + 16 */
    ASLFO_MaxHeight:       0x80080011,   /* ASL_TB + 17 */
    ASLFO_FilterFunc:      0x80080031,   /* ASL_TB + 49 */
    ASLFO_CSFilterFunc:    0x8008008A,   /* ASL_TB + 138 */
    ASLFO_HookFunc:        0x80080007,   /* ASL_TB + 7 */
    ASLFO_MaxFrontPen:     0x80080042,   /* ASL_TB + 66 */
    ASLFO_MaxBackPen:      0x80080043,   /* ASL_TB + 67 */
    ASLFO_ModeList:        0x80080015,   /* ASL_TB + 21 */
    ASLFO_FrontPens:       0x80080040,   /* ASL_TB + 64 */
    ASLFO_BackPens:        0x80080041,   /* ASL_TB + 65 */

    /* Screen mode requester tags (libraries/asl.h) */
    ASLSM_Window:               0x80080002,   /* ASL_TB + 2 */
    ASLSM_Screen:               0x80080028,   /* ASL_TB + 40 */
    ASLSM_PubScreenName:        0x80080029,   /* ASL_TB + 41 */
    ASLSM_PrivateIDCMP:         0x8008002A,   /* ASL_TB + 42 */
    ASLSM_IntuiMsgFunc:         0x80080046,   /* ASL_TB + 70 */
    ASLSM_SleepWindow:          0x8008002B,   /* ASL_TB + 43 */
    ASLSM_UserData:             0x80080034,   /* ASL_TB + 52 */
    ASLSM_PopToFront:           0x80080083,   /* ASL_TB + 131 */
    ASLSM_Activate:             0x80080084,   /* ASL_TB + 132 */
    ASLSM_TextAttr:             0x80080033,   /* ASL_TB + 51 */
    ASLSM_Locale:               0x80080032,   /* ASL_TB + 50 */
    ASLSM_TitleText:            0x80080001,   /* ASL_TB + 1 */
    ASLSM_PositiveText:         0x80080012,   /* ASL_TB + 18 */
    ASLSM_NegativeText:         0x80080013,   /* ASL_TB + 19 */
    ASLSM_InitialLeftEdge:      0x80080003,   /* ASL_TB + 3 */
    ASLSM_InitialTopEdge:       0x80080004,   /* ASL_TB + 4 */
    ASLSM_InitialWidth:         0x80080005,   /* ASL_TB + 5 */
    ASLSM_InitialHeight:        0x80080006,   /* ASL_TB + 6 */
    ASLSM_InitialDisplayID:     0x80080064,   /* ASL_TB + 100 */
    ASLSM_InitialDisplayWidth:  0x80080065,   /* ASL_TB + 101 */
    ASLSM_InitialDisplayHeight: 0x80080066,   /* ASL_TB + 102 */
    ASLSM_InitialDisplayDepth:  0x80080067,   /* ASL_TB + 103 */
    ASLSM_InitialOverscanType:  0x80080068,   /* ASL_TB + 104 */
    ASLSM_InitialAutoScroll:    0x80080069,   /* ASL_TB + 105 */
    ASLSM_InitialInfoOpened:    0x8008006A,   /* ASL_TB + 106 */
    ASLSM_InitialInfoLeftEdge:  0x8008006B,   /* ASL_TB + 107 */
    ASLSM_InitialInfoTopEdge:   0x8008006C,   /* ASL_TB + 108 */
    ASLSM_DoWidth:              0x8008006D,   /* ASL_TB + 109 */
    ASLSM_DoHeight:             0x8008006E,   /* ASL_TB + 110 */
    ASLSM_DoDepth:              0x8008006F,   /* ASL_TB + 111 */
    ASLSM_DoOverscanType:       0x80080070,   /* ASL_TB + 112 */
    ASLSM_DoAutoScroll:         0x80080071,   /* ASL_TB + 113 */
    ASLSM_PropertyFlags:        0x80080072,   /* ASL_TB + 114 */
    ASLSM_PropertyMask:         0x80080073,   /* ASL_TB + 115 */
    ASLSM_MinWidth:             0x80080074,   /* ASL_TB + 116 */
    ASLSM_MaxWidth:             0x80080075,   /* ASL_TB + 117 */
    ASLSM_MinHeight:            0x80080076,   /* ASL_TB + 118 */
    ASLSM_MaxHeight:            0x80080077,   /* ASL_TB + 119 */
    ASLSM_MinDepth:             0x80080078,   /* ASL_TB + 120 */
    ASLSM_MaxDepth:             0x80080079,   /* ASL_TB + 121 */
    ASLSM_FilterFunc:           0x8008007A,   /* ASL_TB + 122 */
    ASLSM_CustomSMList:         0x8008007B,   /* ASL_TB + 123 */
    /* consts-end */
  });

  /**
   * AllocAslRequest(type, tagList) — d0=type, a0=tagList. Returns
   * a Requester* pointer (opaque; fields read via offsets after
   * AslRequest). The NDK 3.2 FD calls this plain name (not
   * AllocAslRequestA) — a trailing 'A' would be a wrong LVO name,
   * resolve to undefined, and guru with an F-line emulator trap.
   *
   * @param {number}      type    — ASL_FileRequest etc.
   * @param {number|null} tagList — prepared TagItem* or NULL
   * @returns {number} requester pointer (0 on failure)
   */
  static AllocAslRequest(type, tagList) {
    return this.call(this.lvo.AllocAslRequest, {
      d0: type | 0, a0: ptrOf(tagList),
    });
  }

  /**
   * Convenience over AllocAslRequest — builds the TagItem array
   * from JS pairs and frees it after allocation.
   *
   * @param {number}                  type
   * @param {Array<[number, number]>} [pairs]
   * @returns {number} requester ptr
   */
  static AllocAslRequestTags(type, pairs) {
    let p = pairs || [];
    let tags = globalThis.amiga.makeTags(p);
    let bytes = (p.length + 1) * 8;

    try {
      return this.AllocAslRequest(type, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  /**
   * FreeAslRequest(requester) — a0=requester.
   *
   * @param {number} requester
   * @returns {undefined}
   */
  static FreeAslRequest(requester) {
    return this.call(this.lvo.FreeAslRequest,
      { a0: ptrOf(requester) });
  }

  /**
   * AslRequest(requester, tagList) — a0=requester, a1=tagList.
   * Returns true (non-zero) if the user clicked OK; false if
   * cancelled or an error occurred.
   *
   * @param {number}      requester
   * @param {number|null} tagList
   * @returns {number} BOOL (0/1) as returned by asl.library
   */
  static AslRequest(requester, tagList) {
    return this.call(this.lvo.AslRequest, {
      a0: ptrOf(requester), a1: ptrOf(tagList),
    });
  }

  /**
   * Convenience — one call that allocates, runs the requester, and
   * frees cleanly. Returns a {ok, drawer, file, path} object for
   * file requesters, or {ok, requester} for other types.
   *
   * File-request layout (struct FileRequester after a successful
   * AslRequest, from NDK3.2R4 libraries/asl.h:61):
   *   +0   fr_Reserved0[4]
   *   +4   fr_File   (STRPTR)  — contents of File gadget
   *   +8   fr_Drawer (STRPTR)  — contents of Drawer gadget
   *   +22  fr_LeftEdge (WORD)
   *   ... fr_NumArgs / fr_ArgList for multi-select
   *
   * @param {Array<[number, number]>} pairs — ASLFR_* tag pairs
   * @returns {{ok: boolean, drawer: string|null, file: string|null, path: string|null, requester: number}}
   */
  static openFileRequest(pairs) {
    let req = this.AllocAslRequestTags(this.consts.ASL_FileRequest,
                                        pairs);

    if (!req) {
      return { ok: false, drawer: null, file: null, path: null,
               requester: 0 };
    }

    try {
      let ok = this.AslRequest(req, 0);

      if (!ok) {
        return { ok: false, drawer: null, file: null, path: null,
                 requester: req };
      }

      /* Per NDK 3.2 layout: fr_File is at +4, fr_Drawer at +8. */
      let filePtr   = globalThis.amiga.peek32(req + 4);
      let drawerPtr = globalThis.amiga.peek32(req + 8);

      let drawer = drawerPtr
        ? globalThis.amiga.peekString(drawerPtr, 512)
        : null;

      let file = filePtr
        ? globalThis.amiga.peekString(filePtr, 256)
        : null;

      let path = null;

      if (drawer !== null && file !== null) {
        let sep = '';

        if (drawer.length && !drawer.endsWith(':') &&
            !drawer.endsWith('/')) {
          sep = '/';
        }

        path = drawer + sep + file;
      }

      return { ok: true, drawer, file, path, requester: req };
    }

    finally {
      this.FreeAslRequest(req);
    }
  }
}
