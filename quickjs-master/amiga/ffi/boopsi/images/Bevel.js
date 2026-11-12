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
 * BEVEL_Style values (BVS_*), from NDK3.2R4 Include_H/images/bevel.h.
 * Also used for LAYOUT_BevelStyle and BUTTON_BevelStyle.
 *
 * The table here before 0.212 was hand-typed and did not match the
 * header: it had no GROUP at all (so `BevelStyle.GROUP`, used by most
 * of the demos, was undefined and drew as THIN), and its FIELD was 6,
 * which is the header's vertical separator bar.
 *
 * @readonly
 * @enum {number}
 */
export const BevelStyle = Object.freeze({
  THIN:        0,  /* BVS_THIN       thin, usually 1 pixel             */
  BUTTON:      1,  /* BVS_BUTTON     standard button bevel             */
  GROUP:       2,  /* BVS_GROUP      group box                         */
  FIELD:       3,  /* BVS_FIELD      string / integer / text field     */
  NONE:        4,  /* BVS_NONE       no bevel                          */
  DROPBOX:     5,  /* BVS_DROPBOX    drop box area                     */
  /* The header's names for the two separators are the wrong way
   * round and it says so; these are named for what they draw. */
  VERTICAL_BAR:   6,   /* check-constants: is BVS_SBAR_HORIZ */  /* BVS_SBAR_HORIZ  separator in a horizontal group */
  HORIZONTAL_BAR: 7,   /* check-constants: is BVS_SBAR_VERT */  /* BVS_SBAR_VERT   separator in a vertical group   */
  BOX:         8,  /* BVS_BOX        thin black border                 */
  STANDARD:   11,  /* BVS_STANDARD   as BUTTON, never XEN              */
  CONTAINER:  12,  /* BVS_CONTAINER  scroller container (V47)          */
  KNOB:       13,  /* BVS_KNOB       scroller knob (V47)               */
  DISPLAY:    14,  /* BVS_DISPLAY    read-only area (V47)              */
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
