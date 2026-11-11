/*
 * font_loader.js - load a disk font by name and draw sample text in it.
 *
 * A window opens showing two pangrams, the digits and some punctuation
 * in the chosen font, with the font's name and size underneath. Try it
 * with other fonts from FONTS: to compare them. Close the window to
 * quit.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), which is at
 *     least 560 x 220 pixels
 *   - diskfont.library is installed (standard Workbench)
 *   - the named font exists in FONTS: at the size asked for; the
 *     default, topaz.font 11, ships with Workbench. If it cannot be
 *     opened the script says so and stops.
 *   - pen 1 is visible against the window background
 *   - the font is small enough for the lines to fit: they are drawn
 *     at fixed positions, 20 pixels apart
 *
 * Requires quickjs.library 0.135+.
 * Run: qjs examples/font_loader.js [fontname.font=topaz.font] [size=11]
 */

import * as std from 'qjs:std';

if (typeof Diskfont !== 'function' || typeof TextAttr !== 'function') {
  print('Q2 wrappers unavailable - need quickjs.library 0.135+');
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

/** Byte offsets of the fields of struct TextAttr (graphics/text.h). */
const TA_NAME  = 0;   /* STRPTR ta_Name  */
const TA_YSIZE = 4;   /* UWORD  ta_YSize */
const TA_STYLE = 6;   /* UBYTE  ta_Style */
const TA_FLAGS = 7;   /* UBYTE  ta_Flags */

/** ta_Style: plain text (FS_NORMAL, graphics/text.h). */
const FS_NORMAL = 0;

/** ta_Flags: no preference about where the font comes from. */
const ANY_FONT_FLAGS = 0;

/** The pen the text is drawn with. */
const TEXT_PEN = 1;

/** Left edge of every line of text, in pixels from the window edge. */
const TEXT_LEFT = 10;

/** What is drawn, and the baseline of each line in pixels from the top
 *  of the window. */
const LINES = [
  { y: 40,  text: 'The quick brown fox jumps over the lazy dog.' },
  { y: 60,  text: 'Pack my box with five dozen liquor jugs.' },
  { y: 80,  text: '0 1 2 3 4 5 6 7 8 9   ! @ # $ % ^ & * ( ) - _ = +' },
  { y: 120, text: fontCaption },
  { y: 140, text: 'Close window to exit.' },
];

/**
 * Build a TextAttr describing the wanted font. The name is copied into
 * memory allocated here, which the caller frees once the TextAttr is
 * no longer needed.
 *
 * @param {string} name - e.g. "topaz.font"
 * @param {number} size - height in pixels
 * @returns {{textAttr: TextAttr, nameAlloc: {ptr: number, size: number}}}
 */
function makeTextAttr(name, size) {
  let textAttr = new TextAttr();

  let bytes = name.length + 1;        /* the name and its NUL */
  let ptr   = amiga.allocMem(bytes);

  if (!ptr) {
    textAttr.free();
    throw new Error('allocMem failed for font name');
  }

  amiga.pokeString(ptr, name);

  textAttr.write32(TA_NAME,  ptr);
  textAttr.write16(TA_YSIZE, size);
  textAttr.write8(TA_STYLE,  FS_NORMAL);
  textAttr.write8(TA_FLAGS,  ANY_FONT_FLAGS);

  return { textAttr, nameAlloc: { ptr, size: bytes } };
}

/**
 * Close a font opened with OpenDiskFont. graphics.library CloseFont
 * has no method on the Graphics wrapper yet, so it is called directly.
 *
 * @param {number} fontPtr - struct TextFont pointer; 0 does nothing
 * @returns {undefined}
 */
function closeFont(fontPtr) {
  if (!fontPtr) return;

  amiga.call(Graphics.ensureLibrary(), amiga.graphics.lvo.CloseFont,
    { a1: fontPtr });
}

/**
 * Release the TextAttr and the name it points at.
 *
 * @returns {undefined}
 */
function freeTextAttr() {
  amiga.freeMem(nameAlloc.ptr, nameAlloc.size);
  textAttr.free();
}

/**
 * Draw every line in the loaded font.
 *
 * @returns {undefined}
 */
function repaint() {
  Graphics.SetFont(rastPort, font);

  rastPort.setColor(TEXT_PEN);
  for (let line of LINES) rastPort.text(TEXT_LEFT, line.y, line.text);
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

let window = Intuition.OpenWindowTags([
  [C.WA_Left,   40],
  [C.WA_Top,    40],
  [C.WA_Width,  520],
  [C.WA_Height, 180],
  [C.WA_Title,  fontCaption],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
]);

if (!window) {
  print('OpenWindowTags failed');
  closeFont(font);
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
  closeFont(font);
  freeTextAttr();
}

print('Clean exit.');
