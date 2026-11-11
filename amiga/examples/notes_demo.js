/*
 * notes_demo.js - a scratchpad built on the system text editor gadget.
 *
 *   +------------------------------------------------------+
 *   |                                                      |
 *   |  (type here)                                         |   editor
 *   |                                                      |
 *   +------------------------------------------------------+
 *   | Status: saved 42 chars to RAM:notes.txt              |   status
 *   | [Undo] [Redo] [Top] [Block] [___________] [Find]     |
 *   | [   Save   ] [   Load   ] [   Clear   ] [   Quit   ] |
 *   +------------------------------------------------------+
 *
 * Type something, then try the buttons. Save writes the text to
 * RAM:notes.txt and Load reads it back. Undo and Redo step through
 * your edits, Top moves the cursor to the first line, and Block says
 * where the marked block is. To search, type a word in the small field
 * and click Find; click Find again for the next match.
 *
 * The file has four parts, read top to bottom:
 *
 *   1. THE FILE     - reading and writing the notes. No GUI.
 *   2. THE WINDOW   - written as a tree that looks like the picture.
 *   3. THE COMMANDS - what each button does to the editor.
 *   4. THE LOOP     - clicks in, command run, status line updated.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 480 x 320 pixels inside
 *   - window.class, layout.gadget, button.gadget, string.gadget and
 *     texteditor.gadget are installed in SYS:Classes, as they are on
 *     AmigaOS 3.2
 *   - RAM: is writable; nothing has to exist there beforehand
 *   - on OS 3.2 the editor's text cannot be read or replaced through
 *     its contents attribute once the gadget exists: reading gives
 *     back the text it was created with, and writing is silently
 *     ignored. The script uses the gadget's export, clear and insert
 *     methods instead (see part 3)
 *   - a search carries on from the cursor, which sits at the end of
 *     the text just after typing, so a new search has to start from
 *     the top
 *   - the status line is a read-only string gadget because label.image
 *     takes its text only when it is created
 *   - the status line changes when a button is clicked, not as you
 *     type; following the typing would need the editor's "has changed"
 *     notification, which this demo does not listen for
 *
 * Requires quickjs.library 0.200+ (undo, redo, gotoLine, search and
 * blockInfo; exportText needs 0.181+, setContents 0.175+).
 * Run: qjs examples/notes_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, StringGadget, TextEditor,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;


/* ==================================================================
 * 1. THE FILE
 *
 * Where the notes are kept, and how they get there and back.
 * ================================================================== */

/** The file Save writes and Load reads. */
const NOTES_PATH = 'RAM:notes.txt';

/** How much of the file is read at a time, in characters. */
const READ_CHUNK = 4096;

/**
 * Write the notes file, replacing whatever was there.
 *
 * @param {string} text
 * @returns {boolean} false if the file could not be opened
 */
function writeNotes(text) {
  let file = std.open(NOTES_PATH, 'w');
  if (!file) return false;

  file.puts(text);
  file.close();
  return true;
}

/**
 * Read the whole notes file.
 *
 * @returns {?string} the text, or null if there is no file to open
 */
function readNotes() {
  let file = std.open(NOTES_PATH, 'r');
  if (!file) return null;

  let text = '';
  let chunk;
  while ((chunk = file.readAsString(READ_CHUNK)).length > 0) {
    text += chunk;
  }

  file.close();
  return text;
}


/* ==================================================================
 * 2. THE WINDOW
 *
 * First the gadgets the commands need to talk to, each given a name.
 * Then the window, which arranges them. Read the `layout:` tree next
 * to the picture at the top of the file.
 * ================================================================== */

/** Gadget IDs: how an event says which gadget it came from. */
const ID = {
  EDITOR: 1,
  SAVE: 2, LOAD: 3, CLEAR: 4, QUIT: 5,
  UNDO: 6, REDO: 7, TOP: 8, FIND: 9, NEEDLE: 10, BLOCK: 11,
};

/* The editor starts EMPTY on purpose. With a placeholder text in it, a
 * Save before any typing would write the placeholder to the file, and
 * every Load after that would bring it back, so nobody could tell
 * whether the round trip had worked. The status line and the Shell
 * carry the instructions instead. */
let editor = new TextEditor({
  id:       ID.EDITOR,
  contents: '',
});

/* Text that changes goes in a read-only string gadget. That is the
 * usual way on OS 3.2: label.image takes its text only when it is
 * created. */
let statusLine = new StringGadget({
  text: 'Type, then Save / Load / Clear / Quit.', readOnly: true,
  maxChars: 80,
});

/** The field the word to search for is typed into. */
let needleField = new StringGadget({
  id: ID.NEEDLE, text: '', maxChars: 40,
});

