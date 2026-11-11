/*
 * string_demo.js - two text fields, one of them hiding what you type.
 *
 *   +--------------------------------------+
 *   | Name:      [                       ] |
 *   | Password:  [ ********              ] |
 *   | [       OK       ] [      Quit     ] |
 *   +--------------------------------------+
 *
 * Type into either field, then click OK to print what they hold. The
 * password itself is never printed, only whether there is one. The
 * password field uses one of string.gadget's built-in edit hooks;
 * StringHookType lists the others.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     has room for a window 320 pixels wide and 120 high inside
 *   - window.class, layout.gadget, string.gadget, button.gadget and
 *     label.image are installed in SYS:Classes (Reaction: AmigaOS 3.5
 *     and later)
 *   - the installed string.gadget has the password edit hook
 *
 * Requires quickjs.library 0.148+.
 * Run: qjs examples/string_demo.js
 */

const { Window, Layout, Button, StringGadget, Label, EventKind, IDCMP,
        WindowPosition, StringHookType } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { NAME: 1, PASSWORD: 2, OK: 3, QUIT: 4 };

/** The most characters either field will hold. */
const FIELD_MAX_CHARS = 64;

/**
 * Two children side by side.
 *
 * @param {object} left
 * @param {object} right
 * @returns {Layout}
 */
function row(left, right) {
  return new Layout({
    orientation: 'horizontal',
    innerSpacing: 4,
    children: [left, right],
  });
}

let nameLabel = new Label({ text: 'Name:' });
let nameField = new StringGadget({
  id:       ID.NAME,
  maxChars: FIELD_MAX_CHARS,
});

let passwordLabel = new Label({ text: 'Password:' });
let passwordField = new StringGadget({
  id:       ID.PASSWORD,
  maxChars: FIELD_MAX_CHARS,
  hookType: StringHookType.PASSWORD,
});

let okButton   = new Button({ id: ID.OK,   text: '_OK' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction StringGadget',
  innerWidth:  320,
  innerHeight: 120,
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
      row(nameLabel,     nameField),
      row(passwordLabel, passwordField),
      row(okButton,      quitButton),
    ],
  }),
});

window.open();
print('Type into either field; click OK to print, Quit to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === ID.QUIT) break;

      if (event.sourceId === ID.OK) {
        print('name=' + (nameField.get('text') || ''));
        print('pass=' + (passwordField.get('text') ? '<hidden>' : ''));
      }
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
