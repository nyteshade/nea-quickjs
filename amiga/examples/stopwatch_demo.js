/*
 * stopwatch_demo.js — a working start/stop/reset stopwatch using
 * led.image as the display + IDCMP_INTUITICKS for the tick source.
 *
 * Demonstrates:
 *   - Periodic UI updates driven by IDCMP_INTUITICKS (Intuition's
 *     10-Hz heartbeat, no setTimeout dependency)
 *   - Live attribute mutation (LED values + button GA_Disabled state)
 *   - Multi-state UI (idle / running / stopped) reacting to button clicks
 *
 * Display: HH:MM:SS.t with colon separators (LED_Time + LED_Colon).
 * Tick resolution is ~100ms (Intuition delivers ~10 INTUITICKS/sec).
 *
 * Requires quickjs.library 0.156+.
 * Run:  qjs examples/stopwatch_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Led, Label,
        EventKind, IDCMP, WindowPosition, IDCMP_REACTION_DEFAULT } = amiga.boopsi;

const GID = { START: 1, STOP: 2, RESET: 3, QUIT: 4 };

/* 4-pair LED display = 8 digits = HH:MM:SS.t (last is tenths). The
 * values buffer holds 8 byte-digits; LED_Time + LED_Colon arrange
 * them as HH:MM:SS with a tenths digit appended visually. */
let valuesBuf = amiga.allocMem(8);

function writeTime(centiseconds) {
  let cs    = centiseconds | 0;
  let tenths  = Math.floor(cs /     10) % 10;
  let seconds = Math.floor(cs /    100) % 60;
  let minutes = Math.floor(cs /   6000) % 60;
  let hours   = Math.floor(cs / 360000) % 24;
  /* most-significant digit at offset 0 — see LED.c precedent */
  amiga.poke8(valuesBuf + 0, Math.floor(hours   / 10));
  amiga.poke8(valuesBuf + 1, hours   % 10);
  amiga.poke8(valuesBuf + 2, Math.floor(minutes / 10));
  amiga.poke8(valuesBuf + 3, minutes % 10);
  amiga.poke8(valuesBuf + 4, Math.floor(seconds / 10));
  amiga.poke8(valuesBuf + 5, seconds % 10);
  amiga.poke8(valuesBuf + 6, tenths);
  amiga.poke8(valuesBuf + 7, 0);
}

writeTime(0);

let display = new Led({
  pairs: 4,
  values: valuesBuf,
  colon: true,
  time:  true,
});

let startBtn = new Button({ id: GID.START, text: '_Start' });
let stopBtn  = new Button({ id: GID.STOP,  text: 'S_top', disabled: true });
let resetBtn = new Button({ id: GID.RESET, text: '_Reset' });
let quitBtn  = new Button({ id: GID.QUIT,  text: '_Quit' });

let win = new Window({
  title:       'Stopwatch',
  innerWidth:  300,
  innerHeight: 120,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  /* Need INTUITICKS in the mask for the heartbeat. The default
   * IDCMP_REACTION_DEFAULT does NOT include it, so we build the
   * mask ourselves. */
  idcmp: IDCMP_REACTION_DEFAULT | IDCMP.INTUITICKS,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [
      display,
      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ startBtn, stopBtn, resetBtn, quitBtn ],
      }),
    ],
  }),
});

let running    = false;
let elapsedCs  = 0;
let lastTickAt = null;

function updateButtons() {
  startBtn.set({ disabled: running });
  stopBtn .set({ disabled: !running });
}

function refreshDisplay() {
  writeTime(elapsedCs);
  display.set({ values: valuesBuf });   /* poke triggers redraw */
}

win.open();
print('Stopwatch open. Start / Stop / Reset / Quit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;

    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.START:
          if (!running) {
            running = true;
            lastTickAt = Date.now();
            updateButtons();
          }
          break;

        case GID.STOP:
          if (running) {
            running = false;
            lastTickAt = null;
            updateButtons();
          }
          break;

        case GID.RESET:
          elapsedCs = 0;
          refreshDisplay();
          break;

        case GID.QUIT:
          win.close(); /* will exit the events loop */
          break;
      }
    }

    /* INTUITICKS arrive ~10/sec from Intuition's heartbeat. We
     * cross-check against wall-clock so a missed tick doesn't drift
     * us — accumulate the actual ms delta. */
    if (e.kind === EventKind.INTUITICKS && running) {
      let now = Date.now();
      if (lastTickAt) {
        elapsedCs += Math.floor((now - lastTickAt) / 10);
      }
      lastTickAt = now;
      refreshDisplay();
    }
  }
}
finally {
  win.dispose();
  amiga.freeMem(valuesBuf, 8);
}
print('Bye.');
