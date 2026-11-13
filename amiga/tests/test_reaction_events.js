/* amiga/tests/test_reaction_events.js
 *
 * Two parts of the Reaction wrappers that can be checked without a
 * window, by standing in for the gadget:
 *
 *   1. request() of the four pop-up gadgets (GetFile, GetFont,
 *      GetScreenMode, GetColor). GetFile and GetColor had no such
 *      method until 0.232, so their requesters could not be opened.
 *      Checked: each sends its own method, with the window's
 *      struct Window pointer, whichever way the window is given.
 *
 *   2. What a gadget event carries in `event.attrs`. Until 0.232 a
 *      chooser event had no `active`, a clicktab event no `current`,
 *      and scroller and gradient-slider events asked the gadget for an
 *      attribute it does not have. Checked: every class in the table
 *      reads an attribute its wrapper really has, and the value turns
 *      up under the documented names.
 *
 * What is NOT checked here, and needs an Amiga: that the classes open
 * their requesters when sent the method, and what they return.
 *
 * Opens no window. Needs quickjs.library 0.232+.
 * Run: qjs tests/test_reaction_events.js
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

const B = amiga.boopsi;

/* ------------------------------------------------------------------
 * 1. request()
 * ------------------------------------------------------------------ */

/** Stand-in addresses; nothing is ever read through them. */
const FAKE_GADGET = 0x2000;
const FAKE_WINDOW = 0x3000;
const OTHER_WINDOW = 0x4000;

/** What the stand-in dispatcher last received. */
let sent = null;

/** What the stand-in dispatcher returns. */
let answer = 0;

const realDoMethod = amiga.doMethod;

/**
 * Run body with amiga.doMethod replaced by a stand-in that records
 * the object, the method ID and the first argument.
 *
 * @param {function(): undefined} body
 * @returns {undefined}
 */
function withStandInDispatcher(body) {
  amiga.doMethod = (object, message) => {
    /* a method message is a row of ULONGs: the ID, then the arguments */
    const words = new amiga.exec.Node(message);   /* two ULONGs: reuse */

    sent = { object, method: words.succ >>> 0, argument: words.pred >>> 0 };
    return answer;
  };

  try { body(); }
  finally { amiga.doMethod = realDoMethod; }
}

run('request(): present on all four pop-up gadgets', () => {
  for (const name of ['GetFile', 'GetFont', 'GetScreenMode', 'GetColor']) {
    ok(typeof B[name].prototype.request === 'function',
       name + '.prototype.request is a function');
  }
});

run('request(): the method and the window', () => {
  withStandInDispatcher(() => {
    const methods = new Set();

    for (const name of ['GetFile', 'GetFont', 'GetScreenMode', 'GetColor']) {
      const gadget = new B[name](FAKE_GADGET);   /* wraps; creates nothing */

      sent = null;
      answer = 1;
      const result = gadget.request(FAKE_WINDOW);

      ok(sent !== null && sent.object === FAKE_GADGET,
         name + ': a method is sent to the gadget');
      ok(sent !== null && sent.argument === FAKE_WINDOW,
         name + ': its argument is the struct Window pointer');
      ok(Boolean(result) === true, name + ': a non-zero answer is truthy');

      if (sent) methods.add(sent.method);
    }

    ok(methods.size === 4 && !methods.has(0),
       'each class sends a method ID of its own');
  });
});

run('request(): the ways of naming the window', () => {
  withStandInDispatcher(() => {
    const gadget = new B.GetFile(FAKE_GADGET);

    answer = 1;
    ok(gadget.request(FAKE_WINDOW) === true && sent.argument === FAKE_WINDOW,
       'a struct Window pointer');

    gadget.request({ intuiWindow: { ptr: OTHER_WINDOW } });
    ok(sent.argument === OTHER_WINDOW, 'a Reaction Window object');

    gadget.request({ ptr: FAKE_WINDOW });
    ok(sent.argument === FAKE_WINDOW, 'a struct Window wrapper');

    /* no argument: the open window the gadget is in */
    gadget._parent = { _intuiWindow: { ptr: OTHER_WINDOW }, _parent: null };
    gadget.request();
    ok(sent.argument === OTHER_WINDOW, 'nothing: the window the gadget is in');

    answer = 0;
    ok(gadget.request() === false, 'GetFile: answer 0 gives false (cancelled)');
    ok(new B.GetColor(FAKE_GADGET).request(FAKE_WINDOW) === false,
       'GetColor: answer 0 gives false (cancelled)');

    /* not in a window, and none given: the header says the window
     * MUST be provided, so nothing may be sent */
    const orphan = new B.GetColor(FAKE_GADGET);
    let message = null;

    sent = null;
    try { orphan.request(); } catch (error) { message = error.message; }

    ok(message !== null && /GetColor\.request/.test(message),
       'no window at all throws: ' + message);
    ok(sent === null, 'and sends nothing');
  });
});

