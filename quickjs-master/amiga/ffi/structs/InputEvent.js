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
  /* check-structs: struct InputEvent */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * devices/inputevent.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    ie_NextEvent: 0,
    ie_Class:     4,
    ie_SubClass:  5,
    ie_Code:      6,
    ie_Qualifier: 8,
    ie_position:  10,
    tv_secs:      14,   /* ie_TimeStamp + 0 as 4 bytes: seconds */
    tv_micro:     18,   /* ie_TimeStamp + 4 as 4 bytes: microseconds */
  });

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
  get nextEvent()    { return this.read32(InputEvent.OFFSET.ie_NextEvent); }
  set nextEvent(v)   { this.write32(InputEvent.OFFSET.ie_NextEvent, (v && v.ptr) || (v | 0)); }

  /** @returns {number} UBYTE, IECLASS_* */
  get class()        { return this.read8(InputEvent.OFFSET.ie_Class); }
  set class(v)       { this.write8(InputEvent.OFFSET.ie_Class, v | 0); }

  /** @returns {number} UBYTE */
  get subClass()     { return this.read8(InputEvent.OFFSET.ie_SubClass); }
  set subClass(v)    { this.write8(InputEvent.OFFSET.ie_SubClass, v | 0); }

  /** @returns {number} UWORD */
  get code()         { return this.read16(InputEvent.OFFSET.ie_Code); }
  set code(v)        { this.write16(InputEvent.OFFSET.ie_Code, v | 0); }

  /** @returns {number} UWORD */
  get qualifier()    { return this.read16(InputEvent.OFFSET.ie_Qualifier); }
  set qualifier(v)   { this.write16(InputEvent.OFFSET.ie_Qualifier, v | 0); }

  /** @returns {number} APTR (class-dependent interpretation) */
  get eventAddress() { return this.read32(InputEvent.OFFSET.ie_position); }
  set eventAddress(v){ this.write32(InputEvent.OFFSET.ie_position, (v && v.ptr) || (v | 0)); }

  /** @returns {number} TimeStamp tv_secs */
  get seconds()      { return this.read32(InputEvent.OFFSET.tv_secs); }

  /** @returns {number} TimeStamp tv_micro */
  get micros()       { return this.read32(InputEvent.OFFSET.tv_micro); }
}
