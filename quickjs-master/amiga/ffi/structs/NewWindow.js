/* quickjs-master/amiga/ffi/structs/NewWindow.js
 *
 * Constructable wrapper around the legacy 48-byte struct NewWindow.
 * Used by Intuition.OpenWindow (the pre-tag-list API).
 *
 * Field offsets (intuition/intuition.h, 2-byte alignment):
 *   +0   LeftEdge (WORD)
 *   +2   TopEdge (WORD)
 *   +4   Width (WORD)
 *   +6   Height (WORD)
 *   +8   DetailPen (UBYTE)
 *   +9   BlockPen (UBYTE)
 *  +10   IDCMPFlags (ULONG)
 *  +14   Flags (ULONG)
 *  +18   FirstGadget (Gadget*)
 *  +22   CheckMark (Image*)
 *  +26   Title (STRPTR)
 *  +30   Screen (Screen*)
 *  +34   BitMap (BitMap*)
 *  +38   MinWidth (WORD)
 *  +40   MinHeight (WORD)
 *  +42   MaxWidth (UWORD)
 *  +44   MaxHeight (UWORD)
 *  +46   Type (UWORD)
 *
 * The constructor accepts an init object with camelCase field names.
 * If `title` is a string, the wrapper allocates the C string, pokes
 * the pointer at +26, and frees it on .free().
 */

import { Struct } from './Struct.js';
import { ptrOf } from '../ptrOf.js';

export class NewWindow extends Struct {
  /** @type {number} */
  static SIZE = 48;

  /**
   * REPL help text — a human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `NewWindow(initOrPtr?)
where:
  initOrPtr? - one of:
    - number: wrap an existing NewWindow* pointer (no allocation).
    - object: allocate a fresh 48-byte struct and populate fields.
    - omitted: allocate a zeroed 48-byte struct with sensible
               defaults (detailPen=0xFF, blockPen=0xFF, type=1).

Init-object fields (all optional, camelCase):
  left, top             {number} placement on screen
  width, height         {number}
  detailPen, blockPen   {number} title-bar pens (default 0xFF = -1)
  idcmp                 {number} IDCMP_* bitmask
  flags                 {number} WFLG_* bitmask
  title                 {string|number} JS string (owned copy) or
                                 caller-managed STRPTR
  minWidth, minHeight   {number}
  maxWidth, maxHeight   {number}
  type                  {number} 1=WBENCHSCREEN, 0xF=CUSTOMSCREEN

Methods:
  free()  - frees struct + any owned title string (idempotent).

Typical use:
  let nw = new NewWindow({
    width: 320, height: 200, title: 'Hi',
    flags: Intuition.consts.WFLG_CLOSEGADGET | WFLG_ACTIVATE,
    idcmp: Intuition.consts.IDCMP_CLOSEWINDOW,
  });
  let win = Intuition.OpenWindow(nw);
  try { ... } finally { win.close(); nw.free(); }`;
  }

  /**
   * @param {object|number} [initOrPtr]
   *   If a number: wrap an existing NewWindow pointer (no
   *   allocation). If an object: allocate a fresh struct, populate
   *   fields. Fields:
   *     left, top, width, height, detailPen, blockPen, idcmp, flags,
   *     title (string or pointer), minWidth, minHeight, maxWidth,
   *     maxHeight, type (1=WBENCHSCREEN, 0xF=CUSTOMSCREEN).
   */
  constructor(initOrPtr) {
    if (typeof initOrPtr === 'number') {
      super(initOrPtr);
      this._titleAlloc = null;
      return;
    }

    super();
    this._titleAlloc = null;

    /* DetailPen / BlockPen default to 0xFF (-1) per the C convention. */
    this.write8(8, 0xFF);
    this.write8(9, 0xFF);

    /* Type default = WBENCHSCREEN (1) */
    this.write16(46, 1);

    if (!initOrPtr) {
      return;
    }

    let i = initOrPtr;

    if (i.left      !== undefined) this.left      = i.left;
    if (i.top       !== undefined) this.top       = i.top;
    if (i.width     !== undefined) this.width     = i.width;
    if (i.height    !== undefined) this.height    = i.height;
    if (i.detailPen !== undefined) this.write8(8, i.detailPen);
    if (i.blockPen  !== undefined) this.write8(9, i.blockPen);
    if (i.idcmp     !== undefined) this.idcmp     = i.idcmp;
    if (i.flags     !== undefined) this.flags     = i.flags;
    if (i.title     !== undefined) this.title     = i.title;
    if (i.minWidth  !== undefined) this.write16(38, i.minWidth);
    if (i.minHeight !== undefined) this.write16(40, i.minHeight);
    if (i.maxWidth  !== undefined) this.write16(42, i.maxWidth);
    if (i.maxHeight !== undefined) this.write16(44, i.maxHeight);
    if (i.type      !== undefined) this.write16(46, i.type);
  }

  /**
   * Frees the underlying memory AND any owned title string.
   *
   * @returns {undefined}
   */
  free() {
    if (this._titleAlloc) {
      globalThis.amiga.freeMem(
        this._titleAlloc.ptr,
        this._titleAlloc.size
      );
      this._titleAlloc = null;
    }

    super.free();
  }

  get left()      { return this.read16(0); }
  set left(v)     { this.write16(0, v); }

  get top()       { return this.read16(2); }
  set top(v)      { this.write16(2, v); }

  get width()     { return this.read16(4); }
  set width(v)    { this.write16(4, v); }

  get height()    { return this.read16(6); }
  set height(v)   { this.write16(6, v); }

  get idcmp()     { return this.read32(10); }
  set idcmp(v)    { this.write32(10, v | 0); }

  get flags()     { return this.read32(14); }
  set flags(v)    { this.write32(14, v | 0); }

  /**
   * Title field. Set with a string to allocate + own; set with a
   * number to use a caller-managed pointer (no auto-free).
   */
  set title(value) {
    if (this._titleAlloc) {
      globalThis.amiga.freeMem(
        this._titleAlloc.ptr,
        this._titleAlloc.size
      );
      this._titleAlloc = null;
    }

    if (value === null || value === undefined || value === 0) {
      this.write32(26, 0);
      return;
    }

    if (typeof value === 'string') {
      let bytes = value.length + 1;
      let strPtr = globalThis.amiga.allocMem(bytes);

      if (!strPtr) {
        throw new Error('NewWindow.title: allocMem failed');
      }

      globalThis.amiga.pokeString(strPtr, value);
      this.write32(26, strPtr);
      this._titleAlloc = { ptr: strPtr, size: bytes };
      return;
    }

    /* number / pointer */
    this.write32(26, ptrOf(value));
  }

  get title() {
    let p = this.read32(26);

    return p ? globalThis.amiga.peekString(p, 256) : null;
  }
}
