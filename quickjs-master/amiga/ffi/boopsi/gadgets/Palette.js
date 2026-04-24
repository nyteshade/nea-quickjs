/* quickjs-master/amiga/ffi/boopsi/gadgets/Palette.js
 *
 * palette.gadget — Reaction colour-picker gadget. Extends gadgetclass.
 *
 * PALETTE_Dummy = REACTION_Dummy + 0x4000 = 0x85004000.
 *
 * Tags re-derived from gadgets/palette.h (NDK 3.2R4). OS3.2 supports
 * only a handful of PALETTE_* tags; several names from the earlier
 * hand-typed table (Depth, IndicatorWidth, IndicatorHeight,
 * UseScrnPalette, RenderPen) don't exist in the OS3.2 header.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal PALETTE_* tag IDs (gadgets/palette.h).
 *
 * Note: the NDK header uses British spelling for the primary symbols
 * (PALETTE_Colour, PALETTE_NumColours, ...) with American-spelling
 * aliases that macro-expand to the same value. Both forms exposed
 * here just for clarity. */
const PALETTE = Object.freeze({
  Colour:       0x85004001,   /* +1 — current selected colour index */
  Color:        0x85004001,   /* alias */
  ColourOffset: 0x85004002,   /* +2 — first pen in the palette */
  ColorOffset:  0x85004002,   /* alias */
  ColourTable:  0x85004003,   /* +3 — pointer to UBYTE table of pens to show */
  ColorTable:   0x85004003,   /* alias */
  NumColours:   0x85004004,   /* +4 — count of colours to present */
  NumColors:    0x85004004,   /* alias */
  RenderHook:   0x85004007,   /* +7 */
});

/**
 * palette.gadget — Reaction colour-picker.
 *
 * @extends GadgetBase
 */
export class Palette extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/palette.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    color:        { tagID: PALETTE.Colour,       type: 'uint32' },
    colorOffset:  { tagID: PALETTE.ColorOffset,  type: 'uint32' },
    colorTable:   { tagID: PALETTE.ColorTable,   type: 'ptr' },
    numColors:    { tagID: PALETTE.NumColors,    type: 'uint32' },
    renderHook:   { tagID: PALETTE.RenderHook,   type: 'ptr' },
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
