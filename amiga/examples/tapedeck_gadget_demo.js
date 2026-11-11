/*
 * tapedeck_gadget_demo.js - both forms of the system's tape deck gadget.
 *
 *   +--------------------------------+
 *   | Tape controls:                 |
 *   | [<<] [> ] [>>] [[]] [||]       |   tape form
 *   | Animation controls:            |
 *   | [<<] [> ] [>>] ====|=========  |   animation form, frame slider
 *   | [            Quit            ] |
 *   +--------------------------------+
 *
 * Press the buttons of either gadget. Every click, and every change of
 * either gadget's mode, is printed on the Shell. While the animation
 * form is playing or winding, its frame slider moves.
 *
 * The file has three parts:
 *
 *   1. THE FRAME COUNTER - where the slider goes next. No GUI.
 *   2. THE WINDOW        - the two gadgets, one above the other.
 *   3. THE LOOP          - print what the gadgets do, move the slider.
 *
 * What the gadget does and does not do:
 *
 *   - It is only a control. It never moves its own slider; the program
 *     advances the current frame. This demo does that on every tick.
 *   - It draws its own buttons. The animation form has no stop or
 *     pause glyph, and Play is a toggle there, so separate stop and
 *     pause buttons need the tape form.
 *   - Rewind and fast-forward are momentary. The release event reports
 *     the mode the gadget fell back to, so the demo also reads the
 *     mode of both gadgets on every event and prints each change. That
 *     is how a held Rewind or Forward shows up.
 *
 * This exercises the system gadget as it is. For a player-style
 * transport built from ordinary gadgets, see tapedeck_demo.js.
 *
 * Assumptions:
 *   - the window opens on the default public screen (normally
 *     Workbench), which has room for a 300 x 130 window interior
 *   - tapedeck.gadget is in SYS:Classes/Gadgets (it has been part of
 *     the system since AmigaOS 3.0); label.image, button.gadget,
 *     layout.gadget and window.class are in SYS:Classes, as AmigaOS
 *     3.2 installs them
 *   - the clock is Intuition's tick: about ten a second, and only
 *     while this window is the active one. Click elsewhere and the
 *     slider stops
 *   - everything under "What the gadget does" above was observed on a
 *     real Amiga, not taken from documentation
 *   - setting both gadgets to STOP once the window is open is enough
 *     to make what they draw and the mode they report agree
 *
 * Requires quickjs.library 0.207+ (tapedeck is created by class name).
 * Run: qjs examples/tapedeck_gadget_demo.js
 */

const { Window, Layout, Button, TapeDeck, Label, EventKind, IDCMP,
        WindowPosition, TapeDeckMode } = amiga.boopsi;


/* ==================================================================
 * 1. THE FRAME COUNTER
 *
 * The animation form has a slider but will not move it. These few
 * lines decide where it should be after one tick of the clock.
 * ================================================================== */

/** Length of the pretend animation, in frames. */
const FRAMES = 100;

/** How many frames one tick of rewind or fast-forward covers. */
const SEEK_STEP = 4;

/** Names for the display, indexed by TapeDeckMode (the NDK's BUT_*
 *  values, gadgets/tapedeck.h). */
const MODE_NAMES = ['REWIND', 'PLAY', 'FORWARD', 'STOP', 'PAUSE',
                    'BEGIN', 'FRAME', 'END'];

/**
 * Name a mode, with its number.
 *
 * @param {number} mode - one of TapeDeckMode
 * @returns {string} for example "PLAY (1)"
 */
function modeName(mode) {
  return (MODE_NAMES[mode] || '?') + ' (' + mode + ')';
}

/**
 * The frame the slider should show one tick from now. Playing wraps
 * round at the end; winding stops at either end.
 *
 * @param {number} mode - one of TapeDeckMode
 * @param {number} frame - the current frame, 0 to FRAMES - 1
 * @returns {number} the next frame; the same one if nothing is moving
 */
