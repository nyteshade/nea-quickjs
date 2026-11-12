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
  static consts = CEnumeration.lazy('GadToolsConsts', {
    /* consts-begin - written by scripts/gen_consts.py from the NDK headers; do not edit */
    /* Gadget kinds (libraries/gadtools.h) */
    GENERIC_KIND:  0,
    BUTTON_KIND:   1,
    CHECKBOX_KIND: 2,
    INTEGER_KIND:  3,
    LISTVIEW_KIND: 4,
    MX_KIND:       5,
    NUMBER_KIND:   6,
    CYCLE_KIND:    7,
    PALETTE_KIND:  8,
    SCROLLER_KIND: 9,
    SLIDER_KIND:   11,
    STRING_KIND:   12,
    TEXT_KIND:     13,
    NWAY_KIND:     7,   /* CYCLE_KIND */

    /* Gadget tags (libraries/gadtools.h) */
    GTMENU_TRIMMED:       0x00000001,
    GTMENU_INVALID:       0x00000002,
    GTMENU_NOMEM:         0x00000003,
    GT_TagBase:           0x80080000,   /* TAG_USER + 0x80000 */
    GTVI_NewWindow:       0x80080001,   /* GT_TagBase + 1 */
    GTVI_NWTags:          0x80080002,   /* GT_TagBase + 2 */
    GT_Private0:          0x80080003,   /* GT_TagBase + 3 */
    GTCB_Checked:         0x80080004,   /* GT_TagBase + 4 */
    GTLV_Top:             0x80080005,   /* GT_TagBase + 5 */
    GTLV_Labels:          0x80080006,   /* GT_TagBase + 6 */
    GTLV_ReadOnly:        0x80080007,   /* GT_TagBase + 7 */
    GTLV_ScrollWidth:     0x80080008,   /* GT_TagBase + 8 */
    GTMX_Labels:          0x80080009,   /* GT_TagBase + 9 */
    GTMX_Active:          0x8008000A,   /* GT_TagBase + 10 */
    GTTX_Text:            0x8008000B,   /* GT_TagBase + 11 */
    GTTX_CopyText:        0x8008000C,   /* GT_TagBase + 12 */
    GTNM_Number:          0x8008000D,   /* GT_TagBase + 13 */
    GTCY_Labels:          0x8008000E,   /* GT_TagBase + 14 */
    GTCY_Active:          0x8008000F,   /* GT_TagBase + 15 */
    GTPA_Depth:           0x80080010,   /* GT_TagBase + 16 */
    GTPA_Color:           0x80080011,   /* GT_TagBase + 17 */
    GTPA_ColorOffset:     0x80080012,   /* GT_TagBase + 18 */
    GTPA_IndicatorWidth:  0x80080013,   /* GT_TagBase + 19 */
    GTPA_IndicatorHeight: 0x80080014,   /* GT_TagBase + 20 */
    GTSC_Top:             0x80080015,   /* GT_TagBase + 21 */
    GTSC_Total:           0x80080016,   /* GT_TagBase + 22 */
    GTSC_Visible:         0x80080017,   /* GT_TagBase + 23 */
    GTSC_Overlap:         0x80080018,   /* GT_TagBase + 24 */
    GTSL_Min:             0x80080026,   /* GT_TagBase + 38 */
    GTSL_Max:             0x80080027,   /* GT_TagBase + 39 */
    GTSL_Level:           0x80080028,   /* GT_TagBase + 40 */
    GTSL_MaxLevelLen:     0x80080029,   /* GT_TagBase + 41 */
    GTSL_LevelFormat:     0x8008002A,   /* GT_TagBase + 42 */
    GTSL_LevelPlace:      0x8008002B,   /* GT_TagBase + 43 */
    GTSL_DispFunc:        0x8008002C,   /* GT_TagBase + 44 */
    GTST_String:          0x8008002D,   /* GT_TagBase + 45 */
    GTST_MaxChars:        0x8008002E,   /* GT_TagBase + 46 */
    GTIN_Number:          0x8008002F,   /* GT_TagBase + 47 */
    GTIN_MaxChars:        0x80080030,   /* GT_TagBase + 48 */
    GTMN_TextAttr:        0x80080031,   /* GT_TagBase + 49 */
    GTMN_FrontPen:        0x80080032,   /* GT_TagBase + 50 */
    GTBB_Recessed:        0x80080033,   /* GT_TagBase + 51 */
    GT_VisualInfo:        0x80080034,   /* GT_TagBase + 52 */
    GTLV_ShowSelected:    0x80080035,   /* GT_TagBase + 53 */
    GTLV_Selected:        0x80080036,   /* GT_TagBase + 54 */
    GT_Reserved1:         0x80080038,   /* GT_TagBase + 56 */
    GTTX_Border:          0x80080039,   /* GT_TagBase + 57 */
    GTNM_Border:          0x8008003A,   /* GT_TagBase + 58 */
    GTSC_Arrows:          0x8008003B,   /* GT_TagBase + 59 */
    GTMN_Menu:            0x8008003C,   /* GT_TagBase + 60 */
    GTMX_Spacing:         0x8008003D,   /* GT_TagBase + 61 */
    GTMN_FullMenu:        0x8008003E,   /* GT_TagBase + 62 */
    GTMN_SecondaryError:  0x8008003F,   /* GT_TagBase + 63 */
    GT_Underscore:        0x80080040,   /* GT_TagBase + 64 */
    GTST_EditHook:        0x80080037,   /* GT_TagBase + 55 */
    GTIN_EditHook:        0x80080037,   /* GTST_EditHook */
    GTMN_Checkmark:       0x80080041,   /* GT_TagBase + 65 */
    GTMN_AmigaKey:        0x80080042,   /* GT_TagBase + 66 */
    GTMN_NewLookMenus:    0x80080043,   /* GT_TagBase + 67 */
    GTCB_Scaled:          0x80080044,   /* GT_TagBase + 68 */
    GTMX_Scaled:          0x80080045,   /* GT_TagBase + 69 */
    GTPA_NumColors:       0x80080046,   /* GT_TagBase + 70 */
    GTMX_TitlePlace:      0x80080047,   /* GT_TagBase + 71 */
    GTTX_FrontPen:        0x80080048,   /* GT_TagBase + 72 */
    GTTX_BackPen:         0x80080049,   /* GT_TagBase + 73 */
    GTTX_Justification:   0x8008004A,   /* GT_TagBase + 74 */
    GTNM_FrontPen:        0x80080048,   /* GT_TagBase + 72 */
    GTNM_BackPen:         0x80080049,   /* GT_TagBase + 73 */
    GTNM_Justification:   0x8008004A,   /* GT_TagBase + 74 */
    GTNM_Format:          0x8008004B,   /* GT_TagBase + 75 */
    GTNM_MaxNumberLen:    0x8008004C,   /* GT_TagBase + 76 */
    GTBB_FrameType:       0x8008004D,   /* GT_TagBase + 77 */
    GTLV_MakeVisible:     0x8008004E,   /* GT_TagBase + 78 */
    GTLV_ItemHeight:      0x8008004F,   /* GT_TagBase + 79 */
    GTSL_MaxPixelLen:     0x80080050,   /* GT_TagBase + 80 */
    GTSL_Justification:   0x80080051,   /* GT_TagBase + 81 */
    GTPA_ColorTable:      0x80080052,   /* GT_TagBase + 82 */
    GTLV_CallBack:        0x80080053,   /* GT_TagBase + 83 */
    GTLV_MaxPen:          0x80080054,   /* GT_TagBase + 84 */
    GTTX_Clipped:         0x80080055,   /* GT_TagBase + 85 */
    GTNM_Clipped:         0x80080055,   /* GT_TagBase + 85 */
    GTBB_reserved1:       0x8008005A,   /* GT_TagBase + 90 */
    GTMN_reserved1:       0x8008005B,   /* GT_TagBase + 91 */
    GTLV_Total:           0x8008005C,   /* GT_TagBase + 92 */
    GTLV_Visible:         0x8008005D,   /* GT_TagBase + 93 */
    GTBB_Scale:           0x8008005C,   /* GT_TagBase + 92 */
    GTBB_Headline:        0x8008005D,   /* GT_TagBase + 93 */
    GTBB_HeadlinePen:     0x8008005E,   /* GT_TagBase + 94 */
    GTBB_HeadlineFont:    0x8008005F,   /* GT_TagBase + 95 */
    GTVI_LeftBorder:      0x80080060,   /* GT_TagBase + 96 */
    GTVI_TopBorder:       0x80080061,   /* GT_TagBase + 97 */
    GTVI_AlignRight:      0x80080062,   /* GT_TagBase + 98 */
    GTVI_AlignBottom:     0x80080063,   /* GT_TagBase + 99 */
    GTVI_MinFontWidth:    0x80080064,   /* GT_TagBase + 100 */
    GTVI_MinFontHeight:   0x80080065,   /* GT_TagBase + 101 */
    GTMX_ScaledSpacing:   0x80080066,   /* GT_TagBase + 102 */
    GT_Reserved0:         0x80080037,   /* GTST_EditHook */
    GTJ_LEFT:             0,
    GTJ_RIGHT:            1,
    GTJ_CENTER:           2,
    GTNW_Labels:          0x8008000E,   /* GTCY_Labels */
    GTNW_Active:          0x8008000F,   /* GTCY_Active */

    /* Where a gadget's label goes (libraries/gadtools.h) */
    PLACETEXT_LEFT:  0x0001,
    PLACETEXT_RIGHT: 0x0002,
    PLACETEXT_ABOVE: 0x0004,
    PLACETEXT_BELOW: 0x0008,
    PLACETEXT_IN:    0x0010,

    /* NewMenu entry types (libraries/gadtools.h) */
    NM_TITLE:         1,
    NM_ITEM:          2,
    NM_SUB:           3,
    NM_END:           0,
    NM_IGNORE:        64,
    NM_BARLABEL:      0xFFFFFFFF,   /* (STRPTR)-1 */
    NM_MENUDISABLED:  0x0001,   /* MENUENABLED */
    NM_ITEMDISABLED:  0x0010,   /* ITEMENABLED */
    NM_COMMANDSTRING: 0x0004,   /* COMMSEQ */
    NM_FLAGMASK:      0xFFFFFF39,   /* ~(COMMSEQ | ITEMTEXT | HIGHFLAGS) */
    NM_FLAGMASK_V39:  0xFFFFFF3D,   /* ~(ITEMTEXT | HIGHFLAGS) */
    /* consts-end */
  });

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
