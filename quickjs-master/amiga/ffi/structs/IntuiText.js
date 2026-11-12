/* quickjs-master/amiga/ffi/structs/IntuiText.js
 *
 * struct IntuiText (intuition/intuition.h). A rendered text element
 * passable anywhere Intuition wants text (menu items, gadgets,
 * requesters) via Intuition.PrintIText.
 *
 * Field offsets (2-byte alignment):
 *   +0   FrontPen  (UBYTE)
 *   +1   BackPen   (UBYTE)
 *   +2   DrawMode  (UBYTE)
 *   +3   pad       (UBYTE)
 *   +4   LeftEdge  (WORD)
 *   +6   TopEdge   (WORD)
 *   +8   ITextFont (struct TextAttr *)
 *  +12   IText     (STRPTR)
 *  +16   NextText  (struct IntuiText *)
 *  total 20
 *
 * Memory policy: if constructed with a JS string in the init object,
 * the wrapper allocates + owns the C string and frees it in free().
 */

import { Struct } from './Struct.js';
import { ptrOf } from '../ptrOf.js';

export class IntuiText extends Struct {
  /* check-structs: struct IntuiText */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * intuition/intuition.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    FrontPen:  0,
    BackPen:   1,
    DrawMode:  2,
    LeftEdge:  4,
    TopEdge:   6,
    ITextFont: 8,
    IText:     12,
    NextText:  16,
  });

  /** @type {number} */
  static SIZE = 20;

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `IntuiText(initOrPtr?)
where:
  initOrPtr? - one of:
    - number: wrap an existing IntuiText* pointer.
    - object: allocate + populate. Fields:
        frontPen, backPen, drawMode, leftEdge, topEdge,
        font (TextAttr|number), text (string|number), nextText.
        When 'text' is a JS string, this wrapper owns the
        allocation and frees it in free().
    - omitted: zeroed 20-byte struct.

Fields (read+write):
  frontPen, backPen, drawMode  {number} UBYTE
  leftEdge, topEdge            {number} WORD
  font                         {number} TextAttr* at +8
  text                         {string|null}  (getter decodes STRPTR)
                               {string|number} (setter, owning if str)
  nextText                     {number}

Methods: free() — releases struct + owned text allocation.`;
  }

  /**
   * @param {object|number} [initOrPtr] — see `signature`
   */
  constructor(initOrPtr) {
    if (typeof initOrPtr === 'number') {
      super(initOrPtr);
      this._textAlloc = null;
      return;
    }

    super();
    this._textAlloc = null;

    if (!initOrPtr) return;

    let i = initOrPtr;

    if (i.frontPen !== undefined) this.frontPen = i.frontPen;
    if (i.backPen  !== undefined) this.backPen  = i.backPen;
    if (i.drawMode !== undefined) this.drawMode = i.drawMode;
    if (i.leftEdge !== undefined) this.leftEdge = i.leftEdge;
    if (i.topEdge  !== undefined) this.topEdge  = i.topEdge;
    if (i.font     !== undefined) this.write32(IntuiText.OFFSET.ITextFont, ptrOf(i.font));
    if (i.text     !== undefined) this.text = i.text;
    if (i.nextText !== undefined) this.write32(IntuiText.OFFSET.NextText, ptrOf(i.nextText));
  }

  /**
   * Release struct memory and any owned text string. Idempotent.
   *
   * @returns {undefined}
   */
  free() {
    if (this._textAlloc) {
      globalThis.amiga.freeMem(
        this._textAlloc.ptr,
        this._textAlloc.size
      );
      this._textAlloc = null;
    }

    super.free();
  }

  /** @returns {number} UBYTE */
  get frontPen()  { return this.read8(IntuiText.OFFSET.FrontPen); }
  set frontPen(v) { this.write8(IntuiText.OFFSET.FrontPen, v | 0); }

  /** @returns {number} UBYTE */
  get backPen()   { return this.read8(IntuiText.OFFSET.BackPen); }
  set backPen(v)  { this.write8(IntuiText.OFFSET.BackPen, v | 0); }

  /** @returns {number} JAM1/JAM2/COMPLEMENT/INVERSVID */
  get drawMode()  { return this.read8(IntuiText.OFFSET.DrawMode); }
  set drawMode(v) { this.write8(IntuiText.OFFSET.DrawMode, v | 0); }

  /** @returns {number} */
  get leftEdge()  { return this.read16(IntuiText.OFFSET.LeftEdge); }
  set leftEdge(v) { this.write16(IntuiText.OFFSET.LeftEdge, v | 0); }

  /** @returns {number} */
  get topEdge()   { return this.read16(IntuiText.OFFSET.TopEdge); }
  set topEdge(v)  { this.write16(IntuiText.OFFSET.TopEdge, v | 0); }

  /**
   * Text field. Set with a string to allocate + own; set with a
   * number to use a caller-managed pointer (no auto-free).
   *
   * @param {string|number|null} value
   */
  set text(value) {
    if (this._textAlloc) {
      globalThis.amiga.freeMem(
        this._textAlloc.ptr,
        this._textAlloc.size
      );
      this._textAlloc = null;
    }

    if (value === null || value === undefined || value === 0) {
      this.write32(IntuiText.OFFSET.IText, 0);
      return;
    }

    if (typeof value === 'string') {
      let bytes = value.length + 1;
      let p = globalThis.amiga.allocMem(bytes);

      if (!p) throw new Error('IntuiText.text: allocMem failed');

      globalThis.amiga.pokeString(p, value);
      this.write32(IntuiText.OFFSET.IText, p);
      this._textAlloc = { ptr: p, size: bytes };
      return;
    }

    this.write32(IntuiText.OFFSET.IText, value | 0);
  }

  /** @returns {string|null} */
  get text() {
    let p = this.read32(IntuiText.OFFSET.IText);
    return p ? globalThis.amiga.peekString(p, 256) : null;
  }

  /** @returns {number} */
  get nextText()  { return this.read32(IntuiText.OFFSET.NextText); }
  set nextText(v) { this.write32(IntuiText.OFFSET.NextText, (v && v.ptr) || (v | 0)); }
}
