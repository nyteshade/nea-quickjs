/*
 * test_workers.c — Native stress test for the QJS_Worker* primitive.
 *
 * Runs on AmigaOS, links directly against quickjs.library. DOES NOT
 * use the QuickJS runtime — this tests the native threading substrate
 * in isolation, before anything is built on top of it.
 *
 * Categories (per docs/WORKER_API.md § Testing strategy):
 *   1. Isolation        — concurrent workers have independent state.
 *   2. Durations        — completion order ≠ start order.
 *   3. Main responsive  — main task keeps running during long workers.
 *   4. Failure modes    — worker returns error; Join/Destroy still clean.
 *   5. Leak             — 100 spawn/join/destroy cycles, no resource leak.
 *   6. Scaling          — N parallel workers; wall time < N × duration.
 *
 * Build: library/vbcc/Makefile.test_workers
 * Run  : amiga/c/test_workers   (on Amiga/amiberry)
 *
 * Exit code: 0 on all-pass, non-zero on any failure.
 */

#include <exec/types.h>
#include <exec/libraries.h>
#include <exec/tasks.h>
#include <dos/dos.h>
#include <proto/exec.h>
#include <proto/dos.h>

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/* ================================================================
 * Worker primitive — minimal LVO stubs duplicating the library's API.
 * Offsets must match the order in library/vbcc/libraryconfig.h's
 * LIBRARY_FUNCTIONS macro.
 *
 * Base = 0x1e (30) for the reserved library vectors; each user LVO
 * is 6 bytes. InstallExtended is the last pre-Worker LVO at -1146,
 * so Worker entries start at -1152.
 * ================================================================ */
#define LVO_QJS_WorkerSpawn     -1152
#define LVO_QJS_WorkerPoll      -1158
#define LVO_QJS_WorkerJoin      -1164
#define LVO_QJS_WorkerDestroy   -1170
#define LVO_QJS_WorkerGetBase   -1176

/* State + flags — keep synced with include/amiga_worker.h */
#define QJS_WORKER_PENDING   0
#define QJS_WORKER_RUNNING   1
#define QJS_WORKER_DONE      2
#define QJS_WORKER_FAILED    3

#define QJS_WORKER_WANT_SOCKET  0x01
#define QJS_WORKER_WANT_SSL     0x02
#define QJS_WORKER_WANT_DOS     0x04

#define QJS_WORKER_BASE_SOCKET  0
#define QJS_WORKER_BASE_SSL     1
#define QJS_WORKER_BASE_DOS     2

typedef struct QJSWorker QJSWorker;
typedef int (*QJSWorkerJobFn)(QJSWorker *worker, void *user_data);

static struct Library *QJSBase = NULL;

static QJSWorker *__tw_WorkerSpawn(__reg("a6") struct Library *base,
                                   __reg("a0") QJSWorkerJobFn fn,
                                   __reg("a1") void *ud,
                                   __reg("d0") unsigned long flags)
    = "\tjsr\t-1152(a6)";
#define QJS_WorkerSpawn(fn, ud, fl) __tw_WorkerSpawn(QJSBase, (fn), (ud), (fl))

static long __tw_WorkerPoll(__reg("a6") struct Library *base,
                            __reg("a0") QJSWorker *w)
    = "\tjsr\t-1158(a6)";
#define QJS_WorkerPoll(w) __tw_WorkerPoll(QJSBase, (w))

static long __tw_WorkerJoin(__reg("a6") struct Library *base,
                            __reg("a0") QJSWorker *w)
    = "\tjsr\t-1164(a6)";
#define QJS_WorkerJoin(w) __tw_WorkerJoin(QJSBase, (w))

static void __tw_WorkerDestroy(__reg("a6") struct Library *base,
                               __reg("a0") QJSWorker *w)
    = "\tjsr\t-1170(a6)";
#define QJS_WorkerDestroy(w) __tw_WorkerDestroy(QJSBase, (w))

static struct Library *__tw_WorkerGetBase(__reg("a6") struct Library *base,
                                          __reg("a0") QJSWorker *w,
                                          __reg("d0") unsigned long which)
    = "\tjsr\t-1176(a6)";
