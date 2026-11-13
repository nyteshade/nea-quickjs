/*
 * test_engine_iterators.js -- when is an iterator closed, and is its
 * return() awaited? for-of, for-await, destructuring, spread, yield*,
 * Array.from, Array.fromAsync, the Map/Set constructors, groupBy and the
 * Iterator helpers.
 *
 * Companion of test_engine_conformance.js and of docs/NODEJS-DELTA.md,
 * "The engine itself".
 *
 * WRONG ANSWERS FOUND ON 0.238 AND FIXED IN THE BUILD AFTER IT. All were
 * in the upstream engine and showed on any machine.
 *   - An exception thrown out of a 'for await' body called the
 *     iterator's return() and did not wait for it; a promise return()
 *     rejected with was reported as an unhandled rejection.
 *   - An iterator whose next() threw (or returned a broken result) was
 *     closed all the same, by spread, Array.from, the Map, Set, WeakMap
 *     and WeakSet constructors, typed array construction, every
 *     Iterator helper, and 'for await'. It must not be: closing is for
 *     the consumer that stops early.
 *   - Object.groupBy and Map.groupBy did not close the iterator when
 *     the callback threw.
 *   - Array.fromAsync closed the iterator after a normal end and after
 *     a failed next(), never awaited return(), and made elements that
 *     Object.keys() did not list.
 *   - iterator.map(f), iterator.filter(f) and iterator.find(f) leaked
 *     every item they handled (found with the leak check of the debug
 *     build; not visible to a script except as memory that never comes
 *     back).
 *
 * The thrown errors are told apart by their type: the loop body throws
 * RangeError, return() throws SyntaxError or rejects with URIError,
 * next() throws EvalError.
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
 * Run:  qjs amiga/tests/test_engine_iterators.js
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

print('=== Engine conformance: iterators ===');

section('1. for-of, destructuring, spread, yield*: closing on break, return, throw');
await drain();
helpers('function mk(n, opts) { opts = opts || {}; var i = 0; return { [Symbol.iterator]() { return this }, next() { L(\'next\'); if (opts.nextThrows && i == opts.nextThrows) throw new EvalError(\'next-err\'); return { done: i >= n, value: i++ } }, return(v) { L(\'return\'); if (opts.retThrows) throw new SyntaxError(\'ret-err\'); if (opts.retPrim) return 1; return {} } }; } function amk(n, opts) { opts = opts || {}; var i = 0; return { [Symbol.asyncIterator]() { return this }, next() { L(\'next\'); return Promise.resolve({ done: i >= n, value: i++ }) }, return(v) { L(\'return\'); if (opts.retThrows) throw new SyntaxError(\'ret-err\'); if (opts.retRejects) return Promise.reject(new URIError(\'ret-rej\')); if (opts.retPrim) return Promise.resolve(1); return new Promise(r => { Promise.resolve().then(() => Promise.resolve()).then(() => { L(\'return settled\'); r({}) }) }) } }; }');
c('for-of throw', '() => { for (var x of mk(3)) { throw new RangeError(\'body\') } }', 'next | return | THROW RangeError');
c('for-of throw, return throws', '() => { for (var x of mk(3, {retThrows: 1})) { throw new RangeError(\'body\') } }', 'next | return | THROW RangeError');
c('for-of throw, return prim', '() => { for (var x of mk(3, {retPrim: 1})) { throw new RangeError(\'body\') } }', 'next | return | THROW RangeError');
c('for-of break, return throws', '() => { for (var x of mk(3, {retThrows: 1})) { break } }', 'next | return | THROW SyntaxError');
c('for-of break, return prim', '() => { for (var x of mk(3, {retPrim: 1})) { break } }', 'next | return | THROW TypeError');
c('for-of return', '() => { return (function(){ for (var x of mk(3)) { return 7 } })() }', 'next | return | => 7');
c('for-of continue outer', '() => { o: for (var y of [1,2]) for (var x of mk(3)) { continue o } }', 'next | return | next | return');
c('for-of next throws', '() => { for (var x of mk(3, {nextThrows: 1})) { } }', 'next | next | THROW EvalError');
c('for-of destructure target throws', '() => { for (var [x] of [1]) { } }', 'THROW TypeError');
c('for-of lhs setter throws', '() => { var o = { set p(v) { throw new Error(\'set\') } }; for (o.p of mk(3)) { } }', 'next | return | THROW Error');
c('destr 1', '() => { var [a] = mk(3); return a }', 'next | return | => 0');
c('destr exhaust', '() => { var [a, b, c, d] = mk(3); return [a,b,c,d] }', 'next | next | next | next | => [0,1,2,undefined]');
c('destr rest', '() => { var [a, ...r] = mk(3); return r }', 'next | next | next | next | => [1,2]');
c('destr empty', '() => { var [] = mk(3); }', 'return');
c('destr elision', '() => { var [, ,] = mk(3); }', 'next | next | return');
c('destr default throws', '() => { var [a = (() => { throw new Error(\'dflt\') })()] = mk(0); }', 'next | THROW Error');
c('destr default throws 2', '() => { var [a, b = (() => { throw new Error(\'dflt\') })()] = [1]; var it = mk(3); var [x, y = (() => { throw new Error(\'dflt2\') })()] = { [Symbol.iterator]() { var j = 0; return { next() { L(\'next\'); return { done: false, value: j++ ? undefined : 1 } }, return() { L(\'return\'); return {} } } } }; }', 'THROW Error');
c('destr assign target throws', '() => { var o = { set p(v) { throw new Error(\'set\') } }; [o.p] = mk(3); }', 'next | return | THROW Error');
c('destr assign target throws, ret throws', '() => { var o = { set p(v) { throw new Error(\'set\') } }; [o.p] = mk(3, {retThrows: 1}); }', 'next | return | THROW Error');
c('destr return throws', '() => { var [a] = mk(3, {retThrows: 1}); }', 'next | return | THROW SyntaxError');
c('destr return prim', '() => { var [a] = mk(3, {retPrim: 1}); }', 'next | return | THROW TypeError');
c('destr next throws', '() => { var [a, b] = mk(3, {nextThrows: 1}); }', 'next | next | THROW EvalError');
c('destr nested throws', '() => { var [[a]] = mk(3); }', 'next | return | THROW TypeError');
c('destr in param', '() => { (function([a]) {})(mk(3)) }', 'next | return');
c('spread throws midway', '() => { return [...mk(3, {nextThrows: 2})] }', 'next | next | next | THROW EvalError');
c('spread call', '() => { return Math.max(...mk(3)) }', 'next | next | next | next | => 2');
c('Array.from mapper throws', '() => { return Array.from(mk(3), (v) => { if (v == 1) throw new Error(\'map\'); return v }) }', 'next | next | return | THROW Error');
c('Array.from next throws', '() => { return Array.from(mk(3, {nextThrows: 1})) }', 'next | next | THROW EvalError');
c('new Map entry not object', '() => { return new Map(mk(3)) }', 'next | return | THROW TypeError');
c('new Set add throws', '() => { class S extends Set { add(v) { throw new Error(\'add\') } } return new S(mk(3)) }', 'next | return | THROW Error');
c('Promise.all resolve throws', '() => { var C = function(ex) { return new Promise(ex) }; return typeof Promise.all.call(Promise, mk(1)) }', 'next | next | => "object"');
c('Object.fromEntries bad', '() => { return Object.fromEntries(mk(2)) }', 'next | return | THROW TypeError');
c('yield* return', '() => { function* g() { yield* mk(3) } var it = g(); it.next(); return it.return(5) }', 'next | return | => {}');
c('yield* throw no throw method', '() => { function* g() { yield* mk(3) } var it = g(); it.next(); return it.throw(new Error(\'t\')) }', 'next | return | THROW TypeError');
c('yield* throw with method', '() => { function* inner() { try { yield 1; yield 2 } catch (e) { L(\'inner caught \' + e.message); yield 99 } finally { L(\'inner finally\') } } function* g() { yield* inner() } var it = g(); it.next(); var r = it.throw(new Error(\'t\')); return [r, it.next()] }', 'inner caught t | inner finally | => [{value:99,done:false},{value:undefined,done:true}]');
c('yield* return through finally', '() => { function* inner() { try { yield 1 } finally { L(\'inner finally\'); yield \'f\' } } function* g() { try { yield* inner() } finally { L(\'outer finally\') } } var it = g(); it.next(); return [it.return(5), it.next(), it.next()] }', 'inner finally | outer finally | => [{value:"f",done:false},{value:undefined,done:true},{value:undefined,done:true}]');
c('yield* return prim result', '() => { function* g() { yield* mk(3, {retPrim: 1}) } var it = g(); it.next(); return it.return(5) }', 'next | return | THROW TypeError');
c('gen return in for-of', '() => { function* g() { try { yield 1; yield 2 } finally { L(\'gen finally\') } } for (var x of g()) { break } }', 'gen finally');
c('gen throw in for-of', '() => { function* g() { try { yield 1; yield 2 } finally { L(\'gen finally\') } } for (var x of g()) { throw new RangeError(\'body\') } }', 'gen finally | THROW RangeError');
c('gen finally throws on break', '() => { function* g() { try { yield 1 } finally { throw new Error(\'fin\') } } for (var x of g()) { break } }', 'THROW Error');
c('gen finally throws on throw', '() => { function* g() { try { yield 1 } finally { throw new Error(\'fin\') } } for (var x of g()) { throw new RangeError(\'body\') } }', 'THROW RangeError');
c('try-finally in for-of', '() => { for (var x of mk(3)) { try { throw new RangeError(\'body\') } finally { L(\'finally\') } } }', 'next | finally | return | THROW RangeError');
c('try-catch in for-of, break in catch', '() => { for (var x of mk(3)) { try { throw new RangeError(\'body\') } catch (e) { break } } }', 'next | return');
c('nested for-of throw', '() => { for (var x of mk(3)) for (var y of mk(2)) throw new RangeError(\'body\') }', 'next | next | return | return | THROW RangeError');
c('for-of throw in fn called', '() => { function boom() { throw new Error(\'deep\') } for (var x of mk(3)) boom() }', 'next | return | THROW Error');
c('for-of iterator no return', '() => { var it = { [Symbol.iterator]() { return this }, next() { return { done: false, value: 1 } } }; for (var x of it) throw new RangeError(\'body\') }', 'THROW RangeError');
c('for-of return getter throws on throw', '() => { var it = { [Symbol.iterator]() { return this }, next() { return { done: false, value: 1 } }, get return() { L(\'get return\'); throw new Error(\'getter\') } }; for (var x of it) throw new RangeError(\'body\') }', 'get return | THROW RangeError');
c('for-of return getter throws on break', '() => { var it = { [Symbol.iterator]() { return this }, next() { return { done: false, value: 1 } }, get return() { L(\'get return\'); throw new Error(\'getter\') } }; for (var x of it) break }', 'get return | THROW Error');
c('for-of return not callable on break', '() => { var it = { [Symbol.iterator]() { return this }, next() { return { done: false, value: 1 } }, return: 1 }; for (var x of it) break }', 'THROW TypeError');
c('for-of return null on break', '() => { var it = { [Symbol.iterator]() { return this }, next() { return { done: false, value: 1 } }, return: null }; for (var x of it) break; return \'fine\' }', '=> "fine"');

section('2. for await: return() is awaited on every early exit, also on throw');
ca('for-await throw', 'async () => { for await (var x of amk(3)) { throw new RangeError(\'body\') } }', 'next | return | return settled | THROW RangeError');
ca('for-await throw then order', 'async () => { var p = (async () => { for await (var x of amk(3)) { throw new RangeError(\'body\') } })(); p.catch(() => L(\'rejected\')); await 0; await 0; L(\'two ticks later\'); try { await p } catch (e) {} }', 'next | return | two ticks later | return settled | rejected');
ca('for-await throw, return throws', 'async () => { for await (var x of amk(3, {retThrows: 1})) { throw new RangeError(\'body\') } }', 'next | return | THROW RangeError');
ca('for-await throw, return rejects', 'async () => { for await (var x of amk(3, {retRejects: 1})) { throw new RangeError(\'body\') } }', 'next | return | THROW RangeError');
ca('for-await throw, return prim', 'async () => { for await (var x of amk(3, {retPrim: 1})) { throw new RangeError(\'body\') } }', 'next | return | THROW RangeError');
ca('for-await break, return rejects', 'async () => { for await (var x of amk(3, {retRejects: 1})) { break } }', 'next | return | THROW URIError');
ca('for-await break, return prim', 'async () => { for await (var x of amk(3, {retPrim: 1})) { break } }', 'next | return | THROW TypeError');
ca('for-await break', 'async () => { for await (var x of amk(3)) { break } return \'after\' }', 'next | return | return settled | => "after"');
ca('for-await over sync iter throw', 'async () => { for await (var x of mk(3)) { throw new RangeError(\'body\') } }', 'next | return | THROW RangeError');
ca('for-await over sync iter break', 'async () => { for await (var x of mk(3)) { break } }', 'next | return');
ca('for-await in async gen throw', 'async () => { async function* g() { for await (var x of amk(3)) { throw new RangeError(\'body\') } } var it = g(); return await it.next() }', 'next | return | return settled | THROW RangeError');
ca('for-await in async gen yield then return', 'async () => { async function* g() { for await (var x of amk(3)) { yield x } } var it = g(); await it.next(); return await it.return(9) }', 'next | return | return settled | => {value:9,done:true}');
ca('for-await in async gen yield then throw', 'async () => { async function* g() { for await (var x of amk(3)) { yield x } } var it = g(); await it.next(); return await it.throw(new Error(\'thrown in\')) }', 'next | return | return settled | THROW Error');
ca('for-await try/finally inside', 'async () => { for await (var x of amk(3)) { try { throw new RangeError(\'body\') } finally { L(\'finally\') } } }', 'next | finally | return | return settled | THROW RangeError');
ca('for-await try/catch around', 'async () => { try { for await (var x of amk(3)) { throw new RangeError(\'body\') } } catch (e) { L(\'inner caught\'); } return \'done\' }', 'next | return | return settled | inner caught | => "done"');
ca('for-await nested', 'async () => { for await (var x of amk(3)) for await (var y of amk(2)) throw new RangeError(\'body\') }', 'next | next | return | return settled | return | return settled | THROW RangeError');
ca('for-await throw in callee', 'async () => { async function boom() { await 0; throw new Error(\'deep\') } for await (var x of amk(3)) await boom() }', 'next | return | return settled | THROW Error');
ca('async gen yield* return', 'async () => { async function* g() { yield* amk(3) } var it = g(); await it.next(); return await it.return(5) }', 'next | return | return settled | => {value:undefined,done:false}');
ca('async gen yield* throw no method', 'async () => { async function* g() { yield* amk(3) } var it = g(); await it.next(); return await it.throw(new Error(\'t\')) }', 'next | return | return settled | THROW TypeError');
ca('async gen yield* sync inner throw', 'async () => { async function* g() { yield* mk(3) } var it = g(); await it.next(); return await it.throw(new Error(\'t\')) }', 'next | return | THROW TypeError');
ca('for-await destructure', 'async () => { for await (var [a] of amk(1)) { } }', 'next | return | return settled | THROW TypeError');
ca('for-await next rejects: not closed', 'async L => { var it = { [Symbol.asyncIterator]() { return this }, next() { L(\'next\'); return Promise.reject(new EvalError(\'n\')) }, return() { L(\'return\'); return {} } }; for await (var x of it) { } }', 'next | THROW EvalError');
ca('for-await next throws: not closed', 'async L => { var it = { [Symbol.asyncIterator]() { return this }, next() { L(\'next\'); throw new EvalError(\'n\') }, return() { L(\'return\'); return {} } }; for await (var x of it) { } }', 'next | THROW EvalError');
ca('for-await next result not an object: not closed', 'async L => { var it = { [Symbol.asyncIterator]() { return this }, next() { L(\'next\'); return Promise.resolve(5) }, return() { L(\'return\'); return {} } }; for await (var x of it) { } }', 'next | THROW TypeError');
ca('for-await done getter throws: not closed', 'async L => { var it = { [Symbol.asyncIterator]() { return this }, next() { L(\'next\'); return { get done() { throw new EvalError(\'d\') } } }, return() { L(\'return\'); return {} } }; for await (var x of it) { } }', 'next | THROW EvalError');
ca('for-await throw, return getter throws: body error wins', 'async L => { var it = { [Symbol.asyncIterator]() { return this }, next() { return { done: false, value: 1 } }, get return() { L(\'get return\'); throw new SyntaxError(\'g\') } }; for await (var x of it) { throw new RangeError(\'body\') } }', 'get return | THROW RangeError');
ca('for-await throw, no return method', 'async L => { var it = { [Symbol.asyncIterator]() { return this }, next() { return { done: false, value: 1 } } }; for await (var x of it) { throw new RangeError(\'body\') } }', 'THROW RangeError');
ca('for-await throw: rejection of return() is swallowed', 'async L => { var seen = \'none\'; var it = amk(3, { retRejects: 1 }); try { for await (var x of it) { throw new RangeError(\'body\') } } catch (e) { seen = e.name } await 0; await 0; return seen }', 'next | return | => "RangeError"');
ca('for-await throw inside nested try/finally with await', 'async L => { try { for await (var x of amk(2)) { try { throw new RangeError(\'body\') } finally { await 0; L(\'inner finally\') } } } catch (e) { L(\'caught \' + e.name) } finally { L(\'outer finally\') } }', 'next | inner finally | return | return settled | caught RangeError | outer finally');
ca('for-await labelled continue outer and throw', 'async L => { try { o: for (var i = 0; i < 2; i++) { for await (var x of amk(2)) { if (i == 0) continue o; throw new RangeError(\'body\') } } } catch (e) { L(\'caught \' + e.name) } }', 'next | return | return settled | next | return | return settled | caught RangeError');
ca('for-await in async generator: throw() while suspended in the loop', 'async L => { async function* g() { try { for await (var x of amk(3)) { yield x } } finally { L(\'gen finally\') } } var it = g(); await it.next(); try { await it.throw(new RangeError(\'in\')) } catch (e) { L(\'caught \' + e.name) } return await it.next() }', 'next | return | return settled | gen finally | caught RangeError | => {value:undefined,done:true}');

section('3. Builtins that consume an iterator: a failed next() does not close it, a failing callback does');
/* Object.fromEntries and Iterator.concat: V8 calls return() after a next() that
   threw. The specification does not (AddEntriesFromIterable and Iterator.concat
   use IteratorStepValue with '?'), and this engine follows it. */
