/* quickjs-master/amiga/ffi/boopsi/gadgets/GetFile.js
 *
 * getfile.gadget — Reaction file-requester popup button. Extends
 * gadgetclass. Click opens an ASL file requester; selected path is
 * readable via GETFILE_FullFile / GETFILE_File + GETFILE_Drawer.
 *
 * GETFILE_Dummy = REACTION_Dummy + 0x60000 = 0x85060000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const GETFILE = Object.freeze({
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
  NoIcons:        0x8506000F,
  RejectIcons:    0x85060010,
  ImageHook:      0x85060011,
  FilterFunc:     0x85060012,
  FilterDrawers:  0x85060013,
  ModalRequest:   0x85060014,
  NegativeText:   0x85060015,
  PositiveText:   0x85060016,
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
    noIcons:        { tagID: GETFILE.NoIcons,        type: 'bool' },
    rejectIcons:    { tagID: GETFILE.RejectIcons,    type: 'bool' },
    modalRequest:   { tagID: GETFILE.ModalRequest,   type: 'bool' },
    negativeText:   { tagID: GETFILE.NegativeText,   type: 'string-owned' },
    positiveText:   { tagID: GETFILE.PositiveText,   type: 'string-owned' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('FILE_SELECTED', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/getfile.gadget',
  wraps: 'ATTR_UPDATE',
});
