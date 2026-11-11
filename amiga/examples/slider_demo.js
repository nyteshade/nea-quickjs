/*
 * slider_demo.js - a slider from 0 to 100 that reports where it is.
 *
 *   +--------------------------------------+
 *   | Slide me:                            |
 *   | ==================|================= |
 *   | |   '   |   '   |   '   |   '   |    |   tick marks
 *   | [              Quit                ] |
 *   +--------------------------------------+
 *
 * Drag the knob and the new level is printed on the Shell each time
 * the slider reports it.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     has room for a window 300 pixels wide and 100 high inside
 *   - window.class, layout.gadget, slider.gadget, button.gadget and
 *     label.image are installed in SYS:Classes (Reaction: AmigaOS 3.5
 *     and later)
 *   - the new level arrives as the event's code word (event.raw.code);
 *     the gadget is not asked for it
 *
 * Requires quickjs.library 0.148+.
 * Run: qjs examples/slider_demo.js
 */

const { Window, Layout, Button, Slider, Label, EventKind, IDCMP,
        WindowPosition } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { SLIDER: 1, QUIT: 2 };

let slider = new Slider({
  id:          ID.SLIDER,
  min:         0,
  max:         100,
  level:       50,
  orientation: 'horizontal',
  ticks:       11,   /* one tick mark every ten steps, both ends included */
  shortTicks:  1,    /* SLIDER_ShortTicks: alternate long and short ticks */
});

let caption    = new Label({ text: 'Slide me:' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction Slider',
  innerWidth:  300,
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
    children: [ caption, slider, quitButton ],
  }),
});

window.open();
print('Drag the slider; click Quit or the close gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) {
      break;
    }

    if (event.kind === EventKind.SLIDER_CHANGE) {
      print('slider = ' + event.raw.code);
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
