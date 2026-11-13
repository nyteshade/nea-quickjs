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
import { withStruct } from '../../structs/Struct.js';
import { ARexxCmdMessage } from './texteditor/ARexxCmdMessage.js';
import { BlockInfoMessage } from './texteditor/BlockInfoMessage.js';
import { ClearTextMessage } from './texteditor/ClearTextMessage.js';
import { ExportTextMessage } from './texteditor/ExportTextMessage.js';
import { InsertTextMessage } from './texteditor/InsertTextMessage.js';
import { MarkTextMessage } from './texteditor/MarkTextMessage.js';
import { SearchMessage } from './texteditor/SearchMessage.js';

/** @internal GA_TEXTEDITOR_* tag IDs (gadgets/texteditor.h). */
const TEXTEDITOR = Object.freeze({
  /* check-constants: prefix GA_TEXTEDITOR_ header gadgets/texteditor.h */
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
    /* check-constants: prefix GM_TEXTEDITOR_ header gadgets/texteditor.h */
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
    /* check-constants: prefix GV_TEXTEDITOR_InsertText_ header gadgets/texteditor.h */
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
   * Send one of the class's methods. Every GM_TEXTEDITOR_ message
   * starts { MethodID; GadgetInfo *GInfo; } and must go through
   * DoGadgetMethodA, which fills GInfo from the window: the class
   * needs it to draw. (A plain DoMethodA left GInfo NULL and locked up
   * keyboard input on the editor: reported at 0.176.)
   *
   * @internal
   * @param {string} who - the calling method's name, for the error
   * @param {function(new: Struct)} Message - the message's wrapper
   *   class, from ./texteditor/
   * @param {number} methodID - TextEditor.METHOD.*
   * @param {function(Struct): undefined} [fill] - sets the message's
   *   other fields
   * @returns {number} what the class returned
   * @throws {Error} if the editor's window is not open
   */
  _send(who, Message, methodID, fill) {
    let winPtr = this._findWindowPtr();

    if (!winPtr) {
      throw new Error('TextEditor.' + who + ': window not open');
    }

    return withStruct(Message, (message) => {
      message.methodID = methodID;

      if (fill) fill(message);

      return globalThis.amiga.Intuition.DoGadgetMethodA(
        this.ptr, winPtr, 0, message.ptr
      );
    });
  }

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
    return this._send('clearText', ClearTextMessage,
                      TextEditor.METHOD.ClearText);
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

    /* The class copies the text into its own buffer, so the C string
     * is only needed for the length of the call. */
    return globalThis.amiga.withString(text, (pointer) =>
      this._send('insertText', InsertTextMessage,
                 TextEditor.METHOD.InsertText, (message) => {
                   message.text = pointer;
                   message.pos  = pos | 0;
                 }));
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
    let textPtr = this._send('exportText', ExportTextMessage,
                             TextEditor.METHOD.ExportText) | 0;

    if (!textPtr) return '';

    /* The class allocated the text with AllocVec; it is ours to free. */
    try {
      return globalThis.amiga.peekString(textPtr);
    }
    finally {
      try { globalThis.amiga.Exec.FreeVec(textPtr); }
      catch (e) { /* leak rather than crash; small and bounded */ }
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
    /* The command is parsed during the call; nothing keeps the string. */
    return globalThis.amiga.withString(cmd, (pointer) =>
      this._send('arexxCmd', ARexxCmdMessage,
                 TextEditor.METHOD.ARexxCmd, (message) => {
                   message.command = pointer;
                 }));
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
    return this._send('markText', MarkTextMessage,
                      TextEditor.METHOD.MarkText, (message) => {
                        message.startX = startX >>> 0;
                        message.startY = startY >>> 0;
                        message.stopX  = stopX  >>> 0;
                        message.stopY  = stopY  >>> 0;
                      });
  }

  /**
   * Get the current marked-block bounds, or null when no block is
   * marked. Same coordinate space as markText().
   *
   * @returns {?{startX: number, startY: number,
   *             stopX: number, stopY: number}}
   */
  blockInfo() {
    /* The message holds four ULONG pointers; the class stores the
     * block's corners through them. One zeroed block of four ULONGs
     * receives all of them. */
    const ULONG_BYTES = 4;
    const RESULT_BYTES = 4 * ULONG_BYTES;

    let result = globalThis.amiga.allocMem(RESULT_BYTES);

    if (!result) throw new Error('TextEditor.blockInfo: allocMem failed');

    /**
     * One of the four results.
     *
     * @param {number} index - 0 startX, 1 startY, 2 stopX, 3 stopY
     * @returns {number}
     */
    let read = (index) => globalThis.amiga.peek32(
      result + index * ULONG_BYTES);   /* check-structs: a ULONG array */

    try {
      let marked = this._send('blockInfo', BlockInfoMessage,
                              TextEditor.METHOD.BlockInfo, (message) => {
                                message.startX = result;
                                message.startY = result + ULONG_BYTES;
                                message.stopX  = result + 2 * ULONG_BYTES;
                                message.stopY  = result + 3 * ULONG_BYTES;
                              }) | 0;

      if (!marked) return null;

      return {
        startX: read(0),
        startY: read(1),
        stopX:  read(2),
        stopY:  read(3),
      };
    }
    finally {
      globalThis.amiga.freeMem(result, RESULT_BYTES);
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
    /* The needle is read during the call; nothing keeps the string. */
    return !!(globalThis.amiga.withString(needle, (pointer) =>
      this._send('search', SearchMessage,
                 TextEditor.METHOD.Search, (message) => {
                   message.string = pointer;
                   message.flags  = (flags || 0) >>> 0;
                 })) | 0);
  }
}

EventKind.define('TEXT_CHANGE', {
  idcmp: 0x00800000,
  rich:  { hasId: true, hasSource: true, hasPressed: false,
           hasCode: false, hasCoords: false },
  from:  'gadgets/texteditor.gadget',
  wraps: 'ATTR_UPDATE',
});
