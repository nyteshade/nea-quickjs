/*
 * speedbar_demo.js — speedbar.gadget with the 0.168 `buttons:` helper.
 *
 * Horizontal toolbar of 5 text-label buttons (Cut / Copy / Paste /
 * Undo / Redo) across the top of a window. Clicks print the button
 * ordinal and update a status line.
 *
 * Requires quickjs.library 0.168+.
 * Run: qjs examples/speedbar_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, SpeedBar, StringGadget, Label,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { BAR: 1, QUIT: 99 };

const ACTIONS = ['Cut', 'Copy', 'Paste', 'Undo', 'Redo'];

let bar = new SpeedBar({
  id:       GID.BAR,
  buttons:  ACTIONS,   /* 0.168 helper — builds SBNA_Text nodes, ordinal=index */
});

let status = new StringGadget({
  text: 'Click a toolbar button.',
  readOnly: true, maxChars: 64, minVisible: 32,
});

let quitBtn = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title:       'SpeedBar Demo',
  innerWidth:  360,
  innerHeight: 180,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [ bar, status, quitBtn ],
  }),
});

win.open();
print('SpeedBar open. Click a button.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.sourceId === GID.BAR) {
      /* speedbar.gadget reports the clicked button's ordinal in the
       * event code (NDK Examples/SpeedBar.c reads it from WMHI_GADGETUP's
       * code), which we set = index via AllocSpeedButtonNodeA's d0 arg.
       * SPEEDBAR_Selected is only a fallback. Anything unexpected is
       * shown instead of being dropped, so a click is never silent. */
      let ord = e.raw.code;
      if (!(ord >= 0 && ord < ACTIONS.length)) ord = bar.get('selected');
      if (typeof ord === 'number' && ord >= 0 && ord < ACTIONS.length) {
        status.text = 'Clicked: ' + ACTIONS[ord] + ' (#' + ord + ')';
        print('speedbar ' + ACTIONS[ord]);
      }
      else {
        let what = 'code=' + e.raw.code + ' selected=' + bar.get('selected');
        status.text = 'Click, but no button id: ' + what;
        print('speedbar event with no button id: ' + what);
      }
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
