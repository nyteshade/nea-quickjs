/*
 * color_mixer_demo.js - mix a colour with three sliders, shown as hex.
 *
 *   +------------------------------------------------+
 *   | Drag the sliders. Hex value updates live.      |
 *   | R:  ==================|===============    128  |
 *   | G:  ==================|===============    128  |   LED digits
 *   | B:  ==================|===============    128  |
 *   | #808080                                        |   hex code
 *   | [                    Quit                    ] |
 *   +------------------------------------------------+
 *
 * Drag any slider: the LED digits beside it follow the knob, and the
 * line underneath shows the three levels as one #RRGGBB code. No
 * colour is actually displayed; the demo is about several gadgets
 * staying in step.
 *
 * The file has three parts, read top to bottom:
 *
 *   1. THE COLOUR - three levels and how to write them. No GUI.
 *   2. THE PANEL  - the window, written as a tree that looks like it.
 *   3. THE LOOP   - slider moves in, colour updated, panel redrawn.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 340 x 180 pixels inside
 *   - window.class, layout.gadget, button.gadget, slider.gadget,
 *     string.gadget, label.image and led.image are installed in
 *     SYS:Classes, as they are on AmigaOS 3.2
 *   - quickjs.library 0.157+ puts the slider's new level on the event;
 *     on 0.156 the script asks the slider instead
 *   - the hex code is a read-only string gadget because a Label keeps
 *     the text it was created with
 *
 * Requires quickjs.library 0.232+ (Led took only a pointer before,
 * and did not repaint).
 * Run: qjs examples/color_mixer_demo.js
 */

const { Window, Layout, Button, Slider, Led, Label, StringGadget,
        EventKind, WindowPosition } = amiga.boopsi;


/* ==================================================================
 * 1. THE COLOUR
 *
 * Three levels, and the two ways the panel writes them down. Nothing
 * here knows about gadgets.
 * ================================================================== */

/** The highest level a channel can have; the lowest is 0. */
const LEVEL_MAX = 255;

/** Where every channel starts: mid grey. */
const START_LEVEL = 128;

/** The colour being mixed. Each level is 0 to LEVEL_MAX. */
const colour = {
  red:   START_LEVEL,
  green: START_LEVEL,
  blue:  START_LEVEL,
};

/**
 * One level as two upper-case hex digits.
 *
 * @param {number} level - 0 to 255
 * @returns {string}
 */
function hexPair(level) {
  let digits = (level & 0xFF).toString(16).toUpperCase();
  return digits.length < 2 ? '0' + digits : digits;
}

/**
 * The whole colour as a #RRGGBB code.
 *
 * @param {{red: number, green: number, blue: number}} mix
 * @returns {string}
 */
function hexCode(mix) {
  return '#' + hexPair(mix.red) + hexPair(mix.green) + hexPair(mix.blue);
}


/* ==================================================================
 * 2. THE PANEL
 *
 * Each channel is a slider with an LED display beside it. The window
 * stacks three of them over the hex code. Read the `layout:` tree next
 * to the picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { RED: 1, GREEN: 2, BLUE: 3, QUIT: 99, HEX: 200 };

/** An LED display shows digits in pairs, and is given one number, 0
 *  to 99, for each. Two pairs is four digits; a level never needs more
 *  than three, so the first digit is always 0. Led.pairsOf(128, 2) is
 *  [1, 28], shown as 01 28. */
const LED_PAIRS = 2;

/**
 * Build the gadgets for one channel of the colour.
 *
 * @param {number} id - gadget ID for the slider, one of ID
 * @param {string} name - which level it controls: a key of `colour`
 * @returns {{name: string, slider: Slider, led: Led,
 *            shownLevel: number}} `shownLevel` is the level the LED
 *   currently displays
 */
function channel(id, name) {
  return {
    name,
    shownLevel: colour[name],

    led: new Led({ values: Led.pairsOf(colour[name], LED_PAIRS) }),

    slider: new Slider({
      id, min: 0, max: LEVEL_MAX, level: colour[name],
      orientation: 'horizontal', ticks: 5,
    }),
  };
}

/**
 * One line of the window: a caption, a slider and its LED display.
 *
 * @param {string} caption
 * @param {{slider: Slider, led: Led}} oneChannel
 * @returns {Layout}
 */
function channelRow(caption, oneChannel) {
  return new Layout({
    orientation: 'horizontal', innerSpacing: 4,
    children: [
      new Label({ text: caption }),
      oneChannel.slider,
      oneChannel.led,
    ],
  });
}

let red   = channel(ID.RED,   'red');
let green = channel(ID.GREEN, 'green');
let blue  = channel(ID.BLUE,  'blue');

/* A read-only string gadget, not a Label: its text can be changed
 * while the window is open. */
let hexLine = new StringGadget({
  id: ID.HEX, readOnly: true, maxChars: 12, text: hexCode(colour),
});

let window = new Window({
  title:       'RGB Color Mixer',
  innerWidth:  340,
  innerHeight: 180,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,

  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [

      new Label({ text: 'Drag the sliders. Hex value updates live.' }),

      channelRow('R:', red),
      channelRow('G:', green),
      channelRow('B:', blue),

      hexLine,

      new Button({ id: ID.QUIT, text: '_Quit' }),

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Wait for a slider to move, record its level in the colour, then make
 * the panel show whatever the colour now says.
 * ================================================================== */

/** What each slider does with its new level. */
const onSlide = {
  [ID.RED]:   (level) => { colour.red   = level; },
  [ID.GREEN]: (level) => { colour.green = level; },
  [ID.BLUE]:  (level) => { colour.blue  = level; },
};

/** The hex code the string gadget currently holds. */
let shownHex = hexCode(colour);

/**
 * Make the panel match the colour. Only an LED display whose level has
 * changed is rewritten, so dragging one slider leaves the other two
 * alone.
 *
 * @returns {undefined}
 */
function render() {
  for (let oneChannel of [red, green, blue]) {
    let level = colour[oneChannel.name];
    if (level === oneChannel.shownLevel) continue;

    oneChannel.led.setValues(Led.pairsOf(level, LED_PAIRS));
    oneChannel.shownLevel = level;
  }

  let hex = hexCode(colour);
  if (hex !== shownHex) {
    hexLine.text = hex;
    shownHex = hex;
  }
}

window.open();
print('RGB mixer open. Drag sliders, watch the hex display. Quit closes.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;

    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    if (event.kind === EventKind.SLIDER_CHANGE && event.source) {
      /* The level is on the event from quickjs.library 0.157; before
       * that the slider has to be asked. */
      let level = (typeof event.attrs.level === 'number')
                    ? event.attrs.level : event.source.get('level');

      if (typeof level === 'number' && onSlide[event.sourceId]) {
        onSlide[event.sourceId](level);
      }
    }

    render();
  }
}
finally {
  /* The LED displays go with the window, and their values with them. */
  window.dispose();
}

print('Bye.');
