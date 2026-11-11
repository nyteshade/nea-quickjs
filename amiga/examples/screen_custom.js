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
 *   - the screen's font is small enough that the window's title bar
 *     ends above y = 20, where the first line of text is drawn
 *
 * Requires quickjs.library 0.130+.
 * Run: qjs examples/screen_custom.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available - need quickjs.library 0.130+');
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
  return Intuition.OpenWindowTags([
    [C.WA_Left,         20],
    [C.WA_Top,          20],
    [C.WA_Width,        280],
    [C.WA_Height,       160],
    [C.WA_Title,        'Hello, Custom Screen'],

    /* This tag is what puts the window on our screen. */
    [C.WA_CustomScreen, screen.ptr],

    [C.WA_Flags,        C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                      | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
    [C.WA_IDCMP,        C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
  ]);
}

/**
 * Draw the window's contents. Called once when the window opens and
 * again whenever Intuition says part of it needs redrawing. The
 * coordinates are pixels from the window's top left corner.
 *
 * @param {Window} window
 * @returns {undefined}
 */
function paint(window) {
  let rastPort = window.rastPort;

  rastPort.setColor(PEN.TEXT);
  rastPort.text(10, 20, 'Hello from a custom screen!');

  rastPort.setColor(PEN.FILL);
  rastPort.rectFill(10, 40, 120, 80);

  /* The outlined box: four lines, each starting where the last
   * ended. */
  rastPort.setColor(PEN.OUTLINE);
  rastPort.move(10, 100);
  rastPort.draw(260, 100);
  rastPort.draw(260, 140);
  rastPort.draw(10, 140);
  rastPort.draw(10, 100);

  rastPort.setColor(PEN.TEXT);
  rastPort.text(10, 155, 'Close to exit.');
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
