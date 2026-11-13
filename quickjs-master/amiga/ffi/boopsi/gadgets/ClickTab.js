/* quickjs-master/amiga/ffi/boopsi/gadgets/ClickTab.js
 *
 * clicktab.gadget — Reaction tab control. Extends gadgetclass. Tabs
 * are supplied via CLICKTAB_Labels (struct List of nodes with TNA_*
 * attributes per tab).
 *
 * CLICKTAB_Dummy = REACTION_Dummy + 0x27000 = 0x85027000.
 *
 * clicktab_lib LVO layout (clicktab_lib.fd):
 *   -30  CLICKTAB_GetClass()                -> Class*
 *   -36  AllocClickTabNodeA(tags)           -> Node*    (a0 only)
 *   -42  FreeClickTabNode(node)                         (a0)
 *   -48  SetClickTabNodeAttrsA(node, tags)              (a0/a1)
 *   -54  GetClickTabNodeAttrsA(node, tags)              (a0/a1)
 *
 * NOTE: prior table hand-typed every CLICKTAB_* and TNA_* value wrong
 * (TNA_Text was pointing at TNA_UserData, etc.). Re-derived byte-for-
 * byte from gadgets/clicktab.h for this version per the
 * feedback_amiga_tag_constants.md rule (never hand-type; re-derive).
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind, IDCMP } from '../EventKind.js';
import { buildNodeList } from '../NodeList.js';

/** @internal CLICKTAB_* tag IDs (gadgets/clicktab.h). */
const CLICKTAB = Object.freeze({
  /* check-constants: prefix CLICKTAB_ header gadgets/clicktab.h */
  Labels:                   0x85027001,
  Current:                  0x85027002,
  CurrentNode:              0x85027003,
  Orientation:              0x85027004,
  PageGroup:                0x85027005,
  PageGroupBackFill:        0x85027006,
  LabelTruncate:            0x85027007,  /* OS4ONLY */
  FlagImage:                0x85027008,  /* OS4ONLY */
  EvenSize:                 0x85027009,  /* OS4ONLY */
  Total:                    0x8502700A,  /* OS4ONLY */
  PageGroupBorder:          0x8502700B,
  AutoFit:                  0x8502700C,
  AutoTabNumbering:         0x8502700D,
  CloseImage:               0x8502700E,
  Closed:                   0x8502700F,  /* OS4ONLY */
  NodeClosed:               0x85027010,
  ClosePlacement:           0x85027011,
  ChooserFlagImage:         0x85027012,
  MinorLabelChange:         0x85027013,
  TabsOffsetAsLayoutSpacing:0x85027014,
});

/** @internal TNA_* tab-node attribute tags (TNA_Dummy = TAG_USER+0x010000). */
export const TNA = Object.freeze({
  /* check-constants: prefix TNA_ header gadgets/clicktab.h */
  UserData:    0x80010001,
  /* +2 (Enabled), +3 (Spacing), +4 (Highlight) documented obsolete. */
  Image:       0x80010005,
  SelImage:    0x80010006,
  Text:        0x80010007,
  Number:      0x80010008,
  TextPen:     0x80010009,
  Disabled:    0x8001000A,
  Flagged:     0x8001000B,  /* OS4ONLY */
  HintInfo:    0x8001000C,  /* OS4ONLY */
  CloseGadget: 0x8001000D,
  HelpText:    0x8001000F,
});

/** clicktab_lib LVO offsets used by _buildLabelList. */
const CLICKTAB_LVO_ALLOC_NODE = -36;   /* check-constants: is AllocClickTabNodeA */
const CLICKTAB_LVO_FREE_NODE  = -42;   /* check-constants: is FreeClickTabNode */

/**
 * clicktab.gadget — tab switcher.
 *
 * Pass `labels: ['Tab 1','Tab 2','Tab 3']` to auto-build a struct List
 * of AllocClickTabNodeA entries (TNA_Text + TNA_Number = index each).
 * The list is freed at dispose.
 *
 * @extends GadgetBase
 */
