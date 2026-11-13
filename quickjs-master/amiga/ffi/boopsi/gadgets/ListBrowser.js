/* quickjs-master/amiga/ffi/boopsi/gadgets/ListBrowser.js
 *
 * listbrowser.gadget — Reaction scrollable list with columns, sort,
 * selection. Extends gadgetclass. Rows are nodes in a struct List
 * with LBNA_* (node-level) and LBNCA_* (node-column) attributes;
 * columns are defined via LBCIA_*.
 *
 * LISTBROWSER_Dummy = REACTION_Dummy + 0x3000 = 0x85003000.
 *
 * listbrowser_lib LVO layout (listbrowser_lib.fd):
 *   -30  LISTBROWSER_GetClass()             -> Class*
 *   -36  AllocListBrowserNodeA(cols, tags)  -> Node*    (d0/a0)
 *   -42  FreeListBrowserNode(node)                      (a0)
 *   -48  SetListBrowserNodeAttrsA                       (a0/a1)
 *   -54  GetListBrowserNodeAttrsA                       (a0/a1)
 *   -60  ListBrowserSelectAll(list)                     (a0)
 *   -66  ShowListBrowserNodeChildren(node, depth)       (a0/d0)
 *   -72  HideListBrowserNodeChildren(node)              (a0)
 *   -78  ShowAllListBrowserChildren(list)               (a0)
 *   -84  HideAllListBrowserChildren(list)               (a0)
 *   -90  FreeListBrowserList(list)                      (a0)
 *   -96  AllocLBColumnInfoA(cols, tags)     -> LBCI*    (d0/a0)  [V45]
 *   -114 FreeLBColumnInfo(columninfo)                   (a0)
 *
 * NOTE: prior table had every LISTBROWSER_* value wrong (shifted by
 * 2 slots — labels was pointing at Top, etc.). Re-derived from
 * gadgets/listbrowser.h for this version.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';
import { buildNodeList } from '../NodeList.js';

/** @internal LISTBROWSER_* tag IDs (gadgets/listbrowser.h). */
const LISTBROWSER = Object.freeze({
  /* check-constants: prefix LISTBROWSER_ header gadgets/listbrowser.h */
  Top:                0x85003001,
  Labels:             0x85003003,
  Selected:           0x85003004,
  SelectedNode:       0x85003005,
  MultiSelect:        0x85003006,
  VertSeparators:     0x85003007,  /* alias: Separators */
  ColumnInfo:         0x85003008,
  MakeVisible:        0x85003009,
  VirtualWidth:       0x8500300A,
  Borderless:         0x8500300B,
  VerticalProp:       0x8500300C,
  HorizontalProp:     0x8500300D,
  Left:               0x8500300E,
  AutoFit:            0x85003010,
  ColumnTitles:       0x85003011,
  ShowSelected:       0x85003012,
  Hierarchical:       0x8500301B,
  ShowImage:          0x8500301C,
  HideImage:          0x8500301D,
  LeafImage:          0x8500301E,
  ScrollRaster:       0x8500301F,
  Spacing:            0x85003020,
  Editable:           0x85003021,
  Position:           0x85003022,
  EditNode:           0x85003023,
  EditColumn:         0x85003024,
  RelEvent:           0x85003025,
  NumSelected:        0x85003026,
  EditTags:           0x85003027,
  RelColumn:          0x85003028,
  HorizSeparators:    0x85003029,
  CheckImage:         0x8500302A,
  UncheckedImage:     0x8500302B,
  TotalNodes:         0x8500302C,
  MinNodeSize:        0x8500302D,
  TitleClickable:     0x8500302E,
  MinVisible:         0x8500302F,
  PersistSelect:      0x85003032,
  CursorSelect:       0x85003033,
  CursorNode:         0x85003034,
  FastRender:         0x85003035,
  TotalVisibleNodes:  0x85003036,
  WrapText:           0x85003037,
  SortColumn:         0x8500303D,
  Striping:           0x8500303E,
  AutoWheel:          0x85003040,
  StayActive:         0x85003041,
  EditTrigger:        0x85003042,
});

