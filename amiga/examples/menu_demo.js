/*
 * menu_demo.js - a classic Intuition menu bar, built struct by struct.
 *
 *   +------------------------------------------+
 *   | Project   Options                        |   the screen's title
 *   +-----------+------------------+-----------+   bar, with the right
 *   | Open... O |  Auto-save       |               mouse button held
 *   | Save    S |  Verbose logs    |
 *   | Quit    Q |------------------+
 *   +-----------+
 *
 * A window opens with two menus. Hold the right mouse button over the
 * screen's title bar to see them; every pick is printed on the Shell.
 * Project/Quit, right-Amiga+Q or the close gadget ends the demo.
 *
 * GadTools (CreateMenusA + LayoutMenusA) is the easier way to make
 * menus and lays them out for you. This script fills in the raw Menu,
 * MenuItem and IntuiText structs instead, to show what is underneath.
 *
 * The file has three parts:
 *
 *   1. BUILDING MENUS  - labels, items and menus, and freeing them.
 *   2. THE WINDOW      - the two menus, and the window they go on.
 *   3. THE LOOP        - menu picks in, lines on the Shell out.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), which is at
 *     least 520 x 220 pixels and not a low-resolution one (the room
 *     left for checkmarks and shortcuts is the header's CHECKWIDTH
 *     and COMMWIDTH, which are for a screen 640 or more across)
 *   - menus are drawn in the screen's font, so the items are sized
 *     and placed by measuring that font
 *   - pens 0 and 1 are the menu background and text colours
 *   - the Menu and MenuItem structs must outlive the menu strip, so
 *     the strip is cleared before anything is freed
 *
 * Requires quickjs.library 0.237+ (CHECKWIDTH and COMMWIDTH arrived
 * then).
 * Run: qjs examples/menu_demo.js
 */

import * as std from 'qjs:std';

/* The newest thing this script uses is Intuition.consts.CHECKWIDTH,
 * which arrived in 0.237. */
if (typeof Intuition !== 'function' ||
    typeof amiga.ScreenFont !== 'function' ||
    typeof amiga.intuition.Menu !== 'function' ||
    typeof amiga.intuition.IntuiText !== 'function' ||
    !('CHECKWIDTH' in Intuition.consts) ||
    typeof Intuition.MENUNUM !== 'function') {
  print('Need quickjs.library 0.237 or later');
  std.exit(1);
}

const C = Intuition.consts;

const { ScreenFont } = amiga;
const { Menu, MenuItem, IntuiText } = amiga.intuition;


/* ==================================================================
 * 1. BUILDING MENUS
 *
 * A menu strip is a linked list of Menu structs. Each Menu points at a
 * linked list of MenuItem structs, and each MenuItem points at an
 * IntuiText holding its label. The helpers here build those and hand
 * back everything that has to be freed afterwards.
 * ================================================================== */

/* MenuItem and Menu flag bits, by name (intuition/intuition.h):
 *
 *   CHECKIT      the item can carry a checkmark
 *   ITEMTEXT     ItemFill is an IntuiText
 *   COMMSEQ      the item has an Amiga-key shortcut
 *   MENUTOGGLE   picking it flips the checkmark
 *   ITEMENABLED  the item can be picked
 *   HIGHCOMP     highlight by inverting the item
 *   CHECKED      the checkmark is showing
 *   MENUENABLED  Menu flag: the menu can be opened
 *
 * They can be joined with | like numbers. */
const { CHECKIT, ITEMTEXT, COMMSEQ, MENUTOGGLE, ITEMENABLED, HIGHCOMP,
        CHECKED, MENUENABLED } = C;

/** The menu number meaning "nothing (more) was picked". Number() is
 *  needed because it is compared with === against a plain number
 *  below, and a constant is only equal to itself. */
const MENUNULL = Number(C.MENUNULL);

/** IntuiText draw mode: draw the text only, leave the background
 *  (graphics/rastport.h). */
const JAM1 = Graphics.consts.JAM1;

/** Pens for the labels. */
const LABEL_FRONT_PEN = 1;
const LABEL_BACK_PEN  = 0;

