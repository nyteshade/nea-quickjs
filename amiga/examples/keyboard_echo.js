/*
 * keyboard_echo.js - type into a window and see the text appear.
 *
 * A 420 x 180 window opens. Whatever you type is drawn in it, letter
 * by letter. Return starts a new line, Backspace rubs out the last
 * character, and a long line wraps onto the next. Esc or the close
 * gadget quits.
 *
 * The keys arrive as IDCMP_VANILLAKEY messages: Intuition has already
 * applied Shift, Alt and the keymap, so `message.code` is simply the
 * character's code. (IDCMP_RAWKEY would give key positions instead.)
 *
 * The file has three parts:
 *
 *   1. THE TEXT    - the typed lines, as plain strings. No window.
 *   2. THE WINDOW  - the window, and how the lines are drawn in it.
 *   3. THE LOOP    - one key in, text changed, window redrawn.
 *
 * Assumptions:
 *   - the default public screen (normally Workbench) is open and big
 *     enough for a 420 x 180 window placed at 30, 30
 *   - the screen font is the font the window draws with, so its
 *     height is the right distance between lines
 *   - a line is wrapped after 55 characters whatever the font, which
 *     is not measured; whether 55 characters fit is not checked
 *   - the window's borders are no more than 2 pixels thick at the
 *     left, right and bottom, where the text area is cleared
 *   - pen 0 is the window background and pen 1 shows against it
 *
 * Requires quickjs.library 0.130+.
 * Run: qjs examples/keyboard_echo.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available - need quickjs.library 0.130+');
  std.exit(1);
}

/** Intuition's constants: WA_ tags, WFLG_ flags and IDCMP_ classes. */
const C = Intuition.consts;


/* ==================================================================
 * 1. THE TEXT
 *
 * What has been typed, and nothing about how it is shown.
 * ================================================================== */

/** A line is wrapped once it is this many characters long. */
const MAX_LINE_CHARS = 55;

/** The typed text, one string per line. There is always at least one
 *  line. */
const lines = [''];

/** Index into `lines` of the line being typed on. */
let cursorRow = 0;

/**
 * Add one character to the current line, moving to a fresh line when
 * this one is full.
 *
 * @param {string} character - a single character
 * @returns {undefined}
 */
function putChar(character) {
  lines[cursorRow] += character;

  if (lines[cursorRow].length >= MAX_LINE_CHARS) {
    cursorRow++;
    lines[cursorRow] = '';
  }
}

/**
 * Remove the last character. On an empty line, go back up to the end
 * of the line before instead.
 *
 * @returns {undefined}
 */
function backspace() {
  if (lines[cursorRow].length > 0) {
    lines[cursorRow] = lines[cursorRow].slice(0, -1);
  }
  else if (cursorRow > 0) {
    lines.pop();
    cursorRow--;
  }
}

/**
 * Start a new line, dropping lines from the top if there are now more
 * than will fit.
 *
 * @param {number} maxVisibleLines - how many lines the window can show
 * @returns {undefined}
 */
function newline(maxVisibleLines) {
  cursorRow++;
  lines[cursorRow] = '';

  while (lines.length > maxVisibleLines) {
    lines.shift();
    cursorRow--;
  }
}


/* ==================================================================
 * 2. THE WINDOW
 * ================================================================== */

let window = Intuition.OpenWindowTags([
  [C.WA_Left,   30],
  [C.WA_Top,    30],
  [C.WA_Width,  420],
  [C.WA_Height, 180],
  [C.WA_Title,  'Type anything - ESC or close to exit'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_VANILLAKEY
              | C.IDCMP_REFRESHWINDOW],
]);

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Type to echo, ESC or close to exit.');

let rastPort = window.rastPort;

/** Pens: the window background, and the text drawn on it. */
const PEN = { BACKGROUND: 0, TEXT: 1 };

/** Height of the screen's font in pixels, used as the line spacing.
 *  The window was given no font of its own, so it draws with this
 *  one. */
const fontHeight = window.screen.font.ySize;

/** Text starts this many pixels in from the window's left edge. */
const TEXT_LEFT = 4;

/** The baseline of the first line, in pixels from the window's top:
 *  one line of text plus 18 pixels, to stay below the title bar. */
const TITLE_BAR_ALLOWANCE = 18;
const firstBaseline = fontHeight + TITLE_BAR_ALLOWANCE;

/** The cleared area stops this many pixels short of the window's
 *  left, right and bottom edges. */
const ERASE_INSET = 2;

/**
 * How many lines of text fit below the title bar.
 *
 * @returns {number}
 */
function visibleLineCount() {
  return Math.floor((window.height - firstBaseline) / fontHeight);
}

/**
 * Clear the text area and draw every line that fits. Called after
 * each change to the text, and when Intuition asks for a refresh.
 *
 * @returns {undefined}
 */
function redrawAll() {
  rastPort.setColor(PEN.BACKGROUND);
  rastPort.rectFill(ERASE_INSET, firstBaseline - fontHeight,
                    window.width - ERASE_INSET,
                    window.height - ERASE_INSET);

  rastPort.setColor(PEN.TEXT);

  for (let index = 0; index < lines.length; index++) {
    let y = firstBaseline + index * fontHeight;

    if (y > window.height - fontHeight) break;
    if (lines[index].length) rastPort.text(TEXT_LEFT, y, lines[index]);
  }
}


/* ==================================================================
 * 3. THE LOOP
 * ================================================================== */

/** Character codes that mean something other than "show me". */
const KEY_ESC       = 0x1B;
const KEY_BACKSPACE = 0x08;
const KEY_CR        = 0x0D;   /* the Return key */

/** Printable ASCII runs from space up to, but not including, DEL. */
const FIRST_PRINTABLE = 0x20;
const KEY_DEL         = 0x7F;

/**
 * Act on one typed key and show the result. Keys that are neither
 * printable nor one of the editing keys above are ignored.
 *
 * @param {number} code - the character code from the message
 * @returns {undefined}
 */
function typeKey(code) {
  if (code === KEY_BACKSPACE) {
    backspace();
  }
  else if (code === KEY_CR) {
    newline(visibleLineCount());
  }
  else if (code >= FIRST_PRINTABLE && code < KEY_DEL) {
    putChar(String.fromCharCode(code));
  }
  else {
    return;
  }

  redrawAll();
}

try {
  redrawAll();

  for (let message of window.messages()) {

    if (message.class === C.IDCMP_CLOSEWINDOW) break;

    /* Esc quits too. It is checked here because a `break` inside the
     * switch below would only leave the switch. */
    if (message.class === C.IDCMP_VANILLAKEY &&
        message.code === KEY_ESC) {
      break;
    }

    switch (message.class) {

      case C.IDCMP_REFRESHWINDOW:
        Intuition.BeginRefresh(window);
        redrawAll();
        Intuition.EndRefresh(window, true);
        break;

      case C.IDCMP_VANILLAKEY:
        typeKey(message.code);
        break;
    }
  }
}
finally {
  window.close();
}

print('Clean exit.');
