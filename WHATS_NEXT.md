# WHATS_NEXT.md — Cold-restart handoff for Claude

This file is written for a future Claude Code session to pick up mid-project
without context loss. Format is dense and optimized for the LLM, not for
human readability. The human user (Brielle / "brie") will read the code and
test on real Amiga; they don't need this file to be polished.

---

## STEP ZERO — BEFORE YOU DO ANYTHING

**Fina is the canonical state store for this project.** Everything below is
a shallow pointer into it. On session start, do this in order:

1. **Check that Fina is reachable.** `mcp__fina__get_status`. If the MCP
   server is down, stop and tell the user — nothing below works without it.

2. **Query project context from Fina** using `mcp__fina__query_project_context`
   with partition `nea-quickjs` and query `"handoff next steps D-tier fetch
   regression current state 0.085"`. This returns the session's latest
   decisions, milestones, and gotchas.

3. **Pull the handoff memories** with
   `mcp__fina__query_knowledge(partition="nea-quickjs", query="HANDOFF 2026-04-16")`.
   Look for memories tagged `handoff`, `next-steps`, `priority`, `scope`,
   `decisions`, `gotchas`. These capture the state at the end of the
   previous session.

4. **Skim recent git log**: `git log --oneline -15`. Last commits will tell
   you what landed; most recent at time of writing is `968332d`.

5. **Read `docs/WORKER_API.md`** if the task involves threading or async.
   It is the design spec for the native concurrency primitive that fetch
   and future async features consume.

6. **Read `docs/TESTING.md`** for the regression suite flow: how to run
   tests, how goldens work, how to add new tests.

The user has asked me to prefer Fina over re-reading code or restating
context in this file. Treat the above as the authoritative playbook.

---

## CURRENT STATE (snapshot at session end, 2026-04-16)

- **Library version:** `0.085` packed-decimal (major=0, revision=085)
- **Last commit on main:** `968332d`, pushed
- **Last Amiga validation (higher-spec machine, not stock A1200):**
  - `test_workers`: **59/0 pass** (native C Worker stress test)
  - `test_fetch.js`: **HANGS** — was 22/0 at 0.080; REGRESSION since 0.083
  - `test_net.js`: **8/0 pass**
  - `test_buffer.js`: **60/0 pass** (Node Buffer subset)
  - `test_events.js`: **19/0 pass** (EventEmitter)
  - `test_util.js`: **35/0 pass** (expected after 0.084 regex fix)
  - `test_fs.js`: **pass** (fs.promises over qjs:os)
  - `test_extended.js`: **hangs at URL** at 0.083; expected fixed at 0.085
- **Build:** all 6 variants clean. `VBCC=$HOME/vbcc make -C library/vbcc variants`
- **CLI:** 75KB softfloat build, no FPU required. Stack check at 64KB.
- **Push policy:** commit freely, push only after validated on real Amiga.
  See `~/.claude/projects/-Volumes-Code-Amiga-nea-quickjs/memory/feedback_push_policy.md`.

---

## CRITICAL OPEN BUG — test_fetch regression

test_fetch.js was 22/0 at library 0.080. It hangs since 0.083. No
library C code changed between 0.080 and 0.085 — only `extended.js`
bytecode grew (21KB → 42KB) from adding D1-D4 modules. The fetch
C implementation (`library/vbcc/sharedlib_fetch.c`) is byte-identical.

**What's needed:** User must run `qjs tests/test_fetch.js` and report
what (if anything) prints before the hang. Possible outcomes:

- Nothing prints → hang is in `extended.js` install path (startup).
  Try `qjs --no-extensions tests/test_fetch.js` (the `-nox` flag skips
  `bridge_InstallExtended`). If fetch works with `-nox`, one of the
  D2/D3/D4 install functions is the trigger.
- Banner prints, hangs mid-fetch → network config issue, not our code.
- 22/0 pass → flaky session, no regression.

