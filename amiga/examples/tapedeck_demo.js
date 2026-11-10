/*
 * tapedeck_demo.js - a tape deck front panel in Reaction, from JavaScript.
 *
 *   +----------------------------------------------+
 *   | PLAY   2/5   00:17 / 00:45                   |   display
 *   | Second Wind                                  |
 *   | ======|===================================   |   seek bar
 *   | [|<] [<<] [> ] [||] [[]] [>>] [>|]           |   transport
 *   | Volume  ====================|=============   |
 *   | [ ] Shuffle    [ ] Repeat          [ Quit ]  |
 *   +----------------------------------------------+
 *
 * The file is meant to be read top to bottom. It has four parts, and
 * each one knows nothing about the parts below it:
 *
 *   1. THE DECK    - what a tape deck does. Plain JavaScript, no GUI.
 *   2. THE GLYPHS  - the pictures on the transport buttons.
 *   3. THE PANEL   - the window, written as a tree that looks like it.
 *   4. THE LOOP    - events in, deck methods called, panel redrawn.
 *
 * Why this is a pleasant way to write Reaction:
 *
 *   - The layout is one nested expression. Indentation is the layout:
 *     no tag lists, no TAG_DONE, no LAYOUT_AddChild bookkeeping.
 *   - Gadgets are objects. `playButton.selected = true` instead of
 *     SetGadgetAttrs(gad, win, NULL, GA_Selected, TRUE, TAG_DONE).
 *   - Events arrive already decoded: which gadget, what kind of event,
 *     the new slider level. No WMHI_ masks, no IDCMP message walking.
 *   - Cleanup is one call. Disposing the window disposes its gadgets.
 *   - The behaviour (part 1) is ordinary code that could be tested
 *     without opening a window at all.
 *
 * How the deck behaves, following real cassette decks and the classic
 * software players modelled on them:
 *
 *   - Every transport button is always there and always means the same
 *     thing. What the deck is doing is shown by the display and by
 *     which buttons are latched down.
 *   - Play stays down while the deck runs. Pause is a second latch on
 *     top of Play: press to hold, press again to carry on.
 *   - Stop works from anywhere, releases both latches and rewinds the
 *     track.
 *   - Pressing Play while already playing restarts the track.
 *   - At the end of a track the deck moves to the next one. At the end
 *     of the tape it stops, unless Repeat is on.
 *
 * Nothing is really played: the tracks are names and lengths, and time
 * comes from the system clock.
 *
 * The system's own transport gadget, tapedeck.gadget, is shown in
 * tapedeck_gadget_demo.js.
 *
 * Requires quickjs.library 0.211+.
 * Run: qjs examples/tapedeck_demo.js
 */

const { Window, Layout, Button, Slider, CheckBox, StringGadget, Label,
        DrawList, DrawOp, EventKind, IDCMP, IDCMP_REACTION_DEFAULT,
        WindowPosition, BevelStyle } = amiga.boopsi;


/* ==================================================================
 * 1. THE DECK
 *
 * Everything a tape deck does, and nothing about how it looks. The
 * panel further down only ever calls these methods and reads these
 * fields.
 * ================================================================== */

/** The tape: track titles and their lengths in seconds. */
const TRACKS = [
  { title: 'Opening Titles',  seconds: 30 },
  { title: 'Second Wind',     seconds: 45 },
  { title: 'Low Tide',        seconds: 20 },
  { title: 'Paper Lanterns',  seconds: 60 },
  { title: 'Last Train Home', seconds: 35 },
];

/** The three things a deck can be doing. The value is what the
 *  display shows. */
const Mode = Object.freeze({
  STOPPED: 'STOP',
  PLAYING: 'PLAY',
  PAUSED:  'PAUSE',
});

/** How far one press of rewind or fast-forward winds the tape. */
const WIND_SECONDS = 5;

/** Pressing Previous this early in a track goes to the track before;
 *  any later and it restarts the current one. */
const PREVIOUS_RESTARTS_AFTER_SECONDS = 3;

