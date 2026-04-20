/* quickjs-master/amiga/ffi/structs/IORequest.js
 *
 * struct IORequest (exec/io.h). Base "I/O message" passed to devices
 * via DoIO/SendIO/WaitIO. Size 32 bytes. Concrete devices usually
 * extend this with their own struct (see TimerRequest).
 *
 * Field offsets:
 *   +0   io_Message (struct Message) — 20 bytes
 *  +20   io_Device  (struct Device *)
 *  +24   io_Unit    (struct Unit   *)
 *  +28   io_Command (UWORD)
 *  +30   io_Flags   (UBYTE)
 *  +31   io_Error   (BYTE)
 *  total 32
 *
 * The io_Message header itself has:
 *   +0   mn_Node      (struct Node, 14 bytes)
 *  +14   mn_ReplyPort (struct MsgPort *)
 *  +18   mn_Length    (UWORD)
 */

import { Struct } from './Struct.js';
import { ptrOf } from '../ptrOf.js';

export class IORequest extends Struct {
  /** @type {number} */
  static SIZE = 32;

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `IORequest(ptr?)
where:
  ptr? - optional existing IORequest* pointer. Omit to allocate 32
         zeroed bytes (caller still needs to fill io_Message's
         mn_ReplyPort, mn_Length, and whatever io_Command/flags the
         target device expects).

Fields:
  replyPort   {number} MsgPort* ptr at +14 (mn_ReplyPort)
  messageLen  {number} UWORD at +18 (mn_Length — struct byte size)
  device      {number} Device* ptr at +20
  unit        {number} Unit* ptr at +24
  command     {number} UWORD at +28
  flags       {number} UBYTE at +30
  error       {number} BYTE at +31

Setters exist for replyPort, messageLen, command, flags; device
and unit are normally set by OpenDevice. Read 'error' after DoIO.

See TimerRequest for a concrete specialization.`;
  }

  /** @returns {number} */
  get replyPort()   { return this.read32(14); }
  set replyPort(v)  { this.write32(14, (v && v.ptr) || (v | 0)); }

  /** @returns {number} */
  get messageLen()  { return this.read16(18); }
  set messageLen(v) { this.write16(18, v | 0); }

  /** @returns {number} */
  get device()      { return this.read32(20); }

  /** @returns {number} */
  get unit()        { return this.read32(24); }

  /** @returns {number} */
  get command()     { return this.read16(28); }
  set command(v)    { this.write16(28, v | 0); }

  /** @returns {number} UBYTE */
  get flags()       { return this.read8(30); }
  set flags(v)      { this.write8(30, v | 0); }

  /** @returns {number} BYTE (may be negative for error codes) */
  get error()       {
    let b = this.read8(31);
    /* BYTE is signed; extend from 8-bit 2s-complement. */
    return b >= 0x80 ? b - 0x100 : b;
  }
}
