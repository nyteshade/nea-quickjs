/* quickjs-master/amiga/ffi/boopsi/BOOPSIBase.js
 *
 * Root of the JS-side BOOPSI / Reaction class hierarchy. Models a
 * single BOOPSI object by its pointer and dispatches all operations
 * through the Intuition IDoMethod macro (implemented in JS via
 * amiga.doMethod, backed by the amiga_boopsi_call.s trampoline in
 * quickjs.library 0.137+).
 *
 * Subclasses override:
 *   static _classLibName  — e.g. 'window.class', 'button.gadget'
 *   static _classLibLvo   — LVO of XXX_GetClass (default -30)
 *   static ATTRS          — per-class attribute table driving the
 *                            property proxies and batch .set()
 *
 * Each concrete class mixes its own attributes into ATTRS — and
 * optionally its own EventKind cases at module load time.
 *
 * Lifecycle:
 *   new Window({ title, ..., children: [...] })
 *     ├─ opens window.class lazily, caches Class*
 *     ├─ builds TagItem list from init object via ATTRS table
 *     ├─ Intuition.NewObjectA(class*, tagList) → BOOPSI ptr
 *     └─ addChild() each child; children get _parent = this
 *   win.dispose()
 *     ├─ Walks children depth-first, _markDisposed on each
 *     ├─ Root calls Intuition.DisposeObject which cascades natively
 *     └─ sets ptr = 0, _disposed = true
 */

/**
 * Attribute-type codec registry. Per-class ATTRS tables reference
 * these to decide how a JS value becomes a ULONG tag value (and
 * back on OM_GET).
 *
 * Types:
 *   'bool'     — JS boolean → 0/1
 *   'int32'    — JS number  → int32 (| 0)
 *   'uint32'   — JS number  → uint32 (passes pointers too)
 *   'string'   — JS string  → caller-managed STRPTR (no ownership)
 *   'string-owned' — JS string → allocated STRPTR; wrapper frees
 *   'enum'     — JS CEnumeration case → numeric value via valueOf
 *   'ptr'      — JS ptr-or-{ptr} → numeric (ptrOf)
 *   'hook'     — reserved: will accept a JS callback via a trampoline
 */
export const ATTR_TYPES = {
  bool:         { encode: (v) => (v ? 1 : 0),
                   decode: (v) => v !== 0 },
  int32:        { encode: (v) => v | 0,
                   decode: (v) => v | 0 },
  uint32:       { encode: (v) => (v >>> 0),
                   decode: (v) => (v >>> 0) },
  string:       { encode: (v) => (typeof v === 'number' ? v : 0),
                   decode: (v) => (v ? globalThis.amiga.peekString(v, 256) : null) },
  /* 'string-owned' encode is handled specially in BOOPSIBase._buildTagList
   * (allocs a C-string and tracks it for free at dispose). The encode
   * here is only a fallback for SetAttrsA paths and pre-allocated
   * STRPTR values. Decode peeks the STRPTR returned by OM_GET. */
  'string-owned': { encode: (v) => (typeof v === 'number' ? v : 0),
                     decode: (v) => (v ? globalThis.amiga.peekString(v, 256) : null) },
  ptr:          { encode: (v) => (v && typeof v === 'object' && 'ptr' in v) ? (v.ptr | 0) : (v | 0),
                   decode: (v) => v | 0 },
  enum:         { encode: (v) => (v && typeof v === 'object') ? Number(v) : (v | 0),
                   decode: (v) => v | 0 },
};

/**
 * Root JS class for every BOOPSI / Reaction object wrapper.
 */
export class BOOPSIBase {
  /** @type {string} — subclasses override */
  static _classLibName = '';

  /** @type {number} — LVO of XXX_GetClass in the backing library (NDK convention = -30) */
  static _classLibLvo = -30;

  /** @type {number} — cached pointer returned by the class library's GetClass; 0 until ensureClass() */
  static _classPtr = 0;

