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
import { EventKind, IDCMP_REACTION_DEFAULT } from '../EventKind.js';

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

const WM_HANDLEINPUT = 0x570001;
const WM_OPEN        = 0x570002;
const WM_CLOSE       = 0x570003;

/* WM_HANDLEINPUT return codes (classes/window.h:230-258). The result
 * is a packed ULONG: the high word is the WMHI class, the low word is
 * a class-specific data value (gadget ID, raw key, menu code, ...).
 * WMHI_LASTMSG=0 means the queue is drained; loop ends. */
const WMHI = Object.freeze({
  LASTMSG:        0,
  IGNORE:         0xFFFFFFFF >>> 0,
  CLASSMASK:      0xFFFF0000,
  GADGETMASK:     0xFFFF,
  CLOSEWINDOW:    1  << 16,
  GADGETUP:       2  << 16,
  INACTIVE:       3  << 16,
  ACTIVE:         4  << 16,
  NEWSIZE:        5  << 16,
  MENUPICK:       6  << 16,
  MENUHELP:       7  << 16,
  GADGETHELP:     8  << 16,
  ICONIFY:        9  << 16,
  UNICONIFY:      10 << 16,
  RAWKEY:         11 << 16,
  VANILLAKEY:     12 << 16,
  CHANGEWINDOW:   13 << 16,
  INTUITICK:      14 << 16,
  MOUSEMOVE:      15 << 16,
  MOUSEBUTTONS:   16 << 16,
});

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
    /* Default WA_IDCMP to a sensible Reaction set. WM_HANDLEINPUT
     * decodes IntuiMessages into WMHI_* return codes, but it can only
     * see classes the user actually requested via WA_IDCMP — without
     * IDCMP_GADGETUP, WMHI_GADGETUP never fires no matter how much
     * Reaction wiring is correct. Caller can pass an explicit `idcmp`
     * to override. */
    let cleaned = (init && typeof init === 'object') ? { ...init } : {};
    if (cleaned.idcmp === undefined) {
      cleaned.idcmp = IDCMP_REACTION_DEFAULT >>> 0;
    }
    super(cleaned);
    /* Struct-Window wrapper set on open(); null when closed. */
    /** @type {Window|null} (struct Window wrapper) */
    this._intuiWindow = null;
    /* WM_HANDLEINPUT &code out-parameter slot; lazily allocated by
     * events() and freed by dispose(). */
    /** @type {number} */
    this._codeBuf = 0;

    /* The layout passed as WINDOW_Layout is also our JS-side child for
     * dispose-cascade and id-map walks. BOOPSIBase didn't add it via
     * addChild because it came in as a tag value, not a `children`
     * entry. Without this, _buildIdMap finds zero children and
     * WMHI_GADGETUP can't resolve event.source from gadget ID. */
    if (init && init.layout &&
        typeof init.layout === 'object' &&
        Array.isArray(init.layout._children)) {
      this.addChild(init.layout);
    }
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

    /* IDCMP_IDCMPUPDATE: 0x00800000. Walk iAddress TagList, pull GA_ID,
     * resolve source from JS-side child registry, upgrade event.kind
     * to the most specific class-level case (BUTTON_CLICK,
     * CHECKBOX_TOGGLE, ...) if any is registered. */
    if (cls === 0x00800000 && msg.iAddress) {
      let parsed = {};
      ReactionWindow._walkUpdateTags(msg.iAddress, parsed);

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
   * Phase D helper — populate `event.attrs` with the most relevant
   * current attribute(s) for the source gadget's class, so handlers
   * don't need an explicit `event.source.get(...)` round-trip after
   * each event. Class → attrs mapping is intentionally minimal:
   *   slider/scroller/fuelgauge      → { level }
   *   checkbox/radiobutton/clicktab  → { selected }
   *   string/integer/texteditor      → { text }    (or `value` for integer)
   *   chooser                        → { selected }
   *   speedbar                       → { selected }
   * Buttons get nothing extra — the click is the event, no state.
   *
   * Errors during get() are silently swallowed: if a class hasn't
   * defined the named property, we don't surface attrs rather than
   * blowing up the event pump.
   *
   * @param {object} event
   * @param {string} className — source.constructor._classLibName
   */
  static _fillAttrsForClass(event, className) {
    if (!className || !event.source) return;
    let pull = (name) => {
      try { return event.source.get(name); }
      catch (_) { return undefined; }
    };
    switch (className) {
      case 'gadgets/slider.gadget':
      case 'gadgets/scroller.gadget':
      case 'gadgets/fuelgauge.gadget':
      case 'gadgets/gradientslider.gadget':
        event.attrs.level = pull('level');
        break;
      case 'gadgets/checkbox.gadget':
      case 'gadgets/radiobutton.gadget':
        event.attrs.selected = pull('selected');
        break;
      case 'gadgets/string.gadget':
        event.attrs.text = pull('text');
        break;
      case 'gadgets/integer.gadget':
        event.attrs.value = pull('value');
        break;
      case 'gadgets/clicktab.gadget':
      case 'gadgets/chooser.gadget':
      case 'gadgets/listbrowser.gadget':
      case 'gadgets/speedbar.gadget':
      case 'gadgets/page.gadget':
        event.attrs.selected = pull('selected');
        break;
      case 'gadgets/texteditor.gadget':
        event.attrs.text = pull('contents');
        break;
      default:
        /* Unknown class — leave attrs empty. Handlers can still
         * call event.source.get(...) for any specific attr. */
        break;
    }
  }

  /**
   * Translate one WM_HANDLEINPUT (result, code) pair into a rich event
   * object. Result high word is the WMHI_* class, low word is class-
   * specific data (gadget ID for WMHI_GADGETUP, etc.). For WMHI_GADGETUP
   * we look the gadget up by ID via the JS-side child registry and
   * upgrade event.kind to the most specific class case (BUTTON_CLICK,
   * CHECKBOX_TOGGLE, ...) when one is registered.
   *
   * @param   {number} result — packed (WMHI_class << 16) | data
   * @param   {number} code   — UWORD filled by WM_HANDLEINPUT (key/menu/...)
   * @returns {{kind:*|null,source:*|null,sourceId:number|null,attrs:object,raw:object}}
   */
  _translateWmhi(result, code) {
    const cls  = result & WMHI.CLASSMASK;
    const data = result & WMHI.GADGETMASK;

    let event = {
      kind:     null,
      source:   null,
      sourceId: null,
      attrs:    {},
      raw:      { result, code, classRaw: cls >>> 16, data },
    };

    switch (cls) {
      case WMHI.CLOSEWINDOW:
        event.kind = EventKind.CLOSE_WINDOW;
        break;

      case WMHI.GADGETUP: {
        event.sourceId = data;
        let map = this._buildIdMap();
        event.source = map.get(data) || null;
        if (event.source) {
          let className = event.source.constructor._classLibName;
          event.kind = EventKind.fromGadgetClass(className) || EventKind.GADGET_UP;

          /* Phase D: auto-populate event.attrs with the most relevant
           * current attribute(s) for this gadget class, so handlers
           * don't need a separate event.source.get() round-trip. The
           * attr names are stable per class. Round-trips OM_GET via
           * the property accessor so the value is always live. */
          ReactionWindow._fillAttrsForClass(event, className);
        } else {
          event.kind = EventKind.GADGET_UP;
        }
        break;
      }

      case WMHI.GADGETHELP:
        event.sourceId = data;
        event.kind = EventKind.GADGET_HELP;
        break;

      case WMHI.ACTIVE:
        event.kind = EventKind.ACTIVE_WINDOW;
        break;

      case WMHI.INACTIVE:
        event.kind = EventKind.INACTIVE_WINDOW;
        break;

      case WMHI.NEWSIZE:
        event.kind = EventKind.NEW_SIZE;
        break;

      case WMHI.MENUPICK:
        event.kind = EventKind.MENU_PICK;
        event.raw.code = code;
        break;

      case WMHI.MENUHELP:
        event.kind = EventKind.MENU_HELP;
        event.raw.code = code;
        break;

      case WMHI.RAWKEY:
        event.kind = EventKind.RAW_KEY;
        event.raw.code = code;
        break;

      case WMHI.VANILLAKEY:
        event.kind = EventKind.VANILLA_KEY;
        event.raw.code = code;
        break;

      case WMHI.CHANGEWINDOW:
        event.kind = EventKind.CHANGE_WINDOW;
        event.raw.code = data;
        break;

      case WMHI.INTUITICK:
        event.kind = EventKind.INTUITICKS;
        break;

      case WMHI.MOUSEMOVE:
        event.kind = EventKind.MOUSE_MOVE;
        break;

      case WMHI.MOUSEBUTTONS:
        event.kind = EventKind.MOUSE_BUTTONS;
        event.raw.code = code;
        break;

      default:
        /* Unknown / unmapped WMHI_* (ICONIFY, UNICONIFY, JUMPSCREEN,
         * POPUPMENU, GADGETDOWN). Leave kind=null so callers can
         * match raw.classRaw if they care. */
        break;
    }

    return event;
  }

  /**
   * Synchronous event iterator. Drives the canonical Reaction event
   * pump (Wait + WM_HANDLEINPUT loop) per NDK Examples/String.c. Each
   * outer iteration Wait()s on the window's signal; the inner loop
   * calls WM_HANDLEINPUT until it returns WMHI_LASTMSG, yielding a
   * rich event for every non-ignored result.
   *
   * Pass `opts.extraSignals` (a uint32 bitmask) to merge extra signals
   * into the Wait. When any of them fires, the loop yields a synthetic
   * EventKind.SIGNAL event whose `attrs.sigMask` carries the bits that
   * fired (masked to the requested extras — the window signal never
   * surfaces here). This is the canonical hook for integrating
   * timer.device, AllocSignal bits, msgport signals, etc. into the
   * same loop — e.g. a 1-Hz clock or a stopwatch tick without
   * depending on IDCMP_INTUITICKS.
   *
   * @param {object} [opts]
   * @param {number} [opts.extraSignals=0] — extra signal bits to Wait on
   * @yields {object} event object with {kind, source, sourceId, attrs, raw}
   */
  * events(opts) {
    if (!this._intuiWindow) {
      throw new Error('Window.events: window is not open; call open() first');
    }

    /* WINDOW_SigMask is the (1<<bit) mask for our window's signal —
     * Wait() takes it directly. window.class fills it in at WM_OPEN. */
    let winSig = this.get('sigMask') >>> 0;
    if (!winSig) {
      throw new Error(
        'Window.events: WINDOW_SigMask returned 0 — window not properly opened'
      );
    }

    let extraSig = (opts && typeof opts.extraSignals === 'number')
      ? (opts.extraSignals >>> 0) : 0;
    let waitMask = (winSig | extraSig) >>> 0;

    /* Lazy-allocate the UWORD slot WM_HANDLEINPUT writes into. */
    if (!this._codeBuf) {
      this._codeBuf = globalThis.amiga.allocMem(2);
      if (!this._codeBuf) {
        throw new Error('Window.events: allocMem(2) failed for code buffer');
      }
    }

    let Exec = globalThis.amiga.Exec;

    while (this.ptr) {
      /* Wait() returns the bitmask of signals that satisfied the wait. */
      let got = Exec.Wait(waitMask) >>> 0;

      /* Drain every queued event from the window's UserPort. We do
       * this unconditionally: even on a "timer-only" wakeup, pending
       * Intuition messages may still be queued. */
      let result;
      while ((result = this.doMethod(WM_HANDLEINPUT, this._codeBuf) >>> 0) !==
             WMHI.LASTMSG) {

        /* WMHI.IGNORE = ~0L; window.class returns it for messages it
         * processed internally and we should not act on. Skip rather
         * than yield. */
        if (result === WMHI.IGNORE) continue;

        let code = globalThis.amiga.peek16(this._codeBuf);
        let event = this._translateWmhi(result, code);
        this._fire(event);
        yield event;
      }

      /* After draining Intuition, surface any non-window signals that
       * fired. extraFired is the caller's requested mask intersected
       * with what Wait() actually returned. */
      if (extraSig) {
        let extraFired = (got & extraSig) >>> 0;
        if (extraFired) {
          let event = {
            kind: EventKind.SIGNAL,
            source: null,
            sourceId: null,
            attrs: { sigMask: extraFired },
            raw: { waitReturned: got, classRaw: 0 },
          };
          this._fire(event);
          yield event;
        }
      }
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
    if (this._codeBuf) {
      globalThis.amiga.freeMem(this._codeBuf, 2);
      this._codeBuf = 0;
    }
    super.dispose();
  }
}
