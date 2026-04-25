/* quickjs-master/amiga/ffi/boopsi/gadgets/SpeedBar.js
 *
 * speedbar.gadget — Reaction toolbar strip. Extends gadgetclass.
 * Buttons are supplied as a struct List of nodes with SBNA_* attrs.
 *
 * SPEEDBAR_Dummy = REACTION_Dummy + 0x13000 = 0x85013000.
 *
 * speedbar_lib LVO layout (speedbar_lib.fd):
 *   -30  SPEEDBAR_GetClass()                     -> Class*
 *   -36  AllocSpeedButtonNodeA(ordinal, tags)    -> Node*    (d0/a0)
 *   -42  FreeSpeedButtonNode(node)                           (a0)
 *   -48  SetSpeedButtonNodeAttrsA(node, tags)                (a0/a1)
 *   -54  GetSpeedButtonNodeAttrsA(node, tags)                (a0/a1)
 *
 * NOTE: prior table had every SPEEDBAR_* and SBNA_* value wrong (off
 * by +1 slot for class tags; the node-attr table invented names like
 * SBNA_Label/Ordinal/Flags that don't exist in the header). Re-derived
 * from gadgets/speedbar.h for this version.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal SPEEDBAR_* tag IDs (gadgets/speedbar.h). */
const SPEEDBAR = Object.freeze({
  Buttons:     0x85013001,
  Orientation: 0x85013002,
  Background:  0x85013003,
  Window:      0x85013004,
  StrumBar:    0x85013005,
  OnButton:    0x85013006,
  OffButton:   0x85013007,
  ScrollLeft:  0x85013008,
  ScrollRight: 0x85013009,
  Top:         0x8501300A,
  Visible:     0x8501300B,
  Total:       0x8501300C,
  Help:        0x8501300D,
  BevelStyle:  0x8501300E,
  Selected:    0x8501300F,
  SelectedNode:0x85013010,
  EvenSize:    0x85013011,
  Font:        0x85013012,
});

/** @internal SBNA_* button-node attribute tags (SBNA_Dummy = TAG_USER+0x010000).
 *
 * Some SBNA_* tags collide in namespace with clicktab TNA_* — that's
 * correct per NDK (both use TAG_USER+0x010000 as Dummy). The meaning
 * is class-scoped; SBNA tags are only recognised by speedbar.gadget. */
export const SBNA = Object.freeze({
  Left:      0x80010001,
  Top:       0x80010002,
  Width:     0x80010003,
  Height:    0x80010004,
  UserData:  0x80010005,
  Enabled:   0x80010006,
  Spacing:   0x80010007,
  Highlight: 0x80010008,
  Image:     0x80010009,
  SelImage:  0x8001000A,
  Help:      0x8001000B,
  Toggle:    0x8001000C,
  Selected:  0x8001000D,
  MXGroup:   0x8001000E,
  Disabled:  0x8001000F,
  Text:      0x80010010,  /* the label string */
});

/** SpeedBar orientation values (SBORIENT_*). */
export const SpeedBarOrient = Object.freeze({
  HORIZONTAL: 0,
  VERTICAL:   1,
});

/** speedbar_lib LVO offsets used by _buildButtonList. */
const SPEEDBAR_LVO_ALLOC_NODE = -36;
const SPEEDBAR_LVO_FREE_NODE  = -42;

/**
 * speedbar.gadget — toolbar strip.
 *
 * Pass `buttons: ['Cut','Copy','Paste']` to auto-build a List of
 * AllocSpeedButtonNodeA nodes (SBNA_Text + ordinal = index). The list
 * is freed at dispose.
 *
 * @extends GadgetBase
 */
