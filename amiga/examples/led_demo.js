/*
 * led_demo.js - a six-digit LED readout with a Reset button.
 *
 *   +---------------------------+
 *   | Reaction LED              |
 *   +---------------------------+
 *   |         00 00 00          |
 *   | [   Reset   ] [   Quit  ] |
 *   +---------------------------+
 *
 * A window opens showing six seven-segment digits drawn by led.image,
 * all zero. Reset writes zeros to the display again; Quit or the close
 * gadget ends the demo. The counter does not advance in this version:
 * the loop sleeps until the window has an event and nothing wakes it
 * to count, so the digits stay at zero. A port of the NDK's LED.c.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), centred
 *   - window.class, layout.gadget, button.gadget and led.image are
 *     installed (standard from OS 3.2; earlier with ClassAct/Reaction)
 *   - an inside of 260 x 80 pixels is enough for the digits and both
 *     buttons
 *   - a led.image can be given to a layout directly as a child
 *   - led.image keeps the pointer it is given rather than copying the
 *     digits, so the buffer has to stay allocated until the window is
 *     disposed
 *   - setting the image's `values` again is enough to make it redraw
 *   - amiga.allocMem returns zeroed memory, and does not fail
 *
 * Requires quickjs.library 0.148+.
 * Run: qjs examples/led_demo.js
 */

const { Window, Layout, Button, Led, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { RESET: 1, QUIT: 2 };

/** The display has this many pairs of digits. */
const PAIR_COUNT  = 3;
const DIGIT_COUNT = 6;

/** Size of the buffer the digits live in, in bytes. */
const DIGIT_BUFFER_BYTES = 8;

/**
 * Write a number into the digit buffer, one byte per decimal digit,
 * most significant first.
 *
 * FIXME: images/led.h describes LED_Values as an array of WORDs, one
 * per pair, not a byte per digit. It makes no difference while every
 * digit is zero. Kept as it has always been in this example and
 * reported, not changed.
 *
 * @param {number} buffer - address of at least DIGIT_COUNT bytes
 * @param {number} value - a whole number, 0 to 999999
 * @returns {undefined}
 */
function writeDigits(buffer, value) {
  let rest = value;

  for (let index = DIGIT_COUNT - 1; index >= 0; index--) {
    amiga.poke8(buffer + index, rest % 10);
    rest = Math.floor(rest / 10);
  }
}

/** The number on the display. */
let counter = 0;

let digitBuffer = amiga.allocMem(DIGIT_BUFFER_BYTES);
writeDigits(digitBuffer, 0);

let display = new Led({ pairs: PAIR_COUNT, values: digitBuffer });

let resetButton = new Button({ id: ID.RESET, text: '_Reset' });
let quitButton  = new Button({ id: ID.QUIT,  text: '_Quit'  });

let window = new Window({
  title:       'Reaction LED',
  innerWidth:  260,
  innerHeight: 80,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [

      display,

      new Layout({
        orientation: 'horizontal',
        innerSpacing: 4,
        children: [resetButton, quitButton],
      }),

    ],
  }),
});

/**
 * Put the counter back to zero and show it.
 *
 * @returns {undefined}
 */
function resetCounter() {
  counter = 0;
  writeDigits(digitBuffer, counter);

  /* The image does not notice the buffer changing under it. Handing
   * it the same pointer again makes it draw the new digits. */
  display.set({ values: digitBuffer });
}

window.open();
print('Counter starts; click Reset to zero it, Quit to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === ID.QUIT)  break;
      if (event.sourceId === ID.RESET) resetCounter();
    }
  }
}
finally {
  window.dispose();
  amiga.freeMem(digitBuffer, DIGIT_BUFFER_BYTES);
}

print('Bye.');
