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
 *   2. THE WINDOW      - the window and the two menus put on it.
 *   3. THE LOOP        - menu picks in, lines on the Shell out.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), which is at
 *     least 520 x 220 pixels
 *   - the screen font is about 8 pixels high: item positions and sizes
 *     are fixed numbers, not measured from the font
 *   - pens 0 and 1 are the menu background and text colours
 *   - the Menu and MenuItem structs must outlive the menu strip, so
 *     the strip is cleared before anything is freed
 *
 * Requires quickjs.library 0.137+.
 * Run: qjs examples/menu_demo.js
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function' ||
    typeof amiga.intuition.Menu !== 'function' ||
    typeof amiga.intuition.IntuiText !== 'function') {
  print('Required wrappers unavailable - need quickjs.library 0.137+');
  std.exit(1);
}

const C = Intuition.consts;

const { Menu, MenuItem, IntuiText } = amiga.intuition;


/* ==================================================================
 * 1. BUILDING MENUS
 *
 * A menu strip is a linked list of Menu structs. Each Menu points at a
 * linked list of MenuItem structs, and each MenuItem points at an
 * IntuiText holding its label. The helpers here build those and hand
 * back everything that has to be freed afterwards.
 * ================================================================== */

/* MenuItem and Menu flag bits. They are not in Intuition.consts, so
 * they are spelled out here.
 * Values from intuition/intuition.h. */
const CHECKIT     = 0x0001;   /* the item can carry a checkmark */
const ITEMTEXT    = 0x0002;   /* ItemFill is an IntuiText */
const COMMSEQ     = 0x0004;   /* the item has an Amiga-key shortcut */
const MENUTOGGLE  = 0x0008;   /* picking it flips the checkmark */
const ITEMENABLED = 0x0010;   /* the item can be picked */
const HIGHCOMP    = 0x0040;   /* highlight by inverting the item */
const CHECKED     = 0x0100;   /* the checkmark is showing */

const MENUENABLED = 0x0001;   /* Menu flag: the menu can be opened */

/** The menu number meaning "nothing (more) was picked"
 *  (MENUNULL, intuition/intuition.h). */
const MENUNULL = 0xFFFF;

/** IntuiText draw mode: draw the text only, leave the background
 *  (JAM1, graphics/rastport.h). */
const JAM1 = 0;

/** Pens for the labels. */
const LABEL_FRONT_PEN = 1;
const LABEL_BACK_PEN  = 0;

/** Where a label sits inside its item, in pixels. */
const LABEL_LEFT = 1;
const LABEL_TOP  = 1;

/** Size of an item when the description does not give one, in
 *  pixels. */
const DEFAULT_ITEM_WIDTH  = 120;
const DEFAULT_ITEM_HEIGHT = 10;

/** Height of each item in a menu and the distance from the top of one
 *  item to the top of the next, in pixels. */
const ITEM_HEIGHT = 10;
const ITEM_PITCH  = 11;

/** Width of a menu's title in the menu bar, in pixels. */
const MENU_TITLE_WIDTH = 80;

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
    topEdge:  LABEL_TOP,
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
 * @param {number}  [description.width=120] - pixels
 * @param {number}  [description.height=10] - pixels
 * @param {number}  [description.command] - character code of the
 *   Amiga-key shortcut; leave out for none
 * @param {boolean} [description.checkable] - true for a checkmark item
 * @param {boolean} [description.checked] - whether it starts checked
 * @returns {{item: MenuItem, label: IntuiText}}
 */
