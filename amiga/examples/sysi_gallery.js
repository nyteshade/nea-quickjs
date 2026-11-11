/*
 * sysi_gallery.js - a labelled gallery of the system's own gadget images.
 *
 * Intuition draws its close, depth, zoom and arrow gadgets, checkmarks
 * and so on from a built-in image class, sysiclass. This script asks
 * that class for seventeen images and lays them out in a window, five to
 * a row, each with its name and code underneath:
 *
 *   [img]        [img]        [img]        [img]        [img]
 *   Depth (0)    Zoom (1)     Size (2)     Close (3)    ScreenDepth (5)
 *   ...
 *
 * Close the window to quit. A cousin of frameidemo.js, which does the
 * same for frameiclass.
 *
 * The file has three parts:
 *
 *   1. THE IMAGES  - which images to ask for, and how to make one.
 *   2. THE WINDOW  - the window, and the grid painted in it.
 *   3. THE LOOP    - make the images, paint, wait for the close gadget.
 *
 * Assumptions:
 *   - the default public screen (normally Workbench) is open and at
 *     least 640 x 240: the window is 620 x 220, placed at 20, 20
 *   - an image the running system does not have (the last four are
 *     new in OS 3.2) cannot be made; it is skipped and only its label
 *     is drawn
 *   - no SYSIA_DrawInfo is passed, so sysiclass is left to choose
 *     pens and sizes without knowing the screen
 *   - pen 1 shows against the window background, for the labels
 *
 * Requires quickjs.library 0.130+.
 * Run: qjs examples/sysi_gallery.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Q2 wrapper classes not available - need quickjs.library 0.130+');
  std.exit(1);
}

/** Intuition's constants: WA_ tags, WFLG_ flags and IDCMP_ classes. */
const C = Intuition.consts;


/* ==================================================================
 * 1. THE IMAGES
 * ================================================================== */

/* sysiclass attribute tags. Intuition.consts does not have them, so
 * they are spelled out here, from intuition/imageclass.h:
 *
 *   IA_Dummy    = TAG_USER + 0x20000  = 0x80020000
 *   SYSIA_Size  = IA_Dummy + 0x0B
 *   SYSIA_Which = IA_Dummy + 0x0D */
const SYSIA_Size  = 0x8002000B;   /* which size class to make it in */
const SYSIA_Which = 0x8002000D;   /* which system image to make */

/** SYSIA_Size value for a medium-resolution screen such as a 640 x
 *  256 Workbench (intuition/imageclass.h; the others are
 *  SYSISIZE_LOWRES = 1 and SYSISIZE_HIRES = 2). */
const SYSISIZE_MEDRES = 0;

/** The images to show: [label, SYSIA_Which code]. Names and codes
 *  are the header's (intuition/imageclass.h); the last four arrived
 *  with OS 3.2 (V47) and are skipped on an older system. */
const GALLERY = [
  ['Depth',        0x00],   /* DEPTHIMAGE    window depth gadget     */
  ['Zoom',         0x01],   /* ZOOMIMAGE     window zoom gadget      */
  ['Size',         0x02],   /* SIZEIMAGE     window sizing gadget    */
  ['Close',        0x03],   /* CLOSEIMAGE    window close gadget     */
  ['ScreenDepth',  0x05],   /* SDEPTHIMAGE   screen depth gadget     */
  ['Left',         0x0A],   /* LEFTIMAGE     arrow                   */
  ['Up',           0x0B],   /* UPIMAGE                               */
  ['Right',        0x0C],   /* RIGHTIMAGE                            */
  ['Down',         0x0D],   /* DOWNIMAGE                             */
  ['Check',        0x0E],   /* CHECKIMAGE    GadTools checkbox       */
  ['Radio',        0x0F],   /* MXIMAGE       GadTools radio button   */
  ['MenuCheck',    0x10],   /* MENUCHECK     menu checkmark          */
  ['AmigaKey',     0x11],   /* AMIGAKEY      menu Amiga-key          */
  ['Iconify',      0x16],   /* ICONIFYIMAGE  window iconify (V47)    */
  ['MenuRadio',    0x1B],   /* MENUMX        menu radio mark (V47)   */
  ['MenuSub',      0x1C],   /* MENUSUB       sub-menu marker (V47)   */
  ['ShiftKey',     0x2A],   /* SHIFTKEYIMAGE menu Shift-key (V47)    */
];

/**
 * Ask sysiclass for one system image. The caller must dispose of it
 * with Intuition.DisposeObject.
 *
 * @param {number} which - a SYSIA_Which code from GALLERY
 * @returns {Image|null} the image, or null if it could not be made
 */
function makeSysImage(which) {
  return Intuition.NewObjectTags('sysiclass', [
    [SYSIA_Which, which],
    [SYSIA_Size,  SYSISIZE_MEDRES],
  ]);
}


/* ==================================================================
 * 2. THE WINDOW
 * ================================================================== */

/** The grid, in pixels. Its top is the screen font's height plus
 *  GRID_TOP_GAP below the window's top edge, to clear the title bar. */
const GRID_COLUMNS  = 5;
const GRID_LEFT     = 20;
const GRID_TOP_GAP  = 16;
const COLUMN_WIDTH  = 120;
const ROW_HEIGHT    = 70;

/** A label's baseline is this far below the top of its image. */
const LABEL_DROP = 38;

/** The pen the labels are drawn in. */
const LABEL_PEN = 1;

let window = Intuition.OpenWindowTags([
  [C.WA_Left,   20],
  [C.WA_Top,    20],
  [C.WA_Width,  620],
  [C.WA_Height, 220],
  [C.WA_Title,  'sysiclass image gallery'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
]);

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

print('Window open. Close to exit.');

let rastPort = window.rastPort;

/** One entry per GALLERY entry, in the same order: the image, or null
 *  where it could not be made. */
let images = [];

/**
 * Draw every image that exists, and every label, on the grid.
 *
 * @returns {undefined}
 */
function paintGallery() {
  let fontHeight = window.screen.font.ySize;
  let gridTop    = fontHeight + GRID_TOP_GAP;

  rastPort.setColor(LABEL_PEN);

  for (let index = 0; index < GALLERY.length; index++) {
    let [label, which] = GALLERY[index];

    let column = index % GRID_COLUMNS;
    let row    = Math.floor(index / GRID_COLUMNS);
    let x      = GRID_LEFT + column * COLUMN_WIDTH;
    let y      = gridTop + row * ROW_HEIGHT;

    let image = images[index];

    if (image) {
      Intuition.DrawImage(rastPort, image, x, y);
    }

    rastPort.text(x, y + LABEL_DROP, label + ' (' + which + ')');
  }
}


/* ==================================================================
 * 3. THE LOOP
 * ================================================================== */

try {
  for (let index = 0; index < GALLERY.length; index++) {
    let image = makeSysImage(GALLERY[index][1]);

    /* A failure still takes up a slot, so images[] stays in step
     * with GALLERY. */
    images.push(image || null);
  }

  paintGallery();

  for (let message of window.messages()) {

    if (message.class === C.IDCMP_CLOSEWINDOW) break;

    if (message.class === C.IDCMP_REFRESHWINDOW) {
      Intuition.BeginRefresh(window);
      paintGallery();
      Intuition.EndRefresh(window, true);
    }
  }
}
finally {
  for (let image of images) {
    if (image) Intuition.DisposeObject(image);
  }

  window.close();
}

print('Clean exit.');
