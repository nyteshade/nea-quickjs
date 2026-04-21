/*
 * fuelgauge_demo.js — Reaction FuelGauge (progress bar).
 *
 * Auto-advances 0..100 in 5% increments as you click the Step button.
 * Quit to exit.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, FuelGauge, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

const GID = { STEP: 1, RESET: 2, QUIT: 3 };

let gauge = new FuelGauge({
  min: 0, max: 100, level: 0, percent: true,
  orientation: 'horizontal', ticks: 11, shortTicks: 1,
});

let title = new Label({ text: 'Fuel gauge demo:' });
let step  = new Button({ id: GID.STEP,  text: '+_5%' });
let reset = new Button({ id: GID.RESET, text: '_Reset' });
let quit  = new Button({ id: GID.QUIT,  text: '_Quit'  });

let win = new Window({
  title: 'Reaction FuelGauge', innerWidth: 320, innerHeight: 100,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      title, gauge,
      new Layout({ orientation: 'horizontal', innerSpacing: 4,
                   children: [step, reset, quit] }),
    ],
  }),
});

win.open();
print('Click +5% to advance; Reset to zero; Quit to exit.');

let level = 0;

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      if (e.sourceId === GID.QUIT) break;
      if (e.sourceId === GID.STEP)  level = Math.min(100, level + 5);
      if (e.sourceId === GID.RESET) level = 0;
      gauge.set({ level });
      print('level = ' + level + '%');
    }
  }
}
finally { win.dispose(); }
print('Bye.');
