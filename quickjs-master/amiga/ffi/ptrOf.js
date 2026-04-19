/* quickjs-master/amiga/ffi/ptrOf.js
 *
 * Tiny helper used by every FFI wrapper method that takes pointer
 * arguments. Coerces JS values to raw 32-bit pointer numbers.
 */

/**
 * Coerce a JS value to a raw pointer (number).
 *
 * Accepts:
 *   - null / undefined          → 0
 *   - number                    → as-is (truncated to int32 via | 0)
 *   - struct instance (.ptr)    → its .ptr field
 *   - anything else             → coerced via | 0 (NaN -> 0)
 *
 * @param {*} x
 * @returns {number}
 */
export function ptrOf(x) {
  if (x === null || x === undefined) {
    return 0;
  }

  if (typeof x === 'object' && typeof x.ptr === 'number') {
    return x.ptr;
  }

  return x | 0;
}
