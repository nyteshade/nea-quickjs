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
 *   - opens on the default public screen (normally Workbench)
 *   - timer.device is present (it is in every Kickstart ROM)
 *   - ticks come from the vertical-blank unit, so each is accurate to
 *     about a fiftieth (PAL) or sixtieth (NTSC) of a second
 *   - the window draws its text in the screen's font, which is what a
 *     window gets unless it asks for another. The window is sized from
 *     that font before it opens (see part 1)
 *   - pen 0 is the window background and pen 1 is visible against it
 *   - a timer request that has come back does not need ReplyMsg
 *   - a request must never be sent while it is still out. Doing so
 *     damages timer.device's queue and locks up the whole machine,
 *     which is why this file keeps two requests and tracks whether
 *     the tick is out (see part 2)
 *
 * Requires quickjs.library 0.218+.
 * Run: qjs examples/clock_demo.js
 */

import * as std from 'qjs:std';

/* WA_InnerWidth arrived in 0.217, with the window titles this file
 * relies on, so its presence is the test for a new enough library. */
if (typeof TimerRequest !== 'function' || typeof Exec !== 'function' ||
    typeof amiga.ScreenFont !== 'function' ||
    !('WA_InnerWidth' in Intuition.consts) ||
    TimerRequest.consts === undefined) {
  print('Need quickjs.library 0.218 or later');
  std.exit(1);
}

const C = Intuition.consts;

/** timer.device's units and commands, by name (devices/timer.h):
 *
 *   T.UNIT_VBLANK    the unit driven by the display's vertical blank,
 *                    50 Hz (PAL) or 60 Hz (NTSC): plenty for one-second
 *                    ticks
 *   T.TR_ADDREQUEST  "reply to me after this long"
 *   T.TR_GETSYSTIME  "what time is it?" */
const T = TimerRequest.consts;

/** Ctrl-C in the Shell this was started from sends this signal. The
 *  loop listens for it, so the script can be stopped even if its
 *  window cannot be reached. */
const breakSignal = Number(Exec.consts.SIGBREAKF_CTRL_C);

/** How often the clock ticks, in seconds. */
const TICK_SECONDS = 1;

/** Pens: the window background, and the text. */
const BACKGROUND_PEN = 0;
const TEXT_PEN       = 1;

/** The two pieces of text. The time is appended to the first. */
const TIME_LABEL = 'Elapsed since start: ';
const HINT_TEXT  = 'Close to exit.';

/** The widest the time can be, for measuring. */
const WIDEST_TIME = '00:00:00';


/* ==================================================================
 * 1. SETTING UP
 *
 * The window first, then a message port for the timer to reply to,
 * then the timer request itself. Each step undoes the ones before it
 * if it fails.
 *
 * Nothing about the window's size is a fixed number of pixels. The
 * user chooses the screen font, and it may be 8 pixels high or 24, so
 * the size is worked out from the font: wide enough for the longest
 * line, tall enough for two lines, with a margin all round.
 * ================================================================== */

const { ScreenFont } = amiga;

/* ScreenFont locks the screen and reads its font, so text can be
 * measured before any window exists. */
let screenFont = new ScreenFont();

/** One line of text, in pixels. Every distance below is a fraction
 *  of it. */
const LINE = screenFont.height;

/** Space between the text and the window's borders. across() turns a
 *  vertical distance into the horizontal one that looks the same, for
 *  screens whose pixels are not square. */
const MARGIN_DOWN   = Math.round(LINE / 2);
const MARGIN_ACROSS = screenFont.across(MARGIN_DOWN);

/** Space between the two lines. */
const LINE_GAP = Math.round(LINE / 4);

/** The inside of the window: the area within its borders. */
const INNER_WIDTH = 2 * MARGIN_ACROSS + Math.max(
  screenFont.widthOf(TIME_LABEL + WIDEST_TIME),
  screenFont.widthOf(HINT_TEXT));

const INNER_HEIGHT = 2 * MARGIN_DOWN + 2 * LINE + LINE_GAP;

/* WA_InnerWidth and WA_InnerHeight give the size inside the borders;
 * Intuition adds the title bar and borders, which also depend on the
 * font. */