export class SpeedBar extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/speedbar.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    buttonsPtr:   { tagID: SPEEDBAR.Buttons,      type: 'ptr' },
    orientation:  { tagID: SPEEDBAR.Orientation,  type: 'uint32' },
    background:   { tagID: SPEEDBAR.Background,   type: 'ptr' },
    strumBar:     { tagID: SPEEDBAR.StrumBar,     type: 'bool' },
    top:          { tagID: SPEEDBAR.Top,          type: 'int32' },
    visible:      { tagID: SPEEDBAR.Visible,      type: 'int32' },
    total:        { tagID: SPEEDBAR.Total,        type: 'int32' },
    help:         { tagID: SPEEDBAR.Help,         type: 'bool' },
    bevelStyle:   { tagID: SPEEDBAR.BevelStyle,   type: 'uint32' },
    selected:     { tagID: SPEEDBAR.Selected,     type: 'int32' },
    selectedNode: { tagID: SPEEDBAR.SelectedNode, type: 'ptr' },
    evenSize:     { tagID: SPEEDBAR.EvenSize,     type: 'bool' },
    font:         { tagID: SPEEDBAR.Font,         type: 'ptr' },
  };

  /**
   * @param {object} init
   * @param {string[]} [init.buttons] — button label strings; built into
   *     a struct List of SBNA-attribute nodes (SBNA_Text + ordinal=index).
   *     Freed at dispose.
   * @param {number} [init.buttonsPtr] — pointer to a pre-built List
   * @param {boolean} [init.relVerify=true]
   */
  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;

    let ownedButtons = null;
    if (Array.isArray(clean.buttons)) {
      ownedButtons = SpeedBar._buildButtonList(clean.buttons);
      clean.buttonsPtr = ownedButtons.listPtr;
      delete clean.buttons;
    }

    super(clean);
    this._ownedButtons = ownedButtons;
  }

  /** @internal */
  static _buildButtonList(buttons) {
    SpeedBar.ensureClass();
    const libBase = SpeedBar._libBase;
    if (!libBase) throw new Error('SpeedBar: class library base not cached');

    const LIST_BYTES = 16;
    const listPtr = globalThis.amiga.allocMem(LIST_BYTES);
    if (!listPtr) throw new Error('SpeedBar: allocMem list failed');

    globalThis.amiga.poke32(listPtr + 0, listPtr + 4);
    globalThis.amiga.poke32(listPtr + 4, 0);
    globalThis.amiga.poke32(listPtr + 8, listPtr + 0);

    const nodes       = [];
    const labelAllocs = [];

    /* Compute the widest label so all buttons share a width that fits the
     * longest text. Per gadgets/speedbar.h SBNA_Text is "Label to display
     * below the image" — without an image and without explicit Width/Height
     * the class collapses to ~1x1. Pick conservative font-cell defaults
     * (8px wide × 8px tall for topaz-8) plus padding; SPEEDBAR_EvenSize
     * will normalise across the bar. */
    let maxChars = 0;
    for (let s of buttons) {
      let len = String(s).length;
      if (len > maxChars) maxChars = len;
    }
    const BTN_WIDTH  = Math.max(maxChars * 8 + 12, 40);
    const BTN_HEIGHT = 18;

    for (let i = 0; i < buttons.length; i++) {
      const s = String(buttons[i]);
      const sB = s.length + 1;
      const sP = globalThis.amiga.allocMem(sB);
      globalThis.amiga.pokeString(sP, s);
      labelAllocs.push([sP, sB]);

      /* makeTags allocates 8 bytes per pair plus 8 for TAG_END.
       * Tags: Text + Width + Height = 4 pairs = 32 bytes. */
      const tags = globalThis.amiga.makeTags([
        [SBNA.Text,   sP],
        [SBNA.Width,  BTN_WIDTH],
        [SBNA.Height, BTN_HEIGHT],
      ]);
      if (!tags) throw new Error('SpeedBar: makeTags failed');

      /* AllocSpeedButtonNodeA(ordinal, tags). d0=i (index as ordinal),
       * a0=tags. Each button gets a stable ordinal id for SPEEDBAR
       * event dispatch. */
      const nodePtr = globalThis.amiga.call(libBase, SPEEDBAR_LVO_ALLOC_NODE, {
        d0: i,
        a0: tags,
      });
      globalThis.amiga.freeMem(tags, 32);

      if (!nodePtr) {
        for (let n of nodes) {
          globalThis.amiga.call(libBase, SPEEDBAR_LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
        throw new Error('SpeedBar: AllocSpeedButtonNodeA returned 0');
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
          globalThis.amiga.call(libBase, SPEEDBAR_LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
      },
    };
  }

  dispose() {
    if (this._disposed) return;
    super.dispose();
    if (this._ownedButtons) {
      try { this._ownedButtons.freeAll(); }
      catch (e) { /* cascaded free */ }
      this._ownedButtons = null;
    }
  }
}

EventKind.define('SPEEDBAR_CLICK', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/speedbar.gadget',
  wraps: 'ATTR_UPDATE',
});
