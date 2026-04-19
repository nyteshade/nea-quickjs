/* quickjs-master/amiga/ffi/LibraryBase.js
 *
 * Common base class for AmigaOS library wrappers. Subclasses:
 *   - set static libraryName, libraryVersion, lvo
 *   - add static methods that build a regs map and call this.call()
 *
 * Lifecycle: lazy open on first method call, cached. closeLibrary()
 * is idempotent; closeAll() iterates every subclass that was opened
 * and is registered as a script-exit hook.
 */

/**
 * @abstract
 */
export class LibraryBase {
  /**
   * AmigaOS library node name, e.g. 'intuition.library'. Required.
   *
   * @type {string}
   */
  static libraryName = '';

  /**
   * Minimum library version (matches the second arg of OpenLibrary).
   *
   * @type {number}
   */
  static libraryVersion = 0;

  /**
   * Cached library base pointer (0 if not yet opened).
   *
   * @type {number}
   */
  static libraryBase = 0;

  /**
   * Function-vector offsets keyed by LVO name.
   *
   * @type {Object<string, number>}
   */
  static lvo = {};

  /**
   * Open the library if it isn't already; cache and return the base.
   *
   * @returns {number} library base (non-zero)
   * @throws {Error} when the library can't be opened
   */
  static ensureLibrary() {
    if (this.libraryBase) {
      return this.libraryBase;
    }

    let base = globalThis.amiga.openLibrary(
      this.libraryName,
      this.libraryVersion
    );

    if (!base) {
      throw new Error(
        'LibraryBase: could not open ' +
        this.libraryName + ' v' + this.libraryVersion
      );
    }

    this.libraryBase = base;
    LibraryBase._opened.add(this);

    return base;
  }

  /**
   * Close the library if open. Idempotent.
   *
   * @returns {undefined}
   */
  static closeLibrary() {
    if (!this.libraryBase) {
      return;
    }

    globalThis.amiga.closeLibrary(this.libraryBase);
    this.libraryBase = 0;
    LibraryBase._opened.delete(this);
  }

  /**
   * Internal — wraps amiga.call with the lazily opened base.
   *
   * @param {number} lvo
   * @param {Object} regs
   * @returns {number}
   */
  static call(lvo, regs) {
    return globalThis.amiga.call(this.ensureLibrary(), lvo, regs || {});
  }

  /**
   * Close every library opened via the wrapper layer. Registered as a
   * script-exit hook by index.js so unclean exits don't leak.
   *
   * @returns {undefined}
   */
  static closeAll() {
    for (const cls of Array.from(LibraryBase._opened)) {
      cls.closeLibrary();
    }
  }
}

/** @internal */
LibraryBase._opened = new Set();
