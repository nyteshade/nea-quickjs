/*
 * login_demo.js — username/password form with simple validation.
 *
 * Two StringGadgets (username + password — password not actually
 * masked since string.gadget's hook-based password mode needs a
 * SHK_PASSWORD setup we haven't wrapped). Login button validates
 * against a hardcoded credential pair and updates a status line.
 * Three failed attempts disables Login.
 *
 * Demonstrates:
 *   - Multi-field form with .text round-trip
 *   - Conditional UI state (disable Login after N failures)
 *   - Status line with multiple states (idle / success / fail / locked)
 *
 * Requires quickjs.library 0.156+.
 * Run:  qjs examples/login_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Label, StringGadget,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { USER: 1, PASS: 2, LOGIN: 3, RESET: 4, QUIT: 5 };

const VALID_USER = 'amiga';
const VALID_PASS = 'reaction';

let userField = new StringGadget({ id: GID.USER, text: '', maxChars: 64 });
let passField = new StringGadget({ id: GID.PASS, text: '', maxChars: 64 });

let formGroup = new Layout({
  orientation: 'vertical', innerSpacing: 6,
  bevelStyle:  BevelStyle.GROUP, label: 'Sign in',
  children: [
    new Layout({
      orientation: 'horizontal', innerSpacing: 4,
      children: [ new Label({ text: 'Username:' }), userField ],
    }),
    new Layout({
      orientation: 'horizontal', innerSpacing: 4,
      children: [ new Label({ text: 'Password:' }), passField ],
    }),
  ],
});

/* statusLabel updates per login attempt — readonly StringGadget rather
 * than label.image (Label.js JSDoc: static-only on OS3.2). */
let statusLabel = new StringGadget({
  text: 'Hint: try username "amiga", password "reaction".',
  readOnly: true, maxChars: 80, minVisible: 40,
});

let loginBtn = new Button({ id: GID.LOGIN, text: '_Login' });
let resetBtn = new Button({ id: GID.RESET, text: '_Clear' });
let quitBtn  = new Button({ id: GID.QUIT,  text: '_Quit'  });

let buttonRow = new Layout({
  orientation: 'horizontal', innerSpacing: 4, evenSize: true,
  children: [ loginBtn, resetBtn, quitBtn ],
});

let win = new Window({
  title:       'Login',
  innerWidth:  360,
  innerHeight: 200,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [ formGroup, statusLabel, buttonRow ],
  }),
});

let attempts = 0;
const MAX_ATTEMPTS = 3;
let locked = false;

function clearForm() {
  userField.set({ text: '' });
  passField.set({ text: '' });
}

function tryLogin() {
  if (locked) return;
  let u = userField.get('text') || '';
  let p = passField.get('text') || '';

  if (!u || !p) {
    statusLabel.text = 'Please fill in both fields.';
    return;
  }
  if (u === VALID_USER && p === VALID_PASS) {
    statusLabel.text = 'Welcome, ' + u + '!';
    print('Login successful for "' + u + '"');
    return true;
  }
  attempts++;
  let left = MAX_ATTEMPTS - attempts;
  if (left <= 0) {
    locked = true;
    statusLabel.text = 'Account locked after ' + MAX_ATTEMPTS + ' failures.';
    loginBtn.set({ disabled: true });
    print('Account locked.');
  } else {
    statusLabel.text = 'Invalid credentials. ' + left + ' attempt(s) remaining.';
  }
  return false;
}

win.open();
print('Login form open. Try the right credentials, or fail your way to a lockout.');

let done = false;
try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.LOGIN:
          if (tryLogin()) done = true;
          break;
        case GID.RESET:
          clearForm();
          statusLabel.text = 'Form cleared.';
          break;
        case GID.QUIT:
          done = true;
          break;
      }
      if (done) break;
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
