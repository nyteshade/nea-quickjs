/*
 * boopsi_refresh_probe.js — minimal happy-path for runtime text
 * updates. Opens a tiny window with one read-only StringGadget
 * (canonical OS3.2 widget for mutable text), a "Next" button, and a
 * "Quit" button. Each Next click cycles the StringGadget through a
 * short list of sample strings.
 *
 * Clean replace on every click confirms the gadget-path of
 * BOOPSIBase.set() (SetGadgetAttrsA) is doing its refresh job
 * correctly. Use this as a regression probe when touching
 * BOOPSIBase, Layout, or StringGadget.
 *
 * NOTE: this used to test Label (label.image) dispose-and-replace.
 * That path proved unsafe on OS3.2 and was removed — Label is now
 * documented for static text only; reach for a read-only
 * StringGadget for dynamic text, exactly as done here. See
 * Label.js JSDoc.
 */

import * as std from 'qjs:std';

const { Window, Layout, StringGadget, Button, EventKind,
        WindowPosition } = amiga.boopsi;

const GID = { NEXT: 1, QUIT: 2 };

const SAMPLES = [
  'Initial text, fairly short.',
  'Second text — a bit longer than the first.',
  'Third — short.',
  'Fourth, longer still, growing the label area.',
];

let idx = 0;
let lbl = new StringGadget({
  text: SAMPLES[idx],
  readOnly: true,
  maxChars: 80,
});

let win = new Window({
  title: 'Refresh Probe',
  innerWidth:  420,
  innerHeight: 140,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 8,
    children: [
      lbl,
      new Layout({
        orientation: 'horizontal', innerSpacing: 6, evenSize: true,
        children: [
          new Button({ id: GID.NEXT, text: '_Next' }),
          new Button({ id: GID.QUIT, text: '_Quit' }),
        ],
      }),
    ],
  }),
});

win.open();
print('--- probe opened; click Next to cycle label text ---');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      if (e.sourceId === GID.QUIT) break;
      if (e.sourceId === GID.NEXT) {
        idx = (idx + 1) % SAMPLES.length;
        print('\n=== Next click #' + idx + ' → ' + SAMPLES[idx]);
        lbl.text = SAMPLES[idx];
        /* Read back — if get() reports the new text, OM_SET did
         * update the label's internal state and this is purely a
         * repaint problem. If get() still reports the old text,
         * OM_SET isn't accepted and we need a different approach
         * (dispose+new-label, or switch to a readonly StringGadget). */
        try {
          let reported = lbl.get('text');
          print('[probe] lbl.get("text") after set: ' +
                JSON.stringify(reported));
        } catch (err) {
          print('[probe] lbl.get("text") threw: ' + err);
        }
      }
    }
  }
}
finally {
  print('--- disposing window ---');
  win.dispose();
  print('--- disposed ---');
}
print('Bye.');
