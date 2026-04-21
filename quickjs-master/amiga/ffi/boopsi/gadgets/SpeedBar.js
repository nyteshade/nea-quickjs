/* quickjs-master/amiga/ffi/boopsi/gadgets/SpeedBar.js
 *
 * speedbar.gadget — Reaction toolbar strip. Extends gadgetclass.
 * Buttons are supplied as a struct List of nodes with SBNA_* attrs.
 *
 * SPEEDBAR_Dummy = REACTION_Dummy + 0x13000 = 0x85013000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const SPEEDBAR = Object.freeze({
  Buttons:         0x85013001,
  Selected:        0x85013002,
  SmallButtons:    0x85013003,
  Orientation:     0x85013004,
  Spacing:         0x85013005,
  Justification:   0x85013006,
  RenderHook:      0x85013007,
  Multiple:        0x85013008,
  HintInfo:        0x85013009,
  EvenSize:        0x8501300A,
  Labels:          0x8501300B,
  StripUp:         0x8501300C,
  StripDown:       0x8501300D,
  EraseBackground: 0x8501300E,
});

/** SpeedBar button-node attributes (SBNA_Dummy = TAG_USER+0x010000). */
export const SBNA = Object.freeze({
  Ordinal:   0x80010001,
  Image:     0x80010002,
  SelImage:  0x80010003,
  DisImage:  0x80010004,
  Label:     0x80010005,
  HintInfo:  0x80010006,
  UserData:  0x80010007,
  Flags:     0x80010008,
});

/**
 * speedbar.gadget — toolbar.
 *
 * @extends GadgetBase
 */
export class SpeedBar extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/speedbar.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    buttons:         { tagID: SPEEDBAR.Buttons,        type: 'ptr' },
    selected:        { tagID: SPEEDBAR.Selected,       type: 'int32' },
    smallButtons:    { tagID: SPEEDBAR.SmallButtons,   type: 'bool' },
    orientation:     { tagID: SPEEDBAR.Orientation,    type: 'uint32' },
    spacing:         { tagID: SPEEDBAR.Spacing,        type: 'int32' },
    justification:   { tagID: SPEEDBAR.Justification,  type: 'uint32' },
    multiple:        { tagID: SPEEDBAR.Multiple,       type: 'bool' },
    evenSize:        { tagID: SPEEDBAR.EvenSize,       type: 'bool' },
    labels:          { tagID: SPEEDBAR.Labels,         type: 'bool' },
    eraseBackground: { tagID: SPEEDBAR.EraseBackground,type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('SPEEDBAR_CLICK', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/speedbar.gadget',
  wraps: 'ATTR_UPDATE',
});
