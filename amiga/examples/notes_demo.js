/*
 * notes_demo.js — minimalist scratchpad using texteditor.gadget.
 *
 * A single multi-line TextEditor fills most of the window; a small
 * status row at the bottom shows character count + a Save / Load /
 * Clear / Quit toolbar. Save writes the current contents to RAM:notes.txt
 * (rewriteable). Load reads it back if present.
 *
 * Demonstrates:
 *   - texteditor.gadget as the central control (attribute round-trip
 *     via TEXTEDITOR_Contents)
 *   - File I/O via std.open from "qjs:std" — no special FFI needed
 *   - Status line updated reactively from button events (cheap stand-in
 *     for an async character-count refresh; an interactive "as-you-type"
 *     update would need a TEXTEDITOR_HasChanged notification hook,
 *     which is a Phase D refinement)
 *   - TextEditor method wrappers (library 0.200+): undo(), redo(),
 *     gotoLine(), search() and blockInfo() on the second toolbar row
 *
 * Requires quickjs.library 0.200+.
 * Run:  qjs examples/notes_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, StringGadget, TextEditor,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { EDITOR: 1, SAVE: 2, LOAD: 3, CLEAR: 4, QUIT: 5,
              UNDO: 6, REDO: 7, TOP: 8, FIND: 9, NEEDLE: 10, BLOCK: 11 };

const NOTES_PATH = 'RAM:notes.txt';

/** @type {string} — needle of the last successful Find, '' when none */
let lastNeedle = '';

/* Start with an EMPTY editor. Earlier versions of this demo opened
 * with a placeholder string in `contents` — but if the user clicked
 * Save before typing anything, the placeholder got persisted to
 * RAM:notes.txt, and every Load thereafter showed the placeholder
 * back. Made the round-trip ambiguous. Empty start means the first
 * Save records actual user input; status line + Quit shortcut
 * carry the usage hints. */
let editor = new TextEditor({
  id:       GID.EDITOR,
  contents: '',
});

/* Dynamic text → readonly StringGadget (canonical OS3.2 Reaction pattern
 * for mutable text; label.image is OM_NEW-only per Label.js JSDoc). */
let status = new StringGadget({
  text: 'Type, then Save / Load / Clear / Quit.', readOnly: true, maxChars: 80,
});

let saveBtn  = new Button({ id: GID.SAVE,  text: '_Save'  });
let loadBtn  = new Button({ id: GID.LOAD,  text: '_Load'  });
let clearBtn = new Button({ id: GID.CLEAR, text: '_Clear' });
let quitBtn  = new Button({ id: GID.QUIT,  text: '_Quit'  });

let toolbar = new Layout({
  orientation: 'horizontal', innerSpacing: 4, evenSize: true,
  children: [ saveBtn, loadBtn, clearBtn, quitBtn ],
});

/* Second row — exercises the TextEditor method wrappers. */
let undoBtn  = new Button({ id: GID.UNDO,  text: '_Undo'  });
let redoBtn  = new Button({ id: GID.REDO,  text: '_Redo'  });
let topBtn   = new Button({ id: GID.TOP,   text: '_Top'   });
let blockBtn = new Button({ id: GID.BLOCK, text: '_Block' });
let needle   = new StringGadget({ id: GID.NEEDLE, text: '', maxChars: 40 });
let findBtn  = new Button({ id: GID.FIND,  text: '_Find'  });

let editbar = new Layout({
  orientation: 'horizontal', innerSpacing: 4,
  children: [ undoBtn, redoBtn, topBtn, blockBtn, needle, findBtn ],
});

let statusBox = new Layout({
  orientation: 'horizontal', innerSpacing: 4,
  bevelStyle: BevelStyle.FIELD,
  children: [ status ],
});

let win = new Window({
  title:       'Notes',
  innerWidth:  480,
  innerHeight: 320,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true,
  sizeGadget:  true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [
      editor,
      statusBox,
      editbar,
      toolbar,
    ],
  }),
});

function setStatus(msg) {
  status.text = 'Status: ' + msg;
}

function getEditorContents() {
  /* GA_TEXTEDITOR_Contents is OM_NEW-only — OM_GET returns the
   * construction-time string, not what the user has typed. Use the
   * GM_TEXTEDITOR_ExportText gadget-method instead. Wrapper takes
   * care of the GadgetInfo + FreeVec cleanup. Library 0.181+. */
  return editor.exportText();
}

function setEditorContents(s) {
  /* GA_TEXTEDITOR_Contents is OM_NEW-only on OS3.2 — runtime SetAttrs
   * is silently dropped. Use the gadget-method path: ClearText then
   * InsertText(BOTTOM). The TextEditor wrapper bundles both in
   * setContents(). Library 0.175+. */
  editor.setContents(s);
}

function saveNotes() {
  let contents = getEditorContents();
  let f = std.open(NOTES_PATH, 'w');
  if (!f) {
    setStatus('save FAILED - could not open ' + NOTES_PATH);
    return;
  }
  f.puts(contents);
  f.close();
  setStatus('saved ' + contents.length + ' chars to ' + NOTES_PATH);
}

function loadNotes() {
  let f = std.open(NOTES_PATH, 'r');
  if (!f) {
    setStatus('no saved file at ' + NOTES_PATH);
    return;
  }
  let buf = '';
  let chunk;
  while ((chunk = f.readAsString(4096)).length > 0) {
    buf += chunk;
  }
  f.close();
  setEditorContents(buf);
  setStatus('loaded ' + buf.length + ' chars from ' + NOTES_PATH);
}

function clearNotes() {
  editor.clearText();
  setStatus('cleared.');
}

/**
 * Search for the text in the needle field. A new needle searches from
 * the top of the text; pressing Find again with the same needle moves
 * on to the next match. (A forward search from the cursor finds
 * nothing right after typing, because the cursor is at the end.)
 * A hit moves the cursor to the match and marks it.
 *
 * @returns {undefined}
 */
function findNeedle() {
  let s = needle.text;
  if (!s) {
    setStatus('type something to find first.');
    return;
  }
  let again = (s === lastNeedle);
  let found = editor.search(s, again ? TextEditor.SearchFlags.NEXT
                                     : TextEditor.SearchFlags.FROM_TOP);
  lastNeedle = found ? s : '';
  setStatus(found ? ('found "' + s + '"')
                  : ('"' + s + '" not found' + (again ? ' again' : '')));
}

/**
 * Report the marked block's bounds in the status line.
 *
 * @returns {undefined}
 */
function showBlock() {
  let b = editor.blockInfo();
  setStatus(b
    ? ('block ' + b.startX + ',' + b.startY + ' to ' + b.stopX + ',' + b.stopY)
    : 'no block marked.');
}

win.open();
print('Notes open. Type something, then Save / Load / Clear / Quit.');

let done = false;
try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.SAVE:  saveNotes();  break;
        case GID.LOAD:  loadNotes();  break;
        case GID.CLEAR: clearNotes(); break;
        case GID.QUIT:  done = true;  break;
        case GID.UNDO:  editor.undo();  setStatus('undo.');  break;
        case GID.REDO:  editor.redo();  setStatus('redo.');  break;
        case GID.TOP:   editor.gotoLine(0, 0); setStatus('cursor at top.'); break;
        case GID.FIND:  findNeedle(); break;
        case GID.BLOCK: showBlock();  break;
      }
      if (done) break;
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
