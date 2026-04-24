/* quickjs-master/amiga/ffi/boopsi/gadgets/Space.js
 *
 * space.gadget — Reaction empty-space / filler gadget. Useful for
 * layout spacing and as a bevel-framed visual area. Extends
 * gadgetclass.
 *
 * SPACE_Dummy = REACTION_Dummy + 0x9000 = 0x85009000.
 *
 * Tags re-derived from gadgets/space.h (NDK 3.2R4). Previous table
 * had MinWidth/MinHeight swapped and Transparent/AreaBox/BevelStyle/
 * RenderHook shifted. NDK actually has MinHeight at +1, MinWidth +2,
 * MouseX +3, MouseY +4, Transparent +5, AreaBox +6, RenderHook +7,
 * BevelStyle +8, DomainBevel +9.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';

/** @internal SPACE_* tag IDs (gadgets/space.h). */
const SPACE = Object.freeze({
  MinHeight:   0x85009001,   /* +1 */
  MinWidth:    0x85009002,   /* +2 */
  MouseX:      0x85009003,   /* +3 */
  MouseY:      0x85009004,   /* +4 */
  Transparent: 0x85009005,   /* +5 */
  AreaBox:     0x85009006,   /* +6 (ptr to struct IBox) */
  RenderHook:  0x85009007,   /* +7 (ptr to struct Hook) */
  BevelStyle:  0x85009008,   /* +8 */
  DomainBevel: 0x85009009,   /* +9 */
});

/**
 * space.gadget — Reaction filler / spacer. Commonly used as a layout
 * padding element or as a framed custom-render surface.
 *
 * @extends GadgetBase
 */
export class Space extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/space.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    minWidth:    { tagID: SPACE.MinWidth,    type: 'int32' },
    minHeight:   { tagID: SPACE.MinHeight,   type: 'int32' },
    mouseX:      { tagID: SPACE.MouseX,      type: 'int32' },
    mouseY:      { tagID: SPACE.MouseY,      type: 'int32' },
    transparent: { tagID: SPACE.Transparent, type: 'bool' },
    areaBox:     { tagID: SPACE.AreaBox,     type: 'ptr' },
    renderHook:  { tagID: SPACE.RenderHook,  type: 'ptr' },
    bevelStyle:  { tagID: SPACE.BevelStyle,  type: 'uint32' },
    domainBevel: { tagID: SPACE.DomainBevel, type: 'bool' },
  };
}