let window = Intuition.OpenWindowTags([
  [C.WA_Left,        60],
  [C.WA_Top,         60],
  [C.WA_InnerWidth,  INNER_WIDTH],
  [C.WA_InnerHeight, INNER_HEIGHT],
  [C.WA_Title,       'Clock - close to exit'],
  [C.WA_Flags,       C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                   | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,       C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
]);

/* The window keeps the screen open from here on, so the lock that
 * ScreenFont holds can go. LINE and the margins stay usable. */
screenFont.close();

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

let rastPort = window.rastPort;

/* Where things go, in pixels from the window's top left corner. The
 * borders are measured from the open window, because (0, 0) is the
 * corner of the window frame, not of the area inside it.
 *
 * text() puts the BASELINE of the text at the y it is given, so the
 * first baseline is the top of the first line plus the font's
 * baseline. */
const FACE_LEFT   = window.borderLeft;
const FACE_TOP    = window.borderTop;
const FACE_RIGHT  = window.width  - window.borderRight  - 1;
const FACE_BOTTOM = window.height - window.borderBottom - 1;

const TEXT_LEFT     = FACE_LEFT + MARGIN_ACROSS;
const TIME_BASELINE = FACE_TOP + MARGIN_DOWN + rastPort.fontBaseline;
const HINT_BASELINE = TIME_BASELINE + rastPort.fontHeight + LINE_GAP;

let timerPort = new MsgPort(Exec.CreateMsgPort());

if (!timerPort.ptr) {
  print('CreateMsgPort failed');
  window.close();
  std.exit(1);
}

/* Two requests, one for each job, because a request can only be in
 * one place at a time:
 *
 *   tickRequest   sent off for a second at a time, and so usually out
 *   clockRequest  asks "what time is it?" and is answered at once
 *
 * OpenDevice fills in the first. The second is pointed at the same
 * open device by copying the device and unit across, which is the
 * usual way to get an extra request. */
let tickRequest = new TimerRequest();
tickRequest.replyPort  = timerPort.ptr;
tickRequest.messageLen = TimerRequest.SIZE;

let openError = Exec.OpenDevice('timer.device', T.UNIT_VBLANK, tickRequest, 0);

if (openError !== 0) {
  print('OpenDevice(timer.device, UNIT_VBLANK) failed rc=' + openError);
  Exec.DeleteMsgPort(timerPort);
  tickRequest.free();
  window.close();
  std.exit(1);
}

let clockRequest = new TimerRequest();
clockRequest.replyPort  = timerPort.ptr;
clockRequest.messageLen = TimerRequest.SIZE;
clockRequest.device     = tickRequest.device;
clockRequest.unit       = tickRequest.unit;

/* Each port wakes the script with its own signal bit. Waiting on all
 * of the bits together is what lets one loop serve the window, the
 * timer and Ctrl-C. */
const windowSignal = window.userPort.sigMask;
const timerSignal  = timerPort.sigMask;
const anySignal    = windowSignal | timerSignal | breakSignal;


/* ==================================================================
 * 2. THE TIMER
 * ================================================================== */

/** True from the moment the tick request is sent until it has been
 *  taken back off the port. While it is true the request belongs to
 *  timer.device and must not be touched. */
let tickIsOut = false;

/**
 * Ask for the next tick. SendIO returns at once; the request comes
 * back to timerPort when the time is up, or when it is aborted.
 *
 * @returns {undefined}
 */
function scheduleTick() {
  if (tickIsOut) return;

  tickRequest.command = T.TR_ADDREQUEST;
  tickRequest.setTimeval(TICK_SECONDS, 0);
  Exec.SendIO(tickRequest);
  tickIsOut = true;
}

/**
 * Read the system time. DoIO waits for the answer, which for this
 * command comes straight away.
 *
 * @returns {{secs: number, micro: number}} seconds and microseconds
 */
function readSystemTime() {
  clockRequest.command = T.TR_GETSYSTIME;
  clockRequest.setTimeval(0, 0);
  Exec.DoIO(clockRequest);

  return { secs: clockRequest.tvSecs, micro: clockRequest.tvMicro };
}

/**
 * Take whatever has come back off the timer port, and say whether the
 * tick was among it.
 *
 * The answer matters. A signal only says "look at the port"; it can
 * be left over from earlier, with nothing new behind it. Sending the
 * tick again on the strength of the signal alone would send a request
 * that is still out.
 *
 * timer.device hands back the same request that was sent, so there is
 * nothing to reply to.
 *
 * @returns {boolean} true if the tick request has come back
 */
function collectTick() {
  let messagePtr;

  while ((messagePtr = Exec.GetMsg(timerPort)) !== 0) {
    if ((messagePtr >>> 0) === (tickRequest.ptr >>> 0)) tickIsOut = false;
  }

  return !tickIsOut;
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
  rastPort.rectFill(FACE_LEFT, FACE_TOP, FACE_RIGHT, FACE_BOTTOM);

  rastPort.setColor(TEXT_PEN);
  rastPort.text(TEXT_LEFT, TIME_BASELINE, TIME_LABEL + elapsed);
  rastPort.text(TEXT_LEFT, HINT_BASELINE, HINT_TEXT);
}


/* ==================================================================
 * 4. THE LOOP
 *
 * window.messages() cannot be used here, because it does its own Wait
 * on the window's signal alone and would sleep through the timer. So
 * the loop calls Exec.Wait itself, on all the signals, and then empties
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
    let messageClass = message.class;

    /* Reply first: after ReplyMsg the message belongs to Intuition
     * again, which is why its class was copied out above. */
    Exec.ReplyMsg(message);

    switch (messageClass) {
      case C.IDCMP_CLOSEWINDOW:
        closing = true;
        break;

      case C.IDCMP_REFRESHWINDOW:
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
    let signals = Exec.Wait(anySignal);

    if (signals & breakSignal) running = false;

    if ((signals & timerSignal) && collectTick()) {
      redraw();
      scheduleTick();
    }

    if (signals & windowSignal) {
      if (drainWindowPort()) running = false;
    }
  }
}
finally {
  /* If the tick is still out, abort it and wait for it to come back
   * before closing the device; otherwise timer.device could later
   * return it to a port that no longer exists. If it is not out,
   * leave it alone: WaitIO on a request already taken off the port
   * would unlink it a second time. */
  if (tickIsOut) {
    Exec.AbortIO(tickRequest);
    Exec.WaitIO(tickRequest);
  }

  Exec.CloseDevice(tickRequest);
  Exec.DeleteMsgPort(timerPort);
  clockRequest.free();
  tickRequest.free();
  window.close();
}

print('Clean exit.');
