/* quickjs-master/amiga/ffi/boopsi/gadgets/TapeDeck.js
 *
 * tapedeck.gadget — Reaction VCR-style transport button group
 * (play / stop / rew / fwd / record / etc). Extends gadgetclass.
 *
 * TDECK_Dummy = TAG_USER + 0x05000000 = 0x85000000 (shares the
 * Reaction base range).
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const TDECK = Object.freeze({
  Mode:     0x85000001,
  Paused:   0x85000002,
  Tape:     0x85000003,
  Buttons:  0x85000004,
  Disabled: 0x85000005,
  Step:     0x85000006,
});

/** TDECK_Mode values. */
export const TapeDeckMode = Object.freeze({
  STOP:    0,
  PLAY:    1,
  FFWD:    2,
  REW:     3,
  RECORD:  4,
  EJECT:   5,
  PAUSE:   6,
  STEP_FWD:7,
  STEP_REW:8,
});

/**
 * tapedeck.gadget — VCR transport.
 *
 * @extends GadgetBase
 */
export class TapeDeck extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/tapedeck.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    mode:     { tagID: TDECK.Mode,     type: 'uint32' },
    paused:   { tagID: TDECK.Paused,   type: 'bool' },
    tape:     { tagID: TDECK.Tape,     type: 'bool' },
    buttons:  { tagID: TDECK.Buttons,  type: 'uint32' },
    step:     { tagID: TDECK.Step,     type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('TAPEDECK_CLICK', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/tapedeck.gadget',
  wraps: 'ATTR_UPDATE',
});
