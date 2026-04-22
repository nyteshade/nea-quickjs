/*
 * todo_demo.js — minimalist to-do list with up to 8 tasks.
 *
 * Each task slot is a horizontal row: a CheckBox for "done" state +
 * a StringGadget for the task text. An Add button activates the next
 * empty slot, Clear empties all rows, Save persists to RAM:todo.txt
 * (one task per line, prefix "[X] " for done items).
 *
 * Demonstrates a fixed-row variable-content layout pattern — easier
 * than dynamic LAYOUT_AddChild/RemoveChild on a live window. (The
 * NDK Layout2.c shows the dynamic pattern; that's a future port once
 * we wrap WM_RETHINK.)
 *
 * Requires quickjs.library 0.156+.
 * Run:  qjs examples/todo_demo.js
 */

import * as std from 'qjs:std';

const { Window, Layout, Button, CheckBox, StringGadget, Label,
        EventKind, WindowPosition, BevelStyle } = amiga.boopsi;

const MAX_TASKS = 8;
const FILE_PATH = 'RAM:todo.txt';

const GID = {
  ADD:  100,
  SAVE: 101,
  LOAD: 102,
  CLEAR: 103,
  QUIT: 104,
};

/* Per-task IDs: checkbox = 200+i, string = 300+i. */
function cbId(i)  { return 200 + i; }
function txtId(i) { return 300 + i; }

/* Track "active" rows. Inactive rows are visible-but-disabled. */
let activeCount = 0;

let checkboxes = [];
let inputs     = [];

for (let i = 0; i < MAX_TASKS; i++) {
  checkboxes.push(new CheckBox({
    id: cbId(i), text: '', selected: false, disabled: true,
  }));
  inputs.push(new StringGadget({
    id: txtId(i), text: '(empty)', maxChars: 80, disabled: true,
  }));
}

function row(i) {
  return new Layout({
    orientation: 'horizontal', innerSpacing: 4,
    children: [ checkboxes[i], inputs[i] ],
  });
}

let listGroup = new Layout({
  orientation: 'vertical', innerSpacing: 2,
  bevelStyle:  BevelStyle.GROUP, label: 'Tasks',
  children: Array.from({ length: MAX_TASKS }, (_, i) => row(i)),
});

let status = new Label({ text: '0 of ' + MAX_TASKS + ' rows in use.' });

let addBtn   = new Button({ id: GID.ADD,   text: '_Add' });
let saveBtn  = new Button({ id: GID.SAVE,  text: '_Save' });
let loadBtn  = new Button({ id: GID.LOAD,  text: '_Load' });
let clearBtn = new Button({ id: GID.CLEAR, text: '_Clear All' });
let quitBtn  = new Button({ id: GID.QUIT,  text: '_Quit' });

let toolbar = new Layout({
  orientation: 'horizontal', innerSpacing: 4, evenSize: true,
  children: [ addBtn, saveBtn, loadBtn, clearBtn, quitBtn ],
});

let win = new Window({
  title:       'To-Do',
  innerWidth:  500,
  innerHeight: 360,
  position:    WindowPosition.CENTERSCREEN,
  closeGadget: true, dragBar: true, depthGadget: true,
  sizeGadget:  true, activate: true,
  layout: new Layout({
    orientation: 'vertical', innerSpacing: 6,
    children: [ listGroup, status, toolbar ],
  }),
});

function refreshStatus() {
  status.text = activeCount + ' of ' + MAX_TASKS + ' rows in use.';
  addBtn.set({ disabled: activeCount >= MAX_TASKS });
}

function addRow() {
  if (activeCount >= MAX_TASKS) return;
  let i = activeCount;
  inputs[i].set({ disabled: false, text: 'Task ' + (i + 1) });
  checkboxes[i].set({ disabled: false });
  activeCount++;
  refreshStatus();
}

function clearAll() {
  for (let i = 0; i < MAX_TASKS; i++) {
    checkboxes[i].set({ selected: false, disabled: true });
    inputs[i].set({ text: '(empty)', disabled: true });
  }
  activeCount = 0;
  refreshStatus();
}

function saveTasks() {
  let f = std.open(FILE_PATH, 'w');
  if (!f) {
    status.text = 'Save FAILED — could not open ' + FILE_PATH;
    return;
  }
  for (let i = 0; i < activeCount; i++) {
    let done = !!checkboxes[i].get('selected');
    let txt  = inputs[i].get('text') || '';
    f.puts((done ? '[X] ' : '[ ] ') + txt + '\n');
  }
  f.close();
  status.text = 'Saved ' + activeCount + ' task(s) to ' + FILE_PATH;
}

function loadTasks() {
  let f = std.open(FILE_PATH, 'r');
  if (!f) { status.text = 'No saved file at ' + FILE_PATH; return; }
  let lines = [];
  let chunk = '';
  while (true) {
    let bit = f.readAsString(4096);
    if (!bit || !bit.length) break;
    chunk += bit;
  }
  f.close();
  lines = chunk.split('\n').filter(s => s.length > 0);

  clearAll();
  for (let i = 0; i < Math.min(lines.length, MAX_TASKS); i++) {
    let line = lines[i];
    let done = line.startsWith('[X]');
    let text = line.replace(/^\[.\]\s*/, '');
    inputs[i].set({ disabled: false, text: text });
    checkboxes[i].set({ disabled: false, selected: done });
    activeCount = i + 1;
  }
  refreshStatus();
  status.text = 'Loaded ' + activeCount + ' task(s) from ' + FILE_PATH;
}

refreshStatus();
win.open();
print('To-Do list open. Add a row, then edit the text. Save persists to ' + FILE_PATH + '.');

let done = false;
try {
  for (let e of win.events()) {
    if (e.kind === EventKind.CLOSE_WINDOW) break;
    if (e.kind === EventKind.BUTTON_CLICK) {
      switch (e.sourceId) {
        case GID.ADD:   addRow();    break;
        case GID.SAVE:  saveTasks(); break;
        case GID.LOAD:  loadTasks(); break;
        case GID.CLEAR: clearAll();  break;
        case GID.QUIT:  done = true; break;
      }
      if (done) break;
    }
  }
}
finally {
  win.dispose();
}
print('Bye.');
