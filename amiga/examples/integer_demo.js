/*
 * integer_demo.js — port of Integer.c.
 *
 * Clamped numeric field [0..999] with up/down spin arrows. Shows
 * INTEGER_CHANGED events carrying the new value in e.raw.code.
 *
 * Requires quickjs.library 0.148+.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Integer, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { INT: 1, QUIT: 2 };

let title = new Label({ text: 'Enter a number 0..999:' });
let num   = new Integer({
  id: GID.INT, value: 42, minimum: 0, maximum: 999,
  maxChars: 3, arrows: true,
});
let quit  = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction Integer', innerWidth: 250, innerHeight: 80,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ title, num, quit ],
  }),
});

win.open();
print('Edit the number; click Quit to exit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.INTEGER_CHANGED) {
      print('value = ' + e.raw.code);
    }
  }
}
finally { win.dispose(); }
print('Bye.');
