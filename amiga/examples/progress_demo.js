/*
 * progress_demo.js — simulated download progress with FuelGauge.
 *
 * Three buttons drive a fake download:
 *   Start   begin from 0% (or resume from current)
 *   Pause   stop the ticks
 *   Reset   back to 0
 *
 * The FuelGauge level updates live from IDCMP_INTUITICKS — about
 * 10 increments per second of 1% each, so a full bar is ~10 seconds.
 * A label below shows the percentage textually.
 *
 * Demonstrates:
 *   - FuelGauge with .level mutation driving live visual updates
 *   - INTUITICKS as a lightweight "every 100ms" scheduler
 *   - Multi-state UI synced via mutual GA_Disabled toggling
 *
 * Requires quickjs.library 0.156+.
 * Run:  qjs examples/progress_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, FuelGauge, Label,
        EventKind, IDCMP, WindowPosition,
        IDCMP_REACTION_DEFAULT, FuelGaugeOrient } = amiga.boopsi;

const GID = { START: 1, PAUSE: 2, RESET: 3, QUIT: 4 };

let progress = 0;        /* 0..100 */
let running  = false;

let gauge = new FuelGauge({
  min:    0,
  max:    100,
  level:  0,
  percent: true,
  orientation: FuelGaugeOrient.HORIZONTAL,
  ticks:  10,
});

let percentLabel = new Label({ text: 'Progress: 0%' });

let startBtn = new Button({ id: GID.START, text: '_Start' });
let pauseBtn = new Button({ id: GID.PAUSE, text: '_Pause', disabled: true });
let resetBtn = new Button({ id: GID.RESET, text: '_Reset' });
let quitBtn  = new Button({ id: GID.QUIT,  text: '_Quit'  });

let win = new Window({
  title:       'Progress Demo',
  innerWidth:  340,
  innerHeight: 140,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  /* INTUITICKS isn't in IDCMP_REACTION_DEFAULT — add it. */
  idcmp: IDCMP_REACTION_DEFAULT | IDCMP.INTUITICKS,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [
      gauge,
      percentLabel,
      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ startBtn, pauseBtn, resetBtn, quitBtn ],
      }),
    ],
  }),
});

function refresh() {
  gauge.set({ level: progress });
  percentLabel.text = 'Progress: ' + progress + '%';
}

function setRunning(v) {
  running = v;
  startBtn.set({ disabled: v });
  pauseBtn.set({ disabled: !v });
}

win.open();
print('Progress demo. Start to begin, Pause to halt, Reset to zero.');

let done = false;
try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;

    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.START:
          if (progress >= 100) progress = 0;   /* restart from full */
          setRunning(true);
          break;
        case GID.PAUSE:
          setRunning(false);
          break;
        case GID.RESET:
          progress = 0;
          refresh();
          if (running) setRunning(false);
          break;
        case GID.QUIT:
          done = true;
          break;
      }
      if (done) break;
    }

    if (e.kind === EventKind.INTUITICKS && running) {
      progress = Math.min(100, progress + 1);
      refresh();
      if (progress >= 100) {
        setRunning(false);
        print('Done. ');
      }
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
