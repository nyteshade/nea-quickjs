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

/* Build a NULL-terminated array of STRPTRs for RADIOBUTTON_Strings.
 * Each string is a separate allocMem+pokeString; the array itself is
 * allocMem of (N+1)*4 bytes. */
const choices = ['_Apples', '_Bananas', '_Cherries'];
const strPtrs = [];
for (let c of choices) {
  let b = c.length + 1;
  let p = amiga.allocMem(b);
  amiga.pokeString(p, c);
  strPtrs.push([p, b]);
}
let arr = amiga.allocMem((choices.length + 1) * 4);
for (let i = 0; i < choices.length; i++) amiga.poke32(arr + i * 4, strPtrs[i][0]);
amiga.poke32(arr + choices.length * 4, 0);  /* NULL terminator */

let radio = new RadioButton({
  id:         GID.RADIO,
  strings:    arr,
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
  for (let [p, b] of strPtrs) amiga.freeMem(p, b);
  amiga.freeMem(arr, (choices.length + 1) * 4);
}
print('Bye.');
