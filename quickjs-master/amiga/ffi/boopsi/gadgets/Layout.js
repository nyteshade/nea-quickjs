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
import { OM } from '../BOOPSIBase.js';

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
        pairs.push([LAYOUT.AddChild, c.ptr]);
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