/* Intuition draws menus in the screen's font and lays nothing out:
 * every item's position and size is ours to give, in pixels. The user
 * chooses that font, so the sizes are measured, not fixed. ScreenFont
 * reads the font before any window exists. */
let screenFont = new ScreenFont();

/** Where a label sits inside its item: a pixel of space all round. */
const LABEL_X = 1;
const LABEL_Y = 1;

/** Height of each item in a menu, and the distance from the top of
 *  one item to the top of the next. With an 8-pixel font these are
 *  the customary 10 and 11. */
const ITEM_HEIGHT = screenFont.height + 2 * LABEL_Y;
const ITEM_PITCH  = ITEM_HEIGHT + 1;

/** Room Intuition needs inside an item (intuition/intuition.h): on
 *  the left for the checkmark of an item that has one, and on the
 *  right for the Amiga-key symbol of an item with a shortcut, which
 *  is followed by the shortcut's letter. */
const CHECK_ROOM    = Number(C.CHECKWIDTH);
const SHORTCUT_ROOM = Number(C.COMMWIDTH) + screenFont.nominalWidth;

/** Space after the longest label, and after a menu's title in the
 *  menu bar: one character. */
const LABEL_GAP = screenFont.nominalWidth;

/**
 * How wide an item has to be to hold its label and whatever Intuition
 * draws beside it.
 *
 * @param {object} description - as for makeItem
 * @returns {number} pixels
 */
function widthNeeded(description) {
  return labelLeft(description) + screenFont.widthOf(description.label)
       + LABEL_GAP
       + (description.command ? SHORTCUT_ROOM : 0);
}

/**
 * Where an item's label starts. A checkable item keeps its label
 * clear of the checkmark, which Intuition draws at the item's left
 * edge; until 0.237 this script started every label at the edge, so
 * the mark was drawn over the first letters of the Options items.
 *
 * @param {object} description - as for makeItem
 * @returns {number} pixels from the item's left edge
 */
function labelLeft(description) {
  return description.checkable ? CHECK_ROOM : LABEL_X;
}

/**
 * How wide a menu's title is in the menu bar.
 *
 * @param {string} title
 * @returns {number} pixels
 */
function titleWidth(title) {
  return screenFont.widthOf(title) + 2 * LABEL_GAP;
}

/**
 * Build the IntuiText for one menu-item label. The IntuiText owns a
 * copy of the string and releases it in free().
 *
 * @param {string} label
 * @param {number} leftEdge - x offset inside the menu item, in pixels
 * @returns {IntuiText}
 */
function makeLabel(label, leftEdge) {
  return new IntuiText({
    frontPen: LABEL_FRONT_PEN,
    backPen:  LABEL_BACK_PEN,
    drawMode: JAM1,
    leftEdge: leftEdge || 0,
    topEdge:  LABEL_Y,
    text:     label,
  });
}

/**
 * Build one MenuItem, not yet linked to anything.
 *
 * @param {object}  description
 * @param {string}  description.label - visible text
 * @param {number}  [description.leftEdge=0] - x inside the menu, pixels
 * @param {number}  [description.topEdge=0] - y inside the menu, pixels
 * @param {number}  [description.width] - pixels; what the label needs
 *   when left out
 * @param {number}  [description.height] - pixels; ITEM_HEIGHT when
 *   left out
 * @param {number}  [description.command] - character code of the
 *   Amiga-key shortcut; leave out for none
 * @param {boolean} [description.checkable] - true for a checkmark item
 * @param {boolean} [description.checked] - whether it starts checked
 * @returns {{item: MenuItem, label: IntuiText}}
 */
function makeItem(description) {
  let label = makeLabel(description.label, labelLeft(description));
  let item  = new MenuItem();

  item.leftEdge = description.leftEdge || 0;
  item.topEdge  = description.topEdge  || 0;
  item.width    = description.width    || widthNeeded(description);
  item.height   = description.height   || ITEM_HEIGHT;

  let flags = ITEMENABLED | HIGHCOMP | ITEMTEXT;

  if (description.command)   flags |= COMMSEQ;
  if (description.checkable) flags |= CHECKIT | MENUTOGGLE;
  if (description.checked)   flags |= CHECKED;

  item.flags         = flags;
  item.itemFill      = label.ptr;
  item.command       = description.command || 0;
  item.mutualExclude = 0;
  item.subItem       = 0;
  item.nextItem      = 0;

  return { item, label };
}

