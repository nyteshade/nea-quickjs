/*
 * frameidemo.js - the four standard frame styles, raised and recessed.
 *
 * A window titled "FrameIClass Demo" shows eight empty frames in a
 * grid: one column for each frame type, raised on the top row and
 * recessed on the bottom row.
 *
 *              default   button    ridge     icon drop box
 *   raised     [      ]  [      ]  [      ]  [      ]
 *   recessed   [      ]  [      ]  [      ]  [      ]
 *
 * The window can be resized; the frames are redrawn when Intuition
 * asks for it. Close the window to quit.
 *
 * This is a port of frameidemo.c from the NDK 3.1 examples
 * (Examples1/intuition, ESCOM AG, 1992-1996). Like the original it
 * fills in a NewWindow structure and calls OpenWindow, rather than
 * using a tag list.
 *
 * Assumptions:
 *   - the default public screen (normally Workbench) is open and at
 *     least 600 x 200, the size the window opens at
 *   - Kickstart 3.0 (V39) or later: frameiclass is built into
 *     Intuition, but it only learned the four frame types in V39
 *   - the frames are a fixed size in pixels, as in the original; only
 *     their position follows the window's borders, so a tall title bar
 *     pushes the grid down and the bottom row may then need the window
 *     to be at its full height
 *
 * Requires quickjs.library 0.127+.
 * Run: qjs examples/frameidemo.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available - need quickjs.library 0.127+');
  std.exit(1);
}

/** Intuition's constants: IA_ tags, WFLG_ flags and IDCMP_ classes. */
const C = Intuition.consts;

/** frameiclass frame types run from 0 to 3: FRAME_DEFAULT,
 *  FRAME_BUTTON, FRAME_RIDGE and FRAME_ICONDROPBOX, in that order
 *  (intuition/imageclass.h). */
const FRAME_TYPE_COUNT = 4;

/** Each type is shown twice: raised (0), then recessed (1). */
const RECESSED_STATES = 2;

/** The size of every frame, in pixels. */
const FRAME_WIDTH  = 80;
const FRAME_HEIGHT = 20;

/** The grid the frames are drawn on, in pixels, measured from the
 *  inside of the window's left border and title bar. */
const GRID_LEFT    = 20;
const GRID_TOP_GAP = 12;
const COLUMN_STEP  = 100;
const ROW_STEP     = 30;

/**
 * Draw one frame in its place on the grid.
 *
 * Positions are in pixels from the top left corner of the window
 * FRAME, so the left border and the title bar are added on. Their
 * sizes are read from the open window: the title bar is as tall as
 * the screen font makes it, and guessing would put the top row under
 * it on a screen with a large font.
 *
 * @param {Window} window - the open window
 * @param {Image} frame - a frameiclass object
 * @param {number} column - 0 to 3, counted from the left
 * @param {number} row - 0 for the top row, 1 for the bottom row
 * @returns {undefined}
 */
function drawFrame(window, frame, column, row) {
  Intuition.DrawImage(window.rastPort, frame,
    window.borderLeft + GRID_LEFT + column * COLUMN_STEP,
    window.borderTop  + GRID_TOP_GAP + row * ROW_STEP);
}

let newWindow = new NewWindow({
  width: 600, height: 200,
  idcmp: C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW,
  flags: C.WFLG_DRAGBAR | C.WFLG_SIZEGADGET | C.WFLG_DEPTHGADGET
       | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE,
  title: 'FrameIClass Demo',
  minWidth: 100, minHeight: 50,
  maxWidth: 640, maxHeight: 200,
});

let window = Intuition.OpenWindow(newWindow);

if (!window) {
  newWindow.free();
  print('OpenWindow failed');
  std.exit(1);
}

print('Window open - close-gadget or CTRL-C to exit.');

/** Every frame object made, in the order made, so that each can be
 *  redrawn on a refresh and disposed of at the end. */
let frames = [];


try {
  /* Make the eight frames, drawing each one as soon as it exists. */
  for (let recessed = 0; recessed < RECESSED_STATES; recessed++) {
    for (let frameType = 0; frameType < FRAME_TYPE_COUNT; frameType++) {
      let frame = Intuition.NewObjectTags('frameiclass', [
        [C.IA_FrameType, frameType],
        [C.IA_Recessed,  recessed],
        [C.IA_Width,     FRAME_WIDTH],
        [C.IA_Height,    FRAME_HEIGHT],
      ]);

      if (!frame) continue;

      frames.push(frame);
      drawFrame(window, frame, frameType, recessed);
    }
  }

  for (let message of window.messages()) {

    if (message.class === C.IDCMP_CLOSEWINDOW) break;

    if (message.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(window);

      /* Assumes every frame was made: frames[] is then in grid order,
       * left to right and top row first. */
      let cellCount = RECESSED_STATES * FRAME_TYPE_COUNT;

      for (let cell = 0; cell < cellCount; cell++) {
        let column = cell % FRAME_TYPE_COUNT;
        let row    = Math.floor(cell / FRAME_TYPE_COUNT);

        if (frames[cell]) {
          drawFrame(window, frames[cell], column, row);
        }
      }

      Intuition.EndRefresh(window, true);
    }
  }
}
finally {
  for (let frame of frames) {
    Intuition.DisposeObject(frame);
  }

  window.close();
  newWindow.free();
}

print('Clean exit.');