let window = new Window({
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

      new Layout({
        orientation: 'horizontal', innerSpacing: 4,
        bevelStyle: BevelStyle.FIELD,
        children: [ statusLine ],
      }),

      /* The editing row: the editor's own methods. */
      new Layout({
        orientation: 'horizontal', innerSpacing: 4,
        children: [
          new Button({ id: ID.UNDO,  text: '_Undo'  }),
          new Button({ id: ID.REDO,  text: '_Redo'  }),
          new Button({ id: ID.TOP,   text: '_Top'   }),
          new Button({ id: ID.BLOCK, text: '_Block' }),
          needleField,
          new Button({ id: ID.FIND,  text: '_Find'  }),
        ],
      }),

      /* The file row. */
      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [
          new Button({ id: ID.SAVE,  text: '_Save'  }),
          new Button({ id: ID.LOAD,  text: '_Load'  }),
          new Button({ id: ID.CLEAR, text: '_Clear' }),
          new Button({ id: ID.QUIT,  text: '_Quit'  }),
        ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE COMMANDS
 *
 * One function per button. Each does its work on the editor and
 * returns a few words for the status line saying how it went.
 * ================================================================== */

/**
 * Save: write the editor's text to the notes file.
 *
 * @returns {string} what to show in the status line
 */
function saveNotes() {
  /* The editor's contents attribute can only be given when the gadget
   * is created; reading it later returns that first text, not what
   * has been typed since. exportText() asks the gadget for its real
   * text through the export method, and frees the copy it is given.
   * (quickjs.library 0.181+) */
  let text = editor.exportText();

  if (!writeNotes(text)) return 'save FAILED - could not open ' + NOTES_PATH;

  return 'saved ' + text.length + ' chars to ' + NOTES_PATH;
}

/**
 * Load: replace the editor's text with the notes file.
 *
 * @returns {string} what to show in the status line
 */
function loadNotes() {
  let text = readNotes();
  if (text === null) return 'no saved file at ' + NOTES_PATH;

  /* For the same reason, setting the contents attribute on a live
   * editor is silently ignored on OS 3.2. setContents() clears the
   * gadget and then inserts the text at the bottom, using the
   * gadget's methods. (quickjs.library 0.175+) */
  editor.setContents(text);

  return 'loaded ' + text.length + ' chars from ' + NOTES_PATH;
}

/**
 * Clear: empty the editor. The file is left alone.
 *
 * @returns {string} what to show in the status line
 */
function clearNotes() {
  editor.clearText();
  return 'cleared.';
}

/** The word the last successful Find was looking for, or '' when the
 *  last Find failed or there has not been one. */
let lastNeedle = '';

/**
 * Find: search the editor for the word in the small field. A hit moves
 * the cursor to the match and marks it.
 *
 * A new word is searched for from the top of the text. Clicking Find
 * again with the same word moves on to the next match. (Searching on
 * from the cursor would find nothing right after typing, because the
 * cursor is then at the end of the text.)
 *
 * @returns {string} what to show in the status line
 */
function findNeedle() {
  let needle = needleField.text;
  if (!needle) return 'type something to find first.';

  let again = (needle === lastNeedle);
  let found = editor.search(needle, again ? TextEditor.SearchFlags.NEXT
                                          : TextEditor.SearchFlags.FROM_TOP);

  lastNeedle = found ? needle : '';

  if (found) return 'found "' + needle + '"';
  return '"' + needle + '" not found' + (again ? ' again' : '');
}

/**
 * Block: say where the marked block starts and stops.
 *
 * @returns {string} what to show in the status line
 */
function describeBlock() {
  let block = editor.blockInfo();
  if (!block) return 'no block marked.';

  return 'block ' + block.startX + ',' + block.startY +
         ' to ' + block.stopX + ',' + block.stopY;
}

/**
 * Undo the last edit.
 *
 * @returns {string} what to show in the status line
 */
function undoEdit() {
  editor.undo();
  return 'undo.';
}

/**
 * Redo the edit that was last undone.
 *
 * @returns {string} what to show in the status line
 */
function redoEdit() {
  editor.redo();
  return 'redo.';
}

/**
 * Top: put the cursor on the first character of the first line.
 *
 * @returns {string} what to show in the status line
 */
function cursorToTop() {
  editor.gotoLine(0, 0);
  return 'cursor at top.';
}


/* ==================================================================
 * 4. THE LOOP
 *
 * Wait for a click, run that button's command, and show what it
 * reported.
 * ================================================================== */

/** The command behind each button. */
const onClick = {
  [ID.SAVE]:  saveNotes,
  [ID.LOAD]:  loadNotes,
  [ID.CLEAR]: clearNotes,
  [ID.UNDO]:  undoEdit,
  [ID.REDO]:  redoEdit,
  [ID.TOP]:   cursorToTop,
  [ID.FIND]:  findNeedle,
  [ID.BLOCK]: describeBlock,
};

/**
 * Show a command's report in the status line.
 *
 * @param {string} report
 * @returns {undefined}
 */
function render(report) {
  statusLine.text = 'Status: ' + report;
}

window.open();
print('Notes open. Type something, then Save / Load / Clear / Quit.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind !== EventKind.BUTTON_CLICK) continue;
    if (event.sourceId === ID.QUIT) break;

    let command = onClick[event.sourceId];
    if (command) render(command());
  }
}
finally {
  window.dispose();
}

print('Bye.');
