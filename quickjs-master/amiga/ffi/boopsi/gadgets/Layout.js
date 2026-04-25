/* quickjs-master/amiga/ffi/boopsi/gadgets/Layout.js
 *
 * layout.gadget — Reaction's horizontal/vertical arranger. Extends
 * gadgetclass. Children are added via OM_ADDMEMBER; Reaction then
 * handles positioning automatically based on LAYOUT_Orientation and
 * the children's minimum sizes.
 *
 * LAYOUT_Dummy = REACTION_Dummy + 0x7000 = 0x85007000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { ImageBase } from '../ImageBase.js';
import { OM } from '../BOOPSIBase.js';
import { Label } from '../images/Label.js';

/** @internal ICA_* tag IDs (intuition/icclass.h). ICTARGET_IDCMP is the
 * sentinel that turns OM_NOTIFY broadcasts into IDCMP_IDCMPUPDATE
 * messages on the window's UserPort. Without it, layout.gadget's
 * LAYOUT_RelVerify notifications go nowhere. */
const ICA_TARGET     = 0x80040001;  /* ICA_Dummy + 1 */
const ICTARGET_IDCMP = 0xFFFFFFFF;  /* ~0L per icclass.h:45 */

/** @internal LAYOUT_* tag IDs (gadgets/layout.h) */
const LAYOUT = Object.freeze({
  Orientation:     0x85007001,
  FixedHoriz:      0x85007002,
  FixedVert:       0x85007003,
  HorizAlignment:  0x85007004,
  VertAlignment:   0x85007005,
  ShrinkWrap:      0x85007006,
  EvenSize:        0x85007007,
  InnerSpacing:    0x85007009,
  TopSpacing:      0x8500700A,
  BottomSpacing:   0x8500700B,
  LeftSpacing:     0x8500700C,
  RightSpacing:    0x8500700D,
  BevelState:      0x8500700E,
  BevelStyle:      0x8500700F,
  Label:           0x85007010,
  LabelImage:      0x85007011,
  LabelPlace:      0x85007012,
  /* LAYOUT_AddChild is the canonical way to add a child to a
   * layout.gadget — pass it as a tag at NewObject time with the
   * child Object* as value. It may appear multiple times in the
   * same tag list; Reaction accumulates each into the child chain.
   * Our ATTRS-key-map can't express a repeated tag, so we handle
   * this specially in Layout.constructor via BOOPSIBase._extraPairs. */
  AddChild:        0x85007014,
  AddImage:        0x85007015,
  /* CHILD_* tags follow LAYOUT_AddChild in the OM_NEW tag list and
   * apply to the most-recent child. CHILD_Dummy = LAYOUT_Dummy + 0x100
   * = 0x85007100; layout_gc.doc tags from gadgets/layout.h:302-388. */
  ChildMinWidth:       0x85007101,
  ChildMinHeight:      0x85007102,
  ChildMaxWidth:       0x85007103,
  ChildMaxHeight:      0x85007104,
  ChildWeightedWidth:  0x85007105,
  ChildWeightedHeight: 0x85007106,
  ChildLabel:          0x8500710C,
  ChildNoDispose:      0x8500710D,
  /* LAYOUT_ModifyChild — OM_SET-time tag that tells layout.gadget the
   * subsequent tags in the taglist apply to the named child object.
   * Used by BOOPSIBase.set() when forwarding an image child's attr
   * update through its parent layout so the layout can re-lay-out
   * and redraw the image (images have no GM_RENDER of their own).
   * Layout_gc.doc: "You *MUST* call through SetGadgetAttrs() to
   * protect the window layout properly." */
  ModifyChild:     0x85007016,
  /* LAYOUT_RelVerify enables IDCMP_IDCMPUPDATE broadcasts when any
   * child gadget with GA_RelVerify=TRUE releases. Per layout_gc.doc
   * lines 320-330: without this bit, button/checkbox/etc clicks
   * never produce any IntuiMessage on the window UserPort. The
   * broadcast's TagList contains GA_ID + LAYOUT_RelVerify + LAYOUT_RelCode. */
  RelVerify:       0x85007017,
  RelCode:         0x85007018,
  TabVerify:       0x85007021,
});

