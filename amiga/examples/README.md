# qjs Amiga examples

Scripts that demonstrate the Q1 FFI (`globalThis.amiga`) by calling real
AmigaOS libraries from JS. All examples are **raw FFI** — `amiga.call`
with explicit register arguments, `peek/poke` for struct fields,
`makeTags` for TagItem arrays. Wrappers that hide this detail (Q2
Intuition class, Q3 GadTools GUI) will ship later.

## Running

On the Amiga, from `<root>/amiga/`:

```
stack 65536
qjs examples/window_hello.js
```

Requires `quickjs.library` **0.125 or later** in `LIBS:`.

## Examples

| File | What it shows |
|---|---|
| `window_hello.js` | Opens a 320×120 Intuition window, waits for close-gadget or mouse click. Exercises openLibrary/call/makeTags/peek/event loop via exec WaitPort/GetMsg/ReplyMsg. |
| `drawing_demo.js` | Opens a window and draws lines, rectangles, outlines, cross-hatch, text using graphics.library (SetAPen/Move/Draw/RectFill/Text). Repaints on IDCMP_REFRESHWINDOW so resizing works cleanly. |
| `frameidemo.js` | 1:1 port of NDK 3.1 `Examples1/intuition/frameidemo.c`. Builds a classic `struct NewWindow` in allocated memory (byte-level field poking), uses NewObjectA to create four BOOPSI `frameiclass` images in both normal and recessed states, renders them with DrawImage, handles IDCMP_REFRESHWINDOW via BeginRefresh/EndRefresh. |
| `screen_info.js` | LockPubScreen(NULL) → peek Screen struct fields (geometry, flags, title-bar height, borders, default font) → UnlockPubScreen. No window, no event loop — just demonstrates safe read-only introspection. |

## Writing your own

Every example follows the same skeleton:

```js
import * as std from 'qjs:std';

if (typeof amiga !== 'object') { std.exit(1); }

const SysBase = amiga.peek32(4);       // always at absolute 4
const lib = amiga.openLibrary('foo.library', 0);
if (!lib) { std.exit(1); }

// ... amiga.call(lib, amiga.foo.lvo.SomeFunc, { a0: ..., d0: ... }) ...

amiga.closeLibrary(lib);
```

Key references while authoring:

- NDK 3.2R4 autodocs at `sdks/NDK3.2R4/Autodocs/<lib>.doc` —
  look up a function's register signature: `(a0/a1/d0)` means
  put args 1/2/3 into A0/A1/D0 respectively.
- `amiga.<libname>.lvo.*` — library function LVO constants (all 76
  AmigaOS libraries from the NDK).
- `amiga.<libname>.*` — library-specific flag/tag constants where
  hand-curated (currently exec/dos/intuition/graphics/gadtools).
- Struct field offsets — check the header in
  `sdks/NDK3.2R4/Include_H/` and count bytes carefully (WORDs are 2,
  ULONGs and pointers are 4, chars are 1, alignment is 2-byte).

## Safety

Direct memory access via `peek*` / `poke*` and raw LVO calls via
`amiga.call` can crash the Amiga on bad input — this is Amiga-standard
behavior (see `docs/AMIGA_FFI_ROADMAP.md`). Always pair `openLibrary`
with `closeLibrary`, `allocMem` with `freeMem`, and reply every
`GetMsg` result. Test incrementally.
