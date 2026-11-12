# qjs Amiga examples

Scripts that drive AmigaOS from JavaScript. They come in three groups:

- **Reaction** examples build windows from gadget objects with the
  `amiga.boopsi` classes: `Window`, `Layout`, `Button`, `Slider` and so
  on.
- **Classic Intuition** examples use the library wrappers (`Intuition`,
  `Exec`, `Graphics`, `Dos`) and struct wrappers (`Window`, `Screen`,
  `RastPort`, `IntuiMessage`) directly.
- **Probes** are diagnostic scripts kept from debugging sessions. They
  are not meant as models to copy.

Every script is written to the same rules, set out in
[STYLE.md](STYLE.md). Start with `tapedeck_demo.js`: it is the
reference the others follow.

## Running

On the Amiga, from `<root>/amiga/`:

```
stack 65536
qjs examples/react_hello.js
```

Every example runs with no arguments and says on the Shell what to do
and how to quit. The header of each file gives the `quickjs.library`
version it needs and lists what it assumes about the machine; the
newest any of them needs is **0.213**.

## How much there is to hold in your head

The **Load** column is a mechanical estimate of how much a reader must
keep in mind at once: decisions, nesting depth, the longest function
and the amount of raw plumbing (hex constants, peek and poke). Under 25
is *low*: readable in one sitting, top to bottom. Under 50 is *medium*:
needs a second pass. Anything above is *high*. **Was** is the same
figure before the examples were rewritten to STYLE.md.

It is an estimate for comparing files, not a grade. A file can score
higher after being improved if a long script was split into functions
that each make a decision. The formula is at the top of
`scripts/example_load.py`; regenerate these tables with
`python3 scripts/example_load.py --index`.

Now: 48 low, 12 medium, 1 high.
Before: 45 low, 15 medium, 1 high.

## Reaction examples

| Example | What it is | Load | Was |
|---|---|---|---|
| `bevels_demo.js` | Every Reaction bevel style, labelled with its name. | 8 low | 8 low |
| `buttons_demo.js` | A row of four buttons that say which one you clicked. | 12 low | 13 low |
| `calculator_demo.js` | A working four-function calculator. | 31 medium | 43 medium |
| `checkbox_demo.js` | Two checkboxes that report each time they change. | 12 low | 11 low |
| `chooser_demo.js` | A drop-down list of colours with a live readout. | 19 low | 18 low |
| `clicktab_demo.js` | Three tabbed pages that switch with no code at all. | 16 low | 14 low |
| `color_mixer_demo.js` | Mix a colour with three sliders, shown as hex. | 25 low | 29 medium |
| `datebrowser_demo.js` | A month calendar that reports the day you click. | 10 low | 8 low |
| `fuelgauge_demo.js` | A progress bar you fill up five percent at a time. | 15 low | 13 low |
| `getcolor_demo.js` | A colour-chooser gadget that reports the colour. | 10 low | 8 low |
| `getfile_demo.js` | A file-chooser gadget that reports the file picked. | 10 low | 8 low |
| `getfont_demo.js` | A font-chooser gadget, opened from a button. | 17 low | 17 low |
| `getscreenmode_demo.js` | A screen-mode chooser, opened from a button. | 16 low | 15 low |
| `glyph_demo.js` | Every standard Reaction glyph, next to its name. | 7 low | 8 low |
| `integer_demo.js` | A number field from 0 to 999 with spin arrows. | 10 low | 8 low |
| `led_demo.js` | A six-digit LED readout with a Reset button. | 12 low | 17 low |
| `listbrowser_demo.js` | A scrolling list of planets to pick from. | 18 low | 17 low |
| `login_demo.js` | A sign-in form that locks after three wrong tries. | 26 medium | 27 medium |
| `notes_demo.js` | A scratchpad built on the system text editor gadget. | 29 medium | 34 medium |
| `palette_demo.js` | A strip of the screen's colours to click on. | 10 low | 9 low |
| `progress_demo.js` | A progress bar you can start, pause and reset. | 21 low | 24 low |
| `quiz_demo.js` | A five-question multiple-choice quiz about the Amiga. | 31 medium | 34 medium |
| `radiobutton_demo.js` | Pick one of three fruits with radio buttons. | 9 low | 9 low |
| `react_hello.js` | The smallest Reaction window: a label and two buttons. | 14 low | 14 low |
| `reaction_clock_demo.js` | A seconds counter driven by timer.device. | 23 low | 16 low |
| `requester_demo.js` | Ask a question with a Reaction requester. | 2 low | 1 low |
| `scroller_demo.js` | Two scrollbars that report their position. | 13 low | 11 low |
| `settings_panel_demo.js` | A preferences dialog that reports your choices. | 22 low | 23 low |
| `slider_demo.js` | A slider from 0 to 100 that reports where it is. | 10 low | 9 low |
| `speedbar_demo.js` | A toolbar of five text buttons that reports clicks. | 18 low | 18 low |
| `stopwatch_demo.js` | A start / stop / reset stopwatch with LED digits. | 20 low | 30 medium |
| `string_demo.js` | Two text fields, one of them hiding what you type. | 16 low | 15 low |
| `tabs_demo.js` | Three pages in one window, switched by a row of buttons. | 16 low | 19 low |
| `tapedeck_demo.js` | A tape deck front panel in Reaction, from JavaScript. | 49 medium | 46 medium |
| `tapedeck_gadget_demo.js` | Both forms of the system's tape deck gadget. | 29 medium | 29 medium |
| `todo_demo.js` | A to-do list of up to eight tasks, saved to RAM:. | 31 medium | 32 medium |
| `wizard_demo.js` | A three-step setup wizard with Back, Next and Finish. | 21 low | 29 medium |

