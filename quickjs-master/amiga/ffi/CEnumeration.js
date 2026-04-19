/* quickjs-master/amiga/ffi/CEnumeration.js
 *
 * Specialization of the vendored Enumeration for C-enum bridges
 * whose `value` may be either a primitive number/string or a
 * structured record like `{cName, value, autodoc}`. Layered so the
 * vendored Enumeration class stays pure.
 *
 * Adds:
 *   - drilled `valueOf` / `[Symbol.toPrimitive]('number')` so cases
 *     coerce to their underlying numeric value either way
 *   - extended `static from(query)` that also matches against fields
 *     on a structured value object or on the associations object
 *
 * Library wrapper consts (Intuition.consts, GadTools.consts, ...)
 * all extend this, NOT the base Enumeration.
 */

import { Enumeration } from '../extended/vendor/ne-enumeration/enumeration.mjs';

/**
 * @extends Enumeration
 */
export class CEnumeration extends Enumeration {
  /**
   * Drill into structured values: if `this.value` is a plain object
   * with a `.value` field, return that field. Otherwise return
   * `this.value` unchanged.
   *
   * @returns {*}
   */
  valueOf() {
    if (
      this.value !== null &&
      typeof this.value === 'object' &&
      'value' in this.value
    ) {
      return this.value.value;
    }

    return this.value;
  }

  /**
   * Number coercion drills the same way; string coercion still
   * returns the key.
   *
   * @param {string} hint  'number' | 'string' | 'default'
   * @returns {number|string}
   */
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') {
      let v = this.valueOf();

      return typeof v === 'number' ? v : Number(v);
    }

    return String(this.key);
  }

  /**
   * Look up a case by key, primitive value, or any field on a
   * structured value or association object. Returns the matching
   * case or null.
   *
   * Matching priority (first hit wins):
   *   1. base Enumeration.from(query) — key (===) and value (==)
   *   2. case.value[anyField] === query     (structured value form)
   *   3. case.associations[anyField] === query  (associated metadata)
   *
   * @param {*} query
   * @returns {CEnumeration|null}
   */
  static from(query) {
    let base = super.from(query);

    if (base) {
      return base;
    }

    for (const [, c] of this) {
      if (c.value !== null && typeof c.value === 'object') {
        for (const k in c.value) {
          if (c.value[k] === query) {
            return c;
          }
        }
      }

      if (c.associations && typeof c.associations === 'object') {
        for (const k in c.associations) {
          if (c.associations[k] === query) {
            return c;
          }
        }
      }
    }

    return null;
  }
}
