# Deferred: true async child_process.spawn

## Summary

`globalThis.child_process.spawn()` currently returns a Promise for API
shape but executes synchronously — the calling task blocks until
`SystemTagList` returns. True async (non-blocking) spawn needs to use
the existing `QJS_Worker*` primitive with event-loop polling, matching
how `fetch()` works.

## Design (when implemented)

Two layers:

### C side — new natives
| Native | Signature | Purpose |
|---|---|---|
| `__qjs_spawnWorker(cmdline)` | → Number (handle) | Allocates ChildContext, spawns worker via `QJS_WorkerSpawn`. Worker runs `SystemTagList`, collects stdout/stderr/exit. Returns opaque handle (pointer as Number). |
| `__qjs_workerPoll(handle)` | → `-1 \| {done:bool}` | Wraps `QJS_WorkerPoll`. Returns -1 if still running; otherwise returns status. |
| `__qjs_workerGetOutput(handle)` | → `{stdout, stderr, exitCode}` | Reads from ChildContext once poll says done. |
| `__qjs_workerDestroy(handle)` | → void | Frees ChildContext, destroys worker. |

All four installed as globals by a new LVO `QJS_InstallWorkerGlobals` (or
bundled into `QJS_InstallChildProcessGlobal`'s existing installation).

### JS side — polling promise

In `extended.js` child-process manifest:

```js
function spawnAsync(cmdline) {
    const handle = __qjs_spawnWorker(cmdline);
    return new Promise((resolve, reject) => {
        const poll = () => {
            const r = __qjs_workerPoll(handle);
            if (r === -1) { setTimeout(poll, 20); return; }  // still running
            const output = __qjs_workerGetOutput(handle);
            __qjs_workerDestroy(handle);
            resolve(output);
        };
        setTimeout(poll, 0);
    });
}
```

Replaces the current `spawn()` which sync-wraps `spawnSync`.

### Worker entry (C)

```c
static long child_worker_job(QJSWorker *w, void *user) {
    ChildContext *cctx = user;
    BPTR outfh, errfh;
    // ... same as current js_child_process_spawnSync logic
    cctx->done = 1;
    return 0;
}
```

Main difference from the sync path: output collection happens inside the
worker task instead of inline, then `main` polls for completion.

## Tradeoffs

**Why not do it now:**
- The sync spawn already works for 90% of use cases (run build, get
  output, check exit code).
- ~60-90 minutes of focused C + asm + JS work.
- Needs new LVOs which adds permanent API surface.
- Event-loop polling at 20ms granularity adds minimum 20ms latency.

**Why do it eventually:**
- Node-accurate spawn (once streams tier settles) needs async to expose
  `.stdin`/`.stdout` as live streams.
- Long-running build commands benefit from non-blocking main task
  (REPL stays responsive).
- Enables fire-and-forget pattern: `child_process.spawn('build', []);
  return immediately`.

## Related

- Commit `8e24ac9` — D5 sync child_process landed
- docs/NODEJS-DELTA.md — `child_process.spawn` marked ◐ with this caveat
- Fina: next-up,child_process,async-spawn
