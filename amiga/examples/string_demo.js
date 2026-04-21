/*
 * string_demo.js — StringGadget entry field.
 *
 * Demonstrates a single-line text field with STRING_CHANGED events,
 * reading the current text via textVal, and an optional
 * StringHookType (try PASSWORD) filter.
 *
 * Requires quickjs.library 0.148+.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, StringGadget, Label, EventKind, IDCMP,
        WindowPosition, StringHookType } = amiga.boopsi;

const GID = { NAME: 1, PASS: 2, OK: 3, QUIT: 4 };

let lblName = new Label({ text: 'Name:' });
let name    = new StringGadget({
  id: GID.NAME, maxChars: 64,
});

let lblPass = new Label({ text: 'Password:' });
let pass    = new StringGadget({
  id: GID.PASS, maxChars: 64, hookType: StringHookType.PASSWORD,
});

let ok   = new Button({ id: GID.OK,   text: '_OK' });
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let row  = (a, b) => new Layout({
  orientation: 'horizontal', innerSpacing: 4, children: [a, b],
});

let win = new Window({
  title: 'Reaction StringGadget', innerWidth: 320, innerHeight: 120,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      row(lblName, name),
      row(lblPass, pass),
      row(ok, quit),
    ],
  }),
});

win.open();
print('Type into either field; hit OK to print, Quit to exit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      if (e.sourceId === GID.QUIT) break;
      if (e.sourceId === GID.OK) {
        print('name=' + (name.get('textVal') || ''));
        print('pass=' + (pass.get('textVal') ? '<hidden>' : ''));
      }
    }
  }
}
finally { win.dispose(); }
print('Bye.');
