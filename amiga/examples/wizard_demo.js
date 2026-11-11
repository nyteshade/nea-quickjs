/*
 * wizard_demo.js - a three-step setup wizard with Back, Next and Finish.
 *
 *   +- Step 2: Identity ---------------------------+
 *   | Tell us about yourself.                      |
 *   | Name:  [__________________________________]  |   one page of
 *   | Email: [__________________________________]  |   three
 *   +----------------------------------------------+
 *   | Step 2 of 3                                  |   status line
 *   | [ < Back ] [ Next > ] [ Finish ] [ Cancel ]  |
 *   +----------------------------------------------+
 *
 * Next and Back move between the pages: a welcome, your name and
 * email, and how often you want updates. Back is ghosted on the first
 * page, Next on the last, and Finish everywhere but the last. Finish
 * prints what you entered on the Shell; Cancel and the close gadget
 * leave without printing it.
 *
 * The file has three parts, read top to bottom:
 *
 *   1. THE WIZARD - which step we are on, and the summary. No GUI.
 *   2. THE PANEL  - the window, written as a tree that looks like it.
 *   3. THE LOOP   - clicks in, wizard told, panel redrawn.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 420 x 300 pixels inside
 *   - window.class, layout.gadget (which also provides the page
 *     group), button.gadget, string.gadget, radiobutton.gadget and
 *     label.image are installed in SYS:Classes, as they are on
 *     AmigaOS 3.2
 *   - the pages are given to Page as `children`, which needs
 *     quickjs.library 0.157
 *   - the status line is a read-only string gadget because label.image
 *     is for static text only on OS 3.2
 *   - what you type lives in the gadgets and nowhere else; it is read
 *     back from them when Finish is clicked, whichever page is showing
 *   - a radio group's choice is its `selectedIx` attribute (the index
 *     of the chosen button); `selected` on a radio group is the plain
 *     gadget "is pressed" flag and says nothing about which button
 *
 * Requires quickjs.library 0.157+.
 * Run: qjs examples/wizard_demo.js
 */

const { Window, Layout, Button, Page, Label, RadioButton,
        StringGadget, EventKind, WindowPosition, BevelStyle } = amiga.boopsi;


/* ==================================================================
 * 1. THE WIZARD
 *
 * Which step is showing, and how the answers are written up at the
 * end. Nothing here knows about gadgets.
 * ================================================================== */

/** How many steps the wizard has. */
const STEP_COUNT = 3;

/** The update choices as they are printed, in the order of the radio
 *  buttons. */
const FREQUENCY_NAMES = ['Daily updates', 'Weekly summary', 'No email'];

class Wizard {
  /**
   * @param {number} stepCount - how many steps there are
   */
  constructor(stepCount) {
    /** @type {number} */
    this.stepCount = stepCount;

    /** @type {number} the step showing, counting from 0 */
    this.step = 0;
  }

  /** @returns {boolean} */
  get onFirstStep() {
    return this.step === 0;
  }

  /** @returns {boolean} */
  get onLastStep() {
    return this.step === this.stepCount - 1;
  }

  /**
   * Go back one step. Does nothing on the first.
   *
   * @returns {undefined}
   */
  back() {
    if (this.step > 0) this.step--;
  }

  /**
   * Go on one step. Does nothing on the last.
   *
   * @returns {undefined}
   */
  next() {
    if (this.step < this.stepCount - 1) this.step++;
  }
}

/**
 * The finished wizard's answers as lines for the Shell.
 *
 * @param {{name: ?string, email: ?string, frequency: number}} answers -
 *   `frequency` is an index into FREQUENCY_NAMES
 * @returns {Array<string>}
 */
function summaryLines(answers) {
  return [
    '--- Wizard finished ---',
    '  name:     ' + (answers.name  || '(empty)'),
    '  email:    ' + (answers.email || '(empty)'),
    '  emailFreq: ' + (FREQUENCY_NAMES[answers.frequency] || '?'),
  ];
}


/* ==================================================================
 * 2. THE PANEL
 *
 * First the gadgets the loop needs to talk to, each given a name. Then
 * the window: a Page group holding the three steps, of which only the
 * current one shows, above the status line and the buttons. Read the
 * `layout:` tree next to the picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = {
  BACK: 1, NEXT: 2, FINISH: 3, CANCEL: 4,
  NAME: 100, EMAIL: 101, FREQUENCY: 200,
};

/**
 * One step of the wizard: a titled box with its children stacked
 * inside.
 *
 * @param {string} title
 * @param {...object} children
 * @returns {Layout}
 */
