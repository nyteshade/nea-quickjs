/*
 * tapedeck_demo.js - tapedeck.gadget in its animation-control form:
 * rewind, play, fast-forward and a frame slider.
 *
 * The gadget is only a control. It does not move its own slider while
 * "playing"; the application advances TDECK_CurrentFrame. This demo
 * does that from IDCMP_INTUITICKS (about ten a second while the window
 * is active), so pressing Play makes the slider travel.
 *
 * Rewind and fast-forward are momentary: the gadget falls back to its
 * previous mode when the button is released, so the release event
 * reports that mode (usually STOP), not REWIND/FORWARD.
 *
 * Requires quickjs.library 0.207+ (tapedeck is created by class name).
 * Run: qjs examples/tapedeck_demo.js
 */

const { Window, Layout, Button, TapeDeck, Label, EventKind, IDCMP,
        WindowPosition, TapeDeckMode } = amiga.boopsi;

const GID = { DECK: 1, QUIT: 2 };
const FRAMES = 100;

/* Indexed by TapeDeckMode (NDK BUT_* values, gadgets/tapedeck.h). */
const modeNames = ['REWIND', 'PLAY', 'FORWARD', 'STOP', 'PAUSE',
                   'BEGIN', 'FRAME', 'END'];

/**
 * Name a TDECK_Mode value.
 *
 * @param {number} mode - one of TapeDeckMode
 * @returns {string}
 */
function modeName(mode) {
  return (modeNames[mode] || '?') + ' (' + mode + ')';
}

let deck = new TapeDeck({ id: GID.DECK, frames: FRAMES, currentFrame: 0 });
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction TapeDeck', innerWidth: 300, innerHeight: 90,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE |
         IDCMP.INTUITICKS,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [ new Label({ text: 'Transport controls:' }), deck, quit ],
  }),
});

win.open();
print('TapeDeck open. Mode at start: ' + modeName(deck.get('mode')));

let playing = (deck.get('mode') === TapeDeckMode.PLAY);
let frame = 0;

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;

    if (e.kind === EventKind.TAPEDECK_CLICK) {
      let mode = deck.get('mode');
      frame = deck.get('currentFrame');
      playing = (mode === TapeDeckMode.PLAY);
      print('event code = ' + e.raw.code + ', mode = ' + modeName(mode) +
            ', frame = ' + frame);
    }

    else if (e.kind === EventKind.INTUITICKS && playing) {
      frame = (frame + 1) % FRAMES;
      deck.set({ currentFrame: frame });
    }
  }
}
finally { win.dispose(); }
print('Bye.');