  /** @type {number} — cached library base for the .class/.gadget/.image lib */
  static _libBase = 0;

  /**
   * Per-class attribute descriptor table. Each entry:
   *   name:       { tagID: number, type: string, readOnly?: boolean }
   *
   * Subclasses MUST override with their own entries. GadgetBase and
   * ImageBase contribute a superclass-level set via static getters
   * that merge GA_* / IA_* into the concrete class's own table.
   *
   * @type {Object<string, {tagID: number, type: string, readOnly?: boolean}>}
   */
  static ATTRS = {};

  /**
   * Open the backing Reaction library and cache its Class* pointer.
   * Most Reaction libraries expose a XXX_GetClass() function at
   * LVO -30 that returns the Class*.
   *
   * @returns {number} cached Class* pointer
   * @throws  {Error}  if the library can't be opened or GetClass fails
   */
  static ensureClass() {
    if (this._classPtr) return this._classPtr;

    if (!this._classLibName) {
      throw new Error(
        this.name + ': static _classLibName must be set'
      );
    }

    let base = globalThis.amiga.openLibrary(this._classLibName, 40);
    if (!base) {
      throw new Error(
        this.name + ': cannot open ' + this._classLibName +
        ' (v40+ required)'
      );
    }

    let classPtr = globalThis.amiga.call(base, this._classLibLvo, {});
    if (!classPtr) {
      globalThis.amiga.closeLibrary(base);
      throw new Error(
        this.name + ': ' + this._classLibName +
        '.GetClass (LVO ' + this._classLibLvo + ') returned 0'
      );
    }

    this._libBase  = base;
    this._classPtr = classPtr;
    return classPtr;
  }

  /**
   * Construct a BOOPSI object.
   *
   * @param {object|number} init — init object (field names matching
   *   ATTRS keys) OR a raw BOOPSI pointer to wrap without creating
   *   a new instance.
   */
  constructor(init) {
    /** @type {number} */ this.ptr         = 0;
    /** @type {BOOPSIBase|null} */ this._parent     = null;
    /** @type {BOOPSIBase[]} */    this._children   = [];
    /** @type {boolean} */         this._disposed   = false;
    /** @type {Map<string, Function>} */ this._handlers = new Map();

    /* GA_ID assigned via init.id (if any). Tracked on the JS side so
     * Window._translateMessage can resolve event.source from the
     * IDCMPUPDATE TagList without round-tripping to OM_GET. */
    /** @type {number|null} */
    this._id = (init && typeof init === 'object' &&
                typeof init.id === 'number') ? (init.id >>> 0) : null;

    /* Memory we own and must free at dispose: strings allocated for
     * 'string-owned' attrs. Each entry is { ptr, size }. */
    /** @type {Array<{ptr: number, size: number}>} */
    this._ownedStrings = [];

    /* Remembered attribute set used to rebuild this object if a live
     * .set() needs to go through the dispose-and-replace path (images
     * in particular — LABEL_Text et al are OM_NEW-applicable only per
     * label_ic.doc, so the NDK-canonical way to change them at runtime
     * is CHILD_ReplaceObject with a fresh instance). Set to null for
     * wrap-only constructions. */
    /** @type {object|null} */
    this._initAttrs = null;

    if (typeof init === 'number') {
      this.ptr = init | 0;
      this._wrappingOnly = true;
      return;
    }

    /* Fresh instantiation: open the class library, build the tags,
     * call Intuition.NewObjectA. */
    let classPtr = this.constructor.ensureClass();
    let initObj  = init || {};

    /* Extract children BEFORE we build the tag list — they're added
     * via OM_ADDMEMBER after construction, not as tags. */
    let children = initObj.children;
    let cleanInit = { ...initObj };
    delete cleanInit.children;

    /* Snapshot for dispose-replace. We intentionally strip children +
     * _extraPairs — repeated-tag constructs aren't meaningful for a
     * replacement instance, and children are re-adopted separately. */
    let attrSnapshot = { ...cleanInit };
    delete attrSnapshot._extraPairs;
    this._initAttrs = attrSnapshot;

    let tags = this._buildTagList(cleanInit);
    let tagBytes = tags.bytes;

    try {
      /* Intuition.NewObjectA(class, classID, tagList) — a0/a1/a2.
       * We always instantiate from a private Class* (returned by the
       * class library's XXX_GetClass), so classID is NULL. */
      let raw = globalThis.amiga.Intuition.NewObjectA(
        classPtr, 0, tags.ptr
      );

      if (!raw) {
        throw new Error(
          this.constructor.name + ': NewObjectA returned 0 — ' +
          'class ' + this.constructor._classLibName +
          ' rejected the tag list'
        );
      }

      this.ptr = raw;
      this._wrappingOnly = false;
    }

    finally {
      if (tags.ptr) globalThis.amiga.freeMem(tags.ptr, tagBytes);
    }

    /* Attach children declared in the init object. */
    if (Array.isArray(children)) {
      for (let child of children) {
        this.addChild(child);
      }
    }
  }