If `-nox` fixes it, bisect by commenting out individual LocalManifest
`_manifests.push(...)` blocks in `extended.js` until the offender is found.

---

## PHASE STATUS

### Worker arc (W) — COMPLETE ✓

| Phase | Status | Notes |
|-------|--------|-------|
| W1 Design | ✓ | `docs/WORKER_API.md` |
| W2 Impl  | ✓ | `library/vbcc/sharedlib_worker.c` — 5 LVOs |
| W3 Stress test | ✓ | `amiga/c/test_workers` 59/0 |
| W4 fetch rewrite | ✓ | 913 → 750 lines in `sharedlib_fetch.c` |
| W5 regression suite | ✓ | `amiga/tests/run-tests.script` + goldens + `scripts/check-tests.sh` |
| W6 autodoc | ✓ | 8 entries in `amiga/docs/quickjs.doc` + architecture diagram in `docs/WORKER_API.md` |
| W7 net capability probe | ✓ | `qjs:net` module, `QJS_GetNetCapabilities` LVO, fetch pre-check |

### A1200 arc — COMPLETE ✓

| Fix | Version | Notes |
|-----|---------|-------|
| Softfloat CLI | 0.078 | `-lmieee`, `QJS_GetMathBase` LVO, `cli_math_globals.c` |
| Stack check | 0.079 | 64KB minimum, clear error message |
| Symbol.for via C API | 0.079 | `JS_NewSymbol(ctx, "qjs.inspect", 1)` instead of `JS_Eval` |
| REPL ttyGetWinSize timeout | 0.080 | `WaitForChar(fh, 250000L)` for stock 3.0 CON |
| Pool/vec magic split | 0.077 | Defense-in-depth, `AA_MAGIC_POOL` / `AA_MAGIC_VEC` |

### D-tier Node APIs — IN PROGRESS

| Phase | Status | Notes |
|-------|--------|-------|
| **D1 Buffer** | ✓ 0.082 | Pure-JS extending Uint8Array, 60/0 on Amiga |
| **D2 EventEmitter** | ✓ 0.083 | on/once/off/emit + meta-events, 19/0 host (Amiga pending confirmation at 0.085) |
| **D3 util** | ✓ 0.084 | format/inspect/promisify/callbackify/types, 35/0 host |
| **D4 fs.promises** | ✓ 0.083 | readFile/writeFile/stat/unlink via std.open, Amiga pass |
| **D5 child_process** | pending | Second real Worker consumer. Needs library-side LVO work. |

### Regex audit — COMPLETE ✓

Three Amiga QuickJS-ng regex bugs found and fixed. Pattern: unescaped
`/` or `$` inside a regex character class `[...]` hangs the regex
compiler. All replaced with plain-JS char-loop filters. Full audit
confirmed no remaining risky patterns in `extended.js`.

1. Buffer base64: `/[^A-Za-z0-9+/=]/g` → `base64Clean()` (0.082)
2. util isSafeIdent: `/^[A-Za-z_$][A-Za-z0-9_$]*$/` → `isSafeIdent()` (0.084)
3. URL._parse: `/[/?#]/` → inline `for` loop (0.085)

---

## YOUR NEXT ACTION — recommended priority

1. **Fix test_fetch regression.** Get the user's trace output, then
   bisect with `-nox` flag. Most likely one of the D2/D3/D4 install
   functions interacts with something fetch depends on. Small scope,
   critical for green regression suite.

2. **D5 child_process.** Second real Worker consumer. Needs:
   - New JS module `qjs:child_process` (or globalThis.child_process)
   - Library-side: Worker primitive spawns a system command, captures
     stdout/stderr, returns exit code
   - JS API: `spawn(cmd, args, opts)` returning a promise
   - Tests: `test_child_process.js`
   - This will stress-test the Worker primitive's generality.

3. **E1-E3 (crypto bridges):** `crypto.subtle.digest` via AmiSSL,
   `getRandomValues`, `AbortSignal` threaded into fetch.

