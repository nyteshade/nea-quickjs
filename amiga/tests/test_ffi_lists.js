/* amiga/tests/test_ffi_lists.js
 *
 * Tests for what 0.232 moved onto shared, checked helpers:
 *
 *   1. amiga.exec.List / amiga.exec.Node: the one exec-list
 *      implementation of the wrappers. Checked against exec.library
 *      itself (AddTail, RemHead), so the test does not repeat the
 *      wrapper's own idea of the layout.
 *   2. The label lists of Chooser, ClickTab, RadioButton, ListBrowser
 *      and SpeedBar. The class library is replaced by a stand-in that
 *      allocates plain nodes and records the tags, so this part needs
 *      no Reaction and no window. It checks the order of the nodes,
 *      the text each one was given, that freeAll() frees every node
 *      exactly once, and that no memory is left behind.
 *   3. The wrapper calls that take a string (Dos.Open, Dos.Lock,
 *      IntuiText.text, NewWindow.title): they work, and a hundred
 *      rounds leave no memory behind.
 *   4. TextEditor's method messages: the bytes sent for each method.
 *
 * Opens no window. Needs quickjs.library 0.232+.
 * Run: qjs tests/test_ffi_lists.js
 */

import * as std from 'qjs:std';
import * as os from 'qjs:os';

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

/* Every block the wrappers take with amiga.allocMem and have not yet
 * given back with amiga.freeMem: pointer -> size. (Free memory as exec
 * reports it cannot be compared instead: the JavaScript heap grows
 * while the test runs.) */
const outstanding = new Map();

/** Blocks freed with a size other than the one they were allocated with. */
let wrongSizes = 0;

const realAllocMem = amiga.allocMem;
const realFreeMem  = amiga.freeMem;

amiga.allocMem = (size, flags) => {
  const pointer = realAllocMem(size, flags);

  if (pointer) outstanding.set(pointer, size);
  return pointer;
};

amiga.freeMem = (pointer, size) => {
  /* Blocks from elsewhere (a tag list made by the native makeTags) are
   * not in the map and are passed through. */
  if (outstanding.has(pointer)) {
    if (outstanding.get(pointer) !== size) wrongSizes++;
    outstanding.delete(pointer);
  }

  return realFreeMem(pointer, size);
};

/**
 * How many blocks are allocated and not freed right now. Compared
 * before and after a round trip to see whether it left any behind.
 *
 * @returns {number}
 */
function blocksHeld() {
  return outstanding.size;
}

if (typeof amiga.exec.List !== 'function' ||
    typeof amiga.exec.Node !== 'function') {
  print('FATAL: amiga.exec.List not available - library < 0.232?');
  std.exit(2);
}

const ExecList = amiga.exec.List;
const ExecNode = amiga.exec.Node;

/* ------------------------------------------------------------------
 * 1. The list itself, against exec.library
 * ------------------------------------------------------------------ */

run('exec list: empty', () => {
  let list = new ExecList();

  ok(list.isEmpty, 'a new list is empty');
  ok([...list.nodes()].length === 0, 'and has no nodes');
  ok(Exec.call(Exec.lvo.RemHead, { a0: list.ptr }) === 0,
     'exec RemHead agrees: nothing to remove');
  list.free();
  ok(list.ptr === 0, 'free() clears the pointer');
});

run('exec list: addTail, checked with exec RemHead', () => {
  let list  = new ExecList();
  let nodes = [0, 1, 2].map(() => amiga.allocMem(ExecNode.SIZE));

  for (let node of nodes) list.addTail(node);

  ok(!list.isEmpty, 'not empty after addTail');
  ok([...list.nodes()].join() === nodes.join(),
     'nodes() gives the three nodes in the order added');

  let removed = [];
  for (;;) {
    let node = Exec.call(Exec.lvo.RemHead, { a0: list.ptr });
    if (!node) break;
    removed.push(node);
  }

  ok(removed.join() === nodes.join(),
     'exec RemHead takes them off in the same order');
  ok(list.isEmpty, 'the list is empty again');

  for (let node of nodes) amiga.freeMem(node, ExecNode.SIZE);
  list.free();
});

