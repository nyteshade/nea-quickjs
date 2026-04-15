# Worker API — native concurrency primitive for quickjs.library

## Status

Phase W1 design. Single source of truth for the native Worker LVO API that
replaces fetch's one-off `CreateNewProc` plumbing and becomes the foundation
for every future async/preemptive feature (child_process, async DNS,
crypto.subtle.digest on a worker, parallel compression, etc.).

## Goals

1. **Correct by construction**: every worker gets its own bsdsocket / AmiSSL /
   dos.library bases, opened and closed by the framework. A worker can never
   accidentally touch the main task's library bases.
2. **Concurrent**: N workers may run simultaneously. No single-slot
   handoff, no global "currently running" flag.
3. **Minimal surface**: five LVOs. Consumers write a worker job function
   and a completion handler — nothing else.
4. **Testable without JS**: the primitive is reachable from native C test
   programs so we can stress-test threading without dragging in the full
   QuickJS runtime, microtask pump, timer loop, or event loop.
5. **Tier-3**: this is the native substrate. A future JS-visible `Worker`
   class (`new Worker('script.js')`) is tier-1 on top of this and out of
   scope here.

## Non-goals (this phase)

- JS-facing `Worker` class with `postMessage` / `onmessage`. That needs a
  second `JSRuntime` per worker and a bytecode loader; it's a separate phase.
- Thread pools / work queues. Each `QJS_WorkerSpawn` creates one dedicated
  AmigaOS process. Consumers that want pooling build it on top.
- Cancellation of in-flight workers. Workers run to completion. (A
  cooperative `QJS_WorkerRequestAbort` may come later once we have real
  consumers that need it.)

## Why this shape

`fetch` today uses:

- One `static` function (`fetch_worker_entry`)
- One `volatile FetchContext *fc_pending_worker_ctx` global handoff slot
- The library's global `SocketBase` (opened in main task, used in worker — **broken**)

Any second consumer (child_process, async DNS) would either: (a) copy this
pattern and re-hit the per-task bsdsocket bug; (b) collide on the single
handoff slot with fetch; (c) touch the same global `SocketBase` and corrupt
fetch in flight. All three are bad. A proper primitive fixes all three at
once.

## The AmigaOS per-task library constraint

`bsdsocket.library` and `amissl.library` key their internal state off
`FindTask(NULL)`: errno, signal bit allocations, receiver state, SSL
handshake context. A base opened in task A and used from task B will:

- silently wait on signals delivered to task A,
- corrupt task A's errno,
- or return bogus data from `WaitSelect` / `recv`.

Symptom: `connect()` or `recv()` hangs forever in the worker, main task
polls reply-port forever, process looks wedged. This is precisely the bug
biting current fetch.

`dos.library` and `exec.library` are genuinely shareable across tasks, so
opening those in the main task and reusing in workers is fine.

## API surface

Five LVOs, added to `quickjs_lib.sfd` after existing entries:

```
QJS_WorkerSpawn(job_fn, user_data, flags)(a0/a1/d0)     -> a0 (Worker handle or NULL)
QJS_WorkerPoll(worker)(a0)                               -> d0 (WorkerState)
QJS_WorkerJoin(worker)(a0)                               -> d0 (int result, blocking)
QJS_WorkerDestroy(worker)(a0)                            -> void
QJS_WorkerGetBase(worker, which)(a0/d0)                  -> a0 (struct Library*)
```

Handle type: `QJSWorker *`, opaque to consumers. Allocated by spawn, freed
by destroy.

### WorkerState enum

```c
#define QJS_WORKER_PENDING   0   /* spawned, not yet running */
#define QJS_WORKER_RUNNING   1   /* job_fn executing */
#define QJS_WORKER_DONE      2   /* job_fn returned, result available */
#define QJS_WORKER_FAILED    3   /* spawn failed or worker crashed */
```

### WorkerBase selector (for QJS_WorkerGetBase)

```c
#define QJS_WORKER_BASE_SOCKET  0   /* bsdsocket.library */
#define QJS_WORKER_BASE_SSL     1   /* amissl.library */
#define QJS_WORKER_BASE_DOS     2   /* dos.library */
```

### Flags (for QJS_WorkerSpawn)

```c
#define QJS_WORKER_WANT_SOCKET  0x01  /* pre-open bsdsocket.library in worker */
#define QJS_WORKER_WANT_SSL     0x02  /* pre-open AmiSSL (implies SOCKET) */
#define QJS_WORKER_WANT_DOS     0x04  /* pre-open dos.library */
```

Consumers request only what they need — opening AmiSSL for a plain DNS
lookup is wasted time.

### Job function signature

