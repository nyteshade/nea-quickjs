/*
 * tabs_demo.js — multi-page panel using page.gadget driven by a button row.
 *
 * Three pages share the same window. Each page is its own VLayout
 * with distinct content. A row of buttons at the top switches the
 * Page's `current` attribute, which page.gadget interprets to display
 * exactly one child.
 *
 * Demonstrates:
 *   - Page({ children: [...] }) at 0.157+ — the constructor now
 *     converts children to PAGE_Add tags, mirroring Layout's children
 *     pattern. (At 0.156 you needed manual _extraPairs.)
 *   - Live mutation of a layout-class attribute (PAGE_Current) via
 *     OM_SET driven by user button clicks
 *   - Three independent sub-Layouts coexisting under one Window
 *
 * Requires quickjs.library 0.157+.
 * Run:  qjs examples/tabs_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Label, CheckBox, StringGadget, Page, Slider,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { TAB1: 1, TAB2: 2, TAB3: 3, QUIT: 99 };

/* ---- Build each page as its own Layout ---- */

let page1 = new Layout({
  orientation: 'vertical', innerSpacing: 4,
  bevelStyle: BevelStyle.GROUP, label: 'General',
  children: [
    new Label({ text: 'Welcome to the multi-page demo.' }),
    new Label({ text: 'Click the tabs above to switch pages.' }),
    new StringGadget({ id: 50, text: 'Try editing this field.', maxChars: 64 }),
  ],
});

let page2 = new Layout({
  orientation: 'vertical', innerSpacing: 4,
  bevelStyle: BevelStyle.GROUP, label: 'Options',
  children: [
    new CheckBox({ id: 60, text: 'Enable feature A', selected: true  }),
    new CheckBox({ id: 61, text: 'Enable feature B', selected: false }),
    new CheckBox({ id: 62, text: 'Enable feature C', selected: true  }),
  ],
});

let page3 = new Layout({
  orientation: 'vertical', innerSpacing: 4,
  bevelStyle: BevelStyle.GROUP, label: 'About',
  children: [
    new Label({ text: 'tabs_demo.js' }),
    new Label({ text: 'Reaction OO layer demo' }),
    new Label({ text: 'quickjs.library 0.156+' }),
    new Slider({
      id: 70, min: 0, max: 100, level: 75,
      orientation: 'horizontal', ticks: 11,
    }),
  ],
});

/* ---- Build the Page container ---- */

let pages = new Page({
  current:  0,
  children: [page1, page2, page3],   /* converted to PAGE_Add tags */
});

/* ---- Tab button row + main window ---- */

let tab1Btn = new Button({ id: GID.TAB1, text: 'General' });
let tab2Btn = new Button({ id: GID.TAB2, text: 'Options' });
let tab3Btn = new Button({ id: GID.TAB3, text: 'About'   });
let quitBtn = new Button({ id: GID.QUIT, text: '_Quit'   });

let tabRow = new Layout({
  orientation: 'horizontal', innerSpacing: 2, evenSize: true,
  children: [ tab1Btn, tab2Btn, tab3Btn, quitBtn ],
});

let win = new Window({
  title:       'Tabs Demo',
  innerWidth:  400,
  innerHeight: 240,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ tabRow, pages ],
  }),
});

function selectPage(n) {
  pages.set({ current: n });
}

win.open();
print('Tabs demo. Click General / Options / About to switch.');

let done = false;
try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.TAB1: selectPage(0); break;
        case GID.TAB2: selectPage(1); break;
        case GID.TAB3: selectPage(2); break;
        case GID.QUIT: done = true;   break;
      }
      if (done) break;
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
