/*
 * getcolor_demo.js — Reaction GetColor popup button.
 *
 * Click "Pick…" to open the color requester.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, GetColor, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { PICK: 1, QUIT: 2 };

let pick = new GetColor({
  id: GID.PICK, titleText: 'Choose a color',
  rgbSliders: true, hsbSliders: true, colorWheel: true,
});
let hint = new Label({ text: 'Pick a color from the requester:' });
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction GetColor',
  innerWidth: 300, innerHeight: 100,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ hint, pick, quit ],
  }),
});

win.open();

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.COLOR_SELECTED) {
      print('Got color: R=' + pick.get('red') +
            ' G=' + pick.get('green') +
            ' B=' + pick.get('blue'));
    }
  }
}
finally { win.dispose(); }
print('Bye.');
