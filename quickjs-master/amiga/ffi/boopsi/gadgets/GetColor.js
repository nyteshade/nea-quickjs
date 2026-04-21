/* quickjs-master/amiga/ffi/boopsi/gadgets/GetColor.js
 *
 * getcolor.gadget — Reaction color-picker popup.
 *
 * GETCOLOR_Dummy = REACTION_Dummy + 0x43000 = 0x85043000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const GETCOLOR = Object.freeze({
  TitleText:   0x85043001,
  Screen:      0x85043002,
  Color:       0x85043003,
  Red:         0x85043004,
  Green:       0x85043005,
  Blue:        0x85043006,
  Hue:         0x85043007,
  Saturation:  0x85043008,
  Brightness:  0x85043009,
  RGB:         0x8504300A,
  HSB:         0x8504300B,
  ColorWheel:  0x8504300C,
  RGBSliders:  0x8504300D,
  HSBSliders:  0x8504300E,
  SwitchMode:  0x8504300F,
  Initial:     0x85043010,
  ShowRGB:     0x85043011,
  ShowHSB:     0x85043012,
  SmallTextAttr:0x85043013,
});

/**
 * getcolor.gadget — color-picker popup.
 *
 * @extends GadgetBase
 */
export class GetColor extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/getcolor.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    titleText:   { tagID: GETCOLOR.TitleText,    type: 'string-owned' },
    screen:      { tagID: GETCOLOR.Screen,       type: 'ptr' },
    color:       { tagID: GETCOLOR.Color,        type: 'uint32' },
    red:         { tagID: GETCOLOR.Red,          type: 'uint32' },
    green:       { tagID: GETCOLOR.Green,        type: 'uint32' },
    blue:        { tagID: GETCOLOR.Blue,         type: 'uint32' },
    hue:         { tagID: GETCOLOR.Hue,          type: 'uint32' },
    saturation:  { tagID: GETCOLOR.Saturation,   type: 'uint32' },
    brightness:  { tagID: GETCOLOR.Brightness,   type: 'uint32' },
    rgb:         { tagID: GETCOLOR.RGB,          type: 'uint32' },
    hsb:         { tagID: GETCOLOR.HSB,          type: 'uint32' },
    colorWheel:  { tagID: GETCOLOR.ColorWheel,   type: 'bool' },
    rgbSliders:  { tagID: GETCOLOR.RGBSliders,   type: 'bool' },
    hsbSliders:  { tagID: GETCOLOR.HSBSliders,   type: 'bool' },
    switchMode:  { tagID: GETCOLOR.SwitchMode,   type: 'bool' },
    initial:     { tagID: GETCOLOR.Initial,      type: 'uint32' },
    showRGB:     { tagID: GETCOLOR.ShowRGB,      type: 'bool' },
    showHSB:     { tagID: GETCOLOR.ShowHSB,      type: 'bool' },
    smallTextAttr:{tagID: GETCOLOR.SmallTextAttr,type: 'ptr' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('COLOR_SELECTED', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/getcolor.gadget',
  wraps: 'ATTR_UPDATE',
});
