/* quickjs-master/amiga/ffi/structs/MsgPort.js
 *
 * struct MsgPort layout (exec/ports.h):
 *   +0   ln_Succ (Node.ln_Succ, ptr)
 *   +4   ln_Pred
 *   +8   ln_Type (UBYTE)
 *   +9   ln_Pri  (BYTE)
 *  +10   ln_Name (STRPTR)
 *  +14   mp_Flags (UBYTE)
 *  +15   mp_SigBit (UBYTE)
 *  +16   mp_SigTask (Task*)
 *  +20   mp_MsgList (List head, 12 bytes)
 *  total 32
 */

import { Struct } from './Struct.js';

export class MsgPort extends Struct {
  /** @type {number} */
  static SIZE = 32;

  /**
   * REPL help text — a human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `MsgPort(ptr?)
where:
  ptr? - optional existing struct MsgPort pointer to wrap. Omit to
         allocate a fresh zeroed 32-byte struct (caller must still
         fill mp_Flags/mp_SigBit/mp_SigTask and call NewList on
         mp_MsgList before using).

Fields (read-only getters):
  sigBit    {number}  signal bit index, +15 (UBYTE)
  sigTask   {number}  owner Task* ptr, +16
  sigMask   {number}  derived: 1 << sigBit

Typical use:
  let port = win.userPort;  // wraps Intuition-allocated port
  Exec.Wait(port.sigMask);`;
  }

  /** @returns {number} signal bit number this port uses */
  get sigBit() { return this.read8(15); }

  /** @returns {number} owner task ptr */
  get sigTask() { return this.read32(16); }

  /** @returns {number} signal mask = 1 << sigBit */
  get sigMask() { return 1 << this.sigBit; }
}
