/*
 * todo_demo.js - a to-do list of up to eight tasks, saved to RAM:.
 *
 *   +- Tasks ------------------------------------------+
 *   | [x] [Buy floppies_____________________________]  |
 *   | [ ] [Task 2___________________________________]  |
 *   | [ ] [(empty)__________________________________]  |   ghosted
 *   |  :   :                                           |
 *   +--------------------------------------------------+
 *   | 2 of 8 rows in use.                              |   status line
 *   | [ Add ] [ Save ] [ Load ] [ Clear All ] [ Quit ] |
 *   +--------------------------------------------------+
 *
 * All eight rows are always there; the ones not in use are ghosted.
 * Add brings the next row to life: type over its text and tick the
 * box when it is done. Save writes the rows in use to RAM:todo.txt,
 * one per line with [X] or [ ] in front, and Load reads them back.
 * Clear All empties and ghosts every row.
 *
 * The file has four parts, read top to bottom:
 *
 *   1. THE LIST     - tasks as lines of text in a file. No GUI.
 *   2. THE WINDOW   - written as a tree that looks like the picture.
 *   3. THE COMMANDS - what each button does to the rows.
 *   4. THE LOOP     - clicks in, command run.
 *
 * Assumptions:
 *   - opens on the default public screen (normally Workbench), which
 *     must have room for a window about 500 x 360 pixels inside
 *   - window.class, layout.gadget, button.gadget, string.gadget and
 *     checkbox.gadget are installed in SYS:Classes, as they are on
 *     AmigaOS 3.2
 *   - RAM: is writable; nothing has to exist there beforehand
 *   - a fixed set of rows is used because it is simpler than adding
 *     and removing gadgets in an open window (the NDK example
 *     Layout2.c shows that way)
 *   - a task's text and tick live in its gadgets and nowhere else;
 *     they are read back from the gadgets when Save is clicked
 *   - the status line is a read-only string gadget because a Label
 *     keeps the text it was created with
 *
 * Requires quickjs.library 0.156+.
 * Run: qjs examples/todo_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, CheckBox, StringGadget,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;


/* ==================================================================
 * 1. THE LIST
 *
 * A task is { done, text }. This part turns tasks into lines of a file
 * and back, and reads and writes that file. Nothing here knows about
 * gadgets.
 * ================================================================== */

/** How many tasks the list can hold: one per row of the window. */
const MAX_TASKS = 8;

/** The file Save writes and Load reads. */
const TODO_PATH = 'RAM:todo.txt';

/**
 * One task as a line of the file.
 *
 * @param {{done: boolean, text: string}} task
 * @returns {string} "[X] text" or "[ ] text", without a line end
 */
function taskToLine(task) {
  return (task.done ? '[X] ' : '[ ] ') + task.text;
}

/**
 * One line of the file as a task. A line counts as done only if it
 * begins with [X]; any bracketed character and the spaces after it
 * are taken off the front of the text.
 *
 * @param {string} line
 * @returns {{done: boolean, text: string}}
 */
function lineToTask(line) {
  return {
    done: line.startsWith('[X]'),
    text: line.replace(/^\[.\]\s*/, ''),
  };
}

/**
 * The tasks in a file's text: one per non-empty line, and no more than
 * the list can hold.
 *
 * @param {string} fileText
 * @returns {Array<{done: boolean, text: string}>}
 */
function parseTasks(fileText) {
  return fileText.split('\n')
                 .filter((line) => line.length > 0)
                 .slice(0, MAX_TASKS)
                 .map(lineToTask);
}

/**
 * Write tasks to the file, replacing whatever was there.
 *
 * @param {Array<{done: boolean, text: string}>} tasks
 * @returns {boolean} false if the file could not be opened
 */
function writeTasks(tasks) {
  let file = std.open(TODO_PATH, 'w');
  if (!file) return false;

  for (let task of tasks) file.puts(taskToLine(task) + '\n');

  file.close();
  return true;
}

/**
 * Read the tasks in the file.
 *
 * @returns {?Array<{done: boolean, text: string}>} the tasks, or null
 *   if there is no file to open
 */
function readTasks() {
  let file = std.open(TODO_PATH, 'r');
  if (!file) return null;

  /* With no size, readAsString() reads to the end of the file.
   * (Reading a fixed number of bytes at a time can cut an accented
   * letter, which is two bytes in the file, in half.) */
  let fileText = file.readAsString();

  file.close();
  return parseTasks(fileText);
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
  ADD:   100,
  SAVE:  101,
  LOAD:  102,
  CLEAR: 103,
  QUIT:  104,
};

/** Each row's two gadgets get their own IDs, counting up from these:
 *  the tick box of row 0 is 200, its text field 300, and so on. */
const DONE_BOX_FIRST_ID   = 200;
const TEXT_FIELD_FIRST_ID = 300;

/** What a row's text field holds while the row is not in use. */
const UNUSED_TEXT = '(empty)';

/** The rows, top to bottom. Every row exists from the start; one that
 *  is not in use is ghosted. */
let rows = [];

for (let index = 0; index < MAX_TASKS; index++) {
  rows.push({
    doneBox: new CheckBox({
      id: DONE_BOX_FIRST_ID + index, text: '', selected: false,
      disabled: true,
    }),
    textField: new StringGadget({
      id: TEXT_FIELD_FIRST_ID + index, text: UNUSED_TEXT, maxChars: 80,
      disabled: true,
    }),
  });
}

