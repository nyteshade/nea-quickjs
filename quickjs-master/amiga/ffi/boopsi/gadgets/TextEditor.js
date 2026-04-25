/* quickjs-master/amiga/ffi/boopsi/gadgets/TextEditor.js
 *
 * texteditor.gadget — multi-line text edit / code editor control.
 * One of the most complex Reaction classes.
 *
 * TEXTEDITOR_Dummy = REACTION_Dummy + 0x26000 = 0x85026000.
 *
 * Tags re-derived from gadgets/texteditor.h (NDK 3.2R4). The previous
 * table had hand-typed values contiguous from +1 — the real header is
 * a sparse sprinkle with many "not implemented", "Private!!!", and
 * "broken !" tags interleaved. Using the contiguous guess meant
 * `editor.contents = s` wrote to +1 (GA_TEXTEDITOR_Prop_Release, a
 * "Private!!!" tag) instead of +2 (GA_TEXTEDITOR_Contents). Several
 * attrs that were in the old table don't exist at all in the OS3.2
 * header (Columns, CursorPosition, StopCursorBlink, SmoothScroll,
 * Pen_FG/BG, Slider, FormatCode, HasChanged_ACK, ...) — dropped.
 */

import { GadgetBase, GADGET_ATTRS } from '../GadgetBase.js';
import { EventKind } from '../EventKind.js';

/** @internal GA_TEXTEDITOR_* tag IDs (gadgets/texteditor.h). */
const TEXTEDITOR = Object.freeze({
  Contents:        0x85026002,   /* +0x02 — the text */
  CursorX:         0x85026004,   /* +0x04 — position in block */
  CursorY:         0x85026005,   /* +0x05 — block number */
  DoubleClickHook: 0x85026006,   /* +0x06 */
  TypeAndSpell:    0x85026007,   /* +0x07 — obsolete, use HighlighterHook */
  ExportHook:      0x85026008,   /* +0x08 */
  ExportWrap:      0x85026009,   /* +0x09 */
  FixedFont:       0x8502600A,   /* +0x0a */
  Flow:            0x8502600B,   /* +0x0b — broken per header comment */
  HasChanged:      0x8502600C,   /* +0x0c */
  ImportHook:      0x8502600E,   /* +0x0e */
  InsertMode:      0x8502600F,   /* +0x0f — always TRUE, not implemented */
  ImportWrap:      0x85026010,   /* +0x10 */
  KeyBindings:     0x85026011,   /* +0x11 */
  UndoAvailable:   0x85026012,   /* +0x12 */
  RedoAvailable:   0x85026013,   /* +0x13 */
  AreaMarked:      0x85026014,   /* +0x14 */
  Prop_Entries:    0x85026015,   /* +0x15 */
  Prop_Visible:    0x85026016,   /* +0x16 */
  Quiet:           0x85026017,   /* +0x17 */
  ReadOnly:        0x85026019,   /* +0x19 */
  StyleBold:       0x8502601C,   /* +0x1c — not implemented */
  StyleItalic:     0x8502601D,   /* +0x1d — not implemented */
  StyleUnderline:  0x8502601E,   /* +0x1e — not implemented */
  Prop_First:      0x85026020,   /* +0x20 */
  WrapBorder:      0x85026021,   /* +0x21 */
  Separator:       0x8502602C,   /* +0x2c — broken per header comment */
  HorizontalScroll:0x8502602D,   /* +0x2d */
  Pen:             0x8502602E,   /* +0x2e — not implemented */
  ColorMap:        0x8502602F,   /* +0x2f — not implemented */
  TabSize:         0x85026035,   /* +0x35 — aka SpacesPerTAB */
  AutoIndent:      0x8502603B,   /* +0x3b */
  CutCopyLineWhenNoSelection: 0x8502603C,  /* +0x3c */
  LineEndingImported: 0x8502603D, /* +0x3d */
  LineEndingExport:   0x8502603E, /* +0x3e */
  TabKeyPolicy:       0x8502603F, /* +0x3f */
});

/**
 * texteditor.gadget — multi-line text editor.
 *
 * Only the attrs documented as implemented in OS3.2R4 (per header
 * comments) are exposed here. OS4-only attrs (HorizScroller,
 * VertScroller, TextAttr, ...) and attrs flagged "not implemented"
 * or "Private!!!" are omitted to keep the API honest.
 *
 * @extends GadgetBase
 */
export class TextEditor extends GadgetBase {
  /** @type {string} */
  static _classLibName = 'gadgets/texteditor.gadget';

  /** @internal Gadget method IDs — separate namespace from ATTR tags.
   * Header `gadgets/texteditor.h` line 100 does:
   *   #undef    TEXTEDITOR_Dummy
   *   #define   TEXTEDITOR_Dummy   (0x45000)
   * which redefines TEXTEDITOR_Dummy from REACTION_Dummy+0x26000
   * (the GA_* attr base, 0x85026000) to plain 0x00045000 (the GM_*
   * method-id base). So GM_TEXTEDITOR_ClearText is 0x00045000+0x24,
   * NOT 0x85026000+0x24. Earlier Fina notes had this wrong.
   */
  static METHOD = Object.freeze({
    ClearText:  0x00045024,   /* GP_TEXTEDITOR_ClearText  { ULONG; GadgetInfo* } */
    ExportText: 0x00045025,
    InsertText: 0x00045026,   /* GP_TEXTEDITOR_InsertText { ULONG; GadgetInfo*; STRPTR; LONG } */
  });

