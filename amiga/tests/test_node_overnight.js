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

/* =====================================================
 * 0.113 — url module + URL.parse static
 * ===================================================== */
section("url module (0.113)");
ok(typeof url === 'object', 'url global');
ok(url.URL === URL, 'url.URL re-exported');
ok(url.URLSearchParams === URLSearchParams, 'url.URLSearchParams re-exported');
ok(typeof url.format === 'function', 'url.format');
ok(typeof url.fileURLToPath === 'function', 'url.fileURLToPath');
ok(typeof url.pathToFileURL === 'function', 'url.pathToFileURL');

ok(URL.parse('https://example.com') instanceof URL, 'URL.parse static returns URL');
ok(URL.parse('not a url') === null, 'URL.parse returns null on invalid');

/* url.format */
{
    const s = url.format({ protocol: 'https:', host: 'example.com', pathname: '/a', search: '?b=1' });
    ok(s === 'https://example.com/a?b=1', 'url.format basic');
}
{
    const s = url.format({ protocol: 'https', slashes: true, hostname: 'example.com', port: 8080, pathname: '/x' });
    ok(s === 'https://example.com:8080/x', 'url.format hostname+port');
}
{
    const u = new URL('https://example.com/a');
    ok(url.format(u) === u.toString(), 'url.format passes URL instance through');
}
{
    const s = url.format({ protocol: 'https:', host: 'example.com', pathname: '/a', query: { b: '1', c: '2' } });
    ok(s.indexOf('b=1') >= 0 && s.indexOf('c=2') >= 0, 'url.format query object');
}

/* fileURLToPath */
{
    const p = url.fileURLToPath('file:///DH0:foo/bar.js');
    ok(p === 'DH0:foo/bar.js', 'fileURLToPath amiga volume');
}
{
    const p = url.fileURLToPath('file:///work/foo.js');
    ok(p === '/work/foo.js', 'fileURLToPath posix abs');
}
{
    let threw = false;
    try { url.fileURLToPath('http://x'); } catch (_) { threw = true; }
    ok(threw, 'fileURLToPath non-file throws');
}

/* pathToFileURL */
{
    const u = url.pathToFileURL('DH0:foo/bar.js');
    ok(u instanceof URL && u.protocol === 'file:', 'pathToFileURL amiga volume returns file URL');
    ok(u.href.indexOf('DH0:foo/bar.js') >= 0, 'pathToFileURL amiga volume preserves colon');
}
{
    const u = url.pathToFileURL('/usr/bin/true');
    ok(u instanceof URL && u.protocol === 'file:', 'pathToFileURL posix abs returns file URL');
}

/* url.parse legacy */
{
    const p = url.parse('https://u:pw@example.com:443/a/b?c=1#h');
    ok(p.protocol === 'https:', 'url.parse protocol');
    ok(p.hostname === 'example.com', 'url.parse hostname');
    ok(p.port === '443', 'url.parse port');
    ok(p.pathname === '/a/b', 'url.parse pathname');
    ok(p.search === '?c=1', 'url.parse search');
    ok(p.hash === '#h', 'url.parse hash');
}
{
    const p = url.parse('https://example.com/?a=1&b=2', true);
    ok(typeof p.query === 'object' && p.query.a === '1', 'url.parse parseQueryString');
}

/* url.resolve */
ok(url.resolve('https://example.com/a/', 'b') === 'https://example.com/a/b', 'url.resolve');

/* Remaining batches are appended by subsequent commits. */

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
if (fail > 0) std.exit(1);
})();
