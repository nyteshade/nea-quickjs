/*
 * test_fetch_abort.js -- Verify 0.105 fetch abort + timeout.
 *
 * Kept SHORT on purpose — each real test waits on a network round-
 * trip, and the prior version timed out user patience. Prints
 * progress between each step so you can see what's actively
 * running vs blocked.
 *
 * Requires library 0.105+, TCP/IP stack, internet (httpbin.org).
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== fetch abort + timeout smoke test ===");
print("(expect ~5s total: 1 pre-abort + 1 abort-during + 1 timeout)");

(async () => {
    /* Test 1 — pre-aborted signal. No network I/O at all. */
    print("\n[1/3] pre-aborted signal (should be instant)...");
    try {
        const s = AbortSignal.abort();
        let caught = null;
        try { await fetch("http://httpbin.org/get", { signal: s }); }
        catch (e) { caught = e; }
        ok(caught !== null, "pre-aborted signal rejects");
        ok(caught && caught.name === 'AbortError', "rejection is AbortError");
    } catch (e) { print("  FAIL: test 1 threw " + e); fail += 2; }

    /* Test 2 — abort mid-flight. Use /delay/2 so worst-case wait
     *          is 2s even if abort isn't honored. */
    print("\n[2/3] abort at 500ms during /delay/2 (should unblock ~500ms)...");
    try {
        const ac = new AbortController();
        setTimeout(() => ac.abort(), 500);
        const start = Date.now();
        let caught = null;
        try {
            await fetch("http://httpbin.org/delay/2", { signal: ac.signal });
        } catch (e) { caught = e; }
        const elapsed = Date.now() - start;
        print("  elapsed: " + elapsed + "ms");
        ok(caught !== null, "abort rejects in-flight fetch");
        ok(caught && caught.name === 'AbortError', "rejection is AbortError");
        /* JS-level reject is immediate (no network wait), so elapsed
         * should be near 500ms. If > 2500ms the C-level abort wiring
         * didn't fire and we waited on the server. */
        ok(elapsed < 2500, "abort unblocks before server delay elapses");
    } catch (e) { print("  FAIL: test 2 threw " + e); fail += 3; }

    /* Test 3 — AbortSignal.timeout. */
    print("\n[3/3] AbortSignal.timeout(500) on /delay/2 (should fire ~500ms)...");
    try {
        const sig = AbortSignal.timeout(500);
        const start = Date.now();
        let caught = null;
        try { await fetch("http://httpbin.org/delay/2", { signal: sig }); }
        catch (e) { caught = e; }
        const elapsed = Date.now() - start;
        print("  elapsed: " + elapsed + "ms");
        ok(caught !== null, "AbortSignal.timeout rejects");
        ok(caught && (caught.name === 'TimeoutError' || caught.name === 'AbortError'),
           "rejection is Timeout/AbortError (got " + (caught && caught.name) + ")");
        ok(elapsed < 2500, "timeout fires before server delay elapses");
    } catch (e) { print("  FAIL: test 3 threw " + e); fail += 3; }

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