run('exec list: nodes added by exec AddTail', () => {
  let list  = new ExecList();
  let nodes = [0, 1].map(() => amiga.allocMem(ExecNode.SIZE));

  list.addTail(nodes[0]);
  Exec.call(Exec.lvo.AddTail, { a0: list.ptr, a1: nodes[1] });

  ok([...list.nodes()].join() === nodes.join(),
     'nodes() sees a node that exec linked in');
  ok(new ExecNode(nodes[0]).succ === nodes[1], 'first.succ is the second');
  ok(new ExecNode(nodes[1]).pred === nodes[0], 'second.pred is the first');

  list.clear();
  ok(list.isEmpty, 'clear() empties it');

  for (let node of nodes) amiga.freeMem(node, ExecNode.SIZE);
  list.free();
});

/* ------------------------------------------------------------------
 * 2. Gadget label lists, with a stand-in class library
 * ------------------------------------------------------------------ */

/** What the stand-in library saw: filled by each test. */
let allocated = [];   /* { node, d0, tags: Map<tag, value> } */
let freed     = [];   /* node pointers */

/** Size of the nodes the stand-in hands out. */
const STAND_IN_NODE_BYTES = 32;

const realOpenLibrary  = amiga.openLibrary;
const realCloseLibrary = amiga.closeLibrary;
const realCall         = amiga.call;

/** The stand-in bases, so that calls on them are caught. */
const standIns = new Set();

/**
 * Read a TagItem array into a Map.
 *
 * @param {number} tags - pointer to the array
 * @returns {Map<number, number>} tag -> data
 */
function readTags(tags) {
  const result = new Map();

  for (let item = new TagItemReader(tags); item.tag !== 0; item.next()) {
    result.set(item.tag, item.data);
  }

  return result;
}

/** Walks a TagItem array: two ULONGs per item, tag then data. */
class TagItemReader {
  /** @param {number} pointer - the first item */
  constructor(pointer) { this.words = pointer; }

  /** @returns {number} the item's tag */
  get tag() { return amiga.peek32(this.words) >>> 0; }

  /** @returns {number} the item's data */
  get data() { return amiga.peek32(this.words + 4) >>> 0; }

  /** @returns {undefined} */
  next() { this.words += 8; }
}

/**
 * Replace the class libraries by a stand-in while body runs.
 *
 * @param {object} lvo - { alloc, free }: the library's node functions
 * @param {function(): undefined} body
 * @returns {undefined}
 */
function withStandInLibrary(lvo, body) {
  allocated = [];
  freed = [];

  amiga.openLibrary = (name, version) => {
    if (!/\.gadget$|\.image$/.test(name)) return realOpenLibrary(name, version);

    const base = amiga.allocMem(8);
    standIns.add(base);
    return base;
  };

  amiga.closeLibrary = (base) => {
    if (!standIns.has(base)) realCloseLibrary(base);
  };

  amiga.call = (base, offset, regs) => {
    if (!standIns.has(base)) return realCall(base, offset, regs);

    if (offset === lvo.alloc) {
      const node = amiga.allocMem(STAND_IN_NODE_BYTES);

      allocated.push({ node, d0: regs.d0, tags: readTags(regs.a0) });
      return node;
    }

    if (offset === lvo.free) {
      freed.push(regs.a0);
      amiga.freeMem(regs.a0, STAND_IN_NODE_BYTES);
      return 0;
    }

    /* XXX_GetClass and anything else: a non-zero "class pointer" */
    return base;
  };

  try { body(); }
  finally {
    amiga.openLibrary  = realOpenLibrary;
    amiga.closeLibrary = realCloseLibrary;
    amiga.call         = realCall;
  }
}

/**
 * The checks every label list must pass.
 *
 * @param {string} name - the gadget's name, for the messages
 * @param {function(): {listPtr: number, freeAll: function(): undefined}} build
 * @param {string[]} labels - the texts given
 * @param {number} textTag - the node attribute that carries the text
 * @returns {undefined}
 */
