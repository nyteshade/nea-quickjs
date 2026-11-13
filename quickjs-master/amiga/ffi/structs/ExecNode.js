/* quickjs-master/amiga/ffi/structs/ExecNode.js
 *
 * struct Node (exec/nodes.h): the link every member of an exec list
 * starts with. A wrapper around an existing node only; nodes are
 * allocated by whoever owns the list's members (a Reaction class
 * library's AllocXxxNode(), for the gadget label lists).
 *
 * Named ExecNode rather than Node so that it cannot be mistaken for a
 * DOM-style Node. Scripts reach it as amiga.exec.Node; it is not a
 * global.
 */

import { Struct } from './Struct.js';

export class ExecNode extends Struct {
  /* check-structs: struct Node */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * exec/nodes.h. Checked against the compiler's own layout of the
   * struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    ln_Succ: 0,
    ln_Pred: 4,
    ln_Type: 8,
    ln_Pri:  9,
    ln_Name: 10,
  });

  /** @type {number} */
  static SIZE = 14;

  /** @returns {number} pointer to the next node (ln_Succ) */
  get succ() { return this.read32(ExecNode.OFFSET.ln_Succ); }

  /** @param {number} pointer - the next node */
  set succ(pointer) { this.write32(ExecNode.OFFSET.ln_Succ, pointer); }

  /** @returns {number} pointer to the previous node (ln_Pred) */
  get pred() { return this.read32(ExecNode.OFFSET.ln_Pred); }

  /** @param {number} pointer - the previous node */
  set pred(pointer) { this.write32(ExecNode.OFFSET.ln_Pred, pointer); }

  /** @returns {number} Exec.consts.NT_* (ln_Type) */
  get type() { return this.read8(ExecNode.OFFSET.ln_Type); }

  /** @returns {number} priority, -128..127 (ln_Pri) */
  get priority() {
    let value = this.read8(ExecNode.OFFSET.ln_Pri);

    return value > 127 ? value - 256 : value;
  }

  /** @returns {string|null} the node's name (ln_Name), if it has one */
  get name() {
    let pointer = this.read32(ExecNode.OFFSET.ln_Name);

    return pointer ? globalThis.amiga.peekString(pointer, 256) : null;
  }
}
