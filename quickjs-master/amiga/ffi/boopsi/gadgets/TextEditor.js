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
    ARexxCmd:   0x00045023,   /* GP_TEXTEDITOR_ARexxCmd   { ULONG; GadgetInfo*; STRPTR } */
    ClearText:  0x00045024,   /* GP_TEXTEDITOR_ClearText  { ULONG; GadgetInfo* } */
    ExportText: 0x00045025,
    InsertText: 0x00045026,   /* GP_TEXTEDITOR_InsertText { ULONG; GadgetInfo*; STRPTR; LONG } */
    Search:     0x0004502B,   /* GP_TEXTEDITOR_Search     { ULONG; GadgetInfo*; STRPTR; ULONG flags } */
    MarkText:   0x0004502C,   /* GP_TEXTEDITOR_MarkText   { ULONG; GadgetInfo*; ULONG x4 } */
    BlockInfo:  0x00045030,   /* GP_TEXTEDITOR_BlockInfo  { ULONG; GadgetInfo*; ULONG* x4 } */
  });

  /** GM_TEXTEDITOR_Search flag values per gadgets/texteditor.h:177-183. */
  static SearchFlags = Object.freeze({
    FROM_TOP:       0x0001,
    NEXT:           0x0002,
    INCREMENTAL:    0x0003,
    BACKWARDS:      0x0010,
    CASE_SENSITIVE: 0x0004,  /* GF_TEXTEDITOR_Search_CaseSensitive (1<<2) */
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
   * Empty the editor's contents. GA_TEXTEDITOR_Contents is OM_NEW-only
   * on OS3.2 — SetAttrs at runtime silently no-ops. Runtime mutation
   * is via GM_TEXTEDITOR_ClearText (struct GP_TEXTEDITOR_ClearText
   * { MethodID; GadgetInfo* }) dispatched through DoGadgetMethodA, NOT
   * plain DoMethodA. DoGadgetMethodA fills the GadgetInfo slot from
   * the live window context — the class's cl_Dispatcher needs it for
   * RastPort/DrawInfo lookup when drawing the cleared state. Plain
   * DoMethodA with GInfo=0 caused a NULL-deref inside the class that
   * locked up keyboard input on the editor (user-reported at 0.176).
   *
   * @returns {number} class dispatcher result
   */
  clearText() {
    let winPtr = this._findWindowPtr();
    if (!winPtr) {
      throw new Error('TextEditor.clearText: window not open');
    }
    /* Build GP_TEXTEDITOR_ClearText: { ULONG MethodID; GadgetInfo*; }
     * — 8 bytes. DoGadgetMethodA writes the GInfo slot. */
    const MSG_BYTES = 8;
    let msg = globalThis.amiga.allocMem(MSG_BYTES);
    if (!msg) throw new Error('TextEditor.clearText: allocMem failed');
    try {
      globalThis.amiga.poke32(msg + 0, TextEditor.METHOD.ClearText);
      globalThis.amiga.poke32(msg + 4, 0);  /* GInfo — filled by LVO */
      return globalThis.amiga.Intuition.DoGadgetMethodA(
        this.ptr, winPtr, 0, msg
      );
    }
    finally {
      globalThis.amiga.freeMem(msg, MSG_BYTES);
    }
  }

  /**
   * Insert text into the editor at a given position. Like clearText,
   * dispatched through DoGadgetMethodA so the class gets GadgetInfo.
   *
   * @param {string} text — text to insert
   * @param {number} [pos=TextEditor.InsertPos.CURSOR] — CURSOR(0) /
   *     TOP(1) / BOTTOM(2). CURSOR inserts at the current cursor
   *     position (typical "type here" semantics). TOP prepends.
   *     BOTTOM appends — but note BOTTOM is a no-op on an empty
   *     buffer (use TOP or CURSOR after clearText for replace-all).
   * @returns {number}
   */
  insertText(text, pos) {
    if (pos === undefined) pos = TextEditor.InsertPos.CURSOR;
    let winPtr = this._findWindowPtr();
    if (!winPtr) {
      throw new Error('TextEditor.insertText: window not open');
    }
    let s = String(text == null ? '' : text);
    let strBytes = s.length + 1;
    let strBuf = globalThis.amiga.allocMem(strBytes);
    if (!strBuf) throw new Error('TextEditor.insertText: allocMem(str) failed');
    /* Build GP_TEXTEDITOR_InsertText: { MethodID; GInfo*; STRPTR; LONG pos; }
     * — 16 bytes. */
    const MSG_BYTES = 16;
    let msg = globalThis.amiga.allocMem(MSG_BYTES);
    if (!msg) {
      globalThis.amiga.freeMem(strBuf, strBytes);
      throw new Error('TextEditor.insertText: allocMem(msg) failed');
    }
    try {
      globalThis.amiga.pokeString(strBuf, s);
      globalThis.amiga.poke32(msg + 0,  TextEditor.METHOD.InsertText);
      globalThis.amiga.poke32(msg + 4,  0);             /* GInfo */
      globalThis.amiga.poke32(msg + 8,  strBuf);        /* STRPTR text */
      globalThis.amiga.poke32(msg + 12, pos | 0);       /* LONG pos */
      return globalThis.amiga.Intuition.DoGadgetMethodA(
        this.ptr, winPtr, 0, msg
      );
    }
    finally {
      globalThis.amiga.freeMem(msg, MSG_BYTES);
      globalThis.amiga.freeMem(strBuf, strBytes);
    }
  }

  /**
   * Read the current editor contents. GA_TEXTEDITOR_Contents is
   * OM_NEW-only — OM_GET returns the construction-time value, not
   * what the user has typed. The runtime read path is via the
   * GM_TEXTEDITOR_ExportText method which the class implements to
   * return a STRPTR allocated via exec.AllocVec — caller frees
   * via FreeVec.
   *
   * Was the bug behind notes_demo Save writing 0 chars to the file
   * even after typing (user-reported 2026-04-25): editor.get('contents')
   * returned the original empty-string init value, not the typed text.
   *
   * @returns {string} current editor text
   */
  exportText() {
    let winPtr = this._findWindowPtr();
    if (!winPtr) {
      throw new Error('TextEditor.exportText: window not open');
    }
    const MSG_BYTES = 8;
    let msg = globalThis.amiga.allocMem(MSG_BYTES);
    if (!msg) throw new Error('TextEditor.exportText: allocMem failed');
    let textPtr = 0;
    try {
      globalThis.amiga.poke32(msg + 0, TextEditor.METHOD.ExportText);
      globalThis.amiga.poke32(msg + 4, 0);  /* GInfo */
      textPtr = globalThis.amiga.Intuition.DoGadgetMethodA(
        this.ptr, winPtr, 0, msg
      ) | 0;
      if (!textPtr) return '';
      return globalThis.amiga.peekString(textPtr);
    }
    finally {
      globalThis.amiga.freeMem(msg, MSG_BYTES);
      /* The class allocates the exported text via AllocVec; free it
       * with exec.library FreeVec (LVO -690, a1=mem). Routed through
       * Exec.call which lazy-opens exec.library. */
      if (textPtr) {
        try { globalThis.amiga.Exec.call(-690, { a1: textPtr }); }
        catch (e) { /* leak rather than crash; small and bounded */ }
      }
    }
  }

  /**
   * Replace the editor contents in one call: clearText() then
   * insertText(s, TOP). Convenience wrapper for the "set editor to
   * this string" pattern used by Load handlers.
   *
   * NOTE on pos: must use TOP (or CURSOR), not BOTTOM. BOTTOM means
   * "below the last existing line" and silently no-ops when called
   * after a clearText (empty buffer has no last line to anchor to).
   * TOP and CURSOR both insert at offset 0 in an empty buffer; for
   * a fresh "set whole content" call TOP is the unambiguous choice.
   *
   * @param {string} text
   * @returns {undefined}
   */
  setContents(text) {
    this.clearText();
    if (text != null && text.length > 0) {
      this.insertText(text, TextEditor.InsertPos.TOP);
    }
  }

  /**
   * Send a texteditor.gadget ARexx-style command string. This is the
   * OS3.2 class's universal control surface — there are no dedicated
   * GM_ methods for undo/scroll/cursor movement; they are all command
   * strings dispatched via GM_TEXTEDITOR_ARexxCmd. Useful commands
   * (see texteditor.gadget autodoc): "UNDO", "REDO", "CLEAR",
   * "CURSOR UP|DOWN|LEFT|RIGHT", "GOTOLINE n", "GOTOCOLUMN n",
   * "SCROLL UP n", "SCROLL DOWN n", "MARK ON|OFF", "CUT", "COPY",
   * "PASTE", "ERASE", "SELECTALL".
   *
   * @param {string} cmd — command string (case-insensitive)
   * @returns {number} class dispatcher result (command-specific)
   */
  arexxCmd(cmd) {
    let winPtr = this._findWindowPtr();
    if (!winPtr) {
      throw new Error('TextEditor.arexxCmd: window not open');
    }
    let s = String(cmd == null ? '' : cmd);
    let strBytes = s.length + 1;
    let strBuf = globalThis.amiga.allocMem(strBytes);
    if (!strBuf) throw new Error('TextEditor.arexxCmd: allocMem(str) failed');
    /* GP_TEXTEDITOR_ARexxCmd: { MethodID; GInfo*; STRPTR } — 12 bytes */
    const MSG_BYTES = 12;
    let msg = globalThis.amiga.allocMem(MSG_BYTES);
    if (!msg) {
      globalThis.amiga.freeMem(strBuf, strBytes);
      throw new Error('TextEditor.arexxCmd: allocMem(msg) failed');
    }
    try {
      globalThis.amiga.pokeString(strBuf, s);
      globalThis.amiga.poke32(msg + 0, TextEditor.METHOD.ARexxCmd);
      globalThis.amiga.poke32(msg + 4, 0);       /* GInfo — filled by LVO */
      globalThis.amiga.poke32(msg + 8, strBuf);  /* STRPTR command */
      return globalThis.amiga.Intuition.DoGadgetMethodA(
        this.ptr, winPtr, 0, msg
      );
    }
    finally {
      globalThis.amiga.freeMem(msg, MSG_BYTES);
      globalThis.amiga.freeMem(strBuf, strBytes);
    }
  }

  /**
   * Undo the last edit. GA_TEXTEDITOR_UndoAvailable reports whether
   * anything is undoable.
   *
   * @returns {number}
   */
  undo() { return this.arexxCmd('UNDO'); }

  /**
   * Redo the last undone edit. GA_TEXTEDITOR_RedoAvailable reports
   * whether anything is redoable.
   *
   * @returns {number}
   */
  redo() { return this.arexxCmd('REDO'); }

  /**
   * Scroll the view by whole lines without moving the cursor.
   *
   * @param {number} lines — positive scrolls down, negative up
   * @returns {number}
   */
  scroll(lines) {
    let n = lines | 0;
    if (n === 0) return 0;
    return this.arexxCmd(n > 0 ? ('SCROLL DOWN ' + n) : ('SCROLL UP ' + (-n)));
  }

  /**
   * Move the cursor to a given line (and optionally column). Lines
   * and columns are 0-based per the class's GOTOLINE/GOTOCOLUMN
   * commands; the view scrolls to keep the cursor visible.
   *
   * @param {number} line
   * @param {number} [column]
   * @returns {number}
   */
  gotoLine(line, column) {
    let rc = this.arexxCmd('GOTOLINE ' + (line | 0));
    if (column !== undefined) rc = this.arexxCmd('GOTOCOLUMN ' + (column | 0));
    return rc;
  }

  /**
   * Select (mark) a text range. Coordinates are character x / line y
   * pairs, 0-based, matching GA_TEXTEDITOR_CursorX/CursorY semantics.
   *
   * @param {number} startX
   * @param {number} startY
   * @param {number} stopX
   * @param {number} stopY
   * @returns {number}
   */
  markText(startX, startY, stopX, stopY) {
    let winPtr = this._findWindowPtr();
    if (!winPtr) {
      throw new Error('TextEditor.markText: window not open');
    }
    /* GP_TEXTEDITOR_MarkText: { MethodID; GInfo*; ULONG x4 } — 24 bytes */
    const MSG_BYTES = 24;
    let msg = globalThis.amiga.allocMem(MSG_BYTES);
    if (!msg) throw new Error('TextEditor.markText: allocMem failed');
    try {
      globalThis.amiga.poke32(msg + 0,  TextEditor.METHOD.MarkText);
      globalThis.amiga.poke32(msg + 4,  0);            /* GInfo */
      globalThis.amiga.poke32(msg + 8,  startX >>> 0);
      globalThis.amiga.poke32(msg + 12, startY >>> 0);
      globalThis.amiga.poke32(msg + 16, stopX  >>> 0);
      globalThis.amiga.poke32(msg + 20, stopY  >>> 0);
      return globalThis.amiga.Intuition.DoGadgetMethodA(
        this.ptr, winPtr, 0, msg
      );
    }
    finally {
      globalThis.amiga.freeMem(msg, MSG_BYTES);
    }
  }

  /**
   * Get the current marked-block bounds, or null when no block is
   * marked. Same coordinate space as markText().
   *
   * @returns {?{startX: number, startY: number,
   *             stopX: number, stopY: number}}
   */
  blockInfo() {
    let winPtr = this._findWindowPtr();
    if (!winPtr) {
      throw new Error('TextEditor.blockInfo: window not open');
    }
    /* GP_TEXTEDITOR_BlockInfo: { MethodID; GInfo*; ULONG* x4 } — 24
     * bytes of message + 16 bytes of result slots the pointers aim at. */
    const MSG_BYTES = 24, RES_BYTES = 16;
    let msg = globalThis.amiga.allocMem(MSG_BYTES);
    if (!msg) throw new Error('TextEditor.blockInfo: allocMem(msg) failed');
    let res = globalThis.amiga.allocMem(RES_BYTES);
    if (!res) {
      globalThis.amiga.freeMem(msg, MSG_BYTES);
      throw new Error('TextEditor.blockInfo: allocMem(res) failed');
    }
    try {
      globalThis.amiga.poke32(res + 0, 0);
      globalThis.amiga.poke32(res + 4, 0);
      globalThis.amiga.poke32(res + 8, 0);
      globalThis.amiga.poke32(res + 12, 0);
      globalThis.amiga.poke32(msg + 0,  TextEditor.METHOD.BlockInfo);
      globalThis.amiga.poke32(msg + 4,  0);          /* GInfo */
      globalThis.amiga.poke32(msg + 8,  res + 0);    /* &startx */
      globalThis.amiga.poke32(msg + 12, res + 4);    /* &starty */
      globalThis.amiga.poke32(msg + 16, res + 8);    /* &stopx  */
      globalThis.amiga.poke32(msg + 20, res + 12);   /* &stopy  */
      let marked = globalThis.amiga.Intuition.DoGadgetMethodA(
        this.ptr, winPtr, 0, msg
      ) | 0;
      if (!marked) return null;
      return {
        startX: globalThis.amiga.peek32(res + 0),
        startY: globalThis.amiga.peek32(res + 4),
        stopX:  globalThis.amiga.peek32(res + 8),
        stopY:  globalThis.amiga.peek32(res + 12),
      };
    }
    finally {
      globalThis.amiga.freeMem(msg, MSG_BYTES);
      globalThis.amiga.freeMem(res, RES_BYTES);
    }
  }

  /**
   * Search for a string from the current cursor position (or the top
   * with {@link TextEditor.SearchFlags.FROM_TOP}); a hit moves the
   * cursor to and marks the match.
   *
   * @param {string} needle — text to find
   * @param {number} [flags=0] — OR of {@link TextEditor.SearchFlags}
   * @returns {boolean} true when found
   */
  search(needle, flags) {
    let winPtr = this._findWindowPtr();
    if (!winPtr) {
      throw new Error('TextEditor.search: window not open');
    }
    let s = String(needle == null ? '' : needle);
    let strBytes = s.length + 1;
    let strBuf = globalThis.amiga.allocMem(strBytes);
    if (!strBuf) throw new Error('TextEditor.search: allocMem(str) failed');
    /* GP_TEXTEDITOR_Search: { MethodID; GInfo*; STRPTR; ULONG } — 16 bytes */
    const MSG_BYTES = 16;
    let msg = globalThis.amiga.allocMem(MSG_BYTES);
    if (!msg) {
      globalThis.amiga.freeMem(strBuf, strBytes);
      throw new Error('TextEditor.search: allocMem(msg) failed');
    }
    try {
      globalThis.amiga.pokeString(strBuf, s);
      globalThis.amiga.poke32(msg + 0,  TextEditor.METHOD.Search);
      globalThis.amiga.poke32(msg + 4,  0);                 /* GInfo */
      globalThis.amiga.poke32(msg + 8,  strBuf);            /* STRPTR */
      globalThis.amiga.poke32(msg + 12, (flags || 0) >>> 0);/* ULONG flags */
      return !!(globalThis.amiga.Intuition.DoGadgetMethodA(
        this.ptr, winPtr, 0, msg
      ) | 0);
    }
    finally {
      globalThis.amiga.freeMem(msg, MSG_BYTES);
      globalThis.amiga.freeMem(strBuf, strBytes);
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
