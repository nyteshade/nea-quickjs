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

  /**
   * Make an enumeration class from a table of names and numbers whose
   * cases are only created when they are first used.
   *
   * A wrapper such as Intuition.consts offers hundreds of constants,
   * and a script uses a handful. Creating every case when the library
   * starts cost about a third of start-up time with only 190 of them
   * (measured on 0.220), so the cases are made on demand instead:
   *
   *   const C = Intuition.consts;
   *   C.WA_Left              // the case is created here, once
   *   C.from(0x200)          // looked up in the table, then created
   *   for (let [k, v] of C)  // creates every case first
   *
   * Everything a script could do with an ordinary CEnumeration class
   * still works; only the moment of creation changes.
   *
   * @param {string} name - the class name, e.g. 'IntuitionConsts'
   * @param {Object<string, number>} table - constant name to value
   * @returns {typeof CEnumeration} a class to use like any other
   *   enumeration class
   */
  static lazy(name, table) {
    const Base = this;
    const keys = Object.keys(table);
    const own = Object.prototype.hasOwnProperty;

    /** True once every case exists. */
    let complete = false;

    /** prefix -> (value -> name), filled in by fromPrefix().
     *  @type {Map<string, Map<number, string>>} */
    const families = new Map();

    /* The braces give the class its name: a class expression takes the
     * name of the property it is assigned to. */
    const Class = ({
      [name]: class extends Base {
        /**
         * Find a case by name or by value. A value shared by several
         * constants gives the first in the table; use fromPrefix()
         * when the family is known.
         *
         * @param {string|number|*} query
         * @returns {CEnumeration|null}
         */
        static from(query) {
          if (typeof query === 'string' && own.call(table, query)) {
            return create(query);
          }

          if (typeof query === 'number') {
            for (let index = 0; index < keys.length; index++) {
              if (table[keys[index]] === query) return create(keys[index]);
            }

            return null;
          }

          createAll();
          return super.from(query);
        }

        /**
         * Find the case with this value among the constants whose
         * names start with `prefix`. Many constants share a number
         * (IDCMP_CLOSEWINDOW and WFLG_REPORTMOUSE are both 0x200), so
         * a value alone does not say which is meant.
         *
         * @param {string} prefix - e.g. 'IDCMP_'
         * @param {number} value
         * @returns {CEnumeration|null}
         */
        static fromPrefix(prefix, value) {
          /* Called for every window message, so the scan of the whole
           * table is done once per prefix and remembered. */
          let index = families.get(prefix);

          if (!index) {
            index = new Map();

            for (let position = 0; position < keys.length; position++) {
              let key = keys[position];

              if (key.startsWith(prefix) && !index.has(table[key])) {
                index.set(table[key], key);
              }
            }

            families.set(prefix, index);
          }

          let key = index.get(value);

          return key === undefined ? null : create(key);
        }
      },
    })[name];

    /**
     * Create one case if it does not exist yet, and return it.
     *
     * @param {string} key
     * @returns {CEnumeration}
     */
    function create(key) {
      if (!own.call(Class, key)) Class.define(key, table[key]);

      return Class[key];
    }

    /**
     * Create every case that does not exist yet.
     *
     * @returns {undefined}
     */
    function createAll() {
      if (complete) return;

      complete = true;
      for (let index = 0; index < keys.length; index++) create(keys[index]);
    }

    /**
     * The table name most like a misspelt one, as a hint for an error
     * message: the name sharing the longest run of leading characters,
     * and of those the one closest in length.
     *
     * @param {string} wanted
     * @returns {string} ' - did you mean X?' or ''
     */
    function nearest(wanted) {
      let best = '';
      let bestShared = 2;      /* at least three characters in common */

      for (let index = 0; index < keys.length; index++) {
        let candidate = keys[index];
        let shared = 0;

        while (shared < candidate.length && shared < wanted.length &&
               candidate[shared] === wanted[shared]) {
          shared++;
        }

        if (shared > bestShared ||
            (shared === bestShared && best &&
             Math.abs(candidate.length - wanted.length) <
             Math.abs(best.length - wanted.length))) {
          best = candidate;
          bestShared = shared;
        }
      }

      return best ? ' - did you mean ' + best + '?' : '';
    }

    /**
     * Whether a property name is shaped like an OS constant: it starts
     * with a capital and either has an underscore (WA_Left) or is all
     * capitals and digits, four or more long (JAM1, CHECKIT). Ordinary
     * property names (from, name, toJSON, then) are not.
     *
     * Written without a regular expression on purpose: see the note on
     * regular expressions in precompiled bytecode in this file's
     * history (0.221).
     *
     * @param {string} key
     * @returns {boolean}
     */
    function looksLikeConstant(key) {
      let first = key.charCodeAt(0);

      if (!(first >= 65 && first <= 90)) return false;       /* A-Z */
      if (key.indexOf('_') > 0) return true;
      if (key.length < 4) return false;

      for (let index = 1; index < key.length; index++) {
        let code = key.charCodeAt(index);
        let capital = code >= 65 && code <= 90;
        let digit   = code >= 48 && code <= 57;

        if (!capital && !digit) return false;
      }

      return true;
    }

    return new Proxy(Class, {
      get(target, key, receiver) {
        if (typeof key === 'string' && own.call(table, key)) {
          return create(key);
        }

        /* Anything that walks the cases needs them all to exist. */
        if (key === 'cases' || key === 'values' || key === Symbol.iterator) {
          createAll();
        }

        /* A name that looks like a constant but is not one is a
         * spelling mistake, and `undefined` would travel on silently
         * (in a tag list it used to END the list). Say so here, with
         * the nearest real name. To ask whether a constant exists,
         * use `'WA_Left' in Intuition.consts`. */
        if (typeof key === 'string' && !Reflect.has(target, key) &&
            looksLikeConstant(key)) {
          throw new TypeError(name + ' has no constant ' + key +
                              nearest(key));
        }

        return Reflect.get(target, key, receiver);
      },

      has(target, key) {
        return (typeof key === 'string' && own.call(table, key)) ||
               Reflect.has(target, key);
      },

      ownKeys(target) {
        createAll();
        return Reflect.ownKeys(target);
      },

      getOwnPropertyDescriptor(target, key) {
        if (typeof key === 'string' && own.call(table, key)) create(key);

        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
  }
}
