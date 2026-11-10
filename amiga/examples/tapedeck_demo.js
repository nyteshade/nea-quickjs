/*
 * tapedeck_demo.js - a tape-deck / media-player front panel built from
 * ordinary Reaction gadgets.
 *
 * Laid out the way hardware decks and classic software players do it:
 *
 *   +--------------------------------------------------+
 *   | PLAY    Track 2/5    00:17 / 00:45               |   display
 *   | Second Wind                                      |
 *   | [==========|---------------------------------]   |   seek bar
 *   | [|<] [<<] [ > ] [ || ] [ [] ] [>>] [>|]          |   transport
 *     (drawn above with ASCII; on screen the buttons carry real
 *      vector glyphs - triangles, bars and a square)
 *   | Volume [=====================|-----------]       |
 *   | [ ] Shuffle   [ ] Repeat                 [Quit]  |
 *   +--------------------------------------------------+
 *
 * Conventions it follows:
 *   - Every transport button is always present and always means the
 *     same thing. Nothing morphs. State is shown by the display and by
 *     which buttons are latched down.
 *   - Play stays down while the deck is running. Pause is a separate
 *     latch on top of Play: press to hold, press again to resume.
 *   - Stop works from any state, releases both latches and returns to
 *     the start of the track.
 *   - Play while already playing restarts the track.
 *   - Rewind and fast-forward wind five seconds. Previous restarts
 *     the track, or goes to the previous one when pressed in the first
 *     three seconds. Next is the next track.
 *   - At the end of a track the deck moves on; at the end of the list
 *     it stops unless Repeat is on. Shuffle picks the next track at
 *     random.
 *   - The seek bar follows playback and can be dragged.
 *
 * Nothing is actually played: the "tracks" are just names and lengths,
 * and time comes from Date.now(). IDCMP_INTUITICKS (about ten a second
 * while the window is active) drives the display.
 *
 * The button glyphs are drawlist.image objects: each one is a short
 * list of filled shapes on a 20 x 12 grid, which the image class scales
 * to the button. They are passed to the buttons as BUTTON_RenderImage.
 * Images handed to a gadget this way are not disposed with it, so the
 * demo disposes them itself after the window is gone.
 *
 * tapedeck.gadget, the system transport gadget, is shown as-is in
 * tapedeck_gadget_demo.js.
 *
 * Requires quickjs.library 0.210+ (DrawList image class).
 * Run: qjs examples/tapedeck_demo.js
 */

const { Window, Layout, Button, Slider, CheckBox, StringGadget, Label,
        DrawList, DrawOp, EventKind, IDCMP, WindowPosition, BevelStyle,
        IDCMP_REACTION_DEFAULT } = amiga.boopsi;

const GID = {
  PREV: 1, REW: 2, PLAY: 3, PAUSE: 4, STOP: 5, FWD: 6, NEXT: 7,
  SEEK: 10, VOLUME: 11, SHUFFLE: 12, REPEAT: 13, QUIT: 99,
};

/** @type {Array<{title: string, seconds: number}>} */
const TRACKS = [
  { title: 'Opening Titles',    seconds: 30 },
  { title: 'Second Wind',       seconds: 45 },
  { title: 'Low Tide',          seconds: 20 },
  { title: 'Paper Lanterns',    seconds: 60 },
  { title: 'Last Train Home',   seconds: 35 },
];

const WIND_MS         = 5000;  /* << and >> step              */
const PREV_RESTART_MS = 3000;  /* |< restarts after this long */

/** @enum {string} */
const State = { STOPPED: 'STOP', PLAYING: 'PLAY', PAUSED: 'PAUSE' };

let state    = State.STOPPED;
let track    = 0;      /* index into TRACKS                         */
let posMs    = 0;      /* position within the track                 */
let lastMs   = 0;      /* Date.now() at the last tick while playing */
let volume   = 70;
let shuffle  = false;
let repeat   = false;

/* What is currently on screen, so gadgets are only touched on change. */
let shownLine1 = '';
let shownLine2 = '';
let shownSeek  = -1;

/* ---- gadgets ---------------------------------------------------- */

let line1 = new StringGadget({ text: '', readOnly: true, maxChars: 48 });
let line2 = new StringGadget({ text: '', readOnly: true, maxChars: 48 });

let seek = new Slider({ id: GID.SEEK, min: 0, max: TRACKS[0].seconds, level: 0 });

/* Transport glyphs, drawn on a 20 x 12 grid (x 0..19, y 0..11). */
const GRID_W = 20;
const GRID_H = 12;

/**
 * Directives for one filled triangle.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} x3
 * @param {number} y3
 * @returns {Array<Array<number>>}
 */
function tri(x1, y1, x2, y2, x3, y3) {
  return [
    [DrawOp.AMOVE, x1, y1],
    [DrawOp.ADRAW, x2, y2],
    [DrawOp.ADRAW, x3, y3],
    [DrawOp.AFILL],
  ];
}

