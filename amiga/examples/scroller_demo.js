/*
 * scroller_demo.js - two scrollbars that report their position.
 *
 *   +--------------------------------------+
 *   | Horizontal:                          |
 *   | [<][>] [####                       ] |
 *   | Vertical:                            |
 *   | [ #                                ] |
 *   | [                                  ] |
 *   | [              Quit                ] |
 *   +--------------------------------------+
 *
 * Drag either scrollbar, or click its arrows, and the Shell prints
 * the new top position: "H.top" for the horizontal one, "V.top" for
 * the vertical one.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     has room for a window 320 pixels wide and 200 high inside
 *   - window.class, layout.gadget, scroller.gadget, button.gadget and
 *     label.image are installed in SYS:Classes (Reaction: AmigaOS 3.5
 *     and later)
 *   - scroller.gadget answers a request for its top position at the
 *     moment it reports a change
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/scroller_demo.js
 */

const { Window, Layout, Button, Scroller, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { VERTICAL: 1, HORIZONTAL: 2, QUIT: 3 };

/* Each scrollbar shows a tenth of what it scrolls over. */

let verticalScroller = new Scroller({
  id:          ID.VERTICAL,
  orientation: 'vertical',
  top:         0,
  visible:     20,
  total:       200,
  arrows:      true,          /* draw the arrow buttons */
});

let horizontalScroller = new Scroller({
  id:          ID.HORIZONTAL,
  orientation: 'horizontal',
  top:         0,
  visible:     100,
  total:       1000,
  arrows:      true,          /* draw the arrow buttons */
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction Scroller',
  innerWidth:  320,
  innerHeight: 200,
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
      new Label({ text: 'Horizontal:' }), horizontalScroller,
      new Label({ text: 'Vertical:' }),   verticalScroller,
      quitButton,
    ],
  }),
});

window.open();
print('Drag the scrollbars; click Quit or the close gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) {
      break;
    }

    if (event.kind === EventKind.SCROLLER_CHANGE) {
      let name = (event.sourceId === ID.VERTICAL) ? 'V' : 'H';
      let top  = event.source ? event.source.get('top') : '?';

      print(name + '.top = ' + top);
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
