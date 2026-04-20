/* quickjs-master/amiga/ffi/boopsi/ImageBase.js
 *
 * Base class for every BOOPSI object derived from imageclass. The
 * IA_* attribute set (intuition/imageclass.h, TAG_USER + 0x20000)
 * is shared across frameiclass, sysiclass, label.image, etc.
 *
 * Concrete image classes (Label, Bitmap, SysImage, FrameImage)
 * extend ImageBase and spread IMAGE_ATTRS into their own ATTRS.
 */

import { BOOPSIBase } from './BOOPSIBase.js';

/**
 * Tag IDs from intuition/imageclass.h. IA_Dummy = TAG_USER+0x20000.
 */
export const IA = Object.freeze({
  Left:         0x80020001,
  Top:          0x80020002,
  Width:        0x80020003,
  Height:       0x80020004,
  FGPen:        0x80020005,
  BGPen:        0x80020006,
  Data:         0x80020007,
  LineWidth:    0x80020008,
  Height2:      0x80020009,
  SupportID:    0x8002000A,
  Mode:         0x8002000B,
  Pens:         0x8002000E,
  Resolution:   0x8002000F,
  APattern:     0x80020010,
  APatSize:     0x80020011,
  Recessed:     0x80020015,
  DoubleEmboss: 0x80020016,
  EdgesOnly:    0x80020017,
  Label:        0x80020019,
  Scalable:     0x8002001A,
  FrameType:    0x8002001B,
  Translucent:  0x8002001C,
  InBorder:     0x8002001D,
});

/**
 * Attributes every imageclass subclass inherits.
 */
export const IMAGE_ATTRS = Object.freeze({
  left:    { tagID: IA.Left,   type: 'int32' },
  top:     { tagID: IA.Top,    type: 'int32' },
  width:   { tagID: IA.Width,  type: 'int32' },
  height:  { tagID: IA.Height, type: 'int32' },
  fgPen:   { tagID: IA.FGPen,  type: 'uint32' },
  bgPen:   { tagID: IA.BGPen,  type: 'uint32' },
});

/**
 * Base class for all BOOPSI images.
 *
 * @extends BOOPSIBase
 */
export class ImageBase extends BOOPSIBase {
  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = { ...IMAGE_ATTRS };

  get left()   { return this.get('left'); }
  set left(v)  { this.set({ left: v }); }

  get top()    { return this.get('top'); }
  set top(v)   { this.set({ top: v }); }

  get width()  { return this.get('width'); }
  set width(v) { this.set({ width: v }); }

  get height() { return this.get('height'); }
  set height(v){ this.set({ height: v }); }
}