/** @internal LBNA_* node-level attribute tags (LBNA_Dummy = TAG_USER+0x5003500). */
export const LBNA = Object.freeze({
  /* check-constants: prefix LBNA_ header gadgets/listbrowser.h */
  Selected:   0x85003501,
  Flags:      0x85003502,
  UserData:   0x85003503,
  Column:     0x85003504,
  Generation: 0x8500350C,
});

/** @internal LBNCA_* node-column attribute tags. */
export const LBNCA = Object.freeze({
  /* check-constants: prefix LBNCA_ header gadgets/listbrowser.h */
  Text:          0x85003505,
  Integer:       0x85003506,
  FGPen:         0x85003507,
  BGPen:         0x85003508,
  Image:         0x85003509,
  SelImage:      0x8500350A,
  HorizJustify:  0x8500350B,  /* alias: Justification */
  Editable:      0x8500350D,
  MaxChars:      0x8500350E,
  CopyText:      0x8500350F,
  EditTags:      0x85003513,
  RenderHook:    0x85003514,
  HookHeight:    0x85003516,
  CopyInteger:   0x8500351A,
  WordWrap:      0x8500351B,
  VertJustify:   0x8500351C,
  FillPen:       0x8500351D,
});

/** @internal LBCIA_* column-info attribute tags. */
export const LBCIA = Object.freeze({
  /* check-constants: prefix LBCIA_ header gadgets/listbrowser.h */
  MemPool:          0x85003532,
  Column:           0x85003533,
  Title:            0x85003534,
  Weight:           0x85003535,
  Width:            0x85003536,
  Flags:            0x85003537,
  UserData:         0x85003539,
  AutoSort:         0x8500353A,
  SortDirection:    0x8500353B,
  CompareHook:      0x8500353C,
  Sortable:         0x8500353D,
  DraggableSeparator:0x8500353E,
  Separator:        0x8500353F,
  SortArrow:        0x85003540,
});

/** LBFLG_* node flags (gadgets/listbrowser.h line 257-261). */
export const LBFLG = Object.freeze({
  /* check-constants: prefix LBFLG_ header gadgets/listbrowser.h */
  READONLY:     1,
  CUSTOMPENS:   2,
  HASCHILDREN:  4,
  SHOWCHILDREN: 8,
  HIDDEN:      16,
});

/** listbrowser_lib LVO offsets used by _buildLabelList. */
const LISTBROWSER_LVO_ALLOC_NODE = -36;
const LISTBROWSER_LVO_FREE_NODE  = -42;

/**
 * listbrowser.gadget — scrollable columnar list.
 *
 * Pass `labels: ['Row 1','Row 2','Row 3']` to auto-build a single-column
 * list. For multi-column or editable rows build nodes yourself with
 * AllocListBrowserNodeA-equivalent plumbing and pass `labelsPtr: ptr`
 * directly.
 *
 * @extends GadgetBase
 */
