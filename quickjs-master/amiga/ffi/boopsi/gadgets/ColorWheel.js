/* quickjs-master/amiga/ffi/boopsi/gadgets/ColorWheel.js
 *
 * colorwheel.gadget — circular HSB color-picker wheel.
 *
 * Tag values derived from NDK3.2R4 Include_H/gadgets/colorwheel.h
 * (audit 10.6.2026, T-reaction-audit-remaining-4):
 *   WHEEL_Dummy = TAG_USER + 0x04000000 = 0x84000000
 * The previous table was misnumbered across the board (e.g. Hue was
 * +4 instead of +1, Screen was +1 instead of +9) and had two invented
 * tags (ColorMap, Silent, Screen2) that do not exist in the NDK.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const WHEEL = Object.freeze({
  /* check-constants: prefix WHEEL_ header gadgets/colorwheel.h */
  Hue:            0x84000001,  /* WHEEL_Dummy + 1  (ULONG fraction)   */
  Saturation:     0x84000002,  /* WHEEL_Dummy + 2  (ULONG fraction)   */
  Brightness:     0x84000003,  /* WHEEL_Dummy + 3  (ULONG fraction)   */
  HSB:            0x84000004,  /* WHEEL_Dummy + 4  (ColorWheelHSB *)  */
  Red:            0x84000005,  /* WHEEL_Dummy + 5  (ULONG fraction)   */
  Green:          0x84000006,  /* WHEEL_Dummy + 6  (ULONG fraction)   */
  Blue:           0x84000007,  /* WHEEL_Dummy + 7  (ULONG fraction)   */
  RGB:            0x84000008,  /* WHEEL_Dummy + 8  (ColorWheelRGB *)  */
  Screen:         0x84000009,  /* WHEEL_Dummy + 9  (struct Screen *)  */
  Abbrv:          0x8400000A,  /* WHEEL_Dummy + 10 (STRPTR "GCBMRY")  */
  Donation:       0x8400000B,  /* WHEEL_Dummy + 11 (pens donated)     */
  BevelBox:       0x8400000C,  /* WHEEL_Dummy + 12 (BOOL)             */
  GradientSlider: 0x8400000D,  /* WHEEL_Dummy + 13 (Object *)         */
  MaxPens:        0x8400000E,  /* WHEEL_Dummy + 14 (UWORD)            */
});

/**
 * colorwheel.gadget — circular HSB color picker.
 *
 * Hue/saturation/brightness and red/green/blue components are 32-bit
 * "fraction" values (0x00000000 .. 0xFFFFFFFF maps 0.0 .. 1.0).
 *
 * @extends GadgetBase
 */
export class ColorWheel extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/colorwheel.gadget';

  /** @type {string} — no XXX_GetClass in this library; instantiate by name */
  static _publicClassID = 'colorwheel.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    hue:            { tagID: WHEEL.Hue,            type: 'uint32' },
    saturation:     { tagID: WHEEL.Saturation,     type: 'uint32' },
    brightness:     { tagID: WHEEL.Brightness,     type: 'uint32' },
    hsb:            { tagID: WHEEL.HSB,            type: 'ptr' },
    red:            { tagID: WHEEL.Red,            type: 'uint32' },
    green:          { tagID: WHEEL.Green,          type: 'uint32' },
    blue:           { tagID: WHEEL.Blue,           type: 'uint32' },
    rgb:            { tagID: WHEEL.RGB,            type: 'ptr' },
    screen:         { tagID: WHEEL.Screen,         type: 'ptr' },
    abbrv:          { tagID: WHEEL.Abbrv,          type: 'string' },
    donation:       { tagID: WHEEL.Donation,       type: 'uint32' },
    bevelBox:       { tagID: WHEEL.BevelBox,       type: 'bool' },
    gradientSlider: { tagID: WHEEL.GradientSlider, type: 'ptr' },
    maxPens:        { tagID: WHEEL.MaxPens,        type: 'uint32' },
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
