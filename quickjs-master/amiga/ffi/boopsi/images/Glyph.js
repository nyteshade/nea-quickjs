/* quickjs-master/amiga/ffi/boopsi/images/Glyph.js
 *
 * glyph.image — standard Reaction glyph (arrows, checkmark, popup
 * and requester-button symbols). Extends imageclass. Often used as BUTTON_Glyph
 * for arrow-style controls, or embedded directly in windows.
 *
 * GLYPH_Dummy = REACTION_Dummy + 0x15000 = 0x85015000.
 */

import { ImageBase, IMAGE_ATTRS } from '../ImageBase.js';

/** @internal GLYPH_* tag IDs (images/glyph.h). */
const GLYPH = Object.freeze({
  /* check-constants: prefix GLYPH_ header images/glyph.h */
  Glyph:     0x85015001,  /* (UWORD) which glyph, see GlyphKind */
  DrawInfo:  0x85015002,  /* (struct DrawInfo*) for pen lookup */
});

/**
 * GLYPH_Glyph values, from NDK3.2R4 Include_H/images/glyph.h. (The
 * table here before 0.210 was hand-typed and did not match the header:
 * it had UPARROW as 1 and CHECKMARK as 5, and listed window-gadget
 * names such as CLOSE and DEPTH that glyph.image does not have.)
 *
 * @readonly
 * @enum {number}
 */
export const GlyphKind = Object.freeze({
  /* check-constants: prefix GLYPH_ header images/glyph.h */
  NONE:           0,
  DOWNARROW:      1,
  UPARROW:        2,
  LEFTARROW:      3,
  RIGHTARROW:     4,
  DROPDOWN:       5,
  POPUP:          6,
  CHECKMARK:      7,
  POPFONT:        8,
  POPFILE:        9,
  POPDRAWER:     10,
  POPSCREENMODE: 11,
  POPTIME:       12,
  RADIOBUTTON:   18,
  RETURNARROW:   20,
  BDOWNARROW:    21,
  BUPARROW:      22,
  BLEFTARROW:    23,
  BRIGHTARROW:   24,
  DROPDOWNMENU:  25,
  CYCLE:         26,
  POPDATE:       27,
  POPCOLOR:      28,
  SHIFTKEY:      32,
});

/**
 * glyph.image — OS3 system glyph.
 *
 * @extends ImageBase
 */
export class Glyph extends ImageBase {
  /** @type {string} */
  static _classLibName = 'images/glyph.image';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...IMAGE_ATTRS,
    glyph:    { tagID: GLYPH.Glyph,    type: 'uint32' },
    drawInfo: { tagID: GLYPH.DrawInfo, type: 'ptr' },
  };
}
