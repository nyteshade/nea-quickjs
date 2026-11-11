/*
 * settings_panel_demo.js - a preferences dialog that reports your choices.
 *
 *   +- Identity ------------------+
 *   | Name:   [Brielle__________] |
 *   | Email:  [me@example.com___] |
 *   +- Notifications -------------+
 *   | (o) All                     |
 *   | ( ) Mentions only           |
 *   | ( ) None                    |
 *   +- Behaviour -----------------+
 *   | [ ] Auto-save               |
 *   | [x] Confirm on quit         |
 *   | [ ] Dark mode               |
 *   +-----------------------------+
 *   | [ OK ] [ Apply ] [ Cancel ] |
 *   +-----------------------------+
 *
 * Change anything you like, then click Apply: the current settings are
 * printed on the Shell and the dialog stays. OK prints them and
 * closes. Cancel and the close gadget close without printing them.
 * Nothing is saved anywhere.
 *
 * The file has three parts, read top to bottom:
 *
 *   1. THE REPORT - settings as lines of text. Plain JavaScript.
 *   2. THE DIALOG - the window, written as a tree that looks like it.
 *   3. THE LOOP   - clicks in, settings read and printed.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench). The
 *     window takes its size from its contents, and its margins from
 *     the screen's font, so how big it is depends on that font
 *   - Reaction draws its gadgets in the screen's own font, so that is
 *     the font the margins are worked out from
 *   - window.class, layout.gadget, button.gadget, string.gadget,
 *     checkbox.gadget, radiobutton.gadget and label.image are
 *     installed in SYS:Classes, as they are on AmigaOS 3.2
 *   - the settings live in the gadgets and nowhere else; they are read
 *     back from the gadgets when OK or Apply is clicked
 *   - a radio group's choice is its `selectedIx` attribute (the index
 *     of the chosen button); `selected` on a radio group is the plain
 *     gadget "is pressed" flag and says nothing about which button
 *
 * Requires quickjs.library 0.214+.
 * Run: qjs examples/settings_panel_demo.js
 */

const { Window, Layout, Button, CheckBox, RadioButton, StringGadget,
        Label, EventKind, WindowPosition, BevelStyle } = amiga.boopsi;
const { ScreenFont } = amiga;


/* ==================================================================
 * 1. THE REPORT
 *
 * What gets printed when the settings are committed. Nothing here
 * knows about gadgets.
 * ================================================================== */

/** The notification choices as they are printed, in the order of the
 *  radio buttons. */
const NOTIFY_NAMES = ['All', 'Mentions only', 'None'];

/**
 * The settings as lines for the Shell.
 *
 * @param {string} heading - what was done, e.g. 'Apply (saving)'
 * @param {{name: string, email: string, notify: string,
 *          autoSave: boolean, confirm: boolean,
 *          darkMode: boolean}} settings
 * @returns {Array<string>}
 */
function reportLines(heading, settings) {
  return [
    '--- ' + heading + ' ---',
    '  name:     ' + settings.name,
    '  email:    ' + settings.email,
    '  notify:   ' + settings.notify,
    '  autosave: ' + settings.autoSave,
    '  confirm:  ' + settings.confirm,
    '  darkmode: ' + settings.darkMode,
  ];
}


/* ==================================================================
 * 2. THE DIALOG
 *
 * First the gadgets that hold a setting, each given a name. Then the
 * window, which arranges them in three titled boxes. Read the
 * `layout:` tree next to the picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = {
  NAME:     1,
  EMAIL:    2,
  NOTIFY:   3,
  AUTOSAVE: 10,
  CONFIRM:  11,
  DARKMODE: 12,
  OK:       100,
  APPLY:    101,
  CANCEL:   102,
};

/* Spacing. Left alone, Reaction puts gadgets edge to edge. Every gap
 * here is cut from the height of one line of the screen's font, so
 * the dialog keeps its proportions on any font. ScreenFont looks that
 * font up; across() turns a distance down the screen into the same
 * distance across it, which differs when pixels are not square. */
const screenFont = new ScreenFont();

/** One line of text, in pixels. */
const LINE = screenFont.height;

/** Space between a frame and what is inside it. */
const MARGIN_ACROSS = screenFont.across(LINE);
const MARGIN_DOWN   = Math.round(LINE / 2);

/** Space between neighbours in a row, and in a column. */
const GAP_ACROSS = screenFont.across(Math.round(LINE / 2));
const GAP_DOWN   = Math.round(LINE / 3);

/** Space between the three boxes and the button row. */
const BOX_GAP = Math.round(LINE * 2 / 3);

/** How many characters an entry field shows before it scrolls. */
const FIELD_VISIBLE_CHARS = 24;

