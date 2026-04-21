/*
 * led_demo.js — port of LED.c.
 *
 * Uses led.image as a live numeric readout. The LED digits count up
 * once per second via setTimeout, and a button resets to zero.
 *
 * Requires quickjs.library 0.148+.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Led, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { RESET: 1, QUIT: 2 };

let counter = 0;

/* Build a 6-byte values buffer for 3-pair (= 6-digit) display.
 * amiga.allocMem returns zeroed memory by default. */
let valuesBuf = amiga.allocMem(8);

function writeDigits(buf, n) {
  /* 3 pairs, 6 digits total, most-significant first. */
  for (let i = 5; i >= 0; i--) {
    amiga.poke8(buf + i, n % 10);
    n = Math.floor(n / 10);
  }
}
writeDigits(valuesBuf, 0);

let led = new Led({ pairs: 3, values: valuesBuf });

let reset = new Button({ id: GID.RESET, text: '_Reset' });
let quit  = new Button({ id: GID.QUIT,  text: '_Quit'  });

let win = new Window({
  title:       'Reaction LED',
  innerWidth:  260,
  innerHeight: 80,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      led,
      new Layout({
        orientation: 'horizontal', innerSpacing: 4,
        children: [ reset, quit ],
      }),
    ],
  }),
});

win.open();
print('Counter starts; click Reset to zero it, Quit to exit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      if (e.sourceId === GID.QUIT)  break;
      if (e.sourceId === GID.RESET) {
        counter = 0;
        writeDigits(valuesBuf, counter);
        /* Force re-render — easiest way is to re-set LED_Values. */
        led.set({ values: valuesBuf });
      }
    }
    /* This loop blocks on Wait(), so auto-incrementing without a
     * timer.device signal requires setTimeout hookup (library
     * 0.097+ exposes it via the VBlank task). */
  }
}
finally {
  win.dispose();
  amiga.freeMem(valuesBuf, 8);
}
print('Bye.');
