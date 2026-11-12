/*
 * drawing_demo.js - lines, boxes and text drawn straight into a window.
 *
 * A window opens and shows one labelled sample of each basic drawing
 * operation:
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
 * The file has three parts:
 *
 *   1. MEASURING  - sizes worked out from the screen font.
 *   2. PAINTING   - the drawing itself.
 *   3. THE WINDOW - open it, paint, wait, close.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench)
 *   - pens 1, 2 and 3 are visible against the window background. On a
 *     standard four-colour Workbench they are black, white and blue.
 *   - the window draws its text in the screen's font, which is what a
 *     window gets unless it asks for another
 *
 * Requires quickjs.library 0.217+.
 * Run: qjs examples/drawing_demo.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function' ||
    typeof amiga.ScreenFont !== 'function' ||
    typeof amiga.allocString !== 'function') {
  print('Need quickjs.library 0.217 or later');
  std.exit(1);
}

const { ScreenFont } = amiga;

/** Intuition's constants: WA_ tags, WFLG_ flags and IDCMP_ classes. */
const C = Intuition.consts;

/** Pen numbers. The names are what a standard Workbench palette shows;
 *  a different palette shows different colours. */
const PEN = { BLACK: 1, WHITE: 2, BLUE: 3 };

/** The label at the start of each row, top to bottom. */
const LABELS = ['Line:', 'Rect:', 'Outline:', 'Hatch:'];

/** Which row each sample is on. */
const ROW = { LINE: 0, RECT: 1, OUTLINE: 2, HATCH: 3 };

const HINT_TEXT = 'Click or close to exit.';

/** How many strokes the hatch has. */
const HATCH_STROKES = 10;


/* ==================================================================
 * 1. MEASURING
 *
 * Nothing here is a fixed number of pixels. The user chooses the
 * screen font, and it may be 8 pixels high or 24, so every size is a
 * multiple of the font's height and every width comes from measuring
 * the text.
 * ================================================================== */

/* ScreenFont locks the screen and reads its font, so text can be
 * measured before any window exists. */
let screenFont = new ScreenFont();

/** One line of text, in pixels. */
const LINE = screenFont.height;

/** Space between the contents and the window's borders. across()
 *  turns a vertical distance into the horizontal one that looks the
 *  same, for screens whose pixels are not square. */
const MARGIN_DOWN   = Math.round(LINE / 2);
const MARGIN_ACROSS = screenFont.across(MARGIN_DOWN);

/** A shape reaches this far above and below the middle of its row. */
const SHAPE_HALF_HEIGHT = Math.round(LINE * 3 / 4);

/** From the middle of one row to the middle of the next. */
const ROW_STEP = 2 * SHAPE_HALF_HEIGHT + Math.round(LINE / 2);

/** The label column is as wide as its widest label. */
const LABEL_WIDTH = Math.max(...LABELS.map((label) =>
  screenFont.widthOf(label)));

/** The gap between the labels and the shapes. */
const LABEL_GAP = screenFont.across(LINE);

/** How wide the longest shapes are. The filled rectangle is shorter. */
const SHAPE_WIDTH = screenFont.across(LINE * 12);
const RECT_WIDTH  = Math.round(SHAPE_WIDTH * 2 / 5);

/** The inside of the window: the area within its borders. */
const INNER_WIDTH = 2 * MARGIN_ACROSS + Math.max(
  LABEL_WIDTH + LABEL_GAP + SHAPE_WIDTH,
  screenFont.widthOf(HINT_TEXT));

const INNER_HEIGHT = 2 * MARGIN_DOWN
                   + LABELS.length * ROW_STEP     /* the four samples */
                   + LINE;                        /* the hint */


/* ==================================================================
 * 2. PAINTING
 * ================================================================== */

/**
 * Draw the whole picture. Called once when the window opens and again
 * whenever Intuition says part of it needs redrawing.
 *
 * Coordinates are in pixels from the top left corner of the window
 * FRAME, so everything is offset by the left and top borders.
 *
 * @param {Window} window - the open window
 * @returns {undefined}
 */
