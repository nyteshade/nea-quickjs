/* quickjs-master/amiga/ffi/structs/Gadget.js
 *
 * Read-only Gadget pointer wrapper. Q3 GadTools wrapper makes them
 * constructable.
 */

import { Struct } from './Struct.js';

export class Gadget extends Struct {
  /* check-structs: struct Gadget */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * intuition/intuition.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    NextGadget: 0,
    LeftEdge:   4,
    TopEdge:    6,
    Width:      8,
    Height:     10,
    Flags:      12,
    Activation: 14,
    GadgetType: 16,
    GadgetID:     38,
  });

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
  gadgetID   {number} user-assigned id, +38
             (read from +34, which is SpecialInfo, until 0.220)`;
  }

  /** @returns {number} next gadget ptr */
  get nextGadget() { return this.read32(Gadget.OFFSET.NextGadget); }

  /** @returns {number} */
  get leftEdge()   { return this.read16(Gadget.OFFSET.LeftEdge); }

  /** @returns {number} */
  get topEdge()    { return this.read16(Gadget.OFFSET.TopEdge); }

  /** @returns {number} */
  get width()      { return this.read16(Gadget.OFFSET.Width); }

  /** @returns {number} */
  get height()     { return this.read16(Gadget.OFFSET.Height); }

  /** @returns {number} */
  get flags()      { return this.read16(Gadget.OFFSET.Flags); }

  /** @returns {number} */
  get activation() { return this.read16(Gadget.OFFSET.Activation); }

  /** @returns {number} */
  get gadgetType() { return this.read16(Gadget.OFFSET.GadgetType); }

  /** @returns {number} */
  get gadgetID()   { return this.read16(Gadget.OFFSET.GadgetID); }
}
