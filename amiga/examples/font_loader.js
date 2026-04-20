/*
 * font_loader.js — Open a disk font by name, install it on a
 * window's RastPort, and draw a pangram line in that font.
 *
 * Demonstrates:
 *   - TextAttr constructor (constructable struct): allocate a fresh
 *     8-byte TextAttr, point its ta_Name at an owned C-string, set
 *     ta_YSize, hand to Diskfont
 *   - amiga.Diskfont.OpenDiskFont wrapper
 *   - Graphics.SetFont to install a loaded TextFont* on the RastPort
 *   - Raw-FFI escape hatch for graphics.library CloseFont (not yet
 *     in the Graphics wrapper)
 *   - Ownership discipline: pokeString-allocated name gets freed at
 *     shutdown, CloseFont matches OpenDiskFont
 *
 * Run:        qjs examples/font_loader.js [fontname.font] [size]
 * Example:    qjs examples/font_loader.js topaz.font 11
 *             qjs examples/font_loader.js courier.font 13
 * Requires:   quickjs.library 0.135+ (adds Diskfont wrapper)
 */

import * as std from 'qjs:std';

if (typeof Diskfont !== 'function' || typeof TextAttr !== 'function') {
  print('Q2 wrappers unavailable — need quickjs.library 0.135+');
  std.exit(1);
}

const C = Intuition.consts;

const fontName = (scriptArgs && scriptArgs[1]) || 'topaz.font';
const fontSize = parseInt((scriptArgs && scriptArgs[2]) || '11', 10);

print('Loading "' + fontName + '" at ' + fontSize + 'pt...');

/**
 * Build a fresh TextAttr describing the desired font. The string
 * passed to ta_Name is allocated here; free it when done via the
 * returned {ta, nameAlloc} handle.
 *
 * @param   {string} name — e.g. "topaz.font"
 * @param   {number} size — point size
 * @returns {{ta: TextAttr, nameAlloc: {ptr: number, size: number}}}
 */
function makeTextAttr(name, size) {
  let ta = new TextAttr();

  let bytes = name.length + 1;
  let ptr = amiga.allocMem(bytes);

  if (!ptr) {
    ta.free();
    throw new Error('allocMem failed for font name');
  }

  amiga.pokeString(ptr, name);
  ta.write32(0, ptr);       /* ta_Name */
  ta.write16(4, size);      /* ta_YSize */
  ta.write8(6, 0);          /* ta_Style — FS_NORMAL */
  ta.write8(7, 0);          /* ta_Flags — FPF_ROMFONT=1 etc., 0=don't care */

  return { ta, nameAlloc: { ptr, size: bytes } };
}

/**
 * graphics.library CloseFont — not wrapped yet. LVO -78.
 *
 * @param {number} font — TextFont* pointer
 * @returns {undefined}
 */
function closeFont(font) {
  if (!font) return;
  amiga.call(Graphics.ensureLibrary(), amiga.graphics.lvo.CloseFont,
    { a1: font });
}

let { ta, nameAlloc } = makeTextAttr(fontName, fontSize);

let font = Diskfont.OpenDiskFont(ta);

if (!font) {
  print('OpenDiskFont failed — is "' + fontName +
        '" in FONTS:? Does size ' + fontSize + ' exist?');
  amiga.freeMem(nameAlloc.ptr, nameAlloc.size);
  ta.free();
  std.exit(1);
}

print('Loaded. Opening demo window...');

let win = Intuition.OpenWindowTags([
  [C.WA_Left,   40],
  [C.WA_Top,    40],
  [C.WA_Width,  520],
  [C.WA_Height, 180],
  [C.WA_Title,  'Font: ' + fontName + ' @ ' + fontSize + 'pt'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
]);

if (!win) {
  print('OpenWindowTags failed');
  closeFont(font);
  amiga.freeMem(nameAlloc.ptr, nameAlloc.size);
  ta.free();
  std.exit(1);
}

let rp = win.rastPort;

/**
 * Repaint the window using the loaded font.
 *
 * @returns {undefined}
 */
function repaint() {
  Graphics.SetFont(rp, font);

  rp.setColor(1);
  rp.text(10, 40, 'The quick brown fox jumps over the lazy dog.');
  rp.text(10, 60, 'Pack my box with five dozen liquor jugs.');
  rp.text(10, 80, '0 1 2 3 4 5 6 7 8 9   ! @ # $ % ^ & * ( ) - _ = +');
  rp.text(10, 120, 'Font: ' + fontName + ' @ ' + fontSize + 'pt');
  rp.text(10, 140, 'Close window to exit.');
}

try {
  repaint();

  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) break;

    if (msg.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(win);
      repaint();
      Intuition.EndRefresh(win, true);
    }
  }
}

finally {
  win.close();
  closeFont(font);
  amiga.freeMem(nameAlloc.ptr, nameAlloc.size);
  ta.free();
}

print('Clean exit.');
