/*
 * transport_demo.js - a media transport built from ordinary Reaction
 * buttons and a slider, instead of tapedeck.gadget.
 *
 * tapedeck.gadget draws its own fixed set of buttons and cannot swap a
 * glyph by state. Building the bar from Button gadgets lets the middle
 * button change with what it will do next:
 *
 *   stopped:  [ << ] [ >  ] [ [] ] [ >> ]     Stop is ghosted
 *   playing:  [ << ] [ || ] [ [] ] [ >> ]     middle button now pauses
 *   paused:   [ << ] [ >  ] [ [] ] [ >> ]     Stop still live
 *
 * The slider is the scrubber. It follows playback, and dragging it
 * moves the position while the drag is in progress.
 *
 * Playback is driven by IDCMP_INTUITICKS (about ten a second while the
 * window is active). All labels are plain ASCII.
 *
 * Requires quickjs.library 0.209+.
 * Run: qjs examples/transport_demo.js
 */

const { Window, Layout, Button, Slider, StringGadget, EventKind, IDCMP,
        WindowPosition, BevelStyle, IDCMP_REACTION_DEFAULT } = amiga.boopsi;

const GID = { REW: 1, PLAY: 2, STOP: 3, FWD: 4, SCRUB: 5, QUIT: 6 };

const FRAMES    = 200;   /* length of the pretend clip, in ticks */
const SEEK_STEP = 10;    /* frames moved by one << or >> click   */

const LABEL_PLAY  = '>';
const LABEL_PAUSE = '||';

/** @enum {string} */
const State = { STOPPED: 'stopped', PLAYING: 'playing', PAUSED: 'paused' };

let state = State.STOPPED;
let frame = 0;

let rewBtn  = new Button({ id: GID.REW,  text: '<<' });
let playBtn = new Button({ id: GID.PLAY, text: LABEL_PLAY });
let stopBtn = new Button({ id: GID.STOP, text: '[]', disabled: true });
let fwdBtn  = new Button({ id: GID.FWD,  text: '>>' });
let quitBtn = new Button({ id: GID.QUIT, text: '_Quit' });

let scrub = new Slider({ id: GID.SCRUB, min: 0, max: FRAMES - 1, level: 0 });

let status = new StringGadget({
  text: 'stopped at 0', readOnly: true, maxChars: 48,
});

let win = new Window({
  title: 'Transport', innerWidth: 320, innerHeight: 110,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP_REACTION_DEFAULT | IDCMP.INTUITICKS,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [ rewBtn, playBtn, stopBtn, fwdBtn ],
      }),
      scrub,
      new Layout({
        orientation: 'horizontal', bevelStyle: BevelStyle.FIELD,
        children: [ status ],
      }),
      quitBtn,
    ],
  }),
});

/**
 * Show the current state and position in the status line.
 *
 * @returns {undefined}
 */
function showStatus() {
  status.text = state + ' at ' + frame;
}

/**
 * Switch state and update the buttons that depend on it.
 *
 * @param {string} next - one of State
 * @returns {undefined}
 */
function setState(next) {
  if (next === state) return;
  state = next;
  playBtn.text = (state === State.PLAYING) ? LABEL_PAUSE : LABEL_PLAY;
  stopBtn.set({ disabled: state === State.STOPPED });
  print('transport: ' + state);
  showStatus();
}

/**
 * Move to a frame, clamped to the clip, and update slider and status.
 *
 * @param {number} f - target frame
 * @param {boolean} moveSlider - false when the slider itself is the source
 * @returns {undefined}
 */
function seek(f, moveSlider) {
  f = Math.max(0, Math.min(FRAMES - 1, f | 0));
  if (f === frame) return;
  frame = f;
  if (moveSlider) scrub.set({ level: frame });
  showStatus();
}

win.open();
print('Transport open. Play, then try pause, stop, << and >>, and drag the slider.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;

    if (e.kind === EventKind.BUTTON_CLICK) {
      if (e.sourceId === GID.QUIT) break;

      switch (e.sourceId) {
        case GID.PLAY:
          setState(state === State.PLAYING ? State.PAUSED : State.PLAYING);
          break;
        case GID.STOP:
          setState(State.STOPPED);
          seek(0, true);
          break;
        case GID.REW:
          seek(frame - SEEK_STEP, true);
          break;
        case GID.FWD:
          seek(frame + SEEK_STEP, true);
          break;
      }
    }

    else if (e.kind === EventKind.SLIDER_CHANGE && e.sourceId === GID.SCRUB) {
      let v = (typeof e.attrs.level === 'number')
                ? e.attrs.level : scrub.get('level');
      seek(v, false);
    }

    else if (e.kind === EventKind.INTUITICKS && state === State.PLAYING) {
      if (frame >= FRAMES - 1) {
        setState(State.STOPPED);   /* ran off the end */
        seek(0, true);
      }
      else {
        seek(frame + 1, true);
      }
    }
  }
}
finally { win.dispose(); }
print('Bye.');
