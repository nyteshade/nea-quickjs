/*
 * getfile_demo.js — Reaction GetFile popup (file requester button).
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, GetFile, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { PICK: 1, QUIT: 2 };

let pick = new GetFile({
  id: GID.PICK, titleText: 'Pick any file',
  drawer: 'SYS:',
  fullFileExpand: true,
});
let hint = new Label({ text: 'Pick a file:' });
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction GetFile', innerWidth: 320, innerHeight: 100,
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
    if (e.kind === EventKind.FILE_SELECTED) {
      print('Selected: ' + pick.get('fullFile'));
    }
  }
}
finally { win.dispose(); }
print('Bye.');
