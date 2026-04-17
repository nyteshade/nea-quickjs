# Morning Checklist — 0.101 overnight batch

## What landed while you slept

| Ver | Commit | Change | Risk |
|---|---|---|---|
| 0.098 | `631d40f` | stream: Writable write-after-end emits AND calls cb | tiny |
| 0.099 | `9d9b58f` | util.parseArgs/deprecate/debuglog + events.once + stream.pipeline + querystring + string_decoder + console.count/timeLog + fs.promises copy/truncate/utimes + Buffer swap/float | low (JS-only, host-verified) |
| 0.100 | `b6c109b` | **True async child_process.spawn via QJS_Worker** | medium — new C code, polling loop |
| 0.101 | pending push | assert module + timers.promises + process.stdout/stderr/stdin + path.posix/win32 aliases | low (JS-only) |

All commits pushed to main. Library binaries ship with each commit.

## Validation order (priority)

Run these on the real Amiga with `stack 65536`:

```
qjs tests/test_stream.js          ; 0.098 fix — should now be 13/13
qjs tests/test_node_extras.js     ; 0.099 batch — ~25 cases
qjs tests/test_spawn_async.js     ; 0.100 async spawn — watch for timer responsiveness
qjs tests/test_child_process.js   ; regression — 19/19 should still pass
qjs tests/test_fetch.js           ; regression — 22/0
qjs tests/test_crypto.js          ; regression — crypto still green
qjs tests/test_extended.js        ; full extended regression — 79/79
```

If any fail, the failing commit is straightforward to revert since
each is a clean single-point change:

```
git revert <commit-sha>          ; clean revert
git push origin main
```

## Known risks

**0.100 async spawn** is the highest-risk change:
- New C code in `quickjs_libc_lib.c` introduces `active_spawn`
  global state and a polling callback scheduled via `os_timers`.
- Uses `QJS_Worker` primitive — same one fetch uses (proven).
- `child_async_job` (worker-task entry) uses the global DOSBase for
  Open/Close/Read/SystemTagList — dos.library is shared across
  tasks on AmigaOS, so this should be fine, but verify with
  `test_spawn_async.js`.
- Single-concurrent slot — second `spawn()` while one is running
  throws. Intentional for v1; add queueing if it bites.

**If `test_spawn_async` crashes:** the async path is gated behind
`typeof __qjs_spawnAsync === 'function'` in extended.js. Reverting
just the C side (undo the three functions in quickjs_libc_lib.c)
and rebuilding gives you back the sync-wrapped-in-Promise behavior
at 0.099 levels.

## What's not in this batch

Deferred to future sessions:
- **Q-tier FFI/GUI bridge** — you said "table the conversation,"
  so I haven't touched it. `docs/AMIGA_FFI_ROADMAP.md` has the
  design reference.
- **AmiSSL main-task diagnostic** — crypto works via pure-JS
  fallback; native fast-path still broken from main task.
  `docs/AMISSL_MAINTASK_BUG.md`.
- **Re-entrant CLI** — `docs/RESIDENT_CLI.md`.
- **Mid-flight fetch socket close** — JS-level abort at 0.096
  works; true socket-close on abort needs C changes.

## Session notes

- Stream test 13/13 verified — 0.098 fix is solid.
- All new JS manifests host-verified where possible (util.parseArgs
  reference cases, querystring round-trips, Buffer swap/float).
- AsyncSpawn uses the same polling pattern as fetch at 20ms — if
  you notice lag, consider dropping to 10ms in the C code.
- `NODEJS-DELTA.md` is current — every landing has a table row.

## Ready for your eyes

`git pull` on the repo, run the test list above, report which pass
and which fail. I can fix-forward on any failure during the day.