```c
typedef int (*QJSWorkerJobFn)(QJSWorker *worker, void *user_data);
```

Job returns an int that becomes the result of `QJS_WorkerJoin`. Inside
the job, a worker retrieves its per-task bases via `QJS_WorkerGetBase` —
**never by reading the library's global SocketBase/AmiSSLBase**.

## Lifecycle

```
main task:   QJS_WorkerSpawn(fetch_job, ctx, WANT_SOCKET|WANT_SSL)
                  ↓
              [library allocates QJSWorker, reply MsgPort,
               then CreateNewProc → worker_entry_trampoline]
                  ↓
              QJSWorker* returned to main immediately
                  ↓
main task:   poll loop { QJS_WorkerPoll(w); if (DONE) break; sleep(20ms) }

worker task: worker_entry_trampoline
              ↓
              opens requested bases via OpenLibrary (in ITS OWN task)
              ↓
              calls job_fn(worker, user_data)
              ↓
              closes bases, PutMsg(reply_port), exits

main task:   QJS_WorkerJoin(w) → int result
             QJS_WorkerDestroy(w)  [frees handle, reply port]
```

## Concurrency model

- Each `QJS_WorkerSpawn` allocates an independent `QJSWorker` struct and
  an independent reply port.
- No global handoff slot. Spawn passes a pointer to the per-worker struct
  through the `NP_UserData` tag (or our own global keyed by signal bit,
  worst case).
- Main task can spawn multiple workers and poll each independently, or
  call `QJS_WorkerJoin` to block on a specific one.
- Workers never interact with each other or with the main task's globals.
  All cross-task communication is via the MsgPort + the `QJSWorker`
  struct's atomic status word.

## Memory model

- `QJSWorker` lives in `AllocMem`-style memory (exec MEMF_PUBLIC) so both
  tasks can read/write it.
- `user_data` pointer is consumer-owned. Framework does not copy, does
  not free. Consumer is responsible for lifetime (typically: allocate
  before spawn, free in the completion handler).
- Atomic status word accessed via simple aligned `ULONG` read/write.
  Motorola 68k aligned longword access is atomic; no locking needed for
  a single writer (worker) + single reader (main).

## Error modes

| Error | Detection | Handle value | State |
|-------|-----------|--------------|-------|
| `AllocMem` failure for QJSWorker | spawn | `NULL` | — |
| `CreateMsgPort` failure | spawn | `NULL` | — |
| `CreateNewProc` failure | spawn | `NULL` | — |
| Worker OpenLibrary failure | worker task | non-NULL | `FAILED` |
| Worker job function returns error | job_fn retval | non-NULL | `DONE` (consumer checks retval) |
| Worker task access fault / crash | — | leaked | stays `RUNNING` forever |

**Crash case is unrecoverable** without guru: AmigaOS has no equivalent
of "worker died, reap the zombie." Detection would require a watchdog
timer in main. For v1, we accept that a crashed worker handle leaks.
Stress test W3 will verify workers don't crash under normal usage.

## Interaction with QuickJS

The Worker primitive is **completely decoupled from JSRuntime/JSContext**.
It deals only in C function pointers and void pointers. This is deliberate:

- fetch's consumer code (`js_fetch`) allocates a C struct with the JS
  promise resolvers, pointer to JSContext, URL strings, etc. — hands
  that to `QJS_WorkerSpawn` as `user_data`.
- Worker job function runs entirely in C — no JS calls, no `ctx` usage
  from the worker task. JS APIs are not thread-safe.
- Completion path runs back in the main task: consumer's polling loop
  (using QuickJS os_timers) detects `QJS_WORKER_DONE`, calls
  `QJS_WorkerJoin`, then does `JS_Call(...)` to resolve the promise.

This keeps the JS engine single-threaded (which it must be) while allowing
preemptive OS-level work in the background.

## What the fetch consumer will look like (Phase W4 preview)

```c
/* In quickjs-libc.c, js_fetch side */
typedef struct {
    JSContext *ctx;
    JSValue resolving[2];
    char *url;
    char *method;
    /* ... */
    /* Worker-filled-in fields: */
    int status;
    char *body;
    size_t body_len;
    char *error;
} FetchJob;

static int fetch_job_fn(QJSWorker *w, void *ud)
{
    FetchJob *job = ud;
    struct Library *sb  = QJS_WorkerGetBase(w, QJS_WORKER_BASE_SOCKET);
    struct Library *ssl = job->is_https
                            ? QJS_WorkerGetBase(w, QJS_WORKER_BASE_SSL)
                            : NULL;
    /* DNS, connect, TLS, send, recv — all using sb/ssl, NOT globals */
    /* Fill job->status / job->body / job->error */
    return 0;
}

JSValue js_fetch(ctx, ...) {
    FetchJob *job = /* alloc + fill */;
    QJSWorker *w = QJS_WorkerSpawn(fetch_job_fn, job,
                                    QJS_WORKER_WANT_SOCKET |
                                    QJS_WORKER_WANT_SSL);
    /* schedule timer callback to poll w, resolve promise on DONE */
}
```

