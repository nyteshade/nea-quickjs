/*
 * clicktab_demo.js - three tabbed pages that switch with no code at all.
 *
 *   +------------------------------------------+
 *   |  / General \/ Options \/ About \         |
 *   | +--------------------------------------+ |
 *   | | Welcome to the ClickTab demo.        | |
 *   | | Click a tab above to switch.         | |
 *   | | [ Editable field here.             ] | |
 *   | +--------------------------------------+ |
 *   | [                 Quit                 ] |
 *   +------------------------------------------+
 *
 * Click a tab and its page comes to the front. The tab strip is told
 * which group of pages it owns, and from then on Reaction flips the
 * pages itself: the loop below only prints which tab was chosen.
 *
 * The file has three parts:
 *
 *   1. THE PAGES   - three small layouts, and the group holding them.
 *   2. THE WINDOW  - the tab strip that owns the pages, and Quit.
 *   3. THE LOOP    - report each tab change on the Shell.
 *
 * tabs_demo.js does the same job by hand, with a row of buttons.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     has room for a window 420 pixels wide and 260 high inside
 *   - window.class, layout.gadget (which also provides the page
 *     class), clicktab.gadget, button.gadget, checkbox.gadget,
 *     string.gadget, slider.gadget and label.image are installed in
 *     SYS:Classes (Reaction: AmigaOS 3.5 and later)
 *   - clicktab.gadget draws, flips and disposes the page group it is
 *     given, as NDK Examples/Page.c relies on
 *   - clicktab.gadget answers a request for its current tab at the
 *     moment it reports a change
 *
 * Requires quickjs.library 0.168+.
 * Run: qjs examples/clicktab_demo.js
 */

const { Window, Layout, Page, Button, ClickTab, Label, CheckBox,
        StringGadget, Slider, EventKind, WindowPosition,
        BevelStyle } = amiga.boopsi;

/** Gadget IDs: how an event says which gadget it came from. Only TABS
 *  and QUIT are acted on; the gadgets on the pages are there to be
 *  played with. */
const ID = {
  TABS: 1,
  FIELD: 50,
  OPTION_A: 60, OPTION_B: 61, OPTION_C: 62,
  SLIDER: 70,
  QUIT: 99,
};


/* ==================================================================
 * 1. THE PAGES
 *
 * Each page is an ordinary layout with a titled frame round it. The
 * Page gadget holds all three and shows one at a time.
 * ================================================================== */

let generalPage = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'General',
  children: [
    new Label({ text: 'Welcome to the ClickTab demo.' }),
    new Label({ text: 'Click a tab above to switch.' }),
    new StringGadget({
      id: ID.FIELD, text: 'Editable field here.', maxChars: 64,
    }),
  ],
});

let optionsPage = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'Options',
  children: [
    new CheckBox({ id: ID.OPTION_A, text: 'Option _A', selected: true  }),
    new CheckBox({ id: ID.OPTION_B, text: 'Option _B', selected: false }),
    new CheckBox({ id: ID.OPTION_C, text: 'Option _C', selected: true  }),
  ],
});

let aboutPage = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'About',
  children: [
    new Label({ text: 'clicktab_demo.js' }),
    new Label({ text: 'Exercises the 0.168 labels:[] helper' }),
    new Slider({
      id: ID.SLIDER, min: 0, max: 100, level: 50,
      orientation: 'horizontal', ticks: 11,
    }),
  ],
});

let pages = new Page({
  current:  0,
  children: [generalPage, optionsPage, aboutPage],
});


/* ==================================================================
 * 2. THE WINDOW
 *
 * The tab strip is given the page group as `pageGroup`. That makes
 * the pages part of the tab strip: it draws its frame round them and
 * flips them when a tab is clicked.
 * ================================================================== */

/* The tab names are a plain array, in the same order as the pages. */
let tabs = new ClickTab({
  id:        ID.TABS,
  labels:    ['General', 'Options', 'About'],
  current:   0,
  pageGroup: pages.ptr,
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

/* `pages` must NOT also be listed as a child of the window's layout.
 * The tab strip already shows it and disposes it, so listing it again
 * would draw every page twice and dispose the page group twice on the
 * way out. */
let window = new Window({
  title:       'ClickTab Demo',
  innerWidth:  420,
  innerHeight: 260,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,

  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [ tabs, quitButton ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Nothing here switches pages. The loop only reports.
 * ================================================================== */

/**
 * Which tab a tab-strip event selected. The event carries the index
 * when the event pump has filled it in; otherwise the gadget is asked.
 *
 * @param {object} event - a CLICKTAB_CHANGE event from tabs
 * @returns {*} the tab index, counted from 0
 */
function currentTab(event) {
  return (typeof event.attrs.current === 'number')
           ? event.attrs.current
           : tabs.get('current');
}

window.open();
print('ClickTab demo open. Switch tabs; click Quit or the close');
print('gadget to exit.');

try {
  for (let event of window.events()) {
    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) {
      break;
    }

    if (event.kind === EventKind.CLICKTAB_CHANGE &&
        event.sourceId === ID.TABS) {
      print('tab ' + currentTab(event));
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
