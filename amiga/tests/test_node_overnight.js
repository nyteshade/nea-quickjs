/*
 * test_node_overnight.js -- Regression test for the 0.112 -> 0.12x
 * overnight Node-compat batch.
 *
 * Each section runs inside run() with try/catch so a single throwing
 * line doesn't silently truncate the rest of the file. Output is
 * flushed after every print so a mid-script crash preserves
 * diagnostic state to disk (important when AmigaDOS redirects the
 * CLI's stdout to a file — the default buffering is block-buffered).
 *
 * Covers (landing version in parens):
 *   performance global + process.uptime/memoryUsage    (0.112)
 *   url module + URL.parse static                       (0.113)
 *   util.types long tail + styleText + stripVT*         (0.114)
 *   assert.ifError + AssertionError + fail 4-arg        (0.115)
 *   Blob + File                                         (0.116)
 *   FormData                                            (0.117)
 *   fs sync namespace                                   (0.118)
 *   events.on async iterator                            (0.119)
 *   EventTarget + Event + CustomEvent                   (0.120)
 *   readline + readline/promises                        (0.121)
 *   nodeOs + require() stub                             (0.122)
 *
 * Run: qjs amiga/tests/test_node_overnight.js
 */

import * as std from 'qjs:std';
import * as os  from 'qjs:os';

let pass = 0, fail = 0;
function _flush() { try { std.out.flush(); } catch (_) {} }
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
    _flush();
}
function section(title) { print("\n-- " + title + " --"); _flush(); }
async function run(title, fn) {
    section(title);
    try { await fn(); }
    catch (e) {
        fail++;
        print("  FAIL: [section] threw: " + (e && e.message || e));
        if (e && e.stack) {
            const stack = String(e.stack).split('\n').slice(0, 4).join('\n    ');
            print("    " + stack);
        }
        _flush();
    }
}

