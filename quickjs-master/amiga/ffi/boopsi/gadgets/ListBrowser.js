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

/** @internal LISTBROWSER_* tag IDs (gadgets/listbrowser.h). */
const LISTBROWSER = Object.freeze({
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
  Selected:   0x85003501,
  Flags:      0x85003502,
  UserData:   0x85003503,
  Column:     0x85003504,
  Generation: 0x8500350C,
});

/** @internal LBNCA_* node-column attribute tags. */
export const LBNCA = Object.freeze({
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
    multiSelect:      { tagID: LISTBROWSER.MultiSelect,      type: 'uint32' },
    columnInfo:       { tagID: LISTBROWSER.ColumnInfo,       type: 'ptr' },
    makeVisible:      { tagID: LISTBROWSER.MakeVisible,      type: 'int32' },
    borderless:       { tagID: LISTBROWSER.Borderless,       type: 'bool' },
    autoFit:          { tagID: LISTBROWSER.AutoFit,          type: 'bool' },
    columnTitles:     { tagID: LISTBROWSER.ColumnTitles,     type: 'bool' },
    showSelected:     { tagID: LISTBROWSER.ShowSelected,     type: 'ptr' },
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

  /** @internal */
  static _buildLabelList(labels) {
    ListBrowser.ensureClass();
    const libBase = ListBrowser._libBase;
    if (!libBase) throw new Error('ListBrowser: class library base not cached');

    const LIST_BYTES = 16;
    const listPtr = globalThis.amiga.allocMem(LIST_BYTES);
    if (!listPtr) throw new Error('ListBrowser: allocMem list failed');

    globalThis.amiga.poke32(listPtr + 0, listPtr + 4);
    globalThis.amiga.poke32(listPtr + 4, 0);
    globalThis.amiga.poke32(listPtr + 8, listPtr + 0);

    const nodes       = [];
    const labelAllocs = [];

    for (let lbl of labels) {
      const s = String(lbl);
      const sB = s.length + 1;
      const sP = globalThis.amiga.allocMem(sB);
      globalThis.amiga.pokeString(sP, s);
      labelAllocs.push([sP, sB]);

      /* LBNCA_CopyText=TRUE tells listbrowser to copy the text into
       * its own buffer; after Alloc returns we could free sP, but we
       * keep the same discipline as RadioButton and hold the JS side
       * until dispose. Consistent cleanup path matters more than the
       * few bytes saved. */
      const tags = globalThis.amiga.makeTags([
        [LBNCA.CopyText, 1],
        [LBNCA.Text,     sP],
      ]);
      if (!tags) throw new Error('ListBrowser: makeTags failed');

      /* AllocListBrowserNodeA(numcolumns=1, tags). d0=1, a0=tags. */
      const nodePtr = globalThis.amiga.call(libBase, LISTBROWSER_LVO_ALLOC_NODE, {
        d0: 1,
        a0: tags,
      });
      globalThis.amiga.freeMem(tags, 24);  /* 3 tag items × 8 bytes */

      if (!nodePtr) {
        for (let n of nodes) {
          globalThis.amiga.call(libBase, LISTBROWSER_LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
        throw new Error('ListBrowser: AllocListBrowserNodeA returned 0');
      }

      nodes.push({ nodePtr });
    }

    for (let n of nodes) {
      const pred = globalThis.amiga.peek32(listPtr + 8);
      globalThis.amiga.poke32(n.nodePtr + 0, listPtr + 4);
      globalThis.amiga.poke32(n.nodePtr + 4, pred);
      globalThis.amiga.poke32(pred        + 0, n.nodePtr);
      globalThis.amiga.poke32(listPtr     + 8, n.nodePtr);
    }

    return {
      listPtr,
      freeAll() {
        for (let n of nodes) {
          globalThis.amiga.call(libBase, LISTBROWSER_LVO_FREE_NODE, { a0: n.nodePtr });
        }
        for (let [p, b] of labelAllocs) globalThis.amiga.freeMem(p, b);
        globalThis.amiga.freeMem(listPtr, LIST_BYTES);
      },
    };
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
