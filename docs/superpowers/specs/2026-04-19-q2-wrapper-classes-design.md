# Q2 — Wrapper-Class FFI Design Spec

**Status:** brainstormed 2026-04-19, awaiting user spec review.
**Library target:** 0.127.
**Predecessors:** Q1 FFI (0.124–0.126) — raw `amiga.call`, peek/poke, makeTags,
all 76 NDK 3.2R4 LVO tables.

## Goal

Make the Amiga FFI feel JS-native. End-user scripts should never need
`amiga.call(intuition, I.lvo.CloseWindow, {a0: win})` or `peek32(win + 86)` —
those are plumbing. Instead:

```js
import { Intuition } from 'qjs:amiga/ffi';

let win = Intuition.OpenWindowTags([
  [Intuition.consts.WA_Title, 'Hello'],
  [Intuition.consts.WA_Width, 320],
]);

for (let msg of win.messages()) {
  if (msg.class === Intuition.consts.IDCMP_CLOSEWINDOW) {
    break;
  }
}

win.close();
```

Idiomatic JS, no offset arithmetic, classes match Amiga API names verbatim.

## Non-goals (this spec)

- Auto-generation from C struct headers (deferred — pilot uses ~10
  hand-coded structs)
- All 76 library wrappers (pilot covers 5 — Exec/DOS/Intuition/Graphics/GadTools)
- The `quickjs-amiga.library` split (separately tracked)
- DoMethod (Reaction class dispatch — Phase 2)
- Hook-based callbacks (Phase 2 — needed for ASL filter, etc.)

## Architecture

```
quickjs-master/amiga/ffi/
  Enumeration patch                  # vendored class gets `static from(query)`
  AmigaCEnumeration.js               # subclass adds structured-value semantics
  LibraryBase.js                     # base for all library wrapper classes
  ptrOf.js                           # tiny helper module
  Exec.js                            # ~115 LVO methods, hand-pruned to common
  Dos.js                             # ~161 LVO methods
  Intuition.js                       # ~127 LVO methods
  Graphics.js                        # ~163 LVO methods
  GadTools.js                        # ~21 LVO methods
  structs/
    Struct.js                        # base for struct wrapper classes
    NewWindow.js                     # 48-byte struct, named getters/setters
    Window.js                        # opened-window pointer wrapper
    Screen.js
    RastPort.js
    IntuiMessage.js
    TagItem.js
    MsgPort.js
    TextAttr.js
    Image.js
    Gadget.js                        # 10 hand-coded structs covering current examples

quickjs-master/amiga/ffi/build/
  *.jsbc                             # qjsc bytecode dumps, committed

quickjs-master/gen/extended.c        # bakes the FFI sources via a new manifest
```

**Two-format distribution.** `.js` files are committed for IDE consumption
(Cursor/VSCode on Mac) — full JSDoc, type hints, jump-to-definition.
`.jsbc` files are committed bytecode artifacts the qjs runtime loads on Amiga.
Generator script regenerates both whenever NDK source changes.

**Three placement scopes for each library wrapper:**
- `amiga.lib.Intuition` — always present, namespace-safe
- `globalThis.Intuition` — only if the slot is free at install time;
  documented behavior so users who name a `class Intuition {}` of their
  own simply override
- ES module export — `import { Intuition } from 'qjs:amiga/ffi'` for code
  that prefers explicit imports

## Code style for all generated and hand-written JS in `amiga/ffi/`

- **2-space indent, 80-column hard wrap**
- **Opening brace on same line** (`if (cond) {`)
- **Never `} else {`** chained — closing brace gets its own line, blank
  line, then `else`/`else if`/`catch`/`finally` on its own line:
  ```js
  if (cond) {
    ...
  }

  else {
    ...
  }
  ```
- **Blank line between variable declarations and the next statement**
- **Blank line before every `return`**
- **Long lines wrap vertically** — each arg/parameter own line, closing
  `)` at base indent