class Deck {
  /**
   * @param {Array<{title: string, seconds: number}>} tracks
   */
  constructor(tracks) {
    /** @type {Array<{title: string, seconds: number}>} */
    this.tracks = tracks;

    /** @type {string} one of Mode */
    this.mode = Mode.STOPPED;

    /** @type {number} index into this.tracks */
    this.trackIndex = 0;

    /** @type {number} position within the track, in milliseconds */
    this.positionMs = 0;

    /** @type {number} 0 to 100 */
    this.volume = 70;

    /** @type {boolean} */
    this.shuffle = false;

    /** @type {boolean} */
    this.repeat = false;

    /** @type {number} clock reading at the last advance() */
    this._lastClockMs = 0;
  }

  /* ---- reading the deck ---- */

  /** @returns {{title: string, seconds: number}} the current track */
  get track() {
    return this.tracks[this.trackIndex];
  }

  /** @returns {number} whole seconds into the current track */
  get positionSeconds() {
    return Math.floor(this.positionMs / 1000);
  }

  /** @returns {boolean} */
  get isStopped() {
    return this.mode === Mode.STOPPED;
  }

  /* ---- the transport buttons ---- */

  /**
   * Play. Resumes if paused; otherwise starts the track from the top,
   * which also makes Play-while-playing a restart.
   *
   * @returns {undefined}
   */
  play() {
    if (this.mode !== Mode.PAUSED) this.positionMs = 0;
    this._run();
  }

  /**
   * Pause is a toggle, and only means something while the deck is
   * running: with the deck stopped there is nothing to hold.
   *
   * @returns {undefined}
   */
  pause() {
    if (this.mode === Mode.PLAYING)     this.mode = Mode.PAUSED;
    else if (this.mode === Mode.PAUSED) this._run();
  }

  /**
   * Stop, and rewind the track.
   *
   * @returns {undefined}
   */
  stop() {
    this.mode = Mode.STOPPED;
    this.positionMs = 0;
  }

  /**
   * Wind the tape. Does nothing while stopped.
   *
   * @param {number} seconds - positive winds forward, negative back
   * @returns {undefined}
   */
  wind(seconds) {
    if (this.isStopped) return;
    this.seek(this.positionSeconds + seconds);
  }

  /**
   * Jump to a position in the current track. Does nothing while
   * stopped.
   *
   * @param {number} seconds - clamped to the track's length
   * @returns {undefined}
   */
  seek(seconds) {
    if (this.isStopped) return;

    let clamped = Math.max(0, Math.min(this.track.seconds, seconds));
    this.positionMs = clamped * 1000;
    this._lastClockMs = Date.now();
  }

  /**
   * Previous: back to the start of this track, or to the track before
   * if this one has only just begun.
   *
   * @returns {undefined}
   */
  previous() {
    if (this.positionSeconds >= PREVIOUS_RESTARTS_AFTER_SECONDS) {
      this._load(this.trackIndex);
    } else {
      let count = this.tracks.length;
      this._load((this.trackIndex + count - 1) % count);
    }
  }

  /**
   * Next track, wrapping round at the end of the tape.
   *
   * @returns {undefined}
   */
  next() {
    this._load((this.trackIndex + 1) % this.tracks.length);
  }

  /* ---- time passing ---- */

  /**
   * Move the tape on by however much real time has gone by. Call it
   * regularly; it does nothing unless the deck is playing.
   *
   * @returns {undefined}
   */
  advance() {
    if (this.mode !== Mode.PLAYING) return;

    let now = Date.now();
    this.positionMs += now - this._lastClockMs;
    this._lastClockMs = now;

    if (this.positionMs >= this.track.seconds * 1000) this._trackEnded();
  }

  /* ---- internals ---- */

  /**
   * Start the tape moving from wherever it is.
   *
   * @returns {undefined}
   */
  _run() {
    this.mode = Mode.PLAYING;
    this._lastClockMs = Date.now();
  }