#define QJS_WorkerGetBase(w, which) __tw_WorkerGetBase(QJSBase, (w), (which))

/* ================================================================
 * Test framework — simple pass/fail tallies, per-test banners.
 * ================================================================ */
static int total_pass = 0, total_fail = 0;

#define CHECK(cond, msg) do {                           \
    if (cond) { total_pass++; }                         \
    else {                                              \
        total_fail++;                                   \
        printf("  FAIL: %s  (line %d)\n", msg, __LINE__); \
    }                                                   \
} while (0)

#define BANNER(t) do {                                  \
    printf("\n=== Test %d: %s ===\n", t, #t);           \
} while (0)

/* ================================================================
 * Helpers
 * ================================================================ */
static void poll_until_done(QJSWorker *w)
{
    long s;
    while (1) {
        s = QJS_WorkerPoll(w);
        if (s == QJS_WORKER_DONE || s == QJS_WORKER_FAILED) return;
        Delay(1); /* 1 tick = 20ms, gives workers time to run */
    }
}

/* AmigaOS tick count: 50 ticks/sec on PAL, 60 on NTSC. Use
 * DateStamp() for millisecond-ish accuracy if needed, but for
 * coarse timing Delay/tick counts are enough here. */
static unsigned long ms_since(struct DateStamp *start)
{
    struct DateStamp now;
    long dmin, dtick;
    DateStamp(&now);
    dmin  = (now.ds_Minute - start->ds_Minute);
    dtick = (now.ds_Tick   - start->ds_Tick);
    return (unsigned long)(dmin * 60 * 1000 + dtick * 20); /* 1 tick = 20ms */
}

/* ================================================================
 * Test 1: ISOLATION
 *
 * Spawn 5 workers concurrently. Each writes its own per-worker data
 * into user_data, including FindTask(NULL). Verify:
 *   - all 5 have DIFFERENT task pointers (real preemptive tasks)
 *   - each worker's result matches the input it was given (no swap)
 * ================================================================ */
struct IsolationJob {
    int     my_id;         /* unique per worker */
    struct  Task *my_task; /* worker fills in */
    int     result;        /* worker computes from my_id */
};

static int isolation_job(QJSWorker *w, void *ud)
{
    struct IsolationJob *j = ud;
    (void)w;
    j->my_task = FindTask(NULL);
    /* Brief sleep so workers are actually concurrent, not
     * serially started-then-completed. */
    Delay(5);
    j->result = j->my_id * 7 + 3; /* arbitrary deterministic fn */
    return 0;
}

static void test_isolation(void)
{
    QJSWorker *w[5];
    struct IsolationJob jobs[5];
    int i, j;
    int unique = 1;

    BANNER(1);

    for (i = 0; i < 5; i++) {
        jobs[i].my_id = i;
        jobs[i].my_task = NULL;
        jobs[i].result = -1;
        w[i] = QJS_WorkerSpawn(isolation_job, &jobs[i], 0);
        CHECK(w[i] != NULL, "spawn");
    }

    for (i = 0; i < 5; i++) {
        long rc = QJS_WorkerJoin(w[i]);
        CHECK(rc == 0, "join returns 0");
        CHECK(QJS_WorkerPoll(w[i]) == QJS_WORKER_DONE, "state is DONE");
        CHECK(jobs[i].result == i * 7 + 3, "result matches input");
        CHECK(jobs[i].my_task != NULL, "worker's Task pointer captured");
    }

    /* All worker tasks must be distinct AmigaOS tasks (genuine preemption). */
    for (i = 0; i < 5; i++) {
        for (j = i + 1; j < 5; j++) {
            if (jobs[i].my_task == jobs[j].my_task) unique = 0;
        }
    }
    CHECK(unique, "all 5 worker tasks are distinct (real preemption)");

    for (i = 0; i < 5; i++) QJS_WorkerDestroy(w[i]);
}

/* ================================================================
 * Test 2: DURATIONS — completion order ≠ start order
 *
 * Spawn 5 workers with sleep durations [10, 3, 7, 1, 5] ticks in
 * that order. Record completion order. Expect: 4, 2, 5, 3, 1
 * (shortest first).
 * ================================================================ */