export class ListBrowser extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/listbrowser.gadget';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    labelsPtr:        { tagID: LISTBROWSER.Labels,           type: 'ptr' },
    top:              { tagID: LISTBROWSER.Top,              type: 'int32' },
    selected:         { tagID: LISTBROWSER.Selected,         type: 'int32' },
    selectedNode:     { tagID: LISTBROWSER.SelectedNode,     type: 'ptr' },
    multiSelect:      { tagID: LISTBROWSER.MultiSelect,      type: 'bool' },   /* (BOOL) */
    columnInfo:       { tagID: LISTBROWSER.ColumnInfo,       type: 'ptr' },
    makeVisible:      { tagID: LISTBROWSER.MakeVisible,      type: 'int32' },
    borderless:       { tagID: LISTBROWSER.Borderless,       type: 'bool' },
    autoFit:          { tagID: LISTBROWSER.AutoFit,          type: 'bool' },
    columnTitles:     { tagID: LISTBROWSER.ColumnTitles,     type: 'bool' },
    showSelected:     { tagID: LISTBROWSER.ShowSelected,     type: 'bool' },   /* (BOOL); was ptr until 0.224 */
    hierarchical:     { tagID: LISTBROWSER.Hierarchical,     type: 'bool' },
    spacing:          { tagID: LISTBROWSER.Spacing,          type: 'int32' },
    editable:         { tagID: LISTBROWSER.Editable,         type: 'bool' },
    position:         { tagID: LISTBROWSER.Position,         type: 'uint32' },
    numSelected:      { tagID: LISTBROWSER.NumSelected,      type: 'int32' },
    titleClickable:   { tagID: LISTBROWSER.TitleClickable,   type: 'bool' },
    minVisible:       { tagID: LISTBROWSER.MinVisible,       type: 'int32' },
    cursorNode:       { tagID: LISTBROWSER.CursorNode,       type: 'ptr' },
    totalVisibleNodes:{ tagID: LISTBROWSER.TotalVisibleNodes,type: 'int32' },
    wrapText:         { tagID: LISTBROWSER.WrapText,         type: 'bool' },
    sortColumn:       { tagID: LISTBROWSER.SortColumn,       type: 'int32' },
    stayActive:       { tagID: LISTBROWSER.StayActive,       type: 'bool' },
    editTrigger:      { tagID: LISTBROWSER.EditTrigger,      type: 'uint32' },
  };

  /**
   * @param {object} init
   * @param {string[]} [init.labels] — row-text array built into a
   *     single-column list, each node uses LBNCA_Text. Copied into
   *     the gadget via LBNCA_CopyText so JS-owned strings can be freed
   *     immediately after construction. Nodes + list are freed at dispose.
   * @param {number} [init.labelsPtr] — pointer to a pre-built List
   * @param {boolean} [init.relVerify=true]
   */
  constructor(init) {
    /* A number is an existing object to wrap: nothing is created, and
     * the defaults below do not apply. */
    if (typeof init === 'number') { super(init); return; }

    let clean = (init && typeof init === 'object') ? { ...init } : {};
    if (clean.relVerify === undefined) clean.relVerify = true;

    let ownedLabels = null;
    if (Array.isArray(clean.labels)) {
      ownedLabels = ListBrowser._buildLabelList(clean.labels);
      clean.labelsPtr = ownedLabels.listPtr;
      delete clean.labels;
    }

    super(clean);
    this._ownedLabels = ownedLabels;
  }

  /**
   * Build the LISTBROWSER_Labels list: one single-column
   * AllocListBrowserNodeA node per label. LBNCA_CopyText makes the
   * class copy the text, so our strings could be freed at once; they
   * are kept until dispose() like every other gadget's, so that there
   * is one clean-up path.
   *
   * @internal
   * @param   {string[]} labels
   * @returns {{listPtr: number, freeAll: function(): undefined}}
   */
  static _buildLabelList(labels) {
    ListBrowser.ensureClass();
    if (!ListBrowser._libBase) {
      throw new Error('ListBrowser: class library base not cached');
    }

    return buildNodeList({
      owner:    'ListBrowser',
      libBase:  ListBrowser._libBase,
      /* AllocListBrowserNodeA(d0 columns, a0 tags) */
      allocLvo: LISTBROWSER_LVO_ALLOC_NODE,
      freeLvo:  LISTBROWSER_LVO_FREE_NODE,
      count:    labels.length,
      describe: (index, keep) => ({
        d0:    1,
        pairs: [
          [LBNCA.CopyText, 1],
          [LBNCA.Text,     keep.string(labels[index])],
        ],
      }),
    });
  }

  dispose() {
    if (this._disposed) return;
    super.dispose();
    if (this._ownedLabels) {
      try { this._ownedLabels.freeAll(); }
      catch (e) { /* cascaded free */ }
      this._ownedLabels = null;
    }
  }
}

EventKind.define('LIST_SELECT', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: true, hasCoords: false },
  from:  'gadgets/listbrowser.gadget',
  wraps: 'ATTR_UPDATE',
});
