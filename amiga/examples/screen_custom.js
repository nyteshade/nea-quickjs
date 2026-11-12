/*
 * screen_custom.js - a screen of our own, with one window drawn into.
 *
 * A new 320 x 200, four-colour screen opens in front of Workbench. On
 * it sits a window with a line of text, a filled box and an outlined
 * box:
 *
 *   +-- Hello, Custom Screen -------------+
 *   | Hello from a custom screen!         |
 *   | ##########                          |
 *   | +-------------------------------+   |
 *   | +-------------------------------+   |
 *   | Close to exit.                      |
 *   +-------------------------------------+
 *
 * Close the window and both it and the screen go away. The order
 * matters: the window is closed first, then the screen it lives on.
 *
 * Assumptions:
 *   - the machine can show a 320 x 200 screen in its default display
 *     mode; no mode is asked for
 *   - pens 1, 2 and 3 of the new screen's default palette are visible
 *     against pen 0, the background
 *   - the window draws in the new screen's font, and is sized and
 *     laid out from that font's height
 *
 * Requires quickjs.library 0.217+.
 * Run: qjs examples/screen_custom.js
 */

import * as std from 'qjs:std';

/* WA_InnerWidth arrived in 0.217, with RastPort.fontHeight and window
 * titles; its presence is the test for a new enough library. */
if (typeof Intuition !== 'function' ||
    !('WA_InnerWidth' in Intuition.consts)) {
  print('Need quickjs.library 0.217 or later');
  std.exit(1);
}

/** Intuition's constants: SA_ and WA_ tags, WFLG_ flags, IDCMP_
 *  classes. */
const C = Intuition.consts;

/** Bitplanes in the screen: 2 planes give 4 colours. */
const SCREEN_DEPTH = 2;

/** The pens used, by what each is used for. */
const PEN = { TEXT: 1, FILL: 2, OUTLINE: 3 };

/**
 * Open the custom screen.
 *
 * @returns {Screen|null} the screen, or null if it could not be opened
 */
function openCustomScreen() {
  return Intuition.OpenScreenTags([
    [C.SA_Left,   0],
    [C.SA_Top,    0],
    [C.SA_Width,  320],
    [C.SA_Height, 200],
    [C.SA_Depth,  SCREEN_DEPTH],
    [C.SA_Title,  'QJS Custom Screen'],
    [C.SA_Type,   C.CUSTOMSCREEN],
  ]);
}

/**
 * Open a window on the given screen instead of on Workbench.
 *
 * @param {Screen} screen - the screen from openCustomScreen()
 * @returns {Window|null} the window, or null if it could not be opened
 */
function openWindowOnScreen(screen) {
  let layout = layoutFor(screen.font.ySize);

  /* WA_InnerWidth and WA_InnerHeight give the size inside the
   * borders; Intuition adds the title bar and borders itself. */
  return Intuition.OpenWindowTags([
    [C.WA_Left,         20],
    [C.WA_Top,          20],
    [C.WA_InnerWidth,   layout.innerWidth],
    [C.WA_InnerHeight,  layout.innerHeight],
    [C.WA_Title,        'Hello, Custom Screen'],

    /* This tag is what puts the window on our screen. */
    [C.WA_CustomScreen, screen.ptr],

    [C.WA_Flags,        C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                      | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
    [C.WA_IDCMP,        C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
  ]);
}

/** How wide the contents are, in pixels. The screen is only 320
 *  across, so this is a fixed number that fits it. */
const CONTENT_WIDTH = 250;

/**
 * Where everything goes, worked out from the height of one line of
 * text. All positions are in pixels from the top left corner of the
 * area INSIDE the window's borders:
 *
 *   a line of text
 *   a filled box, two lines high and half as wide as the contents
 *   an outlined box, two lines high and as wide as the contents
 *   a line of text
 *
 * with half a line between each and around the outside.
 *
 * @param {number} line - height of one line of text, in pixels
 * @returns {{margin: number, line: number, fillTop: number,
 *            outlineTop: number, boxHeight: number, hintTop: number,
 *            innerWidth: number, innerHeight: number}}
 */
function layoutFor(line) {
  let margin    = Math.round(line / 2);
  let boxHeight = 2 * line;

  let fillTop    = margin + line + margin;
  let outlineTop = fillTop + boxHeight + margin;
  let hintTop    = outlineTop + boxHeight + margin;

  return {
    margin, line, fillTop, outlineTop, boxHeight, hintTop,
    innerWidth:  CONTENT_WIDTH + 2 * margin,
    innerHeight: hintTop + line + margin,
  };
}

/**
 * Draw the window's contents. Called once when the window opens and
 * again whenever Intuition says part of it needs redrawing.
 *
 * Drawing coordinates are pixels from the top left corner of the
 * window FRAME, so the left border and the title bar are added to
 * every position.
 *
 * @param {Window} window
 * @returns {undefined}
 */
function paint(window) {
  let rastPort = window.rastPort;
  let layout   = layoutFor(rastPort.fontHeight);

  let left     = window.borderLeft + layout.margin;
  let top      = window.borderTop;
  let right    = left + CONTENT_WIDTH;
  let baseline = rastPort.fontBaseline;

  /* text() puts the BASELINE of the text at the y it is given. */
  rastPort.setColor(PEN.TEXT);
  rastPort.text(left, top + layout.margin + baseline,
                'Hello from a custom screen!');

  rastPort.setColor(PEN.FILL);
  rastPort.rectFill(left, top + layout.fillTop,
                    left + Math.round(CONTENT_WIDTH / 2),
                    top + layout.fillTop + layout.boxHeight);

  /* The outlined box: four lines, each starting where the last
   * ended. */
  let outlineTop    = top + layout.outlineTop;
  let outlineBottom = outlineTop + layout.boxHeight;

  rastPort.setColor(PEN.OUTLINE);
  rastPort.move(left,  outlineTop);
  rastPort.draw(right, outlineTop);
  rastPort.draw(right, outlineBottom);
  rastPort.draw(left,  outlineBottom);
  rastPort.draw(left,  outlineTop);

  rastPort.setColor(PEN.TEXT);
  rastPort.text(left, top + layout.hintTop + baseline, 'Close to exit.');
}

let screen = openCustomScreen();

if (!screen) {
  print('OpenScreenTags failed');
  std.exit(1);
}

print('Custom screen open: ' + screen.width + 'x' + screen.height +
      ' depth=' + SCREEN_DEPTH + ' ("' + screen.title + '")');

let window = openWindowOnScreen(screen);

if (!window) {
  /* The screen did open, so it must not be left behind. */
  print('OpenWindowTags failed - closing screen and exiting');
  Intuition.CloseScreen(screen);
  std.exit(1);
}

print('Window open. Close the window to exit.');

try {
  paint(window);

  for (let message of window.messages()) {

    if (message.class === C.IDCMP_CLOSEWINDOW) break;

    if (message.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(window);
      paint(window);
      Intuition.EndRefresh(window, true);
    }
  }
}
finally {
  /* Window first, then the screen: a screen will not close while a
   * window is still open on it. */
  window.close();
  Intuition.CloseScreen(screen);
}

print('Clean exit.');
