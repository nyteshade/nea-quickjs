/* quickjs-master/amiga/ffi/structs/Screen.js
 *
 * Field offsets per intuition/screens.h (2-byte alignment):
 *   +0   NextScreen (4)
 *   +4   FirstWindow (4)
 *   +8   LeftEdge, +10 TopEdge, +12 Width, +14 Height (WORD each)
 *  +16   MouseY (2), +18 MouseX (2)
 *  +20   Flags (UWORD, 2)
 *  +22   Title (STRPTR, 4)
 *  +26   DefaultTitle (STRPTR, 4)
 *  +30   BarHeight, BarVBorder, ..., WBorBottom (9 × BYTE)
 *  +40   Font (struct TextAttr *, 4 — 1 byte pad at +39)
 */

import { Struct } from './Struct.js';
import { TextAttr } from './TextAttr.js';

export class Screen extends Struct {
  /* SIZE not exposed — Screen is allocated by Intuition. */

  /** @returns {number} */
  get leftEdge() { return this.read16( 8); }

  /** @returns {number} */
  get topEdge()  { return this.read16(10); }

  /** @returns {number} */
  get width()    { return this.read16(12); }

  /** @returns {number} */
  get height()   { return this.read16(14); }

  /** @returns {number} */
  get flags()    { return this.read16(20); }

  /** @returns {string|null} */
  get title() {
    let p = this.read32(22);

    return p ? globalThis.amiga.peekString(p, 64) : null;
  }

  /** @returns {number} */
  get barHeight() { return this.read8(30); }

  /** @returns {TextAttr|null} */
  get font() {
    let p = this.read32(40);

    return p ? new TextAttr(p) : null;
  }
}
