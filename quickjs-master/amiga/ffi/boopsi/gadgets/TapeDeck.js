/* quickjs-master/amiga/ffi/boopsi/gadgets/TapeDeck.js
 *
 * tapedeck.gadget — Reaction VCR-style transport button group
 * (rewind / play / forward / stop / pause / frame-step). Extends
 * gadgetclass.
 *
 * Tag values derived from NDK3.2R4 Include_H/gadgets/tapedeck.h
 * (audit 10.6.2026, T-reaction-audit-remaining-4):
 *   TDECK_Dummy = TAG_USER + 0x05000000 = 0x85000000
 *   TDECK_Mode/Paused/Tape = +1..+3, TDECK_Frames/CurrentFrame = +11/+12.
 * The previous table's Buttons(+4)/Disabled(+5)/Step(+6) tags do not
 * exist in the NDK header and were removed.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const TDECK = Object.freeze({
  /* check-constants: prefix TDECK_ header gadgets/tapedeck.h */
  Mode:         0x85000001,  /* TDECK_Dummy + 1  */
  Paused:       0x85000002,  /* TDECK_Dummy + 2  */
  Tape:         0x85000003,  /* TDECK_Dummy + 3  */
  Frames:       0x8500000B,  /* TDECK_Dummy + 11 */
  CurrentFrame: 0x8500000C,  /* TDECK_Dummy + 12 */
});

/**
 * TDECK_Mode values (NDK BUT_* constants from gadgets/tapedeck.h).
 *
 * @readonly
 * @enum {number}
 */
export const TapeDeckMode = Object.freeze({
  /* check-constants: prefix BUT_ header gadgets/tapedeck.h */
  REWIND:  0,  /* BUT_REWIND  */
  PLAY:    1,  /* BUT_PLAY    */
  FORWARD: 2,  /* BUT_FORWARD */
  STOP:    3,  /* BUT_STOP    */
  PAUSE:   4,  /* BUT_PAUSE   */
  BEGIN:   5,  /* BUT_BEGIN   */
  FRAME:   6,  /* BUT_FRAME   */
  END:     7,  /* BUT_END     */
});

/**
 * tapedeck.gadget — VCR/animation transport.
 *
 * @extends GadgetBase
 */
export class TapeDeck extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/tapedeck.gadget';

  /** @type {string} — no XXX_GetClass in this library; instantiate by name */
  static _publicClassID = 'tapedeck.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    /** Current transport mode — one of {@link TapeDeckMode}. */
    mode:         { tagID: TDECK.Mode,         type: 'uint32' },
    /** Pause toggle state. */
    paused:       { tagID: TDECK.Paused,       type: 'bool' },
    /** TRUE = tapedeck-style controls, FALSE = animation controls. */
    tape:         { tagID: TDECK.Tape,         type: 'bool' },
    /** Number of frames (animation controls only). */
    frames:       { tagID: TDECK.Frames,       type: 'int32' },
    /** Current frame (animation controls only). */
    currentFrame: { tagID: TDECK.CurrentFrame, type: 'int32' },
  };

  constructor(init) {
    /* A number is an existing object to wrap: nothing is created, and
     * the defaults below do not apply. */
    if (typeof init === 'number') { super(init); return; }

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
