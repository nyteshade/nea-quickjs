/*
 * menu_demo.js — classic Intuition menu bar: Project menu with Open /
 * Save / Quit items (Amiga-key shortcuts), Options menu with two
 * checkable items. Demonstrates Menu + MenuItem + IntuiText struct
 * wrappers working together.
 *
 * The modern path is GadTools.CreateMenusA + LayoutMenusA (more
 * ergonomic, handles layout automatically) — this script uses the
 * raw Menu/MenuItem structs to show how the underlying data model
 * works and to exercise the wrappers directly.
 *
 * Demonstrates:
 *   - new IntuiText({...}) — constructable struct with owned text
 *     allocation and frontPen/backPen/drawMode fields
 *   - new MenuItem() / new Menu() — constructable 34-byte / 30-byte
 *     structs, chained via nextItem / nextMenu
 *   - Intuition.SetMenuStrip(window, firstMenu) + ClearMenuStrip
 *     (raw-FFI escape hatch — no wrapper method yet)
 *   - IDCMP_MENUPICK handling: msg.code is a MENUNUM (16-bit packed
 *     MENUSHIFT=5|ITEMSHIFT=6|SUBSHIFT=5 fields); Intuition.ItemAddress
 *     converts back to a MenuItem* for a NEXT-menu-pick walk
 *   - MENUNULL = 0xFFFF sentinel that ends a chained menu-pick
 *
 * Run:        qjs examples/menu_demo.js
 * Requires:   quickjs.library 0.137+ (uses Menu/MenuItem/IntuiText
 *             struct wrappers shipped at 0.133/0.134)
 */

import * as std from 'qjs:std';

if (typeof Intuition !== 'function' ||
    typeof amiga.intuition.Menu !== 'function' ||
    typeof amiga.intuition.IntuiText !== 'function') {
  print('Required wrappers unavailable — need quickjs.library 0.137+');
  std.exit(1);
}

const C = Intuition.consts;
const M = amiga.intuition;

/* Menu / MenuItem flag bits from intuition/intuition.h. Not yet in
 * Intuition.consts, so use literal values with comments. */
const ITEMENABLED = 0x0001;
const HIGHCOMP    = 0x0040;
const ITEMTEXT    = 0x0002;
const COMMSEQ     = 0x0004;
const CHECKIT     = 0x0008;
const CHECKED     = 0x0100;
const MENUTOGGLE  = 0x0010;
const MENUENABLED = 0x0001;

const MENUNULL    = 0xFFFF;

/**
 * Build an IntuiText describing a single menu-item label.
 *
 * @param   {string} label
 * @param   {number} leftEdge — x offset inside the menu item
 * @returns {IntuiText}
 */
function makeLabel(label, leftEdge) {
  return new M.IntuiText({
    frontPen: 1,
    backPen:  0,
    drawMode: 0,       /* JAM1 */
    leftEdge: leftEdge || 0,
    topEdge:  1,
    text:     label,   /* owned allocation — freed on .free() */
  });
}

/**
 * Build a MenuItem ready to be chained into a menu.
 *
 * @param   {object} opts
 * @param   {string} opts.label     — visible text
 * @param   {number} opts.leftEdge  — X position inside the menu
 * @param   {number} opts.topEdge   — Y position inside the menu
 * @param   {number} opts.width
 * @param   {number} opts.height
 * @param   {number} opts.command   — Amiga-key shortcut (0 for none)
 * @param   {boolean} opts.checkable — true to add CHECKIT/MENUTOGGLE
 * @param   {boolean} opts.checked   — initial CHECKED state
 * @returns {{item: MenuItem, label: IntuiText}}
 */
function makeItem(opts) {
  let label = makeLabel(opts.label, 1);
  let item  = new M.MenuItem();

  item.leftEdge  = opts.leftEdge || 0;
  item.topEdge   = opts.topEdge  || 0;
  item.width     = opts.width    || 120;
  item.height    = opts.height   || 10;

  let flags = ITEMENABLED | HIGHCOMP | ITEMTEXT;

  if (opts.command)   flags |= COMMSEQ;
  if (opts.checkable) flags |= CHECKIT | MENUTOGGLE;
  if (opts.checked)   flags |= CHECKED;

  item.flags    = flags;
  item.itemFill = label.ptr;
  item.command  = opts.command || 0;
  item.mutualExclude = 0;
  item.subItem       = 0;
  item.nextItem      = 0;

  return { item, label };
}

/**
 * Build a Menu with the given list of item descriptors, chaining
 * them together. Returned objects own both structs and labels —
 * free them all when done.
 *
 * @param   {string}         title
 * @param   {number}         leftEdge — X position in the menu bar
 * @param   {Array<object>}  items
 * @returns {{menu: Menu, title: number, items: Array, labels: Array}}
 */
