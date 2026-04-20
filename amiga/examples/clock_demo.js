/*
 * clock_demo.js — Live digital clock in a window, updated every
 * second via timer.device. Press the close gadget to exit.
 *
 * Demonstrates:
 *   - timer.device with TR_ADDREQUEST in ASYNCHRONOUS mode (SendIO
 *     instead of DoIO), so we can Wait on both the window's IDCMP
 *     signal AND the timer's signal at the same time
 *   - Exec.Wait on a combined signal mask and using the return value
 *     to distinguish which signal fired
 *   - MsgPort wrapper's sigMask / sigBit getters alongside a raw
 *     timer port built from AllocSignal
 *   - Clean abort-on-close: AbortIO any pending timer request, then
 *     WaitIO to reclaim the message before closing the device
 *   - Redrawing text on every tick without flicker: clear the old
 *     text rect with rp.rectFill(pen=0), then draw the new digits
 *
 * Run:        qjs examples/clock_demo.js
 * Requires:   quickjs.library 0.134+ (TimerRequest wrapper)
 */

import * as std from 'qjs:std';

if (typeof TimerRequest !== 'function' || typeof Exec !== 'function') {
  print('Q2 wrappers unavailable — need quickjs.library 0.134+');
  std.exit(1);
}

const C = Intuition.consts;

/* timer.device constants. */
const UNIT_VBLANK    = 1;   /* 50Hz (PAL) / 60Hz (NTSC) — fine for 1s ticks */
const TR_ADDREQUEST  = 9;
const TR_GETSYSTIME  = 11;
const IOERR_ABORTED  = -2;

let win = Intuition.OpenWindowTags([
  [C.WA_Left,   60],
  [C.WA_Top,    60],
  [C.WA_Width,  300],
  [C.WA_Height, 80],
  [C.WA_Title,  'Clock — close to exit'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
]);

if (!win) {
  print('OpenWindowTags failed');
  std.exit(1);
}

let rp = win.rastPort;

let port = new MsgPort(Exec.CreateMsgPort());

if (!port.ptr) {
  print('CreateMsgPort failed');
  win.close();
  std.exit(1);
}

let tr = new TimerRequest();
tr.replyPort  = port.ptr;
tr.messageLen = TimerRequest.SIZE;

let rc = Exec.OpenDevice('timer.device', UNIT_VBLANK, tr, 0);

if (rc !== 0) {
  print('OpenDevice(timer.device, UNIT_VBLANK) failed rc=' + rc);
  Exec.DeleteMsgPort(port);
  tr.free();
  win.close();
  std.exit(1);
}

const winSig   = win.userPort.sigMask;
const timerSig = port.sigMask;
const sigMask  = winSig | timerSig;

/**
 * Format a running clock offset in seconds back to HH:MM:SS using
 * the initial system-time sample as the baseline. We use
 * TR_GETSYSTIME so we don't need dos.library DateStamp.
 *
 * @param {number} secs
 * @returns {string}
 */
function formatHMS(secs) {
  let s = secs % 60;
  let m = Math.floor(secs / 60) % 60;
  let h = Math.floor(secs / 3600) % 24;

  return String(h).padStart(2, '0') + ':' +
         String(m).padStart(2, '0') + ':' +
         String(s).padStart(2, '0');
}

/**
 * Issue a one-shot TR_ADDREQUEST for one second in the future,
 * asynchronously (SendIO, not DoIO). The message returns to our
 * port when time elapses or when we AbortIO it.
 *
 * @returns {undefined}
 */
function scheduleTick() {
  tr.command = TR_ADDREQUEST;
  tr.setTimeval(1, 0);
  Exec.SendIO(tr);
}

/**
 * Fill a TR_GETSYSTIME to read current system time, blocking.
 *
 * @returns {{secs: number, micro: number}}
 */
function readSysTime() {
  tr.command = TR_GETSYSTIME;
  tr.setTimeval(0, 0);
  Exec.DoIO(tr);
  return { secs: tr.tvSecs, micro: tr.tvMicro };
}

/* Read a baseline so subsequent reads yield relative elapsed seconds. */
const baseline = readSysTime();

let lastRendered = null;

/**
 * Redraw the clock face. Cheap: fill the whole inside with pen 0
 * then draw a single text line with the current time.
 *
 * @returns {undefined}
 */
function redraw() {
  let now = readSysTime();
  let elapsed = now.secs - baseline.secs;
  let hms = formatHMS(elapsed);

  if (hms === lastRendered) return;

  lastRendered = hms;

  rp.setColor(0);
  rp.rectFill(4, 20, win.width - 4, win.height - 4);

  rp.setColor(1);
  rp.text(12, 40, 'Elapsed since start: ' + hms);
  rp.text(12, 60, 'Close to exit.');
}

redraw();
scheduleTick();

let running = true;

try {
  while (running) {
    let got = Exec.Wait(sigMask);

    if (got & timerSig) {
      /* Drain the timer port. */
      let msg;

      while ((msg = Exec.GetMsg(port)) !== 0) {
        /* timer.device doesn't require ReplyMsg on its returns — it
         * reuses the IORequest we sent. Just reissue for next tick. */
      }

      redraw();
      scheduleTick();
    }

    if (got & winSig) {
      /* Drain window IDCMP events. Use a raw GetMsg loop rather than
       * the `for (msg of win.messages())` iterator because that
       * iterator does its own Wait — we're sharing Wait with the
       * timer port. */
      let raw;

      while ((raw = Exec.GetMsg(win.userPort)) !== 0) {
        let m = new IntuiMessage(raw);
        let cls = m.classRaw;

        Exec.ReplyMsg(m);

        if (cls === 0x00000200 /* IDCMP_CLOSEWINDOW */) {
          running = false;
        }

        else if (cls === 0x00000004 /* IDCMP_REFRESHWINDOW */) {
          Intuition.BeginRefresh(win);
          lastRendered = null;  /* force full redraw */
          redraw();
          Intuition.EndRefresh(win, true);
        }
      }
    }
  }
}

finally {
  /* Abort any still-pending timer request, then wait for it to
   * return, THEN close the device. Otherwise timer.device could
   * complete the request into a freed reply port. */
  Exec.AbortIO(tr);
  Exec.WaitIO(tr);
  Exec.CloseDevice(tr);
  Exec.DeleteMsgPort(port);
  tr.free();
  win.close();
}

print('Clean exit.');
