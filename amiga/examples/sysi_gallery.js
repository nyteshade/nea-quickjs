/*
 * sysi_gallery.js - a labelled gallery of the system's own gadget images.
 *
 * Intuition draws its close, depth, zoom and arrow gadgets, checkmarks
 * and so on from a built-in image class, sysiclass. This script asks
 * that class for seventeen images and lays them out in a window, as
 * many to a row as the screen has room for, each with its name and
 * code underneath:
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
 *   2. THE GRID    - sizes worked out from the images and the font.
 *   3. THE WINDOW  - open it, paint, wait for the close gadget.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench)
 *   - the window draws its labels in the screen's font; the grid is
 *     sized from that font and from the images before it opens
 *   - an image the running system does not have (the last four are
 *     new in OS 3.2) cannot be made; it is skipped and only its label
 *     is drawn
 *   - no SYSIA_DrawInfo is passed, so sysiclass is left to choose
 *     pens and sizes without knowing the screen
 *   - pen 1 shows against the window background, for the labels
 *
 * Requires quickjs.library 0.225+.
 * Run: qjs examples/sysi_gallery.js
 */

import * as std from 'qjs:std';

/* The sysiclass constants arrived in 0.221. (ScreenFont.screenWidth,
 * 0.225, is checked further down, once there is a ScreenFont.) */
if (typeof Intuition !== 'function' ||
    !('SYSIA_Which' in Intuition.consts) ||
    typeof amiga.ScreenFont !== 'function') {
  print('Need quickjs.library 0.225 or later');
  std.exit(1);
}

/** Intuition's constants: WA_ tags, WFLG_ flags and IDCMP_ classes. */
const C = Intuition.consts;


/* ==================================================================
 * 1. THE IMAGES
 * ================================================================== */

/** The images to show: [label, which image]. The names are the
 *  header's (intuition/imageclass.h); the last four arrived with
 *  OS 3.2 (V47) and are skipped on an older system. */
const GALLERY = [
  ['Depth',        C.DEPTHIMAGE],      /* window depth gadget     */
  ['Zoom',         C.ZOOMIMAGE],       /* window zoom gadget      */
  ['Size',         C.SIZEIMAGE],       /* window sizing gadget    */
  ['Close',        C.CLOSEIMAGE],      /* window close gadget     */
  ['ScreenDepth',  C.SDEPTHIMAGE],     /* screen depth gadget     */
  ['Left',         C.LEFTIMAGE],       /* arrow                   */
  ['Up',           C.UPIMAGE],
  ['Right',        C.RIGHTIMAGE],
  ['Down',         C.DOWNIMAGE],
  ['Check',        C.CHECKIMAGE],      /* GadTools checkbox       */
  ['Radio',        C.MXIMAGE],         /* GadTools radio button   */
  ['MenuCheck',    C.MENUCHECK],       /* menu checkmark          */
  ['AmigaKey',     C.AMIGAKEY],        /* menu Amiga-key          */
  ['Iconify',      C.ICONIFYIMAGE],    /* window iconify (V47)    */
  ['MenuRadio',    C.MENUMX],          /* menu radio mark (V47)   */
  ['MenuSub',      C.MENUSUB],         /* sub-menu marker (V47)   */
  ['ShiftKey',     C.SHIFTKEYIMAGE],   /* menu Shift-key (V47)    */
];

/**
 * Ask sysiclass for one system image. The caller must dispose of it
 * with Intuition.DisposeObject.
 *
 * @param {number} which - an image name from GALLERY
 * @returns {Image|null} the image, or null if it could not be made
 */
function makeSysImage(which) {
  return Intuition.NewObjectTags('sysiclass', [
    [C.SYSIA_Which, which],                /* which system image */
    /* The size class for a medium-resolution screen such as a 640 x
     * 256 Workbench; the others are SYSISIZE_LOWRES and _HIRES. */
    [C.SYSIA_Size,  C.SYSISIZE_MEDRES],
  ]);
}


/* ==================================================================
 * 2. THE GRID
 *
 * Nothing here is a fixed number of pixels. A cell has to hold the
 * tallest image with the widest label under it, and neither is known
 * until the images exist and the screen's font has been measured. So
 * the images are made first, then measured, then the window is opened
 * at the size the grid needs.
 * ================================================================== */

const { ScreenFont } = amiga;

/** One entry per GALLERY entry, in the same order: the image, or null
 *  where it could not be made. A failure still takes up a slot, so
 *  this stays in step with GALLERY. */
let images = GALLERY.map(([label, which]) => makeSysImage(which) || null);

/** What is written under each image. */
let labels = GALLERY.map(([label, which]) =>
  label + ' (' + Number(which) + ')');

/* ScreenFont locks the screen and reads its font, so text can be
 * measured before any window exists. */
let screenFont = new ScreenFont();

