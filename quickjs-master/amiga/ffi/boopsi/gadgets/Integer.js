/* quickjs-master/amiga/ffi/boopsi/gadgets/Integer.js
 *
 * integer.gadget — numeric-only string gadget with optional spinner
 * arrows. Subclass of string.gadget. Extends gadgetclass.
 *
 * INTEGER_Dummy = REACTION_Dummy + 0x2000 = 0x85002000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const INTEGER = Object.freeze({
  Number:     0x85002001,  /* (LONG) current value */
  MaxChars:   0x85002002,
  Minimum:    0x85002003,
  Maximum:    0x85002004,
  Arrows:     0x85002005,
  MinVisible: 0x85002006,
  SkipVal:    0x85002007,
});

/**
 * integer.gadget — numeric text field.
 *
 * @extends GadgetBase
 */
export class Integer extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/integer.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    value:      { tagID: INTEGER.Number,     type: 'int32' },
    maxChars:   { tagID: INTEGER.MaxChars,   type: 'int32' },
    minimum:    { tagID: INTEGER.Minimum,    type: 'int32' },
    maximum:    { tagID: INTEGER.Maximum,    type: 'int32' },
    arrows:     { tagID: INTEGER.Arrows,     type: 'bool' },
    minVisible: { tagID: INTEGER.MinVisible, type: 'int32' },
    skipVal:    { tagID: INTEGER.SkipVal,    type: 'int32' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('INTEGER_CHANGED', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/integer.gadget',
  wraps: 'ATTR_UPDATE',
});
