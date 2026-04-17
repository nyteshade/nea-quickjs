/*
 * test_fetch_abort.js -- Verify 0.105 fetch abort + timeout.
 *
 * Covers:
 *   - AbortController.abort() rejects in-flight fetch with AbortError
 *   - AbortSignal.timeout(ms) rejects with TimeoutError
 *   - AbortSignal.any([...]) fires when any input fires
 *   - fetch({timeout: ms}) bounds socket recv/send
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

(async () => {
    /* 1. Already-aborted signal rejects immediately. */
    try {
        const s = AbortSignal.abort();
        let caught = null;
        try { await fetch("http://httpbin.org/get", { signal: s }); }
        catch (e) { caught = e; }
        ok(caught !== null, "pre-aborted signal rejects fetch");
        ok(caught && caught.name === 'AbortError',
           "rejection is AbortError (got " + (caught && caught.name) + ")");
    } catch (e) { print("  FAIL: pre-abort " + e); fail += 2; }

    /* 2. Abort an in-flight fetch partway through. Use httpbin's
     *    /delay/5 endpoint which stalls 5 seconds — plenty of time
     *    for us to abort before it returns. */
    try {
        const ac = new AbortController();
        setTimeout(() => ac.abort(), 500);   /* abort at 500ms */
        const start = Date.now();
        let caught = null;
        try {
            await fetch("http://httpbin.org/delay/5", { signal: ac.signal });
        } catch (e) { caught = e; }
        const elapsed = Date.now() - start;
        ok(caught !== null,                  "abort rejects in-flight fetch");
        ok(caught && caught.name === 'AbortError', "rejection is AbortError");
        /* Should unblock well before the 5s server delay */
        ok(elapsed < 3000,
           "abort rejects quickly (got " + elapsed + "ms, expected < 3000)");
    } catch (e) { print("  FAIL: mid-flight abort " + e); fail += 3; }

    /* 3. AbortSignal.timeout(ms) — timer-based abort. */
    try {
        const sig = AbortSignal.timeout(500);
        const start = Date.now();
        let caught = null;
        try { await fetch("http://httpbin.org/delay/5", { signal: sig }); }
        catch (e) { caught = e; }
        const elapsed = Date.now() - start;
        ok(caught !== null, "AbortSignal.timeout rejects slow fetch");
        /* Timeout reason is TimeoutError per spec */
        ok(caught && (caught.name === 'TimeoutError' ||
                      caught.name === 'AbortError'),
           "rejection is Timeout/AbortError (got " + (caught && caught.name) + ")");
        ok(elapsed < 3000,
           "timeout fires quickly (got " + elapsed + "ms)");
    } catch (e) { print("  FAIL: AbortSignal.timeout " + e); fail += 3; }

    /* 4. AbortSignal.any — combine a user controller + a timeout. */
    try {
        const ac = new AbortController();
        const timeout = AbortSignal.timeout(10000);  /* long timeout */
        const combined = AbortSignal.any([ac.signal, timeout]);

        setTimeout(() => ac.abort(), 300);   /* user abort first */
        let caught = null;
        try { await fetch("http://httpbin.org/delay/5", { signal: combined }); }
        catch (e) { caught = e; }
        ok(caught !== null, "AbortSignal.any fires when user aborts");
    } catch (e) { print("  FAIL: AbortSignal.any " + e); fail++; }

    /* 5. fetch({timeout}) — per-call timeout without a signal. This
     *    only applies SO_RCVTIMEO; a server that responds immediately
     *    with full headers+body won't trip it, so we use /delay/5
     *    with a short timeout. */
    try {
        const start = Date.now();
        let caught = null;
        try {
            await fetch("http://httpbin.org/delay/5", { timeout: 1000 });
        } catch (e) { caught = e; }
        const elapsed = Date.now() - start;
        ok(caught !== null, "fetch({timeout:1000}) rejects on slow server");
        /* SO_RCVTIMEO means the first recv that doesn't see data in
         * 1s returns error; elapsed should be close to 1-2s. */
        ok(elapsed < 3000,
           "timeout unblocks within ~2s (got " + elapsed + "ms)");
    } catch (e) { print("  FAIL: fetch {timeout} " + e); fail += 2; }

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
