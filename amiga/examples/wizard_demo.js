/*
 * wizard_demo.js — multi-step setup wizard with Back / Next / Finish
 * navigation across three Page panels.
 *
 * Each step is its own Layout grouped in a Page. Navigation buttons
 * mutate PAGE_Current and adjust their own GA_Disabled state to
 * reflect the step bounds. A status label tracks "Step N of 3".
 *
 * Demonstrates the cleaner Page({ children: [...] }) pattern that
 * 0.157 enabled, plus stateful Back/Next buttons.
 *
 * Requires quickjs.library 0.157+.
 * Run:  qjs examples/wizard_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Page, Label, CheckBox, RadioButton,
        StringGadget, EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { BACK: 1, NEXT: 2, FINISH: 3, CANCEL: 4 };

let nameField = new StringGadget({ id: 100, text: '', maxChars: 64 });
let emailField = new StringGadget({ id: 101, text: '', maxChars: 128 });

let step1 = new Layout({
  orientation: 'vertical', innerSpacing: 6,
  bevelStyle:  BevelStyle.GROUP,
  label:       'Step 1: Welcome',
  children: [
    new Label({ text: 'Welcome to the setup wizard.' }),
    new Label({ text: 'This will walk you through three steps.' }),
    new Label({ text: 'Click Next to begin.' }),
  ],
});

let step2 = new Layout({
  orientation: 'vertical', innerSpacing: 6,
  bevelStyle:  BevelStyle.GROUP,
  label:       'Step 2: Identity',
  children: [
    new Label({ text: 'Tell us about yourself.' }),
    new Layout({
      orientation: 'horizontal', innerSpacing: 4,
      children: [ new Label({ text: 'Name: '  }), nameField  ],
    }),
    new Layout({
      orientation: 'horizontal', innerSpacing: 4,
      children: [ new Label({ text: 'Email:' }), emailField ],
    }),
  ],
});

let prefRadio = new RadioButton({
  id: 200, labels: ['_Daily updates', '_Weekly summary', 'Don\'t e_mail me'],
  selected: 1,
});

let step3 = new Layout({
  orientation: 'vertical', innerSpacing: 6,
  bevelStyle:  BevelStyle.GROUP,
  label:       'Step 3: Preferences',
  children: [
    new Label({ text: 'How often would you like updates?' }),
    prefRadio,
  ],
});

let pages = new Page({ current: 0, children: [step1, step2, step3] });

let backBtn   = new Button({ id: GID.BACK,   text: '< _Back',  disabled: true });
let nextBtn   = new Button({ id: GID.NEXT,   text: '_Next >' });
let finishBtn = new Button({ id: GID.FINISH, text: '_Finish',  disabled: true });
let cancelBtn = new Button({ id: GID.CANCEL, text: '_Cancel' });

let statusLabel = new Label({ text: 'Step 1 of 3' });

let buttonRow = new Layout({
  orientation: 'horizontal', innerSpacing: 4, evenSize: true,
  children: [ backBtn, nextBtn, finishBtn, cancelBtn ],
});

let win = new Window({
  title:       'Setup Wizard',
  innerWidth:  420,
  innerHeight: 300,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [ pages, statusLabel, buttonRow ],
  }),
});

const TOTAL = 3;
let step = 0;

function refresh() {
  pages.set({ current: step });
  statusLabel.text = 'Step ' + (step + 1) + ' of ' + TOTAL;
  backBtn.set({   disabled: step === 0 });
  nextBtn.set({   disabled: step === TOTAL - 1 });
  finishBtn.set({ disabled: step !== TOTAL - 1 });
}

function summarize() {
  let labels = ['Daily updates', 'Weekly summary', 'No email'];
  print('--- Wizard finished ---');
  print('  name:     ' + (nameField.get('text') || '(empty)'));
  print('  email:    ' + (emailField.get('text') || '(empty)'));
  print('  emailFreq: ' + (labels[prefRadio.get('selected') | 0] || '?'));
}

win.open();
print('Wizard open. Use Back / Next to navigate, Finish on the last step.');

let done = false;
try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.BACK:
          if (step > 0) { step--; refresh(); }
          break;
        case GID.NEXT:
          if (step < TOTAL - 1) { step++; refresh(); }
          break;
        case GID.FINISH:
          summarize();
          done = true;
          break;
        case GID.CANCEL:
          print('Wizard cancelled.');
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
