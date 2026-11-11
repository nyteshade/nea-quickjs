/*
 * tabs_demo.js - three pages in one window, switched by a row of buttons.
 *
 *   +------------------------------------------+
 *   | [General] [Options] [ About ] [  Quit  ] |
 *   | +- General ----------------------------+ |
 *   | | Welcome to the multi-page demo.      | |
 *   | | Click the tabs above to switch pages.| |
 *   | | [ Try editing this field.          ] | |
 *   | +--------------------------------------+ |
 *   +------------------------------------------+
 *
 * Click General, Options or About and the lower part of the window
 * changes to that page. All three pages exist the whole time; the
 * Page gadget shows whichever one it is told is current.
 *
 * The file has three parts:
 *
 *   1. THE PAGES   - three small layouts, and the Page holding them.
 *   2. THE WINDOW  - the button row above the pages.
 *   3. THE LOOP    - a button click makes one page current.
 *
 * clicktab_demo.js does the same job with real tabs and no loop code.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     has room for a window 400 pixels wide and 240 high inside
 *   - window.class, layout.gadget (which also provides the page
 *     class), button.gadget, checkbox.gadget, string.gadget,
 *     slider.gadget and label.image are installed in SYS:Classes
 *     (Reaction: AmigaOS 3.5 and later)
 *   - setting the Page's current page while the window is open
 *     redraws it at once, with no refresh asked for
 *
 * Requires quickjs.library 0.157+.
 * Run: qjs examples/tabs_demo.js
 */

const { Window, Layout, Button, Label, CheckBox, StringGadget, Page, Slider,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. Only the
 *  four buttons are acted on; the gadgets on the pages are there to
 *  be played with. */
const ID = {
  GENERAL_TAB: 1, OPTIONS_TAB: 2, ABOUT_TAB: 3,
  FIELD: 50,
  FEATURE_A: 60, FEATURE_B: 61, FEATURE_C: 62,
  SLIDER: 70,
  QUIT: 99,
};


/* ==================================================================
 * 1. THE PAGES
 *
 * Each page is an ordinary layout with a titled frame round it. The
 * Page gadget holds all three and shows one at a time. (Since 0.157
 * it takes its pages as `children`, just as a Layout does.)
 * ================================================================== */

let generalPage = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'General',
  children: [
    new Label({ text: 'Welcome to the multi-page demo.' }),
    new Label({ text: 'Click the tabs above to switch pages.' }),
    new StringGadget({
      id: ID.FIELD, text: 'Try editing this field.', maxChars: 64,
    }),
  ],
});

let optionsPage = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'Options',
  children: [
    new CheckBox({
      id: ID.FEATURE_A, text: 'Enable feature A', selected: true,
    }),
    new CheckBox({
      id: ID.FEATURE_B, text: 'Enable feature B', selected: false,
    }),
    new CheckBox({
      id: ID.FEATURE_C, text: 'Enable feature C', selected: true,
    }),
  ],
});

let aboutPage = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'About',
  children: [
    new Label({ text: 'tabs_demo.js' }),
    new Label({ text: 'Reaction OO layer demo' }),
    new Label({ text: 'quickjs.library 0.156+' }),
    new Slider({
      id: ID.SLIDER, min: 0, max: 100, level: 75,
      orientation: 'horizontal', ticks: 11,
    }),
  ],
});

let pages = new Page({
  current:  0,
  children: [generalPage, optionsPage, aboutPage],
});

/** Which page each button brings to the front: an index into the
 *  Page's children. */
const PAGE_OF_BUTTON = {
  [ID.GENERAL_TAB]: 0,
  [ID.OPTIONS_TAB]: 1,
  [ID.ABOUT_TAB]:   2,
};

/**
 * Bring one page to the front.
 *
 * @param {number} index - index into the Page's children
 * @returns {undefined}
 */
function showPage(index) {
  pages.set({ current: index });
}


/* ==================================================================
 * 2. THE WINDOW
 *
 * A row of equal-width buttons, and under it the pages.
 * ================================================================== */

let generalButton = new Button({ id: ID.GENERAL_TAB, text: 'General' });
let optionsButton = new Button({ id: ID.OPTIONS_TAB, text: 'Options' });
let aboutButton   = new Button({ id: ID.ABOUT_TAB,   text: 'About'   });
let quitButton    = new Button({ id: ID.QUIT,        text: '_Quit'   });

let window = new Window({
  title:       'Tabs Demo',
  innerWidth:  400,
  innerHeight: 240,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [

      new Layout({
        orientation: 'horizontal',
        innerSpacing: 2,
        evenSize:    true,
        children: [ generalButton, optionsButton, aboutButton, quitButton ],
      }),

      pages,

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 * ================================================================== */

window.open();
print('Tabs demo. Click General / Options / About to switch.');
print('Click Quit or the close gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === ID.QUIT) break;

      let page = PAGE_OF_BUTTON[event.sourceId];
      if (page !== undefined) showPage(page);
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
