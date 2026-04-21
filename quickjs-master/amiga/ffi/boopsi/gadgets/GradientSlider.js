/* quickjs-master/amiga/ffi/boopsi/gadgets/GradientSlider.js
 *
 * gradientslider.gadget — color-gradient strip with a slider knob;
 * typically used inside ColorWheel's HSB controls.
 *
 * GRAD_Dummy = TAG_USER + 0x05000000 = 0x85000000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const GRAD = Object.freeze({
  MaxVal:     0x85000001,
  CurVal:     0x85000002,
  SkipVal:    0x85000003,
  KnobPixels: 0x85000004,
  PenArray:   0x85000005,
  Orientation:0x85000006,
});

/**
 * gradientslider.gadget — gradient slider.
 *
 * @extends GadgetBase
 */
export class GradientSlider extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/gradientslider.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    maxVal:     { tagID: GRAD.MaxVal,      type: 'uint32' },
    curVal:     { tagID: GRAD.CurVal,      type: 'uint32' },
    skipVal:    { tagID: GRAD.SkipVal,     type: 'int32' },
    knobPixels: { tagID: GRAD.KnobPixels,  type: 'int32' },
    penArray:   { tagID: GRAD.PenArray,    type: 'ptr' },
    orientation:{ tagID: GRAD.Orientation, type: 'uint32' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('GRADIENT_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/gradientslider.gadget',
  wraps: 'ATTR_UPDATE',
});
