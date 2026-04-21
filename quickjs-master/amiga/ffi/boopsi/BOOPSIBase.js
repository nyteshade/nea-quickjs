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
  /* 'string-owned' is handled in BOOPSIBase._buildTagList — allocs
   * a C-string and tracks it for later free(). Decode same as 'string'. */
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

    /* Memory we own and must free at dispose: strings allocated for
     * 'string-owned' attrs. Each entry is { ptr, size }. */
    /** @type {Array<{ptr: number, size: number}>} */
    this._ownedStrings = [];

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

    let tags = this._buildTagList(cleanInit);
    let tagBytes = tags.bytes;

    try {
      let raw = globalThis.amiga.Intuition.NewObjectA(
        0, classPtr, tags.ptr
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
   * Build a TagItem array from an init object using this class's
   * ATTRS table. Handles 'string-owned' by allocating + tracking for
   * later free. Returns { ptr, bytes } for the caller's freeMem.
   *
   * @param   {object} initObj
   * @returns {{ptr: number, bytes: number}}
   */
  _buildTagList(initObj) {
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

    if (pairs.length === 0) {
      return { ptr: 0, bytes: 0 };
    }

    let ptr = globalThis.amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;
    return { ptr, bytes };
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
    if (raw === null) return null;

    let codec = ATTR_TYPES[desc.type];
    if (!codec) return raw;
    return codec.decode(raw);
  }

  /**
   * Batch-update attributes. Builds a single TagItem list from the
   * supplied object and calls Intuition.SetAttrsA, which internally
   * dispatches OM_SET. Unknown attrs throw. 'string-owned' values
   * are tracked so they're freed when the BOOPSI object is disposed.
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

    let tags = this._buildTagList(patch);

    try {
      if (tags.ptr) {
        globalThis.amiga.Intuition.SetAttrsA(this.ptr, tags.ptr);
      }
    }

    finally {
      if (tags.ptr) globalThis.amiga.freeMem(tags.ptr, tags.bytes);
    }
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
