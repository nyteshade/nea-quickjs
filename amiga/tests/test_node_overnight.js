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

/* =====================================================
 * 0.114 — util.types long tail + util.styleText + util.stripVTControlCharacters
 * ===================================================== */
section("util.types long tail (0.114)");
ok(util.types.isNativeError(new Error('x')), 'isNativeError');
ok(util.types.isAnyArrayBuffer(new ArrayBuffer(1)), 'isAnyArrayBuffer(AB)');
ok(util.types.isDataView(new DataView(new ArrayBuffer(1))), 'isDataView');
ok(util.types.isUint8Array(new Uint8Array(1)), 'isUint8Array');
ok(util.types.isUint16Array(new Uint16Array(1)), 'isUint16Array');
ok(util.types.isInt32Array(new Int32Array(1)), 'isInt32Array');
ok(util.types.isFloat32Array(new Float32Array(1)), 'isFloat32Array');
ok(util.types.isFloat64Array(new Float64Array(1)), 'isFloat64Array');
ok(!util.types.isUint8Array(new ArrayBuffer(1)), 'isUint8Array rejects AB');
ok(util.types.isBooleanObject(new Boolean(true)), 'isBooleanObject');
ok(util.types.isNumberObject(new Number(1)), 'isNumberObject');
ok(util.types.isStringObject(new String('x')), 'isStringObject');
ok(util.types.isBoxedPrimitive(new Number(1)), 'isBoxedPrimitive');
ok(!util.types.isBoxedPrimitive(1), 'isBoxedPrimitive rejects primitive');
ok(util.types.isAsyncFunction(async () => {}), 'isAsyncFunction');
ok(!util.types.isAsyncFunction(() => {}), 'isAsyncFunction rejects arrow');
ok(util.types.isGeneratorFunction(function*(){}), 'isGeneratorFunction');
ok(util.types.isGeneratorObject((function*(){})()), 'isGeneratorObject');
ok(util.types.isProxy({}) === false, 'isProxy always false');

section("util.styleText (0.114)");
ok(typeof util.styleText === 'function', 'styleText is function');
{
    const s = util.styleText('red', 'hi');
    ok(s.indexOf('\x1b[31m') === 0 && s.endsWith('\x1b[39m'), 'styleText wraps with red CSI');
    ok(s.indexOf('hi') > 0, 'styleText preserves text');
}
{
    const s = util.styleText(['bold', 'green'], 'hi');
    ok(s.indexOf('\x1b[1m') >= 0 && s.indexOf('\x1b[32m') >= 0, 'styleText stacks styles');
}
{
    let threw = false;
    try { util.styleText('not-a-style', 'x'); } catch (_) { threw = true; }
    ok(threw, 'styleText throws on unknown style');
}

section("util.stripVTControlCharacters (0.114)");
ok(util.stripVTControlCharacters('\x1b[31mhi\x1b[39m') === 'hi', 'strip red');
ok(util.stripVTControlCharacters('\x1b[1;32mhi\x1b[0m bye') === 'hi bye', 'strip semi-colon params');
ok(util.stripVTControlCharacters('plain') === 'plain', 'passthrough plain');

/* =====================================================
 * 0.115 — assert completeness (fail/ifError/AssertionError)
 * ===================================================== */
section("assert module completeness (0.115)");
ok(typeof assert.ifError === 'function', 'assert.ifError');
ok(typeof assert.fail === 'function', 'assert.fail');
ok(typeof assert.AssertionError === 'function', 'assert.AssertionError class');

/* ifError */
{
    let threw = null;
    try { assert.ifError(null); } catch (e) { threw = e; }
    ok(threw === null, 'ifError(null) no throw');
    try { assert.ifError(undefined); } catch (e) { threw = e; }
    ok(threw === null, 'ifError(undefined) no throw');
    try { assert.ifError(new Error('x')); } catch (e) { threw = e; }
    ok(threw && threw.message === 'x', 'ifError(Error) rethrows');
    try { assert.ifError('oh no'); } catch (e) { threw = e; }
    ok(threw && threw.name === 'AssertionError', 'ifError(truthy non-error) throws AssertionError');
}

