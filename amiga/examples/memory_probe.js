/*
 * memory_probe.js - print how much memory of each kind is free.
 *
 * Nothing opens: the script prints a small table on the Shell with one
 * row per kind of memory (public, chip, fast, any) and three columns:
 * free now, the largest single free block, and the total installed. Give
 * it a number to get that many tables, half a second apart, and watch
 * the figures move while something else is running.
 *
 * Assumptions:
 *   - asking for more than one table needs timer.device, which is in
 *     every Kickstart ROM; one table needs nothing but exec.library
 *   - the pause between tables comes from the vertical-blank timer
 *     unit, so it is accurate to about a fiftieth of a second
 *   - there is no way to stop early: the script runs until it has
 *     printed the number of tables asked for
 *
 * Requires quickjs.library 0.134+.
 * Run: qjs examples/memory_probe.js [iterations=1]
 */

import * as std from 'qjs:std';

if (typeof Exec !== 'function') {
  print('Q2 wrappers unavailable - need quickjs.library 0.134+');
  std.exit(1);
}

const E = Exec.consts;

/** How many tables to print. */
const iterations = scriptArgs && scriptArgs[1]
                 ? parseInt(scriptArgs[1], 10)
                 : 1;

/** The kinds of memory reported, one row each. The names are padded
 *  to the same length so the columns line up. */
const MEMORY_KINDS = [
  { name: 'PUBLIC', flag: E.MEMF_PUBLIC },
  { name: 'CHIP  ', flag: E.MEMF_CHIP   },
  { name: 'FAST  ', flag: E.MEMF_FAST   },
  { name: 'ANY   ', flag: E.MEMF_ANY    },
];

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

/** Width of one column of the table, in characters. */
const COLUMN_WIDTH = 12;

/** The pause between tables, in microseconds: half a second. */
const PAUSE_MICROSECONDS = 500000;

/**
 * Format a byte count as B, KB or MB, right-aligned in a column.
 *
 * @param {number} bytes
 * @returns {string} COLUMN_WIDTH characters, or more if it will not fit
 */
function formatBytes(bytes) {
  let units, value;

  if (bytes >= BYTES_PER_MB) {
    units = 'MB';
    value = (bytes / BYTES_PER_MB).toFixed(2);
  }
  else if (bytes >= BYTES_PER_KB) {
    units = 'KB';
    value = (bytes / BYTES_PER_KB).toFixed(2);
  }
  else {
    units = 'B';
    value = bytes.toString();
  }

  return (value + ' ' + units).padStart(COLUMN_WIDTH);
}

/**
 * Print one table: a heading, then a row for each kind of memory.
 *
 * @returns {undefined}
 */
function reportSnapshot() {
  print('                Available        Largest          Total');

  for (let { name, flag } of MEMORY_KINDS) {
    /* AvailMem answers a different question depending on which extra
     * flag is ORed in: none for free bytes, MEMF_LARGEST for the
     * biggest free block, MEMF_TOTAL for the amount installed. */
    let available = Exec.AvailMem(flag);
    let largest   = Exec.AvailMem(flag | E.MEMF_LARGEST);
    let total     = Exec.AvailMem(flag | E.MEMF_TOTAL);

    print('  ' + name + '  ' + formatBytes(available) + '  ' +
          formatBytes(largest) + '  ' + formatBytes(total));
  }
}

/**
 * Print the remaining tables, numbered from 2, with a pause before
 * each. The pause is a timer.device request sent with DoIO, which
 * sleeps until the time is up.
 *
 * @param {number} lastTick - the number of the last table to print
 * @returns {undefined}
 */
function reportFurtherSnapshots(lastTick) {
  const TimerRequest = amiga.devices.TimerRequest;

  /** timer.device's units and commands, by their header names. */
  const T = TimerRequest.consts;

  let port = new MsgPort(Exec.CreateMsgPort());

  /* CreateMsgPort gives 0 when there is no memory or no signal bit
   * left; a request sent to a port at address 0 would never return. */
  if (!port.ptr) {
    print('CreateMsgPort failed');
    std.exit(1);
  }

  let request = new TimerRequest();
  request.replyPort  = port.ptr;
  request.messageLen = TimerRequest.SIZE;

  let openError = Exec.OpenDevice('timer.device', T.UNIT_VBLANK, request, 0);

  if (openError !== 0) {
    print('OpenDevice failed rc=' + openError);
    Exec.DeleteMsgPort(port);
    request.free();
    std.exit(1);
  }

  try {
    for (let tick = 2; tick <= lastTick; tick++) {
      request.command = T.TR_ADDREQUEST;
      request.setTimeval(0, PAUSE_MICROSECONDS);
      Exec.DoIO(request);

      print('');
      print('--- Tick ' + tick + ' ---');
      reportSnapshot();
    }
  }
  finally {
    Exec.CloseDevice(request);
    Exec.DeleteMsgPort(port);
    request.free();
  }
}

print('--- Memory report ---');
reportSnapshot();

if (iterations > 1) reportFurtherSnapshots(iterations);

print('');
print('Done.');
