/* scripts/check_examples_prelude.js
 *
 * Loaded (qjs -I) before an example by scripts/check_examples.py, to
 * run the example under vamos, which has no intuition.library and no
 * Reaction classes. It makes the example believe they exist, up to the
 * moment a window, screen or requester would open:
 *
 *   - amiga.openLibrary() of anything but the libraries vamos really
 *     implements returns a pretend base (vamos would open any name
 *     and give a library whose every function returns 0);
 *   - amiga.call() on a pretend base returns the address of a block of
 *     zeroed memory, so "allocations" succeed and every structure read
 *     from the result gives 0;
 *   - amiga.doMethod() on a pretend object returns 0;
 *   - a call that opens a window, screen or requester prints the
 *     marker line and throws the marker error instead.
 *
 * Everything up to that point is the example's own code and the real
 * wrappers: a misspelt constant, a wrapper that is not there, or a
 * name that is not defined fails as it would on an Amiga.
 *
 * The placeholder that VALUES is set to below is replaced by
 * check_examples.py with the method IDs read from the NDK headers, so
 * none is typed here.
 */
(function () {
  'use strict';

  const VALUES = __CHECK_EXAMPLES_VALUES__;

  /** What the checker looks for in the output. */
  const MARKER = 'CHECK-EXAMPLES-OPEN';

  /** Bytes of zeroed memory every pretend call's result points into. */
  const SCRATCH_BYTES = 32768;

  /** Library functions that put something on the screen, by library. */
  const OPENERS = {
    'intuition.library': ['OpenWindow', 'OpenWindowTagList', 'OpenScreen',
                          'OpenScreenTagList', 'AutoRequest',
                          'EasyRequestArgs', 'BuildEasyRequestArgs',
                          'Request', 'BuildSysRequest'],
    'asl.library':       ['AslRequest', 'RequestFile'],
  };

  /** The libraries vamos implements well enough to call for real. */
  const REAL_LIBRARIES = ['exec.library', 'dos.library', 'utility.library'];

  /** Methods that put something on the screen. */
  const OPENING_METHODS = [VALUES.WM_OPEN, VALUES.RM_OPENREQ];

  const real = {
    openLibrary:  amiga.openLibrary,
    closeLibrary: amiga.closeLibrary,
    call:         amiga.call,
    doMethod:     amiga.doMethod,
    freeMem:      amiga.freeMem,
  };

  /** Pretend library base -> library name. */
  const pretend = new Map();

  const scratch = amiga.allocMem(SCRATCH_BYTES);
  /* Results point at the middle, so that a negative offset (the class
   * pointer in front of a BOOPSI object) is still inside the block. */
  const result  = scratch + SCRATCH_BYTES / 2;

  /**
   * Whether an address lies inside the scratch block.
   *
   * @param {number} address
   * @returns {boolean}
   */
  function isScratch(address) {
    address = address >>> 0;
    return address >= scratch && address < scratch + SCRATCH_BYTES;
  }

  /**
   * Report that the example reached the point of opening something,
   * and stop it there.
   *
   * @param {string} what - the call or method that would have opened it
   * @returns {never}
   * @throws {Error} always
   */
  function stopAt(what) {
    print(MARKER + ' ' + what);
    throw new Error(MARKER + ' ' + what);
  }

  /**
   * The name of a library function, from the library's offset table.
   *
   * @param {string} library - e.g. 'intuition.library'
   * @param {number} lvo - the function's offset
   * @returns {string|undefined}
   */
  function functionName(library, lvo) {
    const table = amiga[library.replace(/\.library$/, '')];

    if (!table || !table.lvo) return undefined;

    for (const name of Object.keys(table.lvo)) {
      if (table.lvo[name] === lvo) return name;
    }

    return undefined;
  }

  amiga.openLibrary = function (name, version) {
    if (REAL_LIBRARIES.includes(name)) {
      return real.openLibrary(name, version);
    }

    const fake = amiga.allocMem(16);

    pretend.set(fake, name);
    return fake;
  };

  amiga.closeLibrary = function (base) {
    if (pretend.has(base)) return undefined;

    return real.closeLibrary(base);
  };

  amiga.call = function (base, lvo, regs) {
    const library = pretend.get(base);

    if (library === undefined) return real.call(base, lvo, regs);

    const name = functionName(library, lvo);

    if (name !== undefined && (OPENERS[library] || []).includes(name)) {
      stopAt(name);
    }

    return result;
  };

  amiga.doMethod = function (object, message) {
    if (!isScratch(object)) return real.doMethod(object, message);

    const method = message ? amiga.peek32(message) : 0;

    if (OPENING_METHODS.includes(method)) {
      stopAt(method === VALUES.WM_OPEN ? 'WM_OPEN' : 'RM_OPENREQ');
    }

    return 0;
  };

  /* An example may free what a pretend library "allocated". */
  amiga.freeMem = function (pointer, size) {
    if (isScratch(pointer)) return undefined;

    return real.freeMem(pointer, size);
  };
})();
