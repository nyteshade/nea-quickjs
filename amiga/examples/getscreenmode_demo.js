/*
 * getscreenmode_demo.js - a screen-mode chooser, opened from a button.
 *
 *   +--------------------------------------+
 *   | Pick a screen mode:                  |
 *   | [ PAL:High Res                     ] |   the getscreenmode gadget
 *   | [ Pick Screen Mode... ] [   Quit   ] |
 *   +--------------------------------------+
 *
 * Click "Pick Screen Mode..." to open the screen-mode requester, which
 * also lets you set width, height and depth. Once a mode has been
 * chosen, its display ID and size are printed on the Shell.
 *
 * As with getfont_demo.js, the gadget only displays the current
 * choice. It does not open the requester by itself: the program has to
 * ask it to, which is what the button and `request()` are for.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 360 x 110 window interior
 *   - getscreenmode.gadget, label.image, button.gadget, layout.gadget
 *     and window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - the gadget reports a click on its display even when no mode has
 *     been chosen. That was observed, not documented
 *   - a display ID of 0 means "nothing chosen yet". 0 is also the ID
 *     of the plain low-resolution mode, so choosing that mode prints
 *     nothing
 *   - window.class reports gadget clicks even though the `idcmp:` mask
 *     below asks only for close, refresh and attribute updates
 *
 * Requires quickjs.library 0.170+.
 * Run: qjs examples/getscreenmode_demo.js
 */

const { Window, Layout, Button, GetScreenMode, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { MODE_DISPLAY: 1, PICK: 2, QUIT: 3 };

/** Number base for printing a display ID, which is always quoted in
 *  hexadecimal. */
const HEXADECIMAL = 16;

let modeDisplay = new GetScreenMode({
  id:        ID.MODE_DISPLAY,
  titleText: 'Pick a screen mode',

  /* Have the requester offer these three settings as well. */
  doWidth:  true,
  doHeight: true,
  doDepth:  true,
});

let pickButton = new Button({ id: ID.PICK, text: 'Pick _Screen Mode...' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction GetScreenMode',
  innerWidth:  360,
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

      new Label({ text: 'Pick a screen mode:' }),

      modeDisplay,

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
print('GetScreenMode open. Click "Pick Screen Mode..." to open the requester.');
print('Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === ID.QUIT) break;

      if (event.sourceId === ID.PICK) {
        /* The requester wants the real Intuition window, not the
         * JavaScript object wrapped around it. */
        modeDisplay.request(window.intuiWindow.ptr);
      }
    }

    if (event.kind === EventKind.SCREENMODE_SELECTED) {

      /* This event arrives on every click of the mode display, whether
       * or not anything has been chosen yet. A display ID of 0 is
       * taken to mean nothing has. */
      let displayID = modeDisplay.get('displayID');

      if (displayID) {
        print('DisplayID=0x' + displayID.toString(HEXADECIMAL) +
              '  ' + modeDisplay.get('displayWidth') +
              'x'  + modeDisplay.get('displayHeight') +
              'x'  + modeDisplay.get('displayDepth'));
      }
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
