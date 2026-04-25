/*
 * reaction_clock_demo.js — 1Hz elapsed-time counter on top of the
 * Reaction OO layer, using Window.events({ extraSignals: ... }).
 *
 * The window has a readonly StringGadget showing HH:MM:SS. A
 * timer.device IORequest is armed for 1s; its reply-port signal is
 * passed to Window.events(...) via `extraSignals`. When the timer
 * fires, Window.events yields an EventKind.SIGNAL event whose
 * attrs.sigMask carries the port signal — we update the display and
 * re-arm the request. Clicking Quit or the close gadget aborts the
 * pending timer, waits for it to come back, then disposes.
 *
 * Demonstrates:
 *   - Window.events({ extraSignals }) merging non-Intuition signals
 *     into the same Wait loop — no separate polling thread, no
 *     IDCMP_INTUITICKS 10Hz overhead
 *   - timer.device with SendIO + AbortIO + WaitIO lifecycle
 *
 * Requires quickjs.library 0.169+.
 * Run: qjs examples/reaction_clock_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;

/* timer.device constants (same as clock_demo.js) */
const UNIT_VBLANK   = 1;
const TR_ADDREQUEST = 9;
const IOERR_ABORTED = -2;

/* ---- UI ---- */

let clockDisplay = new StringGadget({
  text: '--:--:--', readOnly: true, maxChars: 16, minVisible: 12,
});

let quitBtn = new Button({ id: 99, text: '_Quit' });

let win = new Window({
  title:       'Reaction Clock',
  innerWidth:  260,
  innerHeight: 90,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [ clockDisplay, quitBtn ],
  }),
});

/* ---- timer.device setup ---- */

let Exec = amiga.Exec;

let portPtr = Exec.CreateMsgPort();
if (!portPtr) { print('CreateMsgPort failed'); std.exit(1); }
let port = new MsgPort(portPtr);

let tr = new TimerRequest();
tr.replyPort  = portPtr;
tr.messageLen = TimerRequest.SIZE;

let rc = Exec.OpenDevice('timer.device', UNIT_VBLANK, tr, 0);
if (rc !== 0) {
  print('OpenDevice(timer.device, UNIT_VBLANK) rc=' + rc);
  Exec.DeleteMsgPort(portPtr);
  tr.free();
  std.exit(1);
}

/* The port's signal mask feeds into events({extraSignals}). */
const timerSigMask = port.sigMask >>> 0;

function armTimer(seconds) {
  tr.command  = TR_ADDREQUEST;
  tr.secs     = seconds | 0;
  tr.micros   = 0;
  Exec.SendIO(tr);
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

/* Elapsed-time counter rather than wall-clock. Date.now() / new Date()
 * on Amiga currently read a broken time source — returns microseconds
 * since some local baseline, NOT Unix epoch ms — so wall-clock display
 * appears frozen at ~00:00:00 even though the timer.device IS firing
 * (tracked as T-run-due-timers-lvo phase (a) in the project backlog).
 * Counting our own ticks bypasses Date entirely and exercises the
 * extraSignals + timer.device pipeline cleanly. */
let elapsedSeconds = 0;

function fmtElapsed(s) {
  let h = (s / 3600) | 0;
  let m = ((s % 3600) / 60) | 0;
  let r = s % 60;
  return pad2(h) + ':' + pad2(m) + ':' + pad2(r);
}

function refresh() {
  clockDisplay.text = fmtElapsed(elapsedSeconds);
}

/* ---- Run ---- */

refresh();
win.open();
armTimer(1);
print('Reaction clock running. Close gadget or Quit button to exit.');

let done = false;
try {
  for (let e of win.events({ extraSignals: timerSigMask })) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === 99) {
      done = true;
      break;
    }
    if (e.kind === EventKind.SIGNAL && (e.attrs.sigMask & timerSigMask)) {
      /* Reply-reap the completed timer message, advance the counter,
       * redraw, and re-arm for the next 1s. */
      Exec.GetMsg(portPtr);
      elapsedSeconds++;
      refresh();
      armTimer(1);
    }
  }
}
finally {
  /* Abort the pending timer cleanly. AbortIO returns 0 if the request
   * was aborted, -1 if it completed before we got there. Either way
   * we WaitIO to collect the reply. */
  Exec.AbortIO(tr);
  Exec.WaitIO(tr);
  Exec.CloseDevice(tr);
  Exec.DeleteMsgPort(portPtr);
  tr.free();
  win.dispose();
}

print('Bye.');
