/* amiga/tests/test_persistence.js
 *
 * Saving and loading a text file the way the examples do it
 * (todo_demo.js, notes_demo.js): std.open(path, 'w') + puts() + close()
 * to save; std.open(path, 'r') + readAsString() + close() to load.
 *
 * Checks that what is loaded is what was saved: a to-do list of ten
 * items in order, an empty file, a long file, accented text, and what
 * opening a missing file gives.
 *
 * Until 0.231 the examples loaded with readAsString(4096) in a loop.
 * The size is in bytes and the file is UTF-8, so an accented letter
 * (two bytes) lying across a 4096-byte boundary was read as two
 * broken halves. The last accented check here is that case: it fails
 * with the old loop (kept below as loadInChunks, to show it) and
 * passes with a whole-file read.
 *
 * Writes to T:, which exists on every Amiga and under vamos.
 * Run: qjs tests/test_persistence.js
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

/** The file every check writes and reads. */
const PATH = 'T:test_persistence.tmp';

/** The chunk size the examples used to read with, in bytes. */
const OLD_READ_CHUNK = 4096;

/**
 * Save text as the examples do.
 *
 * @param {string} text
 * @returns {boolean} false if the file could not be opened
 */
function save(text) {
  let file = std.open(PATH, 'w');
  if (!file) return false;

  file.puts(text);
  file.close();
  return true;
}

/**
 * Load the file as the examples do.
 *
 * @returns {?string} the text, or null if the file could not be opened
 */
function load() {
  let file = std.open(PATH, 'r');
  if (!file) return null;

  let text = file.readAsString();

  file.close();
  return text;
}

/**
 * Load the file as the examples did until 0.231: a fixed number of
 * bytes at a time.
 *
 * @returns {string} the text, damaged where a chunk ended inside a
 *   character
 */
function loadInChunks() {
  let file = std.open(PATH, 'r');
  let text = '';
  let chunk;

  while ((chunk = file.readAsString(OLD_READ_CHUNK)).length > 0) {
    text += chunk;
  }

  file.close();
  return text;
}

/**
 * Save, load, and report whether the text came back unchanged.
 *
 * @param {string} text
 * @param {string} what - names the case in the output
 * @returns {undefined}
 */
function roundTrip(text, what) {
  ok(save(text), what + ': saved');

  let back = load();

  ok(back === text, what + ': loaded text is identical (' +
     (back === null ? 'null' : back.length) + ' of ' + text.length +
     ' characters)');
}

print('\n-- a to-do list of ten items --');

const TASKS = [];
for (let number = 1; number <= 10; number++) {
  TASKS.push((number % 3 === 0 ? '[X] ' : '[ ] ') + 'task number ' + number);
}

roundTrip(TASKS.join('\n') + '\n', 'ten items');

let lines = (load() || '').split('\n').filter((line) => line.length > 0);

ok(lines.length === 10, 'ten lines come back');
ok(lines.join('|') === TASKS.join('|'), 'in the order they were saved');
ok(lines[2].startsWith('[X]') && lines[0].startsWith('[ ]'),
   'with their done marks');

print('\n-- edge cases --');

roundTrip('', 'an empty file');
roundTrip('no line end at the end', 'text without a final newline');

let long = '';
for (let line = 0; line < 400; line++) {
  long += 'line ' + line + ' of a file longer than one chunk\n';
}
ok(long.length > 2 * OLD_READ_CHUNK, 'the long text is several old chunks long');
roundTrip(long, 'a long file');

/* 'caf\u00e9 ' is six bytes in the file: c a f, two for the e-acute,
 * and the space. Repeated from the start of the file, the 683rd
 * e-acute occupies bytes 4095 and 4096: one each side of the old
 * chunk boundary. */
const WORD = 'caf\u00e9 ';
let accented = '';
for (let round = 0; round < 1200; round++) accented += WORD;

roundTrip(accented, 'accented text across byte ' + OLD_READ_CHUNK);
ok(loadInChunks() !== accented,
   'the old ' + OLD_READ_CHUNK + '-byte loop damages that text ' +
   '(which is why the examples no longer use it)');

print('\n-- replacing and missing files --');

save('a long first version of the file\n');
save('short\n');
ok(load() === 'short\n', "'w' replaces the file; nothing of the old one is left");

os.remove(PATH);
let missing;
let threw = false;
try { missing = std.open(PATH, 'r'); }
catch (error) { threw = true; }
ok(!threw && missing === null,
   'opening a missing file gives null and does not throw');

print('');
print('=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
std.out.flush();
if (fail > 0) std.exit(1);
