/*
 * screen_custom.js — Open a custom 4-color screen, park a window on
 * it, paint a few primitives into the window's RastPort, wait for a
 * close click, tear down cleanly.
 *
 * Demonstrates:
 *   - Intuition.OpenScreenTags([...]) → returns a Screen wrapper
 *   - Intuition.OpenWindowTags with WA_CustomScreen pinning a window
 *     to our screen rather than the Workbench public screen
 *   - Orderly shutdown: Window first, Screen second, and an `avail
 *     FLUSH`-safe cleanup if OpenWindow fails after OpenScreen
 *     succeeded
 *   - RastPort drawing via instance methods (rp.setColor/rectFill/
 *     text/move/draw) — same API as drawing_demo but targeting a
 *     custom screen instead of Workbench
 *
 * Run:        qjs examples/screen_custom.js
 * Requires:   quickjs.library 0.130+
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.130+');
  std.exit(1);
}

const C = Intuition.consts;

/**
 * Open our custom screen with conservative settings (320x200, depth 2
 * = 4 colors, WBENCHSCREEN type so Intuition auto-attaches a menu bar
 * if we asked for one — we don't).
 *
 * @returns {Screen|null} the opened Screen wrapper, or null on failure
 */
function openCustomScreen() {
  return Intuition.OpenScreenTags([
    [C.SA_Left,   0],
    [C.SA_Top,    0],
    [C.SA_Width,  320],
    [C.SA_Height, 200],
    [C.SA_Depth,  2],
    [C.SA_Title,  'QJS Custom Screen'],
    [C.SA_Type,   C.CUSTOMSCREEN],
  ]);
}

/**
 * Open a window pinned to the given custom screen.
 *
 * @param   {Screen} screen — screen wrapper returned by OpenScreenTags
 * @returns {Window|null}
 */
function openWindowOnScreen(screen) {
  return Intuition.OpenWindowTags([
    [C.WA_Left,         20],
    [C.WA_Top,          20],
    [C.WA_Width,        280],
    [C.WA_Height,       160],
    [C.WA_Title,        'Hello, Custom Screen'],
    [C.WA_CustomScreen, screen.ptr],
    [C.WA_Flags,        C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                      | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
    [C.WA_IDCMP,        C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
  ]);
}

/**
 * Paint the demo content into the window. Called at startup and on
 * every IDCMP_REFRESHWINDOW so a drag/resize redraws cleanly.
 *
 * @param {Window} win
 * @returns {undefined}
 */
function repaint(win) {
  let rp = win.rastPort;

  rp.setColor(1);
  rp.text(10, 20, 'Hello from a custom screen!');

  rp.setColor(2);
  rp.rectFill(10, 40, 120, 80);

  rp.setColor(3);
  rp.move(10, 100);
  rp.draw(260, 100);
  rp.draw(260, 140);
  rp.draw(10, 140);
  rp.draw(10, 100);

  rp.setColor(1);
  rp.text(10, 155, 'Close to exit.');
}

let screen = openCustomScreen();

if (!screen) {
  print('OpenScreenTags failed');
  std.exit(1);
}

print('Custom screen open: ' + screen.width + 'x' + screen.height +
      ' depth=2 ("' + screen.title + '")');

let win = openWindowOnScreen(screen);

if (!win) {
  print('OpenWindowTags failed — closing screen and exiting');
  Intuition.CloseScreen(screen);
  std.exit(1);
}

print('Window open. Close the window to exit.');

try {
  repaint(win);

  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) {
      break;
    }

    if (msg.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(win);
      repaint(win);
      Intuition.EndRefresh(win, true);
    }
  }
}

finally {
  win.close();
  Intuition.CloseScreen(screen);
}

print('Clean exit.');
