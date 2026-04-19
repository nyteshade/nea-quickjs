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
  static consts = class DosConsts extends CEnumeration {
    static {
      DosConsts.define('MODE_OLDFILE',     1005);
      DosConsts.define('MODE_NEWFILE',     1006);
      DosConsts.define('MODE_READWRITE',   1004);
      DosConsts.define('OFFSET_BEGINNING', -1);
      DosConsts.define('OFFSET_CURRENT',    0);
      DosConsts.define('OFFSET_END',        1);
      DosConsts.define('ACCESS_READ',      -2);
      DosConsts.define('ACCESS_WRITE',     -1);
    }
  };

  /**
   * Open(name, accessMode) — d1=name, d2=accessMode. Returns BPTR.
   * Accepts a JS string for `name` (allocates + frees a C copy).
   */
  static Open(name, accessMode) {
    let namePtr = ptrOf(name);
    let bytes = 0;

    if (typeof name === 'string') {
      bytes = name.length + 1;
      namePtr = globalThis.amiga.allocMem(bytes);
      globalThis.amiga.pokeString(namePtr, name);
    }

    try {
      return this.call(this.lvo.Open, {
        d1: namePtr, d2: accessMode | 0,
      });
    }

    finally {
      if (bytes) globalThis.amiga.freeMem(namePtr, bytes);
    }
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
   * Lock(name, accessMode) — accepts a JS string name.
   */
  static Lock(name, accessMode) {
    let namePtr = ptrOf(name);
    let bytes = 0;

    if (typeof name === 'string') {
      bytes = name.length + 1;
      namePtr = globalThis.amiga.allocMem(bytes);
      globalThis.amiga.pokeString(namePtr, name);
    }

    try {
      return this.call(this.lvo.Lock, {
        d1: namePtr, d2: accessMode | 0,
      });
    }

    finally {
      if (bytes) globalThis.amiga.freeMem(namePtr, bytes);
    }
  }

  static UnLock(lock) { return this.call(this.lvo.UnLock, { d1: lock | 0 }); }

  static DateStamp(ds) {
    return this.call(this.lvo.DateStamp, { d1: ptrOf(ds) });
  }

  static Delay(ticks) {
    return this.call(this.lvo.Delay, { d1: ticks | 0 });
  }

  static SystemTagList(cmd, tags) {
    let cmdPtr = ptrOf(cmd);
    let bytes = 0;

    if (typeof cmd === 'string') {
      bytes = cmd.length + 1;
      cmdPtr = globalThis.amiga.allocMem(bytes);
      globalThis.amiga.pokeString(cmdPtr, cmd);
    }

    try {
      return this.call(this.lvo.SystemTagList, {
        d1: cmdPtr, d2: ptrOf(tags),
      });
    }

    finally {
      if (bytes) globalThis.amiga.freeMem(cmdPtr, bytes);
    }
  }
}
