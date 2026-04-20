# qjs Amiga examples

Scripts that drive AmigaOS libraries from JavaScript via the **Q2
wrapper-class API** — `Intuition`, `Exec`, `Graphics`, `GadTools`,
plus struct wrappers (`Window`, `NewWindow`, `Screen`, `RastPort`,
`IntuiMessage`). No `amiga.call(...)` or `peek32(win + 86)` in user
code; that plumbing is hidden behind classes and named field
getters.

## Running

On the Amiga, from `<root>/amiga/`:

```
stack 65536
qjs examples/window_hello.js
```

Requires `quickjs.library` **0.128 or later** in `LIBS:`.

## Examples

| File | What it shows |
|---|---|
| `window_hello.js` | Minimal `Intuition.OpenWindowTags([...])` → `for (let msg of win.messages())` → `win.close()`. The shortest possible GUI script. |
| `drawing_demo.js` | Draws lines, rects, outlines, cross-hatch, and text into a `Window.rastPort` via its instance methods (`setColor/move/draw/rectFill/text`). Repaints on `IDCMP_REFRESHWINDOW`. |
| `frameidemo.js` | Port of NDK 3.1 `Examples1/intuition/frameidemo.c`. `new NewWindow({...})` constructor, `Intuition.OpenWindow(nw)`, `Intuition.NewObjectTags('frameiclass', pairs)` for four BOOPSI image classes × two states, `win.screen.font.ySize` chain for dynamic layout. |
| `screen_info.js` | `Intuition.LockPubScreen(null)` → read `screen.title/width/height/barHeight/font.name/font.ySize` via struct getters → `UnlockPubScreen`. Pure introspection — no window, no event loop. |

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
