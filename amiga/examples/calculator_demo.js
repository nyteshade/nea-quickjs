/*
 * calculator_demo.js — a working four-function calculator.
 *
 * Demonstrates a non-trivial Reaction UI built from existing wrappers:
 *   - StringGadget for the display (read-only)
 *   - 4x4 grid of buttons via nested HLayouts inside a VLayout
 *   - Event-loop state machine implementing standard calculator
 *     semantics (operand entry, operator, equals)
 *
 * Layout:
 *
 *   [    display    ]
 *   [ 7 ][ 8 ][ 9 ][ ÷ ]
 *   [ 4 ][ 5 ][ 6 ][ × ]
 *   [ 1 ][ 2 ][ 3 ][ - ]
 *   [ 0 ][ . ][ = ][ + ]
 *   [ Clear ][ Quit ]
 *
 * Requires quickjs.library 0.156+ (BUTTON_CLICK end-to-end).
 * Run:  qjs examples/calculator_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, Label, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;

/* Button IDs — we don't care about the exact numbers, just that
 * each button has its own. Using GID.0..15 for the keypad and 100/101
 * for clear/quit so the keypad index matches its label position. */
const KEYS = [
  '7', '8', '9', '/',
  '4', '5', '6', '*',
  '1', '2', '3', '-',
  '0', '.', '=', '+',
];
const CLEAR_ID = 100;
const QUIT_ID  = 101;

/* Calculator state. */
let state = {
  display:   '0',
  pending:   null,   /* operator waiting for second operand */
  accum:     0,      /* left-hand operand */
  freshNum:  true,   /* next digit replaces display */
};

function setDisplay(s) {
  /* Trim long results so they fit. */
  if (s.length > 16) s = s.substring(0, 16);
  state.display = s;
  display.text = s;
}

function inputDigit(d) {
  if (state.freshNum) {
    setDisplay(d === '.' ? '0.' : d);
    state.freshNum = false;
  } else {
    if (d === '.' && state.display.indexOf('.') >= 0) return;
    setDisplay(state.display + d);
  }
}

function applyPending(rhs) {
  if (!state.pending) return rhs;
  switch (state.pending) {
    case '+': return state.accum + rhs;
    case '-': return state.accum - rhs;
    case '*': return state.accum * rhs;
    case '/': return rhs === 0 ? NaN : state.accum / rhs;
  }
  return rhs;
}

function inputOperator(op) {
  let rhs = parseFloat(state.display);
  let result = applyPending(rhs);
  state.accum   = result;
  state.pending = (op === '=' ? null : op);
  state.freshNum = true;
  setDisplay(formatNumber(result));
}

function formatNumber(n) {
  if (Number.isNaN(n))    return 'Error';
  if (!Number.isFinite(n)) return 'Inf';
  if (Number.isInteger(n)) return String(n);
  /* Trim trailing zeros from the float repr. */
  let s = n.toPrecision(12);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

function clearAll() {
  state.accum    = 0;
  state.pending  = null;
  state.freshNum = true;
  setDisplay('0');
}

/* ---- Build UI ---- */

let display = new StringGadget({
  id:      999,
  text:    '0',
  maxChars: 32,
  readOnly: true,
});

function row(labels, startId) {
  return new Layout({
    orientation: 'horizontal',
    innerSpacing: 2,
    evenSize: true,
    children: labels.map((label, i) =>
      new Button({ id: startId + i, text: label })
    ),
  });
}

let keypad = new Layout({
  orientation:  'vertical',
  innerSpacing: 2,
  evenSize:     true,
  children: [
    row(KEYS.slice(0, 4),   0),
    row(KEYS.slice(4, 8),   4),
    row(KEYS.slice(8, 12),  8),
    row(KEYS.slice(12, 16), 12),
  ],
});

let bottomRow = new Layout({
  orientation:  'horizontal',
  innerSpacing: 4,
  evenSize:     true,
  children: [
    new Button({ id: CLEAR_ID, text: '_Clear' }),
    new Button({ id: QUIT_ID,  text: '_Quit'  }),
  ],
});

let win = new Window({
  title:       'Calculator',
  innerWidth:  240,
  innerHeight: 200,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,
  layout: new Layout({
    orientation:  'vertical',
    innerSpacing: 4,
    children: [
      display,
      keypad,
      bottomRow,
    ],
  }),
});

win.open();
print('Calculator open. Click Quit (or close gadget) when done.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      let id = e.sourceId;
      if (id === QUIT_ID)  break;
      if (id === CLEAR_ID) { clearAll(); continue; }
      if (id >= 0 && id < KEYS.length) {
        let key = KEYS[id];
        if (key === '+' || key === '-' || key === '*' ||
            key === '/' || key === '=') {
          inputOperator(key);
        } else {
          inputDigit(key);
        }
      }
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
