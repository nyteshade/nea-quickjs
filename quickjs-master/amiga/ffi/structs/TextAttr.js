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
  /* check-structs: struct TextAttr */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * graphics/text.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    ta_Name:  0,
    ta_YSize: 4,
    ta_Style: 6,
    ta_Flags: 7,
  });

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

Fields:
  name     {string|null}  font name at +0, read as a string
  namePtr  {number}       the same field as a pointer; settable
  ySize    {number}       font height in pixels, +4; settable
  style    {number}       Graphics.consts.FSF_* bits, +6; settable
  flags    {number}       Graphics.consts.FPF_* bits, +7; settable

To describe a font of your own, allocate the name and point at it:
  let name = amiga.allocString('topaz.font');
  let attr = new TextAttr();
  attr.namePtr = name.ptr;      // the string must outlive the TextAttr
  attr.ySize   = 8;
  attr.style   = Graphics.consts.FS_NORMAL;
  ...
  attr.free(); name.free();

Typical use:
  screen.font.name, screen.font.ySize — live view of the screen's
  font TextAttr. Do NOT write to system-owned instances.`;
  }

  /** @returns {string|null} font name */
  get name() {
    let p = this.read32(TextAttr.OFFSET.ta_Name);

    return p ? globalThis.amiga.peekString(p, 64) : null;
  }

  /** @returns {number} the font name as a C string pointer (ta_Name) */
  get namePtr()  { return this.read32(TextAttr.OFFSET.ta_Name); }
  set namePtr(v) { this.write32(TextAttr.OFFSET.ta_Name, (v && v.ptr) || (v | 0)); }

  /** @returns {number} font height in pixels */
  get ySize()  { return this.read16(TextAttr.OFFSET.ta_YSize); }
  set ySize(v) { this.write16(TextAttr.OFFSET.ta_YSize, v | 0); }

  /** @returns {number} Graphics.consts.FS_NORMAL or FSF_* bits */
  get style()  { return this.read8(TextAttr.OFFSET.ta_Style); }
  set style(v) { this.write8(TextAttr.OFFSET.ta_Style, v | 0); }

  /** @returns {number} Graphics.consts.FPF_* bits */
  get flags()  { return this.read8(TextAttr.OFFSET.ta_Flags); }
  set flags(v) { this.write8(TextAttr.OFFSET.ta_Flags, v | 0); }
}
