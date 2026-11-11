/*
 * bevels_demo.js - every Reaction bevel style, labelled with its name.
 *
 * A window opens with nine frames stacked one under another, one for
 * each style bevel.image can draw, and a Quit button at the bottom.
 * Use it to choose a frame style by eye. Quit or the close gadget
 * ends it.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), centred, and
 *     the screen is tall enough for nine frames and a button
 *   - window.class, layout.gadget, button.gadget and bevel.image are
 *     installed (standard from OS 3.2; earlier with ClassAct/Reaction)
 *   - a bevel.image can be given to a layout directly as a child
 *
 * Requires quickjs.library 0.213+.
 * Run: qjs examples/bevels_demo.js
 */

const { Window, Layout, Button, Bevel, EventKind, IDCMP,
        WindowPosition, BevelStyle } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { QUIT: 1 };

/** The styles shown, top to bottom. Each is a key of BevelStyle and
 *  doubles as the frame's label. */
const STYLE_NAMES = ['THIN', 'BUTTON', 'GROUP', 'FIELD', 'NONE', 'DROPBOX',
                     'BOX', 'STANDARD', 'DISPLAY'];

/**
 * A frame drawn in one style, labelled with the style's name.
 *
 * @param {string} name - a key of BevelStyle
 * @returns {Bevel}
 */
function sample(name) {
  return new Bevel({ style: BevelStyle[name], label: name });
}

let window = new Window({
  title:       'Reaction Bevels',
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 3,
    children: [
      ...STYLE_NAMES.map(sample),
      new Button({ id: ID.QUIT, text: '_Quit' }),
    ],
  }),
});

window.open();
print('Bevels open. Click Quit or the close gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;
  }
}
finally {
  window.dispose();
}

print('Bye.');
