/*
 * test_node_overnight.js -- Regression test for the 0.112 -> 0.12x
 * overnight Node-compat batch.
 *
 * Covers (landing version in parens):
 *   performance global + process.uptime/memoryUsage  (0.112)
 *   url.format, fileURLToPath, pathToFileURL, URL.parse (0.113)
 *   util.types.* long tail + util.styleText + util.stripVTControlCharacters (0.114)
 *   assert.fail/ifError/notStrictEqual/notEqual/notDeepEqual/notDeepStrictEqual
 *     /deepStrictEqual/doesNotThrow/doesNotReject                        (0.115)
 *   Blob + File                                                        (0.116)
 *   FormData                                                           (0.117)
 *   fs sync namespace (readFileSync/writeFileSync/...)                 (0.118)
 *   events.on async iterator                                           (0.119)
 *   EventTarget + Event                                                (0.120)
 *   readline                                                           (0.121)
 *
 * Run: qjs amiga/tests/test_node_overnight.js
 */

import * as std from 'qjs:std';
import * as os  from 'qjs:os';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}
function section(title) { print("\n-- " + title + " --"); }

(async () => {

/* =====================================================
 * 0.112 — performance / process.uptime / memoryUsage
 * ===================================================== */
section("performance (0.112)");
ok(typeof performance === 'object', 'performance global');
ok(typeof performance.now === 'function', 'performance.now');
ok(typeof performance.timeOrigin === 'number', 'performance.timeOrigin');
{
    const t1 = performance.now();
    for (let i = 0; i < 5000; i++) {}
    const t2 = performance.now();
    ok(t2 >= t1, 'now monotonic');
}
performance.mark('a');
performance.mark('b');
{
    const m = performance.measure('ab', 'a', 'b');
    ok(m.entryType === 'measure' && m.name === 'ab', 'measure entry shape');
    ok(typeof m.duration === 'number', 'measure duration is number');
}
ok(performance.getEntriesByName('a').length === 1, 'getEntriesByName');
ok(performance.getEntriesByType('mark').length === 2, 'getEntriesByType mark');
performance.clearMarks();
performance.clearMeasures();
ok(performance.getEntries().length === 0, 'clear* empties entries');

section("process.uptime / memoryUsage (0.112)");
ok(typeof process.uptime === 'function', 'process.uptime is function');
ok(process.uptime() >= 0, 'process.uptime non-negative');
ok(typeof process.memoryUsage === 'function', 'process.memoryUsage is function');
{
    const mu = process.memoryUsage();
    ok(typeof mu === 'object' && mu !== null, 'memoryUsage returns object');
    for (const k of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']) {
        ok(k in mu, 'memoryUsage.' + k);
    }
}

/* Remaining batches are appended by subsequent commits. */

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
if (fail > 0) std.exit(1);
})();
