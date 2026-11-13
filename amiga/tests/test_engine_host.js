/*
 * test_engine_host.js -- the parts of the engine that only show in
 * quickjs.library: the globals that are loaded on first use, what
 * happens at the recursion limit, and WeakRef / FinalizationRegistry
 * across garbage collections.
 *
 * Companion of test_engine_conformance.js and of docs/NODEJS-DELTA.md,
 * "The engine itself". Unlike its siblings this file cannot be compared
 * with Node.js: the expected strings are what the library printed under
 * emulation on the night of 0.238, read through line by line. A change
 * here is a change of behaviour to be understood, not necessarily a
 * fault.
 *
 * WRONG ANSWERS FOUND ON 0.238 AND FIXED IN THE BUILD AFTER IT.
 *   - new WeakRef(obj).deref() was undefined in the same statement when
 *     nothing else referred to obj: the engine frees an object the
 *     moment its last reference goes, and nothing kept the target alive
 *     until the end of the job, as the language requires
 *     (AddToKeptObjects). Section 3.
 *   - registry.register(obj, held, obj), the usual way to register,
 *     kept obj alive for ever: the unregister token was held strongly.
 *     Its callback never ran.
 *   - obj = null; registry.unregister(token): unregister() returned
 *     false and the callback ran all the same, because the callback had
 *     been queued the moment obj was freed.
 *
 * WHAT WAS CHECKED AND FOUND RIGHT. Every global of the extended
 * features and of the FFI (URL, Buffer, process, Intuition, ...) is a
 * property that is filled in on first use. Before that first use it
 * already answers like an ordinary writable, enumerable, configurable
 * data property to getOwnPropertyDescriptor, in, hasOwnProperty,
 * Reflect.ownKeys, Object.keys, for-in, with, delete, defineProperty,
 * assignment and redeclaration (section 1). Object.freeze(globalThis)
 * was checked by hand and is not in this file, because nothing can run
 * after it: the global object reports frozen, assignments to it throw
 * in strict mode, the names used before stay usable and a name never
 * used before (FormData) still loads. A RangeError from too deep a
 * recursion can be caught in every kind of call, the engine works
 * afterwards and memory does not grow (section 2).
 *
 * HOW TO READ IT. One line per question: c(label, source, expected), or
 * ca(...) for a case that needs the event loop. The source is a function
 * taking the logger L; it is compiled by an indirect eval, so it is a
 * classic script in sloppy mode although this file is a module. The
 * expected string is the log joined with " | ", then "=> " and the value
 * returned, or "THROW " and the name of the error. Unless a comment says
 * otherwise the expected string is what Node.js 26 prints for the same
 * source. To add a case, add a line in the same form with the answer
 * Node.js gives. The file is long because it is a table.
 *
 * Run:  qjs amiga/tests/test_engine_host.js
 * Prints one PASS or FAIL line per check and a final count. Plain ASCII.
 */
import * as std from 'qjs:std';

let passed = 0;
let failed = 0;
const queued = [];

/**
 * Escape every character outside printable ASCII, and the backslash,
 * so that a rendering is the same on any console.
 * @param {string} s text to escape
 * @returns {string} ASCII-only text
 */
function esc(s) {
    var out = '', i, ch;
    for (i = 0; i < s.length; i++) {
        ch = s.charCodeAt(i);
        if (ch >= 32 && ch < 127 && ch !== 92) out += s[i];
        else out += '\\u' + ('0000' + ch.toString(16)).slice(-4);
    }
    return out;
}

/**
 * Render a value as one line of ASCII that distinguishes -0, holes,
 * BigInt, typed arrays and nested structure.
 * @param {*} v value to render
 * @returns {string} the rendering
 */
