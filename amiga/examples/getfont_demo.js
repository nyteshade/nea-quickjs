/*
 * getfont_demo.js - a font-chooser gadget, opened from a button.
 *
 *   +----------------------------------+
 *   | Pick a font:                     |
 *   | [ topaz 8                      ] |   the getfont gadget
 *   | [ Pick Font... ] [    Quit     ] |
 *   +----------------------------------+
 *
 * Click "Pick Font..." to open the font requester. Once a font has
 * been chosen, its name and height are printed on the Shell.
 *
 * The getfont gadget only displays the current font. It does not open
 * the requester by itself: the program has to ask it to, which is what
 * the button and `request()` are for.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 320 x 110 window interior
 *   - getfont.gadget, label.image, button.gadget, layout.gadget and
 *     window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - the gadget reports a click on its display even when no font has
 *     been chosen, and holds no TextAttr until one has. That was
 *     observed, not documented
 *   - the TextAttr the gadget hands back stays valid for as long as it
 *     takes to read it
 *   - window.class reports gadget clicks even though the `idcmp:` mask
 *     below asks only for close, refresh and attribute updates
 *
 * Requires quickjs.library 0.170+.
 * Run: qjs examples/getfont_demo.js
 */

const { Window, Layout, Button, GetFont, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { FONT_DISPLAY: 1, PICK: 2, QUIT: 3 };

/** The smallest and largest font the requester offers, in pixels. */
const MIN_FONT_HEIGHT = 6;
const MAX_FONT_HEIGHT = 72;

/**
 * Describe the font a struct TextAttr names.
 *
 * @param {number} textAttr - address of a struct TextAttr; must not be 0
 * @returns {string} for example "topaz.font / 8"
 */
function describeFont(textAttr) {
  /* TextAttr wraps the address so the fields can be read by name. */
  let font   = new TextAttr(textAttr);
  let name   = font.name || '(null)';
  let height = font.ySize;

  return name + ' / ' + height;
}

let fontDisplay = new GetFont({
  id:        ID.FONT_DISPLAY,
  titleText: 'Pick a font',
  minHeight: MIN_FONT_HEIGHT,
  maxHeight: MAX_FONT_HEIGHT,
});

let pickButton = new Button({ id: ID.PICK, text: 'Pick _Font...' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction GetFont',
  innerWidth:  320,
  innerHeight: 110,
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

      new Label({ text: 'Pick a font:' }),

      fontDisplay,

      new Layout({
        orientation:  'horizontal',
        innerSpacing: 4,
        evenSize:     true,
        children: [pickButton, quitButton],
      }),

    ],
  }),
});

window.open();
print('GetFont open. Click "Pick Font..." to open the requester.');
print('Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === ID.QUIT) break;

      if (event.sourceId === ID.PICK) {
        /* The requester wants the real Intuition window, not the
         * JavaScript object wrapped around it. */
        fontDisplay.request(window.intuiWindow.ptr);
      }
    }

    if (event.kind === EventKind.FONT_SELECTED) {

      /* This event arrives whenever the font display is clicked,
       * whether or not anything has been chosen yet. Until a font has
       * been chosen there is no TextAttr, and nothing to print. */
      let textAttr = fontDisplay.get('textAttr');

      if (textAttr) print('Selected: ' + describeFont(textAttr));
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
