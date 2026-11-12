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
 *           TR_GETSYSTIME (10) = "fill tv with the system time".
 *           (11 is TR_SETSYSTIME, which SETS the clock. This file said
 *           11 for GETSYSTIME until 0.213.)
 */

import { IORequest } from './IORequest.js';
import { CEnumeration } from '../CEnumeration.js';

export class TimerRequest extends IORequest {
  /** @type {number} */
  static SIZE = 40;

  /**
   * timer.device units and commands (devices/timer.h). Cases coerce to
   * their numeric value, so they can be given straight to
   * Exec.OpenDevice and to the `command` setter.
   *
   * The commands are written as the header writes them: counted up
   * from CMD_NONSTD, which exec/io.h defines as 9.
   *
   * @example
   * const T = TimerRequest.consts;
   * Exec.OpenDevice('timer.device', T.UNIT_VBLANK, request, 0);
   * request.command = T.TR_ADDREQUEST;
   */
  static consts = class TimerConsts extends CEnumeration {
    static {
      const CMD_NONSTD = 9;

      TimerConsts.define('UNIT_MICROHZ',    0);
      TimerConsts.define('UNIT_VBLANK',     1);
      TimerConsts.define('UNIT_ECLOCK',     2);
      TimerConsts.define('UNIT_WAITUNTIL',  3);
      TimerConsts.define('UNIT_WAITECLOCK', 4);

      TimerConsts.define('TR_ADDREQUEST', CMD_NONSTD);
      TimerConsts.define('TR_GETSYSTIME', CMD_NONSTD + 1);
      TimerConsts.define('TR_SETSYSTIME', CMD_NONSTD + 2);
    }
  };

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
  TR_GETSYSTIME = 10
  TR_SETSYSTIME = 11   (sets the clock; not a read)
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