function show(v) {
    var parts, i, keys;
    if (typeof v === 'string') return '"' + esc(v) + '"';
    if (typeof v === 'bigint') return v.toString() + 'n';
    if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (typeof v === 'symbol') return esc(v.toString());
    if (v === null || v === undefined || typeof v === 'boolean') return String(v);
    if (typeof v === 'function') return 'function';
    if (Array.isArray(v)) {
        parts = [];
        for (i = 0; i < v.length; i++) parts.push(i in v ? show(v[i]) : '<hole>');
        return '[' + parts.join(',') + ']';
    }
    if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
        parts = [];
        for (i = 0; i < v.length; i++) parts.push(show(v[i]));
        return v.constructor.name + '[' + parts.join(',') + ']';
    }
    if (v instanceof Error) return v.name;
    if (v instanceof Date) return 'Date(' + v.getTime() + ')';
    if (v instanceof RegExp) return esc(String(v));
    keys = Object.keys(v);
    parts = [];
    for (i = 0; i < keys.length; i++) parts.push(esc(keys[i]) + ':' + show(v[keys[i]]));
    return '{' + parts.join(',') + '}';
}

/**
 * Record one comparison of two renderings.
 * @param {string} label name of the check
 * @param {string} got what the engine produced
 * @param {string} expected what it must produce
 * @returns {void}
 */
function compare(label, got, expected) {
    var at, from;
    if (got === expected) {
        passed++;
        print('PASS ' + label);
        return;
    }
    failed++;
    at = 0;
    while (at < got.length && at < expected.length && got[at] === expected[at]) at++;
    from = at > 30 ? at - 30 : 0;
    print('FAIL ' + label);
    print('     first difference at character ' + at);
    print('     got      ' + (from ? '...' : '') + got.slice(from, from + 120));
    print('     expected ' + (from ? '...' : '') + expected.slice(from, from + 120));
}

/**
 * Print a section heading.
 * @param {string} title what the following checks cover
 * @returns {void}
 */
function section(title) {
    print('');
    print('--- ' + title);
}

/**
 * Define the helper functions the following cases call. The source is
 * evaluated as a classic script, so its functions become globals,
 * which is where the cases (also classic scripts) look for them.
 * @param {string} src function declarations
 * @returns {void}
 */
function helpers(src) {
    (0, eval)(src);
}

/**
 * Make the logger of one case. It is passed to the case as L and is
 * also the global L, which the helper functions use.
 * @param {string[]} log receives one entry per call
 * @returns {function(*): void} the logger
 */
function logger(log) {
    return function (s) { log.push(String(s)); };
}

/**
 * Turn the log of a case and its result into one line.
 * @param {string[]} log what the case logged through L
 * @param {*} result what the case returned
 * @returns {string} the rendering
 */
function line(log, result) {
    if (result !== undefined) log.push('=> ' + show(result));
    return log.join(' | ');
}

/**
 * Run one case now. src is the source of a function taking the logger
 * L; it is compiled by an indirect eval, that is as a classic script
 * in sloppy mode, although this file is a module.
 * @param {string} label name of the check
 * @param {string} src source of function(L)
 * @param {string} expected the log, then "=> " and the result, or "THROW " and the error name
 * @returns {void}
 */
function c(label, src, expected) {
    var log = [], got;
    globalThis.L = logger(log);
    try {
        got = line(log, (0, eval)('(' + src + ')')(globalThis.L));
    } catch (e) {
        log.push('THROW ' + (e && e.name));
        got = log.join(' | ');
    }
    compare(label, got, expected);
}

/**
 * Queue one asynchronous case; drain() runs the queue in order.
 * @param {string} label name of the check
 * @param {string} src source of async function(L)
 * @param {string} expected as for c()
 * @returns {void}
 */
function ca(label, src, expected) {
    queued.push([label, src, expected]);
}

/**
 * Run the queued asynchronous cases one after the other. Called before
 * the helpers change and at the end.
 * @returns {Promise<void>} resolves when the queue is empty
 */
async function drain() {
    var item, log, got;
    while (queued.length > 0) {
        item = queued.shift();
        log = [];
        globalThis.L = logger(log);
        try {
            got = line(log, await (0, eval)('(' + item[1] + ')')(globalThis.L));
        } catch (e) {
            log.push('THROW ' + (e && e.name));
            got = log.join(' | ');
        }
        compare(item[0], got, item[2]);
    }
}

