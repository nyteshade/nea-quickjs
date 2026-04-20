/*
 * frameidemo.js — port of NDK 3.1 Examples1/intuition/frameidemo.c
 * using the Q2 wrapper API.
 *
 * Original: ESCOM AG, 1992-1996. Shows the four frame types provided
 * by `frameiclass` (the BOOPSI imageclass) in both normal and
 * recessed states — 8 frames in a 4×2 grid.
 *
 * Demonstrates:
 *   - NewWindow constructor with an init object (including owned
 *     title string)
 *   - Intuition.OpenWindow(nw) returning a Window instance
 *   - Intuition.NewObjectTags('frameiclass', pairs) for BOOPSI
 *   - Window.screen.font.ySize chain for dynamic y-positioning
 *   - Window.rastPort handed to DrawImage
 *   - win.messages() iterator over IDCMP
 *   - Intuition.BeginRefresh / EndRefresh for damage handling
 *
 * Run:        qjs examples/frameidemo.js
 * Requires:   quickjs.library 0.127+
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.127+');
  std.exit(1);
}

const C = Intuition.consts;

let nw = new NewWindow({
  width: 600, height: 200,
  idcmp: C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW,
  flags: C.WFLG_DRAGBAR | C.WFLG_SIZEGADGET | C.WFLG_DEPTHGADGET
       | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE,
  title: 'FrameIClass Demo',
  minWidth: 100, minHeight: 50,
  maxWidth: 640, maxHeight: 200,
});

let win = Intuition.OpenWindow(nw);

if (!win) {
  nw.free();
  print('OpenWindow failed');
  std.exit(1);
}

print('Window open — close-gadget or CTRL-C to exit.');

let frames = [];
let fontYSize = win.screen.font.ySize;
let rp = win.rastPort;

try {
  for (let recessed = 0; recessed <= 1; recessed++) {
    for (let frametype = 0; frametype <= 3; frametype++) {
      let frame = Intuition.NewObjectTags('frameiclass', [
        [C.IA_FrameType, frametype],
        [C.IA_Recessed,  recessed],
        [C.IA_Width,     80],
        [C.IA_Height,    20],
      ]);

      if (!frame) continue;

      frames.push(frame);

      Intuition.DrawImage(rp, frame,
        20 + frametype * 100,
        fontYSize + 12 + recessed * 30);
    }
  }

  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) {
      break;
    }

    if (msg.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(win);

      let i = 0;

      for (let r = 0; r <= 1; r++) {
        for (let t = 0; t <= 3; t++) {
          if (frames[i]) {
            Intuition.DrawImage(rp, frames[i],
              20 + t * 100,
              fontYSize + 12 + r * 30);
          }

          i++;
        }
      }

      Intuition.EndRefresh(win, true);
    }
  }
}

finally {
  for (let f of frames) {
    Intuition.DisposeObject(f);
  }

  win.close();
  nw.free();
}

print('Clean exit.');
