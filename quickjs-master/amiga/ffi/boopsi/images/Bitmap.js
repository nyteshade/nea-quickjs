/* quickjs-master/amiga/ffi/boopsi/images/Bitmap.js
 *
 * bitmap.image — Reaction's general bitmap renderer. Can load from
 * a datatype-compatible file path (IFF ILBM most commonly) or wrap
 * an in-memory struct BitMap. Extends imageclass.
 *
 * BITMAP_Dummy = REACTION_Dummy + 0x19000 = 0x85019000.
 */

import { ImageBase, IMAGE_ATTRS } from '../ImageBase.js';

/** @internal BITMAP_* tag IDs (images/bitmap.h). */
const BITMAP = Object.freeze({
  SourceFile:       0x85019001,
  Screen:           0x85019002,
  Precision:        0x85019003,
  Masking:          0x85019004,
  BitMap:           0x85019005,
  Width:            0x85019006,
  Height:           0x85019007,
  MaskPlane:        0x85019008,
  SelectSourceFile: 0x85019009,
  SelectBitMap:     0x8501900A,
  SelectWidth:      0x8501900B,
  SelectHeight:     0x8501900C,
  SelectMaskPlane:  0x8501900D,
  OffsetX:          0x8501900E,
  OffsetY:          0x8501900F,
  SelectOffsetX:    0x85019010,
  SelectOffsetY:    0x85019011,
  Transparent:      0x85019012,
});

/**
 * bitmap.image — general bitmap renderer.
 *
 * @extends ImageBase
 */
export class Bitmap extends ImageBase {
  /** @type {string} */
  static _classLibName = 'images/bitmap.image';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...IMAGE_ATTRS,
    sourceFile:       { tagID: BITMAP.SourceFile,       type: 'string-owned' },
    screen:           { tagID: BITMAP.Screen,           type: 'ptr' },
    precision:        { tagID: BITMAP.Precision,        type: 'uint32' },
    masking:          { tagID: BITMAP.Masking,          type: 'bool' },
    bitMap:           { tagID: BITMAP.BitMap,           type: 'ptr' },
    width:            { tagID: BITMAP.Width,            type: 'int32' },
    height:           { tagID: BITMAP.Height,           type: 'int32' },
    maskPlane:        { tagID: BITMAP.MaskPlane,        type: 'ptr' },
    selectSourceFile: { tagID: BITMAP.SelectSourceFile, type: 'string-owned' },
    selectBitMap:     { tagID: BITMAP.SelectBitMap,     type: 'ptr' },
    selectWidth:      { tagID: BITMAP.SelectWidth,      type: 'int32' },
    selectHeight:     { tagID: BITMAP.SelectHeight,     type: 'int32' },
    offsetX:          { tagID: BITMAP.OffsetX,          type: 'int32' },
    offsetY:          { tagID: BITMAP.OffsetY,          type: 'int32' },
    transparent:      { tagID: BITMAP.Transparent,      type: 'bool' },
  };
}
