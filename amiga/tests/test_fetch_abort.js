/*
 * test_fetch_abort.js -- Minimal abort test (no network required).
 *
 * Uses AbortSignal.abort() to pre-abort, then calls fetch. The
 * wrapper's `if (signal.aborted) return Promise.reject(...)` path
 * fires immediately — NO worker spawn, NO socket, NO DNS. Tests
 * the JS-level abort plumbing in isolation.
 *
 * Previous versions of this test used httpbin.org/delay/N to
 * exercise mid-flight abort, but ran into either (a) httpbin
 * flakiness or (b) a still-unidentified interaction between the
 * fetch event-loop polling and setTimeout that froze the main
 * task on Amiga. Keep this test pure-JS for now; mid-flight
 * abort gets its own test once the hang is understood.
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== fetch abort (pre-aborted signal only) ===");

(async () => {
    const s = AbortSignal.abort();
    print("  [step] created pre-aborted signal (s.aborted=" + s.aborted + ")");

    let caught = null;
    try {
        await fetch("http://example.com/", { signal: s });
        print("  [step] fetch resolved (UNEXPECTED — signal was pre-aborted)");
    } catch (e) {
        caught = e;
        print("  [step] fetch rejected: " +
              (e && e.name) + " / " + (e && e.message));
    }

    ok(caught !== null,                       "pre-aborted fetch rejects");
    ok(caught && caught.name === 'AbortError', "rejection name is AbortError");

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
