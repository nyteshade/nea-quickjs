/*
 * scroller_demo.js — Reaction Scroller (scrollbar).
 *
 * Vertical + horizontal scrollbars with live position printed.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Scroller, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { VSCR: 1, HSCR: 2, QUIT: 3 };

let vscr = new Scroller({
  id: GID.VSCR, orientation: 'vertical',
  top: 0, visible: 20, total: 200, arrows: 15,
});
let hscr = new Scroller({
  id: GID.HSCR, orientation: 'horizontal',
  top: 0, visible: 100, total: 1000, arrows: 15,
});
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction Scroller',
  innerWidth: 320, innerHeight: 200,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      new Label({ text: 'Horizontal:' }), hscr,
      new Label({ text: 'Vertical:' }),   vscr,
      quit,
    ],
  }),
});

win.open();
print('Drag scrollbars; Quit to exit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.SCROLLER_CHANGE) {
      let name = (e.sourceId === GID.VSCR) ? 'V' : 'H';
      print(name + '.top = ' + (e.source ? e.source.get('top') : '?'));
    }
  }
}
finally { win.dispose(); }
print('Bye.');