- **JSDoc on every public class member, function, exported constant** —
  description, blank line, `@param`/`@returns`/`@type` block
- **Inline comments** where they clarify intent (the why, not the what)
- **PascalCase preserved for AmigaOS API names** (`Intuition.CloseWindow`,
  not `intuition.closeWindow`) — matches NDK autodocs verbatim

These match the global Fina entry tagged
`code-style,javascript,formatting,preferences`.

## `LibraryBase`

Common ancestor for all library wrapper classes. Subclasses set static
`libraryName`, `libraryVersion`, `lvo`, and add a static method per
exposed LVO.

```js
class LibraryBase {
  static libraryName    = '';
  static libraryVersion = 0;
  static libraryBase    = 0;
  static lvo            = {};

  static ensureLibrary() { /* lazy open, cache, throw on fail */ }
  static closeLibrary()  { /* idempotent close */ }
  static call(lvo, regs) { /* amiga.call(this.ensureLibrary(), ...) */ }

  static closeAll()      { /* exit-hook helper, closes every opened lib */ }
}
```

Lifecycle:
- Library opens lazily on first method call.
- `LibraryBase.closeAll()` is registered as a script-exit hook (via
  `os.setExitHook` if available; documented manual call otherwise) so
  scripts that exit early or throw don't leak library bases.

## `ptrOf(x)` helper

Coerces JS values to raw pointer numbers. Used in every method that
takes a pointer arg.

```js
function ptrOf(x) {
  if (x === null || x === undefined) return 0;
  if (typeof x === 'object' && typeof x.ptr === 'number') return x.ptr;
  return x | 0;
}
```

Accepts: `null`/`undefined` → 0, struct instance with `.ptr` → unwrapped,
primitive number → as-is.

## Library wrapper class shape (example: `Intuition`)

```js
class Intuition extends LibraryBase {
  static libraryName    = 'intuition.library';
  static libraryVersion = 39;
  static lvo            = amiga.intuition.lvo;

  static consts = class IntuitionConsts extends AmigaCEnumeration {
    static {
      IntuitionConsts.define('WA_Title', {
        cName: 'WA_Title',
        value: 0x8000006E,
      });
      /* ~50 more from intuition.h, generated */
    }
  };

  /**
   * Closes a window opened by OpenWindow/OpenWindowTagList.
   *
   * @param {number|Window} window pointer or Window struct instance
   * @returns {undefined}
   */
  static CloseWindow(window) {
    return this.call(this.lvo.CloseWindow, { a0: ptrOf(window) });
  }

  /**
   * Faithful one-to-one wrapper for OpenWindowTagList.
   *
   * @param {number|NewWindow|null} newWindow legacy NewWindow ptr (may be 0)
   * @param {number|null} tagList pointer to a TagItem array
   * @returns {Window|null} new Window wrapper, or null on failure
   */
  static OpenWindowTagList(newWindow, tagList) {
    let raw = this.call(
      this.lvo.OpenWindowTagList,
      { a0: ptrOf(newWindow), a1: ptrOf(tagList) }
    );

    return raw ? new Window(raw) : null;
  }

  /**
   * Convenience over OpenWindowTagList — accepts a JS array of
   * [tag, data] pairs, builds and frees the TagItem array internally.
   *
   * @param {Array<[number, number]>} pairs
   * @returns {Window|null}
   */
  static OpenWindowTags(pairs) {
    let tags = amiga.makeTags(pairs);
    let bytes = (pairs.length + 1) * 8;

    try {
      return this.OpenWindowTagList(null, tags);
    }

    finally {
      amiga.freeMem(tags, bytes);
    }
  }
}
```

**Conventions for generated method bodies:**
- Pointer args coerced via `ptrOf(x)` — accepts struct instances or numbers.
- Numeric args `x | 0` (or `Number(x)` when 32-bit might overflow signed).
- Return values: pointers wrapped in matching struct class when one
  exists (e.g. `Window`, `Screen`, `IntuiMessage`); raw numbers otherwise.
