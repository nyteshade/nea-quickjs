/* quickjs-master/amiga/ffi/boopsi/gadgets/SketchBoard.js
 *
 * sketchboard.gadget — Reaction free-draw canvas.
 *
 * SKETCHBOARD_Dummy = REACTION_Dummy + 0x24600 = 0x85024600.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const SKETCHBOARD = Object.freeze({
  MinWidth:     0x85024601,
  MinHeight:    0x85024602,
  RenderHook:   0x85024603,
  AreaBox:      0x85024604,
  BevelStyle:   0x85024605,
  PenFG:        0x85024606,
  PenBG:        0x85024607,
  PenColor:     0x85024608,
  Drawing:      0x85024609,
});

/**
 * sketchboard.gadget — free-draw canvas.
 *
 * @extends GadgetBase
 */
export class SketchBoard extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/sketchboard.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    minWidth:   { tagID: SKETCHBOARD.MinWidth,   type: 'int32' },
    minHeight:  { tagID: SKETCHBOARD.MinHeight,  type: 'int32' },
    renderHook: { tagID: SKETCHBOARD.RenderHook, type: 'ptr' },
    areaBox:    { tagID: SKETCHBOARD.AreaBox,    type: 'ptr' },
    bevelStyle: { tagID: SKETCHBOARD.BevelStyle, type: 'uint32' },
    penFG:      { tagID: SKETCHBOARD.PenFG,      type: 'uint32' },
    penBG:      { tagID: SKETCHBOARD.PenBG,      type: 'uint32' },
    penColor:   { tagID: SKETCHBOARD.PenColor,   type: 'uint32' },
    drawing:    { tagID: SKETCHBOARD.Drawing,    type: 'bool' },
  };
}

EventKind.define('SKETCH_UPDATE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: true },
  from:  'gadgets/sketchboard.gadget',
  wraps: 'ATTR_UPDATE',
});
