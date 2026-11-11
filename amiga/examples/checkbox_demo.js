/*
 * checkbox_demo.js - two checkboxes that report each time they change.
 *
 *   +------------------------------------------+
 *   | [ ] CheckBox 1                           |
 *   | [ ] CheckBox 2                           |
 *   | The checkbox may have its label placed   |
 *   | either on the left or right side. ...    |
 *   | [                 Quit                 ] |
 *   +------------------------------------------+
 *
 * Click a checkbox, or its label, and the Shell says whether it is
 * now checked. A port of the NDK example CheckBox.c.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench)
 *   - window.class, layout.gadget, checkbox.gadget, button.gadget and
 *     label.image are installed in SYS:Classes (Reaction: AmigaOS 3.5
 *     and later)
 *   - label.image breaks its text into lines at each newline
 *
 * Requires quickjs.library 0.148+.
 * Run: qjs examples/checkbox_demo.js
 */

const { Window, Layout, Button, CheckBox, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. The two
 *  checkbox IDs are also the numbers printed on the Shell. */
const ID = { FIRST_BOX: 1, SECOND_BOX: 2, QUIT: 3 };

let firstBox  = new CheckBox({ id: ID.FIRST_BOX,  text: 'CheckBox _1' });
let secondBox = new CheckBox({ id: ID.SECOND_BOX, text: 'CheckBox _2' });

/* The line holding a single space is a blank line between the two
 * paragraphs. */
let note = new Label({
  text: 'The checkbox may have its label placed\n' +
        'either on the left or right side.\n \n' +
        'You may click the label text as well\n' +
        'as the check box itself.',
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'ReAction CheckBox Example',
  screenTitle: 'ReAction',
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [ firstBox, secondBox, note, quitButton ],
  }),
});

window.open();
print('Click the checkboxes; click Quit or the close gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) {
      break;
    }

    if (event.kind === EventKind.CHECKBOX_TOGGLE) {
      let checked = event.source ? event.source.checked : null;

      print('CB' + event.sourceId + ' -> ' +
            (checked ? 'checked' : 'unchecked'));
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
