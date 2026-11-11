/*
 * integer_demo.js - a number field from 0 to 999 with spin arrows.
 *
 *   +----------------------------+
 *   | Enter a number 0..999:     |
 *   | [ 42                 ][<>] |
 *   | [          Quit          ] |
 *   +----------------------------+
 *
 * Type a number and press Return, or click the arrows, and the new
 * value is printed on the Shell. The gadget keeps the value within
 * its limits by itself. A port of the NDK example Integer.c.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     has room for a window 250 pixels wide and 80 high inside
 *   - window.class, layout.gadget, integer.gadget, button.gadget and
 *     label.image are installed in SYS:Classes (Reaction: AmigaOS 3.5
 *     and later)
 *   - the new value arrives as the event's code word (event.raw.code);
 *     the gadget is not asked for it
 *
 * Requires quickjs.library 0.148+.
 * Run: qjs examples/integer_demo.js
 */

const { Window, Layout, Button, Integer, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { NUMBER: 1, QUIT: 2 };

let caption = new Label({ text: 'Enter a number 0..999:' });

let numberField = new Integer({
  id:       ID.NUMBER,
  value:    42,
  minimum:  0,
  maximum:  999,
  maxChars: 3,      /* as many digits as the maximum has */
  arrows:   true,
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction Integer',
  innerWidth:  250,
  innerHeight: 80,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [ caption, numberField, quitButton ],
  }),
});

window.open();
print('Edit the number; click Quit or the close gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) {
      break;
    }

    if (event.kind === EventKind.INTEGER_CHANGED) {
      print('value = ' + event.raw.code);
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
