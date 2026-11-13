/*
 * calculator_demo.js - a working four-function calculator.
 *
 *   +----------------------------+
 *   | 0                          |   display
 *   | [ 7 ]  [ 8 ]  [ 9 ]  [ / ] |
 *   | [ 4 ]  [ 5 ]  [ 6 ]  [ * ] |   keypad
 *   | [ 1 ]  [ 2 ]  [ 3 ]  [ - ] |
 *   | [ 0 ]  [ . ]  [ = ]  [ + ] |
 *   | [   Clear   ] [   Quit   ] |
 *   +----------------------------+
 *
 * Click the keys as you would on a pocket calculator: a number, an
 * operator, another number, then = (or another operator to carry on).
 * Dividing by zero shows "Error". Clear starts again.
 *
 * The file has three parts, read top to bottom:
 *
 *   1. THE CALCULATOR - what the keys do. Plain JavaScript, no GUI.
 *   2. THE PANEL      - the window, written as a tree that looks like it.
 *   3. THE LOOP       - clicks in, keys pressed, display redrawn.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 240 x 200 pixels inside
 *   - window.class, layout.gadget, button.gadget and string.gadget are
 *     installed in SYS:Classes, as they are on AmigaOS 3.2
 *   - the display is a read-only string gadget because that is the
 *     Reaction gadget whose text can be changed while the window is
 *     open; a Label keeps the text it was created with
 *   - every key is a button whose gadget ID is its position on the
 *     keypad, counting from 0 at the top left
 *
 * Requires quickjs.library 0.156+ (the first with button clicks working
 * end to end).
 * Run: qjs examples/calculator_demo.js
 */

