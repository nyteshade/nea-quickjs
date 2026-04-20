/*
 * keyboard_echo.js — Open a window, collect IDCMP_VANILLAKEY events,
 * echo each printable character into the window's RastPort, and
 * wrap/scroll the text lines as the bottom is reached. Backspace
 * erases the last character; ESC exits.
 *
 * Demonstrates:
 *   - IDCMP_VANILLAKEY (Intuition's cooked-ASCII event — already
 *     maps shift/alt/ctrl/caps into a single char code) vs IDCMP_RAWKEY
 *     (scan codes; this script uses VANILLAKEY for simplicity)
 *   - String.fromCharCode on msg.code to turn ULONG into a JS string
 *   - Mixing VANILLAKEY with IDCMP_CLOSEWINDOW so the close gadget
 *     still works alongside keyboard input
 *
 * Run:        qjs examples/keyboard_echo.js
 * Requires:   quickjs.library 0.130+
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.130+');
  std.exit(1);
}

const C = Intuition.consts;

/* ASCII/ANSI codes Intuition passes through VANILLAKEY. */
const KEY_ESC       = 0x1B;
const KEY_BACKSPACE = 0x08;
const KEY_CR        = 0x0D;

let win = Intuition.OpenWindowTags([
  [C.WA_Left,   30],
  [C.WA_Top,    30],
  [C.WA_Width,  420],
  [C.WA_Height, 180],
  [C.WA_Title,  'Type anything — ESC or close to exit'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_VANILLAKEY
              | C.IDCMP_REFRESHWINDOW],
]);

if (!win) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Type to echo, ESC or close to exit.');

let rp = win.rastPort;

/* Text-layout state. The window's font is whatever the screen uses
 * (Topaz/8 on plain Workbench); we fetch its ySize to advance lines
 * by the right pixel amount. `font.ySize` is on the Screen's TextAttr
 * wrapper, readable via win.screen.font. */
const fontHeight = win.screen.font.ySize;
const lineStart  = 4;                 /* text starts at x=4 */
const topPad     = fontHeight + 18;   /* stay below title bar */
const lines = [''];                   /* current buffer, one string per line */
let row = 0;                          /* current row index into `lines` */

/**
 * Repaint the entire text buffer. Called on startup and on every
 * IDCMP_REFRESHWINDOW so window damage restores cleanly.
 *
 * @returns {undefined}
 */
function redrawAll() {
  rp.setColor(0);
  rp.rectFill(2, topPad - fontHeight,
              win.width - 2, win.height - 2);

  rp.setColor(1);

  for (let i = 0; i < lines.length; i++) {
    let y = topPad + i * fontHeight;

    if (y > win.height - fontHeight) break;
    if (lines[i].length) rp.text(lineStart, y, lines[i]);
  }
}

/**
 * Append a single printable character to the current line, wrapping
 * to a new row if the line grows too wide.
 *
 * @param {string} ch — single character to print
 * @returns {undefined}
 */
function putChar(ch) {
  lines[row] += ch;

  /* Crude width guard: stop at ~55 chars per line for default font. */
  if (lines[row].length >= 55) {
    row++;
    lines[row] = '';
  }

  redrawAll();
}

/**
 * Handle a backspace — remove the last character, popping up a line
 * if we erase past the start of the current one.
 *
 * @returns {undefined}
 */
function backspace() {
  if (lines[row].length > 0) {
    lines[row] = lines[row].slice(0, -1);
  }

  else if (row > 0) {
    lines.pop();
    row--;
  }

  redrawAll();
}

/**
 * Advance to a new line, scrolling the buffer if we've run off the
 * bottom of the window.
 *
 * @returns {undefined}
 */
function newline() {
  row++;
  lines[row] = '';

  let maxVisible = Math.floor((win.height - topPad) / fontHeight);

  while (lines.length > maxVisible) {
    lines.shift();
    row--;
  }

  redrawAll();
}

try {
  redrawAll();

  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) {
      break;
    }

    if (msg.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(win);
      redrawAll();
      Intuition.EndRefresh(win, true);
      continue;
    }

    if (msg.class === C.IDCMP_VANILLAKEY) {
      let code = msg.code;

      if (code === KEY_ESC) break;

      if (code === KEY_BACKSPACE) {
        backspace();
        continue;
      }

      if (code === KEY_CR) {
        newline();
        continue;
      }

      /* Any other printable ASCII — echo it. */
      if (code >= 0x20 && code < 0x7F) {
        putChar(String.fromCharCode(code));
      }
    }
  }
}

finally {
  win.close();
}

print('Clean exit.');
