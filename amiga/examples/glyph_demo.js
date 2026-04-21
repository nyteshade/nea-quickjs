/*
 * glyph_demo.js — display every standard OS3 glyph in a row.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Glyph, Label, EventKind, IDCMP,
        WindowPosition, GlyphKind } = amiga.boopsi;

const entries = Object.entries(GlyphKind);   /* [name, value] pairs */
const rows = [];
for (let [name, val] of entries) {
  rows.push(new Layout({
    orientation: 'horizontal', innerSpacing: 4,
    children: [
      new Glyph({ glyph: val }),
      new Label({ text: name }),
    ],
  }));
}

let quit = new Button({ id: 1, text: '_Quit' });

let win = new Window({
  title: 'Reaction Glyphs',
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 2,
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