/**
 * Print the totals and leave with status 1 if anything failed.
 * @returns {void}
 */
function finish() {
    print('');
    print('=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
    if (failed > 0) std.exit(1);
}

print('=== Engine conformance: lazy globals, recursion limit, weak references ===');

section('1. Globals that are loaded on first use');
await drain();
helpers('var G = globalThis; function desc(name) { var d = Object.getOwnPropertyDescriptor(globalThis, name); if (!d) return \'none\'; return (\'value\' in d ? \'data:\' + typeof d.value : \'accessor\') + (d.writable ? \' w\' : \'\') + (d.enumerable ? \' e\' : \'\') + (d.configurable ? \' c\' : \'\') }');
c('lazy: gopd before use', 'L => [\'URL\', \'Buffer\', \'process\', \'TextEncoder\', \'URLSearchParams\', \'AbortController\', \'structuredClone\', \'EventTarget\', \'fetch\', \'queueMicrotask\', \'setTimeout\', \'console\', \'performance\', \'Intuition\', \'Exec\', \'DOMException\', \'Headers\', \'navigator\'].map(n => n + \'=\' + desc(n))', '=> ["URL=data:function w e c","Buffer=data:function w e c","process=data:object w e c","TextEncoder=data:function w e c","URLSearchParams=data:function w e c","AbortController=data:function w e c","structuredClone=data:function w e c","EventTarget=data:function w e c","fetch=data:function w e c","queueMicrotask=data:function w e c","setTimeout=data:function w e c","console=data:object w e c","performance=data:object w e c","Intuition=data:function w e c","Exec=data:function w e c","DOMException=data:function w c","Headers=none","navigator=data:object e c"]');
c('lazy: in / hasOwn before use', 'L => [\'Blob\', \'Event\', \'crypto\', \'atob\'].map(n => [n in G, Object.prototype.hasOwnProperty.call(G, n), Object.hasOwn(G, n), G.propertyIsEnumerable(n)])', '=> [[true,true,true,true],[true,true,true,true],[true,true,true,true],[false,false,false,false]]');
c('lazy: ownKeys includes lazies', 'L => { var k = Reflect.ownKeys(G); return [\'URL\', \'Buffer\', \'process\', \'TextDecoder\', \'Intuition\'].map(n => k.includes(n)) }', '=> [true,true,true,true,true]');
c('lazy: ownKeys no dup', 'L => { var k = Reflect.ownKeys(G).filter(x => typeof x == \'string\'); return k.length === new Set(k).size }', '=> true');
c('lazy: Object.keys enumerable lazies', 'L => Object.keys(G).filter(n => [\'URL\', \'Buffer\', \'process\', \'TextEncoder\', \'Intuition\', \'Exec\', \'fetch\'].includes(n))', '=> ["TextEncoder","URL","Buffer","process","fetch","Exec","Intuition"]');
c('lazy: for-in lazies', 'L => { var r = []; for (var k in G) if ([\'URL\', \'Buffer\', \'process\', \'Intuition\'].includes(k)) r.push(k); return r }', '=> ["URL","Buffer","process","Intuition"]');
c('lazy: typeof lazy then identity', 'L => { var a = typeof TextEncoder; var x = TextEncoder; return [a, x === G.TextEncoder, x === TextEncoder, desc(\'TextEncoder\')] }', '=> ["function",true,true,"data:function w e c"]');
c('lazy: assign before first use', 'L => { G.URLSearchParams = 5; var r = [URLSearchParams, desc(\'URLSearchParams\')]; return r }', '=> [5,"data:number w e c"]');
c('lazy: bare assign before first use', 'L => { Headers = \'mine\'; return [G.Headers, desc(\'Headers\')] }', '=> ["mine","data:string w e c"]');
c('lazy: delete before first use', 'L => { var r = [delete G.AbortController, \'AbortController\' in G, typeof G.AbortController, desc(\'AbortController\')]; return r }', '=> [true,false,"undefined","none"]');
c('lazy: defineProperty before first use', 'L => { Object.defineProperty(G, \'EventTarget\', { value: 1, writable: false, enumerable: true, configurable: false }); \'use strict\'; var r = [G.EventTarget, desc(\'EventTarget\')]; G.EventTarget = 2; r.push(G.EventTarget); return r }', '=> [1,"data:number e",1]');
c('lazy: defineProperty accessor before first use', 'L => { Object.defineProperty(G, \'Blob\', { get() { return \'got\' }, configurable: true }); return [Blob, desc(\'Blob\')] }', '=> ["got","accessor e c"]');
c('lazy: defineProperty partial (enumerable only)', 'L => { Object.defineProperty(G, \'Event\', { enumerable: true }); return [typeof Event, desc(\'Event\')] }', '=> ["function","data:function w e c"]');
c('lazy: Reflect.set / Reflect.get', 'L => [typeof Reflect.get(G, \'TextDecoder\'), Reflect.has(G, \'CustomEvent\'), Reflect.set(G, \'CustomEvent\', 7), G.CustomEvent, desc(\'CustomEvent\')]', '=> ["function",true,true,7,"data:number w e c"]');
c('lazy: with (globalThis)', 'L => { with (G) { return [typeof URL, typeof Buffer, typeof process, typeof atob] } }', '=> ["function","function","object","undefined"]');
c('lazy: var redeclare lazy (indirect eval)', 'L => { (0, eval)(\'var btoa\'); var a = typeof btoa; (0, eval)(\'var btoa = 3\'); return [a, btoa, desc(\'btoa\')] }', '=> ["undefined",3,"data:number w e c"]');
c('lazy: function redeclare lazy (indirect eval)', 'L => { (0, eval)(\'function atob() { return "mine" }\'); return [atob(), desc(\'atob\')] }', '=> ["mine","data:function w e c"]');
c('lazy: Object.assign / spread globalThis', 'L => { var c = { ...G }; return [\'URL\' in c, \'process\' in c] }', '=> [true,true]');
c('lazy: getOwnPropertyDescriptors', 'L => { var d = Object.getOwnPropertyDescriptors(G); return [typeof d.URL, d.URL && typeof d.URL.value, typeof (d.Buffer && (d.Buffer.value || d.Buffer.get))] }', '=> ["object","function","function"]');
c('lazy: JSON.stringify(globalThis) does not throw', 'L => { try { return typeof JSON.stringify(Object.keys(G)) } catch (e) { return e.name } }', '=> "string"');
c('lazy: process basics', 'L => [typeof process, typeof process.memoryUsage, typeof process.nextTick, typeof process.argv, desc(\'process\')]', '=> ["object","function","function","object","data:object w e c"]');
c('lazy: URL works after probes', 'L => new URL(\'http://a/b?c=1#d\').searchParams.get(\'c\')', '=> "1"');
c('lazy: Buffer works after probes', 'L => Buffer.from(\'hi\').toString(\'hex\')', '=> "6869"');
c('lazy: Intuition before/after', 'L => [typeof Intuition, desc(\'Intuition\'), typeof Exec, typeof Graphics, typeof DOS]', '=> ["function","data:function w e c","function","function","undefined"]');
c('lazy: structuredClone', 'L => typeof structuredClone', '=> "function"');
c('lazy: globalThis props', 'L => [desc(\'globalThis\'), desc(\'undefined\'), desc(\'NaN\'), desc(\'Infinity\'), desc(\'Array\'), desc(\'eval\'), Object.prototype.toString.call(G), Object.isExtensible(G), Object.getPrototypeOf(G) === Object.prototype]', '=> ["data:object w c","data:undefined","data:number","data:number","data:function w c","data:function w c","[object global]",true,true]');

section('2. The recursion limit: a RangeError that can be caught, and an engine that works afterwards');
await drain();
helpers('var gcf = typeof gc == \'function\' ? gc : null; function mem() { try { var m = process.memoryUsage(); return m.heapUsed || m.rss || 0 } catch (e) { return -1 } } function tick() { return new Promise(function (r) { Promise.resolve().then(function () { return Promise.resolve() }).then(r) }) }');
c('recursion RangeError catchable', 'L => { function r(n) { return r(n + 1) + 1 } try { r(0) } catch (e) { return [e.name, e instanceof RangeError, typeof e.message, typeof e.stack] } }', '=> ["RangeError",true,"string","string"]');
c('recursion depth sane', 'L => { var d = 0; function r() { d++; r() } try { r() } catch (e) { } return d > 100 }', '=> true');
c('engine usable after', 'L => { function r(n) { return r(n + 1) + 1 } for (var i = 0; i < 30; i++) { try { r(0) } catch (e) { } } return [1 + 1, [3, 1, 2].sort().join(), JSON.stringify({ a: [1] }), \'x\'.repeat(3)] }', '=> [2,"1,2,3","{"a":[1]}","xxx"]');
c('recursion kinds', 'L => { var out = []; var fns = { plain() { function r() { r() } r() }, arrow() { var r = () => r(); r() }, method() { var o = { m() { this.m() } }; o.m() }, getter() { var o = { get g() { return this.g } }; o.g }, ctor() { function C() { new C() } new C() }, classCtor() { class C { constructor() { new C() } } new C() }, apply() { function r() { r.apply(null, []) } r() }, call() { function r() { r.call(null) } r() }, bound() { var r = function () { b() }; var b = r.bind(null); b() }, proxyGet() { var p = new Proxy({}, { get(t, k, rc) { return rc[k] } }); p.x }, toString() { var o = { toString() { return \'\' + o } }; \'\' + o }, valueOf() { var o = { valueOf() { return +o } }; +o }, json() { var o = { toJSON() { return JSON.stringify(o) } }; JSON.stringify(o) }, sortCmp() { function r() { [2, 1].sort(() => { r(); return 0 }) } r() }, mapCb() { function r() { [1].map(r) } r() }, forEachCb() { function r() { [1].forEach(() => r()) } r() }, replaceCb() { function r() { \'a\'.replace(/a/, r) } r() }, generator() { function* g() { yield* g() } [...g()] }, spreadCall() { function r(...a) { r(...a) } r(1) }, evalRec() { function r() { eval(\'r()\') } r() }, newFunction() { var r = new Function(\'f\', \'f(f)\'); r(r) }, reflectApply() { function r() { Reflect.apply(r, null, []) } r() }, reflectConstruct() { function C() { Reflect.construct(C, []) } new C() }, instanceofRec() { var o = { [Symbol.hasInstance]() { return ({}) instanceof o } }; ({}) instanceof o }, iteratorRec() { var o = { [Symbol.iterator]() { return [...o][Symbol.iterator]() } }; [...o] }, templateRec() { function r() { return `${r()}` } r() }, deepArrayLiteral() { var s = \'[\'.repeat(20000) + \']\'.repeat(20000); eval(s) }, deepParens() { eval(\'(\'.repeat(20000) + \'1\' + \')\'.repeat(20000)) }, deepJSON() { JSON.parse(\'[\'.repeat(100000) + \']\'.repeat(100000)) }, deepStringify() { var o = {}, c = o; for (var i = 0; i < 100000; i++) c = c.a = {}; JSON.stringify(o) }, regexpNest() { new RegExp(\'(\'.repeat(20000) + \')\'.repeat(20000)) }, promiseThen() { var d = 0; function r() { return { then(f) { d++; r().then(f) } } } r().then(() => {}) }, tailPosition() { \'use strict\'; function r(n) { return n ? r(n - 1) : 0 } return r(1e5) }, deepConcat() { var a = []; for (var i = 0; i < 20000; i++) a = [a]; return String(a.flat(Infinity).length) }, deepToString() { var a = []; for (var i = 0; i < 20000; i++) a = [a]; return String(a).length }, deepEqualityCompare() { var a = {}; var c = a; for (var i = 0; i < 20000; i++) c = c.n = {}; return typeof structuredClone == \'function\' ? typeof structuredClone(a) : \'no sc\' } }; for (var k in fns) { try { var v = fns[k](); out.push(k + \':ok\') } catch (e) { out.push(k + \':\' + (e && e.name)) } } return out.join(\' \') }', '=> "plain:RangeError arrow:RangeError method:RangeError getter:RangeError ctor:RangeError classCtor:RangeError apply:RangeError call:RangeError bound:RangeError proxyGet:RangeError toString:RangeError valueOf:RangeError json:RangeError sortCmp:RangeError mapCb:RangeError forEachCb:RangeError replaceCb:RangeError generator:RangeError spreadCall:RangeError evalRec:RangeError newFunction:RangeError reflectApply:RangeError reflectConstruct:RangeError instanceofRec:RangeError iteratorRec:RangeError templateRec:RangeError deepArrayLiteral:RangeError deepParens:RangeError deepJSON:RangeError deepStringify:RangeError regexpNest:SyntaxError promiseThen:RangeError tailPosition:RangeError deepConcat:RangeError deepToString:RangeError deepEqualityCompare:ok"');
c('still usable', 'L => [Math.max(1, 2), new Map([[1, 2]]).get(1), /a+/.exec(\'caat\')[0]]', '=> [2,2,"aa"]');
c('memory after 200 overflows', 'L => { function r(n) { var a = [n, n, n]; return r(n + 1) + a.length } if (gcf) gcf(); var m0 = mem(); for (var i = 0; i < 100; i++) { try { r(0) } catch (e) { } } if (gcf) gcf(); var m1 = mem(); for (var i = 0; i < 100; i++) { try { r(0) } catch (e) { } } if (gcf) gcf(); var m2 = mem(); return [m0 >= 0, m1 - m0 < 300000, m2 - m1 < 60000, \'first100=\' + (m1 - m0 < 60000 ? \'flat\' : \'grew\'), \'second100=\' + (m2 - m1 < 60000 ? \'flat\' : \'grew\')] }', '=> [true,true,true,"first100=flat","second100=flat"]');
c('overflow inside try/finally', 'L => { var fin = 0; function r() { try { r() } finally { fin++ } } try { r() } catch (e) { return [e.name, fin > 100] } }', '=> ["RangeError",true]');
c('overflow error stack is bounded', 'L => { function r() { r() } try { r() } catch (e) { return e.stack.split(\'\\n\').length < 200 } }', '=> true');
c('tail calls not eliminated (stack grows)', 'L => { \'use strict\'; function r(n) { return n === 0 ? \'done\' : r(n - 1) } try { return r(1e6) } catch (e) { return e.name } }', '=> "RangeError"');
ca('overflow inside a generator and an async function', 'async L => { var res = []; function* g() { function r() { r() } try { r() } catch (e) { yield e.name } } res.push([...g()][0]); async function a() { function r() { r() } r() } try { await a() } catch (e) { res.push(\'rejected \' + e.name) } return res }', '=> ["RangeError","rejected RangeError"]');
ca('overflow 300 times in promise jobs: memory stays flat', 'async L => { function r(n) { var a = [n, n]; return r(n + 1) + a.length } if (gcf) gcf(); var m0 = mem(); for (var i = 0; i < 300; i++) { await null; try { r(0) } catch (e) { } } if (gcf) gcf(); var m1 = mem(); return [m0 > 0, m1 - m0 < 100000 ? \'flat\' : \'grew \' + (m1 - m0)] }', '=> [true,"flat"]');

section('3. WeakRef and FinalizationRegistry');
/* The first three are what Node.js prints as well. The rest depend on when the
   collector runs, which no two engines share: here an object without cycles
   is freed as soon as its last reference goes and the job that used it through
   a WeakRef has ended; a cycle is freed by gc(). */
c('WeakRef basics', 'L => { var o = {}; var w = new WeakRef(o); return [w.deref() === o, Object.prototype.toString.call(w), (() => { try { new WeakRef(1) } catch (e) { return e.name } })(), (() => { try { WeakRef({}) } catch (e) { return e.name } })(), (() => { try { new WeakRef(Symbol.for(\'x\')) } catch (e) { return e.name } })(), typeof new WeakRef(Symbol(\'local\')).deref(), WeakRef.length, WeakRef.prototype.constructor === WeakRef] }', '=> [true,"[object WeakRef]","TypeError","TypeError","TypeError","symbol",1,true]');
c('FinalizationRegistry basics', 'L => { var fr = new FinalizationRegistry(() => { }); var tok = {}; var o = {}; return [fr.register(o, 1, tok), fr.unregister(tok), fr.unregister(tok), (() => { try { fr.register(o, o) } catch (e) { return e.name } })(), (() => { try { fr.register(1, 1) } catch (e) { return e.name } })(), (() => { try { fr.unregister(1) } catch (e) { return e.name } })(), (() => { try { new FinalizationRegistry(1) } catch (e) { return e.name } })(), Object.prototype.toString.call(fr), FinalizationRegistry.length, typeof fr.cleanupSome] }', '=> [undefined,true,false,"TypeError","TypeError","TypeError","TypeError","[object FinalizationRegistry]",1,"undefined"]');
c('deref in same job stays', 'L => { var w = (() => new WeakRef({}))(); if (gcf) gcf(); return typeof w.deref() }', '=> "object"');
c('WeakRef: target alive for the rest of the job that created or dereferenced it', 'L => { var w = new WeakRef({ v: 1 }); var a = w.deref().v; if (gcf) gcf(); var s = new WeakRef(Symbol(\'local\')); return [a, typeof w.deref(), typeof s.deref()] }', '=> [1,"object","symbol"]');
ca('WeakRef: target gone once the job has ended', 'async L => { var w = (() => new WeakRef({}))(); var same = typeof w.deref(); await null; return [same, typeof w.deref()] }', '=> ["object","undefined"]');
ca('WeakRef: deref in a later job keeps a live target for that job only', 'async L => { var o = {}; var w = new WeakRef(o); await null; var a = typeof w.deref(); o = null; var b = typeof w.deref(); await null; return [a, b, typeof w.deref()] }', '=> ["object","object","undefined"]');
ca('WeakRef: a cycle stays until gc()', 'async L => { var w = (() => { var a = {}, b = { a }; a.b = b; return new WeakRef(a) })(); await null; await null; var before = typeof w.deref(); await null; gcf(); await null; return [before, typeof w.deref()] }', '=> ["object","undefined"]');
ca('FinalizationRegistry: the callback runs as a job, once per collected target', 'async L => { var log = []; var fr = new FinalizationRegistry(v => log.push(v)); var keep = {}; (() => { fr.register({}, \'a\'); fr.register({}, \'b\'); fr.register(keep, \'kept\') })(); var atOnce = log.length; await tick(); return [atOnce, log.slice().sort(), typeof keep] }', '=> [0,["a","b"],"object"]');
ca('FinalizationRegistry: register(obj, held, obj) does not keep obj alive', 'async L => { var log = []; var fr = new FinalizationRegistry(v => log.push(v)); (() => { var o = {}; fr.register(o, \'token is target\', o) })(); await tick(); return log }', '=> ["token is target"]');
ca('FinalizationRegistry: the token is held weakly, also when it refers to the target', 'async L => { var log = []; var fr = new FinalizationRegistry(v => log.push(v)); (() => { var o = {}; fr.register(o, \'token dropped\', {}); var o2 = {}; fr.register(o2, \'token refers to target\', { o2 }) })(); await tick(); gcf(); await tick(); return log.sort() }', '=> ["token dropped","token refers to target"]');
ca('FinalizationRegistry: unregister after the target died cancels the callback', 'async L => { var log = []; var fr = new FinalizationRegistry(v => log.push(v)); var tok = {}; (() => { fr.register({}, \'must not run\', tok) })(); var r = [fr.unregister(tok), fr.unregister(tok)]; await tick(); return [r, log] }', '=> [[true,false],[]]');
ca('FinalizationRegistry: unregister while alive, by token and by target', 'async L => { var log = []; var fr = new FinalizationRegistry(v => log.push(v)); var a = {}, tok = {}, b = {}; fr.register(a, \'a\', tok); fr.register(b, \'b\', b); var r = [fr.unregister(tok), fr.unregister(b), fr.unregister({})]; a = null; b = null; await tick(); return [r, log] }', '=> [[true,true,false],[]]');
ca('FinalizationRegistry: one token for several targets, dead and alive', 'async L => { var log = []; var fr = new FinalizationRegistry(v => log.push(v)); var tok = {}, keep = {}; (() => { fr.register({}, \'dead 1\', tok); fr.register({}, \'dead 2\', tok) })(); fr.register(keep, \'alive\', tok); var r = fr.unregister(tok); keep = null; await tick(); return [r, log] }', '=> [true,[]]');
ca('FinalizationRegistry: the token dies first, the callback still runs', 'async L => { var log = []; var fr = new FinalizationRegistry(v => log.push(v)); var t = {}; (() => { fr.register(t, \'ran\', {}) })(); await tick(); var before = log.length; t = null; await tick(); return [before, log] }', '=> [0,["ran"]]');
ca('FinalizationRegistry: unregister and register inside the callback', 'async L => { var log = []; var tok = {}; var fr = new FinalizationRegistry(v => { log.push(v); fr.unregister(tok); if (v == \'first\') fr.register({}, \'registered in callback\') }); (() => { fr.register({}, \'first\', tok); fr.register({}, \'second\', tok) })(); await tick(); await tick(); return log }', '=> ["first","registered in callback"]');
ca('FinalizationRegistry: a cycle is reported after gc()', 'async L => { var log = []; var fr = new FinalizationRegistry(v => log.push(v)); (() => { var a = {}, b = { a }; a.b = b; fr.register(a, \'cycle\', a) })(); await tick(); var before = log.slice(); gcf(); await tick(); return [before, log] }', '=> [[],["cycle"]]');
ca('FinalizationRegistry: 1000 registrations, a third unregistered', 'async L => { var n = 0; var fr = new FinalizationRegistry(() => n++); for (var i = 0; i < 1000; i++) { var o = { i }; fr.register(o, i, o); if (i % 3 == 0) fr.unregister(o) } o = null; await tick(); await tick(); return n }', '=> 666');
ca('WeakMap: a value held only by its key goes with the key', 'async L => { var wm = new WeakMap(); var wr; var k = {}; (() => { var v = { big: 1 }; wm.set(k, v); wr = new WeakRef(v) })(); await null; var held = typeof wr.deref(); await null; k = null; await null; gcf(); await null; return [held, typeof wr.deref()] }', '=> ["object","undefined"]');
ca('memory: 2000 WeakRefs, registry entries and WeakMap entries are freed', 'async L => { var wm = new WeakMap(), ws = new WeakSet(); gcf(); var m0 = mem(); for (var round = 0; round < 4; round++) { var fr = new FinalizationRegistry(() => { }); for (var i = 0; i < 500; i++) { var o = { i }; new WeakRef(o); fr.register(o, i); wm.set(o, i); ws.add(o) } fr = null; o = null; await null; gcf() } await new Promise(r => setTimeout(r, 10)); gcf(); var m1 = mem(); return m1 - m0 < 100000 ? \'flat\' : \'grew \' + (m1 - m0) }', '=> "flat"');

section('4. this build: no time zone');
/* AmigaOS keeps local time and has no time zone database: the engine treats the
   clock as UTC. getTimezoneOffset() is 0 for every date, there is no daylight
   saving time, and local and UTC accessors agree. */
c('this build: local time is UTC, no daylight saving time', 'L => { var offs = []; for (var m = 0; m < 12; m++) offs.push(new Date(2021, m, 15, 12).getTimezoneOffset()); var d = new Date(2021, 5, 7, 8, 9, 10); return [offs.every(o => o === 0), d.toISOString(), new Date(0).getHours(), d.getHours() === d.getUTCHours(), new Date(2021, 2, 28, 2, 30).getHours(), new Date(2021, 9, 31, 2, 30).getHours(), /GMT\\+0000/.test(String(d))] }', '=> [true,"2021-06-07T08:09:10.000Z",0,true,2,2,true]');

await drain();
finish();
