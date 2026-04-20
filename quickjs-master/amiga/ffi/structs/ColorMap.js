/* quickjs-master/amiga/ffi/structs/ColorMap.js
 *
 * struct ColorMap (graphics/view.h). A ViewPort's color table —
 * access is by library call (GetRGB4/SetRGB4/LoadRGB4) rather than
 * raw offsets because the internal layout varies with RTG systems.
 *
 * This wrapper exposes only the handful of fields documented as
 * stable across AmigaOS 3.x:
 *   +0   Flags    (UBYTE)
 *   +1   Type     (UBYTE)
 *   +2   Count    (UWORD)
 *   +4   ColorTable (UWORD *)  — do not rely on this with RTG
 *   +8   (internal) cm_TransparencyPlane and friends
 */

import { Struct } from './Struct.js';

export class ColorMap extends Struct {
  /* Allocated by graphics.library GetColorMap / attached to ViewPort. */

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `ColorMap(ptr)
where:
  ptr - REQUIRED: existing ColorMap* pointer, normally read from a
        ViewPort via viewPort.colorMap (not yet wrapped) or returned
        by Graphics.GetColorMap. Lifecycle managed by graphics.library.

Fields (getters):
  flags   {number} UBYTE, +0
  type    {number} UBYTE, +1 (CMTYPE classic vs extended)
  count   {number} UWORD number of entries, +2

Prefer calling Graphics.GetRGB4(colorMap, i) for per-entry reads
rather than walking ColorTable directly; RTG systems use a deeper
internal representation.`;
  }

  /** @returns {number} UBYTE */
  get flags() { return this.read8(0); }

  /** @returns {number} UBYTE */
  get type()  { return this.read8(1); }

  /** @returns {number} UWORD */
  get count() { return this.read16(2); }
}
