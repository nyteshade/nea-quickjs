/* quickjs-master/amiga/ffi/structs/MenuItem.js
 *
 * struct MenuItem (intuition/intuition.h). Single entry in a Menu
 * (or a submenu chain).
 *
 * Field offsets (2-byte alignment):
 *   +0   NextItem    (struct MenuItem *)
 *   +4   LeftEdge    (WORD)
 *   +6   TopEdge     (WORD)
 *   +8   Width       (WORD)
 *  +10   Height      (WORD)
 *  +12   Flags       (UWORD)  — ITEMENABLED, HIGHCOMP, CHECKED etc.
 *  +14   MutualExclude (LONG)
 *  +18   ItemFill    (APTR)   — Image* or IntuiText*
 *  +22   SelectFill  (APTR)   — highlight rendering
 *  +26   Command     (BYTE)   — Amiga-key shortcut
 *  +27   pad         (BYTE)
 *  +28   SubItem     (struct MenuItem *)
 *  +32   NextSelect  (UWORD)
 *  total 34
 */

import { Struct } from './Struct.js';

export class MenuItem extends Struct {
  /** @type {number} */
  static SIZE = 34;

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `MenuItem(ptr?)
where:
  ptr? - optional existing struct MenuItem pointer. Omit to allocate
         a fresh 34-byte struct.

Fields (getter+setter on each):
  nextItem      {number} ptr to next item, +0
  leftEdge      {number}
  topEdge       {number}
  width         {number}
  height        {number}
  flags         {number}   ITEMENABLED=1, HIGHCOMP=0x40, CHECKED=0x100,
                           CHECKIT=0x01, COMMSEQ=0x04, ITEMTEXT=0x02 ...
  mutualExclude {number}   LONG exclusion bitmask
  itemFill      {number}   APTR to Image* or IntuiText*
  selectFill    {number}   APTR for highlight
  command       {number}   BYTE — single-char Amiga-key shortcut
  subItem       {MenuItem|null} submenu ptr, or null
  nextSelect    {number}   UWORD

Flags conveniences: COMMSEQ | ITEMTEXT | ITEMENABLED is the typical
"enabled text item with a right-Amiga shortcut" combination.`;
  }

  /** @returns {number} */
  get nextItem()      { return this.read32(0); }
  set nextItem(v)     { this.write32(0, v | 0); }

  /** @returns {number} */
  get leftEdge()      { return this.read16(4); }
  set leftEdge(v)     { this.write16(4, v | 0); }

  /** @returns {number} */
  get topEdge()       { return this.read16(6); }
  set topEdge(v)      { this.write16(6, v | 0); }

  /** @returns {number} */
  get width()         { return this.read16(8); }
  set width(v)        { this.write16(8, v | 0); }

  /** @returns {number} */
  get height()        { return this.read16(10); }
  set height(v)       { this.write16(10, v | 0); }

  /** @returns {number} */
  get flags()         { return this.read16(12); }
  set flags(v)        { this.write16(12, v | 0); }

  /** @returns {number} */
  get mutualExclude() { return this.read32(14); }
  set mutualExclude(v){ this.write32(14, v | 0); }

  /** @returns {number} APTR (Image* or IntuiText*) */
  get itemFill()      { return this.read32(18); }
  set itemFill(v)     { this.write32(18, (v && v.ptr) || (v | 0)); }

  /** @returns {number} APTR */
  get selectFill()    { return this.read32(22); }
  set selectFill(v)   { this.write32(22, (v && v.ptr) || (v | 0)); }

  /** @returns {number} BYTE — Amiga-key shortcut (ASCII) */
  get command()       { return this.read8(26); }
  set command(v)      { this.write8(26, v | 0); }

  /** @returns {MenuItem|null} */
  get subItem() {
    let p = this.read32(28);
    if (!p) return null;

    return new MenuItem(p);
  }

  set subItem(v) { this.write32(28, (v && v.ptr) || (v | 0)); }

  /** @returns {number} */
  get nextSelect()    { return this.read16(32); }
  set nextSelect(v)   { this.write16(32, v | 0); }
}