struct DurationJob {
    int  sleep_ticks;
    long start_ms;
    long completion_order;  /* 1..5, set by main on completion */
    struct DateStamp start_ds;
};

static int duration_job(QJSWorker *w, void *ud)
{
    struct DurationJob *j = ud;
    (void)w;
    Delay(j->sleep_ticks);
    return 0;
}

static void test_durations(void)
{
    QJSWorker *w[5];
    struct DurationJob jobs[5];
    int ticks[5] = {10, 3, 7, 1, 5};
    int expected_order[5] = {4, 2, 5, 3, 1};  /* 1-based worker IDs */
    int i, k, next_order = 1;

    BANNER(2);

    for (i = 0; i < 5; i++) {
        jobs[i].sleep_ticks = ticks[i];
        jobs[i].completion_order = 0;
        w[i] = QJS_WorkerSpawn(duration_job, &jobs[i], 0);
        CHECK(w[i] != NULL, "spawn");
    }

    /* Poll until all done; record completion order. */
    while (next_order <= 5) {
        int found = 0;
        for (i = 0; i < 5; i++) {
            if (jobs[i].completion_order == 0 &&
                QJS_WorkerPoll(w[i]) == QJS_WORKER_DONE) {
                jobs[i].completion_order = next_order++;
                found = 1;
            }
        }
        if (!found) Delay(1);
    }

    /* Print observed order */
    printf("  observed order: ");
    for (k = 1; k <= 5; k++) {
        for (i = 0; i < 5; i++) {
            if (jobs[i].completion_order == k) {
                printf("%d ", i + 1);
                break;
            }
        }
    }
    printf("  expected: 4 2 5 3 1\n");

    for (k = 1; k <= 5; k++) {
        int observed = -1;
        for (i = 0; i < 5; i++) {
            if (jobs[i].completion_order == k) { observed = i + 1; break; }
        }
        CHECK(observed == expected_order[k-1],
              "completion order matches shortest-first");
    }

    for (i = 0; i < 5; i++) {
        QJS_WorkerJoin(w[i]);
        QJS_WorkerDestroy(w[i]);
    }
}

/* ================================================================
 * Test 3: MAIN RESPONSIVE — main task keeps working during long workers
 *
 * Spawn 3 workers each sleeping 100 ticks (~2 seconds). Main task
 * increments a counter every tick for 100 ticks. We expect main's
 * counter to hit ~100 while workers are still running (i.e., main
 * is NOT blocked waiting). This proves preemptive multitasking
 * rather than cooperative.
 * ================================================================ */
static int long_sleep_job(QJSWorker *w, void *ud)
{
    (void)w; (void)ud;
    Delay(100);  /* ~2 seconds */
    return 0;
}

static void test_main_responsive(void)
{
    QJSWorker *w[3];
    int i, counter = 0;
    int workers_done;

    BANNER(3);

    for (i = 0; i < 3; i++) {
        w[i] = QJS_WorkerSpawn(long_sleep_job, NULL, 0);
        CHECK(w[i] != NULL, "spawn");
    }

    /* Poll workers while incrementing counter — no blocking. */
    while (1) {
        counter++;
        workers_done = 0;
        for (i = 0; i < 3; i++) {
            if (QJS_WorkerPoll(w[i]) == QJS_WORKER_DONE) workers_done++;
        }
        if (workers_done == 3) break;
        Delay(1);
        if (counter > 200) break;  /* safety */
    }

    printf("  main counter reached %d while workers ran\n", counter);
    CHECK(counter >= 50, "main task ran at least 50 loop iterations");
    CHECK(counter <= 200, "workers completed within reasonable time");

    for (i = 0; i < 3; i++) QJS_WorkerDestroy(w[i]);
}

/* ================================================================
 * Test 4: FAILURE — worker returns error, framework handles cleanly
 * ================================================================ */
static int failing_job(QJSWorker *w, void *ud)
{
    (void)w; (void)ud;
    return -42;
}

