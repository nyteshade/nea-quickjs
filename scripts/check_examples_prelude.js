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
 * With VALUES.PAST_OPEN (check_examples.py --past-open) the script is
 * NOT stopped there. The window "opens", the code after it runs too
 * (setting the font, the first paint), and the script is stopped at
 * its first wait for a message instead. That reaches the names and
 * the calls of the drawing code; it says nothing about where anything
 * is drawn.
 *
 * Zeroed memory will not do for that: a window whose RastPort pointer
 * is 0 has no RastPort. So in this mode a pretend result points into
 * memory filled with one 16-bit value, chosen so that any pointer
 * read from it is the address of that same memory (see
 * selfPointingBlock). Every structure reached from the window is then
 * "there", and every size, border and font metric reads as that
 * 16-bit value: some dozens of pixels.
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

  /** exec.library functions that wait for, or take, a message: the
   *  start of an event loop. With PAST_OPEN the script stops at the
   *  first of these that comes after an opener. */
  const WAITERS = ['Wait', 'WaitPort', 'GetMsg'];

  /** True once something has "opened" under PAST_OPEN. */
  let opened = false;

  const real = {
    openLibrary:  amiga.openLibrary,
    closeLibrary: amiga.closeLibrary,
    call:         amiga.call,
    doMethod:     amiga.doMethod,
    freeMem:      amiga.freeMem,
  };

  /** Pretend library base -> library name. */
  const pretend = new Map();

  /** In a self-pointing block: bytes filled in front of the address
   *  handed out (for the class pointer in front of a BOOPSI object)
   *  and after it (the largest structure read is struct Screen, some
   *  350 bytes). */
  const FILLED_BEFORE = 256;
  const FILLED_AFTER  = 2048;

  /** Addresses whose two 16-bit halves are equal come this far apart:
   *  0x00430043, 0x00440044, ... */
  const SAME_HALVES_STEP = 0x10001;

  /**
   * Allocate memory in which any 32-bit value read at an even offset
   * is the address of the memory itself.
   *
   * An address like 0x00430043 has the same 16-bit value in both
   * halves. Fill memory around it with that value, 0x0043, and every
   * pointer read from there is 0x00430043 again, whether the field
   * sits on a 4-byte boundary or only a 2-byte one. A block of three
   * steps always has such an address with room on both sides.
   *
   * @returns {{block: number, bytes: number, address: number}} the
   *   allocation, its size, and the self-pointing address inside it
   */
  function selfPointingBlock() {
    const bytes = 3 * SAME_HALVES_STEP;
    const block = amiga.allocMem(bytes);

    /* the first candidate at least one step into the block */
    let half = ((block + SAME_HALVES_STEP) >>> 16) + 1;
    const address = half * SAME_HALVES_STEP;

    for (let offset = -FILLED_BEFORE; offset < FILLED_AFTER; offset += 2) {
      amiga.poke16(address + offset, half);
    }

    return { block, bytes, address };
  }

  const pointing = VALUES.PAST_OPEN ? selfPointingBlock() : null;

  const scratch = pointing ? pointing.block : amiga.allocMem(SCRATCH_BYTES);
  const scratchBytes = pointing ? pointing.bytes : SCRATCH_BYTES;

  /* Results point at the middle, so that a negative offset (the class
   * pointer in front of a BOOPSI object) is still inside the block. */
  const result = pointing ? pointing.address : scratch + SCRATCH_BYTES / 2;

  /**
   * Whether an address lies inside the scratch block.
   *
   * @param {number} address
   * @returns {boolean}
   */
  function isScratch(address) {
    address = address >>> 0;
    return address >= scratch && address < scratch + scratchBytes;
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

    if (library === undefined) {
      /* A real library. Once a pretend window is open, its message
       * port is not real: stop at the first wait rather than let exec
       * wait on nothing. */
      if (opened && typeof Exec === 'function' &&
          base === Exec.libraryBase &&
          WAITERS.includes(functionName('exec.library', lvo))) {
        stopAt(functionName('exec.library', lvo) + ' (the event loop)');
      }

      return real.call(base, lvo, regs);
    }

    const name = functionName(library, lvo);

    if (name !== undefined && (OPENERS[library] || []).includes(name)) {
      if (!VALUES.PAST_OPEN) stopAt(name);
      opened = true;
    }

    /* GetAttr(attrID, object, storage) answers through its third
     * argument, in A1 (intuition_pragmas.h). Past the open, an
     * attribute that reads 0 stops a script that asked for the
     * window's signal mask, so give every attribute a value. */
    if (VALUES.PAST_OPEN && name === 'GetAttr' && regs && regs.a1) {
      amiga.poke32(regs.a1, result);
    }

    return result;
  };

  amiga.doMethod = function (object, message) {
    if (!isScratch(object)) return real.doMethod(object, message);

    const method = message ? amiga.peek32(message) : 0;

    if (OPENING_METHODS.includes(method)) {
      if (!VALUES.PAST_OPEN) {
        stopAt(method === VALUES.WM_OPEN ? 'WM_OPEN' : 'RM_OPENREQ');
      }
      opened = true;

      /* WM_OPEN answers with the window */
      return method === VALUES.WM_OPEN ? result : 0;
    }

    /* WM_HANDLEINPUT on a pretend window: the event loop */
    if (opened && method === VALUES.WM_HANDLEINPUT) {
      stopAt('WM_HANDLEINPUT (the event loop)');
    }

    return 0;
  };

  /* An example may free what a pretend library "allocated". */
  amiga.freeMem = function (pointer, size) {
    if (isScratch(pointer)) return undefined;

    return real.freeMem(pointer, size);
  };
})();
