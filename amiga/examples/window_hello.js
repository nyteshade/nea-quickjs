/*
 * window_hello.js - the smallest useful Intuition window, from JavaScript.
 *
 * A plain 320 x 120 window with no title opens on the Workbench screen.
 * Click inside it, or on its close gadget, and the script says on the
 * Shell which of the two it saw and exits.
 *
 * Things to notice while reading:
 *
 *   - The window is described by a list of [tag, value] pairs. There is
 *     no TagItem array to build and no TAG_DONE.
 *   - `window.messages()` does the Wait / GetMsg / ReplyMsg dance, so
 *     the loop is an ordinary for-of.
 *   - Constants such as C.IDCMP_CLOSEWINDOW compare with === against
 *     `message.class` and turn into plain numbers when OR-ed together.
 *
 * Assumptions:
 *   - the default public screen (normally Workbench) is open and big
 *     enough for a 320 x 120 window placed at 60, 40
 *   - a mouse click inside the window means the left button; the right
 *     button belongs to the screen's menus and never arrives here
 *
 * Requires quickjs.library 0.127+.
 * Run: qjs examples/window_hello.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available - need quickjs.library 0.127+');
  std.exit(1);
}

/** Intuition's constants: WA_ tags, WFLG_ flags and IDCMP_ classes. */
const C = Intuition.consts;

let window = Intuition.OpenWindowTags([
  [C.WA_Left,   60],
  [C.WA_Top,    40],
  [C.WA_Width,  320],
  [C.WA_Height, 120],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],

  /* The only two things this window wants to hear about. */
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MOUSEBUTTONS],
]);

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Click inside or hit the close gadget to exit.');

try {
  for (let message of window.messages()) {

    if (message.class === C.IDCMP_CLOSEWINDOW) {
      print('Got CLOSEWINDOW - exiting.');
      break;
    }

    if (message.class === C.IDCMP_MOUSEBUTTONS) {
      /* message.code says which button and whether it went down or
       * up. The first one to arrive is always a press. */
      print('Got MOUSEBUTTONS (code=0x' + message.code.toString(16) +
            ') - exiting.');
      break;
    }
  }
}
finally {
  window.close();
}

print('Clean exit.');
