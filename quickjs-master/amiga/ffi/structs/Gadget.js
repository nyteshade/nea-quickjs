/* quickjs-master/amiga/ffi/structs/Gadget.js
 *
 * Read-only Gadget pointer wrapper. Q3 GadTools wrapper makes them
 * constructable.
 */

import { Struct } from './Struct.js';

export class Gadget extends Struct {
  /* Allocated by GadTools or user; we wrap. */

  /**
   * REPL help text — a human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `Gadget(ptr)
where:
  ptr - REQUIRED: an existing struct Gadget pointer, usually
        returned by GadTools.CreateGadget / NewObjectTags for a
        *.gadget class. No from-scratch allocation via this wrapper.

Fields (read-only getters):
  nextGadget {number} next ptr in the gadget list, +0
  leftEdge   {number} +4
  topEdge    {number} +6
  width      {number} +8
  height     {number} +10
  flags      {number} GFLG_* bits, +12
  activation {number} GACT_* bits, +14
  gadgetType {number} GTYP_* bits, +16
  gadgetID   {number} user-assigned id, +34`;
  }

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
