/*
 * drawing_demo.js - lines, boxes and text drawn straight into a window.
 *
 * A 400 x 240 window opens and shows one labelled sample of each basic
 * drawing operation:
 *
 *   Line:      -----------------------------
 *   Rect:      ############
 *   Outline:   +---------------------------+
 *              +---------------------------+
 *   Hatch:     \\\\\\\\\\
 *   Click or close to exit.
 *
 * All of it is done with five RastPort methods: setColor, move, draw,
 * rectFill and text. Click in the window or on its close gadget to
 * quit.
 *
 * Assumptions:
 *   - the default public screen (normally Workbench) is open and big
 *     enough for a 400 x 240 window placed at 80, 40
 *   - pens 1, 2 and 3 are visible against the window background. On a
 *     standard four-colour Workbench they are black, white and blue.
 *   - the screen's title bar is no taller than about 25 pixels: the
 *     window is not GimmeZeroZero, so coordinates start at the very
 *     top left of the frame and the first row is drawn at y = 40
 *
 * Requires quickjs.library 0.127+.
 * Run: qjs examples/drawing_demo.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available - need quickjs.library 0.127+');
  std.exit(1);
}

/** Intuition's constants: WA_ tags, WFLG_ flags and IDCMP_ classes. */
const C = Intuition.consts;

/** Pen numbers. The names are what a standard Workbench palette shows;
 *  another palette draws the same shapes in other colours. */
const PEN = { BLACK: 1, WHITE: 2, BLUE: 3 };

/** Where things sit across the window, in pixels from its left edge. */
const LABEL_X     = 10;    /* every label starts here */
const SHAPE_LEFT  = 80;    /* every shape starts here */
const SHAPE_RIGHT = 360;   /* the line and the outline end here */
const RECT_RIGHT  = 200;   /* the filled rectangle is shorter */

/** The text baseline of each row, in pixels from the window's top. */
const ROW = { LINE: 40, RECT: 80, OUTLINE: 130, HATCH: 180, HINT: 220 };

/** A shape reaches this far above and below its row's baseline. */
const SHAPE_HALF_HEIGHT = 15;

/** The hatch: this many strokes, this far apart, each leaning this far
 *  to the right, in pixels. */
const HATCH_STROKES = 10;
const HATCH_STEP    = 20;
const HATCH_LEAN    = 30;

/**
 * Draw the whole picture. Called once when the window opens and again
 * whenever Intuition says part of it needs redrawing.
 *
 * @param {RastPort} rastPort - the window's RastPort
 * @returns {undefined}
 */
function paint(rastPort) {
  let top, bottom;

  /* A line: move the pen, then draw to where it should end. */
  rastPort.setColor(PEN.BLACK);
  rastPort.text(LABEL_X, ROW.LINE, 'Line:');
  rastPort.move(SHAPE_LEFT, ROW.LINE);
  rastPort.draw(SHAPE_RIGHT, ROW.LINE);

  /* A filled rectangle is one call. */
  top    = ROW.RECT - SHAPE_HALF_HEIGHT;
  bottom = ROW.RECT + SHAPE_HALF_HEIGHT;

  rastPort.setColor(PEN.WHITE);
  rastPort.text(LABEL_X, ROW.RECT, 'Rect:');
  rastPort.rectFill(SHAPE_LEFT, top, RECT_RIGHT, bottom);

  /* An outline is four lines, each starting where the last ended. */
  top    = ROW.OUTLINE - SHAPE_HALF_HEIGHT;
  bottom = ROW.OUTLINE + SHAPE_HALF_HEIGHT;

  rastPort.setColor(PEN.BLUE);
  rastPort.text(LABEL_X, ROW.OUTLINE, 'Outline:');
  rastPort.move(SHAPE_LEFT,  top);
  rastPort.draw(SHAPE_RIGHT, top);
  rastPort.draw(SHAPE_RIGHT, bottom);
  rastPort.draw(SHAPE_LEFT,  bottom);
  rastPort.draw(SHAPE_LEFT,  top);

  /* A hatch is the same slanted stroke repeated along the row. */
  top    = ROW.HATCH - SHAPE_HALF_HEIGHT;
  bottom = ROW.HATCH + SHAPE_HALF_HEIGHT;

  rastPort.setColor(PEN.BLACK);
  rastPort.text(LABEL_X, ROW.HATCH, 'Hatch:');

  for (let stroke = 0; stroke < HATCH_STROKES; stroke++) {
    let x = SHAPE_LEFT + stroke * HATCH_STEP;

    rastPort.move(x, top);
    rastPort.draw(x + HATCH_LEAN, bottom);
  }

  rastPort.setColor(PEN.WHITE);
  rastPort.text(LABEL_X, ROW.HINT, 'Click or close to exit.');
}

let window = Intuition.OpenWindowTags([
  [C.WA_Left,   80],
  [C.WA_Top,    40],
  [C.WA_Width,  400],
  [C.WA_Height, 240],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MOUSEBUTTONS
              | C.IDCMP_REFRESHWINDOW],
]);

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Click or close to exit.');

let rastPort = window.rastPort;

paint(rastPort);

try {
  for (let message of window.messages()) {

    if (message.class === C.IDCMP_CLOSEWINDOW ||
        message.class === C.IDCMP_MOUSEBUTTONS) {
      break;
    }

    if (message.class === C.IDCMP_REFRESHWINDOW) {
      /* Between BeginRefresh and EndRefresh, drawing is clipped to the
       * damaged part of the window, so painting everything is cheap. */
      Intuition.BeginRefresh(window);
      paint(rastPort);
      Intuition.EndRefresh(window, true);
    }
  }
}
finally {
  window.close();
}

print('Clean exit.');