  /**
   * Build the raw [tagID, value] pairs from an init object against
   * this class's ATTRS table. 'string-owned' values allocate fresh
   * memory and track it on `this._ownedStrings` for later free.
   *
   * Separated from `_pairsToTags` so callers that need to mutate the
   * list (e.g. BOOPSIBase.set() wrapping an image update with a
   * LAYOUT_ModifyChild prefix before handing to SetGadgetAttrsA) can
   * work at the pair level without re-encoding.
   *
   * @param   {object} initObj
   * @returns {Array<[number, number]>} encoded pair list
   */
  _buildPairs(initObj) {
    let attrs = this.constructor.ATTRS;
    let pairs = [];

    for (let key in initObj) {
      /* `_extraPairs` is a caller-supplied escape hatch for repeated
       * tag IDs that the ATTRS-key-map can't express (e.g. Reaction's
       * LAYOUT_AddChild, which appears once per child in the tag list). */
      if (key === '_extraPairs') continue;

      let desc = attrs[key];

      if (!desc) {
        throw new Error(
          this.constructor.name + ': unknown attribute "' + key + '"'
        );
      }

      if (desc.readOnly) {
        throw new Error(
          this.constructor.name + ': attribute "' + key +
          '" is read-only'
        );
      }

      let value = initObj[key];
      let tagValue;

      if (desc.type === 'string-owned') {
        if (typeof value === 'string') {
          let bytes = value.length + 1;
          let p = globalThis.amiga.allocMem(bytes);
          if (!p) throw new Error('allocMem failed for ' + key);
          globalThis.amiga.pokeString(p, value);
          this._ownedStrings.push({ ptr: p, size: bytes });
          tagValue = p;
        }

        else {
          /* Number or pre-allocated STRPTR — caller-managed. */
          tagValue = (value | 0);
        }
      }

      else {
        let codec = ATTR_TYPES[desc.type];
        if (!codec) {
          throw new Error(
            'unknown attr type "' + desc.type + '" for ' + key
          );
        }
        tagValue = codec.encode(value);
      }

      pairs.push([desc.tagID | 0, tagValue]);
    }

    /* Append the escape-hatch pairs verbatim. Each entry is
     * [tagID, value] with both already encoded. */
    if (Array.isArray(initObj._extraPairs)) {
      for (let p of initObj._extraPairs) {
        pairs.push(p);
      }
    }

    return pairs;
  }

  /**
   * Marshal a pair list into an on-heap TagItem array via makeTags.
   * Returns {ptr, bytes} — an empty pair list returns {ptr: 0}.
   *
   * @param   {Array<[number, number]>} pairs
   * @returns {{ptr: number, bytes: number}}
   */
  _pairsToTags(pairs) {
    if (!pairs || pairs.length === 0) {
      return { ptr: 0, bytes: 0 };
    }
    let ptr = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;
    return { ptr, bytes };
  }

