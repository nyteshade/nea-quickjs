/*
 * stopwatch_demo.js - a start / stop / reset stopwatch with LED digits.
 *
 *   +------------------------------------------------+
 *   |              00 : 01 : 27 : 40                 |   LED digits
 *   | [  Start  ] [  Stop  ] [  Reset  ] [  Quit  ]  |
 *   +------------------------------------------------+
 *
 * Start sets it running, Stop holds it, Start carries on from where it
 * stopped, Reset goes back to zero (and leaves it running if it was).
 * The display is hours, minutes, seconds and a last pair whose first
 * digit is tenths of a second. Whichever of Start and Stop makes no
 * sense at the moment is ghosted.
 *
 * The file has three parts, read top to bottom:
 *
 *   1. THE STOPWATCH - elapsed time and whether it is running. No GUI.
 *   2. THE PANEL     - the window, written as a tree that looks like it.
 *   3. THE LOOP      - clicks and ticks in, stopwatch told, panel
 *                      redrawn.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 300 x 120 pixels inside
 *   - window.class, layout.gadget, button.gadget and led.image are
 *     installed in SYS:Classes, as they are on AmigaOS 3.2
 *   - the display is refreshed on Intuition's tick (IDCMP_INTUITICKS):
 *     about ten a second, so tenths are the finest it can show, and
 *     only while this window is the active one. Click in another
 *     window and the display stands still; the time that passed is
 *     added on at the next tick
 *   - the time itself comes from Date.now(), read at each tick and
 *     taken to be in milliseconds
 *   - hours wrap round after 23
 *
 * Requires quickjs.library 0.232+ (Led took only a pointer before,
 * and did not repaint).
 * Run: qjs examples/stopwatch_demo.js
 */

const { Window, Layout, Button, Led,
        EventKind, IDCMP, WindowPosition,
        IDCMP_REACTION_DEFAULT } = amiga.boopsi;


/* ==================================================================
 * 1. THE STOPWATCH
 *
 * Elapsed time in hundredths of a second, and how to split it into
 * digits. The clock reading is always passed in, so nothing here
 * depends on the machine it runs on.
 * ================================================================== */

/** Milliseconds in one hundredth of a second, the unit the display
 *  works in. */
const MS_PER_CENTISECOND = 10;

class Stopwatch {
  /**
   * A stopwatch at zero, not running.
   */
  constructor() {
    /** @type {boolean} */
    this.running = false;

    /** @type {number} elapsed time, in milliseconds. Kept in the
     *  clock's own unit so that no part of a tick is rounded away. */
    this.elapsedMs = 0;

    /** @type {?number} clock reading at the last tick or at Start, in
     *  milliseconds; null while stopped */
    this.lastClockMs = null;
  }

  /**
   * The elapsed time in hundredths of a second, which is what the
   * display shows.
   *
   * @returns {number} a whole number
   */
  get centiseconds() {
    return Math.floor(this.elapsedMs / MS_PER_CENTISECOND);
  }

  /**
   * Start, or carry on. Does nothing if already running.
   *
   * @param {number} nowMs - the clock, in milliseconds
   * @returns {undefined}
   */
  start(nowMs) {
    if (this.running) return;

    this.running = true;
    this.lastClockMs = nowMs;
  }

  /**
   * Hold the time where it is. Does nothing if not running.
   *
   * @returns {undefined}
   */
  stop() {
    if (!this.running) return;

    this.running = false;
    this.lastClockMs = null;
  }

  /**
   * Back to zero. A running stopwatch keeps running.
   *
   * @returns {undefined}
   */
  reset() {
    this.elapsedMs = 0;
  }

  /**
   * Add on the time that has gone by since the last tick. Does nothing
   * unless running. Going by the clock rather than counting ticks
   * means a tick that never arrives does not lose its time.
   *
   * @param {number} nowMs - the clock, in milliseconds
   * @returns {undefined}
   */
  tick(nowMs) {
    if (!this.running) return;

    if (this.lastClockMs !== null) {
      this.elapsedMs += nowMs - this.lastClockMs;
    }
    this.lastClockMs = nowMs;
  }
}

