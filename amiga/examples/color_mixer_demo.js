/*
 * color_mixer_demo.js — RGB color mixer with three sliders + LED readouts.
 *
 * Three horizontal sliders for Red, Green, Blue (0..255 each). Each
 * slider's current value is shown alongside via led.image as a 3-digit
 * decimal display. A StringGadget at the bottom shows the composite as
 * "#RRGGBB" hex. Quit closes.
 *
 * Demonstrates:
 *   - Multiple Slider event sources distinguished by GA_ID
 *   - Live updates to read-only LEDs and StringGadget on slider drag
 *   - Coordinated multi-gadget UI driven by SLIDER_CHANGE events
 *
 * Requires quickjs.library 0.156+.
 * Run:  qjs examples/color_mixer_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Slider, Led, Label, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;

const GID = { R: 1, G: 2, B: 3, QUIT: 99 };

/* Each LED uses a 4-byte value buffer (3 digits we use + 1 unused). */
function makeLedBuf(initial) {
  let p = amiga.allocMem(4);
  writeLed(p, initial);
  return p;
}

function writeLed(buf, n) {
  /* Two pairs = 4 digits — but we only use last 3 for 0-255 range. */
  amiga.poke8(buf + 0, 0);
  amiga.poke8(buf + 1, Math.floor(n / 100) % 10);
  amiga.poke8(buf + 2, Math.floor(n / 10)  % 10);
  amiga.poke8(buf + 3, n % 10);
}

let rBuf = makeLedBuf(128);
let gBuf = makeLedBuf(128);
let bBuf = makeLedBuf(128);

let rLed = new Led({ pairs: 2, values: rBuf });
let gLed = new Led({ pairs: 2, values: gBuf });
let bLed = new Led({ pairs: 2, values: bBuf });

function channelRow(label, slider, led) {
  return new Layout({
    orientation: 'horizontal', innerSpacing: 4,
    children: [
      new Label({ text: label }),
      slider,
      led,
    ],
  });
}

let rSlider = new Slider({
  id: GID.R, min: 0, max: 255, level: 128,
  orientation: 'horizontal', ticks: 5,
});
let gSlider = new Slider({
  id: GID.G, min: 0, max: 255, level: 128,
  orientation: 'horizontal', ticks: 5,
});
let bSlider = new Slider({
  id: GID.B, min: 0, max: 255, level: 128,
  orientation: 'horizontal', ticks: 5,
});

let hexDisplay = new StringGadget({
  id: 200, readOnly: true, maxChars: 12, text: '#808080',
});

let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title:       'RGB Color Mixer',
  innerWidth:  340,
  innerHeight: 180,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [
      new Label({ text: 'Drag the sliders. Hex value updates live.' }),
      channelRow('R:', rSlider, rLed),
      channelRow('G:', gSlider, gLed),
      channelRow('B:', bSlider, bLed),
      hexDisplay,
      quit,
    ],
  }),
});

/* Keep current channel values in JS so we can recompose the hex when
 * any one changes. We can't currently read SLIDER_CHANGE's new value
 * directly from the event yet (Phase D refinement), so we re-query
 * via OM_GET on the source slider. */
let values = { 1: 128, 2: 128, 3: 128 };

function hex2(n) {
  let s = (n & 0xFF).toString(16).toUpperCase();
  return s.length < 2 ? '0' + s : s;
}

function refreshHex() {
  hexDisplay.text =
    '#' + hex2(values[GID.R]) + hex2(values[GID.G]) + hex2(values[GID.B]);
}

win.open();
print('RGB mixer open. Drag sliders, watch the hex display. Quit closes.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;
    if (e.kind === EventKind.SLIDER_CHANGE && e.source) {
      /* event.attrs.level is auto-populated by Window._fillAttrsForClass
       * at quickjs.library 0.157+. Fallback to e.source.get for older. */
      let v = (typeof e.attrs.level === 'number')
                ? e.attrs.level : e.source.get('level');
      if (typeof v === 'number') {
        values[e.sourceId] = v;
        let buf = (e.sourceId === GID.R ? rBuf :
                   e.sourceId === GID.G ? gBuf : bBuf);
        let led = (e.sourceId === GID.R ? rLed :
                   e.sourceId === GID.G ? gLed : bLed);
        writeLed(buf, v);
        /* Re-set the values pointer to force a redraw. */
        led.set({ values: buf });
        refreshHex();
      }
    }
  }
}
finally {
  win.dispose();
  amiga.freeMem(rBuf, 4);
  amiga.freeMem(gBuf, 4);
  amiga.freeMem(bBuf, 4);
}
print('Bye.');