  /**
   * Put a track under the head, rewound. The mode is left alone, so a
   * playing deck keeps playing.
   *
   * @param {number} index - index into this.tracks
   * @returns {undefined}
   */
  _load(index) {
    this.trackIndex = index;
    this.positionMs = 0;
    this._lastClockMs = Date.now();
  }

  /**
   * The current track has run out: move on, or stop at the end of the
   * tape.
   *
   * @returns {undefined}
   */
  _trackEnded() {
    let last = this.trackIndex === this.tracks.length - 1;

    if (this.shuffle && this.tracks.length > 1) {
      let pick;
      do {
        pick = Math.floor(Math.random() * this.tracks.length);
      } while (pick === this.trackIndex);
      this._load(pick);
    }
    else if (!last || this.repeat) {
      this.next();
    }
    else {
      this._load(0);
      this.mode = Mode.STOPPED;
    }
  }
}


/* ==================================================================
 * 2. THE GLYPHS
 *
 * The pictures on the transport buttons are drawlist.image objects:
 * each is a few filled shapes described on a small grid, which the
 * image class scales to fit. The grid below is 32 wide and 20 high,
 * the same proportions as the buttons, so a square stays square.
 *
 *        0         16         31
 *      0 +----------+----------+
 *        |                     |
 *      4 |      top of glyph   |
 *     10 |      centre line    |
 *     16 |      bottom         |
 *     19 +---------------------+
 * ================================================================== */

const GRID_WIDTH  = 32;
const GRID_HEIGHT = 20;

const TOP    = 4;
const MIDDLE = 10;
const BOTTOM = 16;

/**
 * A filled triangle pointing right, with its flat edge at `left` and
 * its point at `right`.
 *
 * @param {number} left
 * @param {number} right
 * @returns {Array<Array<number>>} drawlist directives
 */
function pointingRight(left, right) {
  return [
    [DrawOp.AMOVE, left,  TOP],
    [DrawOp.ADRAW, left,  BOTTOM],
    [DrawOp.ADRAW, right, MIDDLE],
    [DrawOp.AFILL],
  ];
}

/**
 * A filled triangle pointing left, with its point at `left` and its
 * flat edge at `right`.
 *
 * @param {number} left
 * @param {number} right
 * @returns {Array<Array<number>>} drawlist directives
 */
function pointingLeft(left, right) {
  return [
    [DrawOp.AMOVE, right, TOP],
    [DrawOp.ADRAW, right, BOTTOM],
    [DrawOp.ADRAW, left,  MIDDLE],
    [DrawOp.AFILL],
  ];
}

/**
 * A filled upright bar, the full height of a glyph.
 *
 * @param {number} left
 * @param {number} right
 * @returns {Array<Array<number>>} drawlist directives
 */
function bar(left, right) {
  return [[DrawOp.RECT, left, TOP, right, BOTTOM]];
}

/** What each button shows. */
const GLYPHS = {
  previous: [...bar(7, 9),            ...pointingLeft(12, 24)],
  rewind:   [...pointingLeft(6, 15),  ...pointingLeft(16, 25)],
  play:     [...pointingRight(11, 22)],
  pause:    [...bar(10, 13),          ...bar(18, 21)],
  stop:     [...bar(10, 21)],
  forward:  [...pointingRight(6, 15), ...pointingRight(16, 25)],
  next:     [...pointingRight(7, 19), ...bar(22, 24)],
};

/** Images handed to a button are not disposed along with it, so every
 *  one made here is remembered and disposed when the demo ends. */
const glyphImages = [];

/**
 * Build the image for one glyph.
 *
 * @param {string} name - a key of GLYPHS
 * @returns {DrawList}
 */
function glyph(name) {
  let image = new DrawList({
    directives: GLYPHS[name],
    refWidth:   GRID_WIDTH,
    refHeight:  GRID_HEIGHT,
    width:      GRID_WIDTH,
    height:     GRID_HEIGHT,
  });

  glyphImages.push(image);
  return image;
}