/**
 * Directives for one filled bar.
 *
 * @param {number} x1 - left
 * @param {number} y1 - top
 * @param {number} x2 - right
 * @param {number} y2 - bottom
 * @returns {Array<Array<number>>}
 */
function bar(x1, y1, x2, y2) {
  return [[DrawOp.RECT, x1, y1, x2, y2]];
}

/** @type {Object<string, Array<Array<number>>>} */
const GLYPHS = {
  prev:  [...bar(4, 1, 5, 10),  ...tri(15, 1, 15, 10, 7, 5)],
  rew:   [...tri(9, 1, 9, 10, 2, 5), ...tri(17, 1, 17, 10, 10, 5)],
  play:  [...tri(6, 1, 6, 10, 14, 5)],
  pause: [...bar(6, 1, 8, 10),  ...bar(11, 1, 13, 10)],
  stop:  [...bar(6, 2, 13, 9)],
  fwd:   [...tri(2, 1, 2, 10, 9, 5), ...tri(10, 1, 10, 10, 17, 5)],
  next:  [...tri(4, 1, 4, 10, 12, 5), ...bar(14, 1, 15, 10)],
};

/** Every glyph image created, for disposal after the window closes.
 *  @type {Array<DrawList>} */
let glyphImages = [];

/**
 * Build the drawlist image for a named glyph.
 *
 * @param {string} name - key of GLYPHS
 * @returns {DrawList}
 */
function glyph(name) {
  let img = new DrawList({
    directives: GLYPHS[name],
    refWidth: GRID_W, refHeight: GRID_H,
    width: GRID_W, height: GRID_H,
  });
  glyphImages.push(img);
  return img;
}

let prevBtn  = new Button({ id: GID.PREV,  image: glyph('prev') });
let rewBtn   = new Button({ id: GID.REW,   image: glyph('rew') });
let playBtn  = new Button({ id: GID.PLAY,  image: glyph('play'),  pushButton: true });
let pauseBtn = new Button({ id: GID.PAUSE, image: glyph('pause'), pushButton: true });
let stopBtn  = new Button({ id: GID.STOP,  image: glyph('stop') });
let fwdBtn   = new Button({ id: GID.FWD,   image: glyph('fwd') });
let nextBtn  = new Button({ id: GID.NEXT,  image: glyph('next') });

let volSlider  = new Slider({ id: GID.VOLUME, min: 0, max: 100, level: volume });
let shuffleBox = new CheckBox({ id: GID.SHUFFLE, text: 'S_huffle' });
let repeatBox  = new CheckBox({ id: GID.REPEAT,  text: '_Repeat' });
let quitBtn    = new Button({ id: GID.QUIT, text: '_Quit' });

let win = new Window({
  title: 'Tape Deck', innerWidth: 360, innerHeight: 170,
  position: WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true, activate: true,
  idcmp: IDCMP_REACTION_DEFAULT | IDCMP.INTUITICKS,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 4,
    children: [
      new Layout({
        orientation: 'vertical', bevelStyle: BevelStyle.FIELD,
        children: [ line1, line2 ],
      }),
      seek,
      new Layout({
        orientation: 'horizontal', innerSpacing: 2, evenSize: true,
        children: [ prevBtn, rewBtn, playBtn, pauseBtn, stopBtn,
                    fwdBtn, nextBtn ],
      }),
      new Layout({
        orientation: 'horizontal', innerSpacing: 4,
        children: [ new Label({ text: 'Volume' }), volSlider ],
      }),
      new Layout({
        orientation: 'horizontal', innerSpacing: 8,
        children: [ shuffleBox, repeatBox, quitBtn ],
      }),
    ],
  }),
});

/* ---- display ---------------------------------------------------- */

/**
 * Format milliseconds as MM:SS.
 *
 * @param {number} ms
 * @returns {string}
 */
