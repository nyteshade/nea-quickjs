/*
 * palette_demo.js - a strip of the screen's colours to click on.
 *
 *   +------------------------------+
 *   | Click a color:               |
 *   | [  ][##][  ][  ][  ][  ][  ] |   pens 0 to 7
 *   | [           Quit           ] |
 *   +------------------------------+
 *
 * Click a colour and its pen number is printed on the Shell. Pen 1 is
 * the one selected to begin with. The idea comes from Palette.c in the
 * NDK examples.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 220 x 120 window interior
 *   - the eight pens shown are whatever colours that screen has; on a
 *     screen with fewer than eight, what the extra boxes show is up to
 *     the gadget
 *   - palette.gadget, label.image, button.gadget, layout.gadget and
 *     window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - the pen that was clicked arrives in the event's code word; this
 *     is how the gadget was seen to behave, not something its header
 *     promises
 *   - window.class reports gadget clicks even though the `idcmp:` mask
 *     below asks only for close, refresh and attribute updates
 *
 * Requires quickjs.library 0.170+.
 * Run: qjs examples/palette_demo.js
 */

const { Window, Layout, Button, Palette, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { PALETTE: 1, QUIT: 2 };

/** How many pens the palette shows, counting up from FIRST_PEN. */
const PEN_COUNT = 8;

/** The first pen shown. */
const FIRST_PEN = 0;

/** The pen that is selected when the window opens. */
const STARTING_PEN = 1;

let palette = new Palette({
  id:          ID.PALETTE,
  numColors:   PEN_COUNT,
  colorOffset: FIRST_PEN,
  color:       STARTING_PEN,
});

let hintLabel  = new Label({ text: 'Click a color:' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction Palette',
  innerWidth:  220,
  innerHeight: 120,
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
      hintLabel,
      palette,
      quitButton,
    ],
  }),
});

window.open();
print('Click a color; Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    if (event.kind === EventKind.PALETTE_CHANGE) {
      /* The code word of the click carries the pen number. */
      print('Picked color index ' + event.raw.code);
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