function checkLabelList(name, build, labels, textTag) {
  /* The first build opens the class (and may allocate things that are
   * kept for good), so memory is compared across a second one. */
  build().freeAll();
  allocated = [];
  freed = [];

  const before = blocksHeld();
  const built  = build();
  const onList = [...new ExecList(built.listPtr).nodes()];

  ok(allocated.length === labels.length,
     name + ': one node allocated per label');
  ok(onList.join() === allocated.map((entry) => entry.node).join(),
     name + ': the list holds those nodes, in order');
  ok(allocated.every((entry, index) =>
       amiga.peekString(entry.tags.get(textTag)) === labels[index]),
     name + ': each node was given its own text');

  built.freeAll();

  ok(freed.join() === onList.join(), name + ': freeAll() frees every node once');

  built.freeAll();

  ok(freed.length === onList.length, name + ': a second freeAll() does nothing');
  ok(blocksHeld() === before, name + ': no memory left behind');
}

const B = amiga.boopsi;
const LABELS = ['One', 'Two', 'Three', 'A longer label'];

run('label lists', () => {
  withStandInLibrary({ alloc: amiga.chooser.lvo.AllocChooserNodeA,
                       free:  amiga.chooser.lvo.FreeChooserNode }, () => {
    checkLabelList('Chooser', () => B.Chooser._buildLabelList(LABELS),
                   LABELS, B.CNA.Text);
  });

  withStandInLibrary({ alloc: amiga.clicktab.lvo.AllocClickTabNodeA,
                       free:  amiga.clicktab.lvo.FreeClickTabNode }, () => {
    checkLabelList('ClickTab', () => B.ClickTab._buildLabelList(LABELS),
                   LABELS, B.TNA.Text);
    ok(allocated.every((entry, index) =>
         entry.tags.get(B.TNA.Number) === index),
       'ClickTab: TNA_Number is the tab index');
  });

  withStandInLibrary({ alloc: amiga.radiobutton.lvo.AllocRadioButtonNodeA,
                       free:  amiga.radiobutton.lvo.FreeRadioButtonNode }, () => {
    B.RadioButton._buildLabelList(LABELS).freeAll();
    ok(allocated.length === LABELS.length && freed.length === LABELS.length,
       'RadioButton: one node per label, all freed');
    ok(allocated.every((entry) => entry.d0 === 1),
       'RadioButton: asks for one column (d0 = 1)');
  });

  withStandInLibrary({ alloc: amiga.listbrowser.lvo.AllocListBrowserNodeA,
                       free:  amiga.listbrowser.lvo.FreeListBrowserNode }, () => {
    B.ListBrowser._buildLabelList(LABELS).freeAll();
    ok(allocated.length === LABELS.length && freed.length === LABELS.length,
       'ListBrowser: one node per label, all freed');
    ok(allocated.every((entry) => entry.d0 === 1),
       'ListBrowser: asks for one column (d0 = 1)');
  });

  withStandInLibrary({ alloc: amiga.speedbar.lvo.AllocSpeedButtonNodeA,
                       free:  amiga.speedbar.lvo.FreeSpeedButtonNode }, () => {
    /* An image is given, so that no label.image has to be created. */
    const FAKE_IMAGE = 0x1000;
    const buttons = [
      { image: FAKE_IMAGE, help: 'first' },
      { image: FAKE_IMAGE, text: 'Second', toggle: true },
    ];
    const built = B.SpeedBar._buildButtonList(buttons);

    ok(allocated.length === 2, 'SpeedBar: one node per button');
    ok(allocated[0].d0 === 0 && allocated[1].d0 === 1,
       'SpeedBar: the ordinal (d0) is the button index');
    ok(allocated[0].tags.get(B.SBNA.Image) === FAKE_IMAGE,
       'SpeedBar: SBNA_Image carries the image pointer');
    ok(amiga.peekString(allocated[0].tags.get(B.SBNA.Help)) === 'first',
       'SpeedBar: SBNA_Help carries the help text');
    ok(amiga.peekString(allocated[1].tags.get(B.SBNA.Text)) === 'Second',
       'SpeedBar: SBNA_Text carries the text');
    ok(allocated[1].tags.get(B.SBNA.Toggle) === 1, 'SpeedBar: SBNA_Toggle set');

    built.freeAll();
    ok(freed.length === 2, 'SpeedBar: freeAll() frees both nodes');
  });
});