function makeMenu(title, leftEdge, items) {
  let menu  = new M.Menu();
  let built = [];
  let yOff  = 0;

  for (let desc of items) {
    let { item, label } = makeItem({
      topEdge: yOff,
      height:  10,
      ...desc,
    });
    built.push({ item, label });
    yOff += 11;
  }

  /* Chain the items: firstItem → item0 → item1 → ... → 0 */
  for (let i = 0; i < built.length - 1; i++) {
    built[i].item.nextItem = built[i + 1].item.ptr;
  }

  /* Allocate + own the menu title string. */
  let titleBytes = title.length + 1;
  let titlePtr   = amiga.allocMem(titleBytes);

  amiga.pokeString(titlePtr, title);

  menu.leftEdge = leftEdge;
  menu.topEdge  = 0;
  menu.width    = 80;
  menu.height   = 0;      /* Intuition computes */
  menu.flags    = MENUENABLED;
  menu.menuName = titlePtr;
  menu.firstItem = built[0] ? built[0].item.ptr : 0;
  menu.nextMenu  = 0;

  return {
    menu,
    titleAlloc: { ptr: titlePtr, size: titleBytes },
    items: built,
  };
}

/**
 * Free every wrapper + owned string in a makeMenu result.
 *
 * @param {{menu: Menu, titleAlloc: {ptr: number, size: number}, items: Array}} m
 * @returns {undefined}
 */
function freeMenu(m) {
  for (let { item, label } of m.items) {
    label.free();
    item.free();
  }

  if (m.titleAlloc) {
    amiga.freeMem(m.titleAlloc.ptr, m.titleAlloc.size);
  }

  m.menu.free();
}

let win = Intuition.OpenWindowTags([
  [C.WA_Left,   40],
  [C.WA_Top,    40],
  [C.WA_Width,  480],
  [C.WA_Height, 180],
  [C.WA_Title,  'Menu Demo — press right-Amiga + Q to quit'],
  [C.WA_Flags,  C.WFLG_DRAGBAR | C.WFLG_DEPTHGADGET
              | C.WFLG_CLOSEGADGET | C.WFLG_ACTIVATE],
  [C.WA_IDCMP,  C.IDCMP_CLOSEWINDOW | C.IDCMP_MENUPICK
              | C.IDCMP_REFRESHWINDOW],
]);

if (!win) {
  print('OpenWindowTags failed');
  std.exit(1);
}

let projectMenu = makeMenu('Project', 0, [
  { label: 'Open…', width: 140, command: 'O'.charCodeAt(0) },
  { label: 'Save',  width: 140, command: 'S'.charCodeAt(0) },
  { label: 'Quit',  width: 140, command: 'Q'.charCodeAt(0) },
]);

let optionsMenu = makeMenu('Options', 80, [
  { label: 'Auto-save',    width: 140, checkable: true, checked: true },
  { label: 'Verbose logs', width: 140, checkable: true, checked: false },
]);

projectMenu.menu.nextMenu = optionsMenu.menu.ptr;

/**
 * Install the menu strip on our window. Uses raw-FFI escape hatch
 * because Intuition wrapper doesn't expose SetMenuStrip yet.
 *
 * @returns {undefined}
 */
function setMenu() {
  amiga.call(Intuition.ensureLibrary(),
    amiga.intuition.lvo.SetMenuStrip,
    { a0: win.ptr, a1: projectMenu.menu.ptr });
}

/**
 * Remove the menu strip before closing. Must run before we free
 * the Menu structs or Intuition will dereference freed memory.
 *
 * @returns {undefined}
 */
function clearMenu() {
  amiga.call(Intuition.ensureLibrary(),
    amiga.intuition.lvo.ClearMenuStrip,
    { a0: win.ptr });
}

/**
 * Unpack a MENUPICK code into its menu/item/subitem indices.
 *
 * @param   {number} code
 * @returns {{menuNum: number, itemNum: number, subNum: number}}
 */
function unpackMenuNum(code) {
  return {
    menuNum: code & 0x001F,         /* low 5 bits */
    itemNum: (code >> 5) & 0x003F,  /* next 6 bits */
    subNum:  (code >> 11) & 0x001F, /* top 5 bits */
  };
}

setMenu();
print('Menu open. Right-click the screen bar; pick Project/Quit or ' +
      'press right-Amiga+Q to exit.');

try {
  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) {
      break;
    }

    if (msg.class === C.IDCMP_MENUPICK) {
      /* A single pick may chain to more via NextSelect on each
       * MenuItem; keep walking until we see MENUNULL. */
      let code = msg.code;
      let shouldQuit = false;

      while (code !== MENUNULL) {
        let { menuNum, itemNum } = unpackMenuNum(code);

        print('pick: menu=' + menuNum + ' item=' + itemNum);

        /* Project menu is 0, Quit is item 2 in that menu. */
        if (menuNum === 0 && itemNum === 2) {
          shouldQuit = true;
        }

        /* ItemAddress(menuStrip, code) returns the MenuItem* so we
         * can walk nextSelect. Raw-FFI escape hatch. */
        let itemPtr = amiga.call(Intuition.ensureLibrary(),
          amiga.intuition.lvo.ItemAddress,
          { a0: projectMenu.menu.ptr, d0: code });

        if (!itemPtr) break;

        code = amiga.peek16(itemPtr + 32);  /* nextSelect */
      }

      if (shouldQuit) break;
    }
  }
}

finally {
  clearMenu();
  win.close();
  freeMenu(optionsMenu);
  freeMenu(projectMenu);
}

print('Clean exit.');
