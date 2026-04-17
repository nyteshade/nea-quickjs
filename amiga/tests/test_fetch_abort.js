/*
 * test_fetch_abort.js -- Minimal abort test for 0.109+.
 *
 * One case only: start a fetch to a slow URL, abort after 500ms,
 * expect the Promise to reject with AbortError. No chained fetches
 * (0.105 likely hung because back-to-back fetches raced active_fetch).
 *
 * Requires library 0.109+, TCP/IP stack, internet (httpbin.org).
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== fetch abort smoke test (single case) ===");
print("Start: fetch /delay/2, abort at 500ms, expect AbortError");

(async () => {
    const ac = new AbortController();
    setTimeout(() => {
        print("  [timer] firing ac.abort() at ~500ms");
        ac.abort();
    }, 500);

    const start = Date.now();
    let caught = null;
    try {
        await fetch("http://httpbin.org/delay/2", { signal: ac.signal });
        print("  [fetch] resolved (unexpected)");
    } catch (e) {
        caught = e;
        print("  [fetch] rejected: " + (e && e.name) + " / " + (e && e.message));
    }
    const elapsed = Date.now() - start;
    print("  elapsed: " + elapsed + "ms");

    ok(caught !== null, "fetch rejected");
    ok(caught && caught.name === 'AbortError', "rejection is AbortError");

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
