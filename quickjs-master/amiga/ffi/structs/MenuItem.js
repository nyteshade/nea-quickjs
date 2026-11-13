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
  /* check-structs: struct MenuItem */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * intuition/intuition.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    NextItem:      0,
    LeftEdge:      4,
    TopEdge:       6,
    Width:         8,
    Height:        10,
    Flags:         12,
    MutualExclude: 14,
    ItemFill:      18,
    SelectFill:    22,
    Command:       26,
    SubItem:       28,
    NextSelect:    32,
  });

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
  command       {number}   BYTE - single-char Amiga-key shortcut
  subItem       {MenuItem|null} submenu ptr, or null
  nextSelect    {number}   UWORD

Flags conveniences: COMMSEQ | ITEMTEXT | ITEMENABLED is the typical
"enabled text item with a right-Amiga shortcut" combination.`;
  }

  /** @returns {number} */
  get nextItem()      { return this.read32(MenuItem.OFFSET.NextItem); }
  set nextItem(v)     { this.write32(MenuItem.OFFSET.NextItem, v | 0); }

  /** @returns {number} */
  get leftEdge()      { return this.read16(MenuItem.OFFSET.LeftEdge); }
  set leftEdge(v)     { this.write16(MenuItem.OFFSET.LeftEdge, v | 0); }

  /** @returns {number} */
  get topEdge()       { return this.read16(MenuItem.OFFSET.TopEdge); }
  set topEdge(v)      { this.write16(MenuItem.OFFSET.TopEdge, v | 0); }

  /** @returns {number} */
  get width()         { return this.read16(MenuItem.OFFSET.Width); }
  set width(v)        { this.write16(MenuItem.OFFSET.Width, v | 0); }

  /** @returns {number} */
  get height()        { return this.read16(MenuItem.OFFSET.Height); }
  set height(v)       { this.write16(MenuItem.OFFSET.Height, v | 0); }

  /** @returns {number} */
  get flags()         { return this.read16(MenuItem.OFFSET.Flags); }
  set flags(v)        { this.write16(MenuItem.OFFSET.Flags, v | 0); }

  /** @returns {number} */
  get mutualExclude() { return this.read32(MenuItem.OFFSET.MutualExclude); }
  set mutualExclude(v){ this.write32(MenuItem.OFFSET.MutualExclude, v | 0); }

  /** @returns {number} APTR (Image* or IntuiText*) */
  get itemFill()      { return this.read32(MenuItem.OFFSET.ItemFill); }
  set itemFill(v)     { this.write32(MenuItem.OFFSET.ItemFill, (v && v.ptr) || (v | 0)); }

  /** @returns {number} APTR */
  get selectFill()    { return this.read32(MenuItem.OFFSET.SelectFill); }
  set selectFill(v)   { this.write32(MenuItem.OFFSET.SelectFill, (v && v.ptr) || (v | 0)); }

  /** @returns {number} BYTE — Amiga-key shortcut (ASCII) */
  get command()       { return this.read8(MenuItem.OFFSET.Command); }
  set command(v)      { this.write8(MenuItem.OFFSET.Command, v | 0); }

  /** @returns {MenuItem|null} */
  get subItem() {
    let p = this.read32(MenuItem.OFFSET.SubItem);
    if (!p) return null;

    return new MenuItem(p);
  }

  set subItem(v) { this.write32(MenuItem.OFFSET.SubItem, (v && v.ptr) || (v | 0)); }

  /** @returns {number} */
  get nextSelect()    { return this.read16(MenuItem.OFFSET.NextSelect); }
  set nextSelect(v)   { this.write16(MenuItem.OFFSET.NextSelect, v | 0); }
}
