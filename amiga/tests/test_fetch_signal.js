/*
 * test_fetch_signal.js -- Verify fetch works when signal is passed
 *                        but never fires.
 *
 * Useful data point toward isolating the 0.109 mid-flight abort
 * hang. If this passes, the wrapper's signal-registration path
 * (addEventListener + new Promise) is compatible with the native
 * fetch event loop. If it hangs, something about the wrapper
 * itself (not abort) is breaking things.
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== fetch with signal (never fires) ===");

(async () => {
    const ac = new AbortController();
    /* NO setTimeout abort — signal is passed but never aborted */

    print("  [step] fetching example.com with unfired signal...");
    const start = Date.now();
    let response = null;
    try {
        response = await fetch("http://example.com/", { signal: ac.signal });
        print("  [step] resolved in " + (Date.now() - start) + "ms");
    } catch (e) {
        print("  [step] rejected: " + (e && e.name) + " / " + (e && e.message));
    }

    ok(response !== null,                "fetch resolved");
    ok(response && response.status === 200, "HTTP 200 from example.com");

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
