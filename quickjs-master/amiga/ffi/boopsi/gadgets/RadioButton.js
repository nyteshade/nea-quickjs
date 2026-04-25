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

/** @internal RADIOBUTTON_* tag IDs (gadgets/radiobutton.h). */
const RADIOBUTTON = Object.freeze({
  Labels:     0x85014001,  /* (struct List *) RBNA nodes — OS3.2+ */
  Strings:    0x85014002,  /* RESERVED - presently unsupported */
  Spacing:    0x85014003,
  Selected:   0x85014004,
  LabelPlace: 0x85014005,
  LabelArray: 0x85014006,  /* OS4ONLY */
});

/** RBNA_* node-attribute tag IDs (RBNA_Dummy = TAG_USER+0x020000). */
const RBNA = Object.freeze({
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
   * @internal
   * Allocate an RBNA node per label, link into a struct List, return
   * { listPtr, freeAll }. The list's lifetime is tied to the owning
   * RadioButton's dispose.
   *
   * @param   {string[]} labels
   * @returns {{listPtr: number, freeAll: Function}}
   */
  static _buildLabelList(labels) {
    /* Ensure the class library is open so we can reach its LVOs. */
    RadioButton.ensureClass();
    const libBase = RadioButton._libBase;
    if (!libBase) {
      throw new Error('RadioButton: class library base not cached');
    }

    /* Allocate a standard exec List header: 14 bytes, 16 for padding. */
    const LIST_BYTES = 16;
    const listPtr = globalThis.amiga.allocMem(LIST_BYTES);
    if (!listPtr) throw new Error('RadioButton: allocMem list failed');

    /* NewList() inline: lh_Head = &lh_Tail; lh_Tail = NULL; lh_TailPred = &lh_Head. */
    globalThis.amiga.poke32(listPtr + 0, listPtr + 4);  /* lh_Head = &lh_Tail */
    globalThis.amiga.poke32(listPtr + 4, 0);            /* lh_Tail */
    globalThis.amiga.poke32(listPtr + 8, listPtr + 0);  /* lh_TailPred = &lh_Head */

    const nodes = [];          /* { nodePtr, labelPtr, labelBytes } */
    const labelAllocs = [];    /* [strPtr, strBytes] for cleanup */

    for (let lbl of labels) {
      const s = String(lbl);
      const sB = s.length + 1;
      const sP = globalThis.amiga.allocMem(sB);
      globalThis.amiga.pokeString(sP, s);
      labelAllocs.push([sP, sB]);

      /* Build a two-tag array: [RBNA_Label, sP], [TAG_END, 0].
       * Use makeTags in pair-array form. */
      const tags = globalThis.amiga.makeTags([[RBNA.Label, sP]]);
      if (!tags) throw new Error('RadioButton: makeTags failed');

      /* Call AllocRadioButtonNodeA(columns=1, tags=tags).
       * LVO -36. Returns Node* in D0, which amiga.call forwards. */
      const nodePtr = globalThis.amiga.call(libBase, LVO_ALLOC_NODE, {
        d0: 1,
        a0: tags,
      });
      globalThis.amiga.freeMem(tags, 16);

      if (!nodePtr) {
        /* Roll back partial allocs. */
        for (let n of nodes) {
          globalThis.amiga.call(libBase, LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
        throw new Error('RadioButton: AllocRadioButtonNodeA returned 0');
      }

      nodes.push({ nodePtr, labelPtr: sP, labelBytes: sB });
    }

    /* Link each node at the tail. AddTail equivalent:
     *   pred = list->lh_TailPred;
     *   node->ln_Succ = &list->lh_Tail;       (+0 inside node = ln_Succ)
     *   node->ln_Pred = pred;                 (+4 inside node = ln_Pred)
     *   pred->ln_Succ = node;
     *   list->lh_TailPred = node;
     */
    for (let n of nodes) {
      const pred = globalThis.amiga.peek32(listPtr + 8);      /* lh_TailPred */
      globalThis.amiga.poke32(n.nodePtr + 0, listPtr + 4);    /* ln_Succ = &lh_Tail */
      globalThis.amiga.poke32(n.nodePtr + 4, pred);           /* ln_Pred = old pred */
      globalThis.amiga.poke32(pred        + 0, n.nodePtr);    /* pred->ln_Succ = node */
      globalThis.amiga.poke32(listPtr     + 8, n.nodePtr);    /* lh_TailPred = node */
    }

    return {
      listPtr,
      freeAll() {
        for (let n of nodes) {
          globalThis.amiga.call(libBase, LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
      },
    };
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
