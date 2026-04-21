/* quickjs-master/amiga/ffi/boopsi/classes/Window.js
 *
 * window.class — Reaction's top-level container. Wraps a BOOPSI
 * object that, when sent WM_OPEN, allocates an actual Intuition
 * window and returns its struct Window*. The BOOPSI object holds
 * the Intuition window's lifetime — disposing it closes the window
 * and cascades to every attached child gadget.
 *
 * Tag namespaces:
 *   WA_*        — intuition/intuition.h, 0x80000063 base
 *   WINDOW_*    — classes/window.h, 0x85025000 base
 *
 * Method IDs (classes/window.h:293-308) — BOOPSI method IDs live in
 * their own integer namespace and are NOT offsets of WINDOW_Dummy:
 *   WM_HANDLEINPUT = 0x570001
 *   WM_OPEN        = 0x570002
 *   WM_CLOSE       = 0x570003
 *
 * Event surface: open() returns the Window wrapper itself (so the
 * user can chain); events() + eventsAsync() + .on() iterate over
 * IntuiMessages arriving on the underlying struct Window's
 * UserPort, translated to rich {kind, source, sourceId, attrs, raw}
 * event objects.
 */

import { BOOPSIBase } from '../BOOPSIBase.js';
import { EventKind } from '../EventKind.js';

/* Window-class attribute IDs. WA_* comes from intuition/intuition.h
 * (WA_Dummy = TAG_USER + 99 = 0x80000063). WINDOW_* comes from
 * classes/window.h (WINDOW_Dummy = REACTION_Dummy + 0x25000 =
 * 0x85025000). Both are accepted by window.class at NewObject time. */
const WA = Object.freeze({
  Left:          0x80000064,
  Top:           0x80000065,
  Width:         0x80000066,
  Height:        0x80000067,
  IDCMP:         0x8000006A,
  Flags:         0x8000006B,
  Title:         0x8000006E,
  ScreenTitle:   0x8000006F,
  CustomScreen:  0x80000070,
  MinWidth:      0x80000072,
  MinHeight:     0x80000073,
  MaxWidth:      0x80000074,
  MaxHeight:     0x80000075,
  InnerWidth:    0x80000076,
  InnerHeight:   0x80000077,
  PubScreen:     0x80000079,
  /* Individual gadget-flag tags (WA_Dummy + 0x1E..0x21). These are
   * the CORRECT tags to enable sizing/drag/depth/close gadgets at
   * NewObject time — an earlier (0.139) version of this file used
   * non-existent WINDOW_CloseGadget/... values instead, which
   * silently did nothing and produced invisible windows. */
  SizeGadget:    0x80000081,
  DragBar:       0x80000082,
  DepthGadget:   0x80000083,
  CloseGadget:   0x80000084,
});

const WINDOW = Object.freeze({
  Window:        0x85025001,
  SigMask:       0x85025002,
  MenuStrip:     0x85025004,
  Layout:        0x85025005,
  UserData:      0x85025006,
  Zoom:          0x85025008,
  Activate:      0x8502500A,
  LockWidth:     0x8502500B,
  LockHeight:    0x8502500C,
  Position:      0x8502500E,
  NestedEvents:  0x8502502D,
});

/**
 * WINDOW_Position values for quick placement.
 *
 *   POS_TOPLEFT      0  — upper-left of screen
 *   POS_CENTERSCREEN 1  — center of screen
 *   POS_CENTERWINDOW 2  — center of parent window (for child wins)
 *   POS_MOUSEPOINTER 3  — at current mouse coords
 */
export const WindowPosition = Object.freeze({
  TOPLEFT:      0,
  CENTERSCREEN: 1,
  CENTERWINDOW: 2,
  MOUSEPOINTER: 3,
});

const WM_OPEN  = 0x570002;
const WM_CLOSE = 0x570003;

/**
 * window.class — opens/holds an Intuition window containing a
 * Reaction gadget layout. Named `ReactionWindow` at definition to
 * avoid a bundle-time collision with the struct-Window wrapper in
 * amiga.intuition.Window; exposed as amiga.boopsi.Window by index.js.
 *
 * @extends BOOPSIBase
 */
