/*
 * getcolor_demo.js - a colour-chooser gadget that reports the colour.
 *
 *   +----------------------------------+
 *   | Pick a color from the requester: |
 *   | [########################      ] |   the getcolor gadget
 *   | [             Quit             ] |
 *   +----------------------------------+
 *
 * Click the gadget; whenever it reports back, the red, green and blue
 * of the colour it holds are printed on the Shell. The requester it
 * stands for is titled "Choose a color" and is set up to offer RGB
 * sliders, HSB sliders and a colour wheel.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 300 x 100 window interior
 *   - getcolor.gadget, label.image, button.gadget, layout.gadget and
 *     window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - the gadget opens its colour requester by itself when clicked.
 *     This script never sends it GCOLOR_REQUEST (gadgets/getcolor.h),
 *     which the header says is how the requester is opened; compare
 *     getfont_demo.js, which does ask
 *   - the red, green and blue values are printed as the gadget gives
 *     them; their range is not checked
 *   - window.class reports gadget clicks even though the `idcmp:` mask
 *     below asks only for close, refresh and attribute updates
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/getcolor_demo.js
 */

const { Window, Layout, Button, GetColor, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { COLOR: 1, QUIT: 2 };

let colorChooser = new GetColor({
  id:        ID.COLOR,
  titleText: 'Choose a color',

  /* Every way of choosing a colour that the requester has. */
  rgbSliders: true,
  hsbSliders: true,
  colorWheel: true,
});

let hintLabel  = new Label({ text: 'Pick a color from the requester:' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction GetColor',
  innerWidth:  300,
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
      hintLabel,
      colorChooser,
      quitButton,
    ],
  }),
});

window.open();
print('Click the gadget to pick a color; Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    if (event.kind === EventKind.COLOR_SELECTED) {
      print('Got color: R=' + colorChooser.get('red') +
            ' G=' + colorChooser.get('green') +
            ' B=' + colorChooser.get('blue'));
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
