/*
 * clock_demo.js - a window that counts the seconds since it opened.
 *
 *   +--------------------------------------+
 *   | Clock - close to exit                |
 *   +--------------------------------------+
 *   | Elapsed since start: 00:01:07        |
 *   | Close to exit.                       |
 *   +--------------------------------------+
 *
 * The time ticks over once a second for as long as the window is open.
 * The point of the example is how: the script sleeps on two things at
 * once, the window's messages and a timer.device request, and wakes
 * for whichever arrives first. Close the window to quit.
 *
 * The file has four parts:
 *
 *   1. SETTING UP  - the window, the message port, the timer.
 *   2. THE TIMER   - asking for a tick, and reading the time.
 *   3. THE FACE    - drawing the elapsed time.
 *   4. THE LOOP    - wait for either signal, deal with it, repeat.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), which is at
 *     least 360 x 140 pixels
 *   - timer.device is present (it is in every Kickstart ROM)
 *   - ticks come from the vertical-blank unit, so each is accurate to
 *     about a fiftieth (PAL) or sixtieth (NTSC) of a second
 *   - the screen font is about 8 pixels high: the two lines of text
 *     are drawn at fixed positions
 *   - pen 0 is the window background and pen 1 is visible against it
 *   - a timer request that has come back does not need ReplyMsg
 *
 * Requires quickjs.library 0.213+.
 * Run: qjs examples/clock_demo.js
 */

import * as std from 'qjs:std';

if (typeof TimerRequest !== 'function' || typeof Exec !== 'function') {
  print('Q2 wrappers unavailable - need quickjs.library 0.134+');
  std.exit(1);
}

const C = Intuition.consts;

/** Which timer.device unit to open: the one driven by the display's
 *  vertical blank, 50 Hz (PAL) or 60 Hz (NTSC), which is plenty for
 *  one-second ticks (devices/timer.h). */
const UNIT_VBLANK = 1;

/** timer.device command: "reply to me after this long"
 *  (devices/timer.h, TR_ADDREQUEST = CMD_NONSTD = 9). */
const TR_ADDREQUEST = 9;

/** timer.device command that reads the system time into the request
 *  (devices/timer.h, TR_GETSYSTIME = CMD_NONSTD + 1 = 10). Take care
 *  with this number: 11 is TR_SETSYSTIME, which sets the clock. */
const TR_GETSYSTIME = 10;

/* IDCMP class bits, as plain numbers (intuition/intuition.h). The
 * loop reads a message's class as a raw number, and the entries of
 * Intuition.consts are enumeration objects that are only equal to
 * themselves, so the raw number has to be compared with a number. */
const IDCMP_REFRESHWINDOW_BITS = 0x00000004;
const IDCMP_CLOSEWINDOW_BITS   = 0x00000200;

/** How often the clock ticks, in seconds. */
const TICK_SECONDS = 1;

/** Pens: the window background, and the text. */
const BACKGROUND_PEN = 0;
const TEXT_PEN       = 1;

/** The area wiped before each redraw: this far in from the window's
 *  left, right and bottom edges, and starting this far down, below the
 *  title bar. In pixels. */
const FACE_MARGIN = 4;
const FACE_TOP    = 20;

/** Where the two lines of text go, in pixels from the window's top
 *  left corner. */
const TEXT_LEFT     = 12;
const TIME_BASELINE = 40;
const HINT_BASELINE = 60;


/* ==================================================================
 * 1. SETTING UP
 *
 * The window first, then a message port for the timer to reply to,
 * then the timer request itself. Each step undoes the ones before it
 * if it fails.
 * ================================================================== */