  /**
   * Build a complete TagItem array from an init object (pairs +
   * marshal). Shorthand used by the NewObjectA path in the ctor.
   *
   * @param   {object} initObj
   * @returns {{ptr: number, bytes: number}}
   */
  _buildTagList(initObj) {
    return this._pairsToTags(this._buildPairs(initObj));
  }

  /**
   * Walk the JS-side parent chain looking for the nearest ancestor
   * that represents an open Intuition window. Returns the struct
   * Window* as a number, or 0 if no open window is in scope.
   *
   * Used by set() to decide whether a live refresh path
   * (SetGadgetAttrsA) is possible. Before the root window opens, or
   * for orphaned wrappers, there's no window pointer and plain
   * SetAttrsA is the right call.
   *
   * @returns {number} struct Window * or 0
   */
  _findWindowPtr() {
    let node = this;
    while (node) {
      let iw = node._intuiWindow;
      if (iw) {
        if (typeof iw === 'number') return iw | 0;
        if (iw && typeof iw === 'object' && 'ptr' in iw) return iw.ptr | 0;
      }
      node = node._parent;
    }
    return 0;
  }

  /**
   * Find the nearest ancestor that IS a ReactionWindow whose window
   * is currently open (identified by a non-null _intuiWindow). This
   * is the object DoMethod(win, WM_RETHINK) needs to be dispatched
   * to — the window.class handles the full layout-rethink + repaint
   * coordination internally.
   *
   * @returns {BOOPSIBase|null}
   */
  _findWindowAncestor() {
    let node = this;
    while (node) {
      if (node._intuiWindow) return node;
      node = node._parent;
    }
    return null;
  }

  /**
   * From a given ReactionWindow BOOPSIBase, return the root Layout
   * pointer — the gadget passed in via WINDOW_Layout and then
   * addChild()ed into Window._children at ReactionWindow construction.
   * Returns 0 if the window has no layout child.
   *
   * Needed because Intuition.RefreshGList requires a struct Gadget *
   * to start refreshing from; passing the root layout with
   * numGadgets=-1 tells Intuition to repaint the entire gadget
   * subtree plus the window frame.
   *
   * @param  {BOOPSIBase} winObj — the ReactionWindow
   * @returns {number} struct Gadget * of root layout, or 0
   */
  _rootLayoutPtr(winObj) {
    if (!winObj || !Array.isArray(winObj._children) ||
        winObj._children.length === 0) return 0;
    let root = winObj._children[0];
    return (root && root.ptr) ? (root.ptr | 0) : 0;
  }

  /**
   * Find the nearest Layout-flagged ancestor (including `this` if it
   * is one). Used to pick the correct object for LAYOUT_ModifyChild
   * dispatch in set().
   *
   * @returns {BOOPSIBase|null}
   */
  _findLayoutAncestor() {
    let node = this;
    while (node) {
      if (node.constructor._isLayout) return node;
      node = node._parent;
    }
    return null;
  }

  /**
   * Dispatch a BOOPSI method. `methodID` and up to 7 payload ULONGs
   * are packed into an on-the-fly message struct, dispatched via
   * amiga.doMethod (which reads the class pointer from obj-4 and
   * calls cl_Dispatcher), then the struct is freed. Returns the
   * ULONG the dispatcher returned.
   *
   * @param   {number} methodID
   * @param   {...number} args — up to 7 ULONG payload slots
   * @returns {number}
   */
  doMethod(methodID, ...args) {
    if (!this.ptr) {
      throw new Error(
        this.constructor.name + '.doMethod: object is disposed'
      );
    }

    let msgWords = 1 + args.length;
    let bytes = msgWords * 4;
    let msg = globalThis.amiga.allocMem(bytes);

    if (!msg) throw new Error('doMethod: allocMem failed');

    try {
      globalThis.amiga.poke32(msg, methodID | 0);

      for (let i = 0; i < args.length; i++) {
        globalThis.amiga.poke32(msg + 4 + i * 4, args[i] | 0);
      }

      return globalThis.amiga.doMethod(this.ptr, msg);
    }

    finally {
      globalThis.amiga.freeMem(msg, bytes);
    }
  }

