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
 *     idcmp: 0x00800000,   // IDCMP_IDCMPUPDATE
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
 * IDCMP class constants — the authoritative mapping from intuition.h
 * (NDK 3.2R4, intuition/intuition.h:863-893). Exposed so scripts can
 * build IDCMP masks without guessing bit values.
 *
 * Every case except LONELY_MESSAGE (0x80000000 — system-internal) has
 * a corresponding EventKind registered below.
 */
export const IDCMP = Object.freeze({
  SIZE_VERIFY:      0x00000001,
  NEW_SIZE:         0x00000002,
  REFRESH_WINDOW:   0x00000004,
  MOUSE_BUTTONS:    0x00000008,
  MOUSE_MOVE:       0x00000010,
  GADGET_DOWN:      0x00000020,
  GADGET_UP:        0x00000040,
  REQ_SET:          0x00000080,
  MENU_PICK:        0x00000100,
  CLOSE_WINDOW:     0x00000200,
  RAW_KEY:          0x00000400,
  REQ_VERIFY:       0x00000800,
  REQ_CLEAR:        0x00001000,
  MENU_VERIFY:      0x00002000,
  NEW_PREFS:        0x00004000,
  DISK_INSERTED:    0x00008000,
  DISK_REMOVED:     0x00010000,
  WBENCH_MESSAGE:   0x00020000,
  ACTIVE_WINDOW:    0x00040000,
  INACTIVE_WINDOW:  0x00080000,
  DELTA_MOVE:       0x00100000,
  VANILLA_KEY:      0x00200000,
  INTUITICKS:       0x00400000,
  IDCMPUPDATE:      0x00800000,   /* Reaction attribute-change broadcast */
  MENU_HELP:        0x01000000,
  CHANGE_WINDOW:    0x02000000,
  GADGET_HELP:      0x04000000,
  EXTENDED_MOUSE:   0x08000000,
  LONELY_MESSAGE:   0x80000000,   /* system-internal, not dispatched */
});

/**
 * Convenience mask pre-baked for typical Reaction windows: every
 * event a Reaction UI consumer usually cares about. Excludes the
 * verify-style messages (REQ_SET / REQ_VERIFY / REQ_CLEAR /
 * MENU_VERIFY / SIZE_VERIFY) that block Intuition while outstanding.
 */