- Every `*TagList` function gets a `*Tags(pairs)` convenience sibling.
- Library-prefixed function names (`MUI_NewObjectA`, `GT_GetIMsg`) lose
  the prefix in the class form (`MUI.NewObjectA`, `GadTools.GetIMsg`).
  Raw form remains accessible via `amiga.<lib>.lvo.<RawName>`.

## Struct wrapper shape (example: `Window`)

```js
class Window {
  /**
   * Pointer to the underlying struct Window in Amiga memory.
   *
   * @type {number}
   */
  ptr;

  constructor(ptr) {
    this.ptr = ptr;
  }

  /** @returns {number} */
  get width()  { return amiga.peek16(this.ptr + 8);  }

  /** @returns {number} */
  get height() { return amiga.peek16(this.ptr + 10); }

  /** @returns {string|null} */
  get title() {
    let p = amiga.peek32(this.ptr + 32);

    return p ? amiga.peekString(p, 256) : null;
  }

  /** @returns {RastPort} */
  get rastPort() {
    return new RastPort(amiga.peek32(this.ptr + 50));
  }

  /** @returns {MsgPort} */
  get userPort() {
    return new MsgPort(amiga.peek32(this.ptr + 86));
  }

  /**
   * Close this window. Idempotent — safe to call multiple times.
   * After calling, this.ptr is 0 and further methods will throw.
   *
   * @returns {undefined}
   */
  close() {
    if (!this.ptr) {
      return;
    }

    Intuition.CloseWindow(this);
    this.ptr = 0;
  }

  /**
   * Async-style iterator over IDCMP messages on this window's UserPort.
   * Internally Wait()s on the port's signal, drains all queued messages
   * via GetMsg, replies via ReplyMsg, yields each one.
   *
   * Use with for-of:
   *   for (let msg of win.messages()) {
   *     if (msg.class === Intuition.consts.IDCMP_CLOSEWINDOW) break;
   *   }
   *
   * @yields {IntuiMessage}
   */
  * messages() {
    let port = this.userPort;
    let sigBit = amiga.peek8(port.ptr + 15);
    let sigMask = 1 << sigBit;

    while (this.ptr) {
      Exec.Wait(sigMask);

      let raw;

      while ((raw = Exec.GetMsg(port)) !== 0) {
        let msg = new IntuiMessage(raw);

        try {
          yield msg;
        }

        finally {
          Exec.ReplyMsg(msg);
        }
      }
    }
  }
}
```

**Constructable struct example (`NewWindow`):**

