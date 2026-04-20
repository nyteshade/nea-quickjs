/*
 * window_hello.js — minimal Intuition window via the Q2 wrapper API.
 *
 * Opens a 320x120 window with dragbar, depth gadget, close gadget,
 * and WFLG_ACTIVATE. Waits for a close-gadget click or any mouse
 * button, then closes cleanly.
 *
 * Demonstrates:
 *   - Intuition.OpenWindowTags([[tag, data], ...])   (no makeTags
 *     / freeMem ceremony — done internally)
 *   - Window struct getters + `for (let msg of win.messages())`
 *     async-style iterator (handles Wait/GetMsg/ReplyMsg)
 *   - CEnumeration-backed constants that coerce to their numeric
 *     value automatically (Intuition.consts.WA_Title, etc.)
 *   - win.close() — idempotent, zeroes .ptr
 *
 * Run:        qjs examples/window_hello.js
 * Requires:   quickjs.library 0.127+
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.127+');
  std.exit(1);
}

const C = Intuition.consts;

let win = Intuition.OpenWindowTags([
  [C.WA_Left,   60],
  [C.WA_Top,    40],
  [C.WA_Width,  320],
  [C.WA_Height, 120],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MOUSEBUTTONS],
]);

if (!win) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Click inside or hit the close gadget to exit.');

try {
  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) {
      print('Got CLOSEWINDOW — exiting.');
      break;
    }

    if (msg.class === C.IDCMP_MOUSEBUTTONS) {
      print('Got MOUSEBUTTONS (code=0x' + msg.code.toString(16) +
            ') — exiting.');
      break;
    }
  }
}

finally {
  win.close();
}

print('Clean exit.');
