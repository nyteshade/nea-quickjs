/*
 * datebrowser_demo.js — Reaction DateBrowser (calendar picker).
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, DateBrowser, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { CAL: 1, QUIT: 2 };

let cal = new DateBrowser({
  id: GID.CAL,
  year: 2026, month: 4, day: 21,
  weekNumbers: true, highlightToday: true,
});
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction DateBrowser', innerWidth: 300, innerHeight: 240,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ new Label({ text: 'Pick a date:' }), cal, quit ],
  }),
});

win.open();

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.DATE_CHANGE) {
      print('Picked: ' + cal.get('year') + '-' +
            String(cal.get('month')).padStart(2, '0') + '-' +
            String(cal.get('day')).padStart(2, '0'));
    }
  }
}
finally { win.dispose(); }
print('Bye.');