  /**
   * Read a single attribute's current value. Falls back to
   * Intuition.getAttr (which walks cl_Dispatcher via OM_GET
   * internally). Returns the decoded JS value per the ATTRS table,
   * or null if the class doesn't support the attr.
   *
   * @param   {string} name — attribute name from this class's ATTRS
   * @returns {*}
   */
  get(name) {
    let desc = this.constructor.ATTRS[name];
    if (!desc) {
      throw new Error(
        this.constructor.name + '.get: unknown attribute "' + name + '"'
      );
    }

    let raw = globalThis.amiga.Intuition.getAttr(desc.tagID, this.ptr);

    /* OM_GET fallback. Many OS3.2 BOOPSI classes (label.image is the
     * standout — LABEL_Text autodoc says OM_GET but in practice it
     * returns 0) implement OM_GET for only a subset of their attrs.
     * Returning null when the caller just set the value moments ago
     * via set() is confusing, so fall back to _initAttrs when the
     * class didn't answer OM_GET. This is the same snapshot the
     * dispose-replace path uses to rebuild — authoritative for any
     * attr we've ever set through the wrapper. */
    if (raw === null) {
      if (this._initAttrs && name in this._initAttrs) {
        return this._initAttrs[name];
      }
      return null;
    }

    let codec = ATTR_TYPES[desc.type];
    if (!codec) return raw;
    return codec.decode(raw);
  }

