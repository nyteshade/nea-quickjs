/* quickjs-master/amiga/ffi/boopsi/classes/Requester.js
 *
 * requester.class — Reaction's modal requester. Supports several
 * sub-types (info, string, integer, progress) via REQ_Type. The
 * BOOPSI object persists across calls; invoke OpenReq / CloseReq
 * methods to show/hide.
 *
 * REQ_Dummy = REACTION_Dummy + 0x45000 = 0x85045000.
 */

import { BOOPSIBase } from '../BOOPSIBase.js';

/** @internal REQ_* tag IDs (classes/requester.h). */
const REQ = Object.freeze({
  Type:        0x85045001,
  TitleText:   0x85045002,
  BodyText:    0x85045003,
  GadgetText:  0x85045004,
  ReturnCode:  0x85045005,
  Image:       0x85045007,
  VarArgs:     0x85045008,
  EvenButtons: 0x85045009,
  WrapBorder:  0x8504500A,
  TimeOutSecs: 0x8504500B,
  Inactive:    0x8504500D,
  StayOnTop:   0x8504500F,
  ForceFocus:  0x85045010,
});

/** REQ_Type values. */
export const RequesterType = Object.freeze({
  INFO:     0,
  STRING:   1,
  INTEGER:  2,
  PROGRESS: 3,
});

/** REQ_Image values (standard icons). */
export const RequesterImage = Object.freeze({
  DEFAULT: 0,
  INFO:    1,
  WARNING: 2,
  ERROR:   3,
  QUESTION:4,
  INSERT:  5,
});

/* Method IDs (classes/requester.h). Like WM_*, these are plain
 * integers, not tag offsets. */
const RM_OPENREQ  = 0x450001;
const RM_CLOSEREQ = 0x450002;

/**
 * requester.class — modal requester (info / string / integer / progress).
 *
 * @extends BOOPSIBase
 */
export class Requester extends BOOPSIBase {
  /** @type {string} */
  static _classLibName = 'classes/requester.class';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    type:        { tagID: REQ.Type,        type: 'uint32' },
    titleText:   { tagID: REQ.TitleText,   type: 'string-owned' },
    bodyText:    { tagID: REQ.BodyText,    type: 'string-owned' },
    gadgetText:  { tagID: REQ.GadgetText,  type: 'string-owned' },
    returnCode:  { tagID: REQ.ReturnCode,  type: 'uint32', readOnly: true },
    image:       { tagID: REQ.Image,       type: 'uint32' },
    evenButtons: { tagID: REQ.EvenButtons, type: 'bool' },
    wrapBorder:  { tagID: REQ.WrapBorder,  type: 'bool' },
    timeOutSecs: { tagID: REQ.TimeOutSecs, type: 'int32' },
    inactive:    { tagID: REQ.Inactive,    type: 'bool' },
    stayOnTop:   { tagID: REQ.StayOnTop,   type: 'bool' },
    forceFocus:  { tagID: REQ.ForceFocus,  type: 'bool' },
  };

  /**
   * Show the requester (modal). Returns the index of the button the
   * user clicked (or the timeout outcome). Caller passes an optional
   * window to parent to.
   *
   * @param   {Window|number|null} parentWindow
   * @returns {number}
   */
  openReq(parentWindow) {
    let pw = 0;
    if (parentWindow && typeof parentWindow === 'object' &&
        'ptr' in parentWindow) {
      pw = parentWindow.ptr | 0;
    } else if (typeof parentWindow === 'number') {
      pw = parentWindow | 0;
    }
    return this.doMethod(RM_OPENREQ, pw);
  }

  /**
   * Close a non-modal requester. For modal types openReq blocks until
   * the user clicks a gadget or the timeout fires.
   *
   * @returns {undefined}
   */
  closeReq() {
    this.doMethod(RM_CLOSEREQ);
  }
}
