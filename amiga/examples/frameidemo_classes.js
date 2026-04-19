/* amiga/examples/frameidemo_classes.js
 *
 * Same as examples/frameidemo.js but written against the Q2
 * wrapper-class API (library 0.127+) instead of raw amiga.call.
 *
 * Side-by-side comparison shows the ergonomic improvement.
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.127+');
  std.exit(1);
}

const I = Intuition.consts;

let nw = new NewWindow({
  width: 600, height: 200,
  idcmp: I.IDCMP_CLOSEWINDOW | I.IDCMP_REFRESHWINDOW,
  flags: I.WFLG_DRAGBAR | I.WFLG_SIZEGADGET | I.WFLG_DEPTHGADGET
       | I.WFLG_CLOSEGADGET | I.WFLG_ACTIVATE,
  title: 'FrameIClass Demo (Q2)',
  minWidth: 100, minHeight: 50,
  maxWidth: 640, maxHeight: 200,
});

let win = Intuition.OpenWindow(nw);

if (!win) {
  nw.free();
  print('OpenWindow failed');
  std.exit(1);
}

print('Window open — close-gadget or refresh to exit cleanly.');

let frames = [];
let fontYSize = win.screen.font.ySize;
let rport = win.rastPort;

try {
  for (let recessed = 0; recessed <= 1; recessed++) {
    for (let frametype = 0; frametype <= 3; frametype++) {
      let frame = Intuition.NewObjectTags('frameiclass', [
        [I.IA_FrameType, frametype],
        [I.IA_Recessed,  recessed],
        [I.IA_Width,     80],
        [I.IA_Height,    20],
      ]);

      if (!frame) continue;

      frames.push(frame);

      Intuition.DrawImage(rport, frame,
        20 + frametype * 100,
        fontYSize + 12 + recessed * 30);
    }
  }

  for (let msg of win.messages()) {
    if (msg.class === I.IDCMP_CLOSEWINDOW) {
      break;
    }

    if (msg.class === I.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(win);

      let i = 0;

      for (let r = 0; r <= 1; r++) {
        for (let t = 0; t <= 3; t++) {
          if (frames[i]) {
            Intuition.DrawImage(rport, frames[i],
              20 + t * 100, fontYSize + 12 + r * 30);
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