const { Window, Layout, Button, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;


/* ==================================================================
 * 1. THE CALCULATOR
 *
 * Everything the keys do, and nothing about how they look. The panel
 * further down only ever calls press() and clear() and reads
 * `display`.
 * ================================================================== */

/** The keys, in the order they sit on the keypad: left to right, top
 *  to bottom. */
const KEYS = [
  '7', '8', '9', '/',
  '4', '5', '6', '*',
  '1', '2', '3', '-',
  '0', '.', '=', '+',
];

/** The keys that act on numbers rather than being part of one. */
const OPERATOR_KEYS = ['+', '-', '*', '/', '='];

/** What each arithmetic key works out from the number held and the
 *  number on the display. Dividing by zero gives NaN, shown as
 *  "Error". */
const ARITHMETIC = {
  '+': (held, shown) => held + shown,
  '-': (held, shown) => held - shown,
  '*': (held, shown) => held * shown,
  '/': (held, shown) => (shown === 0 ? NaN : held / shown),
};

/** The most characters the display holds. A result that needs more
 *  is shown in scientific notation; typing stops when it is full. */
const DISPLAY_CHARS = 16;

/** How many significant digits a result with a fraction is shown to. */
const RESULT_DIGITS = 12;

/**
 * Turn a result into the text for the display. The text always fits
 * the display: a number too long to write out is given in scientific
 * notation (1.2345e+21) with as many digits as there is room for,
 * never cut off.
 *
 * @param {number} value
 * @returns {string} at most DISPLAY_CHARS characters
 */
function formatNumber(value) {
  if (Number.isNaN(value))     return 'Error';
  if (!Number.isFinite(value)) return 'Inf';

  let text;

  if (Number.isInteger(value)) {
    text = String(value);
  }
  else {
    /* A fraction: fixed precision, then drop the zeros it ends with. */
    text = value.toPrecision(RESULT_DIGITS);
    if (text.indexOf('.') >= 0 && text.indexOf('e') < 0) {
      text = text.replace(/0+$/, '').replace(/\.$/, '');
    }
  }

  if (text.length <= DISPLAY_CHARS) return text;

  /* Too long. Scientific notation, dropping digits until it fits;
   * with no digits after the point ("1e+21") it always does. */
  for (let digits = RESULT_DIGITS - 1; digits >= 0; digits--) {
    text = value.toExponential(digits);
    if (text.length <= DISPLAY_CHARS) break;
  }

  return text;
}

class Calculator {
  /**
   * A calculator showing 0, with nothing pending.
   */
  constructor() {
    /** @type {string} what the display shows */
    this.display = '0';

    /** @type {?string} the arithmetic key waiting for its second
     *  number, or null */
    this.pending = null;

    /** @type {number} the first number, or the running result */
    this.held = 0;

    /** @type {number} the number the display stands for while it
     *  shows a result. The text may be rounded to fit; sums go on
     *  with this, not with the text. */
    this.shownValue = 0;

    /** @type {boolean} true when the next digit starts a new number
     *  rather than adding to the one on the display */
    this.startsNumber = true;
  }

  /**
   * Press one key of the keypad.
   *
   * @param {string} key - one of KEYS
   * @returns {undefined}
   */
  press(key) {
    if (OPERATOR_KEYS.includes(key)) this._operator(key);
    else                             this._digit(key);
  }

  /**
   * The Clear key: forget everything and show 0.
   *
   * @returns {undefined}
   */
  clear() {
    this.held = 0;
    this.shownValue = 0;
    this.pending = null;
    this.startsNumber = true;
    this._show('0');
  }

  /* ---- internals ---- */

  /**
   * A digit or the decimal point.
   *
   * @param {string} digit - '0' to '9', or '.'
   * @returns {undefined}
   */
  _digit(digit) {
    if (this.startsNumber) {
      this._show(digit === '.' ? '0.' : digit);
      this.startsNumber = false;
      return;
    }

    /* A number has only one decimal point. */
    if (digit === '.' && this.display.indexOf('.') >= 0) return;

    /* The display is full: the key does nothing. */
    if (this.display.length >= DISPLAY_CHARS) return;

    this._show(this.display + digit);
  }

  /**
   * An arithmetic key or =. Finishes whatever sum was waiting, shows
   * the result, and (unless the key is =) waits for the next number.
   *
   * @param {string} operator - one of OPERATOR_KEYS
   * @returns {undefined}
   */
  _operator(operator) {
    /* While the display shows a result (nothing typed since), the
     * second number is that result itself, not its text: the text of
     * a long result is rounded, and reading it back would change the
     * number. (It used to be cut off at 16 characters, and the cut
     * text became the next operand.) */
    let shown  = this.startsNumber ? this.shownValue
                                   : parseFloat(this.display);
    let result = this.pending ? ARITHMETIC[this.pending](this.held, shown)
                              : shown;

    this.held = result;
    this.shownValue = result;
    this.pending = (operator === '=' ? null : operator);
    this.startsNumber = true;
    this._show(formatNumber(result));
  }

  /**
   * Put text on the display. Callers pass text that fits: a typed
   * number stops growing when the display is full, and formatNumber()
   * never returns more than DISPLAY_CHARS characters.
   *
   * @param {string} text
   * @returns {undefined}
   */
  _show(text) {
    this.display = text;
  }
}


/* ==================================================================
 * 2. THE PANEL
 *
 * First the one gadget the loop needs to talk to, then the window,
 * which arranges it above the keys. Read the `layout:` tree next to
 * the picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. The keypad
 *  buttons use 0 to 15, their index in KEYS, so these stay clear of
 *  that range. */
const ID = { CLEAR: 100, QUIT: 101, DISPLAY: 999 };

/** How many keys there are in one row of the keypad. */
const KEYS_PER_ROW = 4;

/**
 * One row of the keypad: equally wide buttons, side by side.
 *
 * @param {number} rowIndex - 0 for the top row
 * @returns {Layout}
 */
function keyRow(rowIndex) {
  let firstKey = rowIndex * KEYS_PER_ROW;
  let labels   = KEYS.slice(firstKey, firstKey + KEYS_PER_ROW);

  return new Layout({
    orientation:  'horizontal',
    innerSpacing: 2,
    evenSize:     true,
    children: labels.map((label, column) =>
      new Button({ id: firstKey + column, text: label })
    ),
  });
}

/* A read-only string gadget, not a Label: its text can be changed
 * while the window is open. */
let display = new StringGadget({
  id:       ID.DISPLAY,
  text:     '0',
  maxChars: 32,
  readOnly: true,
});

let window = new Window({
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

      new Layout({
        orientation:  'vertical',
        innerSpacing: 2,
        evenSize:     true,
        children: [ keyRow(0), keyRow(1), keyRow(2), keyRow(3) ],
      }),

      new Layout({
        orientation:  'horizontal',
        innerSpacing: 4,
        evenSize:     true,
        children: [
          new Button({ id: ID.CLEAR, text: '_Clear' }),
          new Button({ id: ID.QUIT,  text: '_Quit'  }),
        ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Wait for a click, tell the calculator, then make the display show
 * whatever the calculator now says.
 * ================================================================== */

let calculator = new Calculator();

/** What each button does, keyed by gadget ID: Clear, then one entry
 *  for every key of the keypad. */
const onClick = {
  [ID.CLEAR]: () => calculator.clear(),
};

KEYS.forEach((key, id) => {
  onClick[id] = () => calculator.press(key);
});

/** The text the display gadget currently holds, so that render() only
 *  touches the gadget when the text has really changed. */
let shownText = '0';

/**
 * Make the display match the calculator.
 *
 * @returns {undefined}
 */
function render() {
  if (shownText === calculator.display) return;

  display.text = calculator.display;
  shownText = calculator.display;
}

window.open();
print('Calculator open. Click Quit (or close gadget) when done.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK) {
      if (event.sourceId === ID.QUIT) break;
      if (onClick[event.sourceId]) onClick[event.sourceId]();
    }

    render();
  }
}
finally {
  window.dispose();
}

print('Bye.');
