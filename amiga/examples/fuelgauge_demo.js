/*
 * fuelgauge_demo.js - a progress bar you fill up five percent at a time.
 *
 *   +--------------------------------------+
 *   | Fuel gauge demo:                     |
 *   | [##########    35%                 ] |   the gauge
 *   |  |  '  |  '  |  '  |  '  |  '  |  '  |   tick marks
 *   | [   +5%   ] [  Reset  ] [   Quit   ] |
 *   +--------------------------------------+
 *
 * Click +5% to move the bar on, Reset to empty it. Each click also
 * prints the new level on the Shell. The bar stops at 100%.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 320 x 100 window interior
 *   - fuelgauge.gadget, label.image, button.gadget, layout.gadget and
 *     window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - window.class reports button clicks even though the `idcmp:` mask
 *     below asks only for close, refresh and attribute updates
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/fuelgauge_demo.js
 */

const { Window, Layout, Button, FuelGauge, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { STEP: 1, RESET: 2, QUIT: 3 };

/** The two ends of the gauge, in percent. */
const EMPTY = 0;
const FULL  = 100;

/** How far one click of the +5% button moves the bar, in percent. */
const STEP_PERCENT = 5;

/** FUELGAUGE_Ticks: how many long tick marks to draw. Eleven is meant
 *  as one every ten percent, both ends included. */
const LONG_TICKS = 11;

/** FUELGAUGE_ShortTicks: non-zero draws short marks in between. */
const SHORT_TICKS = 1;

let gauge = new FuelGauge({
  min:         EMPTY,
  max:         FULL,
  level:       EMPTY,
  percent:     true,
  orientation: 'horizontal',
  ticks:       LONG_TICKS,
  shortTicks:  SHORT_TICKS,
});

let titleLabel  = new Label({ text: 'Fuel gauge demo:' });
let stepButton  = new Button({ id: ID.STEP,  text: '+_5%' });
let resetButton = new Button({ id: ID.RESET, text: '_Reset' });
let quitButton  = new Button({ id: ID.QUIT,  text: '_Quit' });

let window = new Window({
  title:       'Reaction FuelGauge',
  innerWidth:  320,
  innerHeight: 100,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation:  'vertical',
    innerSpacing: 4,
    children: [

      titleLabel,

      gauge,

      new Layout({
        orientation:  'horizontal',
        innerSpacing: 4,
        children: [stepButton, resetButton, quitButton],
      }),

    ],
  }),
});

/** How full the gauge is, in percent. The gauge only ever shows this. */
let level = EMPTY;

/** What each button makes of the current level. */
const onClick = {
  [ID.STEP]:  (current) => Math.min(FULL, current + STEP_PERCENT),
  [ID.RESET]: ()        => EMPTY,
};

window.open();
print('Click +5% to advance; Reset to zero; Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === ID.QUIT) break;

      if (onClick[event.sourceId]) level = onClick[event.sourceId](level);

      gauge.set({ level });
      print('level = ' + level + '%');
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
