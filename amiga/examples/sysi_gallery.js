/*
 * sysi_gallery.js — Display the complete gallery of sysiclass system
 * images (close, depth, zoom, up/down/left/right arrows, size, lock,
 * etc.) at normal and selected states. A cousin of frameidemo.js, but
 * for the `sysiclass` BOOPSI image-class instead of `frameiclass`.
 *
 * Demonstrates:
 *   - Intuition.NewObjectTags('sysiclass', [...]) — BOOPSI
 *     instantiation through the wrapper; returns an Image wrapper
 *   - SYSIA_Which tag selecting which system glyph to draw
 *   - SYSIA_Size tag choosing a size class (SYSISIZE_MEDRES/HIRES/LOWRES)
 *   - Intuition.DrawImage at arbitrary (x, y) — doesn't need an
 *     IntuitionBase pointer through the wrapper since our classes
 *     already hold a cached libraryBase
 *   - Label text under each image using RastPort.text
 *
 * Run:        qjs examples/sysi_gallery.js
 * Requires:   quickjs.library 0.130+
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available — need quickjs.library 0.130+');
  std.exit(1);
}

const C = Intuition.consts;

/* sysiclass attribute tags. These aren't in our CEnumeration (yet) —
 * use raw values from intuition/imageclass.h.
 *
 * SYSIA_Dummy  = TAG_USER + 0x02000000 = 0x82000000
 * SYSIA_Which  = SYSIA_Dummy + 11      = 0x8200000B
 * SYSIA_Size   = SYSIA_Dummy + 10      = 0x8200000A
 * SYSIA_DrawInfo = SYSIA_Dummy + 5     = 0x82000005
 */
const SYSIA_Which = 0x8200000B;
const SYSIA_Size  = 0x8200000A;

/* SYSISIZE_* — size class selectors for sysiclass images. */
const SYSISIZE_MEDRES = 0;
const SYSISIZE_LOWRES = 1;
const SYSISIZE_HIRES  = 2;

/* Which sysiclass images to show. Codes from intuition/imageclass.h.
 * Each entry: [label, WhichCode]. */
const GALLERY = [
  ['Depth',       0],   /* DEPTHIMAGE */
  ['Zoom',        1],   /* ZOOMIMAGE */
  ['Close',       2],   /* CLOSEIMAGE */
  ['Size',        3],   /* SIZEIMAGE */
  ['Left',        4],   /* LEFTIMAGE  (arrow) */
  ['Up',          5],   /* UPIMAGE */
  ['Right',       6],   /* RIGHTIMAGE */
  ['Down',        7],   /* DOWNIMAGE */
  ['CheckMark',   8],   /* CHECKIMAGE */
  ['MXGlyph',     9],   /* MXIMAGE    (radio button) */
  ['Sub',         10],  /* SUBIMAGE   (menu sub) */
  ['Amiga',       11],  /* AMIGAKEY */
  ['Menu-Check',  12],  /* MENUCHECK */
  ['Icon-Bar',    13],  /* ICONIFYIMAGE */
  ['Lock',        14],  /* LOCKIMAGE */
];

let win = Intuition.OpenWindowTags([
  [C.WA_Left,   20],
  [C.WA_Top,    20],
  [C.WA_Width,  620],
  [C.WA_Height, 220],
  [C.WA_Title,  'sysiclass image gallery'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
]);

if (!win) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Close to exit.');

let rp = win.rastPort;
let images = [];

/**
 * Instantiate a sysiclass BOOPSI image for one of the well-known
 * system glyphs. The caller owns disposal via Intuition.DisposeObject.
 *
 * @param   {number} which — one of the DEPTHIMAGE/ZOOMIMAGE/... codes
 * @returns {Image|null}   — wrapper over the raw BOOPSI ptr, or null
 */
function makeSysImage(which) {
  return Intuition.NewObjectTags('sysiclass', [
    [SYSIA_Which, which],
    [SYSIA_Size,  SYSISIZE_MEDRES],
  ]);
}

/**
 * Lay the gallery out: five columns × three rows. Each entry draws
 * the sysiclass image and a text label below it.
 *
 * @returns {undefined}
 */
function paintGallery() {
  const fontHeight = win.screen.font.ySize;
  const topPad     = fontHeight + 16;
  const colW       = 120;
  const rowH       = 70;

  rp.setColor(1);

  for (let i = 0; i < GALLERY.length; i++) {
    let [label, which] = GALLERY[i];
    let col = i % 5;
    let row = Math.floor(i / 5);
    let x = 20 + col * colW;
    let y = topPad + row * rowH;

    let img = images[i];

    if (img) {
      Intuition.DrawImage(rp, img, x, y);
    }

    rp.text(x, y + 38, label + ' (' + which + ')');
  }
}

try {
  for (let i = 0; i < GALLERY.length; i++) {
    let img = makeSysImage(GALLERY[i][1]);

    if (img) images.push(img);
    else     images.push(null);  /* keep index alignment even on failure */
  }

  paintGallery();

  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) {
      break;
    }

    if (msg.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(win);
      paintGallery();
      Intuition.EndRefresh(win, true);
    }
  }
}

finally {
  for (let img of images) {
    if (img) Intuition.DisposeObject(img);
  }

  win.close();
}

print('Clean exit.');