  /**
   * Batch-update attributes and keep the visible UI in sync.
   *
   * Four routing paths depending on what `this` is and whether a
   * window is open — the caller never has to care, `gadget.text =
   * '...'` and `label.text = '...'` both do the right thing:
   *
   *   1. **Nothing open, any kind** → plain Intuition.SetAttrsA.
   *      No render path is live yet; the first WM_OPEN's render
   *      picks up the current internal state.
   *
   *   2. **Gadget inside an open window** → Intuition.SetGadgetAttrsA
   *      (gadget, window, 0, tags). The RKRM Common Gadgets chapter:
   *      *"remember to use SetGadgetAttrs so the gadget can update
   *      it's presence on screen."* SetGadgetAttrs internally handles
   *      OM_SET + the layout-safe repaint for gadgets.
   *
   *   3. **Image inside an open window, with a gadget parent
   *      (typical: Label inside a Layout)** → dispose-and-replace.
   *      Most image-class attrs (LABEL_Text, BEVEL_* styling, etc.)
   *      are OM_NEW-applicable only per the class autodocs, so
   *      changing them on a live image never actually repaints. The
   *      NDK-canonical pattern (Examples/Layout2.c:241-254) is:
   *
   *          newChild = NewObject(class, NULL, new-tag-list);
   *          SetGadgetAttrs(parentLayout, win, NULL,
   *              LAYOUT_ModifyChild, oldChild,
   *              CHILD_ReplaceObject, newChild,
   *              TAG_DONE);
   *          if (DoMethod(winobj, WM_RETHINK) == 0)
   *              DoMethod(winobj, WM_NEWPREFS);
   *
   *      layout.gadget auto-disposes oldChild, rewires its internal
   *      child list, and the window rerenders cleanly — no ghost
   *      pixels, no overlay. `_disposeReplace` does this and
   *      swaps `this.ptr` onto the new instance so the JS-side
   *      wrapper identity survives.
   *
   *      Cost: every update allocates a new BOOPSI object. For
   *      frequently-changing text (timer ticks, live counters)
   *      prefer a read-only StringGadget instead.
   *
   *   4. **Image with no gadget parent, or other edge cases** →
   *      plain SetAttrsA. Rare path; no sensible refresh possible.
   *
   * 'string-owned' values are allocated in `_buildPairs` and tracked
   * on `_ownedStrings` for free-at-dispose. The dispose-replace path
   * accumulates owned strings across updates; they're all freed when
   * the JS wrapper itself is disposed.
   *
   * @param   {object} patch
   * @returns {undefined}
   */
  set(patch) {
    if (!this.ptr) {
      throw new Error(
        this.constructor.name + '.set: object is disposed'
      );
    }

    let winObj = this._findWindowAncestor();
    let winPtr = winObj ? this._findWindowPtr() : 0;
    let kind   = this.constructor._boopsiKind;

    let pairs = this._buildPairs(patch);
    if (pairs.length === 0) return;

    let tags = this._pairsToTags(pairs);
    try {
      if (winPtr && kind === 'gadget') {
        /* Gadget in open window. SetGadgetAttrsA dispatches OM_SET via
         * the class's cl_Dispatcher, which updates internal state and
         * returns ≥1 if the change requires a visual refresh, 0 otherwise
         * (intuition autodoc / imageclass OM_SET convention). Note that
         * SetGadgetAttrsA does NOT auto-render — that's the caller's
         * responsibility per RKRM Common Gadgets. Comments here at 0.158
         * incorrectly assumed self-refresh; in practice, classes like
         * CheckBox return ≥1 from OM_SET (state changed) but never
         * redraw without an explicit RethinkLayout/RefreshGList — the
         * symptom user reported on todo_demo at 0.170 (Clear All resets
         * state but checkboxes stay visually checked). */
        let rc = globalThis.amiga.Intuition.SetGadgetAttrsA(
          this.ptr, winPtr, 0, tags.ptr
        ) | 0;

        /* Class signalled "needs refresh". RethinkLayout on the nearest
         * Layout ancestor re-flows + repaints all children — covers
         * size-changing attrs (which need re-layout) and pure-visual
         * attrs (which just need GM_RENDER) with one canonical call.
         * Skip self if `this` is a Layout — Layout subclasses with
         * special-case set() (e.g. Page) call rethink-self directly. */
        if (rc >= 1) {
          let layoutAncestor = this._findLayoutAncestor();
          if (layoutAncestor === this) {
            /* Walk one level up so we don't double-rethink self. */
            layoutAncestor = (this._parent && this._parent._findLayoutAncestor)
              ? this._parent._findLayoutAncestor()
              : null;
          }
          if (layoutAncestor && typeof layoutAncestor.rethink === 'function') {
            try { layoutAncestor.rethink(winPtr, true); }
            catch (e) { /* non-fatal — internal-state update already landed */ }
          }
        }
      }
      else {
        /* Everything else — no window yet (pre-open init), image
         * child (labels/bevels/etc), or an orphan wrapper — gets
         * plain OM_SET. Updates internal state; next render picks
         * it up. Note for images: OS3.2's layout.gadget will not
         * visually refresh an image whose LAYOUT_AddImage-style
         * content changes at runtime; _disposeReplace (below) is
         * the documented NDK-canonical refresh path (LAYOUT_Modify
         * Child + CHILD_ReplaceImage + WM_RETHINK) but testing on
         * an actual OS3.2 system revealed it destabilises the
         * layout (window grows unboundedly, eventual hang). The
         * tag-level semantics are apparently different from the
         * autodoc suggestions and we don't have a reliable fix
         * without more OS3.2-specific guidance. For runtime-
         * mutable text, Label.js JSDoc points users at read-only
         * StringGadget, which does refresh cleanly. */
        globalThis.amiga.Intuition.SetAttrsA(this.ptr, tags.ptr);
      }
    }
    finally {
      if (tags.ptr) globalThis.amiga.freeMem(tags.ptr, tags.bytes);
    }
  }