/**
 * Build a Menu and its items, stacked one under another and linked
 * together. Every item is as wide as the widest needs to be.
 * Everything returned must be released with freeMenu().
 *
 * @param {string} title - the word in the menu bar
 * @param {number} leftEdge - x position in the menu bar, in pixels
 * @param {Array<object>} descriptions - one per item, as for makeItem;
 *   topEdge, width and height are filled in when left out
 * @returns {{menu: Menu,
 *            titleAlloc: {ptr: number, size: number},
 *            items: Array<{item: MenuItem, label: IntuiText}>}}
 */
function makeMenu(title, leftEdge, descriptions) {
  let menu  = new Menu();
  let items = [];
  let top   = 0;
  let width = Math.max(...descriptions.map(widthNeeded));

  for (let description of descriptions) {
    let { item, label } = makeItem({
      topEdge: top,
      width:   width,
      height:  ITEM_HEIGHT,
      ...description,
    });

    items.push({ item, label });
    top += ITEM_PITCH;
  }

  /* Link each item to the one below it. The last keeps the 0 that
   * makeItem gave it, which ends the list. */
  for (let index = 0; index < items.length - 1; index++) {
    items[index].item.nextItem = items[index + 1].item.ptr;
  }

  /* Menu.menuName is a bare pointer, so the title string is allocated
   * here and freed in freeMenu(). */
  let titleBytes = title.length + 1;        /* the title and its NUL */
  let titlePtr   = amiga.allocMem(titleBytes);

  amiga.pokeString(titlePtr, title);

  menu.leftEdge  = leftEdge;
  menu.topEdge   = 0;
  menu.width     = titleWidth(title);
  menu.height    = 0;                       /* Intuition works it out */
  menu.flags     = MENUENABLED;
  menu.menuName  = titlePtr;
  menu.firstItem = items[0] ? items[0].item.ptr : 0;
  menu.nextMenu  = 0;

  return {
    menu,
    titleAlloc: { ptr: titlePtr, size: titleBytes },
    items,
  };
}

/**
 * Free everything makeMenu() allocated.
 *
 * @param {{menu: Menu,
 *          titleAlloc: {ptr: number, size: number},
 *          items: Array<{item: MenuItem, label: IntuiText}>}} built
 * @returns {undefined}
 */
function freeMenu(built) {
  for (let { item, label } of built.items) {
    label.free();
    item.free();
  }

  if (built.titleAlloc) {
    amiga.freeMem(built.titleAlloc.ptr, built.titleAlloc.size);
  }

  built.menu.free();
}


/* ==================================================================
 * 2. THE WINDOW
 *
 * The two menus, the window, and the three Intuition calls that have
 * no wrapper method yet and so are made through amiga.call().
 *
 * The menus are built first. They need no window, and if one cannot
 * be built there is then no window to leave open.
 * ================================================================== */

/** Where the things the loop looks for sit in the menu strip. */
const PROJECT_MENU_NUMBER = 0;
const QUIT_ITEM_NUMBER    = 2;

/** Where the Options menu starts in the menu bar: straight after the
 *  Project menu's title. */
const OPTIONS_MENU_LEFT = titleWidth('Project');

/**
 * The character code of a shortcut key.
 *
 * @param {string} key - one character
 * @returns {number}
 */
function shortcut(key) {
  return key.charCodeAt(0);
}

let projectMenu = null;
let optionsMenu = null;
let window      = null;

/**
 * Free whatever of the two menus has been built, and unlock the
 * screen if it is still locked.
 *
 * @returns {undefined}
 */
function freeMenus() {
  if (optionsMenu) freeMenu(optionsMenu);
  if (projectMenu) freeMenu(projectMenu);

  optionsMenu = null;
  projectMenu = null;
  screenFont.close();
}

