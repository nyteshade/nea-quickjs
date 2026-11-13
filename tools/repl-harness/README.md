# repl-harness

`node tools/repl-harness/harness.js [path/to/repl.js] [-v]` runs the line editor of `quickjs-master/repl.js` under node against a model of the Amiga console (`terminal.js`), feeds it key presses, and checks after every key that the screen shows the line being edited and that Enter evaluates what is displayed; it exists because vamos has no interactive console, and it cannot replace a look at a real ViNCEd or AmigaShell window.

`SCENARIO=<part of a name>` runs one scenario or case. Give the path of an older `repl.js` to see what it did.

## What it covers

Scenarios (a list of keys, compared key by key with a reference editor, on every console configuration):

- recall, cursor movement, insert, backspace, kill to end of line
- Del (7F on the Amiga) deletes under the cursor; backspace (08) before it
- Home and End of a 101-key keyboard (`CSI 44~`, `CSI 45~`), Ctrl-A and Ctrl-E
- word movement (shifted cursor keys), kill word, kill line, yank
- a line longer than the window, a line ending exactly at the right margin, a long line recalled from history and edited in the middle
- the window made narrower and wider while a long line is edited
- keys with no editing function, and reports the console sends by itself, insert nothing

Cases (each has its own checks):

- a paste of several lines arriving in one read
- input over several lines with the continuation prompt
- Enter, and Tab twice, with the cursor in the first row of a long line
- Tab completion and the list of candidates
- the console is asked for its width only when it reports a resize, and the report is cancelled on the way out
- a window bounds report that arrives after start-up gave up waiting for it

## What the model assumes, and only an Amiga can confirm

`terminal.js` follows `sdks/NDK3.2R4/Autodocs/console.doc` and the console chapter of the RKRM Devices manual. These points come from the documents, not from a console:

- Del sends 7F and backspace sends 08. That is the keymap's doing; a keymap can say otherwise.
- With raw event 12 set (`CSI 12 {`), resizing the window puts `CSI 12;...|` in the input stream of a CON: window in raw mode, and `CSI 0 SP q` is answered with `CSI 1;1;rows;columns SP r`. ViNCEd may differ from the standard console.
- What the console does with rows already on screen when the window is resized. The model clips them; the editor does not depend on it, because after a resize it shows the line again from a fresh row.
- `CSI 12 }` on the way out stops the reports, so the Shell does not get them.
