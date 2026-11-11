/*
 * boopsi_refresh_probe.js - does setting a gadget's text redraw it cleanly?
 *
 * Opens a small window with one read-only StringGadget, a "Next" button
 * and a "Quit" button. Each click on Next puts the next of four sample
 * strings into the StringGadget, prints which one, and prints the text
 * the gadget reports when read back.
 *
 * Click Next a few times and watch the text: each string should replace
 * the last with nothing of the old one left behind. Quit, or the close
 * gadget, ends the probe.
 *
 * Assumptions:
 *   - string.gadget, button.gadget, layout.gadget and window.class are
 *     installed
 *   - the window opens on the default public screen, which has room
 *     for a 420 x 140 window
 *   - every sample string is shorter than the gadget's 80 characters
 *
 * Background: a clean replace on every click confirms that the gadget
 * path of BOOPSIBase.set() (SetGadgetAttrsA) is doing its refresh job
 * correctly. Use this as a regression probe when touching BOOPSIBase,
 * Layout or StringGadget. It used to test Label (label.image)
 * dispose-and-replace. That path proved unsafe on OS3.2 and was
 * removed: Label is now documented for static text only, and a
 * read-only StringGadget, the canonical OS3.2 widget for mutable text,
 * is what to reach for when the text changes, exactly as done here.
 * See the JSDoc in Label.js. Some names and comments below still say
 * "label" for that reason.
 *
 * Requires quickjs.library 0.153+.
 * Run: qjs examples/boopsi_refresh_probe.js
 */

const { Window, Layout, StringGadget, Button, EventKind,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs of the two buttons. */
const GID = { NEXT: 1, QUIT: 2 };

/** The strings Next cycles through, of deliberately different lengths. */
const SAMPLES = [
  'Initial text, fairly short.',
  'Second text - a bit longer than the first.',
  'Third - short.',
  'Fourth, longer still, growing the label area.',
];

/* Index into SAMPLES of the string now showing. */
let sampleIndex = 0;
let lbl = new StringGadget({
  text: SAMPLES[sampleIndex],
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
  for (let event of win.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === GID.QUIT) break;
      if (event.sourceId === GID.NEXT) {
        sampleIndex = (sampleIndex + 1) % SAMPLES.length;
        print('\n=== Next click #' + sampleIndex + ' -> ' +
              SAMPLES[sampleIndex]);
        lbl.text = SAMPLES[sampleIndex];
        /* Read back - if get() reports the new text, OM_SET did
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