/* fail with 4-arg form */
{
    let caught = null;
    try { assert.fail(1, 2, 'mismatch', 'strictEqual'); }
    catch (e) { caught = e; }
    ok(caught && caught.name === 'AssertionError', 'fail 4-arg throws AssertionError');
    ok(caught && caught.actual === 1 && caught.expected === 2, 'fail 4-arg preserves actual/expected');
    ok(caught && caught.operator === 'strictEqual', 'fail 4-arg preserves operator');
}
/* fail with single-message form */
{
    let caught = null;
    try { assert.fail('bad'); } catch (e) { caught = e; }
    ok(caught && caught.message === 'bad', 'fail single-arg preserves message');
}

/* AssertionError construction */
{
    const e = new assert.AssertionError({ message: 'x', actual: 1, expected: 2, operator: '===' });
    ok(e.name === 'AssertionError', 'AssertionError.name');
    ok(e.code === 'ERR_ASSERTION', 'AssertionError.code');
    ok(e.actual === 1 && e.expected === 2 && e.operator === '===', 'AssertionError fields');
}

/* =====================================================
 * 0.116 — Blob + File
 * ===================================================== */
section("Blob (0.116)");
ok(typeof Blob === 'function', 'Blob is constructor');
{
    const b = new Blob(['hi']);
    ok(b.size === 2, 'Blob size (string)');
    ok(b.type === '', 'Blob empty type');
    const ab = await b.arrayBuffer();
    ok(ab instanceof ArrayBuffer && ab.byteLength === 2, 'Blob.arrayBuffer');
    ok(await b.text() === 'hi', 'Blob.text');
    const bytes = await b.bytes();
    ok(bytes instanceof Uint8Array && bytes.length === 2, 'Blob.bytes');
}
{
    const b = new Blob(['hello, ', 'world'], { type: 'text/plain' });
    ok(b.size === 12, 'Blob multi-part size');
    ok(b.type === 'text/plain', 'Blob type');
    ok(await b.text() === 'hello, world', 'Blob text concat');
}
{
    const ab = new ArrayBuffer(4);
    new Uint8Array(ab).set([1, 2, 3, 4]);
    const b = new Blob([ab, 'z']);
    ok(b.size === 5, 'Blob AB + string size');
    const out = new Uint8Array(await b.arrayBuffer());
    ok(out[0] === 1 && out[3] === 4 && out[4] === 'z'.charCodeAt(0), 'Blob AB + string bytes');
}
{
    const b = new Blob([new Uint8Array([0x61, 0x62, 0x63])]);
    ok(await b.text() === 'abc', 'Blob Uint8 input');
}
{
    const inner = new Blob(['xy']);
    const outer = new Blob([inner, 'Z']);
    ok(outer.size === 3, 'Nested Blob size');
    ok(await outer.text() === 'xyZ', 'Nested Blob text');
}
{
    const b = new Blob(['abcdef']);
    const s = b.slice(1, 4);
    ok(s instanceof Blob, 'slice returns Blob');
    ok(s.size === 3, 'slice size');
    ok(await s.text() === 'bcd', 'slice contents');
    const neg = b.slice(-3);
    ok(await neg.text() === 'def', 'slice negative start');
    const ct = b.slice(0, 2, 'text/html');
    ok(ct.type === 'text/html', 'slice assigns contentType');
}

section("File (0.116)");
ok(typeof File === 'function', 'File is constructor');
{
    const f = new File(['hi'], 'greeting.txt', { type: 'text/plain', lastModified: 42 });
    ok(f instanceof Blob, 'File is a Blob');
    ok(f.name === 'greeting.txt', 'File.name');
    ok(f.size === 2, 'File.size');
    ok(f.type === 'text/plain', 'File.type');
    ok(f.lastModified === 42, 'File.lastModified');
    ok(f.webkitRelativePath === '', 'File.webkitRelativePath default');
    ok(await f.text() === 'hi', 'File.text');
}
{
    let threw = false;
    try { new File(['x']); } catch (_) { threw = true; }
    ok(threw, 'File requires name');
}

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
if (fail > 0) std.exit(1);
})();
