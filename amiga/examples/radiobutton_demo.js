/*
 * radiobutton_demo.js — Reaction RadioButton demo.
 *
 * Three-choice selector built from a JS string array. Shows how to
 * use RADIOBUTTON_Strings (a NULL-terminated STRPTR array allocated
 * via exec.AllocMem) plus the RADIO_SELECT EventKind. Also covers
 * how to read the current index with RADIOBUTTON_Selected via the
 * `selectedIx` wrapper attr.
 *
 * Requires quickjs.library 0.148+.
 *
 * Run:  qjs examples/radiobutton_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, RadioButton, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { RADIO: 1, QUIT: 2 };

/* amiga.makeStringArray (0.149+) builds a NULL-terminated STRPTR
 * array plus a free() closure that releases both the strings and
 * the array in one call. */
const choices = ['_Apples', '_Bananas', '_Cherries'];
const labels  = amiga.makeStringArray(choices);

let radio = new RadioButton({
  id:         GID.RADIO,
  strings:    labels.ptr,
  selectedIx: 0,
});

let hint = new Label({ text: 'Pick your favorite fruit.' });
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title:       'Reaction RadioButton',
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ hint, radio, quit ],
  }),
});

win.open();
print('Pick one; click Quit to exit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.RADIO_SELECT) {
      print('Selected: ' + choices[e.raw.code] +
            ' (index ' + e.raw.code + ')');
    }
  }
}
finally {
  win.dispose();
  labels.free();
}
print('Bye.');
