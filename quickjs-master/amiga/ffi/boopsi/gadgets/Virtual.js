/* quickjs-master/amiga/ffi/boopsi/gadgets/Virtual.js
 *
 * virtual.gadget — Reaction scrollable virtual container. Wraps a
 * child layout that's larger than the visible area and supplies
 * scroller gadgets to pan around.
 *
 * VIRTUAL_Dummy = REACTION_Dummy + 0x62000 = 0x85062000.
 */

import { Layout } from './Layout.js';

const VIRTUAL = Object.freeze({
  NoHorizScroller: 0x85062001,
  NoVertScroller:  0x85062002,
  HorizScroller:   0x85062003,
  VertScroller:    0x85062004,
  TopPixel:        0x85062005,
  LeftPixel:       0x85062006,
  TotalPixels:     0x85062007,
  VisiblePixels:   0x85062008,
});

/**
 * virtual.gadget — scrollable virtual container.
 *
 * @extends Layout
 */
export class Virtual extends Layout {
  /** @type {string} */
  static _classLibName = 'gadgets/virtual.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...Layout.ATTRS,
    noHorizScroller: { tagID: VIRTUAL.NoHorizScroller, type: 'bool' },
    noVertScroller:  { tagID: VIRTUAL.NoVertScroller,  type: 'bool' },
    horizScroller:   { tagID: VIRTUAL.HorizScroller,   type: 'ptr' },
    vertScroller:    { tagID: VIRTUAL.VertScroller,    type: 'ptr' },
    topPixel:        { tagID: VIRTUAL.TopPixel,        type: 'int32' },
    leftPixel:       { tagID: VIRTUAL.LeftPixel,       type: 'int32' },
    totalPixels:     { tagID: VIRTUAL.TotalPixels,     type: 'int32' },
    visiblePixels:   { tagID: VIRTUAL.VisiblePixels,   type: 'int32' },
  };
}
