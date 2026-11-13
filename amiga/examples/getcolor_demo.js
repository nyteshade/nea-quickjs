/*
 * getcolor_demo.js - a colour-chooser gadget that reports the colour.
 *
 *   +----------------------------------+
 *   | Pick a color from the requester: |
 *   | [########################      ] |   the getcolor gadget
 *   | [             Quit             ] |
 *   +----------------------------------+
 *
 * Click the gadget and a colour requester opens, titled "Choose a
 * color", with RGB sliders, HSB sliders and a colour wheel. Choose a
 * colour and its red, green and blue are printed on the Shell; cancel,
 * and the script says so.
 *
 * The gadget does not open the requester by itself. A click on it
 * arrives here as a COLOR_SELECTED event, and the script answers with
 * `colorChooser.request()`, which shows the requester and returns
 * once the user is done (GCOLOR_REQUEST in gadgets/getcolor.h; the
 * NDK's Examples/GetColor.c does the same).
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 300 x 100 window interior
 *   - getcolor.gadget, label.image, button.gadget, layout.gadget and
 *     window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - the gadget's `color` is 0x00RRGGBB, eight bits a channel, as
 *     the NDK example reads it
 *   - window.class reports gadget clicks even though the `idcmp:` mask
 *     below asks only for close, refresh and attribute updates
 *
 * Requires quickjs.library 0.232+ (GetColor.request arrived then).
 * Run: qjs examples/getcolor_demo.js
 */

const { Window, Layout, Button, GetColor, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { COLOR: 1, QUIT: 2 };

/** The gadget's colour is 0x00RRGGBB: where each channel sits in it,
 *  in bits, and the mask for one eight-bit channel. */
const RED_SHIFT    = 16;
const GREEN_SHIFT  = 8;
const CHANNEL_MASK = 0xFF;

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

    /* The gadget was clicked: show its requester. request() comes
     * back when the user has chosen or cancelled. */
    if (event.kind === EventKind.COLOR_SELECTED) {
      if (colorChooser.request()) {
        let color = colorChooser.get('color');

        print('Got color: R=' + ((color >> RED_SHIFT) & CHANNEL_MASK) +
              ' G=' + ((color >> GREEN_SHIFT) & CHANNEL_MASK) +
              ' B=' + (color & CHANNEL_MASK));
      }
      else {
        print('No color chosen.');
      }
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
