/* quickjs-master/amiga/ffi/boopsi/gadgets/Palette.js
 *
 * palette.gadget — Reaction color picker grid. Extends gadgetclass.
 *
 * PALETTE_Dummy = REACTION_Dummy + 0x4000 = 0x85004000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const PALETTE = Object.freeze({
  Color:        0x85004001,
  NumColors:    0x85004002,
  ColorOffset:  0x85004003,
  Depth:        0x85004004,
  ColorTable:   0x85004005,
  Indicator:    0x85004006,
  IndicatorWidth: 0x85004007,
  IndicatorHeight:0x85004008,
  RenderPen:    0x85004009,
  UseScrnPalette:0x8500400A,
});

/**
 * palette.gadget — color picker.
 *
 * @extends GadgetBase
 */
export class Palette extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/palette.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    color:            { tagID: PALETTE.Color,           type: 'uint32' },
    numColors:        { tagID: PALETTE.NumColors,       type: 'int32' },
    colorOffset:      { tagID: PALETTE.ColorOffset,     type: 'int32' },
    depth:            { tagID: PALETTE.Depth,           type: 'int32' },
    colorTable:       { tagID: PALETTE.ColorTable,      type: 'ptr' },
    indicator:        { tagID: PALETTE.Indicator,       type: 'bool' },
    indicatorWidth:   { tagID: PALETTE.IndicatorWidth,  type: 'int32' },
    indicatorHeight:  { tagID: PALETTE.IndicatorHeight, type: 'int32' },
    renderPen:        { tagID: PALETTE.RenderPen,       type: 'uint32' },
    useScrnPalette:   { tagID: PALETTE.UseScrnPalette,  type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('PALETTE_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/palette.gadget',
  wraps: 'ATTR_UPDATE',
});
