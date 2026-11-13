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
 *   - the screen is opened without naming a font, so it and the
 *     window on it both use the system default font; the window is
 *     sized and laid out by measuring that font on the screen
 *   - the contents fit a screen 320 pixels across in that font. If
 *     they do not, the window cannot open and the script says so
 *
 * Requires quickjs.library 0.237+ (Screen.rastPort arrived then).
 * Run: qjs examples/screen_custom.js
 */

import * as std from 'qjs:std';

/* The newest thing this script uses is Screen.rastPort, 0.237. */
if (typeof Intuition !== 'function' ||
    typeof amiga.intuition.Screen !== 'function' ||
    !('rastPort' in amiga.intuition.Screen.prototype)) {
  print('Need quickjs.library 0.237 or later');
  std.exit(1);
}

/** Intuition's constants: SA_ and WA_ tags, WFLG_ flags, IDCMP_
 *  classes. */
const C = Intuition.consts;

/** Bitplanes in the screen: 2 planes give 4 colours. */
const SCREEN_DEPTH = 2;

/** The pens used, by what each is used for. */
const PEN = { TEXT: 1, FILL: 2, OUTLINE: 3 };

/** The two lines of text. */
const GREETING  = 'Hello from a custom screen!';
const HINT_TEXT = 'Close to exit.';

/** The least the contents may be across, in pixels, so that the boxes
 *  have some length even in a narrow font. */
const LEAST_CONTENT_WIDTH = 160;

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
  let layout = layoutFor(screen.rastPort);

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

/**
 * Where everything goes, worked out from the font: the height of one
 * line of text and the width of the longer of the two lines. All
 * positions are in pixels from the top left corner of the area INSIDE
 * the window's borders:
 *
 *   a line of text
 *   a filled box, two lines high and half as wide as the contents
 *   an outlined box, two lines high and as wide as the contents
 *   a line of text
 *
 * with half a line between each and around the outside.
 *
 * The font is taken from a RastPort: the screen's own before the
 * window is open, the window's afterwards. They hold the same font
 * (see Assumptions), so both give the same layout.
 *
 * @param {RastPort} rastPort - a RastPort holding the font
 * @returns {{margin: number, line: number, fillTop: number,
 *            outlineTop: number, boxHeight: number, hintTop: number,
 *            contentWidth: number, innerWidth: number,
 *            innerHeight: number}}
 */
function layoutFor(rastPort) {
  let line      = rastPort.fontHeight;
  let margin    = Math.round(line / 2);
  let boxHeight = 2 * line;

  let contentWidth = Math.max(LEAST_CONTENT_WIDTH,
                              rastPort.textWidth(GREETING),
                              rastPort.textWidth(HINT_TEXT));

  let fillTop    = margin + line + margin;
  let outlineTop = fillTop + boxHeight + margin;
  let hintTop    = outlineTop + boxHeight + margin;

  return {
    margin, line, fillTop, outlineTop, boxHeight, hintTop, contentWidth,
    innerWidth:  contentWidth + 2 * margin,
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
  let layout   = layoutFor(rastPort);

  /* The last pixel of the contents is one short of their width. */
  let left     = window.borderLeft + layout.margin;
  let top      = window.borderTop;
  let right    = left + layout.contentWidth - 1;
  let baseline = rastPort.fontBaseline;

  /* text() puts the BASELINE of the text at the y it is given. */
  rastPort.setColor(PEN.TEXT);
  rastPort.text(left, top + layout.margin + baseline, GREETING);

  rastPort.setColor(PEN.FILL);
  rastPort.rectFill(left, top + layout.fillTop,
                    left + Math.round(layout.contentWidth / 2),
                    top + layout.fillTop + layout.boxHeight - 1);

  /* The outlined box: four lines, each starting where the last
   * ended. */
  let outlineTop    = top + layout.outlineTop;
  let outlineBottom = outlineTop + layout.boxHeight - 1;

  rastPort.setColor(PEN.OUTLINE);
  rastPort.move(left,  outlineTop);
  rastPort.draw(right, outlineTop);
  rastPort.draw(right, outlineBottom);
  rastPort.draw(left,  outlineBottom);
  rastPort.draw(left,  outlineTop);

  rastPort.setColor(PEN.TEXT);
  rastPort.text(left, top + layout.hintTop + baseline, HINT_TEXT);
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