4. **B1a-C2 (module system):** Fix module-resolution guru, core-module
   registry, runtime plugin scan, native `qjs-*.library` plugins.

5. **Re-entrant CLI** for `Resident C:QJS Add Pure` — recorded in Fina
   with tag `next-up`. Needs all CLI globals (QJSBase, MathIeeeDoub*Base)
   moved to task-local storage.

---

## HARD-WON GOTCHAS (do not re-learn)

All recorded in Fina with tags `gotcha,amiga`. Summary:

1. **Never hand-type LVO offsets.** Copy from working code or `.fd` files.
2. **bsdsocket.library is per-task.** Every task opens its own.
3. **AmiSSL tag IDs are `(TAG_USER + small_offset)`**, not `0x8X`.
4. **AmigaOS `sockaddr_in` requires `sin_len`** = 16.
5. **AmigaOS `hostent` h_addrtype/h_length are LONG** (32-bit), not short.
6. **`tc_UserData` collides with bsdsocket per-task stash.** Zero after read.
7. **Stack overflow causes AN_IntrMem** ($81000005). 64KB minimum for qjs.
   Alloca in the bytecode interpreter (lines 6234, 6358, 17238, 17349,
   17502 in quickjs.c) consumes task stack.
8. **Regex with `/` or `$` inside char class hangs Amiga QuickJS-ng.**
   Always use plain-JS char loops for patterns containing those chars.
   Audit complete — see Fina tag `regex,audit-complete`.
9. **Math libraries not resident on Amiga.** Must be in LIBS: on disk.
10. **ttyGetWinSize CSI query hangs on stock Kickstart 3.0 CON handler.**
    WaitForChar with 250ms timeout before each Read byte.
11. **Golden test patterns: ALWAYS sample real output first.** Never guess
    the text format. Process lesson from W5 golden mismatch.

---

## BUILD RECIPE (verbatim)

```bash
# All 6 library variants
VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH make -C library/vbcc variants

# CLI (softfloat, no FPU needed)
VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH make -C library/vbcc -f Makefile.cli

# Regenerate extended.js bytecode (after editing extended.js)
./quickjs-master/build/qjsc -ss -m -N qjsc_extended \
    -o quickjs-master/gen/extended.c \
    quickjs-master/amiga/extended/extended.js

# Run regression suite on macOS
make check RESULTS=amiga/output/

# Sanity: every variant's $VER
for v in 020fpu 020soft 040fpu 040soft 060fpu 060soft; do \
  printf "%-10s " "$v"; \
  strings amiga/libs/quickjs.$v.library | grep "VER.*quickjs" | head -1; \
done
```

---

## VERSIONING REMINDER

Packed-decimal: `lib_Version = major * 1000 + R`. Current is 85.
Every rebuild-that-changes-bytes:
1. Bump `LIBRARY_VERSION` by 1 in `library/vbcc/libraryconfig.h`
2. Update the revision in `LIBRARY_VERSION_STRING` (e.g. `0.086`)
3. Update the date in `LIBRARY_VERSION_STRING` if it changed
4. Update `AMIGA_PORT_VERSION` in `quickjs-master/qjs.c` if a release

---

## AMIGA TEST RECIPE (user does this)

```
stack 65536
execute tests/run-tests.script
```

Results go to `RAM:qjs-results/`. Pull back and:
```
scripts/check-tests.sh path/to/results/
```

---

## FINA WRITE DISCIPLINE

Always write to `nea-quickjs` partition, never `global`. Every meaningful
action should produce a Fina entry:

- Design decision → `record_decision` with rationale + alternatives
- Bug fix → `record_milestone` with kind=bugfix
- New feature → `record_milestone` with kind=feature
- Non-obvious fact learned → `remember` with `tags: "gotcha"`
- Session wrap-up → `record_milestone` summarizing what happened

When in doubt, use `remember`. The graph stays richer that way.
