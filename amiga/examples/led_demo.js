/*
 * led_demo.js - a six-digit LED readout with a Reset button.
 *
 *   +---------------------------+
 *   | Reaction LED              |
 *   +---------------------------+
 *   |         00 00 42          |
 *   | [   Reset   ] [   Quit  ] |
 *   +---------------------------+
 *
 * A window opens showing six seven-segment digits drawn by led.image,
 * counting the seconds since it opened. Reset starts again from zero;
 * Quit or the close gadget ends the demo. After the NDK's LED.c.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), centred
 *   - window.class, layout.gadget, button.gadget and led.image are
 *     installed (standard from OS 3.2; earlier with ClassAct/Reaction)
 *   - an inside of 260 x 80 pixels is enough for the digits and both
 *     buttons
 *   - a led.image can be given to a layout directly as a child
 *   - the count moves on Intuition's tick (IDCMP_INTUITICKS), which
 *     arrives about ten times a second and only while this window is
 *     the active one. Click in another window and the display stands
 *     still; it catches up at the next tick, because the count is
 *     taken from the clock (Date.now()), not from the number of ticks
 *
 * Requires quickjs.library 0.232+ (Led took only a pointer before,
 * and did not repaint).
 * Run: qjs examples/led_demo.js
 */

const { Window, Layout, Button, Led, EventKind, IDCMP,
        IDCMP_REACTION_DEFAULT, WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { RESET: 1, QUIT: 2 };

/** The display has this many pairs of digits: six digits. */
const PAIR_COUNT = 3;

/** Milliseconds in a second: Date.now() counts milliseconds. */
const MS_PER_SECOND = 1000;

/** The number on the display: whole seconds since `startedMs`. */
let counter = 0;

/** The clock when the count last started from zero, in milliseconds. */
let startedMs = Date.now();

/* An LED display is given one number per PAIR of digits, each 0 to 99.
 * Led.pairsOf(1234, 3) is [0, 12, 34], shown as 00 12 34. */
let display = new Led({ values: Led.pairsOf(counter, PAIR_COUNT) });

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
  /* The usual Reaction events do not include the tick, so it is asked
   * for as well. The ticks are what move the count on. */
  idcmp: IDCMP_REACTION_DEFAULT | IDCMP.INTUITICKS,

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
 * Show the seconds that have passed since the count started, if that
 * is not what the display already shows.
 *
 * @param {number} nowMs - the clock, in milliseconds
 * @returns {undefined}
 */
function showCount(nowMs) {
  let seconds = Math.floor((nowMs - startedMs) / MS_PER_SECOND);

  if (seconds === counter) return;

  counter = seconds;
  display.setValues(Led.pairsOf(counter, PAIR_COUNT));
}

/**
 * Start counting from zero again.
 *
 * @returns {undefined}
 */
function resetCounter() {
  startedMs = Date.now();
  counter = 0;
  display.setValues(Led.pairsOf(counter, PAIR_COUNT));
}

window.open();
startedMs = Date.now();
print('Counting seconds; click Reset to start again, Quit to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === ID.QUIT)  break;
      if (event.sourceId === ID.RESET) resetCounter();
    }

    if (event.kind === EventKind.INTUITICKS) showCount(Date.now());
  }
}
finally {
  /* The display goes with the window, and its values with it. */
  window.dispose();
}

print('Bye.');