function makeItem(description) {
  let label = makeLabel(description.label, LABEL_LEFT);
  let item  = new MenuItem();

  item.leftEdge = description.leftEdge || 0;
  item.topEdge  = description.topEdge  || 0;
  item.width    = description.width    || DEFAULT_ITEM_WIDTH;
  item.height   = description.height   || DEFAULT_ITEM_HEIGHT;

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
 * together. Everything returned must be released with freeMenu().
 *
 * @param {string} title - the word in the menu bar
 * @param {number} leftEdge - x position in the menu bar, in pixels
 * @param {Array<object>} descriptions - one per item, as for makeItem;
 *   topEdge and height are filled in when left out
 * @returns {{menu: Menu,
 *            titleAlloc: {ptr: number, size: number},
 *            items: Array<{item: MenuItem, label: IntuiText}>}}
 */
function makeMenu(title, leftEdge, descriptions) {
  let menu  = new Menu();
  let items = [];
  let top   = 0;

  for (let description of descriptions) {
    let { item, label } = makeItem({
      topEdge: top,
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
  menu.width     = MENU_TITLE_WIDTH;
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
 * The window, the two menus, and the three Intuition calls that have
 * no wrapper method yet and so are made through amiga.call().
 * ================================================================== */

/** Where the things the loop looks for sit in the menu strip. */
const PROJECT_MENU_NUMBER = 0;
const QUIT_ITEM_NUMBER    = 2;

/** Where the Options menu starts in the menu bar, in pixels. */
const OPTIONS_MENU_LEFT = 80;

/** Width of every item in both menus, in pixels. */
const ITEM_WIDTH = 140;

/**
 * The character code of a shortcut key.
 *
 * @param {string} key - one character
 * @returns {number}
 */
function shortcut(key) {
  return key.charCodeAt(0);
}

let window = Intuition.OpenWindowTags([
  [C.WA_Left,   40],
  [C.WA_Top,    40],
  [C.WA_Width,  480],
  [C.WA_Height, 180],
  [C.WA_Title,  'Menu Demo - press right-Amiga + Q to quit'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MENUPICK
              | C.IDCMP_REFRESHWINDOW],
]);

if (!window) {
  print('OpenWindowTags failed');
  std.exit(1);
}

let projectMenu = makeMenu('Project', 0, [
  { label: 'Open...', width: ITEM_WIDTH, command: shortcut('O') },
  { label: 'Save',    width: ITEM_WIDTH, command: shortcut('S') },
  { label: 'Quit',    width: ITEM_WIDTH, command: shortcut('Q') },
]);

let optionsMenu = makeMenu('Options', OPTIONS_MENU_LEFT, [
  { label: 'Auto-save',    width: ITEM_WIDTH, checkable: true,
    checked: true },
  { label: 'Verbose logs', width: ITEM_WIDTH, checkable: true,
    checked: false },
]);

/* The strip is the Project menu followed by the Options menu. */
projectMenu.menu.nextMenu = optionsMenu.menu.ptr;

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

/* How a menu number is packed (the MENUNUM, ITEMNUM and SUBNUM macros
 * in intuition/intuition.h): menu in the low 5 bits, item in the next
 * 6, sub-item in the top 5. */
const MENU_NUMBER_MASK  = 0x1F;
const ITEM_NUMBER_SHIFT = 5;
const ITEM_NUMBER_MASK  = 0x3F;
const SUB_NUMBER_SHIFT  = 11;
const SUB_NUMBER_MASK   = 0x1F;

/** Byte offset of the UWORD NextSelect field in struct MenuItem
 *  (intuition/intuition.h). */
const MENUITEM_NEXTSELECT = 32;

/**
 * Unpack a menu number into its menu, item and sub-item indices.
 *
 * @param {number} menuCode
 * @returns {{menuNum: number, itemNum: number, subNum: number}}
 */
function unpackMenuNum(menuCode) {
  return {
    menuNum: menuCode & MENU_NUMBER_MASK,
    itemNum: (menuCode >> ITEM_NUMBER_SHIFT) & ITEM_NUMBER_MASK,
    subNum:  (menuCode >> SUB_NUMBER_SHIFT) & SUB_NUMBER_MASK,
  };
}

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
    let { menuNum, itemNum } = unpackMenuNum(menuCode);

    print('pick: menu=' + menuNum + ' item=' + itemNum);

    if (menuNum === PROJECT_MENU_NUMBER && itemNum === QUIT_ITEM_NUMBER) {
      shouldQuit = true;
    }

    let itemPtr = itemAddress(menuCode);
    if (!itemPtr) break;

    menuCode = amiga.peek16(itemPtr + MENUITEM_NEXTSELECT);
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
  freeMenu(optionsMenu);
  freeMenu(projectMenu);
}

print('Clean exit.');
