# repl-harness

`node tools/repl-harness/harness.js [path/to/repl.js] [-v]` runs the line editor of `quickjs-master/repl.js` under node against a model of the Amiga console (`terminal.js`), feeds it key presses, and checks after every key that the screen shows the line being edited and that Enter evaluates what is displayed; it exists because vamos has no interactive console, and it cannot replace a look at a real ViNCEd or AmigaShell window.

`SCENARIO=<part of a name>` runs one scenario. Give the path of an older `repl.js` to see what it did.
