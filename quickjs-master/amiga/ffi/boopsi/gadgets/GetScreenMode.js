/* quickjs-master/amiga/ffi/boopsi/gadgets/GetScreenMode.js
 *
 * getscreenmode.gadget — screen-mode requester pop-up.
 *
 * GETSCREENMODE_Dummy = REACTION_Dummy + 0x41000 = 0x85041000.
 *
 * Tags re-derived from gadgets/getscreenmode.h (NDK 3.2R4). Previous
 * table had DisplayID at +2 instead of Height; the correct layout is
 * TitleText +1, Height +2, Width +3, LeftEdge +4, TopEdge +5,
 * DisplayID +6, DisplayWidth/Height/Depth +7..+9,
 * OverscanType/AutoScroll +10/+11, then Do* +12..+16. ModalRequest /
 * Negative/PositiveText / CustomSMList from the old table don't
 * exist in the OS3.2 header.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal GETSCREENMODE_* tag IDs (gadgets/getscreenmode.h). */
const GETSCREENMODE = Object.freeze({
  TitleText:       0x85041001,   /* +1 */
  Height:          0x85041002,   /* +2 */
  Width:           0x85041003,   /* +3 */
  LeftEdge:        0x85041004,   /* +4 */
  TopEdge:         0x85041005,   /* +5 */
  DisplayID:       0x85041006,   /* +6 */
  DisplayWidth:    0x85041007,   /* +7 */
  DisplayHeight:   0x85041008,   /* +8 */
  DisplayDepth:    0x85041009,   /* +9 */
  OverscanType:    0x8504100A,   /* +10 */
  AutoScroll:      0x8504100B,   /* +11 */
  DoWidth:         0x8504100C,   /* +12 */
  DoHeight:        0x8504100D,   /* +13 */
  DoDepth:         0x8504100E,   /* +14 */
  DoOverscanType:  0x8504100F,   /* +15 */
  DoAutoScroll:    0x85041010,   /* +16 */
  FilterFunc:      0x85041011,   /* +17 */
  MinWidth:        0x85041012,   /* +18 */
  MaxWidth:        0x85041013,   /* +19 */
  MinHeight:       0x85041014,   /* +20 */
  MaxHeight:       0x85041015,   /* +21 */
  MinDepth:        0x85041016,   /* +22 */
  MaxDepth:        0x85041017,   /* +23 */
  PropertyFlags:   0x85041018,   /* +24 */
  PropertyMask:    0x85041019,   /* +25 */
});

/**
 * getscreenmode.gadget — Reaction screen-mode requester.
 *
 * @extends GadgetBase
 */
export class GetScreenMode extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/getscreenmode.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    titleText:      { tagID: GETSCREENMODE.TitleText,      type: 'string-owned' },
    height:         { tagID: GETSCREENMODE.Height,         type: 'int32' },
    width:          { tagID: GETSCREENMODE.Width,          type: 'int32' },
    leftEdge:       { tagID: GETSCREENMODE.LeftEdge,       type: 'int32' },
    topEdge:        { tagID: GETSCREENMODE.TopEdge,        type: 'int32' },
    displayID:      { tagID: GETSCREENMODE.DisplayID,      type: 'uint32' },
    displayWidth:   { tagID: GETSCREENMODE.DisplayWidth,   type: 'int32' },
    displayHeight:  { tagID: GETSCREENMODE.DisplayHeight,  type: 'int32' },
    displayDepth:   { tagID: GETSCREENMODE.DisplayDepth,   type: 'int32' },
    overscanType:   { tagID: GETSCREENMODE.OverscanType,   type: 'uint32' },
    autoScroll:     { tagID: GETSCREENMODE.AutoScroll,     type: 'bool' },
    doWidth:        { tagID: GETSCREENMODE.DoWidth,        type: 'bool' },
    doHeight:       { tagID: GETSCREENMODE.DoHeight,       type: 'bool' },
    doDepth:        { tagID: GETSCREENMODE.DoDepth,        type: 'bool' },
    doOverscanType: { tagID: GETSCREENMODE.DoOverscanType, type: 'bool' },
    doAutoScroll:   { tagID: GETSCREENMODE.DoAutoScroll,   type: 'bool' },
    filterFunc:     { tagID: GETSCREENMODE.FilterFunc,     type: 'ptr' },
    minWidth:       { tagID: GETSCREENMODE.MinWidth,       type: 'int32' },
    maxWidth:       { tagID: GETSCREENMODE.MaxWidth,       type: 'int32' },
    minHeight:      { tagID: GETSCREENMODE.MinHeight,      type: 'int32' },
    maxHeight:      { tagID: GETSCREENMODE.MaxHeight,      type: 'int32' },
    minDepth:       { tagID: GETSCREENMODE.MinDepth,       type: 'int32' },
    maxDepth:       { tagID: GETSCREENMODE.MaxDepth,       type: 'int32' },
    propertyFlags:  { tagID: GETSCREENMODE.PropertyFlags,  type: 'uint32' },
    propertyMask:   { tagID: GETSCREENMODE.PropertyMask,   type: 'uint32' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }

  /**
   * Pop the screen-mode requester. Per gadgets/getscreenmode.h:120-135,
   * the gadget itself is passive — application must send GSM_REQUEST
   * (0x610001) with the locking window pointer to open the picker.
   *
   * Typical pattern: a separate "Pick Screen Mode..." Button whose
   * BUTTON_CLICK handler calls `picker.request(win.intuiWindow.ptr)`.
   * After selection, SCREENMODE_SELECTED fires and
   * `picker.get('displayID')` etc. return the chosen mode.
   *
   * @param {number} winStructPtr — struct Window * (use win.intuiWindow.ptr)
   * @returns {number}
   */
  request(winStructPtr) {
    return this.doMethod(0x610001, winStructPtr | 0);
  }
}

EventKind.define('SCREENMODE_SELECTED', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/getscreenmode.gadget',
  wraps: 'ATTR_UPDATE',
});
