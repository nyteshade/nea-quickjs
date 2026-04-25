/* quickjs-master/amiga/ffi/boopsi/gadgets/GetFont.js
 *
 * getfont.gadget — pop-up font-requester gadget.
 *
 * GETFONT_Dummy = REACTION_Dummy + 0x40000 = 0x85040000.
 *
 * Tags re-derived from gadgets/getfont.h (NDK 3.2R4). Previous table
 * was off by several slots — the first tag is TextAttr (+1), not
 * TitleText which lives at +9. FontName / FontHeight / FontStyle /
 * FontFlags / FrontPen / BackPen / DrawMode / ModalRequest /
 * Negative/PositiveText from the old table don't exist in the OS3.2
 * header — all drop-through tags that were never real.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal GETFONT_* tag IDs (gadgets/getfont.h). */
const GETFONT = Object.freeze({
  TextAttr:       0x85040001,   /* +1 (struct TextAttr* — the chosen font) */
  DoFrontPen:     0x85040002,   /* +2 — show front-pen chooser */
  DoBackPen:      0x85040003,   /* +3 */
  DoStyle:        0x85040004,   /* +4 — show style toggles */
  DoDrawMode:     0x85040005,   /* +5 */
  MinHeight:      0x85040006,   /* +6 */
  MaxHeight:      0x85040007,   /* +7 */
  FixedWidthOnly: 0x85040008,   /* +8 */
  TitleText:      0x85040009,   /* +9 */
  Height:         0x8504000A,   /* +10 */
  Width:          0x8504000B,   /* +11 */
});

/**
 * getfont.gadget — pop-up font requester.
 *
 * @extends GadgetBase
 */
export class GetFont extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/getfont.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    textAttr:       { tagID: GETFONT.TextAttr,       type: 'ptr' },
    doFrontPen:     { tagID: GETFONT.DoFrontPen,     type: 'bool' },
    doBackPen:      { tagID: GETFONT.DoBackPen,      type: 'bool' },
    doStyle:        { tagID: GETFONT.DoStyle,        type: 'bool' },
    doDrawMode:     { tagID: GETFONT.DoDrawMode,     type: 'bool' },
    minHeight:      { tagID: GETFONT.MinHeight,      type: 'int32' },
    maxHeight:      { tagID: GETFONT.MaxHeight,      type: 'int32' },
    fixedWidthOnly: { tagID: GETFONT.FixedWidthOnly, type: 'bool' },
    titleText:      { tagID: GETFONT.TitleText,      type: 'string-owned' },
    height:         { tagID: GETFONT.Height,         type: 'int32' },
    width:          { tagID: GETFONT.Width,          type: 'int32' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }

  /**
   * Pop the font requester. The GetFont gadget by itself is a passive
   * display of the current font — it does NOT auto-open a requester
   * on click. Per gadgets/getfont.h:137-149 the application must
   * explicitly send GFONT_REQUEST (0x600001) to the gadget with the
   * locking window pointer in the gfr_Window slot.
   *
   * Typical pattern: a separate Button labelled "Pick Font..." whose
   * BUTTON_CLICK handler calls `picker.request(win.intuiWindow.ptr)`.
   * After the user picks, FONT_SELECTED fires and `picker.get('textAttr')`
   * returns the chosen struct TextAttr*.
   *
   * @param {number} winStructPtr — struct Window * (NOT the wrapper).
   *                                Use `win.intuiWindow.ptr` from a
   *                                ReactionWindow.
   * @returns {number} method dispatcher result
   */
  request(winStructPtr) {
    return this.doMethod(0x600001, winStructPtr | 0);
  }
}

EventKind.define('FONT_SELECTED', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/getfont.gadget',
  wraps: 'ATTR_UPDATE',
});