if (screenFont.screenWidth === undefined) {
  print('Need quickjs.library 0.225 or later');
  screenFont.close();
  for (let image of images) {
    if (image) Intuition.DisposeObject(image);
  }
  std.exit(1);
}

/** One line of text, in pixels. */
const LINE = screenFont.height;

/** Space between the grid and the window's borders. across() turns a
 *  vertical distance into the horizontal one that looks the same. */
const MARGIN_DOWN   = Math.round(LINE / 2);
const MARGIN_ACROSS = screenFont.across(MARGIN_DOWN);

/** The largest image, in pixels. */
const IMAGE_WIDTH  = Math.max(1, ...images.map((image) =>
  image ? image.width : 0));
const IMAGE_HEIGHT = Math.max(1, ...images.map((image) =>
  image ? image.height : 0));

/** The widest label, in pixels. */
const LABEL_WIDTH = Math.max(...labels.map((label) =>
  screenFont.widthOf(label)));

/** The gap between an image and its label. */
const LABEL_GAP = Math.round(LINE / 4);

/** One cell: an image, its label, and room before the next cell. */
const CELL_WIDTH  = Math.max(IMAGE_WIDTH, LABEL_WIDTH)
                  + screenFont.across(LINE);
const CELL_HEIGHT = IMAGE_HEIGHT + LABEL_GAP + LINE + LINE;

/** How far from the left of the screen the window opens. */
const WINDOW_LEFT = 20;
const WINDOW_TOP  = 20;

/** As many columns as fit across the screen, leaving room for the
 *  window's own borders (allowed for generously, as their real width
 *  is not known until the window is open). */
const SPARE_FOR_BORDERS = screenFont.across(2 * LINE);

const GRID_COLUMNS = Math.max(1, Math.min(GALLERY.length, Math.floor(
  (screenFont.screenWidth - WINDOW_LEFT - 2 * MARGIN_ACROSS
   - SPARE_FOR_BORDERS) / CELL_WIDTH)));

const GRID_ROWS = Math.ceil(GALLERY.length / GRID_COLUMNS);

/** The pen the labels are drawn in. */
const LABEL_PEN = 1;

/**
 * Draw every image that exists, and every label, on the grid.
 *
 * Positions are in pixels from the top left corner of the window
 * FRAME, so the left border and the title bar are added on.
 *
 * @param {Window} window - the open window
 * @returns {undefined}
 */
function paintGallery(window) {
  let rastPort = window.rastPort;
  let gridLeft = window.borderLeft + MARGIN_ACROSS;
  let gridTop  = window.borderTop  + MARGIN_DOWN;

  rastPort.setColor(LABEL_PEN);

  for (let index = 0; index < GALLERY.length; index++) {
    let column = index % GRID_COLUMNS;
    let row    = Math.floor(index / GRID_COLUMNS);
    let x      = gridLeft + column * CELL_WIDTH;
    let y      = gridTop  + row * CELL_HEIGHT;

    if (images[index]) {
      Intuition.DrawImage(rastPort, images[index], x, y);
    }

    /* text() puts the BASELINE of the text at the y it is given, so
     * the top of the label plus the font's baseline. */
    let labelTop = y + IMAGE_HEIGHT + LABEL_GAP;

    rastPort.text(x, labelTop + rastPort.fontBaseline, labels[index]);
  }
}


/* ==================================================================
 * 3. THE WINDOW
 * ================================================================== */

let window = null;

try {
  /* WA_InnerWidth and WA_InnerHeight give the size inside the
   * borders; Intuition adds the title bar and borders itself. */
  window = Intuition.OpenWindowTags([
    [C.WA_Left,        WINDOW_LEFT],
    [C.WA_Top,         WINDOW_TOP],
    [C.WA_InnerWidth,  2 * MARGIN_ACROSS + GRID_COLUMNS * CELL_WIDTH],
    [C.WA_InnerHeight, 2 * MARGIN_DOWN + GRID_ROWS * CELL_HEIGHT],
    [C.WA_Title,       'sysiclass image gallery'],
    [C.WA_Flags,       C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                     | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
    [C.WA_IDCMP,       C.IDCMP_CLOSEWINDOW | C.IDCMP_REFRESHWINDOW],
  ]);

  /* The window keeps the screen open from here on. */
  screenFont.close();

  if (!window) {
    print('OpenWindowTags failed');
  }
  else {
    print('Window open. Close to exit.');

    paintGallery(window);

    for (let message of window.messages()) {

      if (message.class === C.IDCMP_CLOSEWINDOW) break;

      if (message.class === C.IDCMP_REFRESHWINDOW) {
        Intuition.BeginRefresh(window);
        paintGallery(window);
        Intuition.EndRefresh(window, true);
      }
    }
  }
}
finally {
  screenFont.close();

  if (window) window.close();

  for (let image of images) {
    if (image) Intuition.DisposeObject(image);
  }
}

print('Clean exit.');
