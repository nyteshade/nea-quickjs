# Q1 Amiga FFI — Design Spec

**Status:** approved 2026-04-18 (brainstorming session).
**Library target:** 0.124.
**Source:** `docs/AMIGA_FFI_ROADMAP.md` (Q1 scope).

## Goal

Expose AmigaOS library calls directly from JS — `openLibrary`, `call`
with arbitrary register arguments, `peek`/`poke`, `allocMem`/`freeMem`,
`makeTags`. Users can author their own bindings for any Amiga library
without touching C or adding an LVO. This is the foundation the Q2
(Intuition window wrapper) and Q3 (GadTools GUI wrapper) sprints
build on.

## Non-goals

- No ergonomic `Window`/`Screen`/`RastPort` struct bindings — those are Q2.
- No drop-in NodeAmiga API compatibility — "inspired by" is the stance
  (option C from brainstorming). NodeAmiga-compat aliases can be added
  later if real scripts need them.
- No PPC-specific paths. 68k only for Q-tier.

## Architecture

Three layers, one sprint:

1. **ASM trampoline** — `library/vbcc/amiga_ffi_call.s`. Single function
   `_qjs_amiga_trampoline(lib, lvo, regs)` that loads d0-d3 + a0-a3
   from a struct, sets a6=lib, does `jsr 0(a6, d4.l)` where d4=lvo,
   returns d0. No per-signature variants.
2. **C surface** — `library/vbcc/amiga_ffi.c`. Thin wrappers around the
   trampoline + direct exec.library calls for peek/poke/alloc. All
   exported via one new LVO `QJS_InstallAmigaFFIGlobal` that installs
   `globalThis.__qjs_amiga_*` natives.
3. **JS surface** — new `amiga-ffi` manifest in
   `quickjs-master/amiga/extended/extended.js`. Builds `globalThis.amiga`
   with method wrappers + the LVO constant table. Registered in the
   0.122 `require()` stub so `const amiga = require('amiga')` works.

## Register struct layout

Shared between JS marshalling and the asm trampoline:

```c
struct AmigaRegs {
    ULONG d0, d1, d2, d3;   /* offset  0,  4,  8, 12 */
    APTR  a0, a1, a2, a3;   /* offset 16, 20, 24, 28 */
};
```

Total 32 bytes. JS `{d0: 37, a0: ptr}` marshalled into this; missing
fields default to 0.

## The ASM trampoline

```
    section .text,code
    xdef    _qjs_amiga_trampoline

_qjs_amiga_trampoline:
    link    a5,#0
    movem.l d2-d7/a2-a6,-(sp)    ; save callee-saved

    move.l  16(a5),a0            ; a0 = regs ptr (temp)
    move.l   0(a0),d0
    move.l   4(a0),d1
    move.l   8(a0),d2
    move.l  12(a0),d3
    movea.l 20(a0),a1
    movea.l 24(a0),a2
    movea.l 28(a0),a3
    movea.l 16(a0),a0            ; a0 = regs.a0 (load last)

    movea.l  8(a5),a6            ; a6 = lib base
    move.l  12(a5),d4            ; d4 = lvo
    jsr      0(a6,d4.l)          ; call lib function

    movem.l (sp)+,d2-d7/a2-a6
    unlk    a5
    rts
```

Key design properties:
- No use of `__reg()` at the C level — entirely sidesteps the VBCC
  `__reg("a6")` frame-pointer clobber issue documented in
  `feedback_vbcc_a6_lvo.md`.
- A0 loaded last (after its temp use for `regs`).
- D4 chosen for LVO index; both D4 and a1-a3 are callee-saved and
  restored by the MOVEM at exit.
- Static code in `.text` — no `CacheClearE` needed (unlike runtime
  codegen).
- `jsr 0(a6, d4.l)` is brief-format indexed addressing, valid on all
  68000+ CPUs.

## C surface

Native-to-JS functions installed by `QJS_InstallAmigaFFIGlobal`:

| Global | Args (from JS) | Returns |
|---|---|---|
| `__qjs_amiga_openLibrary(name, ver)` | str, int | Number (lib ptr) or 0 |
| `__qjs_amiga_closeLibrary(lib)` | int | undefined |
| `__qjs_amiga_call(lib, lvo, regs)` | int, int, obj | Number (d0) |
| `__qjs_amiga_peek8/16/32(addr)` | int | Number |
| `__qjs_amiga_poke8/16/32(addr, val)` | int, int | undefined |
| `__qjs_amiga_peekString(addr, maxLen)` | int, int | String |
| `__qjs_amiga_pokeString(addr, str)` | int, str | Number (bytes written, incl NUL) |
| `__qjs_amiga_allocMem(size, flags)` | int, int | Number (ptr) or 0 |
| `__qjs_amiga_freeMem(ptr, size)` | int, int | undefined |
| `__qjs_amiga_makeTags(pairs)` | arr of [int,int] | Number (TagItem ptr) |

## JS surface

`globalThis.amiga`:

```js
amiga.openLibrary(name, version=0)
amiga.closeLibrary(lib)
amiga.call(lib, lvo, regs)                    // regs = {d0, d1, d2, d3, a0, a1, a2, a3}
amiga.peek8(addr) / peek16(addr) / peek32(addr)
amiga.poke8(addr, v) / poke16(addr, v) / poke32(addr, v)
amiga.peekString(addr, maxLen=4096)
amiga.pokeString(addr, str)
amiga.allocMem(size, flags=amiga.MEMF_PUBLIC|amiga.MEMF_CLEAR)
amiga.freeMem(ptr, size)
amiga.makeTags([[tag, data], [tag, data], ...])
amiga.withTags(pairs, fn)                     // auto-frees when fn returns/throws

// Constants
amiga.MEMF_PUBLIC, amiga.MEMF_CLEAR, amiga.MEMF_FAST, amiga.MEMF_CHIP
amiga.TAG_DONE = 0, amiga.TAG_END = 0, amiga.TAG_IGNORE = 1, amiga.TAG_MORE = 2, amiga.TAG_SKIP = 3
amiga.TAG_USER = 0x80000000

// LVO tables (~150 constants total, from NDK 3.2 FD files)
amiga.lvo.exec      = { OpenLibrary: -552, CloseLibrary: -414, ... }
amiga.lvo.dos       = { Output: -60, Input: -54, Write: -48, Read: -42, ... }
amiga.lvo.intuition = { OpenWindow: -204, CloseWindow: -72, OpenScreen: -198, ... }
amiga.lvo.graphics  = { SetAPen: -342, Move: -240, Draw: -246, ... }
amiga.lvo.gadtools  = { CreateContext: -30, CreateGadget: -42, FreeGadgets: -18, ... }

// Common Intuition/GadTools tag constants (selected — not exhaustive)
amiga.tags.WA_Left, WA_Top, WA_Width, WA_Height, WA_Title, WA_IDCMP, WA_Flags, ...
amiga.tags.SA_Left, SA_Top, SA_Width, SA_Depth, SA_Title, ...
amiga.tags.GT_Underscore, GTCB_Checked, GTLV_Selected, ...
```

### Registered in require() stub

0.122's `require()` resolver gets a new entry:

```js
case 'amiga':        return globalThis.amiga;
case 'node:amiga':   return globalThis.amiga;   /* node: prefix for symmetry */
```

## Error handling

- JS-level validation (wrong arg types, NaN addresses): throw `TypeError`.
- `openLibrary` returns 0 on failure — standard exec convention. JS
  wrapper preserves that (no exception).
- `allocMem` returns 0 on failure. Same.
- `peek*`/`poke*` on bad addresses: Amiga-standard — the machine
  crashes. **Documented, not preventable.** This is explicit power-user
  territory (see roadmap motivation).
- `call` with invalid `lib` handle: same — crashes the machine.

## Testing strategy

New file `amiga/tests/test_amiga_ffi.js`. Sections (each in resilient
`run(title, async fn)` blocks per the overnight pattern):

1. **Module surface** — every `amiga.*` function exists, typeof check.
2. **Constants** — MEMF_*, TAG_*, every LVO in every library is a
   negative number divisible by 6.
3. **Memory round-trip** — `allocMem(16) → non-zero`, `poke8/16/32`
   then `peek8/16/32` verify values match, `freeMem`.
4. **String round-trip** — `allocMem(64)`, `pokeString(ptr, "hello")`,
   `peekString(ptr)` returns "hello", `freeMem`.
5. **OpenLibrary round-trip** — open `dos.library` version 0, verify
   non-zero handle, close it.
6. **Generic call via trampoline** — call `dos.Output()` through
   `amiga.call(doslib, amiga.lvo.dos.Output, {})` — should return a
   valid BPTR to standard output. Sanity-check it's non-zero.
7. **Per-library reachability** — for each of intuition/graphics/
   gadtools/exec: open, call one innocuous LVO (e.g. graphics.GfxBase
   version check, intuition.LockIBase/UnlockIBase round-trip if safe,
   gadtools.CreateContext + FreeContext), close.
8. **makeTags** — build a 3-pair tag array, verify memory layout
   matches `{ti_Tag, ti_Data, ..., TAG_DONE}` via peek, freeMem.
9. **withTags** — auto-free verification: alloc tracked by count
   before/after.

Not tested (Q2 territory):
- Actual `intuition.OpenWindow` — requires NewWindow struct setup
  which crosses into Q2 wrapper scope.
- Graphics drawing — requires live RastPort; deferred to Q2 after
  Intuition wrappers.

## Phasing (implementation order for the session)

1. Spec + plan docs (this + plan).
2. `amiga_ffi_call.s` — asm trampoline, standalone.
3. `amiga_ffi.c` — all native wrappers.
4. `libraryconfig.h` — add `QJS_InstallAmigaFFIGlobal` prototype +
   table entry.
5. `Makefile` — add asm + C to object list.
6. Extended.js `amiga-ffi` manifest with full 150-LVO table + JS
   wrappers + require() stub entry.
7. Regen bytecode.
8. Rebuild library variants (per stored procedure).
9. Verify $VER on all variants.
10. Write `test_amiga_ffi.js`.
11. Commit + push.
12. Update MORNING_CHECKLIST.

## Risk and mitigation

| Risk | Mitigation |
|---|---|
| ASM trampoline wrong → Amiga crash | Carefully reviewed asm, minimal instructions, save-all strategy. Test starts with primitives that don't touch asm (peek/poke/alloc) so those paths ship even if asm is broken. |
| Wrong LVO number in table | NDK 3.2 FD files are the authoritative source. Verified mechanically during generation. Individual wrong LVOs don't affect other LVOs. |
| Library init fails after new LVO added | Add new LVO at END of LIBRARY_FUNCTIONS table so existing indices don't shift. lib_Version stays 1 (0.123 already was 1) — no OpenLibrary-version-gate breakage. |
| User's tests hit a real crash on Amiga | Feature is gated: `typeof __qjs_amiga_openLibrary === 'function'` in manifest; if natives didn't install, `globalThis.amiga` simply doesn't exist. Existing tests continue to pass. |