```js
class NewWindow {
  static SIZE = 48;

  /** @type {number} */
  ptr;

  /**
   * Allocates a 48-byte NewWindow struct in MEMF_PUBLIC|MEMF_CLEAR
   * memory, optionally populates fields from `init`. Caller MUST call
   * `.free()` when done.
   *
   * @param {object} [init] field defaults
   * @param {number} [init.left=0]
   * @param {number} [init.top=0]
   * @param {number} [init.width]   required
   * @param {number} [init.height]  required
   * @param {number} [init.idcmp=0]
   * @param {number} [init.flags=0]
   * @param {string} [init.title]
   * @param {number} [init.minWidth=0]
   * @param {number} [init.minHeight=0]
   * @param {number} [init.maxWidth=640]
   * @param {number} [init.maxHeight=480]
   * @param {number} [init.type=1]   1=WBENCHSCREEN, 15=CUSTOMSCREEN
   */
  constructor(init) {
    this.ptr = amiga.allocMem(NewWindow.SIZE);

    if (!this.ptr) {
      throw new Error('NewWindow: allocMem failed');
    }

    /* fields default to 0 because MEMF_CLEAR; only override what's set */
    if (init) {
      if (init.left      !== undefined) this.left      = init.left;
      if (init.top       !== undefined) this.top       = init.top;
      if (init.width     !== undefined) this.width     = init.width;
      if (init.height    !== undefined) this.height    = init.height;
      if (init.idcmp     !== undefined) this.idcmp     = init.idcmp;
      if (init.flags     !== undefined) this.flags     = init.flags;
      if (init.title     !== undefined) this.title     = init.title;
      if (init.minWidth  !== undefined) this.minWidth  = init.minWidth;
      if (init.minHeight !== undefined) this.minHeight = init.minHeight;
      if (init.maxWidth  !== undefined) this.maxWidth  = init.maxWidth;
      if (init.maxHeight !== undefined) this.maxHeight = init.maxHeight;
      if (init.type      !== undefined) this.type      = init.type;
    }

    this._titleAlloc = 0;
  }

  /**
   * Releases the underlying memory. Idempotent.
   *
   * @returns {undefined}
   */
  free() {
    if (this._titleAlloc) {
      amiga.freeMem(this._titleAlloc[0], this._titleAlloc[1]);
      this._titleAlloc = 0;
    }

    if (this.ptr) {
      amiga.freeMem(this.ptr, NewWindow.SIZE);
      this.ptr = 0;
    }
  }

  get left()   { return amiga.peek16(this.ptr + 0); }
  set left(v)  { amiga.poke16(this.ptr + 0, v); }

  get width()  { return amiga.peek16(this.ptr + 4); }
  set width(v) { amiga.poke16(this.ptr + 4, v); }

  /* idcmp at +10, flags at +14, title at +26 — see frameidemo.js for layout */

  set title(s) {
    /* free previous title alloc if any, alloc + poke + write pointer */
    if (this._titleAlloc) {
      amiga.freeMem(this._titleAlloc[0], this._titleAlloc[1]);
    }

    if (!s) {
      amiga.poke32(this.ptr + 26, 0);
      this._titleAlloc = 0;
      return;
    }

    let bytes = s.length + 1;
    let strPtr = amiga.allocMem(bytes);

    amiga.pokeString(strPtr, s);
    amiga.poke32(this.ptr + 26, strPtr);
    this._titleAlloc = [strPtr, bytes];
  }

  /* ...rest of getters/setters elided for brevity... */
}
```

**Memory management for structs:** explicit `.free()`. No GC integration —
QuickJS-ng FinalizationRegistry exists but timing is non-deterministic
and AmigaOS allocations should be released eagerly. Ergonomic helper for
try/finally:

```js
function withStruct(StructClass, init, fn) {
  let s = new StructClass(init);

  try {
    return fn(s);
  }

  finally {
    s.free();
  }
}
```

## `AmigaCEnumeration`

Subclass of vendored `Enumeration` (which itself gets only a small
addition: `static from(query)`). `AmigaCEnumeration` adds:

- `valueOf()` drills into structured `{cName, value, ...}` records
  to return the underlying numeric value, so cases pass straight to FFI
- `[Symbol.toPrimitive]('number')` does the same drill
- `static from(query)` extends the base lookup to also match against
  fields on a structured value or on `associations`

Library wrappers' `consts` nested class extends `AmigaCEnumeration`,
NEVER the base `Enumeration` directly.

Vendored class stays pure (only the small `from`); structured-value
behavior is opt-in via the subclass.

## Pilot scope (this spec, library 0.127)

