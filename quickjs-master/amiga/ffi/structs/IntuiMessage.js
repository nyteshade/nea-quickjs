/* quickjs-master/amiga/ffi/structs/IntuiMessage.js
 *
 * struct IntuiMessage (intuition/intuition.h) layout:
 *   +0..19  struct Message (ExecMessage prefix, 20 bytes)
 *  +20  Class (ULONG)
 *  +24  Code (UWORD)
 *  +26  Qualifier (UWORD)
 *  +28  IAddress (APTR)
 *  +32  MouseX (WORD), +34 MouseY (WORD)
 *  +36  Seconds (ULONG)
 *  +40  Micros (ULONG)
 *  +44  IDCMPWindow (struct Window *)
 *  +48  SpecialLink (struct IntuiMessage *)
 */

import { Struct } from './Struct.js';

export class IntuiMessage extends Struct {
  /** @type {number} */
  static SIZE = 52;

  /** @returns {number} the IDCMP_* class flag */
  get class()     { return this.read32(20); }

  /** @returns {number} */
  get code()      { return this.read16(24); }

  /** @returns {number} */
  get qualifier() { return this.read16(26); }

  /** @returns {number} */
  get iAddress()  { return this.read32(28); }

  /** @returns {number} */
  get mouseX()    { return this.read16(32); }

  /** @returns {number} */
  get mouseY()    { return this.read16(34); }

  /** @returns {number} */
  get seconds()   { return this.read32(36); }

  /** @returns {number} */
  get micros()    { return this.read32(40); }

  /** @returns {number} */
  get idcmpWindow() { return this.read32(44); }

  /**
   * Reply this message back to Intuition. After calling, the message
   * memory is no longer ours to read.
   *
   * @returns {undefined}
   */
  reply() {
    /* Late-bound to avoid circular import — Exec is loaded before us. */
    globalThis.amiga.lib.Exec.ReplyMsg(this);
  }
}
