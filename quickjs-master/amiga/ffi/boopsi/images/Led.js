/* quickjs-master/amiga/ffi/boopsi/images/Led.js
 *
 * led.image — Reaction's segmented-LED digit display. Renders
 * 7-segment "LED"-style numbers/text; useful for clocks, counters,
 * fuel gauges, tape decks. Extends imageclass.
 *
 * LED_Dummy = TAG_USER + 0x04000000 = 0x84000000 (shares the
 * pre-Reaction range since led.image predates Reaction).
 */

import { ImageBase, IMAGE_ATTRS } from '../ImageBase.js';

/** @internal LED_* tag IDs (images/led.h). */
const LED = Object.freeze({
  /* check-constants: prefix LED_ header images/led.h */
  Pairs:       0x84000001,  /* (WORD) number of digit pairs */
  Values:      0x84000002,  /* (WORD *) one value per pair of digits */
  Colon:       0x84000003,  /* (BOOL) show colon between pairs */
  Negative:    0x84000004,  /* (BOOL) display as negative */
  Signed:      0x84000005,  /* (BOOL) signed display */
  Time:        0x84000006,  /* (BOOL) time-style formatting */
  Hexadecimal: 0x84000007,  /* (BOOL) hex digits */
  Raw:         0x84000008,  /* (BOOL) raw mode (V47.3) */
});

/** Size of one entry of the LED_Values array: a WORD. */
const WORD_BYTES = 2;

/** The largest number of pairs a led.image shows (images/led.h). */
const MAX_PAIRS = 8;

/**
 * led.image - a row of seven-segment digits, in pairs.
 *
 * What it shows is an array of WORDs, one per PAIR of digits
 * (LED_Values in images/led.h, and `WORD ledvalues[4][8]` in the NDK's
 * Examples/LED.c). The value of a WORD is the two-digit number its
 * pair shows: 26 shows "26", 7 shows "07". With `hexadecimal` it is
 * 0x00..0xFF and shows two hex digits; with `raw` the high byte is the
 * left digit's segments and the low byte the right digit's.
 *
 * Give the values as a JavaScript array and the wrapper keeps the WORD
 * array for you:
 *
 *     let clock = new Led({ pairs: 3, values: [12, 34, 56], colon: true });
 *     ...
 *     clock.setValues([12, 34, 57]);       // shows 12:34:57 at once
 *     clock.setValues(Led.pairsOf(123457, 3));   // the same
 *
 * (Until 0.231 `values` could only be a pointer, and the examples that
 * used it wrote one BYTE per DIGIT, which is not what the image reads:
 * six digits 1 2 3 4 5 6 are the WORDs 0x0102 0x0304 0x0506, shown as
 * the numbers 258, 772 and 1286.)
 *
 * @extends ImageBase
 */