| Library | Methods (count) | Constants (consts class) | Convenience helpers |
|---|---|---|---|
| `Exec` | 30 of 115 (most-used: AllocMem, FreeMem, OpenLibrary, CloseLibrary, AllocVec, FreeVec, FindTask, Signal, Wait, GetMsg, PutMsg, ReplyMsg, WaitPort, CreateMsgPort, DeleteMsgPort, SuperState, UserState, OpenDevice, CloseDevice, DoIO, SendIO, AbortIO, etc.) | MEMF_* | — |
| `Dos` | 30 of 161 (Open, Close, Read, Write, Input, Output, Lock, UnLock, Examine, ExNext, DateStamp, Delay, IoErr, etc.) | MODE_*, OFFSET_* | — |
| `Intuition` | 60 of 127 (OpenWindow*, CloseWindow, ActivateWindow, MoveWindow, SizeWindow, ZipWindow, RefreshGList, AddGList, RemoveGList, OpenScreen*, CloseScreen, ScreenToFront/Back, NewObjectA, DisposeObject, SetAttrsA, GetAttr, BeginRefresh, EndRefresh, DisplayBeep, EasyRequestArgs, etc.) | WA_*, SA_*, IDCMP_*, WFLG_*, IA_* | OpenWindowTags, OpenScreenTags, NewObjectTags, SetAttrsTags |
| `Graphics` | 40 of 163 (SetAPen, SetBPen, SetDrMd, Move, Draw, RectFill, BltBitMap, Text, TextLength, OpenFont, CloseFont, AskFont, LoadRGB4, SetRGB4, GetRGB4, ReadPixel, WritePixel, Flood, etc.) | JAM1, JAM2, COMPLEMENT, INVERSVID | — |
| `GadTools` | All 21 (CreateContext, CreateGadgetA, FreeGadgets, CreateMenusA, FreeMenus, LayoutMenuItemsA, LayoutMenusA, GetIMsg, ReplyIMsg, RefreshWindow, etc. — GT_ prefix stripped) | gadget kinds, GTLV_*, GTCB_*, GTST_*, GTIN_* | CreateGadgetTags, CreateMenusTags |

| Struct | Fields covered | Notes |
|---|---|---|
| `Struct` (base) | `.ptr`, `.free()`, `.read*()`, `.write*()` | Generic peek/poke helpers |
| `NewWindow` | All 48 bytes via getters/setters; constructor accepts `init` object; auto-free for owned title string | The construct-and-pass-to-OpenWindow path |
| `Window` | width, height, title, rastPort, userPort, screen, mouseX, mouseY; `close()`, `move()`, `size()`, `toBack()`, `toFront()`, `messages()` async-style iterator | Wraps a Window pointer returned by Open* |
| `Screen` | width, height, title, font, rastPort, viewPort | Read-only wrapper for LockPubScreen returns |
| `RastPort` | Drawing methods that delegate to Graphics: `setColor()`, `setBgColor()`, `move()`, `draw()`, `rectFill()`, `text()` | Heavily method-driven for the drawing demo flavor |
| `MsgPort` | sigBit, sigTask | Used by Window.messages() |
| `IntuiMessage` | class (getter), code, mouseX, mouseY, qualifier, IAddress, idcmpWindow; `reply()` | Message yielded by win.messages() |
| `TagItem` | tag, data — array helpers via amiga.makeTags wrapper | |
| `TextAttr` | name, ySize, style, flags | Used by Screen.font |
| `Image` | width, height, leftEdge, topEdge — read-only wrapper for NewObjectA('image*') returns | |
| `Gadget` | leftEdge, topEdge, width, height, gadgetType, flags, activation, gadgetID | Read-only enough for first ship; Q3 GadTools wrapper makes them constructable |

Total: ~180 wrapper methods + 11 struct classes. Out of ~1177 LVOs +
100+ structs in the NDK. The pilot covers the slice exercised by the
existing examples and the GadTools/Reaction tier we want next.

## Generation

Generator script(s) that read NDK 3.2R4 sources and emit `.js` files:

- `scripts/gen_ffi_lib.py` — for each library: parses
  `sdks/NDK3.2R4/FD/<lib>_lib.fd` (function name + register signature),
  parses `sdks/NDK3.2R4/Autodocs/<lib>.doc` (per-function description
  for JSDoc), emits `quickjs-master/amiga/ffi/<LibName>.js`.