/**
 * Orientation values for LAYOUT_Orientation:
 *   LAYOUT_HORIZONTAL = 0
 *   LAYOUT_VERTICAL   = 1
 */
export const LayoutOrient = Object.freeze({
  HORIZONTAL: 0,
  VERTICAL:   1,
});

/**
 * layout.gadget — Reaction's arranger.
 *
 * @extends GadgetBase
 */
export class Layout extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/layout.gadget';

  /** @type {true} — BOOPSIBase.set() walks _parent chains looking
   *  for the nearest ancestor flagged with _isLayout so it knows
   *  which object to RethinkLayout() after an OM_SET. Page/Virtual
   *  subclasses inherit this flag. */
  static _isLayout = true;

  /**
   * layout.gadget/RethinkLayout (v39+) — relayout the page and
   * re-render. Per layout_gc.doc line 598 the OM_SET path does NOT
   * auto-rerender; you must call RethinkLayout yourself after any
   * SetGadgetAttrs() that changed a layout-relevant attribute
   * (including LAYOUT_ModifyChild on an image child). a0=layout,
   * a1=window, a2=requester, d0=refresh.
   *
   * LVO -48 on layout.gadget; we reach that library through the
   * BOOPSIBase._libBase cached by ensureClass() (since we've already
   * opened layout.gadget to instantiate the class).
   *
   * @param {number|object} layoutPtr — struct Gadget * (the layout)
   * @param {number|object} winPtr    — struct Window *
   * @param {number|object} reqPtr    — struct Requester * or 0
   * @param {boolean|number} refresh  — true to also repaint
   * @returns {number}
   */
  static RethinkLayout(layoutPtr, winPtr, reqPtr, refresh) {
    this.ensureClass();
    return globalThis.amiga.call(this._libBase, -48, {
      a0: (layoutPtr && typeof layoutPtr === 'object')
            ? (layoutPtr.ptr | 0) : (layoutPtr | 0),
      a1: (winPtr && typeof winPtr === 'object' && 'ptr' in winPtr)
            ? (winPtr.ptr | 0) : (winPtr | 0),
      a2: (reqPtr && typeof reqPtr === 'object' && 'ptr' in reqPtr)
            ? (reqPtr.ptr | 0) : (reqPtr | 0),
      d0: refresh ? 1 : 0,
    });
  }

  /**
   * Instance form: relayout + redraw this layout in the given
   * window. Used by BOOPSIBase.set() after any live OM_SET.
   *
   * @param {number} winPtr  — struct Window *
   * @param {boolean} [refresh=true]
   * @returns {number}
   */
  rethink(winPtr, refresh) {
    return Layout.RethinkLayout(
      this.ptr, winPtr, 0, refresh === undefined ? 1 : (refresh ? 1 : 0)
    );
  }

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,

    orientation:    { tagID: LAYOUT.Orientation,    type: 'uint32' },
    horizAlignment: { tagID: LAYOUT.HorizAlignment, type: 'uint32' },
    vertAlignment:  { tagID: LAYOUT.VertAlignment,  type: 'uint32' },
    shrinkWrap:     { tagID: LAYOUT.ShrinkWrap,     type: 'bool'   },
    evenSize:       { tagID: LAYOUT.EvenSize,       type: 'bool'   },
    innerSpacing:   { tagID: LAYOUT.InnerSpacing,   type: 'int32'  },
    topSpacing:     { tagID: LAYOUT.TopSpacing,     type: 'int32'  },
    bottomSpacing:  { tagID: LAYOUT.BottomSpacing,  type: 'int32'  },
    leftSpacing:    { tagID: LAYOUT.LeftSpacing,    type: 'int32'  },
    rightSpacing:   { tagID: LAYOUT.RightSpacing,   type: 'int32'  },
    bevelState:     { tagID: LAYOUT.BevelState,     type: 'uint32' },
    bevelStyle:     { tagID: LAYOUT.BevelStyle,     type: 'uint32' },
    label:          { tagID: LAYOUT.Label,          type: 'string-owned' },
    labelImage:     { tagID: LAYOUT.LabelImage,     type: 'ptr'    },
    labelPlace:     { tagID: LAYOUT.LabelPlace,     type: 'uint32' },

    /* LAYOUT_RelVerify — enables IDCMPUPDATE broadcasts on child
     * gadgetups. Distinct from GA_RelVerify (inherited from
     * GADGET_ATTRS); both must be TRUE for events to flow. Layout
     * defaults this to TRUE in its constructor. */
    relVerifyNotify:{ tagID: LAYOUT.RelVerify,      type: 'bool'   },
    tabVerify:      { tagID: LAYOUT.TabVerify,      type: 'bool'   },
    /* ICA_TARGET — Layout's OM_NOTIFY destination. Defaults to
     * ICTARGET_IDCMP (=0xFFFFFFFF), which routes the broadcast as an
     * IDCMP_IDCMPUPDATE message on the window's UserPort. Without
     * this, LAYOUT_RelVerify=TRUE causes layout.gadget to call
     * OM_NOTIFY into the void. */
    icaTarget:      { tagID: ICA_TARGET,            type: 'uint32' },

    /* Convenience aliases matching a mental model where "orientation"
     * is a string: internally they go through the same tag. Users
     * can pass orientation: 'horizontal' / 'vertical' too. */
  };

  /**
   * Construct a Layout. Accepts:
   *   - orientation as 'horizontal' | 'vertical' string OR numeric
   *   - children: [] — each child's pointer goes into the tag list
   *     as a LAYOUT_AddChild pair, which is Reaction's canonical
   *     way to install children at construction time. Repeat-tag
   *     pairs are injected through BOOPSIBase._extraPairs.
   *
   * Children are still tracked on the JS side via `_children` for
   * the dispose cascade, but no OM_ADDMEMBER dispatch is issued —
   * the layout.gadget handles member-insertion when it sees the
   * LAYOUT_AddChild tags during NewObject.
   *
   * @param {object|number} init
   */
  constructor(init) {
    /* Normalize the input object without mutating the caller's copy. */
    let rawInit = (init && typeof init === 'object') ? { ...init } : {};

    if (typeof rawInit.orientation === 'string') {
      let m = rawInit.orientation.toLowerCase();
      rawInit.orientation = (m === 'vertical') ? LayoutOrient.VERTICAL
                                                : LayoutOrient.HORIZONTAL;
    }

    /* No defaults for relVerifyNotify or icaTarget. The canonical
     * Reaction pattern (NDK Examples/String.c et al) uses WM_HANDLEINPUT
     * via the Window class, which handles all internal routing without
     * needing LAYOUT_RelVerify or ICA_TARGET on the layout. The
     * attributes remain available for users who want to consume
     * IDCMP_IDCMPUPDATE messages directly (the Examples/Layout1.c
     * pattern, which uses raw OpenWindowTags + GetMsg). */

    /* Extract children; convert to LAYOUT_AddChild tag pairs. */
    let children = rawInit.children;
    delete rawInit.children;

    let pairs = [];

    if (Array.isArray(children)) {
      for (let c of children) {
        if (!c || !c.ptr) {
          throw new Error(
            'Layout: child in children[] has no ptr ' +
            '(disposed, wrapping-only, or not a BOOPSIBase)'
          );
        }
        /* Images (label.image, bevel.image, led.image, glyph.image,
         * bitmap.image) are rendered via IM_DRAW — layout.gadget only
         * calls IM_DRAW on children added with LAYOUT_AddImage.
         * Adding an image via LAYOUT_AddChild reserves space but never
         * draws anything because imageclass has no GM_RENDER. Per
         * layout_gc.doc LAYOUT_AddImage. */
        let tagID = (c instanceof ImageBase)
          ? LAYOUT.AddImage
          : LAYOUT.AddChild;
        pairs.push([tagID, c.ptr]);

        /* Per-child layout hints: a gadget may carry a `_childOpts`
         * descriptor that we lower to CHILD_* tags right after the
         * LAYOUT_AddChild that introduces it. Recognised keys:
         *   - label: Object* | BOOPSIBase  → CHILD_Label
         *   - minWidth / minHeight / maxWidth / maxHeight: ULONG
         *   - weightedWidth / weightedHeight: ULONG (default 100; 0
         *     locks at min)
         *   - noDispose: bool
         * The pairs land in the same OM_NEW tag list and stick to
         * the most-recent child.
         */
        let opts = c._childOpts;
        if (opts) {
          if (opts.label) {
            let lp;
            if (typeof opts.label === 'string') {
              /* Auto-construct a Label from a plain string. layout.gadget
               * will dispose the label as part of its cascade (CHILD_Label
               * defaults to NoDispose=FALSE), so we don't track on the JS
               * side — letting the auto-Label slip out of any JS reference
               * lets DisposeObject(layout) handle its lifecycle. */
              let lblObj = new Label({ text: opts.label });
              lp = lblObj.ptr;
            } else if (typeof opts.label === 'object' && 'ptr' in opts.label) {
              lp = opts.label.ptr | 0;
            } else {
              lp = opts.label | 0;
            }
            if (lp) pairs.push([LAYOUT.ChildLabel, lp]);
          }
          if (opts.minWidth   !== undefined) pairs.push([LAYOUT.ChildMinWidth,       opts.minWidth   | 0]);
          if (opts.minHeight  !== undefined) pairs.push([LAYOUT.ChildMinHeight,      opts.minHeight  | 0]);
          if (opts.maxWidth   !== undefined) pairs.push([LAYOUT.ChildMaxWidth,       opts.maxWidth   | 0]);
          if (opts.maxHeight  !== undefined) pairs.push([LAYOUT.ChildMaxHeight,      opts.maxHeight  | 0]);
          if (opts.weightedWidth  !== undefined) pairs.push([LAYOUT.ChildWeightedWidth,  opts.weightedWidth  | 0]);
          if (opts.weightedHeight !== undefined) pairs.push([LAYOUT.ChildWeightedHeight, opts.weightedHeight | 0]);
          if (opts.noDispose) pairs.push([LAYOUT.ChildNoDispose, 1]);
        }
      }
    }

    if (pairs.length) rawInit._extraPairs = pairs;

    /* Pointer-or-number; _extraPairs is detected + consumed by
     * BOOPSIBase._buildTagList. */
    super(rawInit);

    /* Track children for dispose cascade (no second OM dispatch —
     * they're already registered through the LAYOUT_AddChild tags). */
    if (Array.isArray(children)) {
      for (let c of children) {
        c._parent = this;
        this._children.push(c);
      }
    }
  }

  /**
   * Add a child to an already-constructed layout. Uses OM_ADDMEMBER,
   * the generic BOOPSI method; layout.gadget routes this to its own
   * insertion logic. Less reliable than LAYOUT_AddChild at
   * construction — prefer `new Layout({children:[...]})` when you
   * can. Needed for dynamic UIs that add/remove gadgets at runtime.
   *
   * @param {BOOPSIBase} child
   * @returns {Layout} this for chaining
   */
  addChild(child) {
    if (!child || !child.ptr) {
      throw new Error(
        'Layout.addChild: child has no ptr (disposed or wrapping-only)'
      );
    }

    this.doMethod(OM.ADDMEMBER, child.ptr);
    child._parent = this;
    this._children.push(child);
    return this;
  }

  /**
   * Remove a previously-added child. Less-common runtime op.
   *
   * @param {BOOPSIBase} child
   * @returns {Layout} this
   */
  removeChild(child) {
    this.doMethod(OM.REMMEMBER, child.ptr);
    let idx = this._children.indexOf(child);
    if (idx >= 0) this._children.splice(idx, 1);
    child._parent = null;
    return this;
  }
}
