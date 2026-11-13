/* amiga/tests/test_screen_font.js
 *
 * The pieces a plain-window example uses to draw text at the size it
 * measured, checked without a screen by standing in for the OS:
 *
 *   1. ScreenFont.useIn(window) sets the window's RastPort to the
 *      screen's font. A window on Workbench starts with the system
 *      default font instead (intuition.doc, OpenScreenTagList,
 *      SA_SysFont), so until 0.237 the examples measured their text in
 *      one font and drew it in another whenever the user's two fonts
 *      differed.
 *
 *   2. Screen.rastPort is the RastPort inside the struct Screen, for
 *      measuring in a screen's font before a window is open.
 *
 *   3. Intuition.consts has the widths a menu item leaves for its
 *      checkmark and shortcut.
 *
 * What is NOT checked here, and needs an Amiga: that the text then
 * fits the window on a Workbench whose screen font and system default
 * font differ.
 *
 * Opens no window. Needs quickjs.library 0.237+.
 * Run: qjs tests/test_screen_font.js
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;

/**
 * Record one check.
 *
 * @param {boolean} condition - true if the check passed
 * @param {string} message - what was checked
 * @returns {undefined}
 */
function ok(condition, message) {
  if (condition) { print('  PASS: ' + message); pass++; }
  else           { print('  FAIL: ' + message); fail++; }
  std.out.flush();
}

/**
 * Run one group of checks; a throw fails the group, not the script.
 *
 * @param {string} title - the group's heading
 * @param {function(): undefined} body - the checks
 * @returns {undefined}
 */
function run(title, body) {
  print('\n-- ' + title + ' --');
  try { body(); }
  catch (error) {
    fail++;
    print('  FAIL: [section] threw: ' + (error && error.message || error));
  }
  std.out.flush();
}

/** Stand-in addresses; nothing is read through them. */
const FAKE_FONT      = 0x1234;
const FAKE_RAST_PORT = 0x2000;

run('ScreenFont.useIn: the window draws in the measured font', () => {
  ok(typeof amiga.ScreenFont.prototype.useIn === 'function',
     'ScreenFont.prototype.useIn is a function');

  /* A ScreenFont as the constructor leaves it, without the screen:
   * useIn needs only the font pointer. */
  const screenFont = Object.create(amiga.ScreenFont.prototype);
  screenFont._fontPtr = FAKE_FONT;

  const realSetFont = Graphics.SetFont;
  let calls = [];

  Graphics.SetFont = (rastPort, font) => { calls.push([rastPort, font]); };

  try {
    const rastPort = { ptr: FAKE_RAST_PORT };

    screenFont.useIn({ rastPort });

    ok(calls.length === 1, 'SetFont is called once');
    ok(calls.length === 1 && calls[0][0] === rastPort,
       'on the window\'s RastPort');
    ok(calls.length === 1 && calls[0][1] === FAKE_FONT,
       'with the screen\'s font');

    let message = null;

    calls = [];
    try { screenFont.useIn(null); } catch (error) { message = error.message; }

    ok(message !== null && calls.length === 0,
       'no window: throws (' + message + ') and sets nothing');
  }
  finally {
    Graphics.SetFont = realSetFont;
  }
});

run('Screen.rastPort: the RastPort inside the struct', () => {
  const Screen = amiga.intuition.Screen;

  /* A block big enough for a struct Screen up to the end of its
   * RastPort, with a font height written where the RastPort keeps it. */
  const FONT_HEIGHT = 11;
  const BASELINE    = 8;
  const bytes       = Screen.OFFSET.RastPort + RastPort.SIZE;
  const memory      = amiga.allocMem(bytes);

  try {
    amiga.poke16(memory + Screen.OFFSET.RastPort + RastPort.OFFSET.TxHeight,
                 FONT_HEIGHT);
    amiga.poke16(memory + Screen.OFFSET.RastPort + RastPort.OFFSET.TxBaseline,
                 BASELINE);

    const rastPort = new Screen(memory).rastPort;

    ok(rastPort instanceof RastPort, 'it is a RastPort wrapper');
    ok(rastPort.ptr === memory + Screen.OFFSET.RastPort,
       'at the RastPort field of the screen');
    ok(rastPort.fontHeight === FONT_HEIGHT,
       'fontHeight reads the screen font\'s height');
    ok(rastPort.fontBaseline === BASELINE,
       'fontBaseline reads the screen font\'s baseline');
  }
  finally {
    amiga.freeMem(memory, bytes);
  }
});

run('Intuition.consts: room for a checkmark and a shortcut', () => {
  for (const name of ['CHECKWIDTH', 'COMMWIDTH',
                      'LOWCHECKWIDTH', 'LOWCOMMWIDTH']) {
    ok(name in Intuition.consts && Number(Intuition.consts[name]) > 0,
       name + ' is there (' +
       (name in Intuition.consts ? Number(Intuition.consts[name]) : '-') +
       ' pixels)');
  }

  ok(Number(Intuition.consts.CHECKWIDTH) >
     Number(Intuition.consts.LOWCHECKWIDTH),
     'the low-resolution checkmark room is the narrower');
});

print('');
print('=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
std.out.flush();
if (fail > 0) std.exit(1);
