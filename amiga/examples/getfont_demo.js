/*
 * getfont_demo.js — Reaction GetFont popup.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, GetFont, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { PICK: 1, QUIT: 2 };

let pick = new GetFont({
  id: GID.PICK, titleText: 'Pick a font',
  fontName: 'topaz.font', fontHeight: 8,
});
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction GetFont', innerWidth: 300, innerHeight: 80,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ new Label({ text: 'Pick a font:' }), pick, quit ],
  }),
});

win.open();

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.FONT_SELECTED) {
      print('Selected: ' + pick.get('fontName') + '/' + pick.get('fontHeight'));
    }
  }
}
finally { win.dispose(); }
print('Bye.');
