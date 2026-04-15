/* amiga_worker.h — Native Worker primitive for quickjs.library
 *
 * See docs/WORKER_API.md for the full design spec.
 *
 * Summary: creates preemptive AmigaOS Processes with automatic per-task
 * bsdsocket.library / AmiSSL / dos.library base management. Safe to use
 * concurrently (no global handoff slot). Used by fetch(), will be used
 * by child_process, crypto.subtle.digest, async DNS, etc.
 *
 * The API is pure C — no JSContext or JSRuntime dependencies — so the
 * primitive can be stress-tested without the QuickJS runtime.
 */

#ifndef AMIGA_WORKER_H
#define AMIGA_WORKER_H

#include <exec/types.h>
#include <exec/libraries.h>

/* Opaque handle */
typedef struct QJSWorker QJSWorker;

/* State returned by QJS_WorkerPoll */
#define QJS_WORKER_PENDING   0   /* spawned, not yet running */
#define QJS_WORKER_RUNNING   1   /* job_fn executing */
#define QJS_WORKER_DONE      2   /* job_fn returned, result available */
#define QJS_WORKER_FAILED    3   /* spawn failed or worker crashed */

/* Base selectors for QJS_WorkerGetBase */
#define QJS_WORKER_BASE_SOCKET  0   /* bsdsocket.library */
#define QJS_WORKER_BASE_SSL     1   /* amissl.library */
#define QJS_WORKER_BASE_DOS     2   /* dos.library */

/* Flags for QJS_WorkerSpawn — requests which bases to pre-open in the
 * worker task. Consumers request only what they need. */
#define QJS_WORKER_WANT_SOCKET  0x01
#define QJS_WORKER_WANT_SSL     0x02   /* implies SOCKET */
#define QJS_WORKER_WANT_DOS     0x04

/* Worker job function signature.
 *
 * Runs in the worker's own AmigaOS task. MUST NOT touch the main
 * task's globals (no JSContext, no library SocketBase, etc.).
 * Retrieve per-task library bases via QJS_WorkerGetBase.
 *
 * Return value becomes the int result of QJS_WorkerJoin.
 */
typedef int (*QJSWorkerJobFn)(QJSWorker *worker, void *user_data);

/* API surface — these map to LVOs in quickjs.library.
 * When called through the library, the real signatures include a
 * __reg("a6") LIBRARY_BASE_TYPE *base first parameter. The trampoline
 * layer hides that from consumers. */

#ifdef __cplusplus
extern "C" {
#endif

/* Spawn a worker. Returns a handle or NULL on spawn failure.
 * The worker begins running immediately (preemptively scheduled by exec).
 * Caller owns user_data lifetime. */
QJSWorker *QJS_WorkerSpawn_impl(QJSWorkerJobFn job_fn,
                                void *user_data,
                                unsigned long flags);

/* Non-blocking state check. Returns one of QJS_WORKER_* constants. */
long QJS_WorkerPoll_impl(QJSWorker *worker);

/* Blocking join via kernel WaitPort. Returns job_fn's int result on
 * success, -1 on spawn/worker error. Equivalent to pthread_join. */
long QJS_WorkerJoin_impl(QJSWorker *worker);

/* Free the handle. Safe to call after Join. If called before Join
 * (i.e. worker still RUNNING), this is undefined behavior — the
 * worker task will try to write to freed memory. Consumers must
 * either Join or confirm DONE/FAILED via Poll before Destroy. */
void QJS_WorkerDestroy_impl(QJSWorker *worker);

/* Retrieve a per-worker library base (the one opened by the framework
 * inside the worker task). Called from inside job_fn. Returns NULL if
 * the base wasn't requested via flags or failed to open. */
struct Library *QJS_WorkerGetBase_impl(QJSWorker *worker, unsigned long which);

#ifdef __cplusplus
}
#endif

#endif /* AMIGA_WORKER_H */
