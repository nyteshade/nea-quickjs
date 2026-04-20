/*
 * timer_demo.js — Open timer.device, wait for 2 seconds via a
 * TimerRequest + DoIO, then print elapsed time before exiting.
 *
 * Demonstrates:
 *   - TimerRequest struct wrapper (extends IORequest) set up with a
 *     2-second delay
 *   - exec.library CreateMsgPort / OpenDevice / CloseDevice /
 *     DeleteMsgPort all through the Exec wrapper
 *   - Device I/O flow: fill TimerRequest, DoIO, read .error
 *   - Two TR_* commands: TR_ADDREQUEST (9) for "wait N seconds",
 *     TR_GETSYSTIME (11) for before/after timestamps
 *
 * Run:        qjs examples/timer_demo.js
 * Requires:   quickjs.library 0.134+
 */

import * as std from 'qjs:std';

if (typeof TimerRequest !== 'function' || typeof Exec !== 'function') {
  print('Q2 wrappers unavailable — need quickjs.library 0.134+');
  std.exit(1);
}

const UNIT_MICROHZ   = 0;
const TR_ADDREQUEST  = 9;
const TR_GETSYSTIME  = 11;

/**
 * Fill a TimerRequest with TR_GETSYSTIME and execute it to read the
 * current system time into its tv fields.
 *
 * @param {TimerRequest} tr
 * @returns {{secs: number, micro: number}}
 */
function readSysTime(tr) {
  tr.command = TR_GETSYSTIME;
  tr.setTimeval(0, 0);
  Exec.DoIO(tr);
  return { secs: tr.tvSecs, micro: tr.tvMicro };
}

let port = new MsgPort(Exec.CreateMsgPort());

if (!port.ptr) {
  print('CreateMsgPort failed');
  std.exit(1);
}

let tr = new TimerRequest();
tr.replyPort  = port.ptr;
tr.messageLen = TimerRequest.SIZE;

let rc = Exec.OpenDevice('timer.device', UNIT_MICROHZ, tr, 0);

if (rc !== 0) {
  print('OpenDevice(timer.device) failed, rc=' + rc);
  Exec.DeleteMsgPort(port);
  tr.free();
  std.exit(1);
}

try {
  let t0 = readSysTime(tr);
  print('Start time: ' + t0.secs + '.' +
        String(t0.micro).padStart(6, '0'));

  /* Ask timer.device to signal us after 2 seconds. */
  tr.command = TR_ADDREQUEST;
  tr.setTimeval(2, 0);
  Exec.DoIO(tr);

  if (tr.error !== 0) {
    print('TR_ADDREQUEST returned error ' + tr.error);
  }

  let t1 = readSysTime(tr);
  let ds  = t1.secs - t0.secs;
  let dus = t1.micro - t0.micro;

  if (dus < 0) { dus += 1000000; ds -= 1; }

  print('End   time: ' + t1.secs + '.' +
        String(t1.micro).padStart(6, '0'));
  print('Elapsed   : ' + ds + '.' +
        String(dus).padStart(6, '0') + 's');
}

finally {
  Exec.CloseDevice(tr);
  Exec.DeleteMsgPort(port);
  tr.free();
}

print('Clean exit.');
