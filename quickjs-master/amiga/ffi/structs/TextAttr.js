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

  /**
   * REPL help text — a human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `TextAttr(ptr?)
where:
  ptr? - optional existing struct TextAttr pointer to wrap (no
         allocation, no ownership). Omit to allocate a fresh 8-byte
         struct filled with zeroes (free() when done).

Fields (read-only getters):
  name   {string|null}  font name at +0 (STRPTR)
  ySize  {number}       font height, +4 (UWORD)
  style  {number}       TF_* bits, +6 (UBYTE)
  flags  {number}       FPF_* bits, +7 (UBYTE)

Typical use:
  screen.font.name, screen.font.ySize — live view of the screen's
  font TextAttr. Do NOT write to system-owned instances.`;
  }

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
