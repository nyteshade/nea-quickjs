/*
 * font_loader.js - load a disk font by name and draw sample text in it.
 *
 * A window opens showing two pangrams, the digits and some punctuation
 * in the chosen font, with the font's name and size underneath. Try it
 * with other fonts from FONTS: to compare them. Close the window to
 * quit.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     is wide enough for the longest line in the chosen font
 *   - diskfont.library is installed (standard Workbench)
 *   - the named font exists in FONTS: at the size asked for; the
 *     default, topaz.font 11, ships with Workbench. If it cannot be
 *     opened the script says so and stops.
 *   - pen 1 is visible against the window background
 *   - the window is sized from the loaded font, by measuring the text
 *     in it before the window opens
 *
 * Requires quickjs.library 0.225+.
 * Run: qjs examples/font_loader.js [fontname.font=topaz.font] [size=11]
 */

import * as std from 'qjs:std';

/* RastPort.scratch arrived in 0.225 and Graphics.consts.FS_NORMAL in
 * 0.221; their presence is the test for a new enough library. */
if (typeof Diskfont !== 'function' || typeof TextAttr !== 'function' ||
    !('FS_NORMAL' in Graphics.consts) ||
    typeof RastPort.scratch !== 'function') {
  print('Need quickjs.library 0.225 or later');
  std.exit(1);
}

const C = Intuition.consts;

const DEFAULT_FONT_NAME = 'topaz.font';
const DEFAULT_FONT_SIZE = '11';

const fontName = (scriptArgs && scriptArgs[1]) || DEFAULT_FONT_NAME;
const fontSize = parseInt((scriptArgs && scriptArgs[2]) || DEFAULT_FONT_SIZE,
                          10);

/** What the window title and the last-but-one line both say. */
const fontCaption = 'Font: ' + fontName + ' @ ' + fontSize + 'pt';

/** ta_Flags: no preference about where the font comes from. */
const ANY_FONT_FLAGS = 0;

/** The pen the text is drawn with. */
const TEXT_PEN = 1;

/** What is drawn, one entry to a line. An empty entry leaves a line
 *  blank. */
const LINES = [
  'The quick brown fox jumps over the lazy dog.',
  'Pack my box with five dozen liquor jugs.',
  '0 1 2 3 4 5 6 7 8 9   ! @ # $ % ^ & * ( ) - _ = +',
  '',
  fontCaption,
  'Close window to exit.',
];

/**
 * Build a TextAttr describing the wanted font. The name is copied into
 * memory allocated here, which the caller frees once the TextAttr is
 * no longer needed.
 *
 * @param {string} name - e.g. "topaz.font"
 * @param {number} size - height in pixels
 * @returns {{textAttr: TextAttr, nameAlloc: {ptr: number, size: number, free: function(): undefined}}}
 */
function makeTextAttr(name, size) {
  let textAttr = new TextAttr();

  /* The TextAttr only POINTS at its name, so the name is a separate
   * allocation that has to live as long as the TextAttr does. */
  let nameAlloc;

  try {
    nameAlloc = amiga.allocString(name);
  }
  catch (error) {
    textAttr.free();
    throw error;
  }

  textAttr.namePtr = nameAlloc.ptr;
  textAttr.ySize   = size;
  textAttr.style   = Graphics.consts.FS_NORMAL;    /* plain text */
  textAttr.flags   = ANY_FONT_FLAGS;

  return { textAttr, nameAlloc };
}

/**
 * Release the TextAttr and the name it points at.
 *
 * @returns {undefined}
 */
function freeTextAttr() {
  nameAlloc.free();
  textAttr.free();
}

/**
 * Draw every line in the loaded font.
 *
 * @returns {undefined}
 */
function repaint() {
  Graphics.SetFont(rastPort, font);

  /* Positions are in pixels from the top left corner of the window
   * FRAME, so the left border and the title bar are added on.
   * text() puts the BASELINE of the text at the y it is given. */
  let left = window.borderLeft + MARGIN;
  let top  = window.borderTop  + MARGIN;

  rastPort.setColor(TEXT_PEN);

  for (let index = 0; index < LINES.length; index++) {
    if (LINES[index].length === 0) continue;

    rastPort.text(left, top + index * LINE_HEIGHT + BASELINE,
                  LINES[index]);
  }
}

print('Loading "' + fontName + '" at ' + fontSize + 'pt...');

let { textAttr, nameAlloc } = makeTextAttr(fontName, fontSize);

let font = Diskfont.OpenDiskFont(textAttr);

if (!font) {
  print('OpenDiskFont failed - is "' + fontName +
        '" in FONTS:? Does size ' + fontSize + ' exist?');
  freeTextAttr();
  std.exit(1);
}

print('Loaded. Opening demo window...');

/* The window has to fit text in a font that was only just loaded, so
 * the text is measured first. A scratch RastPort is one that is
 * attached to nothing: it cannot be drawn into, but text can be
 * measured against it in any font. */
let measure = RastPort.scratch(font);

/** One line of the loaded font, and where its baseline sits, in
 *  pixels. */
const LINE_HEIGHT = measure.fontHeight;
const BASELINE    = measure.fontBaseline;

/** The widest line, in pixels. */
const TEXT_WIDTH = Math.max(...LINES.map((line) => measure.textWidth(line)));

measure.free();

/** Space between the text and the window's borders: half a line. */
const MARGIN = Math.round(LINE_HEIGHT / 2);

/* WA_InnerWidth and WA_InnerHeight give the size inside the borders;
 * Intuition adds the title bar and borders itself. (The title bar is
 * drawn in the SCREEN's font, not the loaded one.) */
let window = Intuition.OpenWindowTags([
  [C.WA_Left,        40],
  [C.WA_Top,         40],
  [C.WA_InnerWidth,  TEXT_WIDTH + 2 * MARGIN],
  [C.WA_InnerHeight, LINES.length * LINE_HEIGHT + 2 * MARGIN],
  [C.WA_Title,       fontCaption],
  [C.WA_Flags,       C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                   | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,       C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
]);

if (!window) {
  print('OpenWindowTags failed');
  Graphics.CloseFont(font);
  freeTextAttr();
  std.exit(1);
}

let rastPort = window.rastPort;

try {
  repaint();

  for (let message of window.messages()) {
    if (message.class === C.IDCMP_CLOSEWINDOW) break;

    if (message.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(window);
      repaint();
      Intuition.EndRefresh(window, true);
    }
  }
}
finally {
  /* The window goes first, so nothing is still drawing with the font
   * when it is closed. */
  window.close();
  Graphics.CloseFont(font);
  freeTextAttr();
}

print('Clean exit.');