export const IDCMP_REACTION_DEFAULT =
  IDCMP.CLOSE_WINDOW | IDCMP.REFRESH_WINDOW | IDCMP.NEW_SIZE |
  IDCMP.ACTIVE_WINDOW | IDCMP.INACTIVE_WINDOW |
  IDCMP.GADGET_UP | IDCMP.GADGET_DOWN |
  IDCMP.IDCMPUPDATE |
  IDCMP.VANILLA_KEY | IDCMP.RAW_KEY |
  IDCMP.CHANGE_WINDOW | IDCMP.GADGET_HELP;

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
    /* Core IDCMP events. Every IDCMP_* bit except LONELY_MESSAGE
     * (system-internal) has a case here. Window event pump matches
     * IntuiMessage.class to one of these via fromIdcmp(). Additional
     * class-specific kinds (BUTTON_CLICK, CHECKBOX_TOGGLE, ...) are
     * define()'d by each gadget wrapper at module-load time and wrap
     * IDCMPUPDATE / GADGET_UP. */

    /* ---- Verify-style messages: Intuition blocks until app replies. ---- */
    EventKind.define('SIZE_VERIFY', {
      idcmp: IDCMP.SIZE_VERIFY,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('NEW_SIZE', {
      idcmp: IDCMP.NEW_SIZE,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('REFRESH_WINDOW', {
      idcmp: IDCMP.REFRESH_WINDOW,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    /* ---- Mouse input ---- */
    EventKind.define('MOUSE_BUTTONS', {
      idcmp: IDCMP.MOUSE_BUTTONS,
      rich:  { hasId: false, hasCode: true, hasCoords: true,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('MOUSE_MOVE', {
      idcmp: IDCMP.MOUSE_MOVE,
      rich:  { hasId: false, hasCode: false, hasCoords: true,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('DELTA_MOVE', {
      idcmp: IDCMP.DELTA_MOVE,
      rich:  { hasId: false, hasCode: false, hasCoords: true,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('EXTENDED_MOUSE', {
      idcmp: IDCMP.EXTENDED_MOUSE,
      rich:  { hasId: false, hasCode: true, hasCoords: true,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    /* ---- Classic gadget events (non-BOOPSI and GadTools fallback) ---- */
    EventKind.define('GADGET_DOWN', {
      idcmp: IDCMP.GADGET_DOWN,
      rich:  { hasId: true, hasCode: false, hasCoords: false,
               hasSource: true, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('GADGET_UP', {
      idcmp: IDCMP.GADGET_UP,
      rich:  { hasId: true, hasCode: false, hasCoords: false,
               hasSource: true, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('GADGET_HELP', {
      idcmp: IDCMP.GADGET_HELP,
      rich:  { hasId: true, hasCode: false, hasCoords: false,
               hasSource: true, hasPressed: false },
      from:  'intuition',
    });

    /* ---- Requester lifecycle ---- */
    EventKind.define('REQ_SET', {
      idcmp: IDCMP.REQ_SET,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('REQ_VERIFY', {
      idcmp: IDCMP.REQ_VERIFY,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('REQ_CLEAR', {
      idcmp: IDCMP.REQ_CLEAR,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    /* ---- Menu system ---- */
    EventKind.define('MENU_PICK', {
      idcmp: IDCMP.MENU_PICK,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('MENU_VERIFY', {
      idcmp: IDCMP.MENU_VERIFY,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('MENU_HELP', {
      idcmp: IDCMP.MENU_HELP,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    /* ---- Window lifecycle ---- */
    EventKind.define('CLOSE_WINDOW', {
      idcmp: IDCMP.CLOSE_WINDOW,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('ACTIVE_WINDOW', {
      idcmp: IDCMP.ACTIVE_WINDOW,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('INACTIVE_WINDOW', {
      idcmp: IDCMP.INACTIVE_WINDOW,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('CHANGE_WINDOW', {
      idcmp: IDCMP.CHANGE_WINDOW,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    /* ---- Keyboard input ---- */
    EventKind.define('VANILLA_KEY', {
      idcmp: IDCMP.VANILLA_KEY,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('RAW_KEY', {
      idcmp: IDCMP.RAW_KEY,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    /* ---- System / preferences ---- */
    EventKind.define('NEW_PREFS', {
      idcmp: IDCMP.NEW_PREFS,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('DISK_INSERTED', {
      idcmp: IDCMP.DISK_INSERTED,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('DISK_REMOVED', {
      idcmp: IDCMP.DISK_REMOVED,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('WBENCH_MESSAGE', {
      idcmp: IDCMP.WBENCH_MESSAGE,
      rich:  { hasId: false, hasCode: true, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    EventKind.define('INTUITICKS', {
      idcmp: IDCMP.INTUITICKS,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'intuition',
    });

    /* ---- IDCMP_IDCMPUPDATE (0x00800000): Reaction's attribute-delta
     * broadcast. The Window event pump parses the TagList in
     * IntuiMessage.iaddress, extracts GA_ID, resolves .source via
     * child lookup, and — if a gadget-class-specific kind matches the
     * payload — upgrades .kind to that (e.g. BUTTON_CLICK). Raw
     * ATTR_UPDATE is the fallback when no class registers a match. */
    EventKind.define('ATTR_UPDATE', {
      idcmp: IDCMP.IDCMPUPDATE,
      rich:  { hasId: true, hasCode: false, hasCoords: false,
               hasSource: true, hasPressed: false },
      from:  'intuition',
    });

    /* ---- Non-IDCMP: synthetic. Raised by Window.events() when a
     * caller-supplied `extraSignals` bit fires during Exec.Wait.
     * `from: 'exec'` keeps it out of the Intuition IDCMP lookup tables
     * (fromIdcmp walks `from === 'intuition'` only). attrs.sigMask on
     * the event is the bitmask of extra signals that actually fired. */
    EventKind.define('SIGNAL', {
      idcmp: 0,
      rich:  { hasId: false, hasCode: false, hasCoords: false,
               hasSource: false, hasPressed: false },
      from:  'exec',
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
      if (c.value && c.value.idcmp === idcmpClass &&
          c.value.from === 'intuition') {
        return c;
      }
    }

    return null;
  }

  /**
   * Given a raw IDCMPUPDATE event and an inspected GA_ID source
   * gadget, find the most specific EventKind registered by any
   * gadget class. Preference order: a class-specific kind whose
   * `from` matches the source's `_classLibName`, else ATTR_UPDATE.
   *
   * Used by Window._translateMessage after walking the TagList.
   *
   * @param   {string|null} sourceClassName — e.g. 'gadgets/button.gadget'
   * @returns {EventKind|null}
   */
  static fromGadgetClass(sourceClassName) {
    if (!sourceClassName) return null;

    for (const [, c] of this) {
      if (c.value && c.value.from === sourceClassName) {
        return c;
      }
    }

    return null;
  }
}
