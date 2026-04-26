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
 * OS3.2 RENDERING REALITY (speedbar_gc autodoc + NDK SpeedBar.c):
 * SpeedBar is fundamentally an *image-button* class. Per autodoc the
 * description says "usually with an image face"; per gadgets/speedbar.h
 * SBNA_Text is V45+ "Label to display BELOW the image" — never a
 * primary mode. SBTYPE_TEXT is OS4ONLY. With only SBNA_Text + Width/
 * Height the class draws an empty bevel because it has no image to
 * anchor the text to. The wrapper auto-builds a label.image per
 * string-form button so SBNA_Image is always populated.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { Label } from '../images/Label.js';
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
 * Some SBNA_* tags collide in numeric value with clicktab TNA_* — that's
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
  Text:      0x80010010,  /* the label string (V45) */
});

/** SpeedBar orientation values (SBORIENT_*). */
export const SpeedBarOrient = Object.freeze({
  HORIZONTAL: 0,
  VERTICAL:   1,
});

/**
 * SBNA_Highlight modes (gadgets/speedbar.h:86-89).
 *
 * NONE     — no highlight
 * BACKFILL — backfill with FILLPEN when selected
 * RECESS   — shift image down/right when selected (default in NDK example)
 * IMAGE    — display alternate SBNA_SelImage when selected
 */
export const SpeedBarHighlight = Object.freeze({
  NONE:     0,
  BACKFILL: 1,
  RECESS:   2,
  IMAGE:    3,
});

/** speedbar_lib LVO offsets used by _buildButtonList. */
const SPEEDBAR_LVO_ALLOC_NODE = -36;
const SPEEDBAR_LVO_FREE_NODE  = -42;

