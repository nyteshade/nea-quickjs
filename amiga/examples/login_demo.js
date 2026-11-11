/*
 * login_demo.js - a sign-in form that locks after three wrong tries.
 *
 *   +- Sign in -----------------------------------+
 *   | Username: [______________________________]  |
 *   | Password: [______________________________]  |
 *   +---------------------------------------------+
 *   | Hint: try username "amiga", password ...    |   status line
 *   | [   Login   ]  [   Clear   ]  [   Quit   ]  |
 *   +---------------------------------------------+
 *
 * Type a name and a password and click Login. The right pair (it is in
 * the hint) signs you in and ends the demo. A wrong pair costs one of
 * three attempts; after the third the Login button is ghosted. Clear
 * empties both fields.
 *
 * The file has three parts, read top to bottom:
 *
 *   1. THE DOOR  - who gets in and when it locks. No GUI.
 *   2. THE FORM  - the window, written as a tree that looks like it.
 *   3. THE LOOP  - clicks in, door asked, form redrawn.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 360 x 200 pixels inside
 *   - window.class, layout.gadget, button.gadget, string.gadget and
 *     label.image are installed in SYS:Classes, as they are on
 *     AmigaOS 3.2
 *   - the password is shown as it is typed: string.gadget hides text
 *     only through an edit hook (SHK_PASSWORD) that this demo does not
 *     set up
 *   - the status line is a read-only string gadget because label.image
 *     shows only the text it was created with on OS 3.2
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/login_demo.js
 */

const { Window, Layout, Button, Label, StringGadget,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;


/* ==================================================================
 * 1. THE DOOR
 *
 * Checks a name and password, counts failures and locks. It keeps a
 * message saying what happened last; the form below only shows it.
 * ================================================================== */

/** The one name and password that are let in. */
const VALID_USER = 'amiga';
const VALID_PASS = 'reaction';

/** How many wrong pairs are allowed before the door locks. */
const MAX_ATTEMPTS = 3;

class Door {
  /**
   * A door nobody has tried yet.
   */
  constructor() {
    /** @type {number} wrong pairs so far */
    this.attempts = 0;

    /** @type {boolean} true once MAX_ATTEMPTS wrong pairs were tried */
    this.locked = false;

    /** @type {boolean} true once the right pair was given */
    this.isOpen = false;

    /** @type {string} what to tell the person at the door */
    this.message = 'Hint: try username "' + VALID_USER +
                   '", password "' + VALID_PASS + '".';
  }

  /**
   * Try a name and password. Does nothing at all once locked.
   *
   * @param {string} user
   * @param {string} password
   * @returns {undefined}
   */
  knock(user, password) {
    if (this.locked) return;

    if (!user || !password) {
      this.message = 'Please fill in both fields.';
      return;
    }

    if (user === VALID_USER && password === VALID_PASS) {
      this.message = 'Welcome, ' + user + '!';
      this.isOpen = true;
      return;
    }

    this.attempts++;
    let left = MAX_ATTEMPTS - this.attempts;

    if (left <= 0) {
      this.locked = true;
      this.message = 'Account locked after ' + MAX_ATTEMPTS + ' failures.';
    } else {
      this.message = 'Invalid credentials. ' + left +
                     ' attempt(s) remaining.';
    }
  }

  /**
   * Note that the form was emptied. Attempts are not given back.
   *
   * @returns {undefined}
   */
  formCleared() {
    this.message = 'Form cleared.';
  }
}


/* ==================================================================
 * 2. THE FORM
 *
 * First the gadgets the loop needs to talk to, each given a name. Then
 * the window, which arranges them. Read the `layout:` tree next to the
 * picture at the top of the file.
 * ================================================================== */

let door = new Door();

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { USER: 1, PASS: 2, LOGIN: 3, CLEAR: 4, QUIT: 5 };

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

let userField = new StringGadget({ id: ID.USER, text: '', maxChars: 64 });
let passField = new StringGadget({ id: ID.PASS, text: '', maxChars: 64 });

/* The status changes with every attempt, so it is a read-only string
 * gadget rather than a Label: label.image is for static text only on
 * OS 3.2. */
let statusLine = new StringGadget({
  text: door.message,
  readOnly: true, maxChars: 80, minVisible: 40,
});

let loginButton = new Button({ id: ID.LOGIN, text: '_Login' });
let clearButton = new Button({ id: ID.CLEAR, text: '_Clear' });
let quitButton  = new Button({ id: ID.QUIT,  text: '_Quit'  });

let window = new Window({
  title:       'Login',
  innerWidth:  360,
  innerHeight: 200,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,

  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [

      new Layout({
        orientation: 'vertical', innerSpacing: 6,
        bevelStyle:  BevelStyle.GROUP, label: 'Sign in',
        children: [
          captioned('Username:', userField),
          captioned('Password:', passField),
        ],
      }),

      statusLine,

      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ loginButton, clearButton, quitButton ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Wait for a click, tell the door, then make the form show whatever
 * the door now says.
 * ================================================================== */

/** What the form currently shows, so that show() only touches a gadget
 *  whose content has really changed. It starts out as the gadgets were
 *  built: the door's first message, and Login available. */
let shown = { status: door.message, login: false };

/**
 * Set one gadget attribute, but only if it differs from what is
 * already on screen.
 *
 * @param {string} key - any unique name for this gadget + attribute
 * @param {object} gadget
 * @param {string} attribute - e.g. 'text', 'disabled'
 * @param {*} value
 * @returns {undefined}
 */
function show(key, gadget, attribute, value) {
  if (shown[key] === value) return;

  gadget.set({ [attribute]: value });
  shown[key] = value;
}

/**
 * Make the form match the door.
 *
 * @returns {undefined}
 */
function render() {
  show('status', statusLine,  'text',     door.message);
  show('login',  loginButton, 'disabled', door.locked);
}

/** What each button does. The two entry fields belong to the person
 *  typing, so they are read and emptied here rather than in render().
 *  A handler may return a line to print on the Shell. */
const onClick = {
  [ID.LOGIN]: () => {
    let wasLocked = door.locked;
    let user      = userField.get('text') || '';
    let password  = passField.get('text') || '';

    door.knock(user, password);

    if (door.isOpen) return 'Login successful for "' + user + '"';
    if (door.locked && !wasLocked) return 'Account locked.';
    return '';
  },

  [ID.CLEAR]: () => {
    userField.set({ text: '' });
    passField.set({ text: '' });
    door.formCleared();
    return '';
  },
};

window.open();
print('Login form open. Try the right credentials, ' +
      'or fail your way to a lockout.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind !== EventKind.BUTTON_CLICK) continue;
    if (event.sourceId === ID.QUIT) break;

    let news = onClick[event.sourceId] && onClick[event.sourceId]();

    render();
    if (news) print(news);

    /* Signed in: there is nothing more for the form to do. */
    if (door.isOpen) break;
  }
}
finally {
  window.dispose();
}

print('Bye.');
