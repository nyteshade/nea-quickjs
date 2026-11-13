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
  /* check-structs: struct IORequest */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * exec/io.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    mn_ReplyPort: 14,   /* io_Message.mn_ReplyPort */
    mn_Length:    18,   /* io_Message.mn_Length */
    io_Device:    20,
    io_Unit:      24,
    io_Command:   28,
    io_Flags:     30,
    io_Error:     31,
  });

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
  messageLen  {number} UWORD at +18 (mn_Length - struct byte size)
  device      {number} Device* ptr at +20
  unit        {number} Unit* ptr at +24
  command     {number} UWORD at +28
  flags       {number} UBYTE at +30
  error       {number} BYTE at +31

Setters exist for replyPort, messageLen, command, flags, device and
unit. OpenDevice fills in device and unit; set them yourself only to
make a second request for a device that is already open, by copying
both from the first. Never send a request that is still out: use one
request per job. Read 'error' after DoIO.

See TimerRequest for a concrete specialization.`;
  }

  /** @returns {number} */
  get replyPort()   { return this.read32(IORequest.OFFSET.mn_ReplyPort); }
  set replyPort(v)  { this.write32(IORequest.OFFSET.mn_ReplyPort, (v && v.ptr) || (v | 0)); }

  /** @returns {number} */
  get messageLen()  { return this.read16(IORequest.OFFSET.mn_Length); }
  set messageLen(v) { this.write16(IORequest.OFFSET.mn_Length, v | 0); }

  /* device and unit are filled in by OpenDevice. They are writable so
   * that a second request can be pointed at a device that is already
   * open, by copying both from the request that opened it. */

  /** @returns {number} */
  get device()      { return this.read32(IORequest.OFFSET.io_Device); }
  set device(v)     { this.write32(IORequest.OFFSET.io_Device, (v && v.ptr) || (v | 0)); }

  /** @returns {number} */
  get unit()        { return this.read32(IORequest.OFFSET.io_Unit); }
  set unit(v)       { this.write32(IORequest.OFFSET.io_Unit, (v && v.ptr) || (v | 0)); }

  /** @returns {number} */
  get command()     { return this.read16(IORequest.OFFSET.io_Command); }
  set command(v)    { this.write16(IORequest.OFFSET.io_Command, v | 0); }

  /** @returns {number} UBYTE */
  get flags()       { return this.read8(IORequest.OFFSET.io_Flags); }
  set flags(v)      { this.write8(IORequest.OFFSET.io_Flags, v | 0); }

  /** @returns {number} BYTE (may be negative for error codes) */
  get error()       {
    let b = this.read8(IORequest.OFFSET.io_Error);
    /* BYTE is signed; extend from 8-bit 2s-complement. */
    return b >= 0x80 ? b - 0x100 : b;   /* check-constants: skip - sign extension of a byte */
  }
}
