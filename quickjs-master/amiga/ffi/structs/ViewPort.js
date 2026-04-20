/* quickjs-master/amiga/ffi/structs/ViewPort.js
 *
 * struct ViewPort (graphics/view.h). One rectangular region in a
 * View that displays a BitMap with a ColorMap. Every Screen has a
 * ViewPort accessible via screen.viewPort (field +68 on Screen —
 * not yet exposed on the Screen wrapper; add if needed).
 *
 * Field offsets (2-byte alignment):
 *   +0   Next       (struct ViewPort *)
 *   +4   ColorMap   (struct ColorMap *)
 *   +8   DspIns     (struct CopList *)  — private
 *  +12   SprIns     (struct CopList *)  — private
 *  +16   ClrIns     (struct CopList *)  — private
 *  +20   UCopIns    (struct UCopList *)
 *  +24   DWidth     (WORD)
 *  +26   DHeight    (WORD)
 *  +28   DxOffset   (WORD)
 *  +30   DyOffset   (WORD)
 *  +32   Modes      (UWORD)
 *  +34   SpritePriorities (UBYTE)
 *  +35   ExtendedModes    (UBYTE)
 *  +36   RasInfo    (struct RasInfo *)
 *  total 40
 */

import { Struct } from './Struct.js';
import { ColorMap } from './ColorMap.js';

export class ViewPort extends Struct {
  /* Allocated as part of Screen or View; we wrap. */

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `ViewPort(ptr)
where:
  ptr - REQUIRED: existing ViewPort* pointer. You'll typically get
        this via screen.viewPort (once Screen exposes the field) or
        from graphics.library MakeVPort. No from-scratch allocation
        via this wrapper — the display list wiring is fragile.

Fields (getters):
  nextViewPort {number}       next ViewPort* in the view, +0
  colorMap     {ColorMap|null} ColorMap wrapper at +4
  dWidth       {number}       display width,  +24 (WORD)
  dHeight      {number}       display height, +26 (WORD)
  dxOffset     {number}       horizontal offset, +28
  dyOffset     {number}       vertical offset,   +30
  modes        {number}       UWORD mode flags, +32

Mutators for Modes live on SetChipRev/ModeNotAvailable etc.; prefer
graphics.library calls over raw writes.`;
  }

  /** @returns {number} */
  get nextViewPort() { return this.read32(0); }

  /** @returns {ColorMap|null} */
  get colorMap() {
    let p = this.read32(4);
    return p ? new ColorMap(p) : null;
  }

  /** @returns {number} */
  get dWidth()    { return this.read16(24); }

  /** @returns {number} */
  get dHeight()   { return this.read16(26); }

  /** @returns {number} */
  get dxOffset()  { return this.read16(28); }

  /** @returns {number} */
  get dyOffset()  { return this.read16(30); }

  /** @returns {number} UWORD mode flags (LORES/HIRES/HAM/DUALPF etc.) */
  get modes()     { return this.read16(32); }
}
