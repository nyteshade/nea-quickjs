/*
 * tapedeck_demo.js — Reaction TapeDeck (VCR transport control).
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, TapeDeck, Label, EventKind, IDCMP,
        WindowPosition, TapeDeckMode } = amiga.boopsi;

const GID = { DECK: 1, QUIT: 2 };

let deck = new TapeDeck({
  id: GID.DECK, mode: TapeDeckMode.STOP,
});
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction TapeDeck', innerWidth: 300, innerHeight: 90,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ new Label({ text: 'Transport controls:' }), deck, quit ],
  }),
});

win.open();

const modeNames = ['STOP','PLAY','FFWD','REW','RECORD','EJECT','PAUSE','STEP_FWD','STEP_REW'];

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.TAPEDECK_CLICK) {
      print('mode = ' + (modeNames[e.raw.code] || '?') +
            ' (' + e.raw.code + ')');
    }
  }
}
finally { win.dispose(); }
print('Bye.');
