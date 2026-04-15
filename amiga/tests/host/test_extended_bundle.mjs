/* test_extended_bundle.mjs -- verify the refactored extended.js
 * correctly installs all features and exposes qjs.modules registry.
 *
 * Imports the bundle (which requires qjs:std + qjs:os; the --std flag
 * exposes those when running on host qjs).  After import, checks that
 * every declared feature installed its globals and is listed in the
 * qjs.modules registry.
 */

import '../../../quickjs-master/amiga/extended/extended.js';

let pass = 0, fail = 0;
const failures = [];
function check(cond, msg) {
    if (cond) pass++;
    else      { fail++; failures.push(msg); }
}

/* ---------- qjs namespace + registry ---------- */
check(typeof globalThis.qjs === 'object',        "globalThis.qjs exists");
check(globalThis.qjs.extended === true,          "qjs.extended === true");
check(typeof globalThis.qjs.version === 'string',"qjs.version is string");
check(typeof globalThis.qjs.modules === 'object',"qjs.modules exists");
check(typeof globalThis.qjs.modules.list === 'function', "qjs.modules.list()");
check(typeof globalThis.qjs.modules.get  === 'function', "qjs.modules.get()");
check(typeof globalThis.qjs.modules.has  === 'function', "qjs.modules.has()");

const all = globalThis.qjs.modules.list();
check(Array.isArray(all),                        "list() returns array");
check(all.length === 8,                          `list().length === 8 (got ${all.length})`);

/* Every built-in should be marked applied */
check(all.every(m => m.applied),                 "every feature applied");

/* ---------- Each feature's globals actually landed ---------- */
check(typeof globalThis.console.error  === 'function', "console.error");
check(typeof globalThis.console.warn   === 'function', "console.warn");
check(typeof globalThis.console.info   === 'function', "console.info");
check(typeof globalThis.console.debug  === 'function', "console.debug");
check(typeof globalThis.console.assert === 'function', "console.assert");
check(typeof globalThis.console.dir    === 'function', "console.dir");
check(typeof globalThis.console.table  === 'function', "console.table");
check(typeof globalThis.console.time   === 'function', "console.time");
check(typeof globalThis.console.timeEnd=== 'function', "console.timeEnd");
check(typeof globalThis.console.group  === 'function', "console.group");
check(typeof globalThis.console.groupEnd==='function', "console.groupEnd");
check(typeof globalThis.console.trace  === 'function', "console.trace");

check(typeof globalThis.process           === 'object',  "process");
check(globalThis.process.platform === 'amigaos',         "process.platform");
check(globalThis.process.arch === 'm68k',                "process.arch");
check(typeof globalThis.process.exit      === 'function',"process.exit");
check(typeof globalThis.process.hrtime    === 'function',"process.hrtime");
check(typeof globalThis.process.nextTick  === 'function',"process.nextTick");
check(typeof globalThis.process.env       === 'object',  "process.env");

check(typeof globalThis.queueMicrotask    === 'function',"queueMicrotask");
check(typeof globalThis.TextEncoder       === 'function',"TextEncoder");
check(typeof globalThis.TextDecoder       === 'function',"TextDecoder");
check(typeof globalThis.URL               === 'function',"URL");
check(typeof globalThis.URLSearchParams   === 'function',"URLSearchParams");
check(typeof globalThis.AbortController   === 'function',"AbortController");
check(typeof globalThis.AbortSignal       === 'function',"AbortSignal");
check(typeof globalThis.structuredClone   === 'function',"structuredClone");
check(typeof globalThis.path              === 'object',  "path");

/* ---------- Quick functional smoke ---------- */
const enc = new globalThis.TextEncoder().encode('hello');
check(enc.length === 5,                          "TextEncoder encode length");

const url = new globalThis.URL('https://example.com/a?q=1#f');
check(url.protocol === 'https:',                 "URL.protocol");
check(url.host === 'example.com',                "URL.host");
check(url.searchParams.get('q') === '1',         "URLSearchParams.get");

const ac = new globalThis.AbortController();
check(ac.signal.aborted === false,               "AbortController.signal pre");
ac.abort();
check(ac.signal.aborted === true,                "AbortController.signal post");

check(globalThis.path.join('RAM:', 'foo', 'bar') === 'RAM:foo/bar', "path.join Amiga");
check(globalThis.path.isAbsolute('RAM:') === true, "path.isAbsolute Amiga");
check(globalThis.path.basename('RAM:dir/f.txt') === 'f.txt', "path.basename");

const clone = globalThis.structuredClone({a: 1, b: [2,3]});
check(clone.a === 1 && clone.b.length === 2,    "structuredClone roundtrip");

/* ---------- Registry lookup ---------- */
const urlManifest = globalThis.qjs.modules.get('url');
check(urlManifest && urlManifest.tier === 'pure-js', "get('url').tier");
check(urlManifest.provider === 'nea-port',           "get('url').provider");
check(urlManifest.globals.includes('URL'),           "get('url').globals");
check(urlManifest.requires.includes('text-encoding'),"get('url').requires");
check(urlManifest.standard === true,                 "get('url').standard");

check(globalThis.qjs.modules.has('path') === true,   "has('path')");
check(globalThis.qjs.modules.has('bogus') === false, "!has('bogus')");

/* ---------- Dependency order was honoured (text-encoding before url) ---------- */
const names = all.map(m => m.name);
check(names.indexOf('text-encoding') < names.indexOf('url'),
      "dependency order (text-encoding before url)");

/* ---------- Report ---------- */
console.log(`extended.js bundle: ${pass} passed, ${fail} failed`);
if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  -', f);
    throw new Error(`${fail} bundle regressions`);
}
