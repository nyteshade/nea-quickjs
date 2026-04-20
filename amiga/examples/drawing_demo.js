/*
 * drawing_demo.js — graphics.library primitives via the Q2 wrapper API.
 *
 * Opens a 400×240 window and draws a grid of shapes using the
 * RastPort instance methods (.setColor/.move/.draw/.rectFill/.text):
 *   - horizontal line
 *   - filled rectangle
 *   - open rectangle outline (4 draw calls)
 *   - cross-hatch (repeated move+draw)
 *   - labeled text
 *
 * Each block uses a different pen color. Repaints on
 * IDCMP_REFRESHWINDOW so resizing works cleanly. Exits on close
 * gadget or mouse click.
 *
 * Run:        qjs examples/drawing_demo.js
 * Requires:   quickjs.library 0.127+
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.127+');
  std.exit(1);
}

const C = Intuition.consts;

let win = Intuition.OpenWindowTags([
  [C.WA_Left,   80],
  [C.WA_Top,    40],
  [C.WA_Width,  400],
  [C.WA_Height, 240],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MOUSEBUTTONS
              | C.IDCMP_REFRESHWINDOW],
]);

if (!win) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Click or close to exit.');

let rp = win.rastPort;

/**
 * Redraws the entire content area. Called once at startup and
 * again on every IDCMP_REFRESHWINDOW (window damaged).
 */
function repaint() {
  /* Title bar consumes ~16px at top; we start at y=30 to keep
   * clear. Window is not WFLG_GIMMEZEROZERO so coordinates are
   * raw window-relative. */

  rp.setColor(1);
  rp.text(10, 40, 'Line:');
  rp.move(80, 40);
  rp.draw(360, 40);

  rp.setColor(2);
  rp.text(10, 80, 'Rect:');
  rp.rectFill(80, 65, 200, 95);

  rp.setColor(3);
  rp.text(10, 130, 'Outline:');
  rp.move(80, 115);
  rp.draw(360, 115);
  rp.draw(360, 145);
  rp.draw(80, 145);
  rp.draw(80, 115);

  rp.setColor(1);
  rp.text(10, 180, 'Hatch:');

  for (let i = 0; i < 10; i++) {
    let x = 80 + i * 20;

    rp.move(x, 165);
    rp.draw(x + 30, 195);
  }

  rp.setColor(2);
  rp.text(10, 220, 'Click or close to exit.');
}

repaint();

try {
  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW ||
        msg.class === C.IDCMP_MOUSEBUTTONS) {
      break;
    }

    if (msg.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(win);
      repaint();
      Intuition.EndRefresh(win, true);
    }
  }
}

finally {
  win.close();
}

print('Clean exit.');
