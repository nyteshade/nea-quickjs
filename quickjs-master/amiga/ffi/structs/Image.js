/* quickjs-master/amiga/ffi/structs/Image.js
 *
 * Wraps a BOOPSI image instance (frameiclass, led.image, etc.).
 * Read-only fields; full attribute access requires Intuition.GetAttr.
 */

import { Struct } from './Struct.js';

export class Image extends Struct {
  /* Allocated by NewObject; we just wrap. */

  /** @returns {number} */
  get leftEdge() { return this.read16(0); }

  /** @returns {number} */
  get topEdge()  { return this.read16(2); }

  /** @returns {number} */
  get width()    { return this.read16(4); }

  /** @returns {number} */
  get height()   { return this.read16(6); }

  /** @returns {number} */
  get depth()    { return this.read16(8); }
}
