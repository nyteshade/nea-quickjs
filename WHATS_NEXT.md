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
   with partition `nea-quickjs` and query `"handoff next steps Worker fetch
   current state"`. This returns the session's latest decisions, milestones,
   and gotchas.

3. **Pull the handoff memories** with
   `mcp__fina__query_knowledge(partition="nea-quickjs", query="HANDOFF 2026-04-15")`.
   Look for memories tagged `handoff`, `next-steps`, `priority`, `scope`,
   `decisions`, `gotchas`. These capture the state at the end of the
   previous session (W1–W4 landed, fetch validated 22/0 on real Amiga).

4. **Check task list** with `TaskList`. The phase labels (W5/W6/W7, D1-D5,
   E1-E3, F1-F3, G1-G2, B1a/B2, C1/C2) are durable across sessions and
   link to Fina decisions. Do NOT rewrite the task list from scratch — it
   exists and is current.

5. **Skim recent git log**: `git log --oneline -10`. Last commits will tell
   you what landed; most recent at time of writing is `d0adb4c` (flushlibs
   AmiSSL update).

6. **Read `docs/WORKER_API.md`** if the task involves threading or async.
   It is the design spec for the native concurrency primitive that fetch
   and future async features consume.

The user has asked me to prefer Fina over re-reading code or restating
context in this file. Treat the above as the authoritative playbook.

---

## CURRENT STATE (snapshot at session end, 2026-04-15)

- **Library version:** `0.075` packed-decimal (major=0, revision=075)
- **Last commit on main:** `d0adb4c` (flushlibs AmiSSL update), pushed
- **Last Amiga validation:**
  - `test_workers`: **59/0 pass** (Worker primitive stress test)
  - `test_fetch.js`: **22/0 pass** (HTTP, HTTPS, JSON, 404, ArrayBuffer, etc.)
- **Build:** all 6 variants clean. `VBCC=$HOME/vbcc make -C library/vbcc variants`
- **Push policy:** commit freely, push only after validated on real Amiga.
  See `~/.claude/projects/-Volumes-Code-Amiga-nea-quickjs/memory/feedback_push_policy.md`.

### Phase W status (this arc)