export class Led extends ImageBase {
  /** @type {string} */
  static _classLibName = 'images/led.image';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...IMAGE_ATTRS,
    pairs:       { tagID: LED.Pairs,       type: 'int32' },
    values:      { tagID: LED.Values,      type: 'ptr'   },
    colon:       { tagID: LED.Colon,       type: 'bool'  },
    negative:    { tagID: LED.Negative,    type: 'bool'  },
    signed:      { tagID: LED.Signed,      type: 'bool'  },
    time:        { tagID: LED.Time,        type: 'bool'  },
    hexadecimal: { tagID: LED.Hexadecimal, type: 'bool'  },
    raw:         { tagID: LED.Raw,         type: 'bool' },   /* (BOOL) raw mode; was string-owned until 0.224 */
  };

  /**
   * Split a whole number into the values of a display's pairs, most
   * significant pair first: pairsOf(123456, 3) is [12, 34, 56], and
   * pairsOf(7, 2) is [0, 7]. Digits that do not fit are dropped from
   * the front, as on a counter that rolls over.
   *
   * @param {number} value - a whole number, 0 or more
   * @param {number} pairCount - how many pairs the display has
   * @returns {number[]} pairCount values, each 0 to 99
   */
  static pairsOf(value, pairCount) {
    const PAIR_MODULUS = 100;       /* two decimal digits */
    let rest  = Math.max(0, Math.floor(Number(value) || 0));
    let pairs = [];

    for (let index = 0; index < pairCount; index++) {
      pairs.unshift(rest % PAIR_MODULUS);
      rest = Math.floor(rest / PAIR_MODULUS);
    }

    return pairs;
  }

  /**
   * @param {object|number} init - attributes, or a pointer to an
   *   existing led.image to wrap
   * @param {number} [init.pairs] - how many pairs of digits, 1 to 8.
   *   Defaults to the length of `values` when that is an array.
   * @param {number[]|number} [init.values] - one number per pair (the
   *   wrapper keeps the WORD array), or a pointer to a WORD array the
   *   caller keeps alive
   * @param {boolean} [init.colon] - light the colons between pairs
   * @param {boolean} [init.time] - leave room for colons
   * @param {boolean} [init.signed] - leave room for a minus sign
   * @param {boolean} [init.negative] - light the minus sign
   * @param {boolean} [init.hexadecimal] - show values as two hex digits
   * @param {boolean} [init.raw] - values are segment patterns
   */
  constructor(init) {
    if (typeof init === 'number') {
      super(init);

      /** @type {number} the WORD array this wrapper owns, or 0 */
      this._valuesPtr = 0;
      /** @type {number} how many WORDs it holds */
      this._valuesCount = 0;
      return;
    }

    let clean  = (init && typeof init === 'object') ? { ...init } : {};
    let buffer = 0;
    let count  = 0;

    if (Array.isArray(clean.values)) {
      count = (clean.pairs === undefined) ? clean.values.length
                                          : (clean.pairs | 0);

      if (count < 1 || count > MAX_PAIRS) {
        throw new RangeError('Led: pairs must be 1 to ' + MAX_PAIRS +
                             ', not ' + count);
      }

      buffer = globalThis.amiga.allocMem(count * WORD_BYTES);
      if (!buffer) throw new Error('Led: out of memory for the values');

      Led._writeValues(buffer, count, clean.values);
      clean.pairs  = count;
      clean.values = buffer;
    }

    try {
      super(clean);
    }
    catch (error) {
      if (buffer) globalThis.amiga.freeMem(buffer, count * WORD_BYTES);
      throw error;
    }

    this._valuesPtr   = buffer;
    this._valuesCount = count;

    /* The image keeps the pointer, not a copy: the array must live as
     * long as the image. Freed with the wrapper's other owned memory,
     * in dispose(). */
    if (buffer) {
      this._ownedStrings.push({ ptr: buffer, size: count * WORD_BYTES });
    }
  }

  /**
   * Write pair values into a WORD array. Missing values are 0.
   *
   * @internal
   * @param {number} buffer - the array
   * @param {number} count - how many WORDs it holds
   * @param {number[]} values - one number per pair
   * @returns {undefined}
   */
  static _writeValues(buffer, count, values) {
    for (let index = 0; index < count; index++) {
      /* check-structs: a WORD array (LED_Values) */
      globalThis.amiga.poke16(buffer + index * WORD_BYTES,
                              (values[index] | 0) & 0xFFFF);
    }
  }

  /**
   * Show new values, at once if the window is open.
   *
   * @param {number[]} values - one number per pair, as for the
   *   constructor; extra ones are ignored, missing ones are 0
   * @returns {undefined}
   * @throws {Error} if this Led was not made with an array of values
   *   (then the caller owns the WORD array: write to it and call
   *   set({ values: pointer }))
   */
  setValues(values) {
    if (!this._valuesPtr) {
      throw new Error('Led.setValues: this Led was not created with ' +
                      'an array of values');
    }

    Led._writeValues(this._valuesPtr, this._valuesCount, values);

    /* The image does not watch the array: it has to be handed the
     * pointer again, and then drawn (see set()). */
    this.set({ values: this._valuesPtr });
  }

  /**
   * Set attributes, then draw the image again if its window is open.
   * An image is not repainted because its attributes changed; the
   * NDK's LED.c follows every SetAttrs() with a DrawImageState(), and
   * so does this.
   *
   * @param {object} patch - attribute names and their new values
   * @returns {undefined}
   */
  set(patch) {
    super.set(patch);
    this.redraw();
  }
}
