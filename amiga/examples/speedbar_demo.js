/*
 * speedbar_demo.js - a toolbar of five text buttons that reports clicks.
 *
 *   +------------------------------------+
 *   | [Cut] [Copy] [Paste] [Undo] [Redo] |   the speedbar
 *   | Clicked: Paste (#2)                |   status line
 *   | [              Quit              ] |
 *   +------------------------------------+
 *
 * Click a toolbar button: the line underneath names it and its number,
 * and the name is printed on the Shell. A click that cannot be traced
 * to a button is shown too, with what the gadget did report.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 360 x 180 window interior
 *   - speedbar.gadget, string.gadget, button.gadget, layout.gadget and
 *     window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - the clicked button's number arrives in the event's code word.
 *     The gadget's header does not say so; NDK Examples/SpeedBar.c
 *     reads it there, and that is what a real Amiga was seen to do
 *   - every event carrying the speedbar's ID is a click on it; the
 *     loop does not look at the event's kind
 *
 * Requires quickjs.library 0.168+ (for the `buttons:` shorthand).
 * Run: qjs examples/speedbar_demo.js
 */

const { Window, Layout, Button, SpeedBar, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { BAR: 1, QUIT: 99 };

/** The toolbar buttons, left to right. A button's number is its index
 *  here. */
const ACTIONS = ['Cut', 'Copy', 'Paste', 'Undo', 'Redo'];

/**
 * Whether a value is the number of one of the toolbar buttons.
 *
 * @param {*} ordinal - whatever the gadget reported
 * @returns {boolean}
 */
function isButtonNumber(ordinal) {
  return ordinal >= 0 && ordinal < ACTIONS.length;
}

/* `buttons:` takes plain strings and builds the list of nodes that
 * speedbar.gadget really wants, numbering each one by its index. */
let speedBar = new SpeedBar({
  id:      ID.BAR,
  buttons: ACTIONS,
});

let statusLine = new StringGadget({
  text:       'Click a toolbar button.',
  readOnly:   true,
  maxChars:   64,
  minVisible: 32,
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'SpeedBar Demo',
  innerWidth:  360,
  innerHeight: 180,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,

  layout: new Layout({
    orientation:  'vertical',
    innerSpacing: 6,
    children: [
      speedBar,
      statusLine,
      quitButton,
    ],
  }),
});

window.open();
print('SpeedBar open. Click a button; Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    if (event.sourceId === ID.BAR) {

      /* The order matters here and was settled on a real Amiga. The
       * event's code word comes first: that is where speedbar.gadget
       * puts the clicked button's number, as NDK Examples/SpeedBar.c
       * reads it. The 'selected' attribute is only a fallback. */
      let ordinal = event.raw.code;
      if (!isButtonNumber(ordinal)) ordinal = speedBar.get('selected');

      if (typeof ordinal === 'number' && isButtonNumber(ordinal)) {
        statusLine.text = 'Clicked: ' + ACTIONS[ordinal] +
                          ' (#' + ordinal + ')';
        print('speedbar ' + ACTIONS[ordinal]);
      }
      else {
        /* Neither source named a button. Say what did arrive, so that
         * a click is never silent. */
        let reported = 'code=' + event.raw.code +
                       ' selected=' + speedBar.get('selected');

        statusLine.text = 'Click, but no button id: ' + reported;
        print('speedbar event with no button id: ' + reported);
      }
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