/**
 * The four edge margins of a layout, ready to spread into its options.
 *
 * @returns {{leftSpacing: number, rightSpacing: number,
 *            topSpacing: number, bottomSpacing: number}}
 */
function margins() {
  return {
    leftSpacing:   MARGIN_ACROSS,
    rightSpacing:  MARGIN_ACROSS,
    topSpacing:    MARGIN_DOWN,
    bottomSpacing: MARGIN_DOWN,
  };
}

/**
 * A titled box with its children stacked inside, clear of the frame.
 *
 * @param {string} title
 * @param {...object} children
 * @returns {Layout}
 */
function group(title, ...children) {
  return new Layout({
    orientation:  'vertical',
    bevelStyle:   BevelStyle.GROUP,
    label:        title,
    ...margins(),
    innerSpacing: GAP_DOWN,
    children,
  });
}

/**
 * A caption with an entry field to its right.
 *
 * @param {string} caption
 * @param {StringGadget} field
 * @returns {Layout}
 */
function captioned(caption, field) {
  return new Layout({
    orientation: 'horizontal', innerSpacing: GAP_ACROSS,
    children: [ new Label({ text: caption }), field ],
  });
}

let nameField = new StringGadget({
  id: ID.NAME, text: 'Brielle', maxChars: 64,
  minVisible: FIELD_VISIBLE_CHARS,
});
let emailField = new StringGadget({
  id: ID.EMAIL, text: 'me@example.com', maxChars: 128,
  minVisible: FIELD_VISIBLE_CHARS,
});

let notifyRadio = new RadioButton({
  id: ID.NOTIFY,
  labels: ['_All', '_Mentions only', 'No_ne'],
  selectedIx: 0,
});

let autoSaveBox = new CheckBox({
  id: ID.AUTOSAVE, text: '_Auto-save', selected: false,
});
let confirmBox = new CheckBox({
  id: ID.CONFIRM, text: '_Confirm on quit', selected: true,
});
let darkModeBox = new CheckBox({
  id: ID.DARKMODE, text: '_Dark mode', selected: false,
});

let window = new Window({
  title:       'Preferences',
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,

  /* No size is given: the window is as big as its contents need. */
  layout: new Layout({
    orientation: 'vertical',
    ...margins(),
    innerSpacing: BOX_GAP,
    children: [

      group('Identity',
        captioned('Name:',  nameField),
        captioned('Email:', emailField)),

      group('Notifications', notifyRadio),

      group('Behaviour', autoSaveBox, confirmBox, darkModeBox),

      new Layout({
        orientation: 'horizontal', innerSpacing: GAP_ACROSS, evenSize: true,
        children: [
          new Button({ id: ID.OK,     text: '_OK' }),
          new Button({ id: ID.APPLY,  text: 'Appl_y' }),
          new Button({ id: ID.CANCEL, text: 'Cance_l' }),
        ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Nothing on screen needs redrawing here: the gadgets look after
 * themselves. The loop only waits for one of the three buttons.
 * ================================================================== */

/**
 * Read every setting back from its gadget.
 *
 * @returns {{name: string, email: string, notify: string,
 *            autoSave: boolean, confirm: boolean, darkMode: boolean}}
 */
function readSettings() {
  return {
    name:     nameField.get('text')  || '',
    email:    emailField.get('text') || '',
    notify:   NOTIFY_NAMES[notifyRadio.get('selectedIx') | 0] || '?',
    autoSave: !!autoSaveBox.get('selected'),
    confirm:  !!confirmBox.get('selected'),
    darkMode: !!darkModeBox.get('selected'),
  };
}

/**
 * Print the current settings on the Shell.
 *
 * @param {string} heading - what was done
 * @returns {undefined}
 */
function printSettings(heading) {
  for (let line of reportLines(heading, readSettings())) print(line);
}

/** What each button does. A handler returns true when the dialog
 *  should close. */
const onClick = {
  [ID.OK]: () => {
    printSettings('OK (saving + closing)');
    return true;
  },

  [ID.APPLY]: () => {
    printSettings('Apply (saving)');
    return false;
  },

  [ID.CANCEL]: () => {
    print('Cancelled.');
    return true;
  },
};

window.open();
screenFont.close();      /* the open window holds the screen from here */
print('Settings dialog open. Try the controls, then OK / Apply / Cancel.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) {
      print('(closed via gadget)');
      break;
    }

    if (event.kind === EventKind.BUTTON_CLICK) {
      let handler = onClick[event.sourceId];
      if (handler && handler()) break;
    }
  }
}
finally {
  window.dispose();
  screenFont.close();    /* does nothing if it was closed above */
}

print('Bye.');
