/*
 * radiobutton_demo.js - pick one of three fruits with radio buttons.
 *
 *   +-----------------------------+
 *   | Pick your favorite fruit.   |
 *   | (o) Apples                  |
 *   | ( ) Bananas                 |
 *   | ( ) Cherries                |
 *   | [          Quit           ] |
 *   +-----------------------------+
 *
 * The choices come from a plain JavaScript array of strings. Each
 * time you pick one, its name and index are printed on the Shell.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench)
 *   - window.class, layout.gadget, radiobutton.gadget, button.gadget
 *     and label.image are installed in SYS:Classes (Reaction: AmigaOS
 *     3.5 and later)
 *   - the index of the chosen button arrives as the event's code word
 *     (event.raw.code); the gadget is not asked for it
 *
 * Requires quickjs.library 0.151+.
 * Run: qjs examples/radiobutton_demo.js
 */

const { Window, Layout, Button, RadioButton, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { FRUIT: 1, QUIT: 2 };

/** The choices, top to bottom. `_` marks the keyboard shortcut. */
const FRUITS = ['_Apples', '_Bananas', '_Cherries'];

/* On OS 3.2 the only way to fill a radiobutton.gadget that works is
 * RADIOBUTTON_Labels with a struct List of nodes from
 * AllocRadioButtonNodeA. (RADIOBUTTON_Strings is documented as
 * RESERVED; RADIOBUTTON_LabelArray is OS4-only.) The RadioButton
 * wrapper (0.151+) accepts a `labels: [...]` array, builds the list
 * itself and frees it when the gadget is disposed. */
let fruitChoice = new RadioButton({
  id:         ID.FRUIT,
  labels:     FRUITS,
  selectedIx: 0,
});

let hint       = new Label({ text: 'Pick your favorite fruit.' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction RadioButton',
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [ hint, fruitChoice, quitButton ],
  }),
});

window.open();
print('Pick one; click Quit or the close gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) {
      break;
    }

    if (event.kind === EventKind.RADIO_SELECT) {
      let index = event.raw.code;

      print('Selected: ' + FRUITS[index] + ' (index ' + index + ')');
    }
  }
}
finally {
  /* Disposing the window disposes the radio button with it, and the
   * radio button frees its own label list. */
  window.dispose();
}

print('Bye.');