export class ReactionWindow extends BOOPSIBase {
  /** @type {string} */
  static _classLibName = 'window.class';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    /* Inherited Intuition WA_* — accepted by window.class as an
     * alternative to flag-bitmask WA_Flags. */
    title:         { tagID: WA.Title,       type: 'string-owned' },
    screenTitle:   { tagID: WA.ScreenTitle, type: 'string-owned' },
    pubScreenName: { tagID: WA.PubScreen,   type: 'string-owned' },
    customScreen:  { tagID: WA.CustomScreen,type: 'ptr'  },
    innerWidth:    { tagID: WA.InnerWidth,  type: 'int32' },
    innerHeight:   { tagID: WA.InnerHeight, type: 'int32' },
    width:         { tagID: WA.Width,       type: 'int32' },
    height:        { tagID: WA.Height,      type: 'int32' },
    left:          { tagID: WA.Left,        type: 'int32' },
    top:           { tagID: WA.Top,         type: 'int32' },
    minWidth:      { tagID: WA.MinWidth,    type: 'int32' },
    minHeight:     { tagID: WA.MinHeight,   type: 'int32' },
    maxWidth:      { tagID: WA.MaxWidth,    type: 'int32' },
    maxHeight:     { tagID: WA.MaxHeight,   type: 'int32' },
    idcmp:         { tagID: WA.IDCMP,       type: 'uint32' },
    flags:         { tagID: WA.Flags,       type: 'uint32' },

    /* Gadget-flag tags — WA_* (not WINDOW_*). These enable the
     * actual intuition gadget flags at OpenWindowTagList time.
     * Setting them to false omits that gadget. */
    closeGadget:   { tagID: WA.CloseGadget, type: 'bool' },
    sizeGadget:    { tagID: WA.SizeGadget,  type: 'bool' },
    dragBar:       { tagID: WA.DragBar,     type: 'bool' },
    depthGadget:   { tagID: WA.DepthGadget, type: 'bool' },

    /* WINDOW_* — Reaction additions. */
    layout:        { tagID: WINDOW.Layout,  type: 'ptr'    },
    position:      { tagID: WINDOW.Position,type: 'uint32' },
    activate:      { tagID: WINDOW.Activate,type: 'bool'   },
    lockWidth:     { tagID: WINDOW.LockWidth, type: 'bool' },
    lockHeight:    { tagID: WINDOW.LockHeight,type: 'bool' },
    nestedEvents:  { tagID: WINDOW.NestedEvents, type: 'bool' },
    userData:      { tagID: WINDOW.UserData, type: 'uint32' },

