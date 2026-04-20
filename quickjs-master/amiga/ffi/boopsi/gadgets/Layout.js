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
  static _classLibName = 'layout.gadget';

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
   * Add a child BOOPSI object to this layout via OM_ADDMEMBER. Keeps
   * the JS-side parent/child links for the dispose cascade.
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
    super.addChild(child);
    return this;
  }

  /**
   * Remove a previously-added child. Called less often than addChild.
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

  /**
   * Pre-process init objects so that the ergonomic
   * `orientation: 'horizontal'` form is accepted alongside numeric.
   *
   * @param {object|number} init
   */
  constructor(init) {
    if (init && typeof init === 'object' &&
        typeof init.orientation === 'string') {
      let m = init.orientation.toLowerCase();
      init = { ...init };
      init.orientation = (m === 'vertical') ? LayoutOrient.VERTICAL
                                             : LayoutOrient.HORIZONTAL;
    }
    super(init);
  }
}
