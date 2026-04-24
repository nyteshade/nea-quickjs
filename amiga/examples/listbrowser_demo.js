/*
 * listbrowser_demo.js — single-column listbrowser.gadget with the
 * 0.168 `labels:` helper.
 *
 * Shows a scrollable list of planet names. Selecting a row updates a
 * readonly status line. Quit closes.
 *
 * Requires quickjs.library 0.168+.
 * Run: qjs examples/listbrowser_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, ListBrowser, StringGadget,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { LIST: 1, QUIT: 99 };

const PLANETS = [
  'Mercury', 'Venus', 'Earth', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune',
  'Pluto (dwarf)', 'Ceres (dwarf)', 'Makemake (dwarf)', 'Haumea (dwarf)',
];

let list = new ListBrowser({
  id:     GID.LIST,
  labels: PLANETS,    /* 0.168 helper — builds single-column LBNCA_Text rows */
});

let status = new StringGadget({
  text: 'Pick a planet.',
  readOnly: true, maxChars: 64, minVisible: 32,
});

let quitBtn = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title:       'ListBrowser Demo',
  innerWidth:  360,
  innerHeight: 260,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true,
  sizeGadget:  true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [ list, status, quitBtn ],
  }),
});

win.open();
print('ListBrowser open. Pick a planet, then Quit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.LIST_SELECT && e.sourceId === GID.LIST) {
      /* LISTBROWSER_Selected reports the clicked row index (or -1). */
      let sel = list.get('selected');
      if (typeof sel === 'number' && sel >= 0 && sel < PLANETS.length) {
        status.text = 'Selected #' + sel + ': ' + PLANETS[sel];
        print('picked ' + PLANETS[sel]);
      }
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
