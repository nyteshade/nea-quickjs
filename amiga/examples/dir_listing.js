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
 * Requires quickjs.library 0.221+.
 * Run: qjs examples/dir_listing.js [directory=SYS:]
 */

import * as std from 'qjs:std';

/* Dos.consts.SHARED_LOCK arrived in 0.221; its presence is the test
 * for a new enough library. */
if (typeof FileInfoBlock !== 'function' || typeof Dos !== 'function' ||
    !('SHARED_LOCK' in Dos.consts)) {
  print('Need quickjs.library 0.221 or later');
  std.exit(1);
}

/** The directory to list: the first argument, or SYS:. */
const directory = scriptArgs && scriptArgs[1] ? scriptArgs[1] : 'SYS:';

/** Lock mode that lets others read the directory too (dos/dos.h;
 *  ACCESS_READ is another name for it). */
const SHARED_LOCK = Dos.consts.SHARED_LOCK;

/** How wide the size column is for a file, in characters. */
const SIZE_COLUMN_WIDTH = 10;

/** What a drawer shows in place of a size: a dash where the last
 *  digit of a size would be, so the two kinds of row line up. */
const NO_SIZE = '-'.padStart(SIZE_COLUMN_WIDTH);

/** What the script hands back to the Shell. */
const EXIT_OK      = 0;
const EXIT_FAILURE = 1;

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

/**
 * Print the listing of a locked directory.
 *
 * It returns instead of calling std.exit(), because std.exit() ends
 * the script on the spot: the caller's `finally`, which gives back the
 * lock and the FileInfoBlock, would never run.
 *
 * @param {number} lock - the directory's lock (BPTR)
 * @param {FileInfoBlock} fileInfo - scratch space for the entries
 * @returns {number} EXIT_OK or EXIT_FAILURE
 */
function printListing(lock, fileInfo) {
  if (!examine(lock, fileInfo)) {
    print('Examine failed on ' + directory);
    return EXIT_FAILURE;
  }

  /* The first Examine describes the directory itself, so it makes the
   * heading. */
  let kind = isDrawer(fileInfo) ? 'Directory' : 'File';

  print('-- ' + kind + ' "' + directory + '" (' + fileInfo.fileName +
        ') --');

  if (!isDrawer(fileInfo)) {
    print('(Path points at a file; size=' + fileInfo.size + ')');
    return EXIT_OK;
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
  return EXIT_OK;
}

let lock = lockSharedFor(directory);

if (!lock) {
  print('Cannot lock ' + directory + ' (check it exists and is readable)');
  std.exit(EXIT_FAILURE);
}

let fileInfo = new FileInfoBlock();
let exitCode = EXIT_FAILURE;

try {
  exitCode = printListing(lock, fileInfo);
}
finally {
  fileInfo.free();
  Dos.UnLock(lock);
}

if (exitCode !== EXIT_OK) std.exit(exitCode);