function frameAfterTick(mode, frame) {
  let lastFrame = FRAMES - 1;

  if (mode === TapeDeckMode.PLAY)    return (frame + 1) % FRAMES;
  if (mode === TapeDeckMode.FORWARD) return Math.min(lastFrame,
                                                     frame + SEEK_STEP);
  if (mode === TapeDeckMode.REWIND)  return Math.max(0, frame - SEEK_STEP);

  return frame;
}


/* ==================================================================
 * 2. THE WINDOW
 *
 * One class, two looks: `tape: true` gives the five tape buttons,
 * `tape: false` gives three buttons and a frame slider.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = { TAPE: 1, ANIMATION: 2, QUIT: 3 };

let tapeDeck = new TapeDeck({ id: ID.TAPE, tape: true });

let animationDeck = new TapeDeck({
  id:           ID.ANIMATION,
  tape:         false,
  frames:       FRAMES,
  currentFrame: 0,
});

let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

let window = new Window({
  title:       'Reaction TapeDeck',
  innerWidth:  300,
  innerHeight: 130,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,

  /* The ticks are the demo's clock: about ten a second while the
   * window is active. */
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE |
         IDCMP.INTUITICKS,

  layout: new Layout({
    orientation:  'vertical',
    innerSpacing: 4,
    children: [

      new Label({ text: 'Tape controls:' }),
      tapeDeck,

      new Label({ text: 'Animation controls:' }),
      animationDeck,

      quitButton,

    ],
  }),
});


/* ==================================================================
 * 3. THE LOOP
 *
 * Report clicks, report mode changes, and on each tick move the
 * animation slider to wherever the frame counter says.
 * ================================================================== */

/**
 * Read a gadget's mode and print it if it is not the one last seen.
 *
 * @param {string} label - what to call the gadget in the output
 * @param {TapeDeck} deck
 * @param {number} lastMode - the mode seen the time before
 * @returns {number} the mode the gadget is in now
 */
function watchMode(label, deck, lastMode) {
  let mode = deck.get('mode');

  if (mode !== lastMode) print(label + ' mode -> ' + modeName(mode));
  return mode;
}

window.open();

/* Put both gadgets into a known state now that they are on screen, so
 * what is drawn and what the mode attribute reports agree from the
 * start. */
tapeDeck.set({ mode: TapeDeckMode.STOP });
animationDeck.set({ mode: TapeDeckMode.STOP });

let tapeMode      = tapeDeck.get('mode');
let animationMode = animationDeck.get('mode');

/** The frame the animation slider is on. */
let frame = 0;

print('Tape deck starts in      ' + modeName(tapeMode));
print('Animation deck starts in ' + modeName(animationMode));
print('Press the transport buttons; Quit to exit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind === EventKind.BUTTON_CLICK &&
        event.sourceId === ID.QUIT) break;

    if (event.kind === EventKind.TAPEDECK_CLICK) {
      let fromAnimation = event.sourceId === ID.ANIMATION;
      let which         = (event.sourceId === ID.TAPE) ? 'tape' : 'anim';

      /* The user may have dragged the slider: take its word for where
       * the frame is. */
      if (fromAnimation) frame = animationDeck.get('currentFrame');

      print(which + ' click: code = ' + event.raw.code +
            (fromAnimation ? ', frame = ' + frame : ''));
    }

    /* Deliberately on every event, clicks and ticks alike: a held
     * Rewind or Forward is only visible as a mode that changes between
     * events, never as an event of its own. */
    tapeMode      = watchMode('tape', tapeDeck,      tapeMode);
    animationMode = watchMode('anim', animationDeck, animationMode);

    if (event.kind === EventKind.INTUITICKS) {
      let next = frameAfterTick(animationMode, frame);

      /* Only touch the gadget when the frame really moves, so an idle
       * tick costs no redraw. */
      if (next !== frame) {
        frame = next;
        animationDeck.set({ currentFrame: frame });
      }
    }
  }
}
finally {
  window.dispose();
}

print('Bye.');