/**
 * Split a time into the four pairs of the display: hours, minutes,
 * seconds, and a last pair whose first digit is tenths of a second
 * and whose second is always 0. Hours wrap round after 23.
 *
 * An LED display takes one number per pair of digits, 0 to 99.
 *
 * @param {number} centiseconds
 * @returns {Array<number>} four numbers: [hours, minutes, seconds,
 *   tenths * 10]
 */
function timePairs(centiseconds) {
  let whole   = centiseconds | 0;
  let tenths  = Math.floor(whole /     10) % 10;
  let seconds = Math.floor(whole /    100) % 60;
  let minutes = Math.floor(whole /   6000) % 60;
  let hours   = Math.floor(whole / 360000) % 24;

  return [hours, minutes, seconds, tenths * 10];
}


/* ==================================================================
 * 2. THE PANEL
 *
 * First the gadgets the loop needs to talk to, each given a name. Then
 * the window, which arranges them. Read the `layout:` tree next to the
 * picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { START: 1, STOP: 2, RESET: 3, QUIT: 4 };

/* Four pairs: eight digits. `time` and `colon` make the image set the
 * pairs out as a time, with colons between them. */
let display = new Led({
  values: timePairs(0),
  colon:  true,
  time:   true,
});

let startButton = new Button({ id: ID.START, text: '_Start' });
let stopButton  = new Button({ id: ID.STOP,  text: 'S_top',
                               disabled: true });
let resetButton = new Button({ id: ID.RESET, text: '_Reset' });
let quitButton  = new Button({ id: ID.QUIT,  text: '_Quit' });

let window = new Window({
  title:       'Stopwatch',
  innerWidth:  300,
  innerHeight: 120,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,

  /* The usual Reaction events do not include the tick, so it is asked
   * for as well. The ticks are what refresh the display. */
  idcmp: IDCMP_REACTION_DEFAULT | IDCMP.INTUITICKS,

  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [

      display,

      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ startButton, stopButton, resetButton, quitButton ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Wait for a click or a tick, tell the stopwatch, then make the panel
 * show whatever the stopwatch now says.
 * ================================================================== */

let stopwatch = new Stopwatch();

/** What the panel currently shows, so that render() only touches a
 *  gadget whose content has really changed. It starts out as the
 *  gadgets were built: zero on the display, Start available, Stop
 *  ghosted. */
let shown = { centiseconds: 0, running: false };

/**
 * Make the whole panel match the stopwatch.
 *
 * @returns {undefined}
 */
function render() {
  if (shown.centiseconds !== stopwatch.centiseconds) {
    display.setValues(timePairs(stopwatch.centiseconds));
    shown.centiseconds = stopwatch.centiseconds;
  }

  if (shown.running !== stopwatch.running) {
    /* Start and Stop are never both available. */
    startButton.set({ disabled: stopwatch.running });
    stopButton.set({ disabled: !stopwatch.running });
    shown.running = stopwatch.running;
  }
}

/** What each button does. Quit is not here: it ends the loop. */
const onClick = {
  [ID.START]: () => stopwatch.start(Date.now()),
  [ID.STOP]:  () => stopwatch.stop(),
  [ID.RESET]: () => stopwatch.reset(),
};

window.open();
print('Stopwatch open. Start / Stop / Reset / Quit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.sourceId === ID.QUIT) break;

    switch (event.kind) {

      case EventKind.BUTTON_CLICK:
        if (onClick[event.sourceId]) onClick[event.sourceId]();
        break;

      case EventKind.INTUITICKS:
        stopwatch.tick(Date.now());
        break;
    }

    render();
  }
}
finally {
  /* The LED image goes with the window, and its values with it. */
  window.dispose();
}

print('Bye.');
