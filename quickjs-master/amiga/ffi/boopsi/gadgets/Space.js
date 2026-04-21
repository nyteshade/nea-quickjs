/* quickjs-master/amiga/ffi/boopsi/gadgets/Space.js
 *
 * space.gadget — Reaction visual spacer / manual-draw area. Extends
 * gadgetclass. Useful for layout padding or as a canvas for custom
 * rendering via SPACE_RenderHook.
 *
 * SPACE_Dummy = REACTION_Dummy + 0x9000 = 0x85009000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';

const SPACE = Object.freeze({
  MinWidth:    0x85009001,
  MinHeight:   0x85009002,
  Transparent: 0x85009003,
  AreaBox:     0x85009004,
  BevelStyle:  0x85009005,
  RenderHook:  0x85009006,
});

/**
 * space.gadget — visual spacer / custom canvas.
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
    transparent: { tagID: SPACE.Transparent, type: 'bool' },
    areaBox:     { tagID: SPACE.AreaBox,     type: 'ptr' },
    bevelStyle:  { tagID: SPACE.BevelStyle,  type: 'uint32' },
    renderHook:  { tagID: SPACE.RenderHook,  type: 'ptr' },
  };
}
