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
import { EventKind, IDCMP } from '../EventKind.js';
import { buildNodeList } from '../NodeList.js';

/** @internal CHOOSER_* tag IDs (gadgets/chooser.h). */
const CHOOSER = Object.freeze({
  /* check-constants: prefix CHOOSER_ header gadgets/chooser.h */
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
  /* check-constants: prefix BALIGN_ header gadgets/button.h */
  LEFT: 0, CENTER: 1, RIGHT: 2,
});

/** @internal CNA_* node-attribute tags (CNA_Dummy = TAG_USER+0x5001500). */
export const CNA = Object.freeze({
  /* check-constants: prefix CNA_ header gadgets/chooser.h */
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
const CHOOSER_LVO_ALLOC_NODE = -36;   /* check-constants: is AllocChooserNodeA */
const CHOOSER_LVO_FREE_NODE  = -42;   /* check-constants: is FreeChooserNode */

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
    /* A number is an existing object to wrap: nothing is created, and
     * the defaults below do not apply. */
    if (typeof init === 'number') { super(init); return; }

    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    if (clean.tabCycle  === undefined) clean.tabCycle  = true;

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
   * Build the CHOOSER_Labels list: one AllocChooserNodeA node per
   * label, each with CNA_Text. The gadget keeps pointers to the list
   * and the strings, so all of it lives until dispose().
   *
   * @internal
   * @param   {string[]} labels
   * @returns {{listPtr: number, freeAll: function(): undefined}}
   */
  static _buildLabelList(labels) {
    Chooser.ensureClass();
    if (!Chooser._libBase) {
      throw new Error('Chooser: class library base not cached');
    }

    return buildNodeList({
      owner:    'Chooser',
      libBase:  Chooser._libBase,
      allocLvo: CHOOSER_LVO_ALLOC_NODE,   /* AllocChooserNodeA(a0 tags) */
      freeLvo:  CHOOSER_LVO_FREE_NODE,
      count:    labels.length,
      describe: (index, keep) => ({
        pairs: [[CNA.Text, keep.string(labels[index])]],
      }),
    });
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
  idcmp: IDCMP.IDCMPUPDATE,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/chooser.gadget',
  wraps: 'ATTR_UPDATE',
});
