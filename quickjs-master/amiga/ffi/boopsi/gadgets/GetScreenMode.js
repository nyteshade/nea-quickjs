/* quickjs-master/amiga/ffi/boopsi/gadgets/GetScreenMode.js
 *
 * getscreenmode.gadget — Reaction screenmode-requester popup.
 *
 * GETSCREENMODE_Dummy = REACTION_Dummy + 0x41000 = 0x85041000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const GETSCREENMODE = Object.freeze({
  TitleText:          0x85041001,
  DisplayID:          0x85041002,
  DisplayWidth:       0x85041003,
  DisplayHeight:      0x85041004,
  DisplayDepth:       0x85041005,
  AutoScroll:         0x85041006,
  OverscanType:       0x85041007,
  DoWidth:            0x85041008,
  DoHeight:           0x85041009,
  DoDepth:            0x8504100A,
  DoOverscanType:     0x8504100B,
  DoAutoScroll:       0x8504100C,
  FilterFunc:         0x8504100D,
  MinWidth:           0x8504100E,
  MaxWidth:           0x8504100F,
  MinHeight:          0x85041010,
  MaxHeight:          0x85041011,
  MinDepth:           0x85041012,
  MaxDepth:           0x85041013,
  CustomSMList:       0x85041014,
  PropertyFlags:      0x85041015,
  PropertyMask:       0x85041016,
  ModalRequest:       0x85041017,
  NegativeText:       0x85041018,
  PositiveText:       0x85041019,
});

/**
 * getscreenmode.gadget — screenmode-requester popup button.
 *
 * @extends GadgetBase
 */
export class GetScreenMode extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/getscreenmode.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    titleText:      { tagID: GETSCREENMODE.TitleText,     type: 'string-owned' },
    displayID:      { tagID: GETSCREENMODE.DisplayID,     type: 'uint32' },
    displayWidth:   { tagID: GETSCREENMODE.DisplayWidth,  type: 'int32' },
    displayHeight:  { tagID: GETSCREENMODE.DisplayHeight, type: 'int32' },
    displayDepth:   { tagID: GETSCREENMODE.DisplayDepth,  type: 'int32' },
    autoScroll:     { tagID: GETSCREENMODE.AutoScroll,    type: 'bool' },
    overscanType:   { tagID: GETSCREENMODE.OverscanType,  type: 'uint32' },
    doWidth:        { tagID: GETSCREENMODE.DoWidth,       type: 'bool' },
    doHeight:       { tagID: GETSCREENMODE.DoHeight,      type: 'bool' },
    doDepth:        { tagID: GETSCREENMODE.DoDepth,       type: 'bool' },
    doOverscanType: { tagID: GETSCREENMODE.DoOverscanType,type: 'bool' },
    doAutoScroll:   { tagID: GETSCREENMODE.DoAutoScroll,  type: 'bool' },
    minWidth:       { tagID: GETSCREENMODE.MinWidth,      type: 'int32' },
    maxWidth:       { tagID: GETSCREENMODE.MaxWidth,      type: 'int32' },
    minHeight:      { tagID: GETSCREENMODE.MinHeight,     type: 'int32' },
    maxHeight:      { tagID: GETSCREENMODE.MaxHeight,     type: 'int32' },
    minDepth:       { tagID: GETSCREENMODE.MinDepth,      type: 'int32' },
    maxDepth:       { tagID: GETSCREENMODE.MaxDepth,      type: 'int32' },
    modalRequest:   { tagID: GETSCREENMODE.ModalRequest,  type: 'bool' },
    negativeText:   { tagID: GETSCREENMODE.NegativeText,  type: 'string-owned' },
    positiveText:   { tagID: GETSCREENMODE.PositiveText,  type: 'string-owned' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('SCREENMODE_SELECTED', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/getscreenmode.gadget',
  wraps: 'ATTR_UPDATE',
});
