/*
 * getscreenmode_demo.js — Reaction GetScreenMode popup.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, GetScreenMode, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { PICK: 1, QUIT: 2 };

let pick = new GetScreenMode({
  id: GID.PICK, titleText: 'Pick a screen mode',
  doWidth: true, doHeight: true, doDepth: true,
});
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction GetScreenMode',
  innerWidth: 320, innerHeight: 80,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ new Label({ text: 'Pick a screen mode:' }), pick, quit ],
  }),
});

win.open();

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
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
