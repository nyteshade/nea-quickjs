/*
 * reaction_clock_demo.js - a seconds counter driven by timer.device.
 *
 *   +--------------------------+
 *   | 00:01:27                 |   time since the demo started
 *   | [         Quit         ] |
 *   +--------------------------+
 *
 * The display counts up once a second for as long as the window is
 * open, whether or not it is the active window. Quit or the close
 * gadget ends it.
 *
 * What it shows: a window's event loop can wait for other things as
 * well as the window. The timer's reply port has a signal; passing
 * that signal to window.events({ extraSignals }) makes the same loop
 * wake for it and hand over an EventKind.SIGNAL event. No polling, and
 * none of the ten-a-second traffic of IDCMP_INTUITICKS.
 *
 * The file has four parts, read top to bottom:
 *
 *   1. THE COUNT  - seconds into HH:MM:SS. Plain JavaScript.
 *   2. THE WINDOW - a display and a Quit button.
 *   3. THE TIMER  - a timer.device request that can be sent off
 *                   again and again.
 *   4. THE LOOP   - timer signals and clicks in, display redrawn.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 260 x 90 pixels inside
 *   - window.class, layout.gadget, button.gadget and string.gadget are
 *     installed in SYS:Classes, as they are on AmigaOS 3.2
 *   - timer.device unit UNIT_VBLANK is used: it counts in vertical
 *     blanks, so it is no finer than 1/50 or 1/60 of a second
 *   - the display counts timer replies, not the time of day. Each
 *     reply sets the timer going again, so the count falls behind real
 *     time by however long the script took to notice
 *   - Date is avoided on purpose. When this was written, Date.now()
 *     and new Date() on the Amiga read a broken time source that gave
 *     microseconds since some local baseline rather than milliseconds
 *     since 1970, so a wall-clock display looked stuck near 00:00:00
 *     even while the timer was firing (project task
 *     T-run-due-timers-lvo, phase a)
 *   - MsgPort and TimerRequest are global struct wrappers supplied by
 *     quickjs.library
 *   - the display is a read-only string gadget because a Label keeps
 *     the text it was created with
 *
 * If the message port cannot be created or timer.device cannot be
 * opened, the script says so and exits with return code 1.
 *
 * Requires quickjs.library 0.215+.
 * Run: qjs examples/reaction_clock_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;


/* ==================================================================
 * 1. THE COUNT
 * ================================================================== */

/** How often the display moves on, in seconds. */
const TICK_SECONDS = 1;

/**
 * A number as at least two digits.
 *
 * @param {number} value - a whole number, 0 or more
 * @returns {string}
 */
function twoDigits(value) {
  return (value < 10 ? '0' : '') + value;
}

/**
 * Format a number of seconds as HH:MM:SS.
 *
 * @param {number} seconds - whole seconds, 0 or more
 * @returns {string}
 */
function formatElapsed(seconds) {
  let hours   = (seconds / 3600) | 0;
  let minutes = ((seconds % 3600) / 60) | 0;
  let rest    = seconds % 60;

  return twoDigits(hours) + ':' + twoDigits(minutes) + ':' +
         twoDigits(rest);
}


/* ==================================================================
 * 2. THE WINDOW
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { QUIT: 99 };

/* A read-only string gadget, not a Label: its text can be changed
 * while the window is open. */
let clockDisplay = new StringGadget({
  text: '--:--:--', readOnly: true, maxChars: 16, minVisible: 12,
});

let window = new Window({
  title:       'Reaction Clock',
  innerWidth:  260,
  innerHeight: 90,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,

  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [
      clockDisplay,
      new Button({ id: ID.QUIT, text: '_Quit' }),
    ],
  }),
});


/* ==================================================================
 * 3. THE TIMER
 *
 * timer.device is asked to reply to a message port after a delay.
 * The reply raises the port's signal, which is what the loop waits
 * for. The same request is then sent again for the next second.
 * ================================================================== */

/** timer.device unit that counts in vertical blanks.
 *  (devices/timer.h) */
const UNIT_VBLANK = 1;

/** timer.device command: reply after the given delay.
 *  (devices/timer.h; CMD_NONSTD in exec/io.h) */
const TR_ADDREQUEST = 9;

let Exec = amiga.Exec;

let portPointer = Exec.CreateMsgPort();
if (!portPointer) { print('CreateMsgPort failed'); std.exit(1); }
let port = new MsgPort(portPointer);

let timerRequest = new TimerRequest();
timerRequest.replyPort  = portPointer;
timerRequest.messageLen = TimerRequest.SIZE;

let openError = Exec.OpenDevice('timer.device', UNIT_VBLANK,
                                timerRequest, 0);
if (openError !== 0) {
  print('OpenDevice(timer.device, UNIT_VBLANK) rc=' + openError);
  Exec.DeleteMsgPort(portPointer);
  timerRequest.free();
  std.exit(1);
}

/** The reply port's signal, as a mask: what the event loop is asked to
 *  wait for alongside the window. */
const timerSignal = port.sigMask >>> 0;

/** True from when the request is sent until it is taken back off the
 *  port. While true, the request belongs to timer.device. */
let timerIsOut = false;

/**
 * Send the timer request off. Its reply arrives on the port when the
 * delay is over.
 *
 * @param {number} seconds - how long to wait
 * @returns {undefined}
 */
function armTimer(seconds) {
  if (timerIsOut) return;

  timerRequest.command = TR_ADDREQUEST;
  timerRequest.setTimeval(seconds | 0, 0);
  Exec.SendIO(timerRequest);
  timerIsOut = true;
}

/**
 * Take the finished request off the port, if it is there.
 *
 * A signal only says "look at the port"; it can be left over with
 * nothing behind it. Only a request that has really come back may be
 * sent again: sending one that is still out damages timer.device's
 * queue and locks up the machine.
 *
 * @returns {boolean} true if the request came back
 */
function collectTimer() {
  let messagePtr;

  while ((messagePtr = Exec.GetMsg(portPointer)) !== 0) {
    if ((messagePtr >>> 0) === (timerRequest.ptr >>> 0)) timerIsOut = false;
  }

  return !timerIsOut;
}


/* ==================================================================
 * 4. THE LOOP
 *
 * Wait for the window or the timer. Each timer reply is one more
 * second on the count.
 * ================================================================== */

/** Seconds counted since the demo started: one for each timer reply.
 *  Counting replies rather than reading the date keeps Date out of it
 *  (see Assumptions). */
let elapsedSeconds = 0;

/**
 * Make the display match the count.
 *
 * @returns {undefined}
 */
function render() {
  clockDisplay.text = formatElapsed(elapsedSeconds);
}

render();
window.open();
armTimer(TICK_SECONDS);
print('Reaction clock running. Close gadget or Quit button to exit.');

try {
  for (let event of window.events({ extraSignals: timerSignal })) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    if (event.kind === EventKind.SIGNAL &&
        (event.attrs.sigMask & timerSignal) &&
        collectTimer()) {
      /* The request is back: count it, show the new time, and set the
       * timer going for the next second. */
      elapsedSeconds++;
      render();
      armTimer(TICK_SECONDS);
    }
  }
}
finally {
  /* If the request is still out, stop it and wait for it to come back
   * before the device closes. If it is not out, leave it alone. */
  if (timerIsOut) {
    Exec.AbortIO(timerRequest);
    Exec.WaitIO(timerRequest);
  }

  Exec.CloseDevice(timerRequest);
  Exec.DeleteMsgPort(portPointer);
  timerRequest.free();
  window.dispose();
}

print('Bye.');
