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
  /* check-structs: struct NewWindow */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * intuition/intuition.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    LeftEdge:   0,
    TopEdge:    2,
    Width:      4,
    Height:     6,
    DetailPen:  8,
    BlockPen:   9,
    IDCMPFlags: 10,
    Flags:      14,
    Title:      26,
    MinWidth:   38,
    MinHeight:  40,
    MaxWidth:   42,
    MaxHeight:  44,
    Type:       46,
  });

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
    this.write8(NewWindow.OFFSET.DetailPen, 0xFF);
    this.write8(NewWindow.OFFSET.BlockPen, 0xFF);

    /* Type default = WBENCHSCREEN (1) */
    this.write16(NewWindow.OFFSET.Type, 1);

    if (!initOrPtr) {
      return;
    }

    let i = initOrPtr;

    if (i.left      !== undefined) this.left      = i.left;
    if (i.top       !== undefined) this.top       = i.top;
    if (i.width     !== undefined) this.width     = i.width;
    if (i.height    !== undefined) this.height    = i.height;
    if (i.detailPen !== undefined) this.write8(NewWindow.OFFSET.DetailPen, i.detailPen);
    if (i.blockPen  !== undefined) this.write8(NewWindow.OFFSET.BlockPen, i.blockPen);
    if (i.idcmp     !== undefined) this.idcmp     = i.idcmp;
    if (i.flags     !== undefined) this.flags     = i.flags;
    if (i.title     !== undefined) this.title     = i.title;
    if (i.minWidth  !== undefined) this.write16(NewWindow.OFFSET.MinWidth, i.minWidth);
    if (i.minHeight !== undefined) this.write16(NewWindow.OFFSET.MinHeight, i.minHeight);
    if (i.maxWidth  !== undefined) this.write16(NewWindow.OFFSET.MaxWidth, i.maxWidth);
    if (i.maxHeight !== undefined) this.write16(NewWindow.OFFSET.MaxHeight, i.maxHeight);
    if (i.type      !== undefined) this.write16(NewWindow.OFFSET.Type, i.type);
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

  get left()      { return this.read16(NewWindow.OFFSET.LeftEdge); }
  set left(v)     { this.write16(NewWindow.OFFSET.LeftEdge, v); }

  get top()       { return this.read16(NewWindow.OFFSET.TopEdge); }
  set top(v)      { this.write16(NewWindow.OFFSET.TopEdge, v); }

  get width()     { return this.read16(NewWindow.OFFSET.Width); }
  set width(v)    { this.write16(NewWindow.OFFSET.Width, v); }

  get height()    { return this.read16(NewWindow.OFFSET.Height); }
  set height(v)   { this.write16(NewWindow.OFFSET.Height, v); }

  get idcmp()     { return this.read32(NewWindow.OFFSET.IDCMPFlags); }
  set idcmp(v)    { this.write32(NewWindow.OFFSET.IDCMPFlags, v | 0); }

  get flags()     { return this.read32(NewWindow.OFFSET.Flags); }
  set flags(v)    { this.write32(NewWindow.OFFSET.Flags, v | 0); }

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
      this.write32(NewWindow.OFFSET.Title, 0);
      return;
    }

    if (typeof value === 'string') {
      let bytes = value.length + 1;
      let strPtr = globalThis.amiga.allocMem(bytes);

      if (!strPtr) {
        throw new Error('NewWindow.title: allocMem failed');
      }

      globalThis.amiga.pokeString(strPtr, value);
      this.write32(NewWindow.OFFSET.Title, strPtr);
      this._titleAlloc = { ptr: strPtr, size: bytes };
      return;
    }

    /* number / pointer */
    this.write32(NewWindow.OFFSET.Title, ptrOf(value));
  }

  get title() {
    let p = this.read32(NewWindow.OFFSET.Title);

    return p ? globalThis.amiga.peekString(p, 256) : null;
  }
}