/**
 * speedbar.gadget — toolbar strip.
 *
 * Each entry in `buttons` may be either a string (sugar for `{text}`)
 * or an object `{text?, image?, selImage?, help?, enabled?, disabled?,
 * highlight?, spacing?, toggle?, selected?, mxGroup?}`. Strings — and
 * objects with `text` but no `image` — get an internal label.image
 * whose pointer is passed as SBNA_Image, since OS3.2 SpeedBar requires
 * an image per node to render anything visible. Auto-built labels are
 * disposed alongside the speedbar nodes at gadget dispose.
 *
 * The button ordinal (the value reported as SPEEDBAR_Selected on click)
 * is the array index — i.e. AllocSpeedButtonNodeA's first arg.
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
   * @param {(string|object)[]} [init.buttons] — array of strings or
   *     per-button option objects. Strings are sugar for `{text}`;
   *     objects accept `{text, image, selImage, help, enabled,
   *     disabled, highlight, spacing, toggle, selected, mxGroup}`.
   *     Strings without `image` (or objects with `text` but no `image`)
   *     get an internal label.image so SBNA_Image is populated.
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

  /**
   * Build a struct List of speedbar nodes from an array of strings or
   * per-button option objects.
   *
   * @internal
   * @param {(string|object)[]} buttons
   * @returns {{listPtr: number, freeAll: function(): void}}
   */
  static _buildButtonList(buttons) {
    SpeedBar.ensureClass();
    const libBase = SpeedBar._libBase;
    if (!libBase) throw new Error('SpeedBar: class library base not cached');

    const LIST_BYTES = 16;
    const listPtr = globalThis.amiga.allocMem(LIST_BYTES);
    if (!listPtr) throw new Error('SpeedBar: allocMem list failed');

    /* Initialise an empty exec struct List (16 bytes):
     *   +0  lh_Head     -> &lh_Tail (which sits at +4 — empty marker)
     *   +4  lh_Tail     -> NULL
     *   +8  lh_TailPred -> &lh_Head
     *   +12 lh_Type/Pad
     */
    globalThis.amiga.poke32(listPtr + 0, listPtr + 4);
    globalThis.amiga.poke32(listPtr + 4, 0);
    globalThis.amiga.poke32(listPtr + 8, listPtr + 0);

    const nodes       = [];
    const labelAllocs = [];
    const ownedLabels = [];

    /* Tag-pair budget per node: at most 11 SBNA_* attrs + TAG_END.
     * makeTags emits 8 bytes per pair plus 8 for the TAG_END terminator,
     * so a 12-pair buffer would be 96 bytes. We only ever feed makeTags
     * the pairs that are actually present, but the freeMem call below
     * needs a stable size; computed per-call from pairs.length. */

    try {
      for (let i = 0; i < buttons.length; i++) {
        const raw = buttons[i];
        const opts = (typeof raw === 'string') ? { text: raw }
                   : (raw && typeof raw === 'object') ? raw
                   : {};

        let imagePtr = SpeedBar._resolveImagePtr(opts.image);

        /* If text is supplied without an image, build an internal
         * label.image and use its .ptr as SBNA_Image. The Label is
         * tracked in ownedLabels[] for disposal alongside the node. */
        if (!imagePtr && typeof opts.text === 'string' && opts.text.length > 0) {
          const lbl = new Label({ text: opts.text });
          ownedLabels.push(lbl);
          imagePtr = lbl.ptr;
        }

        const selImagePtr = SpeedBar._resolveImagePtr(opts.selImage);

        /* Stage the SBNA_Text string into a Reaction-owned buffer.
         * SpeedBar copies the string at OM_NEW per V45 semantics, but
         * we keep ownership through the gadget's lifetime to be safe.
         * Both `text` and `image` are passed when both are supplied —
         * V45 renders the text below the image. */
        let textPtr = 0;
        if (typeof opts.text === 'string' && opts.text.length > 0) {
          const sB = opts.text.length + 1;
          textPtr = globalThis.amiga.allocMem(sB);
          if (!textPtr) throw new Error('SpeedBar: allocMem text failed');
          globalThis.amiga.pokeString(textPtr, opts.text);
          labelAllocs.push([textPtr, sB]);
        }

        const pairs = [];
        if (imagePtr)                            pairs.push([SBNA.Image,     imagePtr]);
        if (selImagePtr)                         pairs.push([SBNA.SelImage,  selImagePtr]);
        if (textPtr)                             pairs.push([SBNA.Text,      textPtr]);
        if (opts.help !== undefined) {
          const helpPtr = SpeedBar._stageString(opts.help, labelAllocs);
          if (helpPtr)                           pairs.push([SBNA.Help,      helpPtr]);
        }
        if (opts.enabled !== undefined)          pairs.push([SBNA.Enabled,   opts.enabled ? 1 : 0]);
        if (opts.disabled !== undefined)         pairs.push([SBNA.Disabled,  opts.disabled ? 1 : 0]);
        if (opts.highlight !== undefined)        pairs.push([SBNA.Highlight, opts.highlight | 0]);
        if (opts.spacing !== undefined)          pairs.push([SBNA.Spacing,   opts.spacing | 0]);
        if (opts.toggle !== undefined)           pairs.push([SBNA.Toggle,    opts.toggle ? 1 : 0]);
        if (opts.selected !== undefined)         pairs.push([SBNA.Selected,  opts.selected ? 1 : 0]);
        if (opts.mxGroup !== undefined)          pairs.push([SBNA.MXGroup,   opts.mxGroup | 0]);

        const tagBytes = (pairs.length + 1) * 8;
        const tags = globalThis.amiga.makeTags(pairs);
        if (!tags) throw new Error('SpeedBar: makeTags failed');

        /* AllocSpeedButtonNodeA(ordinal, tags). d0=index (ordinal),
         * a0=tags. Each button gets a stable ordinal id for SPEEDBAR
         * event dispatch via SPEEDBAR_Selected. */
        const nodePtr = globalThis.amiga.call(libBase, SPEEDBAR_LVO_ALLOC_NODE, {
          d0: i,
          a0: tags,
        });
        globalThis.amiga.freeMem(tags, tagBytes);

        if (!nodePtr) throw new Error('SpeedBar: AllocSpeedButtonNodeA returned 0');

        nodes.push({ nodePtr });
      }

      /* Link nodes into the list AddTail-style. */
      for (let n of nodes) {
        const pred = globalThis.amiga.peek32(listPtr + 8);
        globalThis.amiga.poke32(n.nodePtr + 0, listPtr + 4);
        globalThis.amiga.poke32(n.nodePtr + 4, pred);
        globalThis.amiga.poke32(pred        + 0, n.nodePtr);
        globalThis.amiga.poke32(listPtr     + 8, n.nodePtr);
      }
    }
    catch (e) {
      /* Partial-failure cleanup, reverse order. */
      for (let n of nodes) {
        try { globalThis.amiga.call(libBase, SPEEDBAR_LVO_FREE_NODE, { a0: n.nodePtr }); }
        catch (_) { /* best effort */ }
      }
      for (let lbl of ownedLabels) { try { lbl.dispose(); } catch (_) {} }
      for (let [p, b] of labelAllocs) {
        try { globalThis.amiga.freeMem(p, b); } catch (_) {}
      }
      try { globalThis.amiga.freeMem(listPtr, LIST_BYTES); } catch (_) {}
      throw e;
    }

    return {
      listPtr,
      freeAll() {
        /* Free nodes first — they reference the Label's Image*. */
        for (let n of nodes) {
          try { globalThis.amiga.call(libBase, SPEEDBAR_LVO_FREE_NODE, { a0: n.nodePtr }); }
          catch (_) { /* best effort */ }
        }
        /* Then dispose any auto-built Labels. */
        for (let lbl of ownedLabels) {
          try { lbl.dispose(); } catch (_) {}
        }
        for (let [p, b] of labelAllocs) {
          try { globalThis.amiga.freeMem(p, b); } catch (_) {}
        }
        try { globalThis.amiga.freeMem(listPtr, LIST_BYTES); } catch (_) {}
      },
    };
  }

  /**
   * Coerce an `image` opt to a raw uint32 pointer. Accepts a numeric
   * pointer or any BOOPSI image wrapper exposing `.ptr`. Returns 0
   * when absent/invalid.
   *
   * @internal
   * @param {*} v
   * @returns {number}
   */
  static _resolveImagePtr(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && typeof v.ptr === 'number') return v.ptr;
    return 0;
  }

  /**
   * Allocate a NUL-terminated copy of `s` and track it in `track[]`.
   * Returns 0 if `s` isn't a non-empty string.
   *
   * @internal
   * @param {string} s
   * @param {Array<[number, number]>} track
   * @returns {number}
   */
  static _stageString(s, track) {
    if (typeof s !== 'string' || s.length === 0) return 0;
    const sB = s.length + 1;
    const sP = globalThis.amiga.allocMem(sB);
    if (!sP) return 0;
    globalThis.amiga.pokeString(sP, s);
    track.push([sP, sB]);
    return sP;
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
