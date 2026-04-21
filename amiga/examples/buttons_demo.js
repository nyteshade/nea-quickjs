/*
 * buttons_demo.js — port of Buttons.c.
 *
 * A row of four buttons (OK, Cancel, Help, About) over a Bevel-
 * framed message box. Each button prints its ID when clicked.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Label, Bevel, EventKind, IDCMP,
        WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { OK: 1, CANCEL: 2, HELP: 3, ABOUT: 4 };

function btn(id, text) { return new Button({ id, text }); }

let msg = new Bevel({
  style: BevelStyle.FIELD,
  label: 'This is a message framed by a BEVEL.',
});
let row = new Layout({
  orientation: 'horizontal', innerSpacing: 4,
  children: [
    btn(GID.OK,     '_OK'),
    btn(GID.CANCEL, '_Cancel'),
    btn(GID.HELP,   '_Help'),
    btn(GID.ABOUT,  '_About'),
  ],
});

let win = new Window({
  title: 'Reaction Buttons',
  innerWidth: 420, innerHeight: 100,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ msg, row ],
  }),
});

win.open();
print('Click any button.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      const names = { 1: 'OK', 2: 'Cancel', 3: 'Help', 4: 'About' };
      print('Clicked ' + (names[e.sourceId] || '?'));
      if (e.sourceId === GID.OK || e.sourceId === GID.CANCEL) break;
    }
  }
}
finally { win.dispose(); }
print('Bye.');