## Classic Intuition examples

| Example | What it is | Load | Was |
|---|---|---|---|
| `asl_filereq.js` | Ask for a file with the standard file requester. | 4 low | 4 low |
| `clock_demo.js` | A window that counts the seconds since it opened. | 33 medium | 29 medium |
| `dir_listing.js` | List a directory, the way the Dir command does. Optional arguments: `[directory=SYS:]`. | 18 low | 16 low |
| `drawing_demo.js` | Lines, boxes and text drawn straight into a window. | 16 low | 11 low |
| `font_loader.js` | Load a disk font by name and draw sample text in it. Optional arguments: `[fontname.font=topaz.font] [size=11]`. | 24 low | 19 low |
| `frameidemo.js` | The four standard frame styles, raised and recessed. | 24 low | 28 medium |
| `keyboard_echo.js` | Type into a window and see the text appear. | 27 medium | 28 medium |
| `memory_probe.js` | Print how much memory of each kind is free. Optional arguments: `[iterations=1]`. | 12 low | 14 low |
| `menu_demo.js` | A classic Intuition menu bar, built struct by struct. | 38 medium | 48 medium |
| `mouse_tracker.js` | Draw in a window by dragging the mouse. | 19 low | 18 low |
| `screen_custom.js` | A screen of our own, with one window drawn into. | 11 low | 10 low |
| `screen_info.js` | Print the size, title and font of the Workbench screen. | 8 low | 8 low |
| `sysi_gallery.js` | A labelled gallery of the system's own gadget images. | 31 medium | 19 low |
| `timer_demo.js` | Wait two seconds with timer.device and time the wait. | 12 low | 11 low |
| `window_hello.js` | The smallest useful Intuition window, from JavaScript. | 9 low | 9 low |

## Probes

| Example | What it is | Load | Was |
|---|---|---|---|
| `boopsi_probe.js` | Which step of making a label.image by hand crashes? | 20 low | 20 low |
| `boopsi_probe2.js` | Which wrapper class makes react_hello.js crash? | 10 low | 10 low |
| `boopsi_probe3.js` | What does each layer hold while the buttons stay silent? | 30 medium | 30 medium |
| `boopsi_probe4.js` | Which raw IDCMP messages does a button click send? | 68 high | 68 high |
| `boopsi_probe5.js` | Does a narrower IDCMP mask let button clicks through? | 16 low | 16 low |
| `boopsi_probe6.js` | What does Intuition see in our buttons' struct Gadget? | 22 low | 22 low |
| `boopsi_probe7.js` | Do the tag list bytes we build reach button.gadget? | 20 low | 20 low |
| `boopsi_probe8.js` | Is the button class intact, and does SetAttrsA work? | 19 low | 20 low |
| `boopsi_refresh_probe.js` | Does setting a gadget's text redraw it cleanly? | 18 low | 18 low |

## The wrapper-class API at a glance

