/*
 * chooser_demo.js - a drop-down list of colours with a live readout.
 *
 *   +------------------------------------+
 *   | Colour: [ Green                |v] |
 *   | Selected: Green (index 3)          |
 *   | [             Quit               ] |
 *   +------------------------------------+
 *
 * Pick a colour from the drop-down. The read-only line under it, and
 * the Shell, show what you picked. The list is a plain JavaScript
 * array of strings.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     has room for a window 300 pixels wide and 140 high inside
 *   - window.class, layout.gadget, chooser.gadget, string.gadget,
 *     button.gadget and label.image are installed in SYS:Classes
 *     (Reaction: AmigaOS 3.5 and later)
 *   - chooser.gadget answers a request for its active entry at the
 *     moment it reports a selection
 *
 * Requires quickjs.library 0.211+.
 * Run: qjs examples/chooser_demo.js
 */

const { Window, Layout, Button, Chooser, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { CHOOSER: 1, QUIT: 99 };

/** The entries of the drop-down, top to bottom. */
const COLOURS = [
  'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet',
];

/** Index into COLOURS of the entry shown when the window opens:
 *  Green. */
const INITIAL_INDEX = 3;

/**
 * The text of the readout for one entry.
 *
 * @param {number} index - index into COLOURS
 * @returns {string}
 */
function readoutText(index) {
  return 'Selected: ' + COLOURS[index] + ' (index ' + index + ')';
}

/**
 * Which entry a chooser event selected. The event carries the index
 * when the event pump has filled it in; otherwise the gadget is asked.
 *
 * @param {object} event - a CHOOSER_SELECT event from colourChooser
 * @returns {*} the index, a number, unless the gadget did not answer
 */
function selectedIndex(event) {
  return (typeof event.attrs.active === 'number')
           ? event.attrs.active
           : colourChooser.get('active');
}

/* The `label` layout hint puts a caption beside the gadget, the usual
 * Reaction way to write a "Field: [value]" row (NDK Examples/Page.c).
 * The layout builds the label from the string and disposes it along
 * with everything else. */
let colourChooser = new Chooser({
  id:          ID.CHOOSER,
  labels:      COLOURS,
  dropDown:    true,
  active:      INITIAL_INDEX,
  layoutHints: { label: 'Colour:' },
});

let readout = new StringGadget({
  text:       readoutText(INITIAL_INDEX),
  readOnly:   true,
  maxChars:   64,
  minVisible: 32,
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Chooser Demo',
  innerWidth:  300,
  innerHeight: 140,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 6,
    children: [ colourChooser, readout, quitButton ],
  }),
});

window.open();
print('Chooser open. Pick a colour from the drop-down.');
print('Click Quit or the close gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) {
      break;
    }

    if (event.kind === EventKind.CHOOSER_SELECT &&
        event.sourceId === ID.CHOOSER) {
      let index = selectedIndex(event);

      /* Anything that is not an index into COLOURS is ignored. */
      if (typeof index === 'number' &&
          index >= 0 && index < COLOURS.length) {
        readout.text = readoutText(index);
        print('picked ' + COLOURS[index]);
      }
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