function paint(window) {
  let rastPort = window.rastPort;

  /* The top left corner of the area we may draw in. */
  let originX = window.borderLeft + MARGIN_ACROSS;
  let originY = window.borderTop  + MARGIN_DOWN;

  let shapeLeft  = originX + LABEL_WIDTH + LABEL_GAP;
  let shapeRight = shapeLeft + SHAPE_WIDTH;

  /**
   * The middle of a row, in pixels down from the top of the frame.
   *
   * @param {number} row - 0 for the top row
   * @returns {number}
   */
  function middleOf(row) {
    return originY + row * ROW_STEP + SHAPE_HALF_HEIGHT;
  }

  /**
   * Draw a row's label so that it sits level with the row's shape.
   * text() puts the BASELINE of the text at the y it is given, so the
   * baseline is worked out from where the top of the text should be.
   *
   * @param {number} row
   * @returns {undefined}
   */
  function label(row) {
    let textTop = middleOf(row) - Math.round(rastPort.fontHeight / 2);

    rastPort.text(originX, textTop + rastPort.fontBaseline, LABELS[row]);
  }

  let middle, top, bottom;

  /* A line: move the pen, then draw to where it should end. */
  middle = middleOf(ROW.LINE);

  rastPort.setColor(PEN.BLACK);
  label(ROW.LINE);
  rastPort.move(shapeLeft, middle);
  rastPort.draw(shapeRight, middle);

  /* A filled rectangle is one call. */
  middle = middleOf(ROW.RECT);
  top    = middle - SHAPE_HALF_HEIGHT;
  bottom = middle + SHAPE_HALF_HEIGHT;

  rastPort.setColor(PEN.WHITE);
  label(ROW.RECT);
  rastPort.rectFill(shapeLeft, top, shapeLeft + RECT_WIDTH, bottom);

  /* An outline is four lines, each starting where the last ended. */
  middle = middleOf(ROW.OUTLINE);
  top    = middle - SHAPE_HALF_HEIGHT;
  bottom = middle + SHAPE_HALF_HEIGHT;

  rastPort.setColor(PEN.BLUE);
  label(ROW.OUTLINE);
  rastPort.move(shapeLeft,  top);
  rastPort.draw(shapeRight, top);
  rastPort.draw(shapeRight, bottom);
  rastPort.draw(shapeLeft,  bottom);
  rastPort.draw(shapeLeft,  top);

  /* A hatch is the same slanted stroke repeated along the row. Each
   * stroke leans one and a half steps to the right, and the steps are
   * sized so that the last stroke ends where the other shapes do. */
  middle = middleOf(ROW.HATCH);
  top    = middle - SHAPE_HALF_HEIGHT;
  bottom = middle + SHAPE_HALF_HEIGHT;

  let hatchStep = SHAPE_WIDTH / (HATCH_STROKES + 0.5);
  let hatchLean = hatchStep * 1.5;

  rastPort.setColor(PEN.BLACK);
  label(ROW.HATCH);

  for (let stroke = 0; stroke < HATCH_STROKES; stroke++) {
    let x = shapeLeft + stroke * hatchStep;

    rastPort.move(Math.round(x), top);
    rastPort.draw(Math.round(x + hatchLean), bottom);
  }

  /* The hint goes on its own line under the last row. */
  let hintTop = originY + LABELS.length * ROW_STEP;

  rastPort.setColor(PEN.WHITE);
  rastPort.text(originX, hintTop + rastPort.fontBaseline, HINT_TEXT);
}


/* ==================================================================
 * 3. THE WINDOW
 * ================================================================== */

/* WA_InnerWidth and WA_InnerHeight give the size inside the borders;
 * Intuition adds the title bar and borders, which also depend on the
 * font. */
let window = Intuition.OpenWindowTags([
  [C.WA_Left,        80],
  [C.WA_Top,         40],
  [C.WA_InnerWidth,  INNER_WIDTH],
  [C.WA_InnerHeight, INNER_HEIGHT],
  [C.WA_Title,       'Drawing'],
  [C.WA_Flags,       C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                   | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,       C.IDCMP_CLOSEWINDOW | C.IDCMP_MOUSEBUTTONS
                   | C.IDCMP_REFRESHWINDOW],
]);

/* The window keeps the screen open from here on, so the lock that
 * ScreenFont holds can go. The sizes measured above stay usable. */
screenFont.close();

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Click or close to exit.');

paint(window);

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
      paint(window);
      Intuition.EndRefresh(window, true);
    }
  }
}
finally {
  window.close();
}

print('Clean exit.');
