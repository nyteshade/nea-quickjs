/* quickjs-master/amiga/ffi/boopsi/gadgets/ColorWheel.js
 *
 * colorwheel.gadget — circular HSB color-picker wheel.
 *
 * WHEEL_Dummy = TAG_USER + 0x04000000 = 0x84000000 (shares pre-Reaction
 * base, distinct from REACTION_Dummy namespace).
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const WHEEL = Object.freeze({
  Screen:      0x84000001,
  ColorMap:    0x84000002,
  Saturation:  0x84000003,
  Hue:         0x84000004,
  Brightness:  0x84000005,
  HSB:         0x84000006,
  RGB:         0x84000007,
  Silent:      0x84000008,
  BevelBox:    0x84000009,
  Screen2:     0x8400000A,
});

/**
 * colorwheel.gadget — circular HSB color picker.
 *
 * @extends GadgetBase
 */
export class ColorWheel extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/colorwheel.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    screen:     { tagID: WHEEL.Screen,     type: 'ptr' },
    colorMap:   { tagID: WHEEL.ColorMap,   type: 'ptr' },
    saturation: { tagID: WHEEL.Saturation, type: 'uint32' },
    hue:        { tagID: WHEEL.Hue,        type: 'uint32' },
    brightness: { tagID: WHEEL.Brightness, type: 'uint32' },
    hsb:        { tagID: WHEEL.HSB,        type: 'ptr' },
    rgb:        { tagID: WHEEL.RGB,        type: 'ptr' },
    silent:     { tagID: WHEEL.Silent,     type: 'bool' },
    bevelBox:   { tagID: WHEEL.BevelBox,   type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('COLORWHEEL_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/colorwheel.gadget',
  wraps: 'ATTR_UPDATE',
});
