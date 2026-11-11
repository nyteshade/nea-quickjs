/*
 * buttons_demo.js - a row of four buttons that say which one you clicked.
 *
 *   +--------------------------------------------+
 *   | This is a message framed by a BEVEL.       |
 *   | [  OK  ] [ Cancel ] [  Help  ] [ About ]   |
 *   +--------------------------------------------+
 *
 * Click a button and its name is printed on the Shell. OK and Cancel
 * also close the window; Help and About only report. A port of the
 * NDK example Buttons.c.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     has room for a window 420 pixels wide and 100 high inside
 *   - window.class, layout.gadget, button.gadget and bevel.image are
 *     installed in SYS:Classes (Reaction: AmigaOS 3.5 and later)
 *   - a bevel.image with a label and nothing inside it shows as a
 *     framed line of text when added to a layout
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/buttons_demo.js
 */

const { Window, Layout, Button, Bevel, EventKind, IDCMP,
        WindowPosition, BevelStyle } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { OK: 1, CANCEL: 2, HELP: 3, ABOUT: 4 };

/** What the Shell calls each button. */
const NAMES = {
  [ID.OK]:     'OK',
  [ID.CANCEL]: 'Cancel',
  [ID.HELP]:   'Help',
  [ID.ABOUT]:  'About',
};

/**
 * A plain text button.
 *
 * @param {number} id - one of ID
 * @param {string} text - the label; `_` marks the keyboard shortcut
 * @returns {Button}
 */
function button(id, text) {
  return new Button({ id, text });
}

let message = new Bevel({
  style: BevelStyle.FIELD,
  label: 'This is a message framed by a BEVEL.',
});

let window = new Window({
  title:       'Reaction Buttons',
  innerWidth:  420,
  innerHeight: 100,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [

      message,

      new Layout({
        orientation: 'horizontal',
        innerSpacing: 4,
        children: [
          button(ID.OK,     '_OK'),
          button(ID.CANCEL, '_Cancel'),
          button(ID.HELP,   '_Help'),
          button(ID.ABOUT,  '_About'),
        ],
      }),

    ],
  }),
});

window.open();
print('Click any button. OK, Cancel or the close gadget quits.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      print('Clicked ' + (NAMES[event.sourceId] || '?'));

      if (event.sourceId === ID.OK || event.sourceId === ID.CANCEL) break;
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
