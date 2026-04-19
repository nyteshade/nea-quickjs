/* quickjs-master/amiga/ffi/structs/TextAttr.js
 *
 * struct TextAttr (graphics/text.h):
 *   +0  ta_Name   (STRPTR, 4)
 *   +4  ta_YSize  (UWORD, 2)
 *   +6  ta_Style  (UBYTE, 1)
 *   +7  ta_Flags  (UBYTE, 1)
 *  total 8
 */

import { Struct } from './Struct.js';

export class TextAttr extends Struct {
  /** @type {number} */
  static SIZE = 8;

  /** @returns {string|null} font name */
  get name() {
    let p = this.read32(0);

    return p ? globalThis.amiga.peekString(p, 64) : null;
  }

  /** @returns {number} font height in points/pixels */
  get ySize() { return this.read16(4); }

  /** @returns {number} TF_NORMAL/TF_UNDERLINED/TF_BOLD/TF_ITALIC bitfield */
  get style() { return this.read8(6); }

  /** @returns {number} */
  get flags() { return this.read8(7); }
}
