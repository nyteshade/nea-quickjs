/* quickjs-master/amiga/ffi/structs/TimerRequest.js
 *
 * struct timerequest (devices/timer.h). IORequest + one timeval,
 * used by timer.device for delays.
 *
 * Field offsets (continues IORequest, 2-byte aligned):
 *   +0..31  IORequest header (see IORequest.js)
 *  +32      tv_secs   (ULONG)
 *  +36      tv_micro  (ULONG)
 *  total 40
 *
 * Units: UNIT_MICROHZ (0) = µs precision; UNIT_VBLANK (1) = VBL ticks.
 * Commands: TR_ADDREQUEST (9) = "signal me after tv_secs.tv_micro",
 *           TR_GETSYSTIME (11) = "fill tv with current uptime".
 */

import { IORequest } from './IORequest.js';

export class TimerRequest extends IORequest {
  /** @type {number} */
  static SIZE = 40;

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `TimerRequest(ptr?)
where:
  ptr? - optional existing struct timerequest pointer. Omit to
         allocate a zeroed 40-byte TimerRequest.

Fields (inherits IORequest + adds):
  tvSecs   {number} tv_secs,  +32 (ULONG)
  tvMicro  {number} tv_micro, +36 (ULONG)
  setTimeval(secs, micro)     convenience setter

Typical use:
  // open timer.device first (not wrapped yet — use raw FFI).
  let tr = new TimerRequest();
  tr.replyPort  = port.ptr;
  tr.messageLen = TimerRequest.SIZE;
  tr.command = 9;            // TR_ADDREQUEST
  tr.setTimeval(2, 0);       // 2 seconds
  // then Exec.DoIO(tr) or SendIO.

Commands:
  TR_ADDREQUEST = 9
  TR_GETSYSTIME = 11
  CMD_ABORTIO   = 4`;
  }

  /** @returns {number} ULONG seconds */
  get tvSecs()   { return this.read32(32); }
  set tvSecs(v)  { this.write32(32, v | 0); }

  /** @returns {number} ULONG microseconds (0..999999) */
  get tvMicro()  { return this.read32(36); }
  set tvMicro(v) { this.write32(36, v | 0); }

  /**
   * Fill both tv fields at once.
   *
   * @param {number} secs  — seconds
   * @param {number} micro — microseconds (0..999999)
   * @returns {undefined}
   */
  setTimeval(secs, micro) {
    this.tvSecs  = secs;
    this.tvMicro = micro;
  }
}
