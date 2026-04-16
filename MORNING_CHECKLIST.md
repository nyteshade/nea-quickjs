# Morning checklist — 0.085 Amiga validation

Updated after your overnight-ish report. State:

## What you reported working at 0.083/0.084

- test_events: PASS
- test_fs: PASS
- test_net: PASS
- test_buffer: PASS
- test_timing: completed (no explicit pass/fail line in that test)

## Regressions found and fixed overnight

| Symptom | Root cause | Fix | Version |
| --- | --- | --- | --- |
| test_util hung after "format extra args ok" | `util.inspect` used regex `/^[A-Za-z_$][A-Za-z0-9_$]*$/` — `$` inside a char class hangs Amiga QuickJS-ng regex compiler | Plain-JS `isSafeIdent` + manual string-escape loop | 0.084 |
| test_extended hung at first `new URL(...)` | `URL._parse` used `s.search(/[/?#]/)` — `/` inside char class, same family of regex bug | Plain-JS `for` loop finding first `/`, `?`, `#` | 0.085 |

Both are systematic audits — scanned all regex literals in
`extended.js` for `/` or `$` inside char classes; the three
historically-problematic ones are all replaced now. No other
risky patterns remain.

## Still unexplained

- **test_fetch hangs.** Was 22/0 at 0.080. I did not change any
  library C code (sharedlib_fetch.c unchanged), only the
  `extended.js` bytecode. Something in the install path of the
  new D2/D3/D4 modules may be interacting badly with fetch.
  Running `qjs tests/test_fetch.js` — please capture EXACTLY
  what prints before the hang and paste it. Even a partial first
  line (e.g. "=== fetch() API Test Suite ===" printed but nothing
  after) is definitive.

## Copy to Amiga

- `amiga/libs/quickjs.020soft.library` → `LIBS:quickjs.library`
  (or matching variant)
- `amiga/c/qjs` (unchanged since 0.080 — CLI had no changes)

## Run these, all after `stack 65536`

### Step 1 — confirm fixes

```
qjs tests/test_util.js
qjs tests/test_extended.js
```

Expected:
- `test_util`      **35 pass / 0 fail**
- `test_extended`  runs all the way through the URL section without
  hanging. (Don't remember the exact pass count — whatever it
  reports is the new baseline.)

### Step 2 — capture fetch behavior

```
qjs tests/test_fetch.js 2>&1 > T:fetch-trace.txt
```

Let it run for up to 30 seconds, then Ctrl-C if it hangs. Paste
the contents of `T:fetch-trace.txt`. Three scenarios:

- **Prints nothing.** Hang before first banner. Probably in
  extended.js install OR in the import of qjs:std. I'll add
  a JS-side tracer around the install ordering.
- **Prints banner + some section headers, hangs mid-fetch.** The
  actual fetch() call is blocking on network I/O. Could be a
  network config issue, not our code.
- **Prints "22 passed, 0 failed".** Then it's not actually a
  regression — something about our session was flaky.

### Step 3 — full regression once fetch is resolved

```
execute tests/run-tests.script
```

Pull `RAM:qjs-results/` back and `scripts/check-tests.sh` on host.

## Build provenance

- Last commit: `790e7a5`
- Library: **0.085** (all 6 variants rebuilt)
- CLI: 75 KB, unchanged since 0.080
- extended.c bytecode: 41749 bytes

## Open items (tomorrow)

- Investigate test_fetch regression with real trace from Amiga
- D5 child_process (deferred; needs Worker LVO work)
- Re-entrant CLI for `Resident Add Pure` (deferred; `next-up` in Fina)