function stepPage(title, ...children) {
  return new Layout({
    orientation: 'vertical', innerSpacing: 6,
    bevelStyle:  BevelStyle.GROUP,
    label:       title,
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
    orientation: 'horizontal', innerSpacing: 4,
    children: [ new Label({ text: caption }), field ],
  });
}

let nameField  = new StringGadget({ id: ID.NAME,  text: '', maxChars: 64 });
let emailField = new StringGadget({ id: ID.EMAIL, text: '', maxChars: 128 });

let frequencyRadio = new RadioButton({
  id: ID.FREQUENCY,
  labels: ['_Daily updates', '_Weekly summary', 'Don\'t e_mail me'],
  selectedIx: 1,
});

let pages = new Page({
  current: 0,
  children: [

    stepPage('Step 1: Welcome',
      new Label({ text: 'Welcome to the setup wizard.' }),
      new Label({ text: 'This will walk you through three steps.' }),
      new Label({ text: 'Click Next to begin.' })),

    stepPage('Step 2: Identity',
      new Label({ text: 'Tell us about yourself.' }),
      captioned('Name: ', nameField),
      captioned('Email:', emailField)),

    stepPage('Step 3: Preferences',
      new Label({ text: 'How often would you like updates?' }),
      frequencyRadio),

  ],
});

/* The step number changes, so it is shown in a read-only string
 * gadget rather than a Label: label.image is static-only on OS 3.2. */
let statusLine = new StringGadget({
  text: 'Step 1 of 3', readOnly: true, maxChars: 32,
});

let backButton   = new Button({ id: ID.BACK,   text: '< _Back',
                                disabled: true });
let nextButton   = new Button({ id: ID.NEXT,   text: '_Next >' });
let finishButton = new Button({ id: ID.FINISH, text: '_Finish',
                                disabled: true });
let cancelButton = new Button({ id: ID.CANCEL, text: '_Cancel' });

let window = new Window({
  title:       'Setup Wizard',
  innerWidth:  420,
  innerHeight: 300,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,

  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [

      pages,

      statusLine,

      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ backButton, nextButton, finishButton, cancelButton ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Wait for a click, tell the wizard, then make the panel show whatever
 * step the wizard is now on.
 * ================================================================== */

let wizard = new Wizard(STEP_COUNT);

/** The step the panel currently shows. It starts out as the gadgets
 *  were built: on the first step. */
let shownStep = 0;

/**
 * Make the whole panel match the wizard. Nothing is touched unless the
 * step has changed: turning a page makes the Page group lay itself out
 * again, which is not worth doing for nothing.
 *
 * @returns {undefined}
 */
function render() {
  if (shownStep === wizard.step) return;

  pages.set({ current: wizard.step });
  statusLine.text = 'Step ' + (wizard.step + 1) + ' of ' + wizard.stepCount;

  backButton.set({   disabled: wizard.onFirstStep });
  nextButton.set({   disabled: wizard.onLastStep });
  finishButton.set({ disabled: !wizard.onLastStep });

  shownStep = wizard.step;
}

/**
 * Print what was entered, read back from the gadgets.
 *
 * @returns {undefined}
 */
function printSummary() {
  let lines = summaryLines({
    name:      nameField.get('text'),
    email:     emailField.get('text'),
    frequency: frequencyRadio.get('selectedIx') | 0,
  });

  for (let line of lines) print(line);
}

/** What each button does. A handler returns true when the wizard
 *  should close. */
const onClick = {
  [ID.BACK]: () => {
    wizard.back();
    return false;
  },

  [ID.NEXT]: () => {
    wizard.next();
    return false;
  },

  [ID.FINISH]: () => {
    printSummary();
    return true;
  },

  [ID.CANCEL]: () => {
    print('Wizard cancelled.');
    return true;
  },
};

window.open();
print('Wizard open. Use Back / Next to navigate, Finish on the last step.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      let handler = onClick[event.sourceId];
      if (handler && handler()) break;
    }

    render();
  }
}
finally {
  window.dispose();
}

print('Bye.');
