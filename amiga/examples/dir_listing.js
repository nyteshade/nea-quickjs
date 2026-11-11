/*
 * dir_listing.js - list a directory, the way the Dir command does.
 *
 * Prints one line for each entry in a directory: F or D for file or
 * drawer, the size in bytes, and the name. With no argument it lists
 * SYS:.
 *
 *   -- Directory "SYS:" (Workbench) --
 *     D      -  Devs
 *     F       1234  Disk.info
 *     ...
 *   -- 20 entries --
 *
 * This is the classic dos.library walk: Lock the directory, Examine
 * it, then call ExNext until it says there is nothing more, and
 * UnLock. Each call fills in a FileInfoBlock, read here through a
 * struct wrapper.
 *
 * Assumptions:
 *   - SYS: exists, when no directory is named
 *   - Examine and ExNext are not in the Dos wrapper, so they are
 *     called by library offset through amiga.call(); the offsets come
 *     from the amiga.dos.lvo table, not from numbers typed here
 *   - the directory holds only files and drawers; a link is listed as
 *     whichever of the two the sign of its entry type suggests
 *   - ExNext returning zero is taken to mean "no more entries",
 *     without asking IoErr() whether it was really an error
 *
 * Requires quickjs.library 0.134+.
 * Run: qjs examples/dir_listing.js [directory=SYS:]
 */

import * as std from 'qjs:std';

if (typeof FileInfoBlock !== 'function' || typeof Dos !== 'function') {
  print('Q2 wrappers unavailable - need quickjs.library 0.134+');
  std.exit(1);
}

/** The directory to list: the first argument, or SYS:. */
const directory = scriptArgs && scriptArgs[1] ? scriptArgs[1] : 'SYS:';

/** Lock mode that lets others read the directory too. SHARED_LOCK,
 *  also called ACCESS_READ, from dos/dos.h. */
const SHARED_LOCK = -2;

/** How wide the size column is for a file, in characters. */
const SIZE_COLUMN_WIDTH = 10;

/** What a drawer shows in place of a size. */
const NO_SIZE = '     -';

/**
 * Get a shared lock on a directory.
 *
 * @param {string} path - an AmigaDOS path
 * @returns {number} the lock (a BPTR), or 0 if it could not be had
 */
function lockSharedFor(path) {
  return Dos.Lock(path, SHARED_LOCK);
}

/**
 * dos.library Examine(): fill `fileInfo` with details of the object
 * the lock is on.
 *
 * @param {number} lock - a lock (BPTR) from lockSharedFor()
 * @param {FileInfoBlock} fileInfo - filled in by the call
 * @returns {number} non-zero if it worked
 */
function examine(lock, fileInfo) {
  return amiga.call(
    Dos.ensureLibrary(),
    amiga.dos.lvo.Examine,
    { d1: lock | 0, d2: fileInfo.ptr | 0 }
  );
}

/**
 * dos.library ExNext(): fill `fileInfo` with details of the next
 * entry in the directory. It must be the same block that Examine, or
 * the previous ExNext, filled in.
 *
 * @param {number} lock - the directory's lock (BPTR)
 * @param {FileInfoBlock} fileInfo - read, then filled in again
 * @returns {number} non-zero for an entry, 0 after the last one
 */
function exNext(lock, fileInfo) {
  return amiga.call(
    Dos.ensureLibrary(),
    amiga.dos.lvo.ExNext,
    { d1: lock | 0, d2: fileInfo.ptr | 0 }
  );
}

/**
 * Whether the entry a FileInfoBlock describes is a drawer. Entry
 * types above zero are directories; below zero, files.
 *
 * @param {FileInfoBlock} fileInfo
 * @returns {boolean}
 */
function isDrawer(fileInfo) {
  return fileInfo.dirEntryType > 0;
}

let lock = lockSharedFor(directory);

if (!lock) {
  print('Cannot lock ' + directory + ' (check it exists and is readable)');
  std.exit(1);
}

let fileInfo = new FileInfoBlock();

try {
  if (!examine(lock, fileInfo)) {
    print('Examine failed on ' + directory);
    std.exit(1);
  }

  /* The first Examine describes the directory itself, so it makes the
   * heading. */
  let kind = isDrawer(fileInfo) ? 'Directory' : 'File';

  print('-- ' + kind + ' "' + directory + '" (' + fileInfo.fileName +
        ') --');

  if (fileInfo.dirEntryType <= 0) {
    print('(Path points at a file; size=' + fileInfo.size + ')');
    std.exit(0);
  }

  let count = 0;

  while (exNext(lock, fileInfo)) {
    let tag  = isDrawer(fileInfo) ? 'D' : 'F';
    let size = isDrawer(fileInfo)
      ? NO_SIZE
      : String(fileInfo.size).padStart(SIZE_COLUMN_WIDTH);

    print('  ' + tag + ' ' + size + '  ' + fileInfo.fileName);

    count++;
  }

  print('-- ' + count + ' entries --');
}
finally {
  fileInfo.free();
  Dos.UnLock(lock);
}