/* ------------------------------------------------------------------
 * 2. event.attrs
 * ------------------------------------------------------------------ */

const table = B.Window.EVENT_ATTRS;

/**
 * The wrapper class for a class library name.
 *
 * @param {string} libraryName - e.g. 'gadgets/chooser.gadget'
 * @returns {function|undefined}
 */
function wrapperFor(libraryName) {
  for (const key of Object.keys(B.gadgets)) {
    if (B.gadgets[key]._classLibName === libraryName) return B.gadgets[key];
  }
  return undefined;
}

run('event.attrs: every class reads an attribute it has', () => {
  ok(table && Object.keys(table).length > 0, 'Window.EVENT_ATTRS exists');

  for (const libraryName of Object.keys(table || {})) {
    const wrapper = wrapperFor(libraryName);
    const entry = table[libraryName];

    ok(wrapper !== undefined && entry.from in wrapper.ATTRS,
       libraryName + ' reads "' + entry.from + '"' +
       (wrapper ? '' : ' (no wrapper has that class name)'));
  }
});

/**
 * Build an event for a stand-in source and fill its attrs.
 *
 * @param {string} libraryName - the source's class
 * @param {number} value - what the stand-in gadget answers
 * @returns {{attrs: object, asked: string[]}} the attrs set, and the
 *   attribute names the gadget was asked for
 */
function attrsFor(libraryName, value) {
  const asked = [];
  const event = {
    attrs: {},
    source: {
      get(name) {
        asked.push(name);
        if (!(name in wrapperFor(libraryName).ATTRS)) {
          throw new Error('unknown attribute "' + name + '"');
        }
        return value;
      },
    },
  };

  B.Window._fillAttrsForClass(event, libraryName);
  return { attrs: event.attrs, asked };
}

run('event.attrs: the names an event carries', () => {
  let chooser = attrsFor('gadgets/chooser.gadget', 3);
  ok(chooser.attrs.active === 3, 'chooser: attrs.active is the chosen index');
  ok(chooser.attrs.selected === 3, 'chooser: attrs.selected is the same index');
  ok(chooser.asked.join() === 'active', 'chooser: asked once, for "active"');

  let tabs = attrsFor('gadgets/clicktab.gadget', 2);
  ok(tabs.attrs.current === 2, 'clicktab: attrs.current is the chosen tab');
  ok(tabs.attrs.selected === 2, 'clicktab: attrs.selected is the same tab');

  let radio = attrsFor('gadgets/radiobutton.gadget', 1);
  ok(radio.attrs.selected === 1 && radio.asked.join() === 'selectedIx',
     'radiobutton: attrs.selected is the chosen index, from "selectedIx"');

  let scroller = attrsFor('gadgets/scroller.gadget', 40);
  ok(scroller.attrs.top === 40 && scroller.attrs.level === 40,
     'scroller: attrs.top (and attrs.level) is the position');

  let gradient = attrsFor('gadgets/gradientslider.gadget', 7);
  ok(gradient.attrs.curVal === 7 && gradient.attrs.level === 7,
     'gradientslider: attrs.curVal (and attrs.level) is the value');

  ok(attrsFor('gadgets/slider.gadget', 9).attrs.level === 9,
     'slider: attrs.level');
  ok(attrsFor('gadgets/checkbox.gadget', 1).attrs.selected === 1,
     'checkbox: attrs.selected');
  ok(attrsFor('gadgets/integer.gadget', 12).attrs.value === 12,
     'integer: attrs.value');
  ok(attrsFor('gadgets/listbrowser.gadget', 5).attrs.selected === 5,
     'listbrowser: attrs.selected');
  ok(attrsFor('gadgets/speedbar.gadget', 4).attrs.selected === 4,
     'speedbar: attrs.selected');

  let button = attrsFor('gadgets/button.gadget', 1);
  ok(Object.keys(button.attrs).length === 0 && button.asked.length === 0,
     'button: nothing is asked and nothing is set');
});

print('');
print('=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
std.out.flush();
if (fail > 0) std.exit(1);
