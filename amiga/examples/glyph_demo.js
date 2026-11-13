/*
 * glyph_demo.js - every standard Reaction glyph, next to its name.
 *
 * A window opens with an entry for each picture glyph.image can draw
 * (arrows, checkmark, the pop-up button symbols and so on), the glyph
 * on the left and its GlyphKind name on the right, set out in three
 * columns, and a Quit button at the bottom. Use it to find the glyph
 * you want. Quit or the close gadget ends it.
 *
 * Assumptions:
 *   - opens on the default public screen (Workbench), centred, and
 *     the screen is big enough for eight rows of three entries plus a
 *     button. (One column of all 24 kinds, as this example used to
 *     have, was taller than a 200 or 256 line screen.)
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

/** How many glyphs go in one column before the next column starts. */
const ROWS_PER_COLUMN = 8;

/**
 * The columns of the window: each a stack of up to ROWS_PER_COLUMN
 * rows, filled top to bottom, then left to right.
 *
 * @param {Array<[string, number]>} entries - GlyphKind names and values
 * @returns {Layout[]}
 */
function glyphColumns(entries) {
  let columns = [];

  for (let first = 0; first < entries.length; first += ROWS_PER_COLUMN) {
    columns.push(new Layout({
      orientation: 'vertical',
      innerSpacing: 2,
      children: entries.slice(first, first + ROWS_PER_COLUMN).map(glyphRow),
    }));
  }

  return columns;
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

      new Layout({
        orientation: 'horizontal',
        innerSpacing: 8,
        children: glyphColumns(Object.entries(GlyphKind)),
      }),

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
