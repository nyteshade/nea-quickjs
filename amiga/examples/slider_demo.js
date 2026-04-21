/*
 * slider_demo.js — Reaction Slider demo.
 *
 * A horizontal slider [0..100] with a LED readout that updates as
 * the knob moves. Quit button closes the window.
 *
 * Requires quickjs.library 0.148+.
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Slider, Label, Led, EventKind, IDCMP,
        WindowPosition, SliderOrient } = amiga.boopsi;

const GID = { SLIDER: 1, QUIT: 2 };

let slider = new Slider({
  id:          GID.SLIDER,
  min:         0,
  max:         100,
  level:       50,
  orientation: 'horizontal',
  ticks:       11,
  shortTicks:  1,
});

let title = new Label({ text: 'Slide me:' });
let quit  = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title:       'Reaction Slider',
  innerWidth:  300,
  innerHeight: 100,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ title, slider, quit ],
  }),
});

win.open();
print('Drag the slider; click Quit to exit.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.SLIDER_CHANGE) {
      print('slider = ' + e.raw.code);
    }
  }
}
finally { win.dispose(); }
print('Bye.');
