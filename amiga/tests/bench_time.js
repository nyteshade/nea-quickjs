/*
 * bench_time.js - time qjs on this machine and compare library versions.
 *
 * AmigaDOS has no precise stopwatch for a command, so this script is
 * one. It times two things with the system clock (os.now, which counts
 * microseconds):
 *
 *   start-up    how long a whole `qjs` run takes for a script that
 *               does nothing, one that uses Intuition, and one that
 *               uses the Reaction classes. Each is run several times
 *               as a separate program.
 *   throughput  eight small loops (integers, floats, properties,
 *               arrays, calls, strings, allocation, a regular
 *               expression). Each is repeated until it has run for
 *               about half a second, and reported as loop iterations
 *               per second, so a slow machine does not wait minutes.
 *
 * Results are kept in the file qjs-bench.json in the current
 * directory, under the label given on the command line. Run it once
 * per library version (install the library, flush or reboot, run) and
 * the table at the end compares every label recorded so far against
 * the first one.
 *
 * Assumptions:
 *   - `qjs` is on the command path (start-up is timed by running it)
 *   - the current directory is writable
 *   - nothing else is busy on the machine; with an emulator, JIT off
 *     gives figures closest to real hardware
 *   - the first run after a cold boot also loads quickjs.library from
 *     disk; that first start-up time is reported separately
 *
 * Works with quickjs.library 0.208 and later.
 * Run: qjs tests/bench_time.js <label>      e.g.  qjs tests/bench_time.js 0.228
 */

import * as os from 'qjs:os';
import * as std from 'qjs:std';

const RESULTS_FILE = 'qjs-bench.json';

/** How long each throughput loop should run for, in microseconds. */
const TARGET_MICROSECONDS = 500000;

/** How many times each start-up command is run. */
const STARTUP_RUNS = 5;

const MICROSECONDS_PER_MILLISECOND = 1000;
const MICROSECONDS_PER_SECOND      = 1000000;

const label = (scriptArgs && scriptArgs[1]) || 'unlabelled';

/** The commands whose whole run is timed. */
const STARTUP_COMMANDS = [
  ['start: empty',     'qjs -e "1"'],
  ['start: Intuition', 'qjs -e "typeof Intuition"'],
  ['start: Reaction',  'qjs -e "typeof amiga.boopsi"'],
];

/**
 * The throughput loops. Each takes the number of iterations and
 * returns a value, so the work cannot be skipped.
 */
const LOOPS = [
  ['integers', function (count) {
    let sum = 0;

    for (let index = 0; index < count; index++) {
      sum = (sum + index * 3) ^ (index >> 2);
    }

    return sum;
  }],

  ['floats', function (count) {
    let value = 0.5;
    let sum   = 0.25;

    for (let index = 0; index < count; index++) {
      value = value * 1.000001 + 0.25;
      sum   = sum + value / 3.5 - 0.125;
    }

    return sum;
  }],

  ['properties', function (count) {
    const object = { a: 1, b: 2, c: 3 };

    for (let index = 0; index < count; index++) {
      object.a = object.b + object.c;
      object.c = object.a - index;
    }

    return object.a + object.c;
  }],

  ['arrays', function (count) {
    const values = [];

    for (let index = 0; index < 256; index++) values.push(index);

    for (let index = 0; index < count; index++) {
      values[index & 255] = values[(index + 7) & 255] + 1;
    }

    return values[0];
  }],

  ['calls', function (count) {
    /**
     * @param {number} left
     * @param {number} right
     * @returns {number} the sum
     */
    function add(left, right) { return left + right; }

    let sum = 0;

    for (let index = 0; index < count; index++) {
      sum = add(sum, index) | 0;
    }

    return sum;
  }],

  ['strings', function (count) {
    let text  = '';
    let total = 0;

    for (let index = 0; index < count; index++) {
      text += 'ab';

      if ((index & 63) === 63) {
        total += text.length;
        text = '';
      }
    }

    return total;
  }],

  ['allocation', function (count) {
    const ring = new Array(64);
    let total  = 0;

    for (let index = 0; index < count; index++) {
      const point = { x: index, y: index + 1 };

      ring[index & 63] = [point, index];
      total += point.y - point.x;
    }

    return total;
  }],

  ['regexp', function (count) {
    const pattern = /(\d+)-([a-z]+)/;
    const subject = 'abc 12345-hello xyz';
    let total     = 0;

    for (let index = 0; index < count; index++) {
      const match = pattern.exec(subject);

      total += match[1].length + match[2].length;
    }

    return total;
  }],
];

/**
 * Time one call of a loop.
 *
 * @param {function(number): number} loop - the loop to run
 * @param {number} count - iterations to ask for
 * @returns {number} microseconds taken
 */
function timeLoop(loop, count) {
  const before = os.now();

  loop(count);

  return os.now() - before;
}

