/* quickjs-master/amiga/ffi/boopsi/gadgets/GetFile.js
 *
 * getfile.gadget — Reaction file-requester popup button. Extends
 * gadgetclass. Click opens an ASL file requester; selected path is
 * readable via GETFILE_FullFile / GETFILE_File + GETFILE_Drawer.
 *
 * GETFILE_Dummy = REACTION_Dummy + 0x60000 = 0x85060000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind, IDCMP } from '../EventKind.js';

const GETFILE = Object.freeze({
  /* check-constants: prefix GETFILE_ header gadgets/getfile.h
   * The header counts in DECIMAL (GETFILE_Dummy+10 ... +23). Until
   * 0.219 everything from FilterFunc on was wrong, and four names did
   * not exist in the header (NoIcons, ImageHook, ModalRequest,
   * NegativeText, PositiveText). */
  TitleText:      0x85060001,
  LeftEdge:       0x85060002,
  TopEdge:        0x85060003,
  Width:          0x85060004,
  Height:         0x85060005,
  File:           0x85060006,
  Drawer:         0x85060007,
  FullFile:       0x85060008,
  FullFileExpand: 0x85060009,
  Pattern:        0x8506000A,
  DoSaveMode:     0x8506000B,
  DoMultiSelect:  0x8506000C,
  DoPatterns:     0x8506000D,
  DrawersOnly:    0x8506000E,
  FilterFunc:     0x8506000F,
  RejectIcons:    0x85060010,
  RejectPattern:  0x85060011,
  AcceptPattern:  0x85060012,
  FilterDrawers:  0x85060013,
  Filelist:       0x85060014,
  LBNodeStructs:  0x85060015,
  ReadOnly:       0x85060016,
  FilePartOnly:   0x85060017,
});

/** @internal getfile.gadget's own methods (gadgets/getfile.h). */
const GFILE = Object.freeze({
  /* check-constants: prefix GFILE_ header gadgets/getfile.h */
  REQUEST: 0x620001,
});

/**
 * getfile.gadget — file-requester popup button.
 *
 * @extends GadgetBase
 */
export class GetFile extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/getfile.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    titleText:      { tagID: GETFILE.TitleText,      type: 'string-owned' },
    file:           { tagID: GETFILE.File,           type: 'string-owned' },
    drawer:         { tagID: GETFILE.Drawer,         type: 'string-owned' },
    fullFile:       { tagID: GETFILE.FullFile,       type: 'string-owned' },
    fullFileExpand: { tagID: GETFILE.FullFileExpand, type: 'bool' },
    pattern:        { tagID: GETFILE.Pattern,        type: 'string-owned' },
    doSaveMode:     { tagID: GETFILE.DoSaveMode,     type: 'bool' },
    doMultiSelect:  { tagID: GETFILE.DoMultiSelect,  type: 'bool' },
    doPatterns:     { tagID: GETFILE.DoPatterns,     type: 'bool' },
    drawersOnly:    { tagID: GETFILE.DrawersOnly,    type: 'bool' },
    rejectIcons:    { tagID: GETFILE.RejectIcons,    type: 'bool' },
    rejectPattern:  { tagID: GETFILE.RejectPattern,  type: 'string-owned' },
    acceptPattern:  { tagID: GETFILE.AcceptPattern,  type: 'string-owned' },
    filterDrawers:  { tagID: GETFILE.FilterDrawers,  type: 'bool' },
    readOnly:       { tagID: GETFILE.ReadOnly,       type: 'bool' },
    filePartOnly:   { tagID: GETFILE.FilePartOnly,   type: 'bool' },
    /* noIcons, modalRequest, negativeText and positiveText were removed
     * in 0.219: gadgets/getfile.h has no such attributes, and the tags
     * they sent belonged to FilterFunc, Filelist, LBNodeStructs and
     * ReadOnly. Use rejectIcons to hide .info files. */
  };

  constructor(init) {
    /* A number is an existing object to wrap: nothing is created, and
     * the defaults below do not apply. */
    if (typeof init === 'number') { super(init); return; }

    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }

  /**
   * Open the file requester and wait for the user. The gadget does
   * not do this by itself when clicked: gadgets/getfile.h says the
   * GFILE_REQUEST method "should be called whenever you want to open
   * the requester", and gives the macro gfRequestFile(obj, win) for
   * it. The usual place is the handler of the gadget's own
   * FILE_SELECTED event, which arrives when the gadget is clicked:
   *
   *   if (event.kind === EventKind.FILE_SELECTED &&
   *       fileChooser.request()) {
   *     print(fileChooser.get('fullFile'));
   *   }
   *
   * (Until 0.231 this wrapper had no such method, so a GetFile could
   * be clicked but never showed a requester.)
   *
   * @param {object|number} [window] - the window to block while the
   *   requester is up: the Reaction Window object, or a struct Window
   *   pointer. Omit it for the window the gadget is in.
   * @returns {boolean} true if a file was chosen. The autodoc notes
   *   that the method returns 0 when the file field was left empty,
   *   even if the user pressed OK, unless drawersOnly is set.
   * @throws {Error} if there is no open window
   */
  request(window) {
    return this._sendRequest('GetFile.request', GFILE.REQUEST, window) !== 0;
  }
}

EventKind.define('FILE_SELECTED', {
  idcmp: IDCMP.IDCMPUPDATE,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/getfile.gadget',
  wraps: 'ATTR_UPDATE',
});