(async () => {

await run("performance (0.112)", async () => {
    ok(typeof performance === 'object', 'performance global');
    ok(typeof performance.now === 'function', 'performance.now');
    ok(typeof performance.timeOrigin === 'number', 'performance.timeOrigin');
    const t1 = performance.now();
    for (let i = 0; i < 5000; i++) {}
    const t2 = performance.now();
    ok(t2 >= t1, 'now monotonic');
    /* mark/measure subsection — guarded so if mark throws, the rest still
     * runs. */
    try {
        ok(typeof performance.mark === 'function', 'performance.mark is function');
        ok(typeof performance.measure === 'function', 'performance.measure is function');
        performance.mark('a');
        performance.mark('b');
        const m = performance.measure('ab', 'a', 'b');
        ok(m && m.entryType === 'measure' && m.name === 'ab', 'measure entry shape');
        ok(typeof m.duration === 'number', 'measure duration is number');
        ok(performance.getEntriesByName('a').length === 1, 'getEntriesByName');
        ok(performance.getEntriesByType('mark').length === 2, 'getEntriesByType mark');
        performance.clearMarks();
        performance.clearMeasures();
        ok(performance.getEntries().length === 0, 'clear* empties entries');
    } catch (e) {
        fail++;
        print("  FAIL: mark/measure path threw: " + (e && e.message || e));
        _flush();
    }
});

await run("process.uptime / memoryUsage (0.112)", async () => {
    ok(typeof process.uptime === 'function', 'process.uptime is function');
    ok(process.uptime() >= 0, 'process.uptime non-negative');
    ok(typeof process.memoryUsage === 'function', 'process.memoryUsage is function');
    const mu = process.memoryUsage();
    ok(typeof mu === 'object' && mu !== null, 'memoryUsage returns object');
    for (const k of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']) {
        ok(k in mu, 'memoryUsage.' + k);
    }
});

await run("url module (0.113)", async () => {
    ok(typeof url === 'object', 'url global');
    ok(url.URL === URL, 'url.URL re-exported');
    ok(url.URLSearchParams === URLSearchParams, 'url.URLSearchParams re-exported');
    ok(typeof url.format === 'function', 'url.format');
    ok(typeof url.fileURLToPath === 'function', 'url.fileURLToPath');
    ok(typeof url.pathToFileURL === 'function', 'url.pathToFileURL');
    ok(URL.parse('https://example.com') instanceof URL, 'URL.parse static returns URL');
    ok(URL.parse('not a url') === null, 'URL.parse returns null on invalid');

    const s1 = url.format({ protocol: 'https:', host: 'example.com', pathname: '/a', search: '?b=1' });
    ok(s1 === 'https://example.com/a?b=1', 'url.format basic');
    const s2 = url.format({ protocol: 'https', slashes: true, hostname: 'example.com', port: 8080, pathname: '/x' });
    ok(s2 === 'https://example.com:8080/x', 'url.format hostname+port');
    const u1 = new URL('https://example.com/a');
    ok(url.format(u1) === u1.toString(), 'url.format passes URL instance through');
    const s3 = url.format({ protocol: 'https:', host: 'example.com', pathname: '/a', query: { b: '1', c: '2' } });
    ok(s3.indexOf('b=1') >= 0 && s3.indexOf('c=2') >= 0, 'url.format query object');

    ok(url.fileURLToPath('file:///DH0:foo/bar.js') === 'DH0:foo/bar.js', 'fileURLToPath amiga volume');
    ok(url.fileURLToPath('file:///work/foo.js') === '/work/foo.js', 'fileURLToPath posix abs');
    let threw = false;
    try { url.fileURLToPath('http://x'); } catch (_) { threw = true; }
    ok(threw, 'fileURLToPath non-file throws');

    const u2 = url.pathToFileURL('DH0:foo/bar.js');
    ok(u2 instanceof URL && u2.protocol === 'file:', 'pathToFileURL amiga volume returns file URL');
    ok(u2.href.indexOf('DH0:foo/bar.js') >= 0, 'pathToFileURL amiga volume preserves colon');
    const u3 = url.pathToFileURL('/usr/bin/true');
    ok(u3 instanceof URL && u3.protocol === 'file:', 'pathToFileURL posix abs returns file URL');

    const p = url.parse('https://u:pw@example.com:443/a/b?c=1#h');
    ok(p.protocol === 'https:', 'url.parse protocol');
    ok(p.hostname === 'example.com', 'url.parse hostname');
    ok(p.port === '443', 'url.parse port');
    ok(p.pathname === '/a/b', 'url.parse pathname');
    ok(p.search === '?c=1', 'url.parse search');
    ok(p.hash === '#h', 'url.parse hash');

    const p2 = url.parse('https://example.com/?a=1&b=2', true);
    ok(typeof p2.query === 'object' && p2.query.a === '1', 'url.parse parseQueryString');
    ok(url.resolve('https://example.com/a/', 'b') === 'https://example.com/a/b', 'url.resolve');
});

await run("util.types long tail (0.114)", async () => {
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
});

await run("util.styleText (0.114)", async () => {
    ok(typeof util.styleText === 'function', 'styleText is function');
    const s1 = util.styleText('red', 'hi');
    ok(s1.indexOf('\x1b[31m') === 0 && s1.endsWith('\x1b[39m'), 'styleText wraps with red CSI');
    ok(s1.indexOf('hi') > 0, 'styleText preserves text');
    const s2 = util.styleText(['bold', 'green'], 'hi');
    ok(s2.indexOf('\x1b[1m') >= 0 && s2.indexOf('\x1b[32m') >= 0, 'styleText stacks styles');
    let threw = false;
    try { util.styleText('not-a-style', 'x'); } catch (_) { threw = true; }
    ok(threw, 'styleText throws on unknown style');
});

await run("util.stripVTControlCharacters (0.114)", async () => {
    ok(util.stripVTControlCharacters('\x1b[31mhi\x1b[39m') === 'hi', 'strip red');
    ok(util.stripVTControlCharacters('\x1b[1;32mhi\x1b[0m bye') === 'hi bye', 'strip semi-colon params');
    ok(util.stripVTControlCharacters('plain') === 'plain', 'passthrough plain');
});

await run("assert module completeness (0.115)", async () => {
    ok(typeof assert.ifError === 'function', 'assert.ifError');
    ok(typeof assert.fail === 'function', 'assert.fail');
    ok(typeof assert.AssertionError === 'function', 'assert.AssertionError class');

    let threw = null;
    try { assert.ifError(null); } catch (e) { threw = e; }
    ok(threw === null, 'ifError(null) no throw');
    try { assert.ifError(undefined); } catch (e) { threw = e; }
    ok(threw === null, 'ifError(undefined) no throw');
    try { assert.ifError(new Error('x')); } catch (e) { threw = e; }
    ok(threw && threw.message === 'x', 'ifError(Error) rethrows');
    try { assert.ifError('oh no'); } catch (e) { threw = e; }
    ok(threw && threw.name === 'AssertionError', 'ifError(truthy non-error) throws AssertionError');

    let caught = null;
    try { assert.fail(1, 2, 'mismatch', 'strictEqual'); }
    catch (e) { caught = e; }
    ok(caught && caught.name === 'AssertionError', 'fail 4-arg throws AssertionError');
    ok(caught && caught.actual === 1 && caught.expected === 2, 'fail 4-arg preserves actual/expected');
    ok(caught && caught.operator === 'strictEqual', 'fail 4-arg preserves operator');

    caught = null;
    try { assert.fail('bad'); } catch (e) { caught = e; }
    ok(caught && caught.message === 'bad', 'fail single-arg preserves message');

    const e = new assert.AssertionError({ message: 'x', actual: 1, expected: 2, operator: '===' });
    ok(e.name === 'AssertionError', 'AssertionError.name');
    ok(e.code === 'ERR_ASSERTION', 'AssertionError.code');
    ok(e.actual === 1 && e.expected === 2 && e.operator === '===', 'AssertionError fields');
});

await run("Blob (0.116)", async () => {
    ok(typeof Blob === 'function', 'Blob is constructor');

    let b = new Blob(['hi']);
    ok(b.size === 2, 'Blob size (string)');
    ok(b.type === '', 'Blob empty type');
    const ab = await b.arrayBuffer();
    ok(ab instanceof ArrayBuffer && ab.byteLength === 2, 'Blob.arrayBuffer');
    ok(await b.text() === 'hi', 'Blob.text');
    const bytes = await b.bytes();
    ok(bytes instanceof Uint8Array && bytes.length === 2, 'Blob.bytes');

    b = new Blob(['hello, ', 'world'], { type: 'text/plain' });
    ok(b.size === 12, 'Blob multi-part size');
    ok(b.type === 'text/plain', 'Blob type');
    ok(await b.text() === 'hello, world', 'Blob text concat');

    const ab2 = new ArrayBuffer(4);
    new Uint8Array(ab2).set([1, 2, 3, 4]);
    b = new Blob([ab2, 'z']);
    ok(b.size === 5, 'Blob AB + string size');
    const out = new Uint8Array(await b.arrayBuffer());
    ok(out[0] === 1 && out[3] === 4 && out[4] === 'z'.charCodeAt(0), 'Blob AB + string bytes');

    b = new Blob([new Uint8Array([0x61, 0x62, 0x63])]);
    ok(await b.text() === 'abc', 'Blob Uint8 input');

    const inner = new Blob(['xy']);
    const outer = new Blob([inner, 'Z']);
    ok(outer.size === 3, 'Nested Blob size');
    ok(await outer.text() === 'xyZ', 'Nested Blob text');

    b = new Blob(['abcdef']);
    const s = b.slice(1, 4);
    ok(s instanceof Blob, 'slice returns Blob');
    ok(s.size === 3, 'slice size');
    ok(await s.text() === 'bcd', 'slice contents');
    const neg = b.slice(-3);
    ok(await neg.text() === 'def', 'slice negative start');
    const ct = b.slice(0, 2, 'text/html');
    ok(ct.type === 'text/html', 'slice assigns contentType');
});

await run("File (0.116)", async () => {
    ok(typeof File === 'function', 'File is constructor');
    const f = new File(['hi'], 'greeting.txt', { type: 'text/plain', lastModified: 42 });
    ok(f instanceof Blob, 'File is a Blob');
    ok(f.name === 'greeting.txt', 'File.name');
    ok(f.size === 2, 'File.size');
    ok(f.type === 'text/plain', 'File.type');
    ok(f.lastModified === 42, 'File.lastModified');
    ok(f.webkitRelativePath === '', 'File.webkitRelativePath default');
    ok(await f.text() === 'hi', 'File.text');
    let threw = false;
    try { new File(['x']); } catch (_) { threw = true; }
    ok(threw, 'File requires name');
});

await run("FormData (0.117)", async () => {
    ok(typeof FormData === 'function', 'FormData constructor');
    let fd = new FormData();
    fd.append('a', '1');
    fd.append('a', '2');
    fd.append('b', '3');
    ok(fd.get('a') === '1', 'get returns first');
    ok(fd.getAll('a').length === 2 && fd.getAll('a')[1] === '2', 'getAll');
    ok(fd.has('a'), 'has true');
    ok(!fd.has('c'), 'has false');
    fd.set('a', 'only');
    ok(fd.getAll('a').length === 1 && fd.get('a') === 'only', 'set collapses duplicates');
    fd.delete('b');
    ok(!fd.has('b'), 'delete');

    fd = new FormData();
    fd.append('x', '1');
    fd.append('y', '2');
    const keys = [...fd.keys()];
    ok(keys.length === 2 && keys[0] === 'x' && keys[1] === 'y', 'keys() preserves order');
    const vals = [...fd.values()];
    ok(vals[0] === '1' && vals[1] === '2', 'values()');
    const ents = [...fd.entries()];
    ok(ents[0][0] === 'x' && ents[0][1] === '1', 'entries()');
    const iter = [...fd];
    ok(iter.length === 2, 'Symbol.iterator');

    fd = new FormData();
    fd.append('file', new Blob(['hi']));
    const fv = fd.get('file');
    ok(fv instanceof File, 'Blob value promoted to File');
    ok(fv.name === 'blob', 'blob default name');

    fd = new FormData();
    fd.append('x', new File(['hi'], 'orig.txt'), 'renamed.txt');
    ok(fd.get('x').name === 'renamed.txt', 'append filename renames File');

    fd = new FormData();
    fd.append('n', 42);
    ok(fd.get('n') === '42', 'non-Blob value coerced to string');

    fd = new FormData();
    fd.append('a', '1');
    fd.append('a', '2');
    const seen = [];
    fd.forEach((v, k) => seen.push([k, v]));
    ok(seen.length === 2 && seen[0][0] === 'a' && seen[0][1] === '1', 'forEach iterates all entries in order');
});

await run("fs sync (0.118)", async () => {
    ok(typeof fs.readFileSync === 'function', 'fs.readFileSync');
    ok(typeof fs.writeFileSync === 'function', 'fs.writeFileSync');
    ok(typeof fs.statSync === 'function', 'fs.statSync');
    ok(typeof fs.existsSync === 'function', 'fs.existsSync');
    ok(typeof fs.unlinkSync === 'function', 'fs.unlinkSync');
    ok(typeof fs.accessSync === 'function', 'fs.accessSync');
    ok(typeof fs.copyFileSync === 'function', 'fs.copyFileSync');
    ok(typeof fs.truncateSync === 'function', 'fs.truncateSync');
    ok(typeof fs.realpathSync === 'function', 'fs.realpathSync');

    const scratch = (process.platform === 'amigaos') ? 'T:qjs-fs-sync-test' : '/tmp/qjs-fs-sync-test';
    try { fs.unlinkSync(scratch); } catch (_) {}

    fs.writeFileSync(scratch, 'hello, world');
    ok(fs.existsSync(scratch), 'existsSync true after write');
    const b = fs.readFileSync(scratch);
    ok(b instanceof Uint8Array, 'readFileSync returns bytes by default');
    ok(b.length === 12, 'readFileSync length');

    ok(fs.readFileSync(scratch, 'utf8') === 'hello, world', 'readFileSync utf8');
    ok(fs.readFileSync(scratch, { encoding: 'utf8' }) === 'hello, world', 'readFileSync {encoding}');

    fs.appendFileSync(scratch, '!');
    ok(fs.readFileSync(scratch, 'utf8') === 'hello, world!', 'appendFileSync');

    const st = fs.statSync(scratch);
    ok(typeof st.size === 'number' && st.size === 13, 'statSync size');
    ok(st.isFile() === true, 'statSync isFile');
    ok(st.isDirectory() === false, 'statSync not directory');
    ok(st.isSymbolicLink() === false, 'statSync not symlink');

    fs.truncateSync(scratch, 5);
    ok(fs.readFileSync(scratch, 'utf8') === 'hello', 'truncateSync shorter');
    fs.truncateSync(scratch, 7);
    const b2 = fs.readFileSync(scratch);
    ok(b2.length === 7 && b2[5] === 0 && b2[6] === 0, 'truncateSync zero-extend');

    let ok1 = false;
    try { fs.accessSync(scratch); ok1 = true; } catch (_) {}
    ok(ok1, 'accessSync existing path');
    let threw = false;
    try { fs.accessSync(scratch + '-nope'); } catch (_) { threw = true; }
    ok(threw, 'accessSync missing path throws');

    ok(fs.existsSync(scratch + '-also-nope') === false, 'existsSync missing -> false');

    const copy = scratch + '.copy';
    try { fs.unlinkSync(copy); } catch (_) {}
    fs.copyFileSync(scratch, copy);
    ok(fs.existsSync(copy), 'copyFileSync creates dest');
    ok(fs.readFileSync(copy).length === 7, 'copyFileSync contents match');

    const renamed = scratch + '.renamed';
    try { fs.unlinkSync(renamed); } catch (_) {}
    fs.renameSync(copy, renamed);
    ok(fs.existsSync(renamed), 'renameSync dest exists');
    ok(fs.existsSync(copy) === false, 'renameSync src gone');

    fs.unlinkSync(scratch);
    ok(!fs.existsSync(scratch), 'unlinkSync removes file');
    try { fs.unlinkSync(renamed); } catch (_) {}

    let caught = null;
    try { fs.readFileSync(scratch + '-never'); } catch (e) { caught = e; }
    ok(caught && caught.code === 'ENOENT', 'readFileSync missing -> ENOENT');
});

await run("events.on async iterator (0.119)", async () => {
    ok(typeof events === 'object', 'events module global');
    ok(events.EventEmitter === EventEmitter, 'events.EventEmitter');
    ok(typeof events.on === 'function', 'events.on');
    ok(typeof events.once === 'function', 'events.once');
    ok(typeof EventEmitter.on === 'function', 'EventEmitter.on static');

    const ee = new EventEmitter();
    const it = EventEmitter.on(ee, 'data');
    ee.emit('data', 'a');
    ee.emit('data', 'b', 2);
    const r1 = await it.next();
    ok(r1.value[0] === 'a' && r1.done === false, 'events.on first emission');
    const r2 = await it.next();
    ok(r2.value[0] === 'b' && r2.value[1] === 2, 'events.on multi-arg emission');

    const pending = it.next();
    ee.emit('data', 'c');
    const r3 = await pending;
    ok(r3.value[0] === 'c', 'events.on emission while waiting');

    const done = await it.return();
    ok(done.done === true, 'events.on return marks done');

    /* for-await integration */
    const ee2 = new EventEmitter();
    queueMicrotask(() => { ee2.emit('x', 1); ee2.emit('x', 2); ee2.emit('x', 3); });
    const results = [];
    for await (const [n] of EventEmitter.on(ee2, 'x')) {
        results.push(n);
        if (n === 3) break;
    }
    ok(results.length === 3 && results[2] === 3, 'for-await iterates and breaks');

    /* 'error' emission rejects */
    const ee3 = new EventEmitter();
    const it3 = EventEmitter.on(ee3, 'data');
    let caught = null;
    try {
        const p = it3.next();
        ee3.emit('error', new Error('boom'));
        await p;
    } catch (e) { caught = e; }
    ok(caught && caught.message === 'boom', 'error event rejects iterator');

    /* AbortSignal integration */
    const ee4 = new EventEmitter();
    const ac = new AbortController();
    const it4 = EventEmitter.on(ee4, 'data', { signal: ac.signal });
    let caught4 = null;
    queueMicrotask(() => ac.abort());
    try { await it4.next(); } catch (e) { caught4 = e; }
    ok(caught4 && (caught4.name === 'AbortError' || caught4.message === 'Aborted'),
       'AbortSignal rejects pending next');

    /* Pre-aborted signal */
    const ee5 = new EventEmitter();
    const ac5 = new AbortController();
    ac5.abort();
    const it5 = EventEmitter.on(ee5, 'data', { signal: ac5.signal });
    let caught5 = null;
    try { await it5.next(); } catch (e) { caught5 = e; }
    ok(caught5, 'pre-aborted signal rejects');
});

await run("EventTarget + Event (0.120)", async () => {
    ok(typeof EventTarget === 'function', 'EventTarget is constructor');
    ok(typeof Event === 'function', 'Event is constructor');
    ok(typeof CustomEvent === 'function', 'CustomEvent is constructor');

    let t = new EventTarget();
    let seen = null;
    t.addEventListener('click', (e) => { seen = e; });
    const ev = new Event('click');
    t.dispatchEvent(ev);
    ok(seen === ev, 'listener receives event');
    ok(seen.type === 'click', 'event type');
    ok(seen.target === t, 'event.target set');
    ok(seen.currentTarget === null, 'currentTarget cleared after dispatch');

    t = new EventTarget();
    let count = 0;
    t.addEventListener('x', () => count++, { once: true });
    t.dispatchEvent(new Event('x'));
    t.dispatchEvent(new Event('x'));
    ok(count === 1, 'once fires exactly once');

    t = new EventTarget();
    count = 0;
    const fn = () => count++;
    t.addEventListener('x', fn);
    t.addEventListener('x', fn);
    t.dispatchEvent(new Event('x'));
    ok(count === 1, 'duplicate listener deduped');

    t = new EventTarget();
    count = 0;
    const fn2 = () => count++;
    t.addEventListener('x', fn2);
    t.removeEventListener('x', fn2);
    t.dispatchEvent(new Event('x'));
    ok(count === 0, 'removeEventListener');

    t = new EventTarget();
    let seenT = null;
    const handler = { handleEvent(e) { seenT = e.type; } };
    t.addEventListener('y', handler);
    t.dispatchEvent(new Event('y'));
    ok(seenT === 'y', 'handleEvent object-listener');

    t = new EventTarget();
    t.addEventListener('z', (e) => { e.preventDefault(); });
    const evZ = new Event('z', { cancelable: true });
    const ret = t.dispatchEvent(evZ);
    ok(ret === false, 'dispatchEvent returns false on preventDefault');
    ok(evZ.defaultPrevented === true, 'defaultPrevented flag');

    t = new EventTarget();
    t.addEventListener('z', (e) => { e.preventDefault(); });
    const evZ2 = new Event('z');
    const ret2 = t.dispatchEvent(evZ2);
    ok(ret2 === true && evZ2.defaultPrevented === false, 'non-cancelable ignores preventDefault');

    t = new EventTarget();
    let a = 0, b = 0;
    t.addEventListener('go', (e) => { a++; e.stopImmediatePropagation(); });
    t.addEventListener('go', () => { b++; });
    t.dispatchEvent(new Event('go'));
    ok(a === 1 && b === 0, 'stopImmediatePropagation halts subsequent listeners');

    t = new EventTarget();
    let detail = null;
    t.addEventListener('c', (e) => { detail = e.detail; });
    t.dispatchEvent(new CustomEvent('c', { detail: { k: 1 } }));
    ok(detail && detail.k === 1, 'CustomEvent detail');

    t = new EventTarget();
    const ac = new AbortController();
    let c2 = 0;
    t.addEventListener('s', () => c2++, { signal: ac.signal });
    t.dispatchEvent(new Event('s'));
    ac.abort();
    t.dispatchEvent(new Event('s'));
    ok(c2 === 1, 'signal removes listener on abort');

    t = new EventTarget();
    const ac2 = new AbortController();
    ac2.abort();
    let c3 = 0;
    t.addEventListener('s', () => c3++, { signal: ac2.signal });
    t.dispatchEvent(new Event('s'));
    ok(c3 === 0, 'pre-aborted signal prevents add');

    t = new EventTarget();
    let threw = false;
    try { t.dispatchEvent({ type: 'fake' }); } catch (_) { threw = true; }
    ok(threw, 'dispatchEvent throws on non-Event');
});

await run("readline module (0.121)", async () => {
    ok(typeof readline === 'object', 'readline global');
    ok(typeof readline.createInterface === 'function', 'createInterface');
    ok(typeof readline.Interface === 'function', 'Interface class');
    ok(readline.promises && typeof readline.promises.createInterface === 'function',
       'readline.promises.createInterface');

    const lines1 = ['alice', 'bob', 'charlie'];
    const fakeIn1 = { getline() { return lines1.length ? lines1.shift() : null; } };
    const writes1 = [];
    const fakeOut1 = { write(s) { writes1.push(s); } };
    const rl = readline.createInterface({ input: fakeIn1, output: fakeOut1, prompt: '$ ' });
    ok(rl instanceof readline.Interface, 'createInterface returns Interface');
    ok(rl.getPrompt() === '$ ', 'prompt set from opts');
    rl.prompt();
    ok(writes1[0] === '$ ', 'prompt() writes prompt');

    let answer = null;
    rl.question('name? ', (a) => { answer = a; });
    await Promise.resolve();
    ok(writes1.includes('name? '), 'question writes query');
    ok(answer === 'alice', 'question invokes callback with line');
    ok(rl.history[0] === 'alice', 'history prepended');

    /* readline/promises Interface. */
    const rl2 = readline.promises.createInterface({
        input: { getline: () => 'yes' },
        output: { write: () => {} },
    });
    const p = rl2.question('continue? ');
    ok(p && typeof p.then === 'function', 'promises.question returns Promise');
    const a2 = await p;
    ok(a2 === 'yes', 'promises.question resolves with line');
    rl2.close();

    /* Async iteration */
    const lines3 = ['one', 'two', 'three'];
    const rl3 = readline.createInterface({
        input: { getline() { return lines3.length ? lines3.shift() : null; } },
        output: { write: () => {} },
    });
    const got = [];
    for await (const line of rl3) got.push(line);
    ok(got.length === 3 && got[2] === 'three', 'async iteration drains input');

    /* close event */
    const rl4 = readline.createInterface({
        input: { getline: () => null },
        output: { write: () => {} },
    });
    let closed = false;
    rl4.on('close', () => { closed = true; });
    rl4.close();
    ok(closed, 'close event fires');

    /* AbortSignal in promises.question */
    const rl5 = readline.promises.createInterface({
        input: { getline: () => 'never' },
        output: { write: () => {} },
    });
    const ac = new AbortController();
    ac.abort();
    let caught = null;
    try { await rl5.question('go: ', { signal: ac.signal }); } catch (e) { caught = e; }
    ok(caught, 'pre-aborted signal rejects question');
    rl5.close();

    /* ANSI helpers */
    const writesA = [];
    const streamA = { write(s) { writesA.push(s); } };
    readline.clearLine(streamA, 0);
    readline.cursorTo(streamA, 4);
    readline.moveCursor(streamA, -2, 0);
    ok(writesA.length === 3, 'ANSI helpers write to stream');
    ok(writesA[0].indexOf('\x1b[') === 0, 'clearLine emits CSI');
});

await run("Node os module (0.122)", async () => {
    ok(typeof nodeOs === 'object', 'globalThis.nodeOs exists');
    ok(nodeOs.platform() === 'amigaos', 'nodeOs.platform');
    ok(nodeOs.arch() === 'm68k', 'nodeOs.arch');
    ok(nodeOs.type() === 'AmigaOS', 'nodeOs.type');
    ok(nodeOs.endianness() === 'BE', 'nodeOs.endianness');
    ok(typeof nodeOs.hostname() === 'string', 'nodeOs.hostname');
    ok(typeof nodeOs.tmpdir() === 'string', 'nodeOs.tmpdir');
    ok(typeof nodeOs.homedir() === 'string', 'nodeOs.homedir');
    ok(nodeOs.EOL === '\n', 'nodeOs.EOL');
    ok(Array.isArray(nodeOs.cpus()) && nodeOs.cpus().length >= 1, 'nodeOs.cpus non-empty');
    ok(Array.isArray(nodeOs.loadavg()) && nodeOs.loadavg().length === 3, 'nodeOs.loadavg length');
    ok(typeof nodeOs.userInfo() === 'object', 'nodeOs.userInfo');
    ok(nodeOs.userInfo().homedir === nodeOs.homedir(), 'userInfo.homedir matches');
    ok(typeof nodeOs.uptime() === 'number', 'nodeOs.uptime is number');
    ok(nodeOs.constants && nodeOs.constants.signals && nodeOs.constants.signals.SIGINT === 2,
       'nodeOs.constants.signals.SIGINT');
});

await run("Node require() stub (0.122)", async () => {
    ok(typeof require === 'function', 'require function');
    ok(require('os') === nodeOs, 'require("os") returns nodeOs');
    ok(require('node:os') === nodeOs, 'require("node:os") returns nodeOs');
    ok(require('path') === globalThis.path, 'require("path")');
    ok(require('util') === globalThis.util, 'require("util")');
    ok(require('events') === globalThis.events, 'require("events")');
    ok(require('assert') === globalThis.assert, 'require("assert")');
    ok(require('readline') === globalThis.readline, 'require("readline")');
    const timersP = require('timers/promises');
    ok(timersP === globalThis.timers.promises, 'require("timers/promises")');
    const buf = require('buffer');
    ok(buf.Buffer === globalThis.Buffer, 'require("buffer").Buffer');
    ok(buf.Blob === globalThis.Blob, 'require("buffer").Blob');
    ok(buf.File === globalThis.File, 'require("buffer").File');
    const sd = require('string_decoder');
    ok(sd.StringDecoder === globalThis.StringDecoder, 'require("string_decoder")');
    let caught = null;
    try { require('nonexistent'); } catch (e) { caught = e; }
    ok(caught && caught.code === 'MODULE_NOT_FOUND', 'require unknown throws MODULE_NOT_FOUND');
    ok(typeof require.resolve === 'function', 'require.resolve');
    ok(require.resolve('os') === 'os', 'require.resolve passes id through');
});

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
_flush();
if (fail > 0) std.exit(1);
})();
