# How the examples are written

Every script in this directory follows the same rules, so that reading
one teaches you how to read the rest. `tapedeck_demo.js` is the
reference: when in doubt, do what it does.

The aim is to show that Reaction and Intuition code can be short and
obvious when written in JavaScript. An example succeeds when someone
who has never seen it can say what it does after reading the first ten
lines, run it without preparing anything, and follow it top to bottom
without scrolling back.

## 1. Easily described: the header

Each file opens with one comment block, in this order:

```js
/*
 * name_of_file.js - one sentence saying what it is, in plain words.
 *
 * Two or three sentences on what you will see and what to try. If a
 * small picture of the window helps, draw one.
 *
 * Assumptions:
 *   - what the script takes for granted about the machine
 *   - one line each
 *
 * Requires quickjs.library 0.xxx+.
 * Run: qjs examples/name_of_file.js
 */
```

The first line must work on its own as the file's entry in an index.
Say what the example *shows*, not which API calls it makes.

## 2. Easily run

- It runs with no arguments. Arguments are optional extras, shown on
  the `Run:` line with their defaults.
- It needs no setup: no files that must exist first, no assigns beyond
  a standard Workbench. If it writes a file, it writes to `RAM:`.
- It says on the Shell what to do once it is open, and how to quit.
- It always cleans up, in a `finally`, however it exits.
- Every window can be closed with its close gadget.

## 3. Assumptions are written down

Anything the script relies on but does not check goes under
`Assumptions:` in the header. Typical ones:

- which screen it opens on, and that the screen is big enough
- which classes or libraries must be installed (and in which OS release
  they arrived)
- that `RAM:` is writable, a font exists, a device is present
- timing: what drives the clock, and how coarse it is
- anything about the gadget's behaviour that was observed rather than
  documented

An assumption made inside the code gets a comment at that line as well.
If the script does check something, it is not an assumption; say what
happens when the check fails instead.

## 4. Top to bottom

- Put things in the order a reader needs them: constants, then the
  pieces, then the window, then the loop.
- Files longer than about sixty lines of code are divided into numbered
  parts with a banner comment each, and the header lists the parts.
  Short files are not: a thirty-line example with four banners is
  harder to read, not easier.
- Keep what the program *does* apart from how it *looks* when there is
  enough behaviour to be worth separating. Logic that does not touch a
  gadget can then be read, and tested, on its own.

## 5. The window is one expression

Name the gadgets the loop needs to talk to, then arrange them in a
single nested `layout:` tree whose indentation matches the picture.
Small helpers such as `row(...)` are welcome when they make the tree
read more like the window.

## 6. The loop decides nothing

```js
for (let event of window.events()) {
  if (event.kind === EventKind.CLOSE_WINDOW) break;

  switch (event.kind) {
    case EventKind.BUTTON_CLICK: ...
  }

  render();
}
```

Switch on `event.kind`. When several gadgets of one kind each do
something different, use a table keyed by gadget ID rather than a long
`switch`. Redraw from one place.

## 7. Names and numbers

- Whole words: `volumeSlider`, not `vs`; `event`, not `e`.
- Gadget IDs live together in one `const ID = { ... }`.
- No bare numbers in the logic. Give each a named constant with a
  comment saying what it is and in what unit.
- An OS value is never typed into an example: no tag, flag, method ID,
  library offset or structure offset. Use the library's name for it
  (`Intuition.consts.WA_InnerWidth`, `TimerRequest.consts.UNIT_VBLANK`,
  `new TextAttr(pointer).ySize`). If the library has no name for it,
  add one to the library (docs/CONSTANTS.md says how) and then use it.
  `python3 scripts/check_constants.py` checks any that remain.
- A constant is only equal to itself. Compare `message.class` with a
  constant directly; to compare a raw number, convert the constant
  once: `const SELECTDOWN = Number(C.SELECTDOWN);`
- A version check tests for the newest thing the script uses, with
  `in`, which does not throw on a missing name:
  `if (!('WA_InnerWidth' in Intuition.consts)) ...`. Say in a comment
  which version it arrived in.
- Sizes on screen come from the screen font, not from fixed pixel
  counts: the user chooses the font. Measure with `ScreenFont` before
  the window opens, ask for `WA_InnerWidth` / `WA_InnerHeight`, and
  place things from `window.borderLeft` / `borderTop` and the
  RastPort's `fontHeight` / `fontBaseline` (clock_demo.js and
  drawing_demo.js show how).

## 8. Comments

- Every function has a JSDoc block with typed `@param` and `@returns`.
  Types matter here more than usual: a wrong type passed through the
  FFI is a crash, not an exception.
- Comments say why. The code already says what.
- Blank lines separate ideas, as paragraphs do.

## 9. Mechanics

- Plain ASCII throughout, comments included. The Amiga console is
  Latin-1; anything else prints as garbage.
- Lines stay within 80 columns.
- No unused imports or variables.

## Measuring it

`python3 scripts/example_load.py` prints, for each example, a rough
count of how much a reader has to keep in mind at once: decisions,
nesting depth, the longest function and the amount of raw plumbing.
The formula and its bands are described at the top of that script. It
is an estimate for comparing files, not a grade; the README lists the
current figure for every example.
