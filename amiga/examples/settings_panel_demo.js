/*
 * settings_panel_demo.js — a typical preferences-style dialog.
 *
 * Demonstrates a richer multi-control layout: BevelStyle.GROUP boxes
 * group related controls visually, RadioButtons offer a single-pick
 * choice, CheckBoxes carry boolean toggles, StringGadgets accept text
 * input, and OK / Apply / Cancel buttons commit or discard the form.
 *
 * Layout:
 *
 *   ┌─ Identity ──────────────┐
 *   │ Name:     [________]    │
 *   │ Email:    [________]    │
 *   └─────────────────────────┘
 *   ┌─ Notifications ─────────┐
 *   │ ◉ All                   │
 *   │ ○ Mentions only         │
 *   │ ○ None                  │
 *   └─────────────────────────┘
 *   ┌─ Behaviour ─────────────┐
 *   │ ☐ Auto-save             │
 *   │ ☑ Confirm on quit       │
 *   │ ☐ Use dark mode         │
 *   └─────────────────────────┘
 *
 *   [ OK ] [ Apply ] [ Cancel ]
 *
 * On OK or Apply, prints all current values to stdout. Cancel exits
 * without committing.
 *
 * Requires quickjs.library 0.156+.
 * Run:  qjs examples/settings_panel_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, CheckBox, RadioButton, StringGadget,
        Label, EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = {
  NAME:    1,
  EMAIL:   2,
  NOTIFY:  3,
  AUTOSAVE: 10,
  CONFIRM:  11,
  DARKMODE: 12,
  OK:      100,
  APPLY:   101,
  CANCEL:  102,
};

let nameInput  = new StringGadget({ id: GID.NAME,  text: 'Brielle', maxChars: 64 });
let emailInput = new StringGadget({ id: GID.EMAIL, text: 'me@example.com', maxChars: 128 });

let identityGroup = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'Identity',
  children: [
    new Layout({
      orientation: 'horizontal', innerSpacing: 4,
      children: [ new Label({ text: 'Name:'  }), nameInput  ],
    }),
    new Layout({
      orientation: 'horizontal', innerSpacing: 4,
      children: [ new Label({ text: 'Email:' }), emailInput ],
    }),
  ],
});

let notify = new RadioButton({
  id: GID.NOTIFY,
  labels: ['_All', '_Mentions only', 'No_ne'],
  selected: 0,
});

let notifyGroup = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'Notifications',
  children: [ notify ],
});

let autoSave = new CheckBox({ id: GID.AUTOSAVE, text: '_Auto-save',     selected: false });
let confirm  = new CheckBox({ id: GID.CONFIRM,  text: '_Confirm on quit', selected: true });
let darkMode = new CheckBox({ id: GID.DARKMODE, text: '_Dark mode',     selected: false });

let behaviourGroup = new Layout({
  orientation: 'vertical',
  innerSpacing: 4,
  bevelStyle:  BevelStyle.GROUP,
  label:       'Behaviour',
  children: [ autoSave, confirm, darkMode ],
});

let okBtn     = new Button({ id: GID.OK,     text: '_OK' });
let applyBtn  = new Button({ id: GID.APPLY,  text: 'Appl_y' });
let cancelBtn = new Button({ id: GID.CANCEL, text: 'Cance_l' });

let buttonRow = new Layout({
  orientation: 'horizontal', innerSpacing: 6, evenSize: true,
  children: [ okBtn, applyBtn, cancelBtn ],
});

let win = new Window({
  title:       'Preferences',
  innerWidth:  340,
  innerHeight: 260,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [
      identityGroup,
      notifyGroup,
      behaviourGroup,
      buttonRow,
    ],
  }),
});

function readForm() {
  let labels = ['All', 'Mentions only', 'None'];
  return {
    name:     nameInput.get('text')   || '',
    email:    emailInput.get('text')  || '',
    notify:   labels[notify.get('selected') | 0] || '?',
    autoSave: !!autoSave.get('selected'),
    confirm:  !!confirm.get('selected'),
    darkMode: !!darkMode.get('selected'),
  };
}

function dumpForm(label) {
  let v = readForm();
  print('--- ' + label + ' ---');
  print('  name:     ' + v.name);
  print('  email:    ' + v.email);
  print('  notify:   ' + v.notify);
  print('  autosave: ' + v.autoSave);
  print('  confirm:  ' + v.confirm);
  print('  darkmode: ' + v.darkMode);
}

win.open();
print('Settings dialog open. Try the controls, then OK / Apply / Cancel.');

let done = false;
try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) { print('(closed via gadget)'); break; }
    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.OK:     dumpForm('OK (saving + closing)'); done = true; break;
        case GID.APPLY:  dumpForm('Apply (saving)');                     break;
        case GID.CANCEL: print('Cancelled.');               done = true; break;
      }
      if (done) break;
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