/**
 * Find how fast a loop runs: double the iteration count until one run
 * takes long enough to measure, then keep the better of two runs.
 *
 * @param {function(number): number} loop - the loop to measure
 * @returns {number} iterations per second
 */
function measureLoop(loop) {
  let count   = 500;
  let elapsed = timeLoop(loop, count);

  while (elapsed < TARGET_MICROSECONDS) {
    count *= 2;
    elapsed = timeLoop(loop, count);
  }

  const second = timeLoop(loop, count);

  if (second < elapsed) elapsed = second;

  return Math.round(count * MICROSECONDS_PER_SECOND / elapsed);
}

/**
 * Run a command several times and time each run.
 *
 * @param {string} command - the command line
 * @returns {{first: number, best: number}|null} milliseconds for the
 *   first run and for the fastest of the rest, or null if commands
 *   cannot be run from here
 */
function measureCommand(command) {
  if (typeof child_process !== 'object' ||
      typeof child_process.execSync !== 'function') {
    return null;
  }

  const times = [];

  for (let run = 0; run < STARTUP_RUNS; run++) {
    const before = os.now();

    try {
      child_process.execSync(command);
    }
    catch (error) {
      return null;
    }

    times.push((os.now() - before) / MICROSECONDS_PER_MILLISECOND);
  }

  return {
    first: Math.round(times[0]),
    best:  Math.round(Math.min(...times.slice(1))),
  };
}

/**
 * Read the results recorded by earlier runs.
 *
 * @returns {Array<{label: string, values: object}>} oldest first
 */
function loadResults() {
  const file = std.open(RESULTS_FILE, 'r');

  if (!file) return [];

  const text = file.readAsString();

  file.close();

  try {
    return JSON.parse(text);
  }
  catch (error) {
    print('Ignoring ' + RESULTS_FILE + ': it is not valid JSON');

    return [];
  }
}

/**
 * Write the results back.
 *
 * @param {Array<{label: string, values: object}>} results - all labels
 * @returns {undefined}
 */
function saveResults(results) {
  const file = std.open(RESULTS_FILE, 'w');

  if (!file) {
    print('Cannot write ' + RESULTS_FILE + ' in the current directory');

    return;
  }

  file.puts(JSON.stringify(results, null, 1));
  file.close();
}

/**
 * Pad text with spaces to a width.
 *
 * @param {string} text - what to pad
 * @param {number} width - the least number of characters wanted
 * @param {boolean} [right=false] - true to align the text to the right
 * @returns {string}
 */
function pad(text, width, right = false) {
  let padding = '';

  for (let length = String(text).length; length < width; length++) {
    padding += ' ';
  }

  return right ? padding + text : text + padding;
}

/**
 * Print every recorded label side by side, each compared with the
 * first. For times, "x1.50" means one and a half times FASTER than the
 * first label (less time); for rates, one and a half times the
 * iterations per second.
 *
 * @param {Array<{label: string, values: object}>} results - all labels
 * @returns {undefined}
 */
function printTable(results) {
  const NAME_WIDTH   = 28;
  const COLUMN_WIDTH = 18;
  const base         = results[0].values;

  let header = pad('', NAME_WIDTH);

  for (const result of results) {
    header += pad(result.label, COLUMN_WIDTH, true);
  }

  print(header);

  for (const name of Object.keys(base)) {
    const isTime = name.endsWith('ms');
    let line     = pad(name, NAME_WIDTH);

    for (const result of results) {
      const value = result.values[name];

      if (value === undefined || value === null) {
        line += pad('-', COLUMN_WIDTH, true);
        continue;
      }

      let cell = String(value);

      if (result !== results[0] && base[name] && value) {
        const gain = isTime ? base[name] / value : value / base[name];

        cell += ' x' + gain.toFixed(2);
      }

      line += pad(cell, COLUMN_WIDTH, true);
    }

    print(line);
  }
}

print('Timing as "' + label + '". This takes a minute or two.');

const values = {};

for (const [name, command] of STARTUP_COMMANDS) {
  const measured = measureCommand(command);

  values[name + ', first ms'] = measured ? measured.first : null;
  values[name + ', best ms']  = measured ? measured.best  : null;

  print('  ' + pad(name, 20) + (measured
    ? measured.first + ' ms first, ' + measured.best + ' ms best'
    : 'could not run "' + command + '"'));
}

for (const [name, loop] of LOOPS) {
  const rate = measureLoop(loop);

  values[name + ' per second'] = rate;

  print('  ' + pad(name, 20) + rate + ' iterations per second');
}

const results = loadResults().filter((result) => result.label !== label);

results.push({ label, values });
saveResults(results);

print('');
print('Times are milliseconds (lower is better); the rest are loop');
print('iterations per second (higher is better). xN.NN compares with "' +
      results[0].label + '".');
print('');
printTable(results);
