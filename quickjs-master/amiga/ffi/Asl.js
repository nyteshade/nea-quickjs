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
   * Tag IDs (ASLTAG_BASE = TAG_USER + 0x80000) common to all types:
   *   ASLFR_Window          = 0x80080018
   *   ASLFR_TitleText       = 0x80080001
   *   ASLFR_InitialDrawer   = 0x80080008
   *   ASLFR_InitialFile     = 0x8008000A
   *   ASLFR_InitialPattern  = 0x8008000B
   *   ASLFR_DoMultiSelect   = 0x80080020
   *   ASLFR_DoPatterns      = 0x80080021
   *   ASLFR_DoSaveMode      = 0x80080024
   *
   * ASLFO_* (font) and ASLSM_* (screenmode) follow the same scheme
   * with +0x10000 and +0x20000 bases respectively.
   */
  static consts = class AslConsts extends CEnumeration {
    static {
      AslConsts.define('ASL_FileRequest',       0);
      AslConsts.define('ASL_FontRequest',       1);
      AslConsts.define('ASL_ScreenModeRequest', 2);
      AslConsts.define('ASL_ArexxRequest',      3);

      /* File-request tags (the most-used subset). */
      AslConsts.define('ASLFR_Window',         0x80080018);
      AslConsts.define('ASLFR_TitleText',      0x80080001);
      AslConsts.define('ASLFR_InitialDrawer',  0x80080008);
      AslConsts.define('ASLFR_InitialFile',    0x8008000A);
      AslConsts.define('ASLFR_InitialPattern', 0x8008000B);
      AslConsts.define('ASLFR_DoMultiSelect',  0x80080020);
      AslConsts.define('ASLFR_DoPatterns',     0x80080021);
      AslConsts.define('ASLFR_DoSaveMode',     0x80080024);

      /* Font-request tags. */
      AslConsts.define('ASLFO_Window',         0x80090018);
      AslConsts.define('ASLFO_TitleText',      0x80090001);
      AslConsts.define('ASLFO_InitialName',    0x80090008);
      AslConsts.define('ASLFO_InitialSize',    0x80090009);

      /* Screenmode-request tags. */
      AslConsts.define('ASLSM_Window',         0x800A0018);
      AslConsts.define('ASLSM_TitleText',      0x800A0001);
    }
  };

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
