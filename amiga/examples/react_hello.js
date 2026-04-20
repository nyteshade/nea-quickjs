/*
 * react_hello.js — minimal Reaction/BOOPSI window with a label and
 * two buttons laid out vertically. The shortest JS script that
 * exercises the whole OO layer.
 *
 * Demonstrates:
 *   - amiga.boopsi.Window with the declarative children pattern
 *   - amiga.boopsi.Layout with vertical orientation
 *   - amiga.boopsi.Button (with GA_ID) + amiga.boopsi.Label
 *   - Property access (.title, .text, .disabled) via OM_SET/OM_GET
 *   - win.events() iterator yielding EventKind cases
 *   - .on(kind, handler) registered callback
 *   - Parent-owned dispose cascade — one win.dispose() tears the
 *     whole tree down
 *
 * Run:        qjs examples/react_hello.js
 * Requires:   quickjs.library 0.139+ (Reaction Phase B)
 */

import * as std from 'qjs:std';

if (!amiga.boopsi || !amiga.boopsi.Window) {
  print('Reaction Phase B not installed — need quickjs.library 0.139+');
  std.exit(1);
}

const { Window, Layout, Button, Label, EventKind } = amiga.boopsi;

/* Build the UI declaratively. Every `new` call opens the underlying
 * .class/.gadget/.image library lazily and caches the Class*. */
let win = new Window({
  title: 'React Hello',
  innerWidth:  260,
  innerHeight: 100,
  position:    amiga.boopsi.WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,

  /* Default IDCMP — include IDCMP_IDCMPUPDATE so button clicks get
   * routed to us via Reaction's attribute-delta broadcast. */
  idcmp: 0x00000200           /* CLOSE_WINDOW */
       | 0x00000004           /* REFRESH_WINDOW */
       | 0x40000000,          /* IDCMPUPDATE (Reaction) */

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [
      new Label({ text: 'Hello from Reaction!' }),
      new Button({ id: 1, text: 'Say hi' }),
      new Button({ id: 2, text: 'Quit' }),
    ],
  }),
});

/* A handler dispatched by the event pump before yielding. */
win.on('CLOSE_WINDOW', () => {
  print('on(CLOSE_WINDOW) — user clicked the close gadget');
});

win.open();

print('Window opened — try the buttons, or click close to exit.');

try {
  for (let evt of win.events()) {
    if (evt.kind === EventKind.CLOSE_WINDOW) {
      break;
    }

    if (evt.kind === EventKind.ATTR_UPDATE) {
      /* Reaction IDCMP_IDCMPUPDATE carrying a GA_ID. Phase B reports
       * the raw IntuiMessage; full TagList parsing to extract the
       * source GadgetID lands in Phase D refinement. */
      print('ATTR_UPDATE — code=0x' + evt.raw.code.toString(16));
    }

    else {
      print('event: ' + (evt.kind ? evt.kind.key : 'raw-' +
            evt.raw.classRaw.toString(16)));
    }
  }
}

finally {
  win.dispose();
}

print('Clean exit.');
