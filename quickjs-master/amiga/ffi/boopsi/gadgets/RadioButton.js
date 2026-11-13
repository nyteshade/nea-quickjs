/* quickjs-master/amiga/ffi/boopsi/gadgets/RadioButton.js
 *
 * radiobutton.gadget — Reaction exclusive-group selector. Extends
 * gadgetclass.
 *
 * RADIOBUTTON_Dummy = REACTION_Dummy + 0x14000 = 0x85014000.
 *
 * OS3.2 support note: RADIOBUTTON_Strings is documented in
 * radiobutton.h:49 as "RESERVED - presently unsupported". The
 * RADIOBUTTON_LabelArray variant is OS4ONLY. The ONLY working path
 * on OS3.2 is RADIOBUTTON_Labels with a struct List of RBNA-attribute
 * nodes built via AllocRadioButtonNodeA (LVO -36). This wrapper
 * handles that for you: pass `labels: ['_A','_B','_C']` to the
 * constructor and a list is built at NewObject time, freed at
 * dispose.
 *
 * radiobutton_lib LVO layout:
 *   -30  RADIOBUTTON_GetClass()           -> Class*
 *   -36  AllocRadioButtonNodeA(cols, tags) -> Node*    (d0/a0)
 *   -42  FreeRadioButtonNode(node)                     (a0)
 *   -48  SetRadioButtonNodeAttrsA(node, tags)          (a0/a1)
 *   -54  GetRadioButtonNodeAttrsA(node, tags)          (a0/a1)
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';
import { buildNodeList } from '../NodeList.js';

/** @internal RADIOBUTTON_* tag IDs (gadgets/radiobutton.h). */
const RADIOBUTTON = Object.freeze({
  /* check-constants: prefix RADIOBUTTON_ header gadgets/radiobutton.h */
  Labels:     0x85014001,  /* (struct List *) RBNA nodes — OS3.2+ */
  Strings:    0x85014002,  /* RESERVED - presently unsupported */
  Spacing:    0x85014003,
  Selected:   0x85014004,
  LabelPlace: 0x85014005,
  LabelArray: 0x85014006,  /* OS4ONLY */
});

/** RBNA_* node-attribute tag IDs (RBNA_Dummy = TAG_USER+0x020000). */
const RBNA = Object.freeze({
  /* check-constants: prefix RBNA_ header gadgets/radiobutton.h */
  UserData: 0x80020001,
  Label:    0x80020002,   /* STRPTR — the label text */
});

/** exec.library list/node poke offsets used by linkNodeList. */
const LVO_ALLOC_NODE = -36;
const LVO_FREE_NODE  = -42;

/**
 * radiobutton.gadget — exclusive-select group.
 *
 * @extends GadgetBase
 */
export class RadioButton extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/radiobutton.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    /* RADIOBUTTON_Labels — set internally from `init.labels` (string[]).
     * Do not pass manually unless you've already allocated a List. */
    labelsPtr:  { tagID: RADIOBUTTON.Labels,     type: 'ptr' },
    spacing:    { tagID: RADIOBUTTON.Spacing,    type: 'int32' },
    selectedIx: { tagID: RADIOBUTTON.Selected,   type: 'uint32' },
    labelPlace: { tagID: RADIOBUTTON.LabelPlace, type: 'uint32' },
  };

  /**
   * Construct a radio button group.
   *
   * @param {object} init
   * @param {string[]} [init.labels] — convenience: array of strings;
   *     each becomes an RBNA-attribute node added to the Labels list.
   *     The nodes + list are freed at dispose.
   * @param {number} [init.selectedIx] — initial selection index
   * @param {boolean} [init.relVerify=true]
   */
  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    if (clean.tabCycle  === undefined) clean.tabCycle  = true;

    /* Build an RBNA struct List out of a ['_A','_B','_C'] array. The
     * allocation runs BEFORE super(clean), because labelsPtr must be
     * populated by the time BOOPSIBase builds the tag list. */
    let ownedLabels = null;
    if (Array.isArray(clean.labels)) {
      ownedLabels = RadioButton._buildLabelList(clean.labels);
      clean.labelsPtr = ownedLabels.listPtr;
      delete clean.labels;
    }

    super(clean);
    this._ownedLabels = ownedLabels;
  }

  /**
   * Build the RADIOBUTTON_Labels list: one AllocRadioButtonNodeA node
   * per label, each with RBNA_Label. The gadget keeps pointers to the
   * list and the strings, so all of it lives until dispose().
   *
   * @internal
   * @param   {string[]} labels
   * @returns {{listPtr: number, freeAll: function(): undefined}}
   */
  static _buildLabelList(labels) {
    RadioButton.ensureClass();
    if (!RadioButton._libBase) {
      throw new Error('RadioButton: class library base not cached');
    }

    return buildNodeList({
      owner:    'RadioButton',
      libBase:  RadioButton._libBase,
      /* AllocRadioButtonNodeA(d0 columns, a0 tags) */
      allocLvo: LVO_ALLOC_NODE,
      freeLvo:  LVO_FREE_NODE,
      count:    labels.length,
      describe: (index, keep) => ({
        d0:    1,
        pairs: [[RBNA.Label, keep.string(labels[index])]],
      }),
    });
  }

  /**
   * Dispose the radio button + its owned label list.
   */
  dispose() {
    if (this._disposed) return;
    super.dispose();
    if (this._ownedLabels) {
      try { this._ownedLabels.freeAll(); }
      catch (e) { /* swallow — object already freed by cascade */ }
      this._ownedLabels = null;
    }
  }
}

EventKind.define('RADIO_SELECT', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/radiobutton.gadget',
  wraps: 'ATTR_UPDATE',
});
