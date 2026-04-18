# Morning Checklist — 0.112 → 0.122 overnight Node-parity batch

## TL;DR

**11 commits, all pushed to `main`, all pure-JS, all host-verified
(239/239 on the new regression test).** Each is a self-contained
manifest addition or extension in `quickjs-master/amiga/extended/
extended.js`, so any single version can be reverted with `git revert
<sha>` without disturbing the others.

## What landed while you slept

| Ver   | Commit    | What changed                                                                     | Risk                              |
|-------|-----------|----------------------------------------------------------------------------------|-----------------------------------|
| 0.112 | `7575e67` | `performance` global; `process.uptime()`; `process.memoryUsage()` (zero stub)    | tiny (pure JS over `os.now()`)    |
| 0.113 | `5d6bd32` | `globalThis.url` node module; `URL.parse()` static (Node 22)                     | tiny (pure JS)                    |
| 0.114 | `951fb8c` | `util.types` long tail + `util.styleText` + `util.stripVTControlCharacters`      | tiny (pure JS)                    |
| 0.115 | `f330fb3` | `assert.ifError` + AssertionError class + `assert.fail(a,e,m,op)` 4-arg          | tiny                              |
| 0.116 | `b89b04e` | **Blob + File** (WHATWG, Uint8Array-backed)                                      | low (self-contained)              |
| 0.117 | `0e69b4c` | **FormData** (WHATWG, Blob-aware)                                                | low (depends on 0.116)            |
| 0.118 | `3614c51` | **fs sync namespace** (readFileSync/writeFileSync/statSync/...)                  | **medium** — real disk I/O        |
| 0.119 | `b4f1592` | **events.on async iterator** + `globalThis.events` module                        | low                               |
| 0.120 | `0d53b31` | **EventTarget + Event + CustomEvent** base classes (AbortSignal left untouched)  | low                               |
| 0.121 | `0979930` | **readline** + `readline/promises` + ANSI cursor helpers                         | **medium** — uses `std.in.getline` |
| 0.122 | `ad74dd9` | **`nodeOs`** + CommonJS `require()` stub (20+ built-ins)                         | tiny                              |

Total new Node surface: roughly **70+ new APIs** across 11 modules. Library
bytecode grew ~20 KB (from 68 KB to ~88 KB).

## Validation order (priority)

Run these on the real Amiga with the usual `stack 65536` invocation:

```
qjs tests/test_node_overnight.js   ; THE big one — all 239 overnight cases
qjs tests/test_node_extras.js      ; 0.099 regression — should still pass
qjs tests/test_stream.js           ; 0.098 fix regression
qjs tests/test_events.js           ; EE regression — MUST still pass
qjs tests/test_util.js             ; util regression — types additions
qjs tests/test_buffer.js           ; buffer regression — unchanged
qjs tests/test_fs.js               ; fs regression — plus fs sync additions
qjs tests/test_assert_timers.js    ; assert regression — ifError added
qjs tests/test_child_process.js    ; 19/19 — unchanged
qjs tests/test_crypto.js           ; unchanged
qjs tests/test_fetch.js            ; 22/0 — unchanged
qjs tests/test_fetch_signal.js     ; 2/0 — unchanged
qjs tests/test_fetch_abort.js      ; 2/0 pre-abort — unchanged
qjs tests/test_regex.js            ; 27/27 — unchanged
qjs tests/test_extended.js         ; full extended regression
```

If any fail, the reverts are clean single-point:

```
git revert <sha>          # then regenerate bytecode + rebuild library
git push origin main
```

## Highest-risk item: 0.121 readline (`std.in.getline`)

`std.in.getline()` blocks until a newline arrives from stdin. On host
qjs this reads from terminal stdin. On Amiga this reads from the
console window attached to the shell running qjs. **If no stdin is
connected (e.g. running under WB `Execute`), `rl.question()` may
block forever.** The fix if this bites: gate the manifest behind
`os.isatty(0)` and return a dummy Interface when stdin is not a TTY.

Tests for readline use a **fake input object** (`{getline: () =>
'yes'}`) so host-side CI passes without any actual stdin wiring.
Real interactive behavior is untested — the first actual user of
`rl.question()` on Amiga is the smoke test.

## Medium-risk item: 0.118 fs sync

Performs real disk I/O through `std.open`/`os.stat`/`os.remove`/
`os.rename`. These primitives are **already exercised** by
`fs.promises`, so the risk is mostly I/O edge cases that the sync
wrappers hit differently (buffer sizes, newline handling in text
mode). Tests use `T:qjs-fs-sync-test` on Amiga — always mounted on
any Workbench install, no requester, same pattern as the 0.090 D5
`test_child_process.js` refactor.

## Not in this batch

- **Mid-flight fetch abort** — still hung; open-issue since 0.111.
- **Ctrl-C twice / Ctrl-D kill-JSVM feature** — you asked for this
  at the 0.111 checkpoint; deferred because it needs native signal
  handling.
- **Q-tier FFI / GUI bridge** — untouched per prior tabling.
- **AmiSSL main-task diagnostic** — unchanged; pure-JS crypto
  fallback still covers users without AmiSSL.
- **True streaming child_process stdio** — still needs stream tier
  hardening (backpressure) first.
- **WHATWG streams** (ReadableStream / WritableStream / TransformStream)
  — Blob's `.stream()` intentionally absent because of this.
- **`dns` module** — needs a native `gethostbyname` binding; skipped
  to keep the batch pure-JS.
- **`zlib` module** — out of scope; needs miniz or xpk.library work.

## Files touched

Every commit modifies these five files and nothing else:

- `quickjs-master/amiga/extended/extended.js` (the JS)
- `quickjs-master/gen/extended.c` (the regenerated bytecode)
- `library/vbcc/libraryconfig.h` (version bump + date)
- `docs/NODEJS-DELTA.md` (table update)
- `amiga/tests/test_node_overnight.js` (new regression test)

No C code touched, no new LVOs, no `.sfd` changes, no Makefile
changes. The library rebuild picks up the new bytecode via the
existing `extended.o` rule in `library/vbcc/Makefile`.

## Ready for your eyes

`git pull`, rebuild the library variants with the usual:

```
VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH make -C library/vbcc variants
VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH make -C library/vbcc -f Makefile.cli
```

Copy `amiga/libs/quickjs.*.library` to `LIBS:` on the Amiga, then
run the test list above. Report pass/fail per file and I'll fix
forward.

## Session metadata

- **Start state**: `ced3f49` (0.111 fetch+AbortSignal careful-retry arc).
- **End state**:   `ad74dd9` (0.122 os + require).
- **Commits**:     11.
- **Host tests**:  239/239 (new `test_node_overnight.js`).
- **Branch**:      `main` (all pushed — pending you running `git pull`).
