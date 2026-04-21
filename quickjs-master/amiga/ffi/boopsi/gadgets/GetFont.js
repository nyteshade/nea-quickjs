/* quickjs-master/amiga/ffi/boopsi/gadgets/GetFont.js
 *
 * getfont.gadget — Reaction font-requester popup.
 *
 * GETFONT_Dummy = REACTION_Dummy + 0x40000 = 0x85040000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const GETFONT = Object.freeze({
  TitleText:       0x85040001,
  TextAttr:        0x85040002,
  FontName:        0x85040003,
  FontHeight:      0x85040004,
  FontStyle:       0x85040005,
  FontFlags:       0x85040006,
  DoFrontPen:      0x85040007,
  DoBackPen:       0x85040008,
  DoDrawMode:      0x85040009,
  DoStyle:         0x8504000A,
  FixedWidthOnly:  0x8504000B,
  MinHeight:       0x8504000C,
  MaxHeight:       0x8504000D,
  FrontPen:        0x8504000E,
  BackPen:         0x8504000F,
  DrawMode:        0x85040010,
  ModalRequest:    0x85040011,
  NegativeText:    0x85040012,
  PositiveText:    0x85040013,
});

/**
 * getfont.gadget — font-requester popup button.
 *
 * @extends GadgetBase
 */
export class GetFont extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/getfont.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    titleText:      { tagID: GETFONT.TitleText,      type: 'string-owned' },
    textAttr:       { tagID: GETFONT.TextAttr,       type: 'ptr' },
    fontName:       { tagID: GETFONT.FontName,       type: 'string-owned' },
    fontHeight:     { tagID: GETFONT.FontHeight,     type: 'int32' },
    fontStyle:      { tagID: GETFONT.FontStyle,      type: 'uint32' },
    fontFlags:      { tagID: GETFONT.FontFlags,      type: 'uint32' },
    doFrontPen:     { tagID: GETFONT.DoFrontPen,     type: 'bool' },
    doBackPen:      { tagID: GETFONT.DoBackPen,      type: 'bool' },
    doDrawMode:     { tagID: GETFONT.DoDrawMode,     type: 'bool' },
    doStyle:        { tagID: GETFONT.DoStyle,        type: 'bool' },
    fixedWidthOnly: { tagID: GETFONT.FixedWidthOnly, type: 'bool' },
    minHeight:      { tagID: GETFONT.MinHeight,      type: 'int32' },
    maxHeight:      { tagID: GETFONT.MaxHeight,      type: 'int32' },
    frontPen:       { tagID: GETFONT.FrontPen,       type: 'uint32' },
    backPen:        { tagID: GETFONT.BackPen,        type: 'uint32' },
    drawMode:       { tagID: GETFONT.DrawMode,       type: 'uint32' },
    modalRequest:   { tagID: GETFONT.ModalRequest,   type: 'bool' },
    negativeText:   { tagID: GETFONT.NegativeText,   type: 'string-owned' },
    positiveText:   { tagID: GETFONT.PositiveText,   type: 'string-owned' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('FONT_SELECTED', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/getfont.gadget',
  wraps: 'ATTR_UPDATE',
});
