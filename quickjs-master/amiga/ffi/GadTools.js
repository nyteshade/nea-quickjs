/* quickjs-master/amiga/ffi/GadTools.js
 *
 * Wrapper for gadtools.library. All 21 LVOs covered. The C-side
 * names use a `GT_` prefix for some functions; we strip it in the
 * JS form (GadTools.GetIMsg not GadTools.GT_GetIMsg). Raw form
 * remains accessible via amiga.gadtools.lvo.GT_* for anyone who
 * wants it.
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';

export class GadTools extends LibraryBase {
  /** @type {string} */
  static libraryName = 'gadtools.library';

  /** @type {number} */
  static libraryVersion = 39;

  /** @type {Object<string, number>} */
  static lvo = globalThis.amiga.gadtools.lvo;

  /**
   * Gadget kinds (CreateGadgetA's first arg) and selected GT_/GTLV_/
   * GTCB_/GTST_/GTIN_ tag IDs.
   */
  static consts = class GadToolsConsts extends CEnumeration {
    static {
      /* Gadget kinds */
      GadToolsConsts.define('GENERIC_KIND',    0);
      GadToolsConsts.define('BUTTON_KIND',     1);
      GadToolsConsts.define('CHECKBOX_KIND',   2);
      GadToolsConsts.define('INTEGER_KIND',    3);
      GadToolsConsts.define('LISTVIEW_KIND',   4);
      GadToolsConsts.define('MX_KIND',         5);
      GadToolsConsts.define('NUMBER_KIND',     6);
      GadToolsConsts.define('CYCLE_KIND',      7);
      GadToolsConsts.define('PALETTE_KIND',    8);
      GadToolsConsts.define('SCROLLER_KIND',   9);
      GadToolsConsts.define('SLIDER_KIND',    11);
      GadToolsConsts.define('STRING_KIND',    12);
      GadToolsConsts.define('TEXT_KIND',      13);

      /* Common GadTools tag constants. Raw NDK names use the
       * `GT_` / `GTLV_` / etc. prefixes; we keep them here verbatim
       * on the JS side because the prefix tells you which gadget
       * kind the tag is for (it's an attribute prefix, not a
       * library prefix). */
      GadToolsConsts.define('GT_Underscore', 0x80000036);
      GadToolsConsts.define('GTCB_Checked',  0x800000B4);
      GadToolsConsts.define('GTLV_Selected', 0x80000068);
      GadToolsConsts.define('GTLV_Labels',   0x80000067);
      GadToolsConsts.define('GTST_String',   0x80000140);
      GadToolsConsts.define('GTIN_Number',   0x80000180);
    }
  };

  /* === Methods (GT_ library prefix stripped where applicable) === */

  static CreateContext(glistPtrPtr) {
    return this.call(this.lvo.CreateContext, { a0: ptrOf(glistPtrPtr) });
  }

  /**
   * CreateGadgetA(kind, prevGadget, newGadgetTemplate, tagList)
   * — d0 = kind, a0 = prevGadget, a1 = newGadget, a2 = tagList
   */
  static CreateGadgetA(kind, prev, ng, tagList) {
    return this.call(this.lvo.CreateGadgetA, {
      d0: kind | 0,
      a0: ptrOf(prev),
      a1: ptrOf(ng),
      a2: ptrOf(tagList),
    });
  }

  static CreateGadgetTags(kind, prev, ng, pairs) {
    let tags = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.CreateGadgetA(kind, prev, ng, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  static FreeGadgets(gad) {
    return this.call(this.lvo.FreeGadgets, { a0: ptrOf(gad) });
  }

  static SetGadgetAttrsA(gad, win, req, tagList) {
    return this.call(this.lvo.GT_SetGadgetAttrsA, {
      a0: ptrOf(gad), a1: ptrOf(win),
      a2: ptrOf(req), a3: ptrOf(tagList),
    });
  }

  static SetGadgetAttrsTags(gad, win, req, pairs) {
    let tags = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.SetGadgetAttrsA(gad, win, req, tags);
    }

    finally {
      globalThis.amiga.freeMem(tags, bytes);
    }
  }

  static GetGadgetAttrsA(gad, win, req, tagList) {
    return this.call(this.lvo.GT_GetGadgetAttrsA, {
      a0: ptrOf(gad), a1: ptrOf(win),
      a2: ptrOf(req), a3: ptrOf(tagList),
    });
  }

  static CreateMenusA(newMenu, tagList) {
    return this.call(this.lvo.CreateMenusA, {
      a0: ptrOf(newMenu), a1: ptrOf(tagList),
    });
  }

  static FreeMenus(menu) {
    return this.call(this.lvo.FreeMenus, { a0: ptrOf(menu) });
  }

  static LayoutMenuItemsA(item, vi, tagList) {
    return this.call(this.lvo.LayoutMenuItemsA, {
      a0: ptrOf(item), a1: ptrOf(vi), a2: ptrOf(tagList),
    });
  }

  static LayoutMenusA(menu, vi, tagList) {
    return this.call(this.lvo.LayoutMenusA, {
      a0: ptrOf(menu), a1: ptrOf(vi), a2: ptrOf(tagList),
    });
  }

  static GetIMsg(port) {
    return this.call(this.lvo.GT_GetIMsg, { a0: ptrOf(port) });
  }

  static ReplyIMsg(msg) {
    return this.call(this.lvo.GT_ReplyIMsg, { a1: ptrOf(msg) });
  }

  static RefreshWindow(window, requester) {
    return this.call(this.lvo.GT_RefreshWindow, {
      a0: ptrOf(window), a1: ptrOf(requester),
    });
  }

  static BeginRefresh(window) {
    return this.call(this.lvo.GT_BeginRefresh, { a0: ptrOf(window) });
  }

  static EndRefresh(window, complete) {
    return this.call(this.lvo.GT_EndRefresh, {
      a0: ptrOf(window), d0: complete ? 1 : 0,
    });
  }

  static FilterIMsg(msg) {
    return this.call(this.lvo.GT_FilterIMsg, { a1: ptrOf(msg) });
  }

  static PostFilterIMsg(msg) {
    return this.call(this.lvo.GT_PostFilterIMsg, { a1: ptrOf(msg) });
  }

  static DrawBevelBoxA(rport, x, y, w, h, tagList) {
    return this.call(this.lvo.DrawBevelBoxA, {
      a0: ptrOf(rport),
      d0: x | 0, d1: y | 0, d2: w | 0, d3: h | 0,
      a1: ptrOf(tagList),
    });
  }

  static GetVisualInfoA(screen, tagList) {
    return this.call(this.lvo.GetVisualInfoA, {
      a0: ptrOf(screen), a1: ptrOf(tagList),
    });
  }

  static FreeVisualInfo(vi) {
    return this.call(this.lvo.FreeVisualInfo, { a0: ptrOf(vi) });
  }
}
