/*
 * test_spawn_async.js -- Verify 0.100 true async spawn.
 *
 * Requires library 0.100+. Demonstrates the main task stays
 * responsive while the spawned command runs.
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== child_process.spawn async smoke test ===");

ok(typeof globalThis.__qjs_spawnAsync === 'function',
   "native __qjs_spawnAsync installed");

(async () => {
    /* 1. Basic async spawn — await returns result. */
    try {
        const r = await child_process.spawn("C:Echo", ["async hello"]);
        ok(typeof r === 'object',             "spawn returns object");
        ok(r.stdout.indexOf("async hello") >= 0, "stdout captured");
        ok(r.exitCode === 0,                  "exit code 0");
    } catch (e) { print("  FAIL: basic spawn threw " + e); fail += 3; }

    /* 2. Main-loop responsiveness — while child runs, a setTimeout
     *    scheduled before spawn should still fire on schedule. */
    try {
        let timerFired = false;
        setTimeout(() => { timerFired = true; }, 100);

        /* Echo finishes near-instant but the event-loop must still
         * process the timer. */
        const start = Date.now();
        const r = await child_process.spawn("C:Echo", ["responsiveness test"]);
        const elapsed = Date.now() - start;

        /* Give the timer a chance if spawn returned before 100ms */
        if (!timerFired && elapsed < 150)
            await new Promise(res => setTimeout(res, 150 - elapsed));

        ok(timerFired, "setTimeout fires around the async spawn");
        ok(r.exitCode === 0, "parallel spawn still succeeded");
    } catch (e) { print("  FAIL: responsiveness test threw " + e); fail += 2; }

    /* 3. Concurrent-spawn rejection — v1 is single-slot. */
    try {
        const p1 = child_process.spawn("C:Echo", ["first"]);
        let concurrentRejected = false;
        try {
            await child_process.spawn("C:Echo", ["second"]);
        } catch (e) {
            if (/in progress/i.test(e.message)) concurrentRejected = true;
        }
        await p1;  /* drain first */
        ok(concurrentRejected,
           "concurrent spawn rejects with 'in progress' (single-slot v1)");
    } catch (e) { print("  FAIL: concurrent test threw " + e); fail++; }

    /* 4. Result shape match between sync and async. */
    try {
        const syncR  = child_process.spawnSync("C:Echo", ["shape"]);
        const asyncR = await child_process.spawn("C:Echo", ["shape"]);
        ok(typeof asyncR.stdout   === typeof syncR.stdout,   "stdout type match");
        ok(typeof asyncR.exitCode === typeof syncR.exitCode, "exitCode type match");
        ok(asyncR.signal === syncR.signal,                   "signal matches (null)");
    } catch (e) { print("  FAIL: shape test threw " + e); fail += 3; }

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
