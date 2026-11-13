/* quickjs-master/amiga/ffi/Dos.js
 *
 * Wrapper for dos.library. Pilot scope: ~20 of 161 LVOs covering
 * file I/O, locking, dates, exec.
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';

export class Dos extends LibraryBase {
  /** @type {string} */
  static libraryName = 'dos.library';

  /** @type {number} */
  static libraryVersion = 39;

  /** @type {Object<string, number>} */
  static lvo = globalThis.amiga.dos.lvo;

  /**
   * Common dos.library mode flags and seek origins.
   */
  static consts = CEnumeration.lazy('DosConsts', {
    /* consts-begin - written by scripts/gen_consts.py from the NDK headers; do not edit */
    /* Open() modes (dos/dos.h) */
    MODE_OLDFILE:   1005,
    MODE_NEWFILE:   1006,
    MODE_READWRITE: 1004,

    /* Seek() positions (dos/dos.h) */
    OFFSET_BEGINNING: -1,
    OFFSET_CURRENT:   0,
    OFFSET_END:       1,
    OFFSET_BEGINING:  -1,   /* OFFSET_BEGINNING */

    /* Lock() types (dos/dos.h) */
    SHARED_LOCK:    -2,
    ACCESS_READ:    -2,
    EXCLUSIVE_LOCK: -1,
    ACCESS_WRITE:   -1,

    /* Truth values (dos/dos.h) */
    DOSTRUE:  -1,
    DOSFALSE: 0,

    /* Return codes for a program (dos/dos.h) */
    RETURN_OK:    0,
    RETURN_WARN:  5,
    RETURN_ERROR: 10,
    RETURN_FAIL:  20,

    /* File protection bits (dos/dos.h) */
    FIBF_OTR_READ:    0x8000,   /* 1<<FIBB_OTR_READ */
    FIBF_OTR_WRITE:   0x4000,   /* 1<<FIBB_OTR_WRITE */
    FIBF_OTR_EXECUTE: 0x2000,   /* 1<<FIBB_OTR_EXECUTE */
    FIBF_OTR_DELETE:  0x1000,   /* 1<<FIBB_OTR_DELETE */
    FIBF_GRP_READ:    0x0800,   /* 1<<FIBB_GRP_READ */
    FIBF_GRP_WRITE:   0x0400,   /* 1<<FIBB_GRP_WRITE */
    FIBF_GRP_EXECUTE: 0x0200,   /* 1<<FIBB_GRP_EXECUTE */
    FIBF_GRP_DELETE:  0x0100,   /* 1<<FIBB_GRP_DELETE */
    FIBF_HOLD:        128,   /* 1<<FIBB_HOLD */
    FIBF_SCRIPT:      64,   /* 1<<FIBB_SCRIPT */
    FIBF_PURE:        32,   /* 1<<FIBB_PURE */
    FIBF_ARCHIVE:     16,   /* 1<<FIBB_ARCHIVE */
    FIBF_READ:        8,   /* 1<<FIBB_READ */
    FIBF_WRITE:       4,   /* 1<<FIBB_WRITE */
    FIBF_EXECUTE:     2,   /* 1<<FIBB_EXECUTE */
    FIBF_DELETE:      1,   /* 1<<FIBB_DELETE */

    /* IoErr() codes (dos/dos.h) */
    ERROR_NO_FREE_STORE:            103,
    ERROR_TASK_TABLE_FULL:          105,
    ERROR_BAD_TEMPLATE:             114,
    ERROR_BAD_NUMBER:               115,
    ERROR_REQUIRED_ARG_MISSING:     116,
    ERROR_KEY_NEEDS_ARG:            117,
    ERROR_TOO_MANY_ARGS:            118,
    ERROR_UNMATCHED_QUOTES:         119,
    ERROR_LINE_TOO_LONG:            120,
    ERROR_FILE_NOT_OBJECT:          121,
    ERROR_INVALID_RESIDENT_LIBRARY: 122,
    ERROR_NO_DEFAULT_DIR:           201,
    ERROR_OBJECT_IN_USE:            202,
    ERROR_OBJECT_EXISTS:            203,
    ERROR_DIR_NOT_FOUND:            204,
    ERROR_OBJECT_NOT_FOUND:         205,
    ERROR_BAD_STREAM_NAME:          206,
    ERROR_OBJECT_TOO_LARGE:         207,
    ERROR_ACTION_NOT_KNOWN:         209,
    ERROR_INVALID_COMPONENT_NAME:   210,
    ERROR_INVALID_LOCK:             211,
    ERROR_OBJECT_WRONG_TYPE:        212,
    ERROR_DISK_NOT_VALIDATED:       213,
    ERROR_DISK_WRITE_PROTECTED:     214,
    ERROR_RENAME_ACROSS_DEVICES:    215,
    ERROR_DIRECTORY_NOT_EMPTY:      216,
    ERROR_TOO_MANY_LEVELS:          217,
    ERROR_DEVICE_NOT_MOUNTED:       218,
    ERROR_SEEK_ERROR:               219,
    ERROR_COMMENT_TOO_BIG:          220,
    ERROR_DISK_FULL:                221,
    ERROR_DELETE_PROTECTED:         222,
    ERROR_WRITE_PROTECTED:          223,
    ERROR_READ_PROTECTED:           224,
    ERROR_NOT_A_DOS_DISK:           225,
    ERROR_NO_DISK:                  226,
    ERROR_NO_MORE_ENTRIES:          232,
    ERROR_IS_SOFT_LINK:             233,
    ERROR_OBJECT_LINKED:            234,
    ERROR_BAD_HUNK:                 235,
    ERROR_NOT_IMPLEMENTED:          236,
    ERROR_RECORD_NOT_LOCKED:        240,
    ERROR_LOCK_COLLISION:           241,
    ERROR_LOCK_TIMEOUT:             242,
    ERROR_UNLOCK_ERROR:             243,
    /* consts-end */
  });

  /**
   * Run fn with a string argument as a C string. dos.library reads a
   * name or command line during the call and keeps no pointer to it,
   * so the copy is freed as soon as fn returns.
   *
   * @internal
   * @template T
   * @param {string|number|null} text - a JS string, or a pointer the
   *   caller manages (passed through)
   * @param {function(number): T} fn - receives the C string pointer
   * @returns {T} whatever fn returns
   * @throws {Error} if the temporary copy cannot be allocated
   */
  static _withText(text, fn) {
    if (typeof text !== 'string') return fn(ptrOf(text));

    return globalThis.amiga.withString(text, fn);
  }

  /**
   * Open(name, accessMode) — d1=name, d2=accessMode.
   *
   * @param {string|number} name - file name, or a C string pointer
   * @param {number} accessMode - Dos.consts.MODE_OLDFILE etc.
   * @returns {number} the file handle (a BPTR), 0 on failure
   */
  static Open(name, accessMode) {
    return this._withText(name, (namePtr) =>
      this.call(this.lvo.Open, { d1: namePtr, d2: accessMode | 0 }));
  }

  static Close(file)  { return this.call(this.lvo.Close, { d1: file | 0 }); }
  static Input()      { return this.call(this.lvo.Input,  {}); }
  static Output()     { return this.call(this.lvo.Output, {}); }
  static IoErr()      { return this.call(this.lvo.IoErr,  {}); }

  static Read(file, buffer, length) {
    return this.call(this.lvo.Read, {
      d1: file | 0, d2: ptrOf(buffer), d3: length | 0,
    });
  }

  static Write(file, buffer, length) {
    return this.call(this.lvo.Write, {
      d1: file | 0, d2: ptrOf(buffer), d3: length | 0,
    });
  }

  static Seek(file, position, mode) {
    return this.call(this.lvo.Seek, {
      d1: file | 0, d2: position | 0, d3: mode | 0,
    });
  }

  /**
   * Lock(name, accessMode) — d1=name, d2=accessMode.
   *
   * @param {string|number} name - path, or a C string pointer
   * @param {number} accessMode - Dos.consts.SHARED_LOCK or
   *   EXCLUSIVE_LOCK
   * @returns {number} the lock (a BPTR), 0 on failure
   */
  static Lock(name, accessMode) {
    return this._withText(name, (namePtr) =>
      this.call(this.lvo.Lock, { d1: namePtr, d2: accessMode | 0 }));
  }

  static UnLock(lock) { return this.call(this.lvo.UnLock, { d1: lock | 0 }); }

  static DateStamp(ds) {
    return this.call(this.lvo.DateStamp, { d1: ptrOf(ds) });
  }

  static Delay(ticks) {
    return this.call(this.lvo.Delay, { d1: ticks | 0 });
  }

  /**
   * SystemTagList(command, tags) — d1=command, d2=tags. Runs a Shell
   * command line and waits for it.
   *
   * @param {string|number} cmd - command line, or a C string pointer
   * @param {number|null} tags - TagItem array, or null
   * @returns {number} the command's return code, -1 if it could not
   *   be run
   */
  static SystemTagList(cmd, tags) {
    return this._withText(cmd, (cmdPtr) =>
      this.call(this.lvo.SystemTagList, { d1: cmdPtr, d2: ptrOf(tags) }));
  }
}
