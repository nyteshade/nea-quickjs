/* quickjs-master/amiga/ffi/boopsi/images/Bevel.js
 *
 * bevel.image — Reaction's bevel/frame decorator. Used by LayoutObject
 * to draw bevels around groups, and usable standalone. Extends
 * imageclass.
 *
 * BEVEL_Dummy = REACTION_Dummy + 0x16000 = 0x85016000.
 */

import { ImageBase, IMAGE_ATTRS } from '../ImageBase.js';

/** @internal BEVEL_* tag IDs (images/bevel.h). */
const BEVEL = Object.freeze({
  Style:       0x85016001,
  Label:       0x85016003,  /* (STRPTR) label text */
  LabelImage:  0x85016004,  /* (Object*) label.image child */
  LabelPlace:  0x85016005,  /* (UWORD) placement constant */
  InnerTop:    0x85016006,
  InnerLeft:   0x85016007,
  InnerWidth:  0x85016008,
  InnerHeight: 0x85016009,
  HorizSize:   0x8501600A,
  VertSize:    0x8501600B,
  FillPen:     0x8501600C,
  FillPattern: 0x8501600D,
  TextPen:     0x8501600E,
  Transparent: 0x8501600F,
  SoftStyle:   0x85016010,
  ColorMap:    0x85016011,
  Flags:       0x85016012,
});

/**
 * BEVEL_Style values.
 */
export const BevelStyle = Object.freeze({
  NONE:      0,
  XEN:       1,   /* XEN-style embossed frame */
  RIDGE:     2,
  GROOVE:    3,
  BUTTON:    4,
  DROPBOX:   5,
  FIELD:     6,
  TAB:       7,
  ICON:      8,
});

/**
 * bevel.image — frame/bevel decorator.
 *
 * @extends ImageBase
 */
export class Bevel extends ImageBase {
  /** @type {string} */
  static _classLibName = 'images/bevel.image';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...IMAGE_ATTRS,
    style:        { tagID: BEVEL.Style,       type: 'uint32' },
    label:        { tagID: BEVEL.Label,       type: 'string-owned' },
    labelImage:   { tagID: BEVEL.LabelImage,  type: 'ptr' },
    labelPlace:   { tagID: BEVEL.LabelPlace,  type: 'uint32' },
    innerTop:     { tagID: BEVEL.InnerTop,    type: 'int32' },
    innerLeft:    { tagID: BEVEL.InnerLeft,   type: 'int32' },
    innerWidth:   { tagID: BEVEL.InnerWidth,  type: 'int32' },
    innerHeight:  { tagID: BEVEL.InnerHeight, type: 'int32' },
    horizSize:    { tagID: BEVEL.HorizSize,   type: 'int32' },
    vertSize:     { tagID: BEVEL.VertSize,    type: 'int32' },
    fillPen:      { tagID: BEVEL.FillPen,     type: 'uint32' },
    fillPattern:  { tagID: BEVEL.FillPattern, type: 'uint32' },
    textPen:      { tagID: BEVEL.TextPen,     type: 'uint32' },
    transparent:  { tagID: BEVEL.Transparent, type: 'bool' },
    softStyle:    { tagID: BEVEL.SoftStyle,   type: 'uint32' },
    colorMap:     { tagID: BEVEL.ColorMap,    type: 'ptr' },
    flags:        { tagID: BEVEL.Flags,       type: 'uint32' },
  };
}
