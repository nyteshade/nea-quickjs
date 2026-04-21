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

/** @internal STRINGA_* tag IDs (gadgets/string.h). */
const STRINGA = Object.freeze({
  /* strgclass tags (STRINGA_Dummy = TAG_USER+0x32000 per gadgets/strgclass.h) */
  MaxChars:     0x80032000 + 1,
  Buffer:       0x80032000 + 2,
  UndoBuffer:   0x80032000 + 3,
  WorkBuffer:   0x80032000 + 4,
  BufferPos:    0x80032000 + 5,
  DispPos:      0x80032000 + 6,
  AltKeyMap:    0x80032000 + 7,
  Font:         0x80032000 + 8,
  Pens:         0x80032000 + 9,
  ActivePens:   0x80032000 + 10,
  EditHook:     0x80032000 + 11,
  EditModes:    0x80032000 + 12,
  ReplaceMode:  0x80032000 + 13,
  FixedFieldMode:0x80032000 + 14,
  NoFilterMode: 0x80032000 + 15,
  Justification:0x80032000 + 16,
  LongVal:      0x80032000 + 17,
  FloatVal:     0x80032000 + 18,
  TextVal:      0x80032000 + 19,

  /* Reaction-specific additions */
  MinVisible:          0x85055000,
  HookType:            0x85055001,
  GetBlockPos:         0x85055010,
  Mark:                0x85055011,
  AllowMarking:        0x85055012,
  InterimUpdates:      0x85055013,
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
    maxChars:       { tagID: STRINGA.MaxChars,     type: 'int32' },
    buffer:         { tagID: STRINGA.Buffer,       type: 'ptr' },  /* caller-owned */
    textVal:        { tagID: STRINGA.TextVal,      type: 'ptr' },
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