let window = Intuition.OpenWindowTags([
  [C.WA_Left,   60],
  [C.WA_Top,    60],
  [C.WA_Width,  300],
  [C.WA_Height, 80],
  [C.WA_Title,  'Clock - close to exit'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
]);

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

let rastPort = window.rastPort;

let timerPort = new MsgPort(Exec.CreateMsgPort());

if (!timerPort.ptr) {
  print('CreateMsgPort failed');
  window.close();
  std.exit(1);
}

let timerRequest = new TimerRequest();
timerRequest.replyPort  = timerPort.ptr;
timerRequest.messageLen = TimerRequest.SIZE;

let openError = Exec.OpenDevice('timer.device', UNIT_VBLANK, timerRequest, 0);

if (openError !== 0) {
  print('OpenDevice(timer.device, UNIT_VBLANK) failed rc=' + openError);
  Exec.DeleteMsgPort(timerPort);
  timerRequest.free();
  window.close();
  std.exit(1);
}

/* Each port wakes the script with its own signal bit. Waiting on both
 * bits together is what lets one loop serve the window and the
 * timer. */
const windowSignal = window.userPort.sigMask;
const timerSignal  = timerPort.sigMask;
const eitherSignal = windowSignal | timerSignal;


/* ==================================================================
 * 2. THE TIMER
 * ================================================================== */

/**
 * Ask for the next tick. SendIO returns at once; the request comes
 * back to timerPort when the time is up, or when it is aborted.
 *
 * @returns {undefined}
 */
function scheduleTick() {
  timerRequest.command = TR_ADDREQUEST;
  timerRequest.setTimeval(TICK_SECONDS, 0);
  Exec.SendIO(timerRequest);
}

/**
 * Read the system time. DoIO waits for the answer.
 *
 * @returns {{secs: number, micro: number}} seconds and microseconds
 */
function readSystemTime() {
  timerRequest.command = TR_GETSYSTIME;
  timerRequest.setTimeval(0, 0);
  Exec.DoIO(timerRequest);

  return { secs: timerRequest.tvSecs, micro: timerRequest.tvMicro };
}

/**
 * Take every returned request off the timer port. timer.device hands
 * back the same request that was sent, so there is nothing to reply
 * to; the request is simply ready to be sent again.
 *
 * @returns {undefined}
 */
function drainTimerPort() {
  while (Exec.GetMsg(timerPort) !== 0) {
    /* nothing to do with it */
  }
}


/* ==================================================================
 * 3. THE FACE
 * ================================================================== */

/** The time when the script started. Everything shown is measured
 *  from here. */
const startTime = readSystemTime();

/** The text last drawn, so that redraw() can skip a tick that changes
 *  nothing. null forces the next redraw. */
let lastDrawn = null;

/**
 * Format a number of seconds as HH:MM:SS. Hours wrap at 24.
 *
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatHMS(totalSeconds) {
  let seconds = totalSeconds % 60;
  let minutes = Math.floor(totalSeconds / 60) % 60;
  let hours   = Math.floor(totalSeconds / 3600) % 24;

  return String(hours).padStart(2, '0') + ':' +
         String(minutes).padStart(2, '0') + ':' +
         String(seconds).padStart(2, '0');
}

/**
 * Draw the elapsed time, if it differs from what is already showing.
 * Wiping the old text with the background pen first is what stops the
 * new digits from piling up on top of the old ones.
 *
 * @returns {undefined}
 */
function redraw() {
  let now     = readSystemTime();
  let elapsed = formatHMS(now.secs - startTime.secs);

  if (elapsed === lastDrawn) return;
  lastDrawn = elapsed;

  rastPort.setColor(BACKGROUND_PEN);
  rastPort.rectFill(FACE_MARGIN, FACE_TOP,
                    window.width - FACE_MARGIN, window.height - FACE_MARGIN);

  rastPort.setColor(TEXT_PEN);
  rastPort.text(TEXT_LEFT, TIME_BASELINE, 'Elapsed since start: ' + elapsed);
  rastPort.text(TEXT_LEFT, HINT_BASELINE, 'Close to exit.');
}


/* ==================================================================
 * 4. THE LOOP
 *
 * window.messages() cannot be used here, because it does its own Wait
 * on the window's signal alone and would sleep through the timer. So
 * the loop calls Exec.Wait itself, on both signals, and then empties
 * whichever port woke it.
 * ================================================================== */

/**
 * Take every message off the window's port and act on each.
 *
 * @returns {boolean} true if the close gadget was among them
 */
function drainWindowPort() {
  let closing = false;
  let messagePtr;

  while ((messagePtr = Exec.GetMsg(window.userPort)) !== 0) {
    let message      = new IntuiMessage(messagePtr);
    let messageClass = message.classRaw;

    /* Reply first: after ReplyMsg the message belongs to Intuition
     * again, which is why its class was copied out above. */
    Exec.ReplyMsg(message);

    switch (messageClass) {
      case IDCMP_CLOSEWINDOW_BITS:
        closing = true;
        break;

      case IDCMP_REFRESHWINDOW_BITS:
        Intuition.BeginRefresh(window);
        lastDrawn = null;
        redraw();
        Intuition.EndRefresh(window, true);
        break;
    }
  }

  return closing;
}

redraw();
scheduleTick();

let running = true;

try {
  while (running) {
    let signals = Exec.Wait(eitherSignal);

    if (signals & timerSignal) {
      drainTimerPort();
      redraw();
      scheduleTick();
    }

    if (signals & windowSignal) {
      if (drainWindowPort()) running = false;
    }
  }
}
finally {
  /* A tick is always outstanding here. Abort it and wait for it to
   * come back before closing the device; otherwise timer.device could
   * later return it to a port that no longer exists. */
  Exec.AbortIO(timerRequest);
  Exec.WaitIO(timerRequest);
  Exec.CloseDevice(timerRequest);
  Exec.DeleteMsgPort(timerPort);
  timerRequest.free();
  window.close();
}

print('Clean exit.');
