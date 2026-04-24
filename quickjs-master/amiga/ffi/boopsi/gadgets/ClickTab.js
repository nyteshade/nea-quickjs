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
import { EventKind } from '../EventKind.js';

/** @internal CLICKTAB_* tag IDs (gadgets/clicktab.h). */
const CLICKTAB = Object.freeze({
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
const CLICKTAB_LVO_ALLOC_NODE = -36;
const CLICKTAB_LVO_FREE_NODE  = -42;

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

  /** @internal See RadioButton._buildLabelList for list-layout mechanics. */
  static _buildLabelList(labels) {
    ClickTab.ensureClass();
    const libBase = ClickTab._libBase;
    if (!libBase) throw new Error('ClickTab: class library base not cached');

    const LIST_BYTES = 16;
    const listPtr = globalThis.amiga.allocMem(LIST_BYTES);
    if (!listPtr) throw new Error('ClickTab: allocMem list failed');

    globalThis.amiga.poke32(listPtr + 0, listPtr + 4);
    globalThis.amiga.poke32(listPtr + 4, 0);
    globalThis.amiga.poke32(listPtr + 8, listPtr + 0);

    const nodes       = [];
    const labelAllocs = [];

    for (let i = 0; i < labels.length; i++) {
      const s = String(labels[i]);
      const sB = s.length + 1;
      const sP = globalThis.amiga.allocMem(sB);
      globalThis.amiga.pokeString(sP, s);
      labelAllocs.push([sP, sB]);

      /* TNA_Text + TNA_Number = index. Number is documented as a
       * stable per-tab id useful for CLICKTAB_Current lookup. */
      const tags = globalThis.amiga.makeTags([
        [TNA.Text,   sP],
        [TNA.Number, i],
      ]);
      if (!tags) throw new Error('ClickTab: makeTags failed');

      const nodePtr = globalThis.amiga.call(libBase, CLICKTAB_LVO_ALLOC_NODE, {
        a0: tags,
      });
      globalThis.amiga.freeMem(tags, 24);  /* 3 tag items × 8 bytes */

      if (!nodePtr) {
        for (let n of nodes) {
          globalThis.amiga.call(libBase, CLICKTAB_LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
        throw new Error('ClickTab: AllocClickTabNodeA returned 0');
      }

      nodes.push({ nodePtr });
    }

    for (let n of nodes) {
      const pred = globalThis.amiga.peek32(listPtr + 8);
      globalThis.amiga.poke32(n.nodePtr + 0, listPtr + 4);
      globalThis.amiga.poke32(n.nodePtr + 4, pred);
      globalThis.amiga.poke32(pred        + 0, n.nodePtr);
      globalThis.amiga.poke32(listPtr     + 8, n.nodePtr);
    }

    return {
      listPtr,
      freeAll() {
        for (let n of nodes) {
          globalThis.amiga.call(libBase, CLICKTAB_LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
      },
    };
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
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/clicktab.gadget',
  wraps: 'ATTR_UPDATE',
});
