/*
 * bevels_demo.js — showcase of every BevelStyle in a grid.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Bevel, Label, EventKind, IDCMP,
        WindowPosition, BevelStyle } = amiga.boopsi;

const names = ['NONE','XEN','RIDGE','GROOVE','BUTTON','DROPBOX','FIELD','TAB','ICON'];
const rows  = [];
for (let i = 0; i < names.length; i++) {
  let b = new Bevel({ style: i, label: names[i] });
  rows.push(b);
}

let quit = new Button({ id: 1, text: '_Quit' });

let win = new Window({
  title: 'Reaction Bevels',
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 3,
    children: [ ...rows, quit ],
  }),
});

win.open();

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === 1) break;
  }
}
finally { win.dispose(); }
print('Bye.');