  /**
   * @internal UNUSED on OS3.2 — DO NOT CALL.
   *
   * Dispose-and-replace refresh for image children of a live layout.
   * Intended to be the NDK-canonical runtime-update path per
   * Examples/Layout2.c: build a fresh BOOPSI, dispatch
   * LAYOUT_ModifyChild + CHILD_ReplaceImage on the parent layout,
   * WM_RETHINK.
   *
   * Tested on AmigaOS 3.2 and found to destabilise the layout —
   * after the first replacement the window grew taller on each
   * subsequent call, eventually hanging the OS. The tag-level
   * behavior of CHILD_ReplaceImage on 3.2 differs from the autodoc
   * implications (possibly it requires LAYOUT_ModifyImage as subject
   * — which NDK 3.2R4 gadgets/layout.h does not define — rather
   * than LAYOUT_ModifyChild). Reverted to plain SetAttrsA for image
   * set() paths; dynamic-text use cases should use read-only
   * StringGadget per the guidance in Label.js JSDoc.
   *
   * Left in the code as a reference implementation for future
   * investigation when we have better OS3.2-specific documentation
   * of CHILD_ReplaceImage semantics.
   *
   * @param {object} patch
   * @param {BOOPSIBase} winObj  — ReactionWindow ancestor
   * @param {number}     winPtr  — struct Window *
   */
  _disposeReplace(patch, winObj, winPtr) {
    /* Merge remembered construction attrs with the patch — then we
     * have the full set of NewObject tags for the replacement. */
    let mergedInit = Object.assign({}, this._initAttrs || {}, patch);
    let classPtr = this.constructor.ensureClass();

    /* Build the new BOOPSI. _buildPairs allocates fresh string-owned
     * buffers and pushes them onto this._ownedStrings; they remain
     * live for the lifetime of the wrapper (the new BOOPSI refers to
     * them, and subsequent replacements create fresh buffers). */
    let newPairs = this._buildPairs(mergedInit);
    let newTags  = this._pairsToTags(newPairs);
    let newPtr;

    try {
      newPtr = globalThis.amiga.Intuition.NewObjectA(
        classPtr, 0, newTags.ptr
      );
      if (!newPtr) {
        throw new Error(
          this.constructor.name +
          '._disposeReplace: NewObjectA returned 0'
        );
      }
    }
    finally {
      if (newTags.ptr) globalThis.amiga.freeMem(newTags.ptr, newTags.bytes);
    }

    /* Image children need CHILD_ReplaceImage, NOT CHILD_ReplaceObject.
     * gadgets/layout.h:
     *   #define LAYOUT_ModifyChild  (LAYOUT_Dummy+22) = 0x85007016
     *   #define CHILD_ReplaceObject (CHILD_Dummy+7)   = 0x85007107
     *   #define CHILD_ReplaceImage  (LAYOUT_Dummy+8)  = 0x85007008
     *
     * CHILD_ReplaceObject installs the new child as a gadget and
     * calls GM_RENDER on it — fine for a Button→CheckBox swap
     * (Layout2.c pattern), but imageclass has no GM_RENDER, so an
     * image swapped in this way draws nothing. CHILD_ReplaceImage
     * is the image-specific variant — the replacement is marked
     * as an imageclass child and drawn via IM_DRAW, matching how
     * LAYOUT_AddImage would have inserted it originally.
     *
     * This function is only called for image kinds (the caller in
     * set() gates on kind === 'image'), so we always use
     * CHILD_ReplaceImage here. */
    let replaceTags = this._pairsToTags([
      [0x85007016, this.ptr],    /* LAYOUT_ModifyChild */
      [0x85007008, newPtr],      /* CHILD_ReplaceImage */
    ]);

    try {
      globalThis.amiga.Intuition.SetGadgetAttrsA(
        this._parent.ptr, winPtr, 0, replaceTags.ptr
      );
    }
    finally {
      if (replaceTags.ptr) {
        globalThis.amiga.freeMem(replaceTags.ptr, replaceTags.bytes);
      }
    }

    /* layout.gadget has now disposed the old BOOPSI and installed
     * newPtr in its place; swing our wrapper onto the new one and
     * remember the merged attrs for the next replacement. */
    this.ptr = newPtr;
    this._initAttrs = mergedInit;

    /* Force relayout + repaint. Per NDK Examples/Layout2.c:
     *   if (DoMethod(winobj, WM_RETHINK) == 0)
     *       DoMethod(winobj, WM_NEWPREFS);
     * WM_RETHINK returns 0 when it had nothing to do; in that case
     * fall back to WM_NEWPREFS which forces a full refresh. */
    let r = winObj.doMethod(0x570006 /* WM_RETHINK */);
    if (r === 0) winObj.doMethod(0x570004 /* WM_NEWPREFS */);
  }