  /** GP_TEXTEDITOR_InsertText pos values per gadgets/texteditor.h:165-167. */
  static InsertPos = Object.freeze({
    CURSOR: 0,   /* at current cursor position */
    TOP:    1,   /* prepend */
    BOTTOM: 2,   /* append (canonical for "load file content") */
  });

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...GADGET_ATTRS,
    contents:        { tagID: TEXTEDITOR.Contents,        type: 'string-owned' },
    cursorX:         { tagID: TEXTEDITOR.CursorX,         type: 'int32' },
    cursorY:         { tagID: TEXTEDITOR.CursorY,         type: 'int32' },
    readOnly:        { tagID: TEXTEDITOR.ReadOnly,        type: 'bool' },
    fixedFont:       { tagID: TEXTEDITOR.FixedFont,       type: 'bool' },
    quiet:           { tagID: TEXTEDITOR.Quiet,           type: 'bool' },
    hasChanged:      { tagID: TEXTEDITOR.HasChanged,      type: 'bool' },
    undoAvailable:   { tagID: TEXTEDITOR.UndoAvailable,   type: 'bool' },
    redoAvailable:   { tagID: TEXTEDITOR.RedoAvailable,   type: 'bool' },
    areaMarked:      { tagID: TEXTEDITOR.AreaMarked,      type: 'bool' },
    wrapBorder:      { tagID: TEXTEDITOR.WrapBorder,      type: 'uint32' },
    tabSize:         { tagID: TEXTEDITOR.TabSize,         type: 'int32' },
    autoIndent:      { tagID: TEXTEDITOR.AutoIndent,      type: 'bool' },
    cutCopyLineWhenNoSelection: {
      tagID: TEXTEDITOR.CutCopyLineWhenNoSelection,       type: 'bool',
    },
    propFirst:       { tagID: TEXTEDITOR.Prop_First,      type: 'uint32' },
    propEntries:     { tagID: TEXTEDITOR.Prop_Entries,    type: 'uint32' },
    propVisible:     { tagID: TEXTEDITOR.Prop_Visible,    type: 'uint32' },
    /* Hooks passed as struct Hook* — caller-allocated. */
    exportHook:      { tagID: TEXTEDITOR.ExportHook,      type: 'ptr' },
    importHook:      { tagID: TEXTEDITOR.ImportHook,      type: 'ptr' },
    doubleClickHook: { tagID: TEXTEDITOR.DoubleClickHook, type: 'ptr' },
    keyBindings:     { tagID: TEXTEDITOR.KeyBindings,     type: 'ptr' },
  };

  /**
   * Empty the editor's contents. GA_TEXTEDITOR_Contents is documented
   * as construction-only (OM_NEW) in OS3.2 — SetAttrs at runtime
   * silently no-ops. Runtime mutation goes through gadget methods:
   * dispatching GM_TEXTEDITOR_ClearText (struct
   * GP_TEXTEDITOR_ClearText { MethodID; GadgetInfo* }) clears the
   * buffer and triggers a redraw. We pass GInfo=0; texteditor.gadget
   * pulls the window context from the gadget's pr_Window field set
   * when the gadget was added to the live window.
   *
   * Was the bug behind notes_demo Clear button no-op'ing at 0.170.
   *
   * @returns {number} class dispatcher result
   */
  clearText() {
    return this.doMethod(TextEditor.METHOD.ClearText, 0);
  }

  /**
   * Insert text into the editor at a given position. Used by the Load
   * path of notes_demo and any other "set the editor contents at
   * runtime" use case. Typical pattern is `clearText(); insertText(s)`
   * — clearText empties first, insertText appends from there.
   *
   * @param {string} text — text to insert
   * @param {number} [pos=TextEditor.InsertPos.BOTTOM] — one of
   *     CURSOR(0) / TOP(1) / BOTTOM(2). BOTTOM appends, which is the
   *     canonical "load file" position.
   * @returns {number}
   */
  insertText(text, pos) {
    if (pos === undefined) pos = TextEditor.InsertPos.BOTTOM;
    let s = String(text == null ? '' : text);
    let bytes = s.length + 1;
    let buf = globalThis.amiga.allocMem(bytes);
    if (!buf) throw new Error('TextEditor.insertText: allocMem failed');
    try {
      globalThis.amiga.pokeString(buf, s);
      /* GP_TEXTEDITOR_InsertText payload after MethodID: GInfo, text, pos. */
      return this.doMethod(TextEditor.METHOD.InsertText, 0, buf, pos | 0);
    }
    finally {
      globalThis.amiga.freeMem(buf, bytes);
    }
  }

  /**
   * Replace the editor contents in one call: clearText() then
   * insertText(s, BOTTOM). Convenience wrapper for the "set editor
   * to this string" pattern used by Load handlers.
   *
   * @param {string} text
   * @returns {undefined}
   */
  setContents(text) {
    this.clearText();
    if (text != null && text.length > 0) {
      this.insertText(text, TextEditor.InsertPos.BOTTOM);
    }
  }
}

EventKind.define('TEXT_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/texteditor.gadget',
  wraps: 'ATTR_UPDATE',
});
