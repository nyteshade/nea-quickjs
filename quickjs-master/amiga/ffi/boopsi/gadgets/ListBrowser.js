/* quickjs-master/amiga/ffi/boopsi/gadgets/ListBrowser.js
 *
 * listbrowser.gadget — Reaction scrollable list with columns, sort,
 * selection. Extends gadgetclass. Rows are LBNA_* nodes in a struct
 * List; columns defined via LBCIA_*.
 *
 * LISTBROWSER_Dummy = REACTION_Dummy + 0x3000 = 0x85003000.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

const LISTBROWSER = Object.freeze({
  Labels:           0x85003001,
  Top:              0x85003002,
  MakeVisible:      0x85003003,
  TopPixel:         0x85003004,
  SortColumn:       0x85003005,
  ShowSelected:     0x85003006,
  Selected:         0x85003007,
  MultiSelect:      0x85003008,
  AutoFit:          0x85003009,
  HorizontalProp:   0x8500300A,
  VerticalProp:     0x8500300B,
  ColumnInfo:       0x8500300C,
  ColumnTitles:     0x8500300D,
  TitleClickable:   0x8500300E,
  RefreshImmediate: 0x8500300F,
  AutoWidth:        0x85003010,
  RowHeight:        0x85003011,
  MinHeight:        0x85003012,
  MinWidth:         0x85003013,
  HierarchicalTree: 0x85003014,
  HierarchyHook:    0x85003015,
  ScrollMultiplier: 0x85003016,
});

/**
 * listbrowser.gadget — scrollable columnar list.
 *
 * @extends GadgetBase
 */
export class ListBrowser extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/listbrowser.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    labels:           { tagID: LISTBROWSER.Labels,           type: 'ptr' },
    top:              { tagID: LISTBROWSER.Top,              type: 'int32' },
    makeVisible:      { tagID: LISTBROWSER.MakeVisible,      type: 'int32' },
    sortColumn:       { tagID: LISTBROWSER.SortColumn,       type: 'int32' },
    showSelected:     { tagID: LISTBROWSER.ShowSelected,     type: 'ptr' },
    selected:         { tagID: LISTBROWSER.Selected,         type: 'int32' },
    multiSelect:      { tagID: LISTBROWSER.MultiSelect,      type: 'uint32' },
    autoFit:          { tagID: LISTBROWSER.AutoFit,          type: 'bool' },
    columnInfo:       { tagID: LISTBROWSER.ColumnInfo,       type: 'ptr' },
    columnTitles:     { tagID: LISTBROWSER.ColumnTitles,     type: 'bool' },
    titleClickable:   { tagID: LISTBROWSER.TitleClickable,   type: 'bool' },
    autoWidth:        { tagID: LISTBROWSER.AutoWidth,        type: 'bool' },
    rowHeight:        { tagID: LISTBROWSER.RowHeight,        type: 'int32' },
    minHeight:        { tagID: LISTBROWSER.MinHeight,        type: 'int32' },
    minWidth:         { tagID: LISTBROWSER.MinWidth,         type: 'int32' },
    hierarchicalTree: { tagID: LISTBROWSER.HierarchicalTree, type: 'bool' },
    scrollMultiplier: { tagID: LISTBROWSER.ScrollMultiplier, type: 'int32' },
  };

  constructor(init) {
    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;
    super(clean);
  }
}

EventKind.define('LIST_SELECT', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/listbrowser.gadget',
  wraps: 'ATTR_UPDATE',
});
