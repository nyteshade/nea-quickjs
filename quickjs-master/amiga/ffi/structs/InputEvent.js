/* quickjs-master/amiga/ffi/structs/InputEvent.js
 *
 * struct InputEvent (devices/inputevent.h). The raw input-event
 * record passed through the input handler chain. Most JS code will
 * use IDCMP_RAWKEY / VANILLAKEY via Window.messages() instead — this
 * wrapper is for low-level input-handler ports.
 *
 * Field offsets (2-byte alignment):
 *   +0   NextEvent (struct InputEvent *)
 *   +4   Class     (UBYTE)   — IECLASS_RAWKEY, RAWMOUSE, NEWPOINTERPOS...
 *   +5   SubClass  (UBYTE)
 *   +6   Code      (UWORD)
 *   +8   Qualifier (UWORD)
 *  +10   EventAddress (APTR) — union: X, Y, RawAddr, or ti_Data
 *  +14   TimeStamp (struct timeval, 8 bytes)
 *  total 22
 */

import { Struct } from './Struct.js';

export class InputEvent extends Struct {
  /** @type {number} */
  static SIZE = 22;

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `InputEvent(ptr?)
where:
  ptr? - optional existing InputEvent* pointer. Omit to allocate a
         zeroed 22-byte struct.

Fields (read+write on primitives):
  nextEvent  {number} ptr to next event in the chain, +0
  class      {number} IECLASS_* at +4 (UBYTE)
  subClass   {number} UBYTE, +5
  code       {number} UWORD, +6
  qualifier  {number} UWORD, +8
  eventAddress {number} APTR at +10 (interpreted by class)
  seconds    {number} TimeStamp seconds at +14
  micros     {number} TimeStamp micros  at +18

IECLASS_* codes (UBYTE):
  0  NULL          — empty/reset event
  1  RAWKEY        — keyboard raw key code
  2  RAWMOUSE      — mouse movement / buttons
  3  EVENT         — generic system event
  4  POINTERPOS    — absolute pointer coord
  5  TIMER         — VBL tick`;
  }

  /** @returns {number} */
  get nextEvent()    { return this.read32(0); }
  set nextEvent(v)   { this.write32(0, (v && v.ptr) || (v | 0)); }

  /** @returns {number} UBYTE, IECLASS_* */
  get class()        { return this.read8(4); }
  set class(v)       { this.write8(4, v | 0); }

  /** @returns {number} UBYTE */
  get subClass()     { return this.read8(5); }
  set subClass(v)    { this.write8(5, v | 0); }

  /** @returns {number} UWORD */
  get code()         { return this.read16(6); }
  set code(v)        { this.write16(6, v | 0); }

  /** @returns {number} UWORD */
  get qualifier()    { return this.read16(8); }
  set qualifier(v)   { this.write16(8, v | 0); }

  /** @returns {number} APTR (class-dependent interpretation) */
  get eventAddress() { return this.read32(10); }
  set eventAddress(v){ this.write32(10, (v && v.ptr) || (v | 0)); }

  /** @returns {number} TimeStamp tv_secs */
  get seconds()      { return this.read32(14); }

  /** @returns {number} TimeStamp tv_micro */
  get micros()       { return this.read32(18); }
}
