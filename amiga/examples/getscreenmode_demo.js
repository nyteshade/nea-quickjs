/*
 * getscreenmode_demo.js — Reaction GetScreenMode popup.
 *
 * As with GetFont, the gadget itself is a passive display — call
 * .request(win.intuiWindow.ptr) from a separate "Pick..." button to
 * open the screen-mode requester.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, GetScreenMode, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { PICK_DISPLAY: 1, PICK_BUTTON: 2, QUIT: 3 };

let pick = new GetScreenMode({
  id: GID.PICK_DISPLAY, titleText: 'Pick a screen mode',
  doWidth: true, doHeight: true, doDepth: true,
});
let pickBtn = new Button({ id: GID.PICK_BUTTON, text: 'Pick _Screen Mode...' });
let quit    = new Button({ id: GID.QUIT,        text: '_Quit' });

let win = new Window({
  title: 'Reaction GetScreenMode',
  innerWidth: 360, innerHeight: 110,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      new Label({ text: 'Pick a screen mode:' }),
      pick,
      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ pickBtn, quit ],
      }),
    ],
  }),
});

win.open();
print('GetScreenMode open. Click "Pick Screen Mode..." to open the requester.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      if (e.sourceId === GID.QUIT) break;
      if (e.sourceId === GID.PICK_BUTTON) {
        pick.request(win.intuiWindow.ptr);
      }
    }
    if (e.kind === EventKind.SCREENMODE_SELECTED) {
      print('DisplayID=0x' + pick.get('displayID').toString(16) +
            '  ' + pick.get('displayWidth') + 'x' +
                    pick.get('displayHeight') + 'x' +
                    pick.get('displayDepth'));
    }
  }
}
finally { win.dispose(); }
print('Bye.');
