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
 *
 * Requires quickjs.library 0.156+.
 * Run:  qjs examples/notes_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, StringGadget, TextEditor,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const GID = { EDITOR: 1, SAVE: 2, LOAD: 3, CLEAR: 4, QUIT: 5 };

const NOTES_PATH = 'RAM:notes.txt';

let editor = new TextEditor({
  id:        GID.EDITOR,
  contents:  'Type your notes here…\n\n' +
             'Click Save to persist to ' + NOTES_PATH + '.\n' +
             'Click Load to read it back.',
});

/* Dynamic text → readonly StringGadget (canonical OS3.2 Reaction pattern
 * for mutable text; label.image is OM_NEW-only per Label.js JSDoc). */
let status = new StringGadget({
  text: 'Status: ready.', readOnly: true, maxChars: 80,
});

let saveBtn  = new Button({ id: GID.SAVE,  text: '_Save'  });
let loadBtn  = new Button({ id: GID.LOAD,  text: '_Load'  });
let clearBtn = new Button({ id: GID.CLEAR, text: '_Clear' });
let quitBtn  = new Button({ id: GID.QUIT,  text: '_Quit'  });

let toolbar = new Layout({
  orientation: 'horizontal', innerSpacing: 4, evenSize: true,
  children: [ saveBtn, loadBtn, clearBtn, quitBtn ],
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
      toolbar,
    ],
  }),
});

function setStatus(msg) {
  status.text = 'Status: ' + msg;
}

function getEditorContents() {
  /* TEXTEDITOR_Contents returns a STRPTR. Our 'string-owned' codec
   * peekString-decodes it. May be null if the editor is freshly
   * constructed and never mutated. */
  let s = editor.get('contents');
  return typeof s === 'string' ? s : '';
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
    setStatus('save FAILED — could not open ' + NOTES_PATH);
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
      }
      if (done) break;
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
