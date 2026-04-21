/* quickjs-master/amiga/ffi/boopsi/images/Label.js
 *
 * label.image — Reaction's text label. The simplest of the bunch:
 * inherits from imageclass, carries a text string and rendering
 * attributes.
 *
 * NDK header: images/label.h. LABEL_Dummy = REACTION_Dummy+0x6000.
 * Most commonly used: LABEL_Text, LABEL_Justification,
 * LABEL_Underscore (key-shortcut marker char).
 */

import { ImageBase, IMAGE_ATTRS } from '../ImageBase.js';

/** @internal LABEL_* tag IDs (images/label.h) */
const LABEL = Object.freeze({
  Text:           0x85006001,
  Image:          0x85006002,
  Mapping:        0x85006003,
  Justification:  0x85006004,
  Key:            0x85006005,
  Underscore:     0x85006006,
  DisposeImage:   0x85006007,
  SoftStyle:      0x85006008,
  VerticalSpacing:0x85006009,
});

/**
 * label.image — a renderable text label.
 *
 * @extends ImageBase
 */
export class Label extends ImageBase {
  /** @type {string} */
  static _classLibName = 'images/label.image';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...IMAGE_ATTRS,
    text:          { tagID: LABEL.Text,          type: 'string-owned' },
    justification: { tagID: LABEL.Justification, type: 'uint32' },
    underscore:    { tagID: LABEL.Underscore,    type: 'uint32' },
    softStyle:     { tagID: LABEL.SoftStyle,     type: 'uint32' },
    verticalSpacing: { tagID: LABEL.VerticalSpacing, type: 'int32' },
  };

  /** @returns {string|null} */
  get text()    { return this.get('text'); }
  set text(v)   { this.set({ text: v }); }
}

/**
 * LABEL_Justification values. LJ_LEFT = 0, LJ_CENTER = 1, LJ_RIGHT = 2.
 * Kept at module scope (not in ATTRS) since they're value constants,
 * not attrs.
 */
export const LabelJustify = Object.freeze({
  LEFT:   0,
  CENTER: 1,
  RIGHT:  2,
});
