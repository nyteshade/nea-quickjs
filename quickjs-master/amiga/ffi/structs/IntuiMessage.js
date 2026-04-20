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

  /**
   * The IDCMP_* class flag for this message. Returns the matching
   * CEnumeration case from `Intuition.consts` so `===` works:
   *
   *   if (msg.class === Intuition.consts.IDCMP_CLOSEWINDOW) { ... }
   *
   * Falls back to the raw number if no case matches (unknown flag).
   * The case still coerces to its numeric value in bitwise and
   * arithmetic contexts, so `msg.class | 0`, `msg.class & MASK`, and
   * `Number(msg.class)` all give the raw flag.
   *
   * @returns {CEnumeration|number}
   */
  get class() {
    let raw = this.read32(20);
    let Intuition = globalThis.amiga && globalThis.amiga.Intuition;

    if (Intuition && Intuition.consts && Intuition.consts.from) {
      let hit = Intuition.consts.from(raw);

      if (hit) {
        return hit;
      }
    }

    return raw;
  }

  /** @returns {number} same as `class` but always the raw flag */
  get classRaw() { return this.read32(20); }

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
    globalThis.amiga.Exec.ReplyMsg(this);
  }
}
