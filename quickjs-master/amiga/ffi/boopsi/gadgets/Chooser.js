/* quickjs-master/amiga/ffi/boopsi/gadgets/Chooser.js
 *
 * chooser.gadget — Reaction dropdown / popup selector. Extends
 * gadgetclass. Labels are supplied as a struct List of nodes; each
 * node's CNA_* attributes describe text/image/user-data.
 *
 * CHOOSER_Dummy = REACTION_Dummy + 0x1000 = 0x85001000.
 *
 * chooser_lib LVO layout (chooser_lib.fd):
 *   -30  CHOOSER_GetClass()                -> Class*
 *   -36  AllocChooserNodeA(tags)           -> Node*    (a0 only)
 *   -42  FreeChooserNode(node)                         (a0)
 *   -48  SetChooserNodeAttrsA(node, tags)              (a0/a1)
 *   -54  GetChooserNodeAttrsA(node, tags)              (a0/a1)
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal CHOOSER_* tag IDs (gadgets/chooser.h). */
const CHOOSER = Object.freeze({
  PopUp:                      0x85001001,
  DropDown:                   0x85001002,
  Title:                      0x85001003,
  Labels:                     0x85001004,
  Active:                     0x85001005,  /* alias of CHOOSER_Selected */
  Width:                      0x85001006,
  AutoFit:                    0x85001007,
  MaxLabels:                  0x85001009,
  Offset:                     0x8500100A,
  Hidden:                     0x8500100B,
  LabelArray:                 0x8500100C,
  Justification:              0x8500100D,
  ImageJustification:         0x8500100E,  /* OS4ONLY */
  SelectedNode:               0x8500100F,  /* OS4ONLY */
  DeactivateOnMostRawKeys:    0x85001010,
});

/** CHOOSER_Justification (CHJ_*). */
export const ChooserJustify = Object.freeze({
  LEFT: 0, CENTER: 1, RIGHT: 2,
});

/** @internal CNA_* node-attribute tags (CNA_Dummy = TAG_USER+0x5001500). */
export const CNA = Object.freeze({
  Text:     0x85001501,
  Image:    0x85001502,
  SelImage: 0x85001503,
  UserData: 0x85001504,
  Separator:0x85001505,
  Disabled: 0x85001506,
  BGPen:    0x85001507,
  FGPen:    0x85001508,
  ReadOnly: 0x85001509,
  CopyText: 0x8500150A,  /* OS4ONLY */
});

/** chooser_lib LVO offsets used by _buildLabelList. */
const CHOOSER_LVO_ALLOC_NODE = -36;
const CHOOSER_LVO_FREE_NODE  = -42;

/**
 * chooser.gadget — dropdown / popup selector.
 *
 * Pass `labels: ['One','Two','Three']` to auto-build a struct List of
 * AllocChooserNodeA entries (CNA_Text each). The list is freed at
 * dispose. For advanced nodes (CNA_UserData, CNA_Image, CNA_Separator),
 * build the list yourself and pass `labelsPtr: ptr` directly.
 *
 * @extends GadgetBase
 */
export class Chooser extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/chooser.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    popUp:          { tagID: CHOOSER.PopUp,         type: 'bool' },
    dropDown:       { tagID: CHOOSER.DropDown,      type: 'bool' },
    title:          { tagID: CHOOSER.Title,         type: 'string-owned' },
    /* Pointer to a caller-prepared struct List*. The `labels: string[]`
     * constructor convenience below builds one for you; otherwise you
     * can pass labelsPtr directly. */
    labelsPtr:      { tagID: CHOOSER.Labels,        type: 'ptr' },
    active:         { tagID: CHOOSER.Active,        type: 'uint32' },
    autoFit:        { tagID: CHOOSER.AutoFit,       type: 'bool' },
    maxLabels:      { tagID: CHOOSER.MaxLabels,     type: 'int32' },
    justification:  { tagID: CHOOSER.Justification, type: 'uint32' },
    labelArray:     { tagID: CHOOSER.LabelArray,    type: 'ptr' },
    deactivateOnMostRawKeys: { tagID: CHOOSER.DeactivateOnMostRawKeys, type: 'bool' },
  };

  /**
   * Construct a chooser.
   *
   * @param {object} init
   * @param {string[]} [init.labels] — convenience: array of strings;
   *     each becomes a CNA-attribute node added to the Labels list.
   *     The nodes + list are freed at dispose.
   * @param {number} [init.labelsPtr] — pointer to a pre-built struct List
   * @param {number} [init.active] — initial selection index
   * @param {boolean} [init.relVerify=true]
   */
  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;

    let ownedLabels = null;
    if (Array.isArray(clean.labels)) {
      ownedLabels = Chooser._buildLabelList(clean.labels);
      clean.labelsPtr = ownedLabels.listPtr;
      delete clean.labels;
    }

    super(clean);
    this._ownedLabels = ownedLabels;
  }

  /**
   * @internal
   * Allocate a CNA-node per label, link into a struct List, return
   * { listPtr, freeAll }. Lifetime tied to the owning Chooser's dispose.
   *
   * @param   {string[]} labels
   * @returns {{listPtr: number, freeAll: Function}}
   */
  static _buildLabelList(labels) {
    Chooser.ensureClass();
    const libBase = Chooser._libBase;
    if (!libBase) throw new Error('Chooser: class library base not cached');

    /* Standard exec struct List header: 14 bytes, 16 for padding. */
    const LIST_BYTES = 16;
    const listPtr = globalThis.amiga.allocMem(LIST_BYTES);
    if (!listPtr) throw new Error('Chooser: allocMem list failed');

    /* NewList() inline. */
    globalThis.amiga.poke32(listPtr + 0, listPtr + 4);
    globalThis.amiga.poke32(listPtr + 4, 0);
    globalThis.amiga.poke32(listPtr + 8, listPtr + 0);

    const nodes       = [];  /* { nodePtr } */
    const labelAllocs = [];  /* [strPtr, strBytes] — keep alive for node lifetime */

    for (let lbl of labels) {
      const s = String(lbl);
      const sB = s.length + 1;
      const sP = globalThis.amiga.allocMem(sB);
      globalThis.amiga.pokeString(sP, s);
      labelAllocs.push([sP, sB]);

      const tags = globalThis.amiga.makeTags([[CNA.Text, sP]]);
      if (!tags) throw new Error('Chooser: makeTags failed');

      /* AllocChooserNodeA takes (tags) in a0 ONLY — no d0. */
      const nodePtr = globalThis.amiga.call(libBase, CHOOSER_LVO_ALLOC_NODE, {
        a0: tags,
      });
      globalThis.amiga.freeMem(tags, 16);

      if (!nodePtr) {
        for (let n of nodes) {
          globalThis.amiga.call(libBase, CHOOSER_LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
        throw new Error('Chooser: AllocChooserNodeA returned 0');
      }

      nodes.push({ nodePtr });
    }

    /* AddTail() each node. See RadioButton._buildLabelList for the
     * struct List layout: ln_Succ at +0, ln_Pred at +4, lh_TailPred
     * at listPtr+8. */
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
          globalThis.amiga.call(libBase, CHOOSER_LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
      },
    };
  }

  /** Dispose the chooser + its owned label list. */
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

EventKind.define('CHOOSER_SELECT', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/chooser.gadget',
  wraps: 'ATTR_UPDATE',
});
