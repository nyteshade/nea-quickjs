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
 *   - opens on the default public screen (normally Workbench)
 *   - the text is drawn in the screen's font. The window is sized
 *     from that font before it opens and told to draw in it once it
 *     is open, because a window on Workbench would otherwise draw in
 *     the system default font
 *   - a line is wrapped after 55 characters, or sooner if it would no
 *     longer fit: the window is made wide enough for 55 characters of
 *     the font's usual width, and a proportional font's wide letters
 *     take more than that
 *   - pen 0 is the window background and pen 1 shows against it
 *
 * Requires quickjs.library 0.237+ (ScreenFont.useIn arrived then).
 * Run: qjs examples/keyboard_echo.js
 */

import * as std from 'qjs:std';

/* The newest thing this script uses is ScreenFont.useIn, 0.237. */
if (typeof Intuition !== 'function' ||
    typeof amiga.ScreenFont !== 'function' ||
    typeof amiga.ScreenFont.prototype.useIn !== 'function') {
  print('Need quickjs.library 0.237 or later');
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
 * Add one character to the current line. A line that is full, by
 * count or because the character would not fit in the window, is
 * left as it is and the character starts a new one.
 *
 * Until 0.237 a full line was followed by a new one without dropping
 * any from the top, so after eight full lines the typing went on
 * below the bottom of the window, unseen.
 *
 * @param {string} character - a single character
 * @param {function(string): boolean} fits - whether a line of text
 *   is narrow enough to be drawn
 * @param {number} maxVisibleLines - how many lines the window can show
 * @returns {undefined}
 */
function putChar(character, fits, maxVisibleLines) {
  let longer = lines[cursorRow] + character;

  if (lines[cursorRow].length > 0 &&
      (longer.length > MAX_LINE_CHARS || !fits(longer))) {
    newline(maxVisibleLines);
    longer = character;
  }

  lines[cursorRow] = longer;
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

/* The window is sized from the screen font, not in fixed pixels: the
 * user chooses that font, and it may be 8 pixels high or 24.
 * ScreenFont reads it before any window exists. */
const { ScreenFont } = amiga;

/** How much text the window holds when it opens: as wide as the
 *  longest line can be. */
const COLUMNS_SHOWN = MAX_LINE_CHARS;
const LINES_SHOWN   = 8;

let screenFont = new ScreenFont();

/** Space between the text and the window's borders, in pixels: half a
 *  line down, and the same distance across. */
const MARGIN_DOWN   = Math.round(screenFont.height / 2);
const MARGIN_ACROSS = screenFont.across(MARGIN_DOWN);

/* WA_InnerWidth and WA_InnerHeight give the size inside the borders;
 * Intuition adds the title bar and borders itself. nominalWidth is the
 * font's usual character width, which is near enough for "about 55
 * columns". */
let window = Intuition.OpenWindowTags([
  [C.WA_Left,        30],
  [C.WA_Top,         30],
  [C.WA_InnerWidth,  COLUMNS_SHOWN * screenFont.nominalWidth
                     + 2 * MARGIN_ACROSS],
  [C.WA_InnerHeight, LINES_SHOWN * screenFont.height + 2 * MARGIN_DOWN],
  [C.WA_Title,       'Type anything - ESC or close to exit'],
  [C.WA_Flags,       C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                   | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,       C.IDCMP_CLOSEWINDOW | C.IDCMP_VANILLAKEY
                   | C.IDCMP_REFRESHWINDOW],
]);

/* A window on Workbench does not start with the screen's font: its
 * RastPort gets the system default font, which the user sets
 * separately (intuition.doc, OpenScreenTagList, SA_SysFont). Every
 * size above was measured in the screen's font, so the window is told
 * to draw in that one. */
if (window) screenFont.useIn(window);

/* The window keeps the screen open from here on. */
screenFont.close();

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Type to echo, ESC or close to exit.');

let rastPort = window.rastPort;

/** Pens: the window background, and the text drawn on it. */
const PEN = { BACKGROUND: 0, TEXT: 1 };

/** Height of one line of text in pixels, used as the line spacing:
 *  the screen font's, which the window now draws in. */
const fontHeight = rastPort.fontHeight;

/* The area the text may use, in pixels from the top left corner of
 * the window FRAME: everything inside the borders. The borders are
 * read from the open window, so the title bar is cleared whatever
 * its height. */
const AREA_LEFT   = window.borderLeft;
const AREA_TOP    = window.borderTop;

/** Text starts this far in from the window's left edge. */
const TEXT_LEFT = AREA_LEFT + MARGIN_ACROSS;

/** The baseline of the first line. text() puts the BASELINE at the y
 *  it is given, so this is the top of the first line plus the font's
 *  baseline. */
const firstBaseline = AREA_TOP + MARGIN_DOWN + rastPort.fontBaseline;

/**
 * Whether a line of text can be drawn without running into the
 * window's right border. Nothing clips text to the inside of a
 * window: too long a line would be drawn over the border.
 *
 * @param {string} text - the line
 * @returns {boolean}
 */
function fitsAcross(text) {
  let room = window.width - window.borderRight - MARGIN_ACROSS - TEXT_LEFT;

  return rastPort.textWidth(text) <= room;
}

/**
 * How many lines of text fit inside the window.
 *
 * @returns {number}
 */
function visibleLineCount() {
  let usable = window.height - window.borderBottom - AREA_TOP
             - 2 * MARGIN_DOWN;

  return Math.max(1, Math.floor(usable / fontHeight));
}

/**
 * Clear the text area and draw every line that fits. Called after
 * each change to the text, and when Intuition asks for a refresh.
 *
 * @returns {undefined}
 */
function redrawAll() {
  rastPort.setColor(PEN.BACKGROUND);
  rastPort.rectFill(AREA_LEFT, AREA_TOP,
                    window.width  - window.borderRight  - 1,
                    window.height - window.borderBottom - 1);

  rastPort.setColor(PEN.TEXT);

  let shown = Math.min(lines.length, visibleLineCount());

  for (let index = 0; index < shown; index++) {
    let y = firstBaseline + index * fontHeight;

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
    putChar(String.fromCharCode(code), fitsAcross, visibleLineCount());
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