await drain();
helpers('function bad(kind, first) { var i = 0; var it = Object.create(Iterator.prototype); it[Symbol.iterator] = function() { return this }; it.next = function() { L(\'next\'); i++; if (i == 1) return { done: false, value: first === undefined ? [1, 2] : first }; if (kind == \'next\') throw new EvalError(\'next-err\'); if (kind == \'result\') return 5; if (kind == \'done\') return { get done() { throw new EvalError(\'done-err\') }, value: [3, 4] }; if (kind == \'value\') return { done: false, get value() { throw new EvalError(\'value-err\') } }; if (kind == \'cb\') return { done: false, value: [5, 6] }; return { done: true } }; it.return = function() { L(\'return\'); return {} }; return it; } function kinds(f) { [\'next\', \'result\', \'done\', \'value\'].forEach(function (kind) { L(\'[\' + kind + \']\'); try { f(bad(kind), kind); L(\'ok\') } catch (e) { L(e && e.name) } }) } function cbt(f) { try { f(bad(\'cb\')); L(\'ok\') } catch (e) { L(e && e.name) } } function boom() { throw new RangeError(\'cb\') }');
c('spread', '() => kinds((it) => [...it])', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('spread call', '() => kinds((it) => (function(){})(...it))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('new spread', '() => kinds((it) => new Array(...it))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Array.from', '() => kinds((it) => Array.from(it))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('destructure', '() => kinds((it) => { var [a, b, c] = it })', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('destructure rest', '() => kinds((it) => { var [a, ...c] = it })', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('for-of', '() => kinds((it) => { for (var x of it); })', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('yield*', '() => kinds((it) => { function* g() { yield* it } for (var x of g()); })', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('new Map', '() => kinds((it) => new Map(it))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('new Set', '() => kinds((it) => new Set(it))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('new WeakSet', '() => kinds((it, k) => new WeakSet(bad(k, {})))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Object.fromEntries', '() => kinds((it) => Object.fromEntries(it))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Object.groupBy', '() => kinds((it) => Object.groupBy(it, x => \'k\'))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Map.groupBy', '() => kinds((it) => Map.groupBy(it, x => \'k\'))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Uint8Array.from', '() => kinds((it, k) => Uint8Array.from(bad(k, 1)))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('new Uint8Array', '() => kinds((it, k) => new Uint8Array(bad(k, 1)))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator toArray', '() => kinds((it) => it.toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator map', '() => kinds((it) => it.map(x => x).toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator filter', '() => kinds((it) => it.filter(x => true).toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator take', '() => kinds((it) => it.take(5).toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator drop', '() => kinds((it) => it.drop(1).toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator drop0', '() => kinds((it) => it.drop(0).toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator flatMap', '() => kinds((it) => it.flatMap(x => [x]).toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator reduce', '() => kinds((it) => it.reduce((a, b) => a))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator reduce init', '() => kinds((it) => it.reduce((a, b) => a, 0))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator forEach', '() => kinds((it) => it.forEach(x => x))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator some', '() => kinds((it) => it.some(x => false))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator every', '() => kinds((it) => it.every(x => true))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator find', '() => kinds((it) => it.find(x => false))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator.from', '() => kinds((it) => Iterator.from({ [Symbol.iterator]() { return it } }).toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator.from wrap', '() => kinds((it, k) => { var raw = bad(k); Object.setPrototypeOf(raw, null); raw[Symbol.iterator] = function() { return this }; return Iterator.from(raw).toArray() })', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Iterator.concat', '() => kinds((it) => Iterator.concat(it).toArray())', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Set.union', '() => kinds((it) => new Set([1]).union({ size: 3, has() { return false }, keys() { return it } }))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Set.isSupersetOf', '() => kinds((it, k) => new Set([1, 2]).isSupersetOf({ size: 2, has() { return true }, keys() { return bad(k, 1) } }))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Set.isDisjointFrom', '() => kinds((it, k) => new Set([7, 8, 9]).isDisjointFrom({ size: 2, has() { return true }, keys() { return bad(k, 1) } }))', '[next] | next | next | EvalError | [result] | next | next | TypeError | [done] | next | next | EvalError | [value] | next | next | EvalError');
c('Promise.all', '() => kinds((it, k) => { Promise.all(bad(k, 1)).catch(() => {}) })', '[next] | next | next | ok | [result] | next | next | ok | [done] | next | next | ok | [value] | next | next | ok');
c('Promise.allSettled', '() => kinds((it, k) => { Promise.allSettled(bad(k, 1)).catch(() => {}) })', '[next] | next | next | ok | [result] | next | next | ok | [done] | next | next | ok | [value] | next | next | ok');
c('Promise.any', '() => kinds((it, k) => { Promise.any(bad(k, 1)).catch(() => {}) })', '[next] | next | next | ok | [result] | next | next | ok | [done] | next | next | ok | [value] | next | next | ok');
c('Promise.race', '() => kinds((it, k) => { Promise.race(bad(k, 1)).catch(() => {}) })', '[next] | next | next | ok | [result] | next | next | ok | [done] | next | next | ok | [value] | next | next | ok');
c('Array.from [callback throws]', '() => cbt((it) => Array.from(it, boom))', 'next | return | RangeError');
c('new Map bad entry [callback throws]', '() => cbt((it) => new Map(bad(\'cb\', 1)))', 'next | return | TypeError');
c('new Set add [callback throws]', '() => cbt((it) => { class S extends Set { add() { boom() } } new S(it) })', 'next | return | RangeError');
c('new WeakSet bad [callback throws]', '() => cbt((it) => new WeakSet(bad(\'cb\', 1)))', 'next | return | TypeError');
c('new WeakMap bad [callback throws]', '() => cbt((it) => new WeakMap(bad(\'cb\', 1)))', 'next | return | TypeError');
c('Object.fromEntries bad [callback throws]', '() => cbt((it) => Object.fromEntries(bad(\'cb\', 1)))', 'next | return | TypeError');
c('Object.groupBy [callback throws]', '() => cbt((it) => Object.groupBy(it, boom))', 'next | return | RangeError');
c('Map.groupBy [callback throws]', '() => cbt((it) => Map.groupBy(it, boom))', 'next | return | RangeError');
c('Iterator map [callback throws]', '() => cbt((it) => it.map(boom).toArray())', 'next | return | RangeError');
c('Iterator filter [callback throws]', '() => cbt((it) => it.filter(boom).toArray())', 'next | return | RangeError');
c('Iterator flatMap [callback throws]', '() => cbt((it) => it.flatMap(boom).toArray())', 'next | return | RangeError');
c('Iterator flatMap non-iterable [callback throws]', '() => cbt((it) => it.flatMap(x => 5).toArray())', 'next | return | TypeError');
c('Iterator reduce [callback throws]', '() => cbt((it) => it.reduce(boom))', 'next | next | return | RangeError');
c('Iterator reduce init [callback throws]', '() => cbt((it) => it.reduce(boom, 0))', 'next | return | RangeError');
c('Iterator forEach [callback throws]', '() => cbt((it) => it.forEach(boom))', 'next | return | RangeError');
c('Iterator some [callback throws]', '() => cbt((it) => it.some(boom))', 'next | return | RangeError');
c('Iterator every [callback throws]', '() => cbt((it) => it.every(boom))', 'next | return | RangeError');
c('Iterator find [callback throws]', '() => cbt((it) => it.find(boom))', 'next | return | RangeError');
c('Iterator some true [callback throws]', '() => cbt((it) => it.some(x => true))', 'next | return | ok');
c('Iterator every false [callback throws]', '() => cbt((it) => it.every(x => false))', 'next | return | ok');
c('Iterator find hit [callback throws]', '() => cbt((it) => it.find(x => true))', 'next | return | ok');
c('Iterator take 1 [callback throws]', '() => cbt((it) => it.take(1).toArray())', 'next | return | ok');
c('Iterator take 0 [callback throws]', '() => cbt((it) => it.take(0).toArray())', 'return | ok');
c('Iterator map not callable [callback throws]', '() => cbt((it) => it.map(5))', 'return | TypeError');
c('Iterator take NaN [callback throws]', '() => cbt((it) => it.take(NaN))', 'return | RangeError');
c('Iterator take -1 [callback throws]', '() => cbt((it) => it.take(-1))', 'return | RangeError');
c('Iterator drop -1 [callback throws]', '() => cbt((it) => it.drop(-1))', 'return | RangeError');
c('Iterator reduce not callable [callback throws]', '() => cbt((it) => it.reduce(5))', 'return | TypeError');
c('Promise.all resolve throws [callback throws]', '() => cbt((it) => { function C(ex) { ex(() => {}, () => {}) } C.resolve = boom; Promise.all.call(C, it) })', 'next | return | ok');
c('Promise.race resolve throws [callback throws]', '() => cbt((it) => { function C(ex) { ex(() => {}, () => {}) } C.resolve = boom; Promise.race.call(C, it) })', 'next | return | ok');
c('Promise.any resolve throws [callback throws]', '() => cbt((it) => { function C(ex) { ex(() => {}, () => {}) } C.resolve = boom; Promise.any.call(C, it) })', 'next | return | ok');
c('Promise.allSettled resolve throws [callback throws]', '() => cbt((it) => { function C(ex) { ex(() => {}, () => {}) } C.resolve = boom; Promise.allSettled.call(C, it) })', 'next | return | ok');
await drain();
helpers('function raw(proto) { var i = 0; var o = Object.create(proto); o.next = function () { return { done: i >= 2, value: i++ } }; o.return = function () { L(\'return called\'); return {} }; return o }');
c('Iterator.from iterable null-proto', '() => { var o = raw(null); o[Symbol.iterator] = function () { return this }; return Iterator.from(o).toArray() }', '=> [0,1]');
c('Iterator.from iterator-like null-proto (no Symbol.iterator)', '() => Iterator.from(raw(null)).toArray()', '=> [0,1]');
c('Iterator.from iterator-like Object-proto', '() => Iterator.from(raw(Object.prototype)).toArray()', '=> [0,1]');
c('Iterator.from wrapped is not same', '() => { var o = raw(Object.prototype); var w = Iterator.from(o); return [w === o, w instanceof Iterator, typeof w.next, typeof w.return, Object.getPrototypeOf(Object.getPrototypeOf(w)) === Iterator.prototype] }', '=> [false,true,"function","function",true]');
c('Iterator.from real iterator is same', '() => { var a = [1].values(); return Iterator.from(a) === a }', '=> true');
c('Iterator.from string', '() => Iterator.from(\'ab\').toArray()', '=> ["a","b"]');
c('Iterator.from number', '() => Iterator.from(5)', 'THROW TypeError');
c('Iterator.from wrapper return', '() => { var w = Iterator.from(raw(Object.prototype)); w.next(); return w.return() }', 'return called | => {}');
c('Iterator.from wrapper return, no return method', '() => { var o = raw(Object.prototype); delete o.return; o.return = undefined; var w = Iterator.from(o); return w.return() }', '=> {value:undefined,done:true}');
c('Iterator.from wrapper map', '() => Iterator.from(raw(null)).map(x => x * 2).toArray()', '=> [0,2]');
c('Iterator.from next not callable', '() => { var o = { next: 5 }; return Iterator.from(o).toArray() }', 'THROW TypeError');
c('Iterator.from Symbol.iterator returns primitive', '() => Iterator.from({ [Symbol.iterator]() { return 5 } })', 'THROW TypeError');
c('Iterator.from take', '() => Iterator.from(raw(null)).take(1).toArray()', 'return called | => [0]');

section('4. Array.fromAsync');
/* Where the expected string is this engine's and not Node.js's:
   'next throws', 'next rejects', 'bad result', 'sync iter next throws': V8 closes
   the iterator although next() itself failed; the proposal does not. 'sync iter
   value rejects': V8 calls return() twice. 'ctor': V8 fetches the iterator before
   it constructs the result; the proposal constructs first. 'map throws, return
   throws / rejects': the promise of V8 never settles. */
await drain();
helpers('function amk(n, opts) { opts = opts || {}; var i = 0; return { [Symbol.asyncIterator]() { L(\'get iter\'); return this }, get next() { L(\'get next\'); return function() { L(\'next\'); if (opts.nextThrows && i == opts.nextThrows) throw new EvalError(\'next-err\'); if (opts.nextRejects && i == opts.nextRejects) return Promise.reject(new EvalError(\'next-rej\')); if (opts.badResult && i == opts.badResult) return Promise.resolve(3); return Promise.resolve({ done: i >= n, value: i++ }) } }, return(v) { L(\'return\'); if (opts.retThrows) throw new SyntaxError(\'ret-err\'); if (opts.retRejects) return Promise.reject(new URIError(\'ret-rej\')); return new Promise(r => { Promise.resolve().then(() => Promise.resolve()).then(() => { L(\'return settled\'); r({}) }) }) } }; } function smk(n, opts) { opts = opts || {}; var i = 0; return { [Symbol.iterator]() { return this }, next() { L(\'next\'); if (opts.nextThrows && i == opts.nextThrows) throw new EvalError(\'next-err\'); return { done: i >= n, value: opts.promises ? (i == opts.rejectAt ? Promise.reject(new URIError(\'val-rej\')) : Promise.resolve(i++)) : i++ } }, return() { L(\'return\'); return {} } }; }');
ca('fromAsync: plain', '() => Array.fromAsync(amk(3))', 'get iter | get next | next | next | next | next | => [0,1,2]');
ca('fromAsync: map', '() => Array.fromAsync(amk(3), (v, i) => v * 10 + i)', 'get iter | get next | next | next | next | next | => [0,11,22]');
ca('fromAsync: map async', '() => Array.fromAsync(amk(2), async (v) => { await 0; return v + 1 })', 'get iter | get next | next | next | next | => [1,2]');
ca('fromAsync: map throws', '() => Array.fromAsync(amk(3), (v) => { if (v == 1) throw new RangeError(\'map\'); return v })', 'get iter | get next | next | next | return | return settled | THROW RangeError');
ca('fromAsync: map rejects', '() => Array.fromAsync(amk(3), async (v) => { if (v == 1) throw new RangeError(\'maprej\'); return v })', 'get iter | get next | next | next | return | return settled | THROW RangeError');
ca('fromAsync: map throws, return throws', '() => Array.fromAsync(amk(3, {retThrows: 1}), (v) => { throw new RangeError(\'map\') })', 'get iter | get next | next | return | THROW RangeError');
ca('fromAsync: map throws, return rejects', '() => Array.fromAsync(amk(3, {retRejects: 1}), (v) => { throw new RangeError(\'map\') })', 'get iter | get next | next | return | THROW RangeError');
ca('fromAsync: next throws', '() => Array.fromAsync(amk(3, {nextThrows: 1}))', 'get iter | get next | next | next | THROW EvalError');
ca('fromAsync: next rejects', '() => Array.fromAsync(amk(3, {nextRejects: 1}))', 'get iter | get next | next | next | THROW EvalError');
ca('fromAsync: bad result', '() => Array.fromAsync(amk(3, {badResult: 1}))', 'get iter | get next | next | next | THROW TypeError');
ca('fromAsync: sync iter', '() => Array.fromAsync(smk(3))', 'next | next | next | next | => [0,1,2]');
ca('fromAsync: sync iter promises', '() => Array.fromAsync(smk(3, {promises: 1}))', 'next | next | next | next | => [0,1,2]');
ca('fromAsync: sync iter value rejects', '() => Array.fromAsync(smk(3, {promises: 1, rejectAt: 1}))', 'next | next | return | THROW URIError');
ca('fromAsync: sync iter next throws', '() => Array.fromAsync(smk(3, {nextThrows: 1}))', 'next | next | THROW EvalError');
ca('fromAsync: sync iter map throws', '() => Array.fromAsync(smk(3), () => { throw new RangeError(\'map\') })', 'next | return | THROW RangeError');
ca('fromAsync: array-like', '() => Array.fromAsync({ length: 2, 0: \'a\', 1: Promise.resolve(\'b\') })', '=> ["a","b"]');
ca('fromAsync: array', '() => Array.fromAsync([1, Promise.resolve(2), 3], x => x * 2)', '=> [2,4,6]');
ca('fromAsync: string', '() => Array.fromAsync(\'ab\')', '=> ["a","b"]');
ca('fromAsync: ctor', 'async () => { function C() { L(\'construct \' + arguments.length) } var r = await Array.fromAsync.call(C, amk(1)); return [r instanceof C, r.length, r[0]] }', 'construct 0 | get iter | get next | next | next | => [true,1,0]');
ca('fromAsync: ctor array-like', 'async () => { function C(n) { L(\'construct \' + n) } var r = await Array.fromAsync.call(C, { length: 2, 0: 1, 1: 2 }); return [r instanceof C, r.length] }', 'construct 2 | => [true,2]');
ca('fromAsync: not callable mapper', '() => Array.fromAsync([], 5)', 'THROW TypeError');
ca('fromAsync: null input', '() => Array.fromAsync(null)', 'THROW TypeError');
ca('fromAsync: iterator not object', '() => Array.fromAsync({ [Symbol.asyncIterator]() { return 1 } })', 'THROW TypeError');
ca('fromAsync: define fails', 'async () => { function C() { return Object.freeze([]) } return await Array.fromAsync.call(C, amk(2)) }', 'get iter | get next | next | return | return settled | THROW TypeError');
c('fromAsync: length and name', 'L => [Array.fromAsync.length, Array.fromAsync.name]', '=> [1,"fromAsync"]');
ca('fromAsync: elements are enumerable own data properties', 'async L => { var a = await Array.fromAsync([1, 2]); var d = Object.getOwnPropertyDescriptor(a, 0); return [Object.keys(a), d.enumerable, d.writable, d.configurable, Array.isArray(a)] }', '=> [["0","1"],true,true,true,true]');

section('5. Iterator helpers and other consumers: the values they produce');
/* Iterator.zip and zipKeyed are not in Node.js 26: recorded from this engine. */
await drain();
helpers('function src() { return [[1], [2], [3], [4]].values() } function boom() { throw new RangeError(\'cb\') }');
c('helpers: map', '() => src().map(x => x).toArray()', '=> [[1],[2],[3],[4]]');
c('helpers: map throw', '() => src().map(boom).toArray()', 'THROW RangeError');
c('helpers: map partial', '() => { var it = src().map(x => x); it.next(); it.return(); return 1 }', '=> 1');
c('helpers: filter', '() => src().filter(x => x[0] % 2).toArray()', '=> [[1],[3]]');
c('helpers: filter throw', '() => src().filter(boom).toArray()', 'THROW RangeError');
c('helpers: filter partial', '() => { var it = src().filter(x => false); return it.next() }', '=> {value:undefined,done:true}');
c('helpers: take', '() => src().take(2).toArray()', '=> [[1],[2]]');
c('helpers: take partial', '() => { var it = src().take(3); it.next(); return it.return() }', '=> {value:undefined,done:true}');
c('helpers: drop', '() => src().drop(2).toArray()', '=> [[3],[4]]');
c('helpers: drop all', '() => src().drop(9).toArray()', '=> []');
c('helpers: flatMap', '() => src().flatMap(x => [x, x]).toArray()', '=> [[1],[1],[2],[2],[3],[3],[4],[4]]');
c('helpers: flatMap throw', '() => src().flatMap(boom).toArray()', 'THROW RangeError');
c('helpers: flatMap inner partial', '() => { var it = src().flatMap(x => [x, x, x]); it.next(); it.next(); return it.return() }', '=> {value:undefined,done:true}');
c('helpers: flatMap non iterable', '() => src().flatMap(x => 1).toArray()', 'THROW TypeError');
c('helpers: flatMap string rejected', '() => src().flatMap(x => \'ab\').toArray()', 'THROW TypeError');
c('helpers: find hit', '() => src().find(x => x[0] == 3)', '=> [3]');
c('helpers: find miss', '() => src().find(x => false)', '');
c('helpers: find throw', '() => src().find(boom)', 'THROW RangeError');
c('helpers: some', '() => [src().some(x => x[0] == 2), src().some(x => false)]', '=> [true,false]');
c('helpers: some throw', '() => src().some(boom)', 'THROW RangeError');
c('helpers: every', '() => [src().every(x => true), src().every(x => x[0] < 2)]', '=> [true,false]');
c('helpers: every throw', '() => src().every(boom)', 'THROW RangeError');
c('helpers: forEach', '() => { var r = []; src().forEach(x => r.push(x)); return r }', '=> [[1],[2],[3],[4]]');
c('helpers: forEach throw', '() => src().forEach(boom)', 'THROW RangeError');
c('helpers: reduce', '() => [src().reduce((a, b) => a.concat(b)), src().reduce((a, b) => a + b[0], 0)]', '=> [[1,2,3,4],10]');
c('helpers: reduce throw', '() => src().reduce(boom)', 'THROW RangeError');
c('helpers: reduce init throw', '() => src().reduce(boom, {})', 'THROW RangeError');
c('helpers: reduce empty', '() => [].values().reduce((a, b) => a)', 'THROW TypeError');
c('helpers: toArray', '() => src().toArray()', '=> [[1],[2],[3],[4]]');
c('helpers: chain', '() => src().map(x => [x[0] * 2]).filter(x => x[0] > 2).drop(1).take(2).flatMap(x => x).toArray()', '=> [6,8]');
c('helpers: Iterator.from', '() => Iterator.from({ next() { return { done: true } } }).toArray()', '=> []');
c('helpers: Iterator.from wrap partial', '() => { var n = 0; var it = Iterator.from({ next() { return { done: n++ > 2, value: [n] } }, return() { return {} } }); it.next(); return it.return() }', '=> {}');
c('helpers: concat', '() => typeof Iterator.concat == \'function\' ? Iterator.concat([[1]], [[2]]).toArray() : \'absent\'', '=> [[1],[2]]');
c('helpers: zip', '() => typeof Iterator.zip == \'function\' ? Iterator.zip([[[1], [2]], [[3], [4]]]).toArray() : \'absent\'', '=> [[[1],[3]],[[2],[4]]]');
c('helpers: zip longest', '() => typeof Iterator.zip == \'function\' ? Iterator.zip([[1], [2, 3]], { mode: \'longest\', padding: [{ p: 1 }] }).toArray() : \'absent\'', '=> [[1,2],[{p:1},3]]');
c('helpers: zipKeyed', '() => typeof Iterator.zipKeyed == \'function\' ? Iterator.zipKeyed({ a: [[1]], b: [[2]] }).toArray() : \'absent\'', '=> [{a:[1],b:[2]}]');
c('helpers: Array.from iter', '() => Array.from(src(), x => x)', '=> [[1],[2],[3],[4]]');
c('helpers: Array.from throw', '() => Array.from(src(), boom)', 'THROW RangeError');
c('helpers: spread', '() => [...src()]', '=> [[1],[2],[3],[4]]');
c('helpers: destructure', '() => { var [a, , ...r] = src(); return [a, r] }', '=> [[1],[[3],[4]]]');
c('helpers: Map/Set ctor', '() => [[...new Map([[[1], [2]]])], [...new Set(src())].length]', '=> [[[[1],[2]]],4]');
c('helpers: Map ctor throw', '() => new Map([[1, 2], 5])', 'THROW TypeError');
c('helpers: Object.fromEntries', '() => Object.fromEntries([[\'a\', [1]]])', '=> {a:[1]}');
c('helpers: groupBy', '() => [Object.groupBy(src(), x => x[0] % 2 ? \'odd\' : \'even\'), [...Map.groupBy(src(), x => x[0] % 2)].length]', '=> [{odd:[[1],[3]],even:[[2],[4]]},2]');
c('helpers: groupBy throw', '() => Object.groupBy(src(), boom)', 'THROW RangeError');
c('helpers: Map.groupBy throw', '() => Map.groupBy(src(), boom)', 'THROW RangeError');
c('helpers: Promise.all', '() => { Promise.all(src()); Promise.race(src()); Promise.allSettled(src()); Promise.any(src()).catch(() => { }); return 1 }', '=> 1');
c('helpers: typed from', '() => Array.from(Uint8Array.from([[1]].values(), x => x[0]))', '=> [1]');
c('helpers: yield*', '() => { function* g() { yield* src() } var it = g(); it.next(); it.return(); return [...g()].length }', '=> 4');

await drain();
finish();
