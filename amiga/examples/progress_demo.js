/*
 * progress_demo.js - a progress bar you can start, pause and reset.
 *
 *   +------------------------------------------------+
 *   | [##############  37%                         ] |   gauge
 *   | Progress: 37%                                  |
 *   | [  Start  ] [  Pause  ] [  Reset  ] [  Quit  ] |
 *   +------------------------------------------------+
 *
 * Click Start and the bar fills by one percent about ten times a
 * second, so a full run takes roughly ten seconds. Pause holds it,
 * Start carries on, Reset goes back to nothing. Whichever of Start and
 * Pause makes no sense at the moment is ghosted. Nothing is really
 * downloaded.
 *
 * The file has three parts, read top to bottom:
 *
 *   1. THE DOWNLOAD - a count from 0 to 100 that can be paused. No GUI.
 *   2. THE PANEL    - the window, written as a tree that looks like it.
 *   3. THE LOOP     - clicks and ticks in, download told, panel redrawn.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 340 x 140 pixels inside
 *   - window.class, layout.gadget, button.gadget, string.gadget and
 *     fuelgauge.gadget are installed in SYS:Classes, as they are on
 *     AmigaOS 3.2
 *   - the clock is Intuition's tick (IDCMP_INTUITICKS): about ten a
 *     second, and only while this window is the active one. Click in
 *     another window and the download stands still
 *   - each tick counts as one step however late it arrives, so the
 *     ten seconds are approximate
 *   - the percentage text is a read-only string gadget because a Label
 *     keeps the text it was created with
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/progress_demo.js
 */

const { Window, Layout, Button, FuelGauge, StringGadget,
        EventKind, IDCMP, WindowPosition,
        IDCMP_REACTION_DEFAULT, FuelGaugeOrient } = amiga.boopsi;


/* ==================================================================
 * 1. THE DOWNLOAD
 *
 * A percentage that climbs while it is running. The panel further down
 * only ever calls these methods and reads these two fields.
 * ================================================================== */

/** The percentage at which the download is finished. */
const COMPLETE = 100;

/** How far one tick of the clock moves the download, in percent. */
const PERCENT_PER_TICK = 1;

class Download {
  /**
   * A download that has not been started.
   */
  constructor() {
    /** @type {number} 0 to COMPLETE */
    this.percent = 0;

    /** @type {boolean} */
    this.running = false;
  }

  /**
   * Start, or carry on after a pause.
   *
   * Starting a download that has already finished begins it again
   * from nothing. The count goes back on the first tick rather than
   * here, so until that tick the panel still reads 100%.
   *
   * @returns {undefined}
   */
  start() {
    this.running = true;
  }

  /**
   * Hold the download where it is.
   *
   * @returns {undefined}
   */
  pause() {
    this.running = false;
  }

  /**
   * Stop and go back to nothing.
   *
   * @returns {undefined}
   */
  reset() {
    this.percent = 0;
    this.running = false;
  }

  /**
   * One tick of the clock. Does nothing unless the download is running.
   *
   * @returns {boolean} true if this tick completed the download
   */
  tick() {
    if (!this.running) return false;

    /* Started again after finishing: this is where it begins again. */
    if (this.percent >= COMPLETE) this.percent = 0;

    this.percent = Math.min(COMPLETE, this.percent + PERCENT_PER_TICK);
    if (this.percent < COMPLETE) return false;

    this.running = false;
    return true;
  }
}

/**
 * The line of text under the gauge.
 *
 * @param {number} percent
 * @returns {string}
 */
function progressText(percent) {
  return 'Progress: ' + percent + '%';
}


/* ==================================================================
 * 2. THE PANEL
 *
 * First the gadgets the loop needs to talk to, each given a name. Then
 * the window, which arranges them. Read the `layout:` tree next to the
 * picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { START: 1, PAUSE: 2, RESET: 3, QUIT: 4 };

let gauge = new FuelGauge({
  min:         0,
  max:         COMPLETE,
  level:       0,
  percent:     true,
  orientation: FuelGaugeOrient.HORIZONTAL,
  ticks:       10,
});

/* A read-only string gadget, not a Label: its text can be changed
 * while the window is open. */
let percentLine = new StringGadget({
  text: progressText(0), readOnly: true, maxChars: 32,
});

let startButton = new Button({ id: ID.START, text: '_Start' });
let pauseButton = new Button({ id: ID.PAUSE, text: '_Pause',
                               disabled: true });
let resetButton = new Button({ id: ID.RESET, text: '_Reset' });
let quitButton  = new Button({ id: ID.QUIT,  text: '_Quit'  });

let window = new Window({
  title:       'Progress Demo',
  innerWidth:  340,
  innerHeight: 140,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,

  /* The usual Reaction events do not include the tick, so it is asked
   * for as well. The ticks are the download's clock. */
  idcmp: IDCMP_REACTION_DEFAULT | IDCMP.INTUITICKS,

  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [

      gauge,

      percentLine,

      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ startButton, pauseButton, resetButton, quitButton ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Wait for a click or a tick, tell the download, then make the panel
 * show whatever the download now says.
 * ================================================================== */

let download = new Download();

/** What the panel currently shows, so that show() only touches a
 *  gadget whose content has really changed. A tick that changes
 *  nothing then costs no redraw at all. It starts out as the gadgets
 *  were built: nothing downloaded, Start available, Pause ghosted. */
let shown = {
  level: 0,
  text:  progressText(0),
  start: false,
  pause: true,
};

/**
 * Set one gadget attribute, but only if it differs from what is
 * already on screen.
 *
 * @param {string} key - any unique name for this gadget + attribute
 * @param {object} gadget
 * @param {string} attribute - e.g. 'text', 'level', 'disabled'
 * @param {*} value
 * @returns {undefined}
 */
function show(key, gadget, attribute, value) {
  if (shown[key] === value) return;

  gadget.set({ [attribute]: value });
  shown[key] = value;
}

/**
 * Make the whole panel match the download.
 *
 * @returns {undefined}
 */
function render() {
  show('level', gauge,       'level', download.percent);
  show('text',  percentLine, 'text',  progressText(download.percent));

  /* Start and Pause are never both available. */
  show('start', startButton, 'disabled', download.running);
  show('pause', pauseButton, 'disabled', !download.running);
}

/** What each button does. */
const onClick = {
  [ID.START]: () => download.start(),
  [ID.PAUSE]: () => download.pause(),
  [ID.RESET]: () => download.reset(),
};

window.open();
print('Progress demo. Start to begin, Pause to halt, Reset to zero.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    let completed = false;

    switch (event.kind) {

      case EventKind.BUTTON_CLICK:
        if (onClick[event.sourceId]) onClick[event.sourceId]();
        break;

      case EventKind.INTUITICKS:
        completed = download.tick();
        break;
    }

    render();
    if (completed) print('Done. ');
  }
}
finally {
  window.dispose();
}

print('Bye.');
