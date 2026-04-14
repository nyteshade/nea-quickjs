/*
 * test_extended.js -- Exercises qjs -x / --extended APIs
 *
 * Run with: qjs -x tests/test_extended.js
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;

function ok(cond, msg) {
    if (cond) { print("  PASS:", msg); pass++; }
    else      { print("  FAIL:", msg); fail++; }
}

function eq(a, b, msg) {
    if (a === b) { print("  PASS:", msg); pass++; }
    else         { print("  FAIL:", msg, "  expected", JSON.stringify(b), "got", JSON.stringify(a)); fail++; }
}

/* ---- extended mode detection ---- */
print("\n=== Extended mode ===");
ok(globalThis.qjs && globalThis.qjs.extended === true, "qjs.extended is true");
ok(typeof globalThis.qjs.version === 'string', "qjs.version is a string");

/* ---- console.* ---- */
print("\n=== console.* ===");
ok(typeof console.error   === 'function', "console.error");
ok(typeof console.warn    === 'function', "console.warn");
ok(typeof console.info    === 'function', "console.info");
ok(typeof console.debug   === 'function', "console.debug");
ok(typeof console.assert  === 'function', "console.assert");
ok(typeof console.dir     === 'function', "console.dir");
ok(typeof console.table   === 'function', "console.table");
ok(typeof console.time    === 'function', "console.time");
ok(typeof console.timeEnd === 'function', "console.timeEnd");

/* ---- process ---- */
print("\n=== process ===");
ok(typeof process === 'object',            "process global exists");
eq(process.platform, 'amigaos',            "process.platform");
eq(process.arch,     'm68k',               "process.arch");
ok(Array.isArray(process.argv),            "process.argv is array");
ok(typeof process.env === 'object',        "process.env is object");
ok(typeof process.cwd() === 'string',      "process.cwd()");
ok(typeof process.exit === 'function',     "process.exit");
ok(Array.isArray(process.hrtime()),        "process.hrtime()");

/* ---- TextEncoder / TextDecoder ---- */
print("\n=== TextEncoder/TextDecoder ===");
const enc = new TextEncoder();
const bytes = enc.encode('hello');
eq(bytes.length, 5,   "encode 'hello' length");
eq(bytes[0],  104,    "encode 'hello'[0] = h");
eq(bytes[4],  111,    "encode 'hello'[4] = o");

const bytes2 = enc.encode('\u00e9');  /* é */
eq(bytes2.length, 2,  "encode 'é' is 2 bytes");
eq(bytes2[0], 0xC3,   "encode 'é' byte 0");
eq(bytes2[1], 0xA9,   "encode 'é' byte 1");

const dec = new TextDecoder();
eq(dec.decode(bytes), 'hello',   "decode UTF-8 'hello'");
eq(dec.decode(bytes2), '\u00e9', "decode UTF-8 'é'");

const dec_l1 = new TextDecoder('latin1');
eq(dec_l1.decode(new Uint8Array([0xE9])), '\u00e9', "decode Latin-1 0xE9 = é");

/* ---- path module ---- */
print("\n=== path module ===");
ok(typeof path === 'object',           "path global exists");
eq(path.sep, '/',                      "path.sep");
ok(path.isAbsolute('RAM:foo'),         "isAbsolute RAM:foo");
ok(path.isAbsolute('/foo'),            "isAbsolute /foo");
ok(!path.isAbsolute('foo'),            "!isAbsolute foo");
eq(path.basename('RAM:dir/file.txt'), 'file.txt',    "basename");
eq(path.basename('file.txt', '.txt'), 'file',        "basename with ext");
eq(path.dirname('RAM:dir/file.txt'), 'RAM:dir',      "dirname");
eq(path.extname('file.txt'), '.txt',                 "extname");
eq(path.extname('README'), '',                       "extname no ext");
eq(path.join('RAM:', 'foo', 'bar'), 'RAM:foo/bar',   "join");
eq(path.join('a', 'b', 'c'), 'a/b/c',                "join relative");
eq(path.join('a', '..', 'b'), 'b',                   "join with ..");
const parsed = path.parse('RAM:dir/file.txt');
eq(parsed.base, 'file.txt',     "parse.base");
eq(parsed.ext,  '.txt',         "parse.ext");
eq(parsed.name, 'file',         "parse.name");
eq(parsed.dir,  'RAM:dir',      "parse.dir");
eq(parsed.root, 'RAM:',         "parse.root");

/* ---- URL and URLSearchParams ---- */
print("\n=== URL ===");
const u = new URL('https://user:pass@example.com:8080/path/to?q=1&x=2#frag');
eq(u.protocol, 'https:',       "URL.protocol");
eq(u.hostname, 'example.com',  "URL.hostname");
eq(u.port,     '8080',         "URL.port");
eq(u.host,     'example.com:8080', "URL.host");
eq(u.pathname, '/path/to',     "URL.pathname");
eq(u.search,   '?q=1&x=2',     "URL.search");
eq(u.hash,     '#frag',        "URL.hash");
eq(u.username, 'user',         "URL.username");
eq(u.password, 'pass',         "URL.password");
eq(u.origin,   'https://example.com:8080', "URL.origin");

const sp = u.searchParams;
eq(sp.get('q'), '1',   "searchParams.get q");
eq(sp.get('x'), '2',   "searchParams.get x");
ok(sp.has('q'),        "searchParams.has q");
ok(!sp.has('missing'), "searchParams !has missing");
eq(sp.size, 2,         "searchParams.size");

sp.set('q', '42');
eq(sp.get('q'), '42',  "searchParams.set");

sp.delete('x');
ok(!sp.has('x'),       "searchParams.delete");

const u2 = new URL('https://example.com/a');
u2.searchParams.append('foo', 'bar');
eq(u2.toString(), 'https://example.com/a?foo=bar', "URL toString with searchParams");

ok(URL.canParse('https://example.com'),     "URL.canParse valid");
ok(!URL.canParse('not a url'),              "URL.canParse invalid");

/* ---- URLSearchParams direct use ---- */
const p = new URLSearchParams('a=1&b=2&a=3');
eq(p.get('a'), '1',    "URLSearchParams.get (first)");
eq(p.getAll('a').length, 2, "URLSearchParams.getAll length");
p.sort();
eq(p.get('a'), '1',    "URLSearchParams after sort");

/* ---- AbortController ---- */
print("\n=== AbortController ===");
const ac = new AbortController();
ok(ac.signal instanceof AbortSignal, "AbortSignal instance");
ok(!ac.signal.aborted,               "signal not yet aborted");

let fired = 0;
ac.signal.addEventListener('abort', () => fired++);
ac.abort();
ok(ac.signal.aborted,      "aborted after abort()");
eq(fired, 1,               "abort listener fired");

const ac2 = AbortSignal.abort('reason');
ok(ac2.aborted,            "AbortSignal.abort() aborted");

/* ---- queueMicrotask ---- */
print("\n=== queueMicrotask ===");
ok(typeof queueMicrotask === 'function', "queueMicrotask exists");

/* ---- structuredClone ---- */
print("\n=== structuredClone ===");
const orig = { a: 1, b: [2, 3], c: { d: 4 } };
const copy = structuredClone(orig);
eq(copy.a, 1,           "clone.a");
eq(copy.b.length, 2,    "clone.b.length");
eq(copy.c.d, 4,         "clone.c.d");
copy.a = 99;
eq(orig.a, 1,           "clone is independent");

/* ---- summary ---- */
print("\n=== Results:", pass, "passed,", fail, "failed ===");
if (fail > 0) std.exit(1);