    /* Read-only; populated by window.class after open(). */
    intuiWindow:   { tagID: WINDOW.Window,  type: 'ptr', readOnly: true },
    sigMask:       { tagID: WINDOW.SigMask, type: 'uint32', readOnly: true },
  };

  constructor(init) {
    super(init);
    /* Struct-Window wrapper set on open(); null when closed. */
    /** @type {Window|null} (struct Window wrapper) */
    this._intuiWindow = null;
  }

  /**
   * Send WM_OPEN. Returns the struct Window* pointer (wrapped in a
   * Window struct wrapper internally) and caches it. Throws if the
   * open fails.
   *
   * @returns {Window} this for chaining
   */
  open() {
    if (this._intuiWindow) return this;

    let winPtr = this.doMethod(WM_OPEN);

    if (!winPtr) {
      throw new Error('Window.open: WM_OPEN returned 0 — ' +
        'likely missing WA_Flags bit, bad screen, or out of memory');
    }

    /* Wrap the struct Window* in our existing struct wrapper so we
     * can reach UserPort, Font, etc. */
    this._intuiWindow = new globalThis.amiga.intuition.Window(winPtr);
    return this;
  }

  /**
   * Send WM_CLOSE. The underlying Intuition window disappears but
   * the BOOPSI object is reusable — call open() again to reopen.
   *
   * @returns {undefined}
   */
  close() {
    if (this._intuiWindow) {
      this.doMethod(WM_CLOSE);
      this._intuiWindow = null;
    }
  }

  /**
   * The underlying struct Window wrapper (after open()). null when
   * closed.
   *
   * @returns {Window|null}
   */
  get intuiWindow() { return this._intuiWindow; }

  /**
   * Walk `_children` depth-first, collecting every descendant keyed
   * by its `_id` (GA_ID set at construction time). Used by the
   * IDCMPUPDATE translator to resolve a source gadget by ID.
   *
   * @returns {Map<number, BOOPSIBase>}
   */
  _buildIdMap() {
    let map = new Map();
    let walk = (node) => {
      if (node._id !== null && node._id !== undefined) {
        map.set(node._id >>> 0, node);
      }
      for (let c of node._children) walk(c);
    };
    for (let c of this._children) walk(c);
    return map;
  }

  /**
   * Parse the TagList carried by IDCMP_IDCMPUPDATE (IntuiMessage.
   * iaddress). Walks TagItems until ti_Tag == TAG_END (0), populating
   * the supplied `out` object with every tag we recognize:
   *   GA_ID       → out.id
   *   ICA_TARGET  → out.icaTarget
   *   plus any raw tag IDs into out.tags[tagID] = ti_Data (so callers
   *   can introspect class-specific tags via attrs without us having
   *   to enumerate every Reaction class's attribute set here).
   *
   * @param {number} tagListPtr
   * @param {object} out
   * @returns {undefined}
   */
  static _walkUpdateTags(tagListPtr, out) {
    if (!tagListPtr) return;
    const peek = globalThis.amiga.peek32;

    /* Safety cap — Reaction tag lists are short (< 32 items), but
     * bail out if something is corrupt to avoid a runaway loop. */
    const MAX_TAGS = 256;
    let p = tagListPtr;
    let i = 0;

    for (; i < MAX_TAGS; i++, p += 8) {
      let tag  = peek(p);
      let data = peek(p + 4);

      /* TAG_END = 0 */
      if (tag === 0) break;

      /* TAG_IGNORE = 1 — skip this slot */
      if (tag === 1) continue;

      /* TAG_MORE = 2 — ti_Data points to continuation TagList. */
      if (tag === 2) { p = (data >>> 0) - 8; continue; }

      /* TAG_SKIP = 3 — skip ti_Data more items */
      if (tag === 3) { p += (data | 0) * 8; continue; }

      /* GA_ID = 0x8003000F */
      if (tag === 0x8003000F) { out.id = data >>> 0; continue; }

      /* ICA_TARGET = 0x80040001 (ICA_Dummy = TAG_USER+0x40000, +1) */
      if (tag === 0x80040001) { out.icaTarget = data >>> 0; continue; }

      /* LAYOUT_RelVerify = 0x85007017 — marker: this IDCMPUPDATE is
       * a gadgetup broadcast from layout.gadget. */
      if (tag === 0x85007017) { out.layoutRelVerify = data >>> 0; continue; }

      /* LAYOUT_RelCode = 0x85007018 — the child's release code. */
      if (tag === 0x85007018) { out.code = data >>> 0; continue; }

      /* LAYOUT_TabVerify = 0x85007021 — whether the release was via tab. */
      if (tag === 0x85007021) { out.tabVerify = data >>> 0; continue; }

      /* Anything else — record by tag ID for class-specific parsing. */
      if (!out.tags) out.tags = {};
      out.tags[tag >>> 0] = data >>> 0;
    }
  }

  /**
   * Translate one IntuiMessage into a rich event object. Matches the
   * EventKind enum by IDCMP class; unknown classes fall through with
   * kind=null so nothing gets swallowed. For IDCMP_IDCMPUPDATE walks
   * the TagList and resolves event.source / event.sourceId / event.attrs,
   * then upgrades event.kind to a class-specific case where possible
   * (e.g. a BUTTON_CLICK when the source is a Button).
   *
   * @param   {IntuiMessage} msg
   * @returns {{kind: *|null, source: *|null, sourceId: number|null, attrs: object, raw: IntuiMessage}}
   */
  _translateMessage(msg) {
    let cls = msg.classRaw;
    let kind = EventKind.fromIdcmp(cls);

    let event = {
      kind,
      source:   null,
      sourceId: null,
      attrs:    {},
      raw:      msg,
    };

    /* IDCMP_IDCMPUPDATE: 0x00800000. Walk iaddress TagList, pull GA_ID,
     * resolve source from JS-side child registry, upgrade event.kind
     * to the most specific class-level case (BUTTON_CLICK,
     * CHECKBOX_TOGGLE, ...) if any is registered. */
    if (cls === 0x00800000 && msg.iaddress) {
      let parsed = {};
      ReactionWindow._walkUpdateTags(msg.iaddress, parsed);

      if (typeof parsed.id === 'number') {
        event.sourceId = parsed.id;
        let map = this._buildIdMap();
        event.source = map.get(parsed.id) || null;

        /* Upgrade kind based on source class. Button → BUTTON_CLICK,
         * etc. Falls through to ATTR_UPDATE if no class match. */
        if (event.source) {
          let className = event.source.constructor._classLibName;
          let classKind = EventKind.fromGadgetClass(className);
          if (classKind) event.kind = classKind;
        }
      }

      if (parsed.tags) event.attrs = parsed.tags;
    }

    return event;
  }

  /**
   * Synchronous event iterator. Delegates to the struct-Window's
   * messages() iterator and translates each IntuiMessage.
   *
   * @yields {object} event object with {kind, source, sourceId, attrs, raw}
   */
  * events() {
    if (!this._intuiWindow) {
      throw new Error('Window.events: window is not open; call open() first');
    }

    for (let msg of this._intuiWindow.messages()) {
      let event = this._translateMessage(msg);
      this._fire(event);
      yield event;
    }
  }

  /**
   * Close + dispose. Overrides BOOPSIBase.dispose to ensure WM_CLOSE
   * runs before Intuition.DisposeObject cascades. Safe to call
   * multiple times.
   *
   * @returns {undefined}
   */
  dispose() {
    if (this._disposed) return;
    this.close();
    super.dispose();
  }
}
