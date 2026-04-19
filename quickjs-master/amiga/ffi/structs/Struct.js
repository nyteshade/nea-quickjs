/* quickjs-master/amiga/ffi/structs/Struct.js
 *
 * Base class for struct-pointer wrappers. Subclasses set a static
 * SIZE (in bytes) and add named getters/setters that read/write at
 * fixed byte offsets. Constructor allocates if no ptr given, or
 * wraps an existing ptr if one is passed.
 *
 * Memory model: explicit. Caller (or ergonomic helpers like
 * withStruct) is responsible for `.free()`.
 */

/**
 * @abstract
 */
export class Struct {
  /**
   * Byte size of this struct. Subclasses MUST override.
   *
   * @type {number}
   */
  static SIZE = 0;

  /**
   * Pointer to the struct in Amiga memory. Zero if freed or wrapping
   * a null.
   *
   * @type {number}
   */
  ptr;

  /**
   * @param {number} [ptr] if given, wrap this existing pointer (no
   *   allocation, no auto-free responsibility). If omitted, allocate
   *   a fresh `SIZE`-byte buffer with MEMF_PUBLIC|MEMF_CLEAR.
   */
  constructor(ptr) {
    if (ptr !== undefined) {
      this.ptr = ptr | 0;
      this._owned = false;
      return;
    }

    let size = this.constructor.SIZE;

    if (!size) {
      throw new Error(
        'Struct subclass ' + this.constructor.name +
        ' must define a static SIZE'
      );
    }

    this.ptr = globalThis.amiga.allocMem(size);

    if (!this.ptr) {
      throw new Error(
        'Struct: allocMem(' + size + ') failed for ' +
        this.constructor.name
      );
    }

    this._owned = true;
  }

  /**
   * Release the underlying memory. Only frees memory we allocated
   * (constructor without ptr). Idempotent.
   *
   * @returns {undefined}
   */
  free() {
    if (this.ptr && this._owned) {
      globalThis.amiga.freeMem(this.ptr, this.constructor.SIZE);
    }

    this.ptr = 0;
  }

  /* --- Field-access helpers — subclasses use these in getters/setters. --- */

  read8 (off) { return globalThis.amiga.peek8 (this.ptr + off); }
  read16(off) { return globalThis.amiga.peek16(this.ptr + off); }
  read32(off) { return globalThis.amiga.peek32(this.ptr + off); }

  write8 (off, v) { globalThis.amiga.poke8 (this.ptr + off, v); }
  write16(off, v) { globalThis.amiga.poke16(this.ptr + off, v); }
  write32(off, v) { globalThis.amiga.poke32(this.ptr + off, v); }
}

/**
 * Allocate a struct, run `fn`, free it whether or not fn throws.
 *
 * @template T
 * @param {new () => T} StructClass
 * @param {(s: T) => *} fn
 * @returns {*} fn's return value
 */
export function withStruct(StructClass, fn) {
  let s = new StructClass();

  try {
    return fn(s);
  }

  finally {
    s.free();
  }
}
