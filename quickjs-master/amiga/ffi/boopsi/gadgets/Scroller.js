/* quickjs-master/amiga/ffi/boopsi/gadgets/Scroller.js
 *
 * scroller.gadget — Reaction scrollbar. Extends propgclass. The
 * "Top / Visible / Total" triplet defines position within a larger
 * virtual range.
 *
 * SCROLLER_Dummy = REACTION_Dummy + 0x5000 = 0x85005000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const SCROLLER = Object.freeze({
  Top:            0x85005001,
  Visible:        0x85005002,
  Total:          0x85005003,
  Orientation:    0x85005004,
  Arrows:         0x85005005,
  Stretch:        0x85005006,
  ArrowDelta:     0x85005007,
  SignalTask:     0x8500500A,
  SignalTaskBit:  0x8500500B,
});

/** SCROLLER_Orientation values per propgclass FREEHORIZ/FREEVERT
 *  (intuition/intuition.h:593-594). Same fix as Slider's at 0.173 —
 *  was 0x1/0x2 which the class treated as no-bit-set. */
export const ScrollerOrient = Object.freeze({
  HORIZONTAL: 0x2,
  VERTICAL:   0x4,
});

/**
 * scroller.gadget — scrollbar.
 *
 * @extends GadgetBase
 */
export class Scroller extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/scroller.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    top:         { tagID: SCROLLER.Top,         type: 'int32' },
    visible:     { tagID: SCROLLER.Visible,     type: 'int32' },
    total:       { tagID: SCROLLER.Total,       type: 'int32' },
    orientation: { tagID: SCROLLER.Orientation, type: 'uint32' },
    arrows:      { tagID: SCROLLER.Arrows,      type: 'int32' },
    stretch:     { tagID: SCROLLER.Stretch,     type: 'bool' },
    arrowDelta:  { tagID: SCROLLER.ArrowDelta,  type: 'int32' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (typeof clean.orientation === 'string') {
      clean.orientation = clean.orientation.toLowerCase() === 'vertical'
        ? ScrollerOrient.VERTICAL : ScrollerOrient.HORIZONTAL;
    }
    if (clean.relVerify === undefined) clean.relVerify = true;
    if (clean.tabCycle  === undefined) clean.tabCycle  = true;
    super(clean);
  }
}

EventKind.define('SCROLLER_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/scroller.gadget',
  wraps: 'ATTR_UPDATE',
});