function clock(ms) {
  let s = Math.floor(ms / 1000);
  let m = Math.floor(s / 60);
  s -= m * 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

/**
 * Length of the current track in milliseconds.
 *
 * @returns {number}
 */
function trackMs() {
  return TRACKS[track].seconds * 1000;
}

/**
 * Bring the display and seek bar up to date. Gadgets are only written
 * when their content actually changed, so a tick that changes nothing
 * costs no redraw.
 *
 * @returns {undefined}
 */
function refresh() {
  let l1 = state + '    Track ' + (track + 1) + '/' + TRACKS.length +
           '    ' + clock(posMs) + ' / ' + clock(trackMs()) +
           '    Vol ' + volume;
  let l2 = TRACKS[track].title;
  let sk = Math.floor(posMs / 1000);

  if (l1 !== shownLine1) { line1.text = l1; shownLine1 = l1; }
  if (l2 !== shownLine2) { line2.text = l2; shownLine2 = l2; }
  if (sk !== shownSeek)  { seek.set({ level: sk }); shownSeek = sk; }
}

/**
 * Make the Play and Pause latches match the deck state. Called after
 * every state change and after every click on either button, because
 * a click toggles the button's own latch whether or not the deck
 * accepted it.
 *
 * @returns {undefined}
 */
function syncLatches() {
  playBtn.set({ selected: state !== State.STOPPED });
  pauseBtn.set({ selected: state === State.PAUSED });
}

/**
 * Change the deck state.
 *
 * @param {string} next - one of State
 * @returns {undefined}
 */
function setState(next) {
  if (next !== state) {
    state = next;
    print('deck: ' + state + '  (' + TRACKS[track].title + ' at ' +
          clock(posMs) + ')');
  }
  if (state === State.PLAYING) lastMs = Date.now();
  syncLatches();
}

/**
 * Select a track and rewind it. Keeps the current state.
 *
 * @param {number} index - index into TRACKS
 * @returns {undefined}
 */
function loadTrack(index) {
  track = index;
  posMs = 0;
  lastMs = Date.now();
  seek.set({ max: TRACKS[track].seconds });
  shownSeek = -1;
}

/**
 * Pick the track that follows the current one.
 *
 * @returns {number} track index, or -1 when the list has run out
 */
function followingTrack() {
  if (shuffle && TRACKS.length > 1) {
    let n;
    do { n = Math.floor(Math.random() * TRACKS.length); } while (n === track);
    return n;
  }
  if (track + 1 < TRACKS.length) return track + 1;
  return repeat ? 0 : -1;
}

/**
 * Move within the current track, clamped to its length.
 *
 * @param {number} ms - target position
 * @returns {undefined}
 */
function seekTo(ms) {
  posMs = Math.max(0, Math.min(trackMs(), ms));
  lastMs = Date.now();
}

/* ---- transport -------------------------------------------------- */

/**
 * Handle one transport button.
 *
 * @param {number} id - one of GID
 * @returns {undefined}
 */
function transport(id) {
  switch (id) {
    case GID.PLAY:
      if (state !== State.PAUSED) posMs = 0;  /* fresh start or restart */
      setState(State.PLAYING);
      break;

    case GID.PAUSE:
      if (state === State.PLAYING)     setState(State.PAUSED);
      else if (state === State.PAUSED) setState(State.PLAYING);
      else                             syncLatches();  /* nothing to hold */
      break;

    case GID.STOP:
      posMs = 0;
      setState(State.STOPPED);
      break;

    case GID.REW:
      if (state !== State.STOPPED) seekTo(posMs - WIND_MS);
      break;

    case GID.FWD:
      if (state !== State.STOPPED) seekTo(posMs + WIND_MS);
      break;

    case GID.PREV:
      if (posMs > PREV_RESTART_MS) seekTo(0);
      else loadTrack((track + TRACKS.length - 1) % TRACKS.length);
      break;

    case GID.NEXT:
      loadTrack((track + 1) % TRACKS.length);
      break;
  }
}

/**
 * Advance playback by the real time elapsed since the last tick.
 *
 * @returns {undefined}
 */
function tick() {
  if (state !== State.PLAYING) return;

  let now = Date.now();
  posMs += now - lastMs;
  lastMs = now;

  if (posMs >= trackMs()) {
    let n = followingTrack();
    if (n < 0) {
      loadTrack(0);
      setState(State.STOPPED);
    }
    else {
      loadTrack(n);
      print('deck: next track - ' + TRACKS[track].title);
    }
  }
}

/* ---- main loop -------------------------------------------------- */

win.open();
syncLatches();
refresh();
print('Tape deck open. Press the play button to start.');

try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;

    if (e.kind === EventKind.INTUITICKS) {
      tick();
    }

    else if (e.kind === EventKind.BUTTON_CLICK) {
      if (e.sourceId === GID.QUIT) break;
      transport(e.sourceId);
    }

    else if (e.kind === EventKind.SLIDER_CHANGE) {
      let v = (typeof e.attrs.level === 'number')
                ? e.attrs.level : e.source.get('level');

      if (e.sourceId === GID.VOLUME) {
        volume = v;
      }
      else if (e.sourceId === GID.SEEK) {
        if (state === State.STOPPED) shownSeek = -1;  /* snap back to 0 */
        else { seekTo(v * 1000); shownSeek = v; }
      }
    }

    else if (e.kind === EventKind.CHECKBOX_TOGGLE) {
      if (e.sourceId === GID.SHUFFLE) shuffle = !!shuffleBox.checked;
      if (e.sourceId === GID.REPEAT)  repeat  = !!repeatBox.checked;
    }

    refresh();
  }
}
finally {
  win.dispose();
  for (let img of glyphImages) img.dispose();
}
print('Bye.');
