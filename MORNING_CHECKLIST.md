# Morning Checklist — 0.127 Q2 Wrapper-Class FFI Pilot

## TL;DR

**The Q2 wrapper-class layer is live.** End-user scripts no longer
need `amiga.call(intuition, I.lvo.CloseWindow, {a0: win})` or
`peek32(win + 86)` — they use `Intuition.OpenWindowTags(...)`,
`win.close()`, `for (let msg of win.messages())`. Five library
wrapper classes + 11 struct types, all under both `globalThis.X` and
`amiga.lib.X`.

## What landed

| Ver   | Commit         | What                                                     |
|-------|----------------|----------------------------------------------------------|
| 0.127 | (this batch)   | Q2 pilot — LibraryBase/CEnumeration/Struct + 5 lib wrappers + 11 structs + bundle script + ffi.c bytecode |

**Files added in `quickjs-master/amiga/ffi/`:**
- `LibraryBase.js`, `CEnumeration.js`, `ptrOf.js`
- `Exec.js`, `Dos.js`, `Intuition.js`, `Graphics.js`, `GadTools.js`
- `structs/Struct.js`, `Window.js`, `NewWindow.js`, `Screen.js`,
  `RastPort.js`, `MsgPort.js`, `IntuiMessage.js`, `TextAttr.js`,
  `Image.js`, `Gadget.js`, `TagItem.js`
- `index.js` (ES-module entry, sets up globals + amiga.lib)

**Files added elsewhere:**
- `scripts/bundle_ffi.py` — concatenates the .js sources into
  `quickjs-master/gen/ffi-bundle.js` for qjsc
- `quickjs-master/gen/ffi-bundle.js` — auto-generated bundle
- `quickjs-master/gen/ffi.c` — qjsc bytecode (30385 bytes)
- `amiga/tests/test_ffi_classes.js` — Q2 regression test
- `amiga/examples/frameidemo_classes.js` — frameidemo.js ported to
  the wrapper API, side-by-side with raw-FFI version
- 5 host tests in `amiga/tests/host/test_*.mjs` (Node-based,
  40/40 pass already)

**Files modified:**
- `quickjs-master/amiga/extended/vendor/ne-enumeration/enumeration.mjs`:
  added `static from(query)` (8 lines, no behavior change for
  existing users)
- `library/vbcc/qjsfuncs.c`: extern + js_std_eval_binary call for
  `qjsc_ffi` after `qjsc_extended`
- `library/vbcc/Makefile`: ffi.o build rule + linked into both FPU
  and SOFT variants
- `library/vbcc/libraryconfig.h`: 0.126 → 0.127 + $VER date
- `amiga/c/runtests`: runs new test_ffi_classes.js
- `amiga/examples/README.md`: row for frameidemo_classes.js

## Validation order on the Amiga

After `git pull` + library copy + reboot:

```
qjs tests/test_ffi_classes.js     # NEW — Q2 sections, expect ~30 pass
qjs tests/test_amiga_ffi.js       # 0.126 regression — expect 109/0
execute c/runtests                # full suite
qjs examples/frameidemo_classes.js  # interactive — opens a window
                                   # using the wrapper API
qjs examples/frameidemo.js          # raw-FFI version for comparison
```

`test_ffi_classes.js` sections:
1. classes present (~14 assertions)
2. LibraryBase lifecycle (~4)
3. Exec.AllocMem/FreeMem round-trip (~4)
4. CEnumeration.consts coercion + lookup (~5)
5. Intuition.OpenWindowTags + Window struct + close (~10)
6. NewWindow constructor + OpenWindow + close (~5)

Expected: ~42 pass, 0 fail.

If the bytecode evaluation fails, **all sections show "FATAL:
Q2 wrapper classes not installed"** — the script short-circuits at
top. That's a sign the qjsc_ffi bundle didn't load (check qjsfuncs.c
js_std_eval_binary call wasn't added cleanly, or the bytecode array
wasn't linked).

If individual sections fail (some pass, some don't), the wrapper
class shape is wrong somewhere. Each section is independent — read
the FAIL line for the specific assertion.

## Key risks

1. **Module-graph vs single-bundle qjsc behavior.** I'm bundling the
   .js sources via `scripts/bundle_ffi.py` so qjsc emits a single
   bytecode array. If `import`s ever leak into the bundle (script bug
   or missed file), qjsc will emit multiple arrays and the library's
   single `js_std_eval_binary` call won't load them. Defense: bundler
   strips all `import`/`export` and prepends `"use strict";`.

2. **Lazy library opens on Amiga.** `LibraryBase.ensureLibrary()`
   throws if `OpenLibrary` returns 0. If a wrapper method is invoked
   on a library that can't open (wrong version, missing), the user
   gets a clear `Error` instead of a cryptic crash.

3. **`globalThis.amiga.lib.Exec` late binding.** Window.messages()
   and several struct methods use `globalThis.amiga.lib.Exec` instead
   of an import to avoid circular module deps. If `amiga.lib.Exec`
   isn't populated by the time `messages()` is called, the iterator
   throws.

## Revert recipe

```bash
git revert <commit-sha>          # reverts JS, bundler, gen/ffi.c,
                                 # qjsfuncs.c hook, libraryconfig.h,
                                 # Makefile, libs, test, example
# Then rebuild library variants from 0.126 source.
```

## Not in this batch (future work)

- Auto-generation of remaining 71 library wrappers from FD/autodoc
- Auto-generation of struct wrapper classes from C headers
- DoMethod for Reaction class dispatch (NDK 3.2R4 LED.c, Buttons.c, etc)
- Hook callbacks (asm trampoline; ASL filter, Intuition input handlers)
- `quickjs-amiga.library` — split FFI bytecode out of core engine

## Session metadata

- **Start state:** `4784a43` (0.126 NDK FFI + examples directory)
- **End state:**   `(this commit)` (0.127 Q2 wrapper pilot)
- **Branch:** `main`
