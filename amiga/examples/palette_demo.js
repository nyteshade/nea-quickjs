/*
 * palette_demo.js — port of Palette.c.
 *
 * Click a color in the palette to see its index printed.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Palette, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { PAL: 1, QUIT: 2 };

let pal = new Palette({
  id: GID.PAL,
  numColors:   8,     /* show 8 pens starting at colorOffset */
  colorOffset: 0,
  color:       1,     /* initially selected pen index */
});

let hint = new Label({ text: 'Click a color:' });
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction Palette',
  innerWidth: 220, innerHeight: 120,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ hint, pal, quit ],
  }),
});

win.open();
print('Click a color; Quit to exit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.PALETTE_CHANGE) {
      print('Picked color index ' + e.raw.code);
    }
  }
}
finally { win.dispose(); }
print('Bye.');
