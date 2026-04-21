/* quickjs-master/amiga/ffi/boopsi/images/Glyph.js
 *
 * glyph.image — standard OS3 system glyph (up-arrow, close-gadget,
 * drag-bar hatch, etc). Extends imageclass. Often used as BUTTON_Glyph
 * for arrow-style controls, or embedded directly in windows.
 *
 * GLYPH_Dummy = REACTION_Dummy + 0x15000 = 0x85015000.
 */

import { ImageBase, IMAGE_ATTRS } from '../ImageBase.js';

/** @internal GLYPH_* tag IDs (images/glyph.h). */
const GLYPH = Object.freeze({
  Glyph:     0x85015001,  /* (UWORD) which glyph, see GlyphKind */
  DrawInfo:  0x85015002,  /* (struct DrawInfo*) for pen lookup */
});

/**
 * GLYPH_Glyph values. Subset from images/glyph.h GLYPH_* enum.
 */
export const GlyphKind = Object.freeze({
  UPARROW:       1,
  DOWNARROW:     2,
  LEFTARROW:     3,
  RIGHTARROW:    4,
  CHECKMARK:     5,
  RADIOBUTTON:   6,
  POPUP:         7,
  MX:            8,
  HATCHFILL:     9,
  SIZE:         10,
  CLOSE:        11,
  DEPTH:        12,
  ZOOM:         13,
  ICONIFY:      14,
  DROPBOX:      15,
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
