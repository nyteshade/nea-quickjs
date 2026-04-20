/*
 * dir_listing.js — List the contents of a directory using dos.library
 * Lock / Examine / ExNext, printing each entry's name, size, and
 * type (F/D) using the new FileInfoBlock struct wrapper.
 *
 * Demonstrates:
 *   - FileInfoBlock struct with BCPL-string decoding for fileName
 *     and comment
 *   - Raw-FFI escape hatch for dos.library LVOs that aren't in the
 *     Dos wrapper yet: Examine (-102) and ExNext (-108) via
 *     amiga.call(DOSBase, amiga.dos.lvo.Examine, {d1: lock, d2: fib.ptr})
 *   - The classic Lock('SYS:', SHARED_LOCK=-2) → Examine → loop of
 *     ExNext until it returns 0 → UnLock flow
 *
 * Pass a directory name on the command line, or defaults to SYS:.
 *
 * Run:        qjs examples/dir_listing.js [path]
 * Requires:   quickjs.library 0.134+
 */

import * as std from 'qjs:std';

if (typeof FileInfoBlock !== 'function' || typeof Dos !== 'function') {
  print('Q2 wrappers unavailable — need quickjs.library 0.134+');
  std.exit(1);
}

const path = scriptArgs && scriptArgs[1] ? scriptArgs[1] : 'SYS:';
const SHARED_LOCK = -2;

/**
 * Open a shared lock on `path`.
 *
 * @param   {string} path
 * @returns {number} BPTR lock, or 0 on failure
 */
function lockSharedFor(path) {
  return Dos.Lock(path, SHARED_LOCK);
}

/**
 * Call dos.Examine(lock, fib). Wrapper not yet present — use raw
 * call through amiga.call with the FD-derived LVO.
 *
 * @param   {number}        lock — BPTR
 * @param   {FileInfoBlock} fib
 * @returns {number} non-zero on success
 */
function examine(lock, fib) {
  return amiga.call(
    Dos.ensureLibrary(),
    amiga.dos.lvo.Examine,
    { d1: lock | 0, d2: fib.ptr | 0 }
  );
}

/**
 * Call dos.ExNext(lock, fib) to advance to the next entry.
 *
 * @param   {number}        lock — BPTR
 * @param   {FileInfoBlock} fib
 * @returns {number} 1 if another entry, 0 at end of directory
 */
function exNext(lock, fib) {
  return amiga.call(
    Dos.ensureLibrary(),
    amiga.dos.lvo.ExNext,
    { d1: lock | 0, d2: fib.ptr | 0 }
  );
}

let lock = lockSharedFor(path);

if (!lock) {
  print('Cannot lock ' + path + ' (check it exists and is readable)');
  std.exit(1);
}

let fib = new FileInfoBlock();

try {
  if (!examine(lock, fib)) {
    print('Examine failed on ' + path);
    std.exit(1);
  }

  /* The first Examine describes the directory itself — print a header. */
  let kind = fib.dirEntryType > 0 ? 'Directory' : 'File';

  print('-- ' + kind + ' "' + path + '" (' + fib.fileName + ') --');

  if (fib.dirEntryType <= 0) {
    print('(Path points at a file; size=' + fib.size + ')');
    std.exit(0);
  }
  
  print(fib)

  let count = 0;

  while (exNext(lock, fib)) {
    let tag = fib.dirEntryType > 0 ? 'D' : 'F';
    let size = fib.dirEntryType > 0 ? '     -' :
               String(fib.size).padStart(10);

    print('  ' + tag + ' ' + size + '  ' + fib.fileName);

    count++;
  }

  print('-- ' + count + ' entries --');
}

finally {
  fib.free();
  Dos.UnLock(lock);
}
