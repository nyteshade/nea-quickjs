/*
 * timer_demo.js - wait two seconds with timer.device and time the wait.
 *
 * Nothing opens: the script prints the system time, sleeps for two
 * seconds by sending a request to timer.device and waiting for it to
 * come back, then prints the time again and the difference. It shows
 * the whole life of a device request: message port, request, open,
 * do, close.
 *
 * Assumptions:
 *   - timer.device is present (it is in every Kickstart ROM)
 *   - the microsecond-resolution unit (UNIT_MICROHZ) is used, so the
 *     wait is as accurate as the machine's CIA timers
 *   - the system clock is not changed by anything else during the wait
 *
 * Requires quickjs.library 0.213+.
 * Run: qjs examples/timer_demo.js
 */

import * as std from 'qjs:std';

if (typeof TimerRequest !== 'function' || typeof Exec !== 'function') {
  print('Q2 wrappers unavailable - need quickjs.library 0.134+');
  std.exit(1);
}

/** Which timer.device unit to open (devices/timer.h). */
const UNIT_MICROHZ = 0;

/** timer.device command: "reply to me after this long"
 *  (devices/timer.h, TR_ADDREQUEST = CMD_NONSTD = 9). */
const TR_ADDREQUEST = 9;

/** timer.device command that reads the system time into the request
 *  (devices/timer.h, TR_GETSYSTIME = CMD_NONSTD + 1 = 10). Take care
 *  with this number: 11 is TR_SETSYSTIME, which sets the clock. */
const TR_GETSYSTIME = 10;

/** How long to wait, in seconds. */
const WAIT_SECONDS = 2;

const MICROS_PER_SECOND = 1000000;

/**
 * Ask timer.device for the system time.
 *
 * @param {TimerRequest} request - an open timer request, not in use
 * @returns {{secs: number, micro: number}} seconds and microseconds
 */
function readSystemTime(request) {
  request.command = TR_GETSYSTIME;
  request.setTimeval(0, 0);
  Exec.DoIO(request);

  return { secs: request.tvSecs, micro: request.tvMicro };
}

/**
 * Format a time as seconds.microseconds, the fraction always six
 * digits long.
 *
 * @param {number} secs
 * @param {number} micro
 * @returns {string}
 */
function formatTime(secs, micro) {
  return secs + '.' + String(micro).padStart(6, '0');
}

/* A device answers a request by sending it back to a message port, so
 * the port comes first. */
let port = new MsgPort(Exec.CreateMsgPort());

if (!port.ptr) {
  print('CreateMsgPort failed');
  std.exit(1);
}

let request = new TimerRequest();
request.replyPort  = port.ptr;
request.messageLen = TimerRequest.SIZE;

let openError = Exec.OpenDevice('timer.device', UNIT_MICROHZ, request, 0);

if (openError !== 0) {
  print('OpenDevice(timer.device) failed, rc=' + openError);
  Exec.DeleteMsgPort(port);
  request.free();
  std.exit(1);
}

try {
  let start = readSystemTime(request);
  print('Start time: ' + formatTime(start.secs, start.micro));

  /* DoIO sends the request and sleeps until the device replies, which
   * for TR_ADDREQUEST is when the time is up. */
  request.command = TR_ADDREQUEST;
  request.setTimeval(WAIT_SECONDS, 0);
  Exec.DoIO(request);

  if (request.error !== 0) {
    print('TR_ADDREQUEST returned error ' + request.error);
  }

  let end = readSystemTime(request);

  let elapsedSecs  = end.secs  - start.secs;
  let elapsedMicro = end.micro - start.micro;

  /* Borrow a second when the microseconds wrapped. */
  if (elapsedMicro < 0) {
    elapsedMicro += MICROS_PER_SECOND;
    elapsedSecs  -= 1;
  }

  print('End   time: ' + formatTime(end.secs, end.micro));
  print('Elapsed   : ' + formatTime(elapsedSecs, elapsedMicro) + 's');
}
finally {
  Exec.CloseDevice(request);
  Exec.DeleteMsgPort(port);
  request.free();
}

print('Clean exit.');