static void test_failure(void)
{
    QJSWorker *w;
    long rc;

    BANNER(4);

    w = QJS_WorkerSpawn(failing_job, NULL, 0);
    CHECK(w != NULL, "spawn");

    rc = QJS_WorkerJoin(w);
    CHECK(rc == -42, "Join returns the error code");
    CHECK(QJS_WorkerPoll(w) == QJS_WORKER_DONE,
          "DONE state even on nonzero return");

    QJS_WorkerDestroy(w);

    /* Null handle safety */
    CHECK(QJS_WorkerPoll(NULL) == QJS_WORKER_FAILED, "Poll(NULL) = FAILED");
    CHECK(QJS_WorkerJoin(NULL) == -1, "Join(NULL) = -1");
    QJS_WorkerDestroy(NULL);  /* must not crash */
}

/* ================================================================
 * Test 5: LEAK — 100 iterations, verify no resource accumulation
 * ================================================================ */
static int leak_job(QJSWorker *w, void *ud)
{
    (void)w; (void)ud;
    return 7;
}

static void test_leak(void)
{
    int i;
    int all_ok = 1;

    BANNER(5);

    for (i = 0; i < 100; i++) {
        QJSWorker *w = QJS_WorkerSpawn(leak_job, NULL, 0);
        if (!w) { all_ok = 0; break; }
        if (QJS_WorkerJoin(w) != 7) { all_ok = 0; break; }
        QJS_WorkerDestroy(w);
    }

    CHECK(all_ok, "100 iterations of spawn/join/destroy all succeeded");
    printf("  (observe 'avail' before/after to confirm no memory leak)\n");
}

/* ================================================================
 * Test 6: SCALING — N parallel workers complete in ~max duration,
 * not sum of durations. Proves concurrency, not serialization.
 * ================================================================ */
static int scale_job(QJSWorker *w, void *ud)
{
    (void)w; (void)ud;
    Delay(25);  /* 500ms per worker */
    return 0;
}

static void test_scaling(void)
{
    QJSWorker *w[10];
    struct DateStamp t0;
    int i;
    unsigned long elapsed_ms;

    BANNER(6);

    DateStamp(&t0);

    for (i = 0; i < 10; i++) {
        w[i] = QJS_WorkerSpawn(scale_job, NULL, 0);
        CHECK(w[i] != NULL, "spawn");
    }
    for (i = 0; i < 10; i++) {
        QJS_WorkerJoin(w[i]);
        QJS_WorkerDestroy(w[i]);
    }

    elapsed_ms = ms_since(&t0);
    printf("  10 workers × 500ms each took %lu ms\n", elapsed_ms);

    /* If serialized: ~5000 ms. If concurrent: ~500-1000 ms. */
    CHECK(elapsed_ms < 2500,
          "10 parallel workers completed in <2.5s (proves concurrency)");
    CHECK(elapsed_ms > 400,
          "10 workers took at least 400ms (sanity: they actually ran)");
}

/* ================================================================
 * main
 * ================================================================ */
int main(int argc, char **argv)
{
    (void)argc; (void)argv;

    printf("=== QJS Worker primitive stress test ===\n");
    /* Needs quickjs.library with Worker API — packed version 70 = "0.070".
     * See library/vbcc/libraryconfig.h for the versioning scheme. */
    printf("Opening quickjs.library (version >= 70, i.e. 0.070)...\n");

    QJSBase = OpenLibrary("quickjs.library", 70);
    if (!QJSBase) {
        printf("FATAL: cannot open quickjs.library 0.070+ (needs Worker LVOs)\n");
        printf("  Ensure amiga/libs/quickjs.library is installed in LIBS:\n");
        return 10;
    }
    {
        /* lib_Version is packed: major*1000 + revision (see libraryconfig.h).
         * Unpack for display. */
        unsigned v = QJSBase->lib_Version;
        unsigned maj = v / 1000;
        unsigned rev = v % 1000;
        printf("  opened at 0x%08lx, packed=%u (display %u.%03u)\n",
               (unsigned long)QJSBase, v, maj, rev);
    }

    test_isolation();
    test_durations();
    test_main_responsive();
    test_failure();
    test_leak();
    test_scaling();

    CloseLibrary(QJSBase);
    QJSBase = NULL;

    printf("\n=== Results: %d passed, %d failed ===\n",
           total_pass, total_fail);

    return total_fail > 0 ? 5 : 0;
}