  /**
   * Attach a child BOOPSI object. Default impl just tracks it on the
   * JS side; concrete classes (Layout, Window) override to dispatch
   * OM_ADDMEMBER on the appropriate container.
   *
   * @param   {BOOPSIBase} child
   * @returns {BOOPSIBase} this for chaining
   */
  addChild(child) {
    child._parent = this;
    this._children.push(child);
    return this;
  }

  /**
   * Register an event handler. The event-pump in Window.events()
   * dispatches matching events to these handlers before yielding to
   * the iterator.
   *
   * @param {EventKind|string} kind — EventKind case or case key
   * @param {Function}         handler — fn(event) => void
   * @returns {BOOPSIBase} this for chaining
   */
  on(kind, handler) {
    let key = (typeof kind === 'string')
      ? kind
      : (kind && kind.key) || String(kind);
    this._handlers.set(key, handler);
    return this;
  }

  /**
   * Dispatch an event to any registered handler. Used by the Window
   * event pump. No-op if no handler is registered for that kind.
   *
   * @param {object} event — { kind, source, sourceId, attrs, raw }
   * @returns {undefined}
   */
  _fire(event) {
    let kindKey = event.kind && event.kind.key;
    if (!kindKey) return;

    let handler = this._handlers.get(kindKey);
    if (handler) handler(event);

    /* Bubble to children that registered on the same kind. */
    for (let c of this._children) {
      if (c._handlers.has(kindKey)) {
        c._handlers.get(kindKey)(event);
      }
    }
  }

  /**
   * Release this object. For child objects, just marks as disposed —
   * the real DisposeObject happens when the root is disposed and
   * Intuition cascades down the BOOPSI hierarchy.
   *
   * @returns {undefined}
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    /* Only the root runs DisposeObject; children are freed by the
     * cascade. */
    if (this._parent === null && this.ptr && !this._wrappingOnly) {
      globalThis.amiga.Intuition.DisposeObject(this.ptr);
    }

    /* Propagate disposed flag down so JS-side references are sane. */
    for (let c of this._children) c._markDisposed();
    this._children = [];

    /* Release strings we own. */
    for (let s of this._ownedStrings) {
      globalThis.amiga.freeMem(s.ptr, s.size);
    }
    this._ownedStrings = [];

    this.ptr = 0;
  }

  /**
   * @internal Child-cascade helper; called by parent.dispose().
   */
  _markDisposed() {
    this._disposed = true;
    for (let c of this._children) c._markDisposed();
    this._children = [];
    for (let s of this._ownedStrings) {
      globalThis.amiga.freeMem(s.ptr, s.size);
    }
    this._ownedStrings = [];
    this.ptr = 0;
  }

  /**
   * Symbol.toStringTag returns the class name so console.log and
   * Object.prototype.toString show "[object BOOPSI.Button]" rather
   * than the generic "[object Object]".
   *
   * @returns {string}
   */
  get [Symbol.toStringTag]() {
    return 'BOOPSI.' + this.constructor.name;
  }
}

/**
 * Standard BOOPSI method IDs from intuition/classusr.h. Exported so
 * class wrappers can reference without magic numbers.
 */
export const OM = Object.freeze({
  NEW:        1,
  DISPOSE:    2,
  SET:        3,
  UPDATE:     4,
  NOTIFY:     5,
  GET:        6,
  ADDMEMBER:  7,
  REMMEMBER:  8,
  ADDTAIL:   11,
  REMOVE:    12,
});
