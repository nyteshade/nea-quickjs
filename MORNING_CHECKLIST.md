# Morning Checklist — 0.124 Q1 Amiga FFI

## TL;DR

**One commit, one feature, 11 new APIs + 150 LVOs, pushed to `main`.**
Amiga native FFI is live: JS can now open any AmigaOS library and call
its functions with register-level arg dispatch. Foundation for the
NodeAmiga-style Intuition/GUI wrappers (Q2/Q3).

## What landed

| Ver   | Commit    | What                                                                                           | Risk                                                    |
|-------|-----------|------------------------------------------------------------------------------------------------|---------------------------------------------------------|
| 0.124 | `2437488` | Q1 FFI: openLibrary/call/peek/poke/allocMem/makeTags + 150 LVOs from NDK 3.2                    | **MEDIUM** — new C + hand-written m68k asm + register-level calls |

New surface on `globalThis.amiga`:

- `openLibrary(name, ver=0)` / `closeLibrary(lib)`
- `call(lib, lvo, regs)` — generic m68k dispatch (the asm trampoline)
- `peek8/16/32(addr)` / `poke8/16/32(addr, val)`
- `peekString(addr, maxLen?)` / `pokeString(addr, str)`
- `allocMem(size, flags?)` / `freeMem(ptr, size)`
- `makeTags(pairs)` / `withTags(pairs, fn)`
- `amiga.lvo.{exec, dos, intuition, graphics, gadtools}` — 150 LVO constants
- `amiga.MEMF_*`, `amiga.TAG_*`, `amiga.tags.{WA_*, SA_*, IDCMP_*, WFLG_*}` — 30+ common constants
- `require('amiga')` / `require('node:amiga')` now resolves to `globalThis.amiga`

## The highest-risk piece

`library/vbcc/amiga_ffi_call.s` — a single hand-written m68k trampoline
that loads 8 registers from a struct, sets a6=lib, does `jsr 0(a6, d4.l)`,
then restores and returns d0. If it's correct, every library call works;
if it's subtly wrong, the first call that tries to reach the trampoline
will crash.

This is **gated behind the feature check** in the `amiga-ffi` manifest:
`if (typeof __qjs_amiga_openLibrary !== 'function') return;`. So on a
library that doesn't expose the native, `globalThis.amiga` simply isn't
installed and existing code keeps working.

## Validation order (priority)

On the Amiga with `stack 65536`:

```
qjs tests/test_amiga_ffi.js        ; THE big one — 9 sections, ~50 assertions
qjs tests/test_node_overnight.js   ; 241/0 regression — must still pass
qjs tests/test_extended.js         ; 79/0 regression
qjs tests/test_fetch.js            ; 22/0 regression
qjs tests/test_crypto.js           ; 23/0 regression
execute c/runtests                 ; everything batched
```

Expected `test_amiga_ffi.output` breakdown:
- Sections 1–5 (module surface, LVO table integrity, memory round-trip,
  string round-trip, openLibrary round-trip) should all pass if the C
  side is correct — no asm involved.
- Section 6 (**generic trampoline via exec.AllocMem/FreeMem**) is the
  critical asm test. If this passes, the trampoline is correct.
- Sections 7–10 (dos.Output, per-library reachability, makeTags,
  withTags) depend on section 6 working.

Approximate expected pass count: **~50/0**. If section 6 fails or
crashes, sections 7–10 will also fail/crash and the others stay clean.

## If it crashes on `amiga.call`

The asm trampoline is in `library/vbcc/amiga_ffi_call.s`. The most
likely culprits (in descending likelihood):
1. Wrong struct offsets — the C code assumes `struct AmigaRegs`
   layout matches the asm's `0/4/8/12/16/20/24/28` byte offsets.
   Check VBCC struct packing.
2. LVO sign convention — asm uses `jsr 0(a6, d4.l)` which requires
   negative d4 as 32-bit signed. Verify with a single `printf-style`
   trace before the jsr.
3. Callee-saved regs missed — if the library function clobbers D5/D6/D7
   and we didn't save them, we have corruption after the call. The
   MOVEM `d2-d7/a2-a6` should cover it.

Revert recipe if needed:

```
git revert 2437488          ; single-point revert
git push origin main
```

The revert undoes everything including the bytecode regen and the
library binaries. The 0.123 state is the clean rollback point.

## If `amiga.call` works but one LVO is wrong

LVO constants came from NDK 3.2 FD files via a mechanical parser.
Individual typos in the JS table are possible but don't affect any
other LVO. Cross-reference against `sdks/NDK3.2R4/FD/<lib>_lib.fd`.

## Not in this batch

- **Q2 Intuition wrapper** (`intuition.openWindow({...})`) — needs
  struct bindings for Window/Screen/NewWindow/IntuiMessage. Deferred;
  Q1 alone lets users write their own bindings.
- **Q3 GadTools GUI** (`gui.createWindow`/`gadgets`) — deferred; Q1 +
  Q2 prereqs.
- **Pre-bed menu leftovers** (Ctrl-C/Ctrl-D kill JSVM, mid-flight fetch
  abort diagnostic, AmiSSL main-task init, etc.) — untouched.

## Session metadata

- **Start state:** `f300c80` (0.123 File NUL-strip fix + test resilience)
- **End state:**   `2437488` (0.124 Q1 FFI)
- **Commits:** 1 (large batch — C + asm + JS + test + docs together)
- **Files changed:** 21 (5 new + 16 modified)
- **Branch:** `main`, pushed

## Ready for your eyes

1. `git pull` on the Amiga. Copy `amiga/libs/quickjs.*.library` to `LIBS:`.
2. Reboot or `avail flush` (lib_Version was 1, didn't bump — but the
   bytecode changed substantially, so reboot is safest).
3. `cd amiga && execute c/runtests`.
4. Report pass/fail on `test_amiga_ffi.output` and any regressions elsewhere.
