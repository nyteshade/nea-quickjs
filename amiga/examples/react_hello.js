/*
 * react_hello.js - the smallest Reaction window: a label and two buttons.
 *
 *   +---------------------------+
 *   | React Hello               |
 *   +---------------------------+
 *   |   Hello from Reaction!    |
 *   | [        Say hi         ] |
 *   | [         Quit          ] |
 *   +---------------------------+
 *
 * Every event the window produces is printed on the Shell, so this is
 * also a quick way to see what Reaction reports: click the buttons,
 * click outside the window and back in, press keys. Quit or the close
 * gadget ends it.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), centred
 *   - window.class, layout.gadget, button.gadget and label.image are
 *     installed (standard from OS 3.2; earlier with ClassAct/Reaction)
 *   - an inside of 260 x 100 pixels is enough for the label and both
 *     buttons in the screen's font
 *
 * Requires quickjs.library 0.139+.
 * Run: qjs examples/react_hello.js
 */

import * as std from 'qjs:std';

if (!amiga.boopsi || !amiga.boopsi.Window) {
  print('Reaction Phase B not installed - need quickjs.library 0.139+');
  std.exit(1);
}

const { Window, Layout, Button, Label, EventKind,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { SAY_HI: 1, QUIT: 2 };

/* No `idcmp:` is given, so the window asks for the usual Reaction set
 * of messages: gadget releases, attribute updates, activation, keys
 * and so on. Give one only to leave something out. */
let window = new Window({
  title:       'React Hello',
  innerWidth:  260,
  innerHeight: 100,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [
      new Label({ text: 'Hello from Reaction!' }),
      new Button({ id: ID.SAY_HI, text: 'Say hi' }),
      new Button({ id: ID.QUIT,   text: 'Quit' }),
    ],
  }),
});

/**
 * Describe an event in one line for the Shell.
 *
 * @param {object} event - as yielded by window.events()
 * @returns {string}
 */
function describe(event) {
  switch (event.kind) {

    case EventKind.BUTTON_CLICK:
      return 'BUTTON_CLICK - id=' + event.sourceId +
             ' text="' + (event.source ? event.source.text : '?') + '"';

    case EventKind.ATTR_UPDATE:
      return 'ATTR_UPDATE - id=' + event.sourceId +
             ' code=0x' + event.raw.code.toString(16);

    /* Anything else: its name if Reaction recognised it, otherwise
     * the raw IDCMP class in hex. */
    default:
      return 'event: ' + (event.kind ? event.kind.key : 'raw-' +
             event.raw.classRaw.toString(16));
  }
}

/**
 * Say that the close gadget was clicked.
 *
 * @returns {undefined}
 */
function announceClose() {
  print('on(CLOSE_WINDOW) - user clicked the close gadget');
}

/* A handler registered with on() runs inside the event pump, before
 * the same event reaches the loop below. */
window.on('CLOSE_WINDOW', announceClose);

window.open();
print('Window opened - try the buttons, or click close to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    print(describe(event));

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;
  }
}
finally {
  /* Disposing the window disposes the layout and everything in it. */
  window.dispose();
}

print('Clean exit.');
