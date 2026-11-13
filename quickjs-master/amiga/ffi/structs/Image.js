/* quickjs-master/amiga/ffi/structs/Image.js
 *
 * Wraps a BOOPSI image instance (frameiclass, led.image, etc.).
 * Read-only fields; full attribute access requires Intuition.GetAttr.
 */

import { Struct } from './Struct.js';

export class Image extends Struct {
  /* check-structs: struct Image */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * intuition/intuition.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    LeftEdge: 0,
    TopEdge:  2,
    Width:    4,
    Height:   6,
    Depth:    8,
  });

  /* Allocated by NewObject; we just wrap. */

  /**
   * REPL help text — a human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `Image(ptr)
where:
  ptr - REQUIRED: an existing BOOPSI image pointer returned by
        Intuition.NewObjectTags('frameiclass'/'sysiclass'/etc, ...).
        You cannot allocate a BOOPSI image from scratch via this
        wrapper - use NewObjectTags and let it wrap the return.

Fields (read-only getters):
  leftEdge  {number} WORD, +0
  topEdge   {number} WORD, +2
  width     {number} WORD, +4
  height    {number} WORD, +6
  depth     {number} WORD, +8

Lifecycle: call Intuition.DisposeObject(img) when done.`;
  }

  /** @returns {number} */
  get leftEdge() { return this.read16(Image.OFFSET.LeftEdge); }

  /** @returns {number} */
  get topEdge()  { return this.read16(Image.OFFSET.TopEdge); }

  /** @returns {number} */
  get width()    { return this.read16(Image.OFFSET.Width); }

  /** @returns {number} */
  get height()   { return this.read16(Image.OFFSET.Height); }

  /** @returns {number} */
  get depth()    { return this.read16(Image.OFFSET.Depth); }
}
