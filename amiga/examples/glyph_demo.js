/*
 * glyph_demo.js - every standard Reaction glyph, next to its name.
 *
 * A window opens with one row for each picture glyph.image can draw
 * (arrows, checkmark, the pop-up button symbols and so on), the glyph
 * on the left and its GlyphKind name on the right, and a Quit button
 * at the bottom. Use it to find the glyph you want. Quit or the close
 * gadget ends it.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), centred, and
 *     the screen is tall enough for one row per glyph plus a button:
 *     there are 24 kinds, so a 200 or 256 line screen is probably too short
 *   - window.class, layout.gadget, button.gadget, glyph.image and
 *     label.image are installed (standard from OS 3.2; earlier with
 *     ClassAct/Reaction)
 *   - a glyph.image can be given to a layout directly as a child
 *   - GlyphKind lists its entries in the order of images/glyph.h, and
 *     that is the order they are shown in
 *
 * Requires quickjs.library 0.210+.
 * Run: qjs examples/glyph_demo.js
 */

const { Window, Layout, Button, Glyph, Label, EventKind, IDCMP,
        WindowPosition, GlyphKind } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { QUIT: 1 };

/**
 * One row of the window: a glyph, then its name.
 *
 * @param {[string, number]} entry - a GlyphKind name and its value
 * @returns {Layout}
 */
function glyphRow([name, kind]) {
  return new Layout({
    orientation: 'horizontal',
    innerSpacing: 4,
    children: [
      new Glyph({ glyph: kind }),
      new Label({ text: name }),
    ],
  });
}

let window = new Window({
  title:       'Reaction Glyphs',
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 2,
    children: [
      ...Object.entries(GlyphKind).map(glyphRow),
      new Button({ id: ID.QUIT, text: '_Quit' }),
    ],
  }),
});

window.open();
print('Glyphs open. Click Quit or the close gadget to exit.');

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