```js
/* Library wrappers: PascalCase methods matching NDK autodoc names.
 * Library opens lazily on first call; cached; closed at script exit
 * (or manually via Lib.closeLibrary / LibraryBase.closeAll). */
let ptr  = Exec.AllocMem(64,
  Exec.consts.MEMF_PUBLIC | Exec.consts.MEMF_CLEAR);
Exec.FreeMem(ptr, 64);

/* Convenience helpers: every *TagList method has a *Tags sibling
 * that builds + frees the TagItem array for you. */
let win = Intuition.OpenWindowTags([
  [Intuition.consts.WA_Title,  title],
  [Intuition.consts.WA_Width,  320],
  [Intuition.consts.WA_Height, 200],
  [Intuition.consts.WA_IDCMP,  Intuition.consts.IDCMP_CLOSEWINDOW],
]);

/* Struct wrappers expose named fields via getters/setters — no
 * offset arithmetic in user code. */
console.log('rast port at', win.rastPort.ptr.toString(16));
console.log('screen font', win.screen.font.name, win.screen.font.ySize);

/* Window also has behavior methods + an IDCMP iterator. */
for (let msg of win.messages()) {
  if (msg.class === Intuition.consts.IDCMP_CLOSEWINDOW) break;
  /* msg.code, msg.mouseX, msg.mouseY, msg.qualifier, etc. */
}

win.close();  /* idempotent; zeroes win.ptr */

/* Constructable structs allocate on construction, free() on demand. */
let nw = new NewWindow({
  width: 320, height: 200, title: 'Hi',
  flags: Intuition.consts.WFLG_CLOSEGADGET | Intuition.consts.WFLG_ACTIVATE,
  idcmp: Intuition.consts.IDCMP_CLOSEWINDOW,
});
nw.free();
```

## Writing your own

Every example follows the same skeleton:

```js
import * as std from 'qjs:std';

if (typeof Intuition !== 'function') {
  print('Need quickjs.library 0.127+');
  std.exit(1);
}

const C = Intuition.consts;

let win = Intuition.OpenWindowTags([
  /* [C.WA_*, value], ... */
]);

if (!win) std.exit(1);

try {
  for (let msg of win.messages()) {
    if (msg.class === C.IDCMP_CLOSEWINDOW) break;
    /* handle other IDCMP_* events */
  }
}

finally {
  win.close();
}
```

Key references while authoring:

- **`amiga.<libname>.lvo.*`** — raw LVO constants for any of the 76
  NDK 3.2R4 libraries (if you want to call something not yet in a
  wrapper class). Lowercase-namespace: `amiga.intuition`,
  `amiga.exec`, ...
- **`amiga.<ClassName>`** — the wrapper classes under the `amiga`
  namespace. Case-distinct from the lowercase Q1 tables, so no
  conflict: `amiga.Intuition === Intuition` (the class) while
  `amiga.intuition.lvo.OpenWindow` is the FD constant. Useful if
  you've shadowed the global — `globalThis.Intuition` may be yours.
- **`LibraryBase`** — extend it to add your own library wrapper:

  ```js
  class MuiMaster extends LibraryBase {
    static libraryName    = 'muimaster.library';
    static libraryVersion = 19;
    static lvo = {
      MUI_NewObjectA:    -42,
      MUI_DisposeObject: -48,
      /* ... */
    };

    static NewObjectA(classID, tagList) {
      return this.call(this.lvo.MUI_NewObjectA,
        { a0: ptrOf(classID), a1: ptrOf(tagList) });
    }
  }
  ```

- **`CEnumeration`** — extend it for C-enum bridges. Cases coerce to
  their numeric value via `Symbol.toPrimitive`, so they pass
  straight to FFI calls.
- **NDK 3.2R4 autodocs** at `sdks/NDK3.2R4/Autodocs/<lib>.doc` for
  per-function semantics and register signatures.

## Raw FFI escape hatch

For library functions not yet covered by a wrapper class, drop to
the raw Q1 API:

```js
let lib = amiga.openLibrary('foo.library', 0);
let result = amiga.call(lib, amiga.foo.lvo.SomeFunc,
  { a0: ptr, d0: value });
amiga.closeLibrary(lib);
```

Same underlying plumbing — the wrapper classes are a layer on top.

## Safety

The Q2 wrapper API doesn't bypass Amiga-standard hazards. Direct
memory access via `amiga.peek*` / `amiga.poke*` (used internally by
struct getters/setters) and raw LVO calls can still crash the Amiga
on bad input. The wrapper API reduces your surface for mistakes
(typed struct fields, lazy library lifecycle, idempotent close)
but doesn't eliminate it. Test incrementally.
