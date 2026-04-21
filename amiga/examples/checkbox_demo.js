/*
 * checkbox_demo.js — port of sdks/NDK3.2R4/Examples/CheckBox.c.
 *
 * Two checkboxes + an explanatory label + a Quit button arranged
 * vertically. Demonstrates CHECKBOX_TOGGLE events and reading the
 * checked state after each click.
 *
 * Requires quickjs.library 0.148+ (Phase C).
 *
 * Run:  qjs examples/checkbox_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, CheckBox, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { CB1: 1, CB2: 2, QUIT: 3 };

let cb1  = new CheckBox({ id: GID.CB1, text: 'CheckBox _1' });
let cb2  = new CheckBox({ id: GID.CB2, text: 'CheckBox _2' });
let note = new Label({
  text: 'The checkbox may have its label placed\n' +
        'either on the left or right side.\n \n' +
        'You may click the label text as well\n' +
        'as the check box itself.',
});
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title:       'ReAction CheckBox Example',
  screenTitle: 'ReAction',
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [ cb1, cb2, note, quit ],
  }),
});

win.open();
print('Click the checkboxes; click Quit or the close gadget to exit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;

    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) {
      break;
    }

    if (e.kind === EventKind.CHECKBOX_TOGGLE) {
      let checked = e.source ? e.source.checked : null;
      print('CB' + e.sourceId + ' → ' + (checked ? 'checked' : 'unchecked'));
    }
  }
}
finally { win.dispose(); }

print('Bye.');
