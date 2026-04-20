/* quickjs-master/amiga/ffi/structs/Menu.js
 *
 * struct Menu (intuition/intuition.h). One entry in a window's menu
 * bar; holds a chain of MenuItem via FirstItem.
 *
 * Field offsets (2-byte alignment):
 *   +0   NextMenu   (struct Menu *)
 *   +4   LeftEdge   (WORD)
 *   +6   TopEdge    (WORD)
 *   +8   Width      (WORD)
 *  +10   Height     (WORD)
 *  +12   Flags      (UWORD)
 *  +14   MenuName   (STRPTR)
 *  +18   FirstItem  (struct MenuItem *)
 *  +22   JazzX, JazzY, BeatX, BeatY (UWORD × 4) — runtime layout cache
 *  total 30
 */

import { Struct } from './Struct.js';

export class Menu extends Struct {
  /** @type {number} */
  static SIZE = 30;

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `Menu(ptr?)
where:
  ptr? - optional existing struct Menu pointer. Omit to allocate a
         fresh 30-byte struct. Menus are typically built statically
         in C; from JS, use GadTools.CreateMenusA / LayoutMenus via
         the raw-FFI escape hatch until a wrapper lands.

Fields (getters):
  nextMenu   {number} ptr to next Menu in bar, +0
  leftEdge   {number} WORD, +4
  topEdge    {number} WORD, +6
  width      {number} WORD, +8
  height     {number} WORD, +10
  flags      {number} MENUENABLED etc., +12
  menuName   {string|null} menu label, +14 (STRPTR)
  firstItem  {MenuItem|null} first MenuItem in this menu, +18

Setters:
  nextMenu, firstItem, menuName, flags, leftEdge, topEdge,
  width, height (raw numbers/ptrs only).`;
  }

  /** @returns {number} */
  get nextMenu()   { return this.read32(0); }
  set nextMenu(v)  { this.write32(0, v | 0); }

  /** @returns {number} */
  get leftEdge()   { return this.read16(4); }
  set leftEdge(v)  { this.write16(4, v | 0); }

  /** @returns {number} */
  get topEdge()    { return this.read16(6); }
  set topEdge(v)   { this.write16(6, v | 0); }

  /** @returns {number} */
  get width()      { return this.read16(8); }
  set width(v)     { this.write16(8, v | 0); }

  /** @returns {number} */
  get height()     { return this.read16(10); }
  set height(v)    { this.write16(10, v | 0); }

  /** @returns {number} MENUENABLED = 0x0001 etc. */
  get flags()      { return this.read16(12); }
  set flags(v)     { this.write16(12, v | 0); }

  /** @returns {string|null} */
  get menuName() {
    let p = this.read32(14);
    return p ? globalThis.amiga.peekString(p, 128) : null;
  }

  /** @param {number} ptr — STRPTR (caller-managed) */
  set menuName(ptr) { this.write32(14, ptr | 0); }

  /** @returns {MenuItem|null} */
  get firstItem() {
    let p = this.read32(18);
    if (!p) return null;

    /* Circular-import-safe lookup through the global namespace. */
    let MI = globalThis.amiga && globalThis.amiga.intuition
          && globalThis.amiga.intuition.MenuItem;

    return MI ? new MI(p) : null;
  }

  set firstItem(v) { this.write32(18, (v && v.ptr) || (v | 0)); }
}
