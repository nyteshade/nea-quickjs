/* amiga/tests/test_led.js
 *
 * The Led wrapper (led.image), with Intuition stood in for, so that it
 * runs without Reaction and without a window.
 *
 * What led.image is given is settled by three NDK sources that agree:
 * images/led.h ("(WORD *) Array of digit pairs"), the autodoc ("One
 * entry per pair is required") and Examples/LED.c, whose
 * `WORD ledvalues[..] = { 26, 50, 44, ... }` is commented "2650448912..".
 * So: one WORD per PAIR of digits, holding the two-digit number.
 * Until 0.232 the examples wrote one byte per digit.
 *
 * Checked here:
 *   - Led.pairsOf() splits a number into pair values
 *   - an array of values becomes a WORD array of the right size and
 *     content, and LED_Pairs / LED_Values are passed to the class
 *   - setValues() rewrites that array, hands the class the pointer
 *     again and then draws the image (as LED.c does after SetAttrs)
 *     when the image is in an open window, and does not try to when
 *     it is not
 *   - dispose() frees the array
 *
 * NOT checked here, and needing an Amiga: what led.image draws.
 *
 * Needs quickjs.library 0.232+.
 * Run: qjs tests/test_led.js
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

const { Led } = amiga.boopsi;

if (typeof Led.pairsOf !== 'function') {
  print('FATAL: Led.pairsOf not available - library < 0.232?');
  std.exit(2);
}

run('Led.pairsOf', () => {
  ok(Led.pairsOf(123456, 3).join() === '12,34,56', '123456 in 3 pairs: 12 34 56');
  ok(Led.pairsOf(7, 2).join() === '0,7', '7 in 2 pairs: 00 07');
  ok(Led.pairsOf(128, 2).join() === '1,28', '128 in 2 pairs: 01 28');
  ok(Led.pairsOf(0, 3).join() === '0,0,0', '0 in 3 pairs: 00 00 00');
  ok(Led.pairsOf(1234567, 3).join() === '23,45,67',
     'a number too long loses its front digits');
  ok(Led.pairsOf(59.9, 1).join() === '59', 'a fraction is dropped');
  ok(Led.pairsOf(-5, 1).join() === '0', 'a negative number shows as 0');
});

/* ------------------------------------------------------------------
 * Stand-ins. The class library "opens", Intuition's object calls are
 * recorded instead of made.
 * ------------------------------------------------------------------ */

/** Stand-in addresses; nothing is read through the first three. */
const FAKE_IMAGE     = 0x2000;
const FAKE_RASTPORT  = 0x5000;
const FAKE_SCREEN    = 0x6000;
const FAKE_DRAWINFO  = 0x7000;

/** Room for the stand-in struct Window: more than the real one needs
 *  (the Window wrapper has no SIZE, because Intuition allocates them);
 *  only two of its fields are read. */
const STAND_IN_WINDOW_BYTES = 256;

/** What was recorded. */
let created = [];    /* tag Maps given to NewObjectA */
let setCalls = [];   /* tag Maps given to SetAttrsA */
let drawn = [];      /* { rastPort, image, left, top, state, drawInfo } */
let released = 0;    /* FreeScreenDrawInfo calls */
let disposed = [];   /* object pointers given to DisposeObject */

/** Blocks taken with amiga.allocMem and not yet freed: pointer -> size. */
const outstanding = new Map();

/** sizeof(struct TagItem): a tag and its data, a ULONG each. */
const TAG_ITEM_BYTES = 8;

/**
 * Read a TagItem array into a Map.
 *
 * @param {number} tags - pointer to the array
 * @returns {Map<number, number>} tag -> data
 */
function readTags(tags) {
  const result = new Map();

  /* a TagItem is two ULONGs, as a struct Node starts with two pointers */
  for (let at = tags; ; at += TAG_ITEM_BYTES) {
    const item = new amiga.exec.Node(at);
    if ((item.succ >>> 0) === 0) break;
    result.set(item.succ >>> 0, item.pred >>> 0);
  }

  return result;
}

/**
 * The WORDs of a led value array.
 *
 * @param {number} pointer - the array
 * @param {number} count - how many WORDs
 * @returns {number[]}
 */
function wordsAt(pointer, count) {
  const WORD_BYTES = 2;
  const words = [];

  for (let index = 0; index < count; index++) {
    words.push(amiga.peek16(pointer + index * WORD_BYTES));
  }

  return words;
}

const real = {
  openLibrary: amiga.openLibrary, closeLibrary: amiga.closeLibrary,
  call: amiga.call, allocMem: amiga.allocMem, freeMem: amiga.freeMem,
  NewObjectA: Intuition.NewObjectA, SetAttrsA: Intuition.SetAttrsA,
  DisposeObject: Intuition.DisposeObject,
  GetScreenDrawInfo: Intuition.GetScreenDrawInfo,
  FreeScreenDrawInfo: Intuition.FreeScreenDrawInfo,
  DrawImageState: Intuition.DrawImageState,
};

const standInBases = new Set();

amiga.openLibrary = (name, version) => {
  if (!/\.image$/.test(name)) return real.openLibrary(name, version);
  const base = real.allocMem(8);
  standInBases.add(base);
  return base;
};
amiga.closeLibrary = (base) => {
  if (!standInBases.has(base)) real.closeLibrary(base);
};
amiga.call = (base, offset, regs) =>
  standInBases.has(base) ? base : real.call(base, offset, regs);