/* ==================================================================
 * 3. THE PANEL
 *
 * First the gadgets the loop needs to talk to, each given a name. Then
 * the window, which arranges them. Read the `layout:` tree at the
 * bottom of this part next to the picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = {
  PREVIOUS: 1, REWIND: 2, PLAY: 3, PAUSE: 4, STOP: 5, FORWARD: 6, NEXT: 7,
  SEEK: 10, VOLUME: 11, SHUFFLE: 12, REPEAT: 13,
  QUIT: 99,
};

/** A transport button is a little wider than it is tall and does not
 *  stretch sideways, so its glyph keeps its shape whatever the window
 *  width. */
const TRANSPORT_BUTTON = { minWidth: 40, minHeight: 24 };

/**
 * A transport button showing a glyph.
 *
 * @param {number} id - one of ID
 * @param {string} glyphName - a key of GLYPHS
 * @param {{latching: boolean}} [options] - latching buttons stay down
 *   until told otherwise, like Play and Pause on a real deck
 * @returns {Button}
 */
function transportButton(id, glyphName, options) {
  return new Button({
    id,
    image:       glyph(glyphName),
    pushButton:  !!(options && options.latching),
    layoutHints: TRANSPORT_BUTTON,
  });
}

/**
 * Children side by side.
 *
 * @param {...object} children
 * @returns {Layout}
 */
function row(...children) {
  return new Layout({ orientation: 'horizontal', innerSpacing: 4, children });
}

/**
 * Children stacked, inside a recessed frame.
 *
 * @param {...object} children
 * @returns {Layout}
 */
function framed(...children) {
  return new Layout({
    orientation: 'vertical',
    bevelStyle:  BevelStyle.FIELD,
    children,
  });
}

/* ---- the display ---- */

/**
 * One read-only line of the display.
 *
 * @returns {StringGadget}
 */
function displayLine() {
  return new StringGadget({
    text: '', readOnly: true, maxChars: 40, minVisible: 28,
  });
}

let statusLine = displayLine();
let titleLine  = displayLine();

/* ---- the transport ---- */

let previousButton = transportButton(ID.PREVIOUS, 'previous');
let rewindButton   = transportButton(ID.REWIND,   'rewind');
let playButton     = transportButton(ID.PLAY,     'play',  { latching: true });
let pauseButton    = transportButton(ID.PAUSE,    'pause', { latching: true });
let stopButton     = transportButton(ID.STOP,     'stop');
let forwardButton  = transportButton(ID.FORWARD,  'forward');
let nextButton     = transportButton(ID.NEXT,     'next');

/* ---- everything else ---- */

let seekBar      = new Slider({ id: ID.SEEK,   min: 0, max: 30,  level: 0 });
let volumeSlider = new Slider({ id: ID.VOLUME, min: 0, max: 100, level: 70 });

let shuffleBox = new CheckBox({ id: ID.SHUFFLE, text: 'S_huffle' });
let repeatBox  = new CheckBox({ id: ID.REPEAT,  text: '_Repeat' });
let quitButton = new Button({ id: ID.QUIT, text: '_Quit' });

/* ---- the window ---- */

let window = new Window({
  title:       'Tape Deck',
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true,
  dragBar:     true,
  depthGadget: true,
  activate:    true,

  /* The usual Reaction events, plus a tick about ten times a second
   * while the window is active. The ticks are the deck's clock. */
  idcmp: IDCMP_REACTION_DEFAULT | IDCMP.INTUITICKS,

  /* No size is given: the window is exactly as big as its contents
   * need, so the transport buttons come out at their natural size. */
  layout: new Layout({
    orientation: 'vertical',
    innerSpacing: 4,
    children: [

      framed(statusLine, titleLine),

      seekBar,

      row(previousButton, rewindButton, playButton, pauseButton,
          stopButton, forwardButton, nextButton),

      row(new Label({ text: 'Volume' }), volumeSlider),

      row(shuffleBox, repeatBox, quitButton),

    ],
  }),
});


/* ==================================================================
 * 4. THE LOOP
 *
 * Wait for an event, tell the deck, then make the panel show whatever
 * the deck now says. The deck is the only source of truth: the panel
 * never decides anything.
 * ================================================================== */

