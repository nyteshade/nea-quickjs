/*
 * clicktab_demo.js — clicktab.gadget (ClickTab) with the 0.168
 * `labels:` helper and an attached Page of sub-layouts.
 *
 * Three tabs, each showing a different sub-layout. ClickTab's
 * CLICKTAB_PageGroup attribute bound to a Page gadget lets
 * Reaction auto-sync tab selection with page flip — no JS switch
 * logic needed. A Quit button at the bottom closes.
 *
 * Requires quickjs.library 0.168+.
 * Run: qjs examples/clicktab_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Page, Button, ClickTab, Label, CheckBox,
        StringGadget, Slider, EventKind, WindowPosition,
        BevelStyle } = amiga.boopsi;

const GID = { TABS: 1, QUIT: 99 };

/* Three pages. Each lives in its own Layout. */

let pageGeneral = new Layout({
  orientation: 'vertical', innerSpacing: 4,
  bevelStyle: BevelStyle.GROUP, label: 'General',
  children: [
    new Label({ text: 'Welcome to the ClickTab demo.' }),
    new Label({ text: 'Click a tab above to switch.' }),
    new StringGadget({ id: 50, text: 'Editable field here.', maxChars: 64 }),
  ],
});

let pageOptions = new Layout({
  orientation: 'vertical', innerSpacing: 4,
  bevelStyle: BevelStyle.GROUP, label: 'Options',
  children: [
    new CheckBox({ id: 60, text: 'Option _A', selected: true  }),
    new CheckBox({ id: 61, text: 'Option _B', selected: false }),
    new CheckBox({ id: 62, text: 'Option _C', selected: true  }),
  ],
});

let pageAbout = new Layout({
  orientation: 'vertical', innerSpacing: 4,
  bevelStyle: BevelStyle.GROUP, label: 'About',
  children: [
    new Label({ text: 'clicktab_demo.js' }),
    new Label({ text: 'Exercises the 0.168 labels:[] helper' }),
    new Slider({
      id: 70, min: 0, max: 100, level: 50,
      orientation: 'horizontal', ticks: 11,
    }),
  ],
});

let pages = new Page({
  current: 0,
  children: [pageGeneral, pageOptions, pageAbout],
});

/* The ClickTab — 0.168 helper builds TNA-node list from the labels
 * array. pageGroup binds the tab to the Page so flipping is automatic. */
let tabs = new ClickTab({
  id:        GID.TABS,
  labels:    ['General', 'Options', 'About'],
  current:   0,
  pageGroup: pages.ptr,
});

let quitBtn = new Button({ id: GID.QUIT, text: '_Quit' });

/* Per NDK Examples/Page.c the Page is "embedded inside the ClickTab"
 * via CLICKTAB_PageGroup — ClickTab's beveling surrounds the page and
 * ClickTab manages the page-flip on tab clicks. The Page must NOT
 * also be a sibling of ClickTab in the outer Layout — duplicating it
 * makes the page content render twice (once where ClickTab places it,
 * once as a separate Layout child) and double-disposes at quit time
 * (ClickTab.DisposeObject cascades through PageGroup; outer Layout
 * also disposes the same Page from its children list). */
let win = new Window({
  title:       'ClickTab Demo',
  innerWidth:  420,
  innerHeight: 260,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ tabs, quitBtn ],
  }),
});

win.open();
print('ClickTab demo open. Switch tabs, then Quit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.CLICKTAB_CHANGE && e.sourceId === GID.TABS) {
      let ix = (typeof e.attrs.current === 'number')
                 ? e.attrs.current : tabs.get('current');
      print('tab ' + ix);
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