| Phase | Status | Notes |
|-------|--------|-------|
| W1 Design | ✓ | `docs/WORKER_API.md` |
| W2 Impl  | ✓ | `library/vbcc/sharedlib_worker.c` — 5 LVOs |
| W3 Stress test | ✓ | `amiga/c/test_workers` |
| W4 fetch rewrite | ✓ | 913 → 750 lines in `sharedlib_fetch.c` |
| **W5** regression suite | pending (#57) |
| **W6** autodoc | pending (#58) |
| **W7** net capability probe | pending (#59) |

---

## YOUR NEXT ACTION — recommended priority

**Do Phase W7 first.** Reasons:

1. Fixes fetch UX when networking libs are missing (currently fetch fails
   inside a worker with an opaque error; should throw synchronously at
   the JS layer with a clear message).
2. Makes `quickjs.library` load unconditionally even without bsdsocket or
   AmiSSL installed — which is needed to diagnose the A1200 ADF failure
   the user reported (pre-W7 we don't know if the library load itself
   depends on those).
3. Small scope, well-specified, unblocks the A1200 investigation.

**W7 scope** (full detail in Fina: `query_knowledge("nea-quickjs", "PHASE W7 SCOPE")`):

- In `CustomLibInit` (library/vbcc/qjsfuncs.c), probe
  `OpenLibrary("bsdsocket.library", 4)` and `OpenLibrary("amisslmaster.library",
  AMISSLMASTER_MIN_VERSION)` once at load time. Set `QJSLibBase->qjs_net_caps`
  bits (`QJS_NET_TCP=0x01`, `QJS_NET_TLS=0x02`). Close the probes.
  Print a one-line warning to stdout if a cap is missing, but DO NOT fail
  library load — user must still be able to run `qjs -e 'print(1+1)'`
  on a system without any networking.
- Add field `ULONG qjs_net_caps` to the library base struct in
  `library/vbcc/libraryconfig.h` (the `LIBRARY_BASE_TYPE` / `struct QJSLibBase`
  definition).
- Add new LVO `QJS_GetNetCapabilities() -> ULONG`:
  - SFD entry in `library/vbcc/quickjs_lib.sfd`
  - Prototype + LIBRARY_FUNCTIONS entry in `libraryconfig.h`
  - xdef + trampoline in `qjsfuncs_asm_all.s`
  - impl in `qjsfuncs.c`: `return base->qjs_net_caps;`
- Add JS module `qjs:net` in `library/vbcc/quickjs_libc_lib.c` (or wherever
  the other `qjs:*` modules are registered). Exposes:
  - `Networking.hasTCP()` → boolean
  - `Networking.hasTLS()` → boolean
  - `Networking.status()` → `{ tcp: bool, tls: bool }`
  - `Networking.reprobe()` → re-run the library opens, returns new status
- In `quickjs-master/quickjs-libc.c`'s `js_fetch`, check the caps BEFORE
  calling `fetch_create`. If URL is https:// and TLS bit is 0, throw
  `JS_ThrowTypeError(ctx, "networking unavailable: amisslmaster.library not installed")`.
  Same for http:// and TCP bit.
- `Networking.reprobe()` implementation: re-open the same libraries,
  update the caps bits, return the new status object. This lets users
  install AmiSSL while qjs is running and recover without restart.

**After W7 lands and passes a test run on Amiga**, immediately investigate
the A1200 ADF failure. Per `mcp__fina__query_knowledge("nea-quickjs",
"A1200 ADF")` there are several theories:
- (a) File truncation on ADF write — verify MD5 match
- (b) 4MB fast fragmentation — library is ~1MB, needs contiguous
- (c) KickStart version mismatch — check what ROM the A1200 has
- (d) Serial debug output would pinpoint

With W7 done, option (a) is not a networking-lib issue. That alone is
a useful result.

---

## PHASE ORDERING after W7

Order (my opinion, user agrees broadly):

1. **W7** (as above)
2. **A1200 investigation** (small, unblocks floppy-distribution story)
3. **W5** — regression suite wired into variants build. Add
   `make test-workers` / `make test-fetch` targets. Capture golden
   outputs. Requires amiberry or equivalent for CI. Low urgency but
   high value before D-series phases that'll consume the Worker primitive.
4. **W6** — autodoc the Worker API and add an architecture diagram.
   Useful for contributors; not blocking anything.
5. **D1-D5** (Tier 2 Node APIs): Buffer, EventEmitter, util, fs.promises,
   child_process. **D5 (child_process) is the second real consumer of the
   Worker primitive** and will stress-test the API's generality. Expect
   to find places where Worker's surface is too narrow — that's the point.
6. **E1-E3** (crypto bridges): subtle.digest via AmiSSL, getRandomValues,
   AbortSignal threaded into fetch. E1 will reveal whether the per-worker
   AmiSSL init flow extends cleanly to non-network uses.
7. **B1a, B2, C1, C2** — module system work (fix module-resolution guru,
   add core-module registry, runtime plugin scan, native qjs-*.library
   plugins). Can be done in parallel with D/E phases if someone else
   is driving those.
8. **F1-F3, G1-G2** — docs + examples + comprehensive test suite. End-game.
9. **A2b, A3b, F2b** — vendor ne-basic-extensions. User said this is
   bottom-of-list and needs a pre-pass from them first.

---

## HARD-WON GOTCHAS (do not re-learn)

All recorded in Fina with tags `gotcha,amiga`. Summary so you know what
to query for:

1. **Never hand-type LVO offsets.** Always copy from working code
   (`library/vbcc/amiga_ssl_lib.c` has bsdsocket + AmiSSL offsets used in
   production) or from `.fd` files in `sdks/`. Offset-mismatch silently
   invokes the wrong function — `connect` at `-36` is actually `bind`,
   `bind(remote_ip)` returns EADDRNOTAVAIL (errno 49), and you'll chase
   misleading errors for hours. Already cost 2 cycles this session.
2. **bsdsocket.library is per-task.** Every task that does sockets must
   `OpenLibrary("bsdsocket.library", 4)` itself. Don't share a base
   across tasks — socket calls hang or return garbage errno.
3. **AmiSSL tag IDs are `(TAG_USER + small_offset)`**, NOT
   `(TAG_USER_BASE + 0x8X)` — see
   `sdks/AmiSSL-v5.26-SDK/Developer/include/amissl/tags.h`.
4. **AmigaOS `sockaddr_in` requires `sin_len`** set to
   `sizeof(struct sockaddr_in)` (= 16). Missing → EADDRNOTAVAIL on
   `connect()`.
5. **AmigaOS `hostent`'s `h_addrtype`/`h_length` are `LONG`** (32-bit),
   not `short`. Hand-rolled struct stubs using `short` silently return
   wrong `h_length` → "Unsupported address type" error.
6. **`tc_UserData` collides with `bsdsocket.library` per-task stash.**
   If you use `tc_UserData` for atomic handoff (as the Worker framework
   does), the worker MUST zero it immediately after reading, or
   `OpenLibrary("bsdsocket.library", 4)` in that task fails opaquely.

---

## BUILD RECIPE (verbatim)

```bash
# All 6 library variants
VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH make -C library/vbcc variants

# CLI (68020 fpu)
VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH make -C library/vbcc -f Makefile.cli

# Native stress test
VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH make -C library/vbcc -f Makefile.test_workers

# flushlibs utility
VBCC=$HOME/vbcc PATH=$HOME/vbcc/bin:$PATH make -C library/vbcc -f Makefile.flushlibs

# Sanity: every variant's $VER
for v in 020fpu 020soft 040fpu 040soft 060fpu 060soft; do \
  printf "%-10s " "$v"; \
  strings amiga/libs/quickjs.$v.library | grep "VER.*quickjs" | head -1; \
done
```

Expected: all show `quickjs.XXX.library 0.075 (15.4.2026)` (or newer revision).

---

## VERSIONING REMINDER

Packed-decimal: `lib_Version = major * 1000 + revision`. Current is 75.
Every rebuild-that-changes-bytes:
1. Bump `LIBRARY_VERSION` by 1 in `library/vbcc/libraryconfig.h`
2. Update the revision in `LIBRARY_VERSION_STRING` (e.g. `0.076`)
3. Update the date in `LIBRARY_VERSION_STRING` if it changed

The Makefile now lists `libraryconfig.h` as a dependency of `library.o`
(both FPU and soft variants), so version bumps always trigger a rebuild.

---

## AMIGA TEST RECIPE (user does this)

User's workflow (verified 2026-04-15):

```
copy amiga/libs/quickjs.020soft.library libs:quickjs.library
amiga/c/flushlibs
avail flush
amiga/c/qjs tests/test_fetch.js
amiga/c/test_workers
```

Expected output for both test binaries above should be all-pass.

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

---

## THE FINA-HOOK BUG (NOT YOUR PROBLEM)

The Claude Code session-start hook calls `resolve_context(cwd)` expecting
a partition name. For this project it returns `null`, so the status line
shows `partition:none`. I tried every plausible `metadata.*` key via
`update_partition` (path, paths, directories, cwd, root, prefix,
base_path, match, cwd_prefix, workspace, pwd, scope_paths); none made
`resolve_context` match. The registration mechanism isn't exposed via
MCP — it's somewhere else (CLI tool not on $PATH, config file, or
internal DB). User is restarting the session to see if this resolves
itself. If it doesn't, they'll ping the Fina author; meanwhile every
write this session explicitly passed `partition="nea-quickjs"` so the
graph is accumulating correctly regardless of the status-line display.

You do NOT need to solve this. Just continue passing `partition="nea-quickjs"`
explicitly on every write.

---

## ONE MORE THING

If a tool call returns empty or a dubious result, check Fina before
assuming the code is right. The graph has a milestone for every fix
in this session and will tell you whether something was intentional
or a fresh regression. `query_project_context("recent changes")`
or `get_timeline` both work.

Good luck. The Worker primitive is solid and proven. Build on it.
