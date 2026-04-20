/*
 * mouse_tracker.js — Open a window and draw wherever the mouse moves
 * while the left button is held down. Release to lift the pen. Close
 * gadget exits. Shows IDCMP_MOUSEMOVE + IDCMP_MOUSEBUTTONS working
 * together through the Window.messages() iterator.
 *
 * Demonstrates:
 *   - IDCMP_MOUSEBUTTONS with msg.code: SELECTDOWN (0x68) and
 *     SELECTUP (0xE8) distinguished by the low/high bit
 *   - IDCMP_MOUSEMOVE with msg.mouseX/mouseY giving window-relative
 *     pointer coordinates
 *   - WFLG_REPORTMOUSE — without this, MOUSEMOVE events only arrive
 *     between button presses, not continuously
 *   - Per-stroke color cycling so successive drags are visually
 *     distinct (pen 1, 2, 3, then wrap)
 *
 * Run:        qjs examples/mouse_tracker.js
 * Requires:   quickjs.library 0.130+
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.130+');
  std.exit(1);
}

const C = Intuition.consts;

/* Mouse-button IDCMP codes from intuition/intuition.h. Low-order bit
 * distinguishes down (0) vs up (1). We only care about the SELECT
 * (left) button — MENU (right) brings up the screen menu anyway. */
const SELECTDOWN = 0x68;
const SELECTUP   = 0xE8;

let win = Intuition.OpenWindowTags([
  [C.WA_Left,   40],
  [C.WA_Top,    40],
  [C.WA_Width,  400],
  [C.WA_Height, 240],
  [C.WA_Title,  'Drag to draw — click close to exit'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE
              | C.WFLG_REPORTMOUSE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MOUSEBUTTONS
              | C.IDCMP_MOUSEMOVE],
]);

if (!win) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Hold the left button and drag. Close gadget to exit.');

let rp = win.rastPort;
let drawing = false;
let stroke = 0;
let lastX = 0;
let lastY = 0;

/**
 * Start a new stroke at (x, y). Advances the stroke counter so a
 * fresh pen color is picked on the next `drawTo`.
 *
 * @param {number} x
 * @param {number} y
 * @returns {undefined}
 */
function beginStroke(x, y) {
  stroke = (stroke + 1) % 3;
  rp.setColor(1 + stroke);  /* pens 1..3 */
  rp.move(x, y);
  lastX = x;
  lastY = y;
  drawing = true;
}

/**
 * Continue the current stroke to (x, y). No-op when not drawing.
 *
 * @param {number} x
 * @param {number} y
 * @returns {undefined}
 */
function drawTo(x, y) {
  if (!drawing) return;

  /* MOUSEMOVE events can arrive faster than we draw; connect them
   * with straight segments so rapid drags produce continuous lines. */
  rp.move(lastX, lastY);
  rp.draw(x, y);
  lastX = x;
  lastY = y;
}

/**
 * End the current stroke.
 *
 * @returns {undefined}
 */
function endStroke() {
  drawing = false;
}

try {
  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) {
      break;
    }

    if (msg.class === C.IDCMP_MOUSEBUTTONS) {
      if (msg.code === SELECTDOWN) {
        beginStroke(msg.mouseX, msg.mouseY);
      }

      else if (msg.code === SELECTUP) {
        endStroke();
      }
    }

    else if (msg.class === C.IDCMP_MOUSEMOVE) {
      drawTo(msg.mouseX, msg.mouseY);
    }
  }
}

finally {
  win.close();
}

print('Clean exit.');
