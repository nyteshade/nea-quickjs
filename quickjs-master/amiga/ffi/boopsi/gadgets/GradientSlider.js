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
  /* check-constants: prefix GRAD_ header gadgets/gradientslider.h */
  MaxVal:     0x85000001,
  CurVal:     0x85000002,
  SkipVal:    0x85000003,
  KnobPixels: 0x85000004,
  PenArray:   0x85000005,
});

/** A gradient slider is a prop gadget: its direction is PGA_Freedom
 *  (intuition/gadgetclass.h), LORIENT_HORIZ or LORIENT_VERT. Until
 *  0.219 `orientation` sent GRAD_Dummy+6, which the header does not
 *  define. */
const PGA_Freedom = 0x80031001;

/**
 * gradientslider.gadget — gradient slider.
 *
 * @extends GadgetBase
 */
export class GradientSlider extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/gradientslider.gadget';

  /** @type {string} — no XXX_GetClass in this library; instantiate by name */
  static _publicClassID = 'gradientslider.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    maxVal:     { tagID: GRAD.MaxVal,      type: 'uint32' },
    curVal:     { tagID: GRAD.CurVal,      type: 'uint32' },
    skipVal:    { tagID: GRAD.SkipVal,     type: 'int32' },
    knobPixels: { tagID: GRAD.KnobPixels,  type: 'int32' },
    penArray:   { tagID: GRAD.PenArray,    type: 'ptr' },
    orientation:{ tagID: PGA_Freedom,      type: 'uint32' },
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