export class ClickTab extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/clicktab.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    labelsPtr:                 { tagID: CLICKTAB.Labels,                   type: 'ptr' },
    current:                   { tagID: CLICKTAB.Current,                  type: 'int32' },
    currentNode:               { tagID: CLICKTAB.CurrentNode,              type: 'ptr' },
    orientation:               { tagID: CLICKTAB.Orientation,              type: 'uint32' },
    pageGroup:                 { tagID: CLICKTAB.PageGroup,                type: 'ptr' },
    pageGroupBackFill:         { tagID: CLICKTAB.PageGroupBackFill,        type: 'ptr' },
    pageGroupBorder:           { tagID: CLICKTAB.PageGroupBorder,          type: 'bool' },
    autoFit:                   { tagID: CLICKTAB.AutoFit,                  type: 'bool' },
    autoTabNumbering:          { tagID: CLICKTAB.AutoTabNumbering,         type: 'bool' },
    closeImage:                { tagID: CLICKTAB.CloseImage,               type: 'ptr' },
    nodeClosed:                { tagID: CLICKTAB.NodeClosed,               type: 'ptr' },
    closePlacement:            { tagID: CLICKTAB.ClosePlacement,           type: 'uint32' },
    chooserFlagImage:          { tagID: CLICKTAB.ChooserFlagImage,         type: 'ptr' },
    minorLabelChange:          { tagID: CLICKTAB.MinorLabelChange,         type: 'bool' },
    tabsOffsetAsLayoutSpacing: { tagID: CLICKTAB.TabsOffsetAsLayoutSpacing,type: 'bool' },
  };

  /**
   * @param {object} init
   * @param {string[]} [init.labels] — tab label strings; built into a
   *     struct List of TNA-attribute nodes at construction, freed at dispose.
   * @param {number} [init.labelsPtr] — pointer to a pre-built List
   * @param {number} [init.current] — initial tab index
   * @param {boolean} [init.relVerify=true]
   */
  constructor(init) {
    /* A number is an existing object to wrap: nothing is created, and
     * the defaults below do not apply. */
    if (typeof init === 'number') { super(init); return; }

    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;

    let ownedLabels = null;
    if (Array.isArray(clean.labels)) {
      ownedLabels = ClickTab._buildLabelList(clean.labels);
      clean.labelsPtr = ownedLabels.listPtr;
      delete clean.labels;
    }

    super(clean);
    this._ownedLabels = ownedLabels;
  }

  /**
   * Build the CLICKTAB_Labels list: one AllocClickTabNodeA node per
   * label, with TNA_Text and TNA_Number (the tab's index, which is
   * what CLICKTAB_Current reports). Everything lives until dispose().
   *
   * @internal
   * @param   {string[]} labels
   * @returns {{listPtr: number, freeAll: function(): undefined}}
   */
  static _buildLabelList(labels) {
    ClickTab.ensureClass();
    if (!ClickTab._libBase) {
      throw new Error('ClickTab: class library base not cached');
    }

    return buildNodeList({
      owner:    'ClickTab',
      libBase:  ClickTab._libBase,
      allocLvo: CLICKTAB_LVO_ALLOC_NODE,  /* AllocClickTabNodeA(a0 tags) */
      freeLvo:  CLICKTAB_LVO_FREE_NODE,
      count:    labels.length,
      describe: (index, keep) => ({
        pairs: [
          [TNA.Text,   keep.string(labels[index])],
          [TNA.Number, index],
        ],
      }),
    });
  }

  dispose() {
    if (this._disposed) return;
    super.dispose();
    if (this._ownedLabels) {
      try { this._ownedLabels.freeAll(); }
      catch (e) { /* cascaded free */ }
      this._ownedLabels = null;
    }
  }
}

EventKind.define('CLICKTAB_CHANGE', {
  idcmp: IDCMP.IDCMPUPDATE,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/clicktab.gadget',
  wraps: 'ATTR_UPDATE',
});
