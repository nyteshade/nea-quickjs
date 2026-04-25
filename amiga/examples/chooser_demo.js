/*
 * chooser_demo.js — chooser.gadget with the 0.168 `labels:` helper.
 *
 * A dropdown of seven colour names. Selecting one updates a status
 * readout. Also has a readonly StringGadget showing the currently
 * selected index/name live, and a Quit button.
 *
 * Requires quickjs.library 0.168+ (AllocChooserNodeA helper).
 * Run: qjs examples/chooser_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Chooser, StringGadget, Label,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { CHOOSER: 1, QUIT: 99 };

const COLOURS = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'];

let chooser = new Chooser({
  id:       GID.CHOOSER,
  labels:   COLOURS,           /* 0.168 helper — builds a CNA-node list */
  dropDown: true,
  active:   3,                 /* start on "Green" */
});

let status = new StringGadget({
  text: 'Selected: Green (index 3)',
  readOnly: true, maxChars: 64, minVisible: 32,
});

let quitBtn = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title:       'Chooser Demo',
  innerWidth:  300,
  innerHeight: 140,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  /* Vertical layout — earlier horizontal Label+Chooser row had the
   * dropdown drifting far right because the equal-weight default
   * gave the Chooser half the row width. Vertical avoids the weight
   * question entirely. (Real fix is exposing CHILD_WeightedWidth
   * so per-child weights can be set; that's separate work.) */
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [
      new Label({ text: 'Colour:' }),
      chooser,
      status,
      quitBtn,
    ],
  }),
});

win.open();
print('Chooser open. Pick a colour from the dropdown.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.CHOOSER_SELECT && e.sourceId === GID.CHOOSER) {
      /* Phase D auto-fill populates e.attrs.active on Chooser. Fall back
       * to OM_GET if a future version doesn't. */
      let ix = (typeof e.attrs.active === 'number')
                 ? e.attrs.active : chooser.get('active');
      if (typeof ix === 'number' && ix >= 0 && ix < COLOURS.length) {
        status.text = 'Selected: ' + COLOURS[ix] + ' (index ' + ix + ')';
        print('picked ' + COLOURS[ix]);
      }
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
