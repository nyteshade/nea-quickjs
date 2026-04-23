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
 * label.image — a renderable text label for STATIC content.
 *
 * **Use Label for static text only.** label.image's attributes
 * (LABEL_Text, LABEL_Justification, LABEL_SoftStyle, …) are all
 * OM_NEW-applicable only per label_ic.doc. Assigning `lbl.text = '...'`
 * on an already-open window updates the internal attribute via OM_SET
 * but does NOT repaint — label.image is an image class, it has no
 * GM_RENDER, and OS3.2's layout.gadget does not re-invoke IM_DRAW for
 * attribute changes on existing image children. You get the old
 * pixels plus the new text stored internally but invisible.
 *
 * **For dynamic / runtime-mutable text, use a read-only StringGadget.**
 *
 *     let display = new StringGadget({
 *         text: 'initial',
 *         readOnly: true,
 *         maxChars: 80,
 *     });
 *     // later:
 *     display.text = 'new value';   // cleanly refreshes in place
 *
 * StringGadget is the canonical OS3.2 Reaction widget for mutable
 * text: it's a gadget (so SetGadgetAttrs handles OM_SET + refresh),
 * it supports STRINGA_TextVal at OM_SET, and it has no allocation
 * overhead per update. The calculator and quiz demos both use this
 * pattern.
 *
 * This wrapper does not attempt to patch runtime Label updates
 * underneath — a prototype dispose-and-replace path (fresh NewObject
 * spliced in via LAYOUT_ModifyChild + CHILD_ReplaceImage) was
 * attempted and destabilises the layout on real OS3.2 hardware
 * (unbounded growth → OS hang). Static use of Label is stable and
 * correct; reach for StringGadget the moment the text needs to
 * change.
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
