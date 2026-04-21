/* quickjs-master/amiga/ffi/boopsi/gadgets/RadioButton.js
 *
 * radiobutton.gadget — Reaction exclusive-group selector. Extends
 * gadgetclass. Label list is supplied via RADIOBUTTON_Labels (an
 * array of strings) or for OS4+ RADIOBUTTON_LabelArray. Current
 * selection is RADIOBUTTON_Selected (ULONG index).
 *
 * RADIOBUTTON_Dummy = REACTION_Dummy + 0x14000 = 0x85014000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal RADIOBUTTON_* tag IDs (gadgets/radiobutton.h). */
const RADIOBUTTON = Object.freeze({
  Labels:     0x85014001,  /* (struct List*) List of label Nodes */
  Strings:    0x85014002,  /* (STRPTR*) array of C strings, NULL-terminated */
  Spacing:    0x85014003,  /* (ULONG) between buttons */
  Selected:   0x85014004,  /* (ULONG) current index */
  LabelPlace: 0x85014005,  /* (ULONG) left/right of dot */
  LabelArray: 0x85014006,  /* OS4ONLY — nested array of labels */
});

/**
 * radiobutton.gadget — exclusive-select group.
 *
 * @extends GadgetBase
 */
export class RadioButton extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/radiobutton.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    labels:     { tagID: RADIOBUTTON.Labels,     type: 'ptr' },
    strings:    { tagID: RADIOBUTTON.Strings,    type: 'ptr' },
    spacing:    { tagID: RADIOBUTTON.Spacing,    type: 'int32' },
    selectedIx: { tagID: RADIOBUTTON.Selected,   type: 'uint32' },
    labelPlace: { tagID: RADIOBUTTON.LabelPlace, type: 'uint32' },
    labelArray: { tagID: RADIOBUTTON.LabelArray, type: 'ptr' },
  };

  /**
   * Default relVerify=true so selection changes fire events.
   *
   * @param {object} init
   */
  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('RADIO_SELECT', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/radiobutton.gadget',
  wraps: 'ATTR_UPDATE',
});
