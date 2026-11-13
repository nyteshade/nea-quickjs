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
 *   3. new Class(pointer) wraps an existing object for every class.
 *      Until 0.237 Layout, Page, Virtual and Window ignored the
 *      pointer and created a new object.
 *
 *   4. The walk along an IDCMP_IDCMPUPDATE tag list finds GA_ID.
 *      Until 0.237 it looked for GA_GZZGadget's number.
 *
 *   5. A (WORD) or (LONG) attribute reads back negative values, and a
 *      pointer attribute takes a wrapper object. Until 0.237 thirty
 *      attributes had a type their header does not give them.
 *
 * What is NOT checked here, and needs an Amiga: that the classes open
 * their requesters when sent the method, and what they return.
 *
 * Opens no window. Needs quickjs.library 0.237+.
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

/* ------------------------------------------------------------------
 * 3. new Class(pointer) wraps
 * ------------------------------------------------------------------ */

/**
 * Every wrapper class on amiga.boopsi, by name: the classes, gadgets
 * and images.
 *
 * @returns {Object<string, function>}
 */
function everyWrapper() {
  return { ...B.classes, ...B.gadgets, ...B.images };
}

run('new Class(pointer): every class wraps, none creates', () => {
  /* Creating would open the class library, which is not there under
   * vamos and throws; on an Amiga it would make a second object. So a
   * wrapper that comes back holding the pointer has created nothing. */
  const wrappers = everyWrapper();
  const names = Object.keys(wrappers).sort();

  ok(names.length >= 35, names.length + ' wrapper classes found');

  for (const name of names) {
    let wrapped = null, message = '';

    try { wrapped = new wrappers[name](FAKE_GADGET); }
    catch (error) { message = ' (threw: ' + error.message + ')'; }

    ok(wrapped !== null && wrapped.ptr === FAKE_GADGET &&
       wrapped._wrappingOnly === true,
       name + ' wraps the pointer' + message);
  }
});

run('new Layout / Page / Window (pointer): what the wrapper is', () => {
  for (const name of ['Layout', 'Page', 'Virtual']) {
    const group = new B[name](FAKE_GADGET);

    ok(group instanceof B.Layout && Array.isArray(group._children) &&
       group._children.length === 0,
       name + ': a ' + name + ' with no JS-side children');
  }

  withStandInDispatcher(() => {
    const window = new B.Window(FAKE_GADGET);

    ok(window.intuiWindow === null, 'Window: not known to be open');

    /* dispose() of a wrapper must leave the owner's window alone */
    sent = null;
    window._intuiWindow = { ptr: FAKE_WINDOW };   /* as after open() */
    window.dispose();
    ok(sent === null, 'Window: dispose() of a wrapper sends no WM_CLOSE');
    ok(window.ptr === 0 && window.intuiWindow === null,
       'Window: the wrapper itself is finished');
  });
});

/* ------------------------------------------------------------------
 * 4. The tag list of an IDCMP_IDCMPUPDATE message
 * ------------------------------------------------------------------ */

run('IDCMPUPDATE tag list: GA_ID is found', () => {
  /* Until 0.237 the walk looked for 0x8003000F, which is GA_GZZGadget,
   * so the gadget's ID was filed under attrs and the event had no
   * source. The list here is a real one in memory, built from the
   * checked tables. */
  const GADGET_ID = 7;
  const pairs = [
    [Number(Intuition.consts.GA_GZZGadget), 1],
    [B.GA.ID, GADGET_ID],
    [Number(Intuition.consts.ICA_TARGET), 0x1234],
  ];
  const tags = amiga.makeTags(pairs);
  const out = {};

  try { B.Window._walkUpdateTags(tags, out); }
  finally { amiga.freeMem(tags, (pairs.length + 1) * 8); }

  ok(out.id === GADGET_ID, 'out.id is the GA_ID value (got ' + out.id + ')');
  ok(out.icaTarget === 0x1234, 'out.icaTarget is the ICA_TARGET value');
  ok(out.tags && Object.keys(out.tags).length === 1 &&
     out.tags[Number(Intuition.consts.GA_GZZGadget)] === 1,
     'any other tag is kept by number, and only those');
});

/* ------------------------------------------------------------------
 * 5. Attribute types (scripts/check_attr_types.py checks all of them
 *    against the headers; these are the ones whose effect shows)
 * ------------------------------------------------------------------ */

run('attribute types: signed values and pointers', () => {
  /**
   * What an attribute's type makes of a raw 32-bit value read back
   * from the object.
   *
   * @param {function} wrapper - the wrapper class
   * @param {string} name - the attribute
   * @param {number} raw - the ULONG the class stored
   * @returns {*} the decoded value
   */
  const decoded = (wrapper, name, raw) =>
    B.ATTR_TYPES[wrapper.ATTRS[name].type].decode(raw);

  const NONE = 0xFFFFFFFF;   /* -1 as the class stores it */

  /* CHOOSER_Active and RADIOBUTTON_Selected are (WORD): -1 is "nothing
   * chosen". As 'uint32' it read back 4294967295. */
  ok(decoded(B.Chooser, 'active', NONE) === -1,
     'Chooser active: -1 (nothing chosen) reads back as -1');
  ok(decoded(B.RadioButton, 'selectedIx', NONE) === -1,
     'RadioButton selectedIx: -1 reads back as -1');
  ok(decoded(B.Button, 'textPen', NONE) === -1,
     'Button textPen: -1 (the default pen) reads back as -1');

  /* GETCOLOR_RGB is a struct pointer: a wrapper object must be
   * accepted, which 'uint32' turned into 0 */
  const encode = B.ATTR_TYPES[B.GetColor.ATTRS.rgb.type].encode;
  ok(encode({ ptr: 0x5000 }) === 0x5000,
     'GetColor rgb: takes an object with a ptr');
  ok(B.ATTR_TYPES[B.Requester.ATTRS.image.type].encode({ ptr: 0x5000 })
       === 0x5000 &&
     B.ATTR_TYPES[B.Requester.ATTRS.image.type].encode(2) === 2,
     'Requester image: takes an Image object or a REQIMAGE_ number');
});

print('');
print('=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
std.out.flush();
if (fail > 0) std.exit(1);