let deck = new Deck(TRACKS);

/**
 * Format seconds as MM:SS.
 *
 * @param {number} seconds
 * @returns {string}
 */
function clock(seconds) {
  let minutes = Math.floor(seconds / 60);
  let rest    = seconds - minutes * 60;

  return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
}

/** What the panel currently shows, so that show() only touches a
 *  gadget whose content has really changed. A tick that changes
 *  nothing then costs no redraw at all. */
let shown = {};

/**
 * Set one gadget attribute, but only if it differs from what is
 * already on screen.
 *
 * @param {string} key - any unique name for this gadget + attribute
 * @param {object} gadget
 * @param {string} attribute - e.g. 'text', 'level', 'selected'
 * @param {*} value
 * @returns {undefined}
 */
function show(key, gadget, attribute, value) {
  if (shown[key] === value) return;

  gadget.set({ [attribute]: value });
  shown[key] = value;
}

/**
 * Make the whole panel match the deck.
 *
 * @returns {undefined}
 */
function render() {
  let status = deck.mode +
               '   ' + (deck.trackIndex + 1) + '/' + deck.tracks.length +
               '   ' + clock(deck.positionSeconds) +
               ' / ' + clock(deck.track.seconds);

  show('status', statusLine, 'text', status);
  show('title',  titleLine,  'text', deck.track.title);

  show('seekMax', seekBar, 'max',   deck.track.seconds);
  show('seek',    seekBar, 'level', deck.positionSeconds);

  /* The latches: Play is down whenever the deck is not stopped, and
   * Pause is down on top of it while paused. */
  show('play',  playButton,  'selected', !deck.isStopped);
  show('pause', pauseButton, 'selected', deck.mode === Mode.PAUSED);
}

/** What each button does. */
const onClick = {
  [ID.PREVIOUS]: () => deck.previous(),
  [ID.REWIND]:   () => deck.wind(-WIND_SECONDS),
  [ID.PLAY]:     () => deck.play(),
  [ID.PAUSE]:    () => deck.pause(),
  [ID.STOP]:     () => deck.stop(),
  [ID.FORWARD]:  () => deck.wind(+WIND_SECONDS),
  [ID.NEXT]:     () => deck.next(),
};

/** What each slider does with its new level. */
const onSlide = {
  [ID.SEEK]:   (level) => deck.seek(level),
  [ID.VOLUME]: (level) => { deck.volume = level; },
};

/** What each checkbox does with its new state. */
const onToggle = {
  [ID.SHUFFLE]: (checked) => { deck.shuffle = checked; },
  [ID.REPEAT]:  (checked) => { deck.repeat  = checked; },
};

window.open();
render();
print('Tape deck open. Press the play button to start.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.sourceId === ID.QUIT) break;

    switch (event.kind) {

      case EventKind.INTUITICKS:
        deck.advance();
        break;

      case EventKind.BUTTON_CLICK:
        if (onClick[event.sourceId]) onClick[event.sourceId]();

        /* Clicking a latching button flips its latch by itself, whether
         * or not the deck agreed (Pause while stopped, for instance).
         * Forgetting what we think those two show makes render() put
         * them back the way the deck says. */
        delete shown.play;
        delete shown.pause;
        break;

      case EventKind.SLIDER_CHANGE: {
        let level = event.source.get('level');
        if (onSlide[event.sourceId]) onSlide[event.sourceId](level);

        /* The user has just moved the seek knob, so the screen shows
         * where they put it, not where we last did. Recording that
         * means render() leaves the knob alone during a drag, and only
         * moves it back if the deck refused (seeking while stopped). */
        if (event.sourceId === ID.SEEK) shown.seek = level;
        break;
      }

      case EventKind.CHECKBOX_TOGGLE:
        if (onToggle[event.sourceId]) {
          onToggle[event.sourceId](!!event.source.checked);
        }
        break;
    }

    render();
  }
}
finally {
  window.dispose();
  for (let image of glyphImages) image.dispose();
}

print('Bye.');