- `scripts/gen_ffi_consts.py` — for each library: parses relevant
  headers under `sdks/NDK3.2R4/Include_H/` for tag/flag constants,
  emits the `static consts = class extends AmigaCEnumeration {...}`
  block.
- Manual hand-coded `.js` files for the pilot before the generator
  exists; once shape is proven the generator catches up to the
  hand-coded form.

`.jsbc` files are produced by `qjsc -c` per source file (or
`-N name -o build/Foo.jsbc`) at library-build time. Committed.

Loader: extended.js gets a new `amiga-ffi-classes` manifest after the
existing `amiga-ffi` manifest. The new manifest evaluates each baked-in
`.jsbc` blob (or imports the .js source if running on host). Sets up
`globalThis.LibraryBase`, `globalThis.AmigaCEnumeration`, and each
library class. Registers an exit hook that calls `LibraryBase.closeAll()`.

## Migration

Existing examples (`window_hello.js`, `frameidemo.js`, `drawing_demo.js`,
`screen_info.js`) keep working — they use the raw `amiga.call` API
which remains. As part of this batch, port one example
(`drawing_demo.js`) to the new wrapper API as a demonstration of the
ergonomics gain. Other ports happen as we touch them.

## Testing

`amiga/tests/test_ffi_classes.js` — sections:
1. LibraryBase contract: subclass, ensureLibrary opens, second call
   returns cached, closeLibrary releases.
2. ptrOf coercion: null/undefined/number/object-with-ptr.
3. AmigaCEnumeration: structured-value coercion, from() lookups (key,
   value, structured field, association).
4. Per-library pilot: open lib via class, call one method, get expected
   return type, close.
5. Window struct: open via Intuition.OpenWindowTags, read fields via
   getters, close via .close().
6. NewWindow: construct, populate, pass to OpenWindow, get a Window
   back, close, free.
7. Window.messages() async-style iterator: emits IntuiMessage on click.

## Ship plan (this batch = library 0.127)

1. Vendored Enumeration: add `static from(query)` (small).
2. New `AmigaCEnumeration.js`.
3. New `LibraryBase.js` + `ptrOf.js`.
4. Hand-write 5 library wrappers + 11 struct classes per pilot scope.
5. Wire everything into a new `amiga-ffi-classes` manifest in
   `extended.js`. Bake into bytecode.
6. Bump library version 0.126 → 0.127. Build. Verify $VER.
7. Port one existing example (`drawing_demo.js` or new
   `frameidemo_classes.js`) to the wrapper API.
8. New test file `test_ffi_classes.js`. Add to runtests.
9. Commit + push.
10. Update MORNING_CHECKLIST.

## Risk

| Risk | Mitigation |
|---|---|
| Method bodies wrong (wrong register, wrong argc) | FD signatures are authoritative; test 5 critical paths per library on the Amiga |
| Struct field offsets wrong | Documented offsets per struct, eyeball-check against headers, test via known-value round-trip |
| Window.messages() iterator doesn't drain cleanly on early break | try/finally inside the generator + process-exit ReplyMsg cleanup |
| Bytecode bloat | We added ~31KB at 0.126 (NDK FFI). Pilot adds maybe ~30KB more. Library will hit ~150KB bytecode. Still tractable. |
| User script holds a Window reference past close() | Window.close() zeroes ptr; subsequent methods throw with clear message |

## Future (out of scope here)

- Phase 2: `amiga.doMethod()` for Reaction class dispatch → port the
  NDK 3.2R4 Examples (LED.c, Buttons.c, etc.)
- Phase 3: Hook callbacks (asm trampoline that lets a JS function
  receive register args) → ASL filter callbacks, Intuition input handlers
- Phase 4: Generate remaining 71 library wrappers from FD/autodoc
- Phase 5: Generate struct wrappers from C headers
- Phase 6: `quickjs-amiga.library` split — move FFI bytecode out of core