run('label list: a failed allocation leaks nothing', () => {
  let calls = 0;

  withStandInLibrary({ alloc: amiga.chooser.lvo.AllocChooserNodeA,
                       free:  amiga.chooser.lvo.FreeChooserNode }, () => {
    B.Chooser._buildLabelList(LABELS).freeAll();   /* class is open now */
    allocated = [];
    freed = [];

    const standInCall = amiga.call;

    /* the third AllocChooserNodeA fails */
    amiga.call = (base, offset, regs) => {
      if (offset === amiga.chooser.lvo.AllocChooserNodeA && ++calls === 3) {
        return 0;
      }
      return standInCall(base, offset, regs);
    };

    const before = blocksHeld();
    let message = null;

    try { B.Chooser._buildLabelList(LABELS); }
    catch (error) { message = error.message; }

    ok(message !== null && /Chooser/.test(message),
       'throws, naming the gadget: ' + message);
    ok(allocated.length === 2 && freed.length === 2,
       'the two nodes that were made are freed');
    ok(blocksHeld() === before, 'no memory left behind');
  });
});

/* ------------------------------------------------------------------
 * 3. Calls that take a string
 * ------------------------------------------------------------------ */

const ROUNDS = 100;

run('strings: dos and exec calls', () => {
  const NAME = 'T:test_ffi_lists.tmp';
  const D = Dos.consts;

  let file = Dos.Open(NAME, D.MODE_NEWFILE);
  ok(file !== 0, 'Dos.Open(string, MODE_NEWFILE) opens a file');
  if (file) Dos.Close(file);

  let lock = Dos.Lock(NAME, D.SHARED_LOCK);
  ok(lock !== 0, 'Dos.Lock(string) finds it');
  if (lock) Dos.UnLock(lock);

  ok(Dos.Lock('T:no-such-file-here', D.SHARED_LOCK) === 0,
     'Dos.Lock of a missing file gives 0');
  ok(Exec.FindTask(null) !== 0, 'Exec.FindTask(null) is this task');

  const before = blocksHeld();

  for (let round = 0; round < ROUNDS; round++) {
    let again = Dos.Lock(NAME, D.SHARED_LOCK);
    if (again) Dos.UnLock(again);
  }

  ok(blocksHeld() === before,
     ROUNDS + ' rounds of Lock leave no memory behind');

  os.remove(NAME);
});

run('strings: IntuiText.text and NewWindow.title', () => {
  const before = blocksHeld();

  let text = new IntuiText();

  text.text = 'first';
  ok(text.text === 'first', 'IntuiText.text reads back');
  text.text = 'a second, longer text';
  ok(text.text === 'a second, longer text', 'and can be replaced');
  text.text = null;
  ok(text.text === null, 'and cleared');
  text.text = 'third';
  text.free();

  let newWindow = new NewWindow();

  newWindow.title = 'Title';
  ok(newWindow.title === 'Title', 'NewWindow.title reads back');
  newWindow.title = 'Another title';
  ok(newWindow.title === 'Another title', 'and can be replaced');
  newWindow.free();

  ok(blocksHeld() === before, 'nothing left behind after free()');
});

/* ------------------------------------------------------------------
 * 4. TextEditor method messages
 * ------------------------------------------------------------------ */

