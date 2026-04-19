/* quickjs-master/amiga/ffi/structs/Gadget.js
 *
 * Read-only Gadget pointer wrapper. Q3 GadTools wrapper makes them
 * constructable.
 */

import { Struct } from './Struct.js';

export class Gadget extends Struct {
  /* Allocated by GadTools or user; we wrap. */

  /** @returns {number} next gadget ptr */
  get nextGadget() { return this.read32(0); }

  /** @returns {number} */
  get leftEdge()   { return this.read16(4); }

  /** @returns {number} */
  get topEdge()    { return this.read16(6); }

  /** @returns {number} */
  get width()      { return this.read16(8); }

  /** @returns {number} */
  get height()     { return this.read16(10); }

  /** @returns {number} */
  get flags()      { return this.read16(12); }

  /** @returns {number} */
  get activation() { return this.read16(14); }

  /** @returns {number} */
  get gadgetType() { return this.read16(16); }

  /** @returns {number} */
  get gadgetID()   { return this.read16(34); }
}
