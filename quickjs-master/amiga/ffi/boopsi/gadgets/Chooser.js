/* quickjs-master/amiga/ffi/boopsi/gadgets/Chooser.js
 *
 * chooser.gadget — Reaction dropdown / popup selector. Extends
 * gadgetclass. Labels are supplied as a struct List of nodes; each
 * node's CNA_* attributes describe text/image/user-data.
 *
 * CHOOSER_Dummy = REACTION_Dummy + 0x1000 = 0x85001000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const CHOOSER = Object.freeze({
  PopUp:                      0x85001001,
  DropDown:                   0x85001002,
  Title:                      0x85001003,
  Labels:                     0x85001004,
  Active:                     0x85001005,  /* alias of CHOOSER_Selected */
  Width:                      0x85001006,
  AutoFit:                    0x85001007,
  MaxLabels:                  0x85001009,
  Offset:                     0x8500100A,
  Hidden:                     0x8500100B,
  LabelArray:                 0x8500100C,
  Justification:              0x8500100D,
  ImageJustification:         0x8500100E,  /* OS4ONLY */
  SelectedNode:               0x8500100F,  /* OS4ONLY */
  DeactivateOnMostRawKeys:    0x85001010,
});

/** CHOOSER_Justification (CHJ_*). */
export const ChooserJustify = Object.freeze({
  LEFT: 0, CENTER: 1, RIGHT: 2,
});

/** Node-attribute tags (CNA_Dummy = TAG_USER+0x5001500). */
export const CNA = Object.freeze({
  Text:     0x85001501,
  Image:    0x85001502,
  SelImage: 0x85001503,
  UserData: 0x85001504,
  Separator:0x85001505,
  Disabled: 0x85001506,
  BGPen:    0x85001507,
  FGPen:    0x85001508,
  ReadOnly: 0x85001509,
});

/**
 * chooser.gadget — dropdown / popup selector.
 *
 * @extends GadgetBase
 */
export class Chooser extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/chooser.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    popUp:          { tagID: CHOOSER.PopUp,         type: 'bool' },
    dropDown:       { tagID: CHOOSER.DropDown,      type: 'bool' },
    title:          { tagID: CHOOSER.Title,         type: 'string-owned' },
    labels:         { tagID: CHOOSER.Labels,        type: 'ptr' },  /* struct List* */
    active:         { tagID: CHOOSER.Active,        type: 'uint32' },
    autoFit:        { tagID: CHOOSER.AutoFit,       type: 'bool' },
    maxLabels:      { tagID: CHOOSER.MaxLabels,     type: 'int32' },
    justification:  { tagID: CHOOSER.Justification, type: 'uint32' },
    labelArray:     { tagID: CHOOSER.LabelArray,    type: 'ptr' },
    deactivateOnMostRawKeys: { tagID: CHOOSER.DeactivateOnMostRawKeys, type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('CHOOSER_SELECT', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/chooser.gadget',
  wraps: 'ATTR_UPDATE',
});
