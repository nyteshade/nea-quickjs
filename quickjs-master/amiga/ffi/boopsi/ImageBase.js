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
  /* check-constants: prefix IA_ header intuition/imageclass.h
   * Until 0.219 four names here did not exist in the header (Height2,
   * SupportID, Translucent, InBorder) and three values were wrong. */
  Left:            0x80020001,
  Top:             0x80020002,
  Width:           0x80020003,
  Height:          0x80020004,
  FGPen:           0x80020005,
  BGPen:           0x80020006,
  Data:            0x80020007,
  LineWidth:       0x80020008,
  ShadowPen:       0x80020009,
  HighlightPen:    0x8002000A,
  Pens:            0x8002000E,
  Resolution:      0x8002000F,
  APattern:        0x80020010,
  APatSize:        0x80020011,
  Mode:            0x80020012,
  Font:            0x80020013,
  Outline:         0x80020014,
  Recessed:        0x80020015,
  DoubleEmboss:    0x80020016,
  EdgesOnly:       0x80020017,
  SupportsDisable: 0x8002001A,
  FrameType:       0x8002001B,
  Underscore:      0x8002001C,
  Scalable:        0x8002001D,
  ActivateKey:     0x8002001E,
  Screen:          0x8002001F,
  Precision:       0x80020020,
  Orientation:     0x80020023,
  Label:           0x80020028,
  EraseBackground: 0x8002002D,
  LabelPen:        0x80020038,
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
  /** @type {'image'} — BOOPSIBase.set() inspects this to decide
   *  whether to route the OM_SET through the parent layout via
   *  LAYOUT_ModifyChild so the image actually redraws. */
  static _boopsiKind = 'image';

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

  /**
   * Draw the image again where it already is, in the open window it
   * belongs to. Changing an image's attributes does not repaint it;
   * the NDK's Examples/LED.c shows the way to do that, and this is
   * it:
   *
   *     SetAttrs(image, ...);
   *     DrawImageState(window->RPort, image, 0, 0, IDS_NORMAL, drawInfo);
   *
   * The offsets are 0 because the layout has already put the image's
   * position in the window into the image itself.
   *
   * Only right for an image that paints its whole box, as led.image
   * does; one that draws just its text (label.image) would leave the
   * old text showing through.
   *
   * @returns {boolean} false if the image is not in an open window,
   *   in which case nothing was drawn (it is drawn when the window
   *   opens)
   */
  redraw() {
    let windowPointer = this.ptr ? this._findWindowPtr() : 0;

    if (!windowPointer) return false;

    const Intuition = globalThis.amiga.Intuition;
    let window   = new globalThis.amiga.intuition.Window(windowPointer);
    let screen   = window.screen;
    let drawInfo = Intuition.GetScreenDrawInfo(screen);

    if (!drawInfo) return false;

    try {
      Intuition.DrawImageState(window.rastPort, this.ptr, 0, 0,
                               Intuition.consts.IDS_NORMAL, drawInfo);
    }
    finally {
      Intuition.FreeScreenDrawInfo(screen, drawInfo);
    }

    return true;
  }
}
