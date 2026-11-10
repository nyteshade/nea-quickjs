/*
 * tapedeck_demo.js - both forms of tapedeck.gadget, one above the other.
 *
 *   Top:    tape controls (TDECK_Tape TRUE) - rewind, play,
 *           fast-forward, stop and pause as separate buttons.
 *   Bottom: animation controls (TDECK_Tape FALSE) - rewind, play,
 *           fast-forward and a frame slider.
 *
 * What the gadget does and does not do:
 *   - It is only a control. It never moves its own slider; the
 *     application advances TDECK_CurrentFrame. This demo does that from
 *     IDCMP_INTUITICKS (about ten a second while the window is active).
 *   - It draws its own buttons. The animation form has no stop or pause
 *     glyph - Play is a toggle - so a separate stop/pause button needs
 *     the tape form.
 *   - Rewind and fast-forward are momentary. The release event reports
 *     the mode the gadget fell back to, so the demo also polls
 *     TDECK_Mode on every tick and prints each change, which is how a
 *     held Rewind/Forward shows up.
 *
 * Requires quickjs.library 0.207+ (tapedeck is created by class name).
 * Run: qjs examples/tapedeck_demo.js
 */

const { Window, Layout, Button, TapeDeck, Label, EventKind, IDCMP,
        WindowPosition, TapeDeckMode } = amiga.boopsi;

const GID = { TAPE: 1, ANIM: 2, QUIT: 3 };
const FRAMES = 100;
const SEEK_STEP = 4;

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

let tape = new TapeDeck({ id: GID.TAPE, tape: true });
let anim = new TapeDeck({ id: GID.ANIM, tape: false,
                          frames: FRAMES, currentFrame: 0 });
let quit = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Reaction TapeDeck', innerWidth: 300, innerHeight: 130,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.IDCMPUPDATE |
         IDCMP.INTUITICKS,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      new Label({ text: 'Tape controls:' }), tape,
      new Label({ text: 'Animation controls:' }), anim,
      quit,
    ],
  }),
});

win.open();

/* Put both gadgets into a known state now that they are on screen, so
 * what is drawn and what TDECK_Mode reports agree from the start. */
tape.set({ mode: TapeDeckMode.STOP });
anim.set({ mode: TapeDeckMode.STOP });

let tapeMode = tape.get('mode');
let animMode = anim.get('mode');
let frame = 0;

print('Tape deck starts in      ' + modeName(tapeMode));
print('Animation deck starts in ' + modeName(animMode));

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK && e.sourceId === GID.QUIT) break;

    if (e.kind === EventKind.TAPEDECK_CLICK) {
      let which = (e.sourceId === GID.TAPE) ? 'tape' : 'anim';
      if (e.sourceId === GID.ANIM) frame = anim.get('currentFrame');
      print(which + ' click: code = ' + e.raw.code +
            (e.sourceId === GID.ANIM ? ', frame = ' + frame : ''));
    }

    /* Poll on every event, clicks and ticks alike. */
    let m = tape.get('mode');
    if (m !== tapeMode) {
      tapeMode = m;
      print('tape mode -> ' + modeName(m));
    }

    m = anim.get('mode');
    if (m !== animMode) {
      animMode = m;
      print('anim mode -> ' + modeName(m));
    }

    if (e.kind === EventKind.INTUITICKS) {
      let next = frame;
      if (animMode === TapeDeckMode.PLAY)         next = (frame + 1) % FRAMES;
      else if (animMode === TapeDeckMode.FORWARD) next = Math.min(FRAMES - 1, frame + SEEK_STEP);
      else if (animMode === TapeDeckMode.REWIND)  next = Math.max(0, frame - SEEK_STEP);

      if (next !== frame) {
        frame = next;
        anim.set({ currentFrame: frame });
      }
    }
  }
}
finally { win.dispose(); }
print('Bye.');
