# Morning checklist — 0.083 Amiga validation

This file describes exactly what to test tomorrow morning on the
higher-spec Amiga. Work completed overnight: D2 EventEmitter, D3 util,
D4 fs.promises (all pure-JS, no engine/library C changes beyond the
`extended.js` bytecode rebuild).

## Copy to Amiga

- `amiga/libs/quickjs.020soft.library` → `LIBS:quickjs.library`
  (if you want a variant other than 020soft, copy that file instead)
- `amiga/c/qjs` → wherever you run it
- All files in `amiga/tests/` that match `test_*.js` — 7 files total

## Prerequisites

- `stack 65536` before every `qjs` invocation (the CLI checks this
  and will refuse to start otherwise)
- `T:` assigned and writable — required for `test_fs.js`. On stock
  AmigaOS this is usually `assign T: RAM:T` in startup-sequence. If
  `T:` isn't set, test_fs will cleanly report missing-path failures
  but won't hang.

## Step 1 — sanity: everything that worked before still works

```
qjs tests/test_workers.js    ; only if test_workers exists as JS; otherwise c/test_workers
c/test_workers               ; native C worker stress test
qjs tests/test_fetch.js
qjs tests/test_net.js
qjs tests/test_buffer.js
```

Expected outputs (no change from 0.082):

- `test_workers`  —  **59 passed, 0 failed**
- `test_fetch`    —  **22 passed, 0 failed**
- `test_net`      —  **8 pass / 0 fail**
- `test_buffer`   —  **60 pass / 0 fail**

If ANY of these regress from its baseline, stop and tell me. That
means the extended.js expansion broke something that used to work
(unlikely but the safe default response).

## Step 2 — new D-tier validation

```
qjs tests/test_events.js
qjs tests/test_util.js
qjs tests/test_fs.js
```

Expected:

- `test_events`   —  **19 pass / 0 fail**   (host baseline 19/0)
- `test_util`     —  **35 pass / 0 fail**   (host baseline 35/0)
- `test_fs`       —  **13-18 pass / 0 fail** (depends on which `os.*`
  APIs exist — readdir/mkdir may be missing on Amiga build and would
  cleanly degrade to ENOSYS; the PASS line is what matters)

`test_fs` is the least predictable because it touches `T:`. If
T: isn't assigned, expect several PASSes for the API-shape tests
and FAILs for the actual I/O. That's fine — it just means I need
to look at what `std.open` returns for missing assigns.

## Step 3 — full regression suite

```
stack 65536
execute tests/run-tests.script
```

That script now runs [1]–[7] and writes per-test output to
`RAM:qjs-results/`. Pull the whole directory back and run on the
host:

```
scripts/check-tests.sh path/to/results/
```

It'll either say "All regression tests match golden output." or
name the first mismatch. Either answer is useful.

## What to paste back if anything fails

1. The full output of the failing test (`RAM:qjs-results/test_X.txt`).
2. Which line it last printed if it hung.
3. Whether `T:` is assigned and writable (for fs issues only).

## What's NOT done

- D5 **child_process** — needs Worker primitive integration on the
  library side. Deferred to a dedicated session; recorded in Fina
  with tag `next-up`.
- Re-entrant CLI for `Resident C:QJS Add Pure` — also recorded in
  Fina, tag `next-up`. Nice-to-have, not blocking anything.

## Build provenance

- Host pass: test_buffer 60/0, test_events 19/0, test_util 35/0
- Last commit: `ee104d8`
- All six library variants built at **0.083**; CLI unchanged at 75 KB
- `extended.c` bytecode: 41516 bytes (was 32460 at 0.082)
