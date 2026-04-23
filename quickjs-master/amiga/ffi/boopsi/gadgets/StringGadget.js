/* quickjs-master/amiga/ffi/boopsi/gadgets/StringGadget.js
 *
 * string.gadget — Reaction text entry field. Named StringGadget on
 * the JS side to avoid colliding with the built-in String constructor.
 * Extends gadgetclass.
 *
 * STRINGA_* (gadgets/string.h) — some tags are REACTION_Dummy+0x55000,
 * others inherit from strgclass. The distinct STRINGA_ base supports
 * both pre-Reaction OS2 strgclass and Reaction's string.gadget.
 */

import { GadgetBase, GADGET_ATTRS, GA } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal STRINGA_* tag IDs.
 *
 * Re-derived byte-for-byte from intuition/gadgetclass.h (STRINGA_*)
 * and gadgets/string.h (Reaction additions). DO NOT hand-type these
 * values — every off-by-one shifts subsequent tags and produces the
 * kind of silent misdirection we just hit (text writes landing on
 * ExitHelp because an invented FloatVal at +18 displaced TextVal
 * to +19). Same discipline as the GA_* audit in GadgetBase.js.
 */
const STRINGA = Object.freeze({
  /* strgclass tags — STRINGA_Dummy = TAG_USER + 0x32000 = 0x80032000
   * (gadgets/gadgetclass.h lines 259-290). */
  MaxChars:       0x80032001,   /* +0x01 */
  Buffer:         0x80032002,   /* +0x02 */
  UndoBuffer:     0x80032003,   /* +0x03 */
  WorkBuffer:     0x80032004,   /* +0x04 */
  BufferPos:      0x80032005,   /* +0x05 */
  DispPos:        0x80032006,   /* +0x06 */
  AltKeyMap:      0x80032007,   /* +0x07 */
  Font:           0x80032008,   /* +0x08 */
  Pens:           0x80032009,   /* +0x09 */
  ActivePens:     0x8003200A,   /* +0x0A */
  EditHook:       0x8003200B,   /* +0x0B */
  EditModes:      0x8003200C,   /* +0x0C */
  ReplaceMode:    0x8003200D,   /* +0x0D */
  FixedFieldMode: 0x8003200E,   /* +0x0E */
  NoFilterMode:   0x8003200F,   /* +0x0F */
  Justification:  0x80032010,   /* +0x10 */
  LongVal:        0x80032011,   /* +0x11 */
  TextVal:        0x80032012,   /* +0x12 — THE content tag. Earlier
                                 * table had TextVal at +0x13 (the
                                 * ExitHelp slot) because a phantom
                                 * FloatVal was inserted at +0x12;
                                 * FloatVal is not defined in NDK 3.2. */
  ExitHelp:       0x80032013,   /* +0x13 — v37+ */

  /* Reaction-specific tags — REACTION_Dummy + 0x55000 = 0x85055000
   * (gadgets/string.h). */
  MinVisible:     0x85055000,
  HookType:       0x85055001,
  GetBlockPos:    0x85055010,
  Mark:           0x85055011,
  AllowMarking:   0x85055012,
  InterimUpdates: 0x85055013,
});

/** String.HookType values (SHK_*). */
export const StringHookType = Object.freeze({
  CUSTOM:       0,
  PASSWORD:     1,
  IPADDRESS:    2,
  FLOAT:        3,
  HEXADECIMAL:  4,
  TELEPHONE:    5,
  POSTALCODE:   6,
  AMOUNT:       7,
  UPPERCASE:    8,
  HOTKEY:       9,  /* v45+ */
});

/**
 * string.gadget — text entry field.
 *
 * @extends GadgetBase
 */
export class StringGadget extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/string.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,

    /* Override the inherited GA_Text mapping. string.gadget ignores
     * GA_Text for content — per string_gc.doc line 309:
     *   "GA_Text is not supported, please use STRING_TextVal as it is
     *    intended."
     * STRINGA_TextVal copies the supplied STRPTR into the gadget's
     * internal buffer on both OM_NEW and OM_SET, and OM_GET returns
     * the live buffer contents. Using `text` in JS therefore gets the
     * ergonomics every other wrapper has — `sg.text = '...'` — while
     * talking to the tag string.gadget actually honors. */
    text:           { tagID: STRINGA.TextVal,      type: 'string-owned' },

    maxChars:       { tagID: STRINGA.MaxChars,     type: 'int32' },
    buffer:         { tagID: STRINGA.Buffer,       type: 'ptr' },  /* caller-owned */
    longVal:        { tagID: STRINGA.LongVal,      type: 'int32' },
    bufferPos:      { tagID: STRINGA.BufferPos,    type: 'int32' },
    dispPos:        { tagID: STRINGA.DispPos,      type: 'int32' },
    replaceMode:    { tagID: STRINGA.ReplaceMode,  type: 'bool' },
    justification:  { tagID: STRINGA.Justification,type: 'uint32' },
    minVisible:     { tagID: STRINGA.MinVisible,   type: 'int32' },
    hookType:       { tagID: STRINGA.HookType,     type: 'uint32' },
    allowMarking:   { tagID: STRINGA.AllowMarking, type: 'bool' },
    interimUpdates: { tagID: STRINGA.InterimUpdates,type: 'bool' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;

    /* STRINGA_MinVisible tells the layout how many characters of
     * display width the gadget needs. Without it, the layout gives
     * the gadget near-zero width and the text — however correctly
     * stored in the internal buffer — is clipped to nothing. Every
     * NDK Examples/String.c instantiation sets this (the macro
     * defaults to no value, so users must remember).
     *
     * Default policy:
     *   - if caller specified maxChars, mirror it clamped to
     *     [4, 40] so narrow fields and very wide ones don't take
     *     over the layout
     *   - otherwise fall back to 10, matching the NDK example
     * Caller can still pass minVisible: explicitly to override. */
    if (clean.minVisible === undefined) {
      if (typeof clean.maxChars === 'number' && clean.maxChars > 0) {
        let mv = clean.maxChars | 0;
        if (mv < 4)  mv = 4;
        if (mv > 40) mv = 40;
        clean.minVisible = mv;
      }
      else {
        clean.minVisible = 10;
      }
    }

    super(clean);
  }
}

EventKind.define('STRING_CHANGED', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/string.gadget',
  wraps: 'ATTR_UPDATE',
});