/**
 * One row of the list: a tick box with a text field to its right.
 *
 * @param {{doneBox: CheckBox, textField: StringGadget}} row
 * @returns {Layout}
 */
function taskRow(row) {
  return new Layout({
    orientation: 'horizontal', innerSpacing: 4,
    children: [ row.doneBox, row.textField ],
  });
}

/* Text that changes goes in a read-only string gadget, not a Label. */
let statusLine = new StringGadget({
  text: '0 of ' + MAX_TASKS + ' rows in use.',
  readOnly: true, maxChars: 64,
});

let addButton = new Button({ id: ID.ADD, text: '_Add' });

let window = new Window({
  title:       'To-Do',
  innerWidth:  500,
  innerHeight: 360,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true,
  sizeGadget:  true, activate: true,

  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [

      new Layout({
        orientation: 'vertical', innerSpacing: 2,
        bevelStyle:  BevelStyle.GROUP, label: 'Tasks',
        children: rows.map(taskRow),
      }),

      statusLine,

      new Layout({
        orientation: 'horizontal', innerSpacing: 4, evenSize: true,
        children: [
          addButton,
          new Button({ id: ID.SAVE,  text: '_Save' }),
          new Button({ id: ID.LOAD,  text: '_Load' }),
          new Button({ id: ID.CLEAR, text: '_Clear All' }),
          new Button({ id: ID.QUIT,  text: '_Quit' }),
        ],
      }),

    ],
  }),
});


/* ==================================================================
 * 3. THE COMMANDS
 *
 * One function per button. The rows in use are always the first
 * `rowsInUse` of them. Each command does its work on the rows and
 * then says what happened in the status line.
 * ================================================================== */

/** How many rows are in use, counted from the top. */
let rowsInUse = 0;

/**
 * Put a sentence in the status line.
 *
 * @param {string} report
 * @returns {undefined}
 */
function say(report) {
  statusLine.text = report;
}

/**
 * The usual status: say how full the list is, and ghost Add once
 * there is no row left to add.
 *
 * @returns {undefined}
 */
function showUsage() {
  say(rowsInUse + ' of ' + MAX_TASKS + ' rows in use.');
  addButton.set({ disabled: rowsInUse >= MAX_TASKS });
}

/**
 * Add: bring the next unused row to life with a placeholder text.
 * Does nothing when the list is full.
 *
 * @returns {undefined}
 */
function addTask() {
  if (rowsInUse >= MAX_TASKS) return;

  let row = rows[rowsInUse];

  row.textField.set({ disabled: false, text: 'Task ' + (rowsInUse + 1) });
  row.doneBox.set({ disabled: false });
  rowsInUse++;

  showUsage();
}

/**
 * Clear All: empty and ghost every row. That is what it is for; the
 * file is left alone.
 *
 * @returns {undefined}
 */
function clearTasks() {
  for (let row of rows) {
    row.doneBox.set({ selected: false, disabled: true });
    row.textField.set({ text: UNUSED_TEXT, disabled: true });
  }
  rowsInUse = 0;

  showUsage();
}

/**
 * Save: write the rows in use to the file.
 *
 * @returns {undefined}
 */
function saveTasks() {
  let tasks = rows.slice(0, rowsInUse).map((row) => ({
    done: !!row.doneBox.get('selected'),
    text: row.textField.get('text') || '',
  }));

  if (writeTasks(tasks)) {
    say('Saved ' + rowsInUse + ' task(s) to ' + TODO_PATH);
  } else {
    say('Save FAILED - could not open ' + TODO_PATH);
  }
}

/**
 * Load: replace every row with the tasks in the file.
 *
 * @returns {undefined}
 */
function loadTasks() {
  let tasks = readTasks();
  if (tasks === null) {
    say('No saved file at ' + TODO_PATH);
    return;
  }

  /* Start from an empty list. The status line counts the rows while
   * they fill, then gives the result. */
  clearTasks();

  tasks.forEach((task, index) => {
    let row = rows[index];

    row.textField.set({ disabled: false, text: task.text });
    row.doneBox.set({ disabled: false, selected: task.done });
  });
  rowsInUse = tasks.length;

  showUsage();
  say('Loaded ' + rowsInUse + ' task(s) from ' + TODO_PATH);
}


/* ==================================================================
 * 4. THE LOOP
 *
 * Wait for a click and run that button's command. The commands have
 * already said everything there is to show.
 * ================================================================== */

/** The command behind each button. */
const onClick = {
  [ID.ADD]:   addTask,
  [ID.SAVE]:  saveTasks,
  [ID.LOAD]:  loadTasks,
  [ID.CLEAR]: clearTasks,
};

showUsage();
window.open();
print('To-Do list open. Add a row, then edit the text. ' +
      'Save persists to ' + TODO_PATH + '.');

try {
  for (let event of window.events()) {

    if (event.kind === EventKind.CLOSE_WINDOW) break;
    if (event.kind !== EventKind.BUTTON_CLICK) continue;
    if (event.sourceId === ID.QUIT) break;

    if (onClick[event.sourceId]) onClick[event.sourceId]();
  }
}
finally {
  window.dispose();
}

print('Bye.');