~50 lines replaces the current ~900 lines in `sharedlib_fetch.c`.

## Testing strategy (Phase W3 preview)

Native C test harness at `amiga/c/test_workers.c`, linked directly
against `quickjs.library` — **no QuickJS runtime involved**. Exercises:

1. **Isolation test**: spawn 10 workers, each does its own
   gethostbyname + socket + connect to a TCP echo server, sends a unique
   payload, receives echo. Verify each got its own data back (not another
   worker's).
2. **Duration shuffling**: spawn 5 workers with `Delay()` calls of
   250/50/150/50/300 ticks in that order. Verify poll sees them complete
   in order 50, 50, 150, 250, 300.
3. **Main responsiveness**: main task loop prints a dot every 10ms for
   5 seconds while 3 workers each do a 2-second sleep. Verify dots keep
   printing (main task never blocked).
4. **Failure injection**: worker job returns -1 on purpose; `QJS_WorkerJoin`
   returns -1; destroy still cleans up. Worker job calls
   `bad_ptr->field` (crash); consumer detects via timeout watchdog.
5. **Leak test**: 100 iterations of spawn/join/destroy; task count and
   open-library count return to baseline after each cycle.
6. **Concurrency scaling**: 1, 2, 5, 10, 25, 50 workers each doing a 100ms
   sleep. Record total wall time. Verify ~linear scaling (not N × 100ms).

Golden output committed under `amiga/tests/test_workers.output.txt`.
Runs under `make test-workers` target.

## Files this design covers

| File | Role |
|------|------|
| `include/amiga_worker.h` | Public C API header |
| `library/vbcc/sharedlib_worker.c` | Implementation |
| `library/vbcc/qjsfuncs_asm_all.s` | Trampolines |
| `library/vbcc/bridge_asm_libc.s` | Bridge wrappers for CLI / consumers |
| `library/vbcc/libraryconfig.h` | Prototypes + LIBRARY_FUNCTIONS |
| `library/vbcc/quickjs_lib.sfd` | LVO registration |
| `amiga/c/test_workers.c` | Native stress test |
| `amiga/tests/test_workers.output.txt` | Golden output |

## Design decisions (resolved)

1. **Signal bit allocation in worker**: each task gets its own `SIGB_*`
   pool. Worker calls `AllocSignal(-1)` on entry for its reply-port
   signal, `FreeSignal` before exit. Framework hides this from consumers.

2. **AmiSSL state is per-worker, NOT shared.** Each worker calls
   `SSL_CTX_new(TLS_client_method())` in its own task after opening its
   own `AmiSSLBase`. Sharing a main-task `SSL_CTX` across worker tasks
   is unsafe — AmiSSL's per-task library-base model extends to the
   SSL_CTX's internal state. Cost: few milliseconds per spawn for the
   handshake context setup. Acceptable — fetch latency is dominated by
   DNS + TLS handshake on the wire, not local context creation.

3. **Preemptive multitasking semantics**: `CreateNewProc` yields a real
   AmigaOS Process scheduled by `exec.library`'s preemptive round-robin
   scheduler. Multiple concurrent workers genuinely time-slice on the
   single CPU; I/O blocks suspend a worker without affecting others.
   `QJS_WorkerJoin` is a real kernel join via `WaitPort(reply_port)` —
   semantically equivalent to `pthread_join`: zero CPU while waiting,
   kernel wakes the joiner the instant the worker `PutMsg`'s completion.
   Not a busy-poll, not cooperative.

4. **Crash handling**: if a worker crashes before `PutMsg`, the joining
   task's `WaitPort` hangs forever. AmigaOS has no zombie-reap model.
   V1 accepts this — W3 stress tests will verify workers don't crash
   under normal usage. A future `QJS_WorkerJoinTimeout(worker, ticks)`
   LVO could add watchdog semantics if needed.

## References

- Commit 921ce68 (v0.65 "Async fetch() API") — original one-off worker plumbing
- `library/vbcc/sharedlib_fetch.c` — the code being obsoleted by this design
- Fina decision `decision:qp7wyp93qvzqhmpv7f4y` — rationale for building
  this primitive instead of band-aiding fetch
- Fina remember (bsdsocket per-task) — the root gotcha