try {
  projectMenu = makeMenu('Project', 0, [
    { label: 'Open...', command: shortcut('O') },
    { label: 'Save',    command: shortcut('S') },
    { label: 'Quit',    command: shortcut('Q') },
  ]);

  optionsMenu = makeMenu('Options', OPTIONS_MENU_LEFT, [
    { label: 'Auto-save',    checkable: true, checked: true },
    { label: 'Verbose logs', checkable: true, checked: false },
  ]);

  /* The strip is the Project menu followed by the Options menu. */
  projectMenu.menu.nextMenu = optionsMenu.menu.ptr;

  /* The window draws nothing of its own, so it asks to hear only
   * about its close gadget and its menus. */
  window = Intuition.OpenWindowTags([
    [C.WA_Left,   40],
    [C.WA_Top,    40],
    [C.WA_Width,  480],
    [C.WA_Height, 180],
    [C.WA_Title,  'Menu Demo - press right-Amiga + Q to quit'],
    [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
                | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
    [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MENUPICK],
  ]);
}
catch (error) {
  freeMenus();
  throw error;
}

/* The window keeps the screen open from here on, and everything has
 * been measured, so the lock that ScreenFont holds can go. */
screenFont.close();

if (!window) {
  print('OpenWindowTags failed');
  freeMenus();
  std.exit(1);
}

/**
 * Put the menu strip on the window.
 *
 * @returns {undefined}
 */
function setMenuStrip() {
  amiga.call(Intuition.ensureLibrary(),
    amiga.intuition.lvo.SetMenuStrip,
    { a0: window.ptr, a1: projectMenu.menu.ptr });
}

/**
 * Take the menu strip off the window. This has to happen before the
 * Menu structs are freed, or Intuition would read freed memory.
 *
 * @returns {undefined}
 */
function clearMenuStrip() {
  amiga.call(Intuition.ensureLibrary(),
    amiga.intuition.lvo.ClearMenuStrip,
    { a0: window.ptr });
}

/**
 * Find the MenuItem a menu number refers to.
 *
 * @param {number} menuCode - a packed menu number, as in a MENUPICK
 * @returns {number} struct MenuItem pointer, or 0 if there is none
 */
function itemAddress(menuCode) {
  return amiga.call(Intuition.ensureLibrary(),
    amiga.intuition.lvo.ItemAddress,
    { a0: projectMenu.menu.ptr, d0: menuCode });
}


/* ==================================================================
 * 3. THE LOOP
 *
 * A MENUPICK message carries a 16-bit menu number: which menu, which
 * item and which sub-item, packed together. The user can pick several
 * items in one go; each picked MenuItem then holds the number of the
 * next one in its NextSelect field, and MENUNULL ends the chain.
 * ================================================================== */

/**
 * Print every pick in one MENUPICK message, following the chain.
 *
 * @param {number} firstCode - the message's code field
 * @returns {boolean} true if Project/Quit was among the picks
 */
function reportPicks(firstCode) {
  let menuCode   = firstCode;
  let shouldQuit = false;

  while (menuCode !== MENUNULL) {
    /* Intuition.MENUNUM and ITEMNUM are the header's macros of the
     * same names: they pull the menu and the item out of the number. */
    let menuNum = Intuition.MENUNUM(menuCode);
    let itemNum = Intuition.ITEMNUM(menuCode);

    print('pick: menu=' + menuNum + ' item=' + itemNum);

    if (menuNum === PROJECT_MENU_NUMBER && itemNum === QUIT_ITEM_NUMBER) {
      shouldQuit = true;
    }

    let itemPtr = itemAddress(menuCode);
    if (!itemPtr) break;

    menuCode = new MenuItem(itemPtr).nextSelect;
  }

  return shouldQuit;
}

setMenuStrip();
print('Menu open. Right-click the screen bar; pick Project/Quit or ' +
      'press right-Amiga+Q to exit.');

try {
  for (let message of window.messages()) {
    if (message.class === C.IDCMP_CLOSEWINDOW) break;

    if (message.class === C.IDCMP_MENUPICK) {
      if (reportPicks(message.code)) break;
    }
  }
}
finally {
  clearMenuStrip();
  window.close();
  freeMenus();
}

print('Clean exit.');
