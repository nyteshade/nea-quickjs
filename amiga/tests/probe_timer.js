/*
 * probe_timer.js - walk through every timer.device call that
 * clock_demo.js makes, one at a time, saying what comes next.
 *
 * This is a diagnostic, not an example. Each step is announced and
 * flushed to the console BEFORE it runs, so if the machine gurus, the
 * last line on screen names the call that did it.
 *
 * No window is opened. The steps, in order:
 *
 *   A. make a message port, open timer.device
 *   B. read the system time             (DoIO, answered at once)
 *   C. wait one second                  (DoIO, sleeps)
 *   D. a second request, by copying the device and unit; read the time
 *   E. wait one second without blocking (SendIO, Wait, GetMsg)
 *   F. start a five second wait and cancel it (SendIO, AbortIO, WaitIO)
 *   G. close the device, delete the port, free both requests
 *
 * Assumptions:
 *   - quickjs.library 0.215 or later (OpenDevice takes a JS string)
 *   - timer.device is present (it is in every Kickstart ROM)
 *
 * Run: qjs tests/probe_timer.js
 */

import * as std from 'qjs:std';

/** Vertical-blank timer unit (devices/timer.h). */
const UNIT_VBLANK = 1;

/** timer.device commands (devices/timer.h): CMD_NONSTD = 9. */
const TR_ADDREQUEST = 9;
const TR_GETSYSTIME = 10;

/**
 * Announce the next step and push the text out to the console now.
 *
 * @param {string} text
 * @returns {undefined}
 */
function step(text) {
  std.out.puts(text + '\n');
  std.out.flush();
}

/**
 * Format a number as eight hex digits.
 *
 * @param {number} value
 * @returns {string}
 */
function hex(value) {
  return '0x' + (value >>> 0).toString(16).padStart(8, '0');
}

/**
 * Describe a timer request: where it is and what its fields hold.
 *
 * @param {string} name
 * @param {TimerRequest} request
 * @returns {string}
 */
function describe(name, request) {
  return name + ' at ' + hex(request.ptr) +
         ' device=' + hex(request.device) +
         ' unit=' + hex(request.unit) +
         ' replyPort=' + hex(request.replyPort) +
         ' error=' + request.error;
}

step('A1 CreateMsgPort');
let port = new MsgPort(Exec.CreateMsgPort());
step('   port at ' + hex(port.ptr) + ' sigBit=' + port.sigBit +
     ' sigTask=' + hex(port.sigTask));

step('A2 allocate the first request');
let first = new TimerRequest();
first.replyPort  = port.ptr;
first.messageLen = TimerRequest.SIZE;
step('   ' + describe('first', first));

step('A3 OpenDevice(timer.device, UNIT_VBLANK)');
let openError = Exec.OpenDevice('timer.device', UNIT_VBLANK, first, 0);
step('   returned ' + openError);
step('   ' + describe('first', first));

if (openError !== 0) {
  step('OpenDevice failed; stopping.');
  Exec.DeleteMsgPort(port);
  first.free();
  std.exit(1);
}

step('B1 DoIO TR_GETSYSTIME on the first request');
first.command = TR_GETSYSTIME;
first.setTimeval(0, 0);
let doError = Exec.DoIO(first);
step('   returned ' + ((doError << 24) >> 24) +
     ' time=' + first.tvSecs + '.' + first.tvMicro);

step('C1 DoIO TR_ADDREQUEST for 1 second (should pause)');
first.command = TR_ADDREQUEST;
first.setTimeval(1, 0);
doError = Exec.DoIO(first);
step('   returned ' + ((doError << 24) >> 24));

step('D1 allocate the second request and copy device and unit');
let second = new TimerRequest();
second.replyPort  = port.ptr;
second.messageLen = TimerRequest.SIZE;
second.device     = first.device;
second.unit       = first.unit;
step('   ' + describe('second', second));

step('D2 DoIO TR_GETSYSTIME on the second request');
second.command = TR_GETSYSTIME;
second.setTimeval(0, 0);
doError = Exec.DoIO(second);
step('   returned ' + ((doError << 24) >> 24) +
     ' time=' + second.tvSecs + '.' + second.tvMicro);

step('E1 SendIO TR_ADDREQUEST for 1 second on the first request');
first.command = TR_ADDREQUEST;
first.setTimeval(1, 0);
Exec.SendIO(first);

step('E2 Wait on the port signal ' + hex(port.sigMask));
let signals = Exec.Wait(port.sigMask);
step('   woke with ' + hex(signals));

step('E3 GetMsg');
let message = Exec.GetMsg(port);
step('   got ' + hex(message) + ' (expected ' + hex(first.ptr) + ')');

step('E4 DoIO TR_GETSYSTIME on the second request, as the clock does');
second.command = TR_GETSYSTIME;
second.setTimeval(0, 0);
doError = Exec.DoIO(second);
step('   returned ' + ((doError << 24) >> 24) +
     ' time=' + second.tvSecs + '.' + second.tvMicro);

step('F1 SendIO TR_ADDREQUEST for 5 seconds on the first request');
first.command = TR_ADDREQUEST;
first.setTimeval(5, 0);
Exec.SendIO(first);

step('F2 AbortIO');
Exec.AbortIO(first);

step('F3 WaitIO');
let waitError = Exec.WaitIO(first);
step('   returned ' + ((waitError << 24) >> 24) + ' (-2 means aborted)');

step('G1 CloseDevice');
Exec.CloseDevice(first);

step('G2 DeleteMsgPort');
Exec.DeleteMsgPort(port);

step('G3 free both requests');
second.free();
first.free();

step('Finished without a crash.');
