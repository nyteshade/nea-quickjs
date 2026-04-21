/* quickjs-master/amiga/ffi/boopsi/gadgets/Button.js
 *
 * button.gadget — Reaction's push/toggle button. Extends gadgetclass
 * (so it inherits GA_ID, GA_Text, GA_Disabled, etc.) and adds
 * BUTTON_* attributes for visual styling.
 *
 * BUTTON_Dummy = TAG_USER + 0x04000000 = 0x84000000 (distinct from
 * REACTION_Dummy because button.gadget predates the Reaction
 * consolidation).
 *
 * At module load time we register BUTTON_CLICK on EventKind — the
 * Window event pump decodes IDCMP_IDCMPUPDATE attribute-delta tag
 * lists and yields this kind when a button reports release.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal BUTTON_* tag IDs (gadgets/button.h) */
const BUTTON = Object.freeze({
  PushButton:   0x84000001,
  Glyph:        0x84000002,
  Array:        0x84000003,
  TextPen:      0x84000005,
  FillPen:      0x84000006,
  FillTextPen:  0x84000007,
  BgPen:        0x84000008,
  Current:      0x84000009,
  BevelStyle:   0x8400000D,
  Transparent:  0x8400000F,
  Justification:0x84000010,
  SoftStyle:    0x84000011,
});

/**
 * button.gadget — a Reaction push/toggle button.
 *
 * @extends GadgetBase
 */
export class Button extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/button.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,

    /* Most scripts use the inherited GA_Text ('text') + GA_ID ('id')
     * + GA_Selected ('selected'). Additions below. */
    pushButton:     { tagID: BUTTON.PushButton,   type: 'bool' },
    glyph:          { tagID: BUTTON.Glyph,        type: 'ptr'  },
    textPen:        { tagID: BUTTON.TextPen,      type: 'uint32' },
    fillPen:        { tagID: BUTTON.FillPen,      type: 'uint32' },
    fillTextPen:    { tagID: BUTTON.FillTextPen,  type: 'uint32' },
    bgPen:          { tagID: BUTTON.BgPen,        type: 'uint32' },
    current:        { tagID: BUTTON.Current,      type: 'bool' },
    bevelStyle:     { tagID: BUTTON.BevelStyle,   type: 'uint32' },
    transparent:    { tagID: BUTTON.Transparent,  type: 'bool' },
    justification:  { tagID: BUTTON.Justification,type: 'uint32' },
    softStyle:      { tagID: BUTTON.SoftStyle,    type: 'uint32' },
  };

  /**
   * Default relVerify=true so clicks actually produce events. The NDK
   * PushButton macro (reaction_macros.h:249) always sets
   * GA_RelVerify=TRUE; without it the button renders but is silent.
   *
   * @param {object} init
   */
  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

/* Register the button's event kind on the shared EventKind enum. The
 * Window event pump looks up this case when it sees IDCMP_IDCMPUPDATE
 * carrying a GA_ID whose owner is a Button. */
EventKind.define('BUTTON_CLICK', {
  idcmp: 0x40000000,  /* IDCMP_IDCMPUPDATE */
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'button.gadget',
  wraps: 'GADGET_UP',
});
