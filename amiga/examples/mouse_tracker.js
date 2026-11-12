/*
 * mouse_tracker.js - draw in a window by dragging the mouse.
 *
 * A 400 x 240 window opens. Hold the left mouse button and drag to
 * draw a line that follows the pointer; let go to lift the pen. Each
 * new stroke is drawn in the next of three colours. Close the window
 * to quit.
 *
 * The file has three parts:
 *
 *   1. THE PEN     - where the pen is, and whether it is down.
 *   2. THE WINDOW  - one that reports every mouse movement.
 *   3. THE LOOP    - button down, move, button up.
 *
 * Assumptions:
 *   - the default public screen (normally Workbench) is open and big
 *     enough for a 400 x 240 window placed at 40, 40
 *   - pens 1, 2 and 3 are visible against the window background
 *   - nothing is remembered: a stroke that gets covered by another
 *     window is not redrawn
 *   - the pointer stays inside the window while drawing; coordinates
 *     to the left of or above the window are not handled specially
 *
 * Requires quickjs.library 0.221+.
 * Run: qjs examples/mouse_tracker.js
 */

import * as std from 'qjs:std';

/* Intuition.consts.SELECTDOWN arrived in 0.221; its presence is the
 * test for a new enough library. */
if (typeof Intuition !== 'function' ||
    !('SELECTDOWN' in Intuition.consts)) {
  print('Need quickjs.library 0.221 or later');
  std.exit(1);
}

/** Intuition's constants: WA_ tags, WFLG_ flags and IDCMP_ classes. */
const C = Intuition.consts;


/* ==================================================================
 * 1. THE PEN
 *
 * A stroke starts where the button goes down and grows by one short
 * straight line for every mouse movement reported after that.
 * ================================================================== */

/** Strokes cycle through this many pens, starting at FIRST_PEN. */
const PEN_COUNT = 3;
const FIRST_PEN = 1;

/** True while the left button is held and a stroke is being drawn. */
let drawing = false;

/** Counts strokes, wrapping at PEN_COUNT; picks the stroke's pen. */
let stroke = 0;

/** Where the current stroke has got to, in window coordinates. */
let lastX = 0;
let lastY = 0;

/**
 * Put the pen down at (x, y) and move on to the next colour.
 *
 * @param {RastPort} rastPort - the window's RastPort
 * @param {number} x - pixels from the window's left edge
 * @param {number} y - pixels from the window's top edge
 * @returns {undefined}
 */
function beginStroke(rastPort, x, y) {
  stroke = (stroke + 1) % PEN_COUNT;

  rastPort.setColor(FIRST_PEN + stroke);
  rastPort.move(x, y);

  lastX = x;
  lastY = y;
  drawing = true;
}

/**
 * Carry the current stroke on to (x, y). Does nothing while the pen
 * is up.
 *
 * @param {RastPort} rastPort - the window's RastPort
 * @param {number} x - pixels from the window's left edge
 * @param {number} y - pixels from the window's top edge
 * @returns {undefined}
 */
function drawTo(rastPort, x, y) {
  if (!drawing) return;

  /* Movements are reported at intervals, not for every pixel, so
   * joining each to the one before keeps a fast drag unbroken. */
  rastPort.move(lastX, lastY);
  rastPort.draw(x, y);

  lastX = x;
  lastY = y;
}

/**
 * Lift the pen.
 *
 * @returns {undefined}
 */
function endStroke() {
  drawing = false;
}


/* ==================================================================
 * 2. THE WINDOW
 * ================================================================== */

let window = Intuition.OpenWindowTags([
  [C.WA_Left,   40],
  [C.WA_Top,    40],
  [C.WA_Width,  400],
  [C.WA_Height, 240],
  [C.WA_Title,  'Drag to draw - click close to exit'],

  /* WFLG_REPORTMOUSE asks Intuition to tell this window about every
   * pointer movement while it is the active window. */
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE
              | C.WFLG_REPORTMOUSE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MOUSEBUTTONS
              | C.IDCMP_MOUSEMOVE],
]);

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Hold the left button and drag. Close gadget to exit.');


/* ==================================================================
 * 3. THE LOOP
 * ================================================================== */

/** What `message.code` holds for an IDCMP_MOUSEBUTTONS message about
 *  the left button: SELECTDOWN and SELECTUP from intuition/intuition.h
 *  (IECODE_LBUTTON, and the same with IECODE_UP_PREFIX set). The right
 *  button is not listed: it brings up the screen's menus instead. */
const SELECTDOWN = Number(Intuition.consts.SELECTDOWN);
const SELECTUP   = Number(Intuition.consts.SELECTUP);

let rastPort = window.rastPort;

try {
  for (let message of window.messages()) {

    if (message.class === C.IDCMP_CLOSEWINDOW) break;

    switch (message.class) {

      case C.IDCMP_MOUSEBUTTONS:
        if (message.code === SELECTDOWN) {
          beginStroke(rastPort, message.mouseX, message.mouseY);
        }
        else if (message.code === SELECTUP) {
          endStroke();
        }
        break;

      case C.IDCMP_MOUSEMOVE:
        drawTo(rastPort, message.mouseX, message.mouseY);
        break;
    }
  }
}
finally {
  window.close();
}

print('Clean exit.');
