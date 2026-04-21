/* quickjs-master/amiga/ffi/boopsi/gadgets/CheckBox.js
 *
 * checkbox.gadget — Reaction toggle checkbox. Extends gadgetclass.
 * Use GA_Selected + on('CHECKBOX_TOGGLE') to observe state changes.
 *
 * CHECKBOX_Dummy = REACTION_Dummy + 0x11000 = 0x85011000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal CHECKBOX_* tag IDs (gadgets/checkbox.h). */
const CHECKBOX = Object.freeze({
  Invert:  0x85011006,   /* (BOOL) invert the displayed sense */
});

/**
 * checkbox.gadget — toggle box.
 *
 * @extends GadgetBase
 */
export class CheckBox extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/checkbox.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    invert: { tagID: CHECKBOX.Invert, type: 'bool' },
  };

  /**
   * Default relVerify=true so toggles fire events.
   *
   * @param {object} init
   */
  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }

  /** Current toggle state. */
  get checked()  { return this.get('selected'); }
  set checked(v) { this.set({ selected: !!v }); }
}

EventKind.define('CHECKBOX_TOGGLE', {
  idcmp: 0x00800000,   /* IDCMP_IDCMPUPDATE */
  rich:  { hasId: true, hasSource: true, hasPressed: true,
           hasCode: false, hasCoords: false },
  from:  'gadgets/checkbox.gadget',
  wraps: 'ATTR_UPDATE',
});
