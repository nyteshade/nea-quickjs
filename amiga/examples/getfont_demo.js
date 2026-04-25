/*
 * getfont_demo.js — Reaction GetFont popup.
 *
 * The GetFont gadget by itself is a passive display of the current
 * font. To open the picker, send GFONT_REQUEST via the .request()
 * helper — typically wired to a "Pick Font..." button.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, GetFont, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { PICK_DISPLAY: 1, PICK_BUTTON: 2, QUIT: 3 };

let pick = new GetFont({
  id: GID.PICK_DISPLAY, titleText: 'Pick a font',
  minHeight: 6, maxHeight: 72,
});
let pickBtn = new Button({ id: GID.PICK_BUTTON, text: 'Pick _Font...' });
let quit    = new Button({ id: GID.QUIT,        text: '_Quit' });

let win = new Window({
  title: 'Reaction GetFont', innerWidth: 320, innerHeight: 110,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      new Label({ text: 'Pick a font:' }),
      pick,
      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ pickBtn, quit ],
      }),
    ],
  }),
});

win.open();
print('GetFont open. Click "Pick Font..." to open the requester.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      if (e.sourceId === GID.QUIT) break;
      if (e.sourceId === GID.PICK_BUTTON) {
        pick.request(win.intuiWindow.ptr);
      }
    }
    if (e.kind === EventKind.FONT_SELECTED) {
      let ta = pick.get('textAttr');
      if (ta) {
        let namePtr = amiga.peek32(ta + 0);
        let height  = amiga.peek16(ta + 4);
        let name    = namePtr ? amiga.peekString(namePtr) : '(null)';
        print('Selected: ' + name + ' / ' + height);
      } else {
        print('Selected: (TextAttr not available)');
      }
    }
  }
}
finally { win.dispose(); }
print('Bye.');
