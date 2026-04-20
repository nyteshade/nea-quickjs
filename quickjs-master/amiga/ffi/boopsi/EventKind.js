/* quickjs-master/amiga/ffi/boopsi/EventKind.js
 *
 * The BOOPSI / Reaction event taxonomy. A CEnumeration whose cases
 * carry structured metadata describing which raw IDCMP class they
 * correspond to, what fields are meaningful on the event object,
 * and which Reaction class owns them.
 *
 * Core IDCMP cases are pre-defined here. Each Reaction class
 * wrapper extends the enum at module-load time with its own kinds:
 *
 *   // In gadgets/Button.js:
 *   EventKind.define('BUTTON_CLICK', {
 *     idcmp: 0x4000000,   // IDCMP_IDCMPUPDATE
 *     rich:  { hasId: true, hasSource: true, hasPressed: true },
 *     from:  'button.gadget',
 *     wraps: 'GADGET_UP',   // semantic parent
 *   });
 *
 * Consumers match with strict equality against the case instance:
 *
 *   if (evt.kind === EventKind.BUTTON_CLICK) { ... }
 *
 * The Window event pump translates raw IntuiMessages into event
 * objects carrying a .kind reference to the matching case, plus
 * decoded fields (source, sourceId, attrs, raw).
 */

import { CEnumeration } from '../CEnumeration.js';

/**
 * BOOPSI event taxonomy. Every case value is a plain object:
 *   {
 *     idcmp: number,      // Raw IDCMP_* class mask
 *     rich: {             // Which fields the event pump populates
 *       hasId:       boolean, // GA_ID present
 *       hasCode:     boolean, // IntuiMessage.code is meaningful
 *       hasCoords:   boolean, // mouseX / mouseY are meaningful
 *       hasSource:   boolean, // source BOOPSI ptr resolvable
 *       hasPressed:  boolean, // button.gadget style pressed flag
 *     },
 *     from: string,       // "window.class", "button.gadget", ...
 *     wraps: string,      // Optional: parent EventKind name
 *   }
 *
 * @extends CEnumeration
 */
export class EventKind extends CEnumeration {
  static {
    /* Core IDCMP events that Window produces directly without any
     * Reaction-specific translation. These ship baked-in; additional
     * kinds (BUTTON_CLICK, CHECKBOX_TOGGLE, ...) are define()'d by
     * the gadget wrappers at their module-load time. */

    EventKind.define('CLOSE_WINDOW', {
      idcmp: 0x00000200,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('REFRESH_WINDOW', {
      idcmp: 0x00000004,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('NEW_SIZE', {
      idcmp: 0x00000002,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('MOUSE_BUTTONS', {
      idcmp: 0x00000008,
      rich:  { hasId: false, hasCode: true, hasCoords: true,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('MOUSE_MOVE', {
      idcmp: 0x00000010,
      rich:  { hasId: false, hasCode: false, hasCoords: true,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('GADGET_DOWN', {
      idcmp: 0x00000020,
      rich:  { hasId: true, hasCode: false, hasCoords: false,
               hasSource: true, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('GADGET_UP', {
      idcmp: 0x00000040,
      rich:  { hasId: true, hasCode: false, hasCoords: false,
               hasSource: true, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('VANILLA_KEY', {
      idcmp: 0x00200000,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('RAW_KEY', {
      idcmp: 0x00000400,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    /* IDCMP_IDCMPUPDATE = 0x40000000 — the big one. Reaction uses
     * this to broadcast attribute changes via a TagList. The Window
     * event pump parses that TagList and yields a more specific
     * event kind matching the attribute set (e.g. BUTTON_CLICK).
     * The raw kind stays available as a fallback when nothing
     * matches. */
    EventKind.define('ATTR_UPDATE', {
      idcmp: 0x40000000,
      rich:  { hasId: true, hasCode: false, hasCoords: false,
               hasSource: true, hasPressed: false },
      from:  'intuition',
    });
  }

  /**
   * Find the EventKind case matching an IntuiMessage's raw class
   * value. Returns null if no case matches (caller should fall back
   * to a raw event object).
   *
   * @param   {number} idcmpClass — IntuiMessage.read32(20)
   * @returns {EventKind|null}
   */
  static fromIdcmp(idcmpClass) {
    for (const [, c] of this) {
      if (c.value && c.value.idcmp === idcmpClass) {
        return c;
      }
    }

    return null;
  }
}