run('TextEditor messages', () => {
  const FAKE_GADGET = 0x2000;
  const FAKE_WINDOW = 0x3000;
  const editor = new B.TextEditor(FAKE_GADGET);   /* wraps; creates nothing */
  const M = B.TextEditor.METHOD;

  /** @type {{gadget: number, window: number, words: number[], text: (string|null)}} */
  let sent = null;

  /** What the stand-in dispatcher returns. */
  let answer = 0;

  editor._findWindowPtr = () => FAKE_WINDOW;

  const realDoGadgetMethodA = Intuition.DoGadgetMethodA;

  /* Every one of these messages is a row of ULONG-sized fields, so it
   * is read back as an array of ULONGs; the third, where there is one,
   * is a C string in three of them. */
  Intuition.DoGadgetMethodA = (gadget, window, requester, message) => {
    const reader = new TagItemReader(message);
    const words = [];

    for (let pair = 0; pair < 3; pair++) {
      words.push(reader.tag, reader.data);
      reader.next();
    }

    sent = { gadget, window, words, text: null };

    if ([M.InsertText, M.ARexxCmd, M.Search].includes(words[0])) {
      sent.text = amiga.peekString(words[2]);
    }

    return (typeof answer === 'function') ? answer(words) : answer;
  };

  try {
    const before = blocksHeld();

    editor.clearText();
    ok(sent.words[0] === Number(M.ClearText) && sent.words[1] === 0,
       'clearText: { ClearText, GInfo 0 }');
    ok(sent.gadget === FAKE_GADGET && sent.window === FAKE_WINDOW,
       'sent to the gadget, with its window');

    editor.insertText('Hello', B.TextEditor.InsertPos.BOTTOM);
    ok(sent.words[0] === Number(M.InsertText) && sent.text === 'Hello' &&
       sent.words[3] === B.TextEditor.InsertPos.BOTTOM,
       'insertText: { InsertText, 0, "Hello", BOTTOM }');

    editor.insertText(null);
    ok(sent.text === '' && sent.words[3] === B.TextEditor.InsertPos.CURSOR,
       'insertText(null): empty text at the cursor');

    editor.arexxCmd('GOTOLINE 3');
    ok(sent.words[0] === Number(M.ARexxCmd) && sent.text === 'GOTOLINE 3',
       'arexxCmd: { ARexxCmd, 0, "GOTOLINE 3" }');

    answer = 1;
    ok(editor.search('needle', B.TextEditor.SearchFlags.FROM_TOP) === true &&
       sent.words[0] === Number(M.Search) && sent.text === 'needle' &&
       sent.words[3] === B.TextEditor.SearchFlags.FROM_TOP,
       'search: { Search, 0, "needle", FROM_TOP } and true when found');
    answer = 0;
    ok(editor.search('needle') === false, 'search: false when not found');

    editor.markText(1, 2, 3, 4);
    ok(sent.words.join() === [Number(M.MarkText), 0, 1, 2, 3, 4].join(),
       'markText: { MarkText, 0, 1, 2, 3, 4 }');

    /* BlockInfo: the class stores four ULONGs through the pointers. */
    answer = (words) => {
      for (let index = 0; index < 4; index++) {
        amiga.poke32(words[2 + index], 10 + index);
      }
      return 1;
    };
    let block = editor.blockInfo();
    ok(block && block.startX === 10 && block.startY === 11 &&
       block.stopX === 12 && block.stopY === 13,
       'blockInfo: reads back what the class stored');
    answer = 0;
    ok(editor.blockInfo() === null, 'blockInfo: null when nothing is marked');

    /* ExportText: the class returns an AllocVec()ed string that the
     * wrapper must free. */
    answer = () => {
      const text = Exec.AllocVec(8, Exec.consts.MEMF_ANY);
      amiga.pokeString(text, 'export');
      return text;
    };
    ok(editor.exportText() === 'export', 'exportText: returns the text');
    answer = 0;
    ok(editor.exportText() === '', 'exportText: empty when the class gives 0');

    ok(blocksHeld() === before, 'no memory left behind by any of them');

    editor._findWindowPtr = () => 0;
    let message = null;
    try { editor.insertText('x'); } catch (error) { message = error.message; }
    ok(message === 'TextEditor.insertText: window not open',
       'without a window: ' + message);
    ok(blocksHeld() === before, 'and that leaves nothing behind either');
  }
  finally {
    Intuition.DoGadgetMethodA = realDoGadgetMethodA;
  }
});

run('sizes', () => {
  ok(wrongSizes === 0,
     'every block was freed with the size it was allocated with');
});

print('');
print('=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
std.out.flush();
if (fail > 0) std.exit(1);