amiga.allocMem = (size, flags) => {
  const pointer = real.allocMem(size, flags);
  if (pointer) outstanding.set(pointer, size);
  return pointer;
};
amiga.freeMem = (pointer, size) => {
  outstanding.delete(pointer);
  return real.freeMem(pointer, size);
};

Intuition.NewObjectA = (classPointer, classID, tags) => {
  created.push(readTags(tags));
  return FAKE_IMAGE;
};
Intuition.SetAttrsA = (object, tags) => {
  setCalls.push(readTags(tags));
  return 1;
};
Intuition.DisposeObject = (object) => { disposed.push(object); };
Intuition.GetScreenDrawInfo = () => FAKE_DRAWINFO;
Intuition.FreeScreenDrawInfo = () => { released++; };
Intuition.DrawImageState = (rastPort, image, left, top, state, drawInfo) => {
  drawn.push({
    rastPort: (rastPort && rastPort.ptr) || rastPort, image, left, top,
    state: Number(state), drawInfo,
  });
};

const VALUES_TAG = Led.ATTRS.values.tagID >>> 0;
const PAIRS_TAG  = Led.ATTRS.pairs.tagID >>> 0;

run('an array of values', () => {
  const before = outstanding.size;
  const led = new Led({ values: [12, 34, 56], colon: true });
  const tags = created[created.length - 1];

  ok(tags.get(PAIRS_TAG) === 3, 'LED_Pairs is the length of the array');

  const pointer = tags.get(VALUES_TAG);

  ok(pointer !== 0 && outstanding.get(pointer) === 6,
     'LED_Values points at 6 bytes: three WORDs');
  ok(wordsAt(pointer, 3).join() === '12,34,56',
     'the WORDs are 12, 34, 56: one per pair, not one byte per digit');

  setCalls = [];
  drawn = [];
  led.setValues([12, 34, 57]);

  ok(wordsAt(pointer, 3).join() === '12,34,57', 'setValues rewrites them');
  ok(setCalls.length === 1 && setCalls[0].get(VALUES_TAG) === pointer,
     'and hands the class the same pointer again');
  ok(drawn.length === 0, 'not in a window: nothing is drawn');

  led.setValues([1]);
  ok(wordsAt(pointer, 3).join() === '1,0,0', 'missing values are 0');

  led.dispose();
  ok(disposed.includes(FAKE_IMAGE), 'dispose() disposes the image');
  ok(outstanding.size === before, 'and frees the WORD array');
});

run('in an open window, setValues draws', () => {
  /* A stand-in struct Window: zeroes, but for the two pointers the
   * wrapper follows. The offsets are the Window wrapper's own. */
  const windowMemory = real.allocMem(STAND_IN_WINDOW_BYTES);

  amiga.poke32(windowMemory + Window.OFFSET.WScreen, FAKE_SCREEN);
  amiga.poke32(windowMemory + Window.OFFSET.RPort, FAKE_RASTPORT);

  const led = new Led({ pairs: 2, values: [0, 0] });

  /* as if a Reaction window that is open held the image */
  led._parent = { _intuiWindow: { ptr: windowMemory }, _parent: null };

  drawn = [];
  released = 0;
  led.setValues([4, 2]);

  ok(drawn.length === 1, 'DrawImageState is called once');
  ok(drawn.length === 1 && drawn[0].image === FAKE_IMAGE &&
     drawn[0].rastPort === FAKE_RASTPORT,
     "with the image and the window's RastPort");
  ok(drawn.length === 1 && drawn[0].left === 0 && drawn[0].top === 0 &&
     drawn[0].state === Number(Intuition.consts.IDS_NORMAL) &&
     drawn[0].drawInfo === FAKE_DRAWINFO,
     'at offset 0,0, IDS_NORMAL, with the screen DrawInfo (as LED.c does)');
  ok(released === 1, 'and the DrawInfo is given back');

  drawn = [];
  led.set({ colon: true });
  ok(drawn.length === 1, 'set() of any attribute draws as well');

  led._parent = null;
  led.dispose();
  real.freeMem(windowMemory, STAND_IN_WINDOW_BYTES);
});

run('limits and pointers', () => {
  let message = null;

  try { new Led({ values: [1, 2, 3, 4, 5, 6, 7, 8, 9] }); }
  catch (error) { message = error.message; }
  ok(message !== null && /1 to 8/.test(message),
     'nine pairs are refused: ' + message);

  /* a pointer is passed through, and stays the caller's */
  const own = real.allocMem(4);
  const before = outstanding.size;
  const led = new Led({ pairs: 2, values: own });

  ok(created[created.length - 1].get(VALUES_TAG) === own,
     'a pointer for values is passed through');

  message = null;
  try { led.setValues([1, 2]); } catch (error) { message = error.message; }
  ok(message !== null, 'setValues refuses then: ' + message);

  led.dispose();
  ok(outstanding.size === before, 'and dispose() does not free it');
  real.freeMem(own, 4);
});

/* put everything back, so that exit clean-up talks to the real thing */
Object.assign(amiga, {
  openLibrary: real.openLibrary, closeLibrary: real.closeLibrary,
  call: real.call, allocMem: real.allocMem, freeMem: real.freeMem,
});
Object.assign(Intuition, {
  NewObjectA: real.NewObjectA, SetAttrsA: real.SetAttrsA,
  DisposeObject: real.DisposeObject,
  GetScreenDrawInfo: real.GetScreenDrawInfo,
  FreeScreenDrawInfo: real.FreeScreenDrawInfo,
  DrawImageState: real.DrawImageState,
});

print('');
print('=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
std.out.flush();
if (fail > 0) std.exit(1);
