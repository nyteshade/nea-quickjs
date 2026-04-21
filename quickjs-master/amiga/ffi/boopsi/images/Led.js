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
  Pairs:       0x84000001,  /* (WORD) number of digit pairs */
  Values:      0x84000002,  /* (UBYTE*) array of digit values */
  Colon:       0x84000003,  /* (BOOL) show colon between pairs */
  Negative:    0x84000004,  /* (BOOL) display as negative */
  Signed:      0x84000005,  /* (BOOL) signed display */
  Time:        0x84000006,  /* (BOOL) time-style formatting */
  Hexadecimal: 0x84000007,  /* (BOOL) hex digits */
  Raw:         0x84000008,  /* (STRPTR) raw display string */
});

/**
 * led.image — segmented-digit display.
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
    raw:         { tagID: LED.Raw,         type: 'string-owned' },
  };
}
