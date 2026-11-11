/*
 * listbrowser_demo.js - a scrolling list of planets to pick from.
 *
 *   +----------------------------------+
 *   | Mercury                        ^ |
 *   | Venus                          # |
 *   | Earth                          # |
 *   | Mars                           v |
 *   | Selected #2: Earth               |   status line
 *   | [             Quit             ] |
 *   +----------------------------------+
 *
 * Click a row: the line under the list names it and the same name is
 * printed on the Shell. The window can be resized, and the list grows
 * with it.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 360 x 260 window interior
 *   - listbrowser.gadget, string.gadget, button.gadget, layout.gadget
 *     and window.class are in SYS:Classes, as AmigaOS 3.2 installs them
 *   - by the time the click is reported, the gadget's 'selected'
 *     attribute already holds the row that was clicked
 *
 * Requires quickjs.library 0.168+ (for the `labels:` shorthand).
 * Run: qjs examples/listbrowser_demo.js
 */

const { Window, Layout, Button, ListBrowser, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { LIST: 1, QUIT: 99 };

/** The rows of the list, top to bottom. A row's number is its index
 *  here. */
const PLANETS = [
  'Mercury', 'Venus', 'Earth', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune',
  'Pluto (dwarf)', 'Ceres (dwarf)', 'Makemake (dwarf)', 'Haumea (dwarf)',
];

/* `labels:` takes plain strings and builds the one-column list of
 * nodes that listbrowser.gadget really wants. */
let planetList = new ListBrowser({
  id:     ID.LIST,
  labels: PLANETS,
});

let statusLine = new StringGadget({
  text:       'Pick a planet.',
  readOnly:   true,
  maxChars:   64,
  minVisible: 32,
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'ListBrowser Demo',
  innerWidth:  360,
  innerHeight: 260,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  sizeGadget:  true,
  activate:    true,

  layout: new Layout({
    orientation:  'vertical',
    innerSpacing: 6,
    children: [
      planetList,
      statusLine,
      quitButton,
    ],
  }),
});

window.open();
print('ListBrowser open. Pick a planet, then Quit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    if (event.kind === EventKind.LIST_SELECT && event.sourceId === ID.LIST) {

      /* 'selected' is the index of the clicked row, or -1 for none. */
      let row = planetList.get('selected');

      if (typeof row === 'number' && row >= 0 && row < PLANETS.length) {
        statusLine.text = 'Selected #' + row + ': ' + PLANETS[row];
        print('picked ' + PLANETS[row]);
      }
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
