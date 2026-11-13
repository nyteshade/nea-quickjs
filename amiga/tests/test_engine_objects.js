/*
 * test_engine_objects.js -- frozen and sealed arrays under every mutating
 * method, sort, typed arrays over a resized or detached buffer, and the
 * ORDER in which assignments, destructuring, spread, templates and
 * Proxy traps do their steps (observed with logging getters, keys and
 * traps).
 *
 * Companion of test_engine_conformance.js and of docs/NODEJS-DELTA.md,
 * "The engine itself".
 *
 * WRONG ANSWERS FOUND ON 0.238 AND FIXED IN THE BUILD AFTER IT. All were
 * in the upstream engine and showed on any machine.
 *   - Array.prototype.sort wrote back only the elements that had
 *     moved: Object.freeze([1, 2, 3]).sort() returned the array instead
 *     of throwing TypeError, and a setter or proxy did not see the
 *     writes of an array that was already in order.
 *   - A typed array sorted with a comparator that shrank its buffer was
 *     left unsorted (the comparator compared live elements).
 *   - Any write of 'length' through a Proxy of an array that has a
 *     defineProperty trap threw "inconsistent defineProperty": push,
 *     pop, shift, unshift, splice, a.length = n.
 *   - obj[key] = value converted the key to a property key before the
 *     value was evaluated, and obj[key] += value converted it once; the
 *     language now says after, and twice (ES2025). null[key] = value
 *     and delete null[key] ran key.toString() before throwing.
 *   - A template literal converted its substitutions to strings at the
 *     end, not one by one: `${a}${f()}` called f() before a.toString().
 *   - Spread read Symbol.iterator twice.
 *   - Object.isFrozen and Object.isSealed read every property before
 *     asking whether the object is extensible.
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
 * Run:  qjs amiga/tests/test_engine_objects.js
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

print('=== Engine conformance: objects, arrays and order of evaluation ===');

section('1. Frozen, sealed and non-extensible arrays under every mutating operation');
/* One case per kind of array; the log has one entry per operation: its result
   or the error, then the array afterwards. Object.freeze([1]).sort() does not
   throw in V8 (nor here), although the specification's Set would: with fewer
   than two elements nothing is written. */
await drain();
helpers('var fzKinds = { \'frozen sorted\': () => Object.freeze([1, 2, 3]), \'frozen unsorted\': () => Object.freeze([3, 1, 2]), \'frozen empty\': () => Object.freeze([]), \'frozen one\': () => Object.freeze([1]), \'frozen holes\': () => Object.freeze([1, , 3]), \'sealed\': () => Object.seal([3, 1, 2]), \'sealed empty\': () => Object.seal([]), \'nonext\': () => Object.preventExtensions([3, 1, 2]), \'nonext empty\': () => Object.preventExtensions([]), \'len ro\': () => { var a = [3, 1, 2]; Object.defineProperty(a, \'length\', { writable: false }); return a }, \'len ro empty\': () => { var a = []; Object.defineProperty(a, \'length\', { writable: false }); return a }, \'elem ro\': () => { var a = [3, 1, 2]; Object.defineProperty(a, 1, { writable: false }); return a }, \'elem0 ro\': () => { var a = [3, 1, 2]; Object.defineProperty(a, 0, { writable: false }); return a }, \'elem nonconfig\': () => { var a = [3, 1, 2]; Object.defineProperty(a, 1, { configurable: false }); return a }, \'elem getter only\': () => { var a = [3, 1, 2]; Object.defineProperty(a, 1, { get() { return 1 }, configurable: true }); return a }, \'frozen arraylike\': () => Object.freeze({ length: 3, 0: 3, 1: 1, 2: 2 }), \'frozen sorted arraylike\': () => Object.freeze({ length: 3, 0: 1, 1: 2, 2: 3 }), }; var fzOps = { \'sort\': a => Array.prototype.sort.call(a), \'sort cmp\': a => Array.prototype.sort.call(a, (x, y) => x - y), \'reverse\': a => Array.prototype.reverse.call(a), \'fill\': a => Array.prototype.fill.call(a, 9), \'fill empty range\': a => Array.prototype.fill.call(a, 9, 1, 1), \'copyWithin\': a => Array.prototype.copyWithin.call(a, 0, 1), \'copyWithin noop\': a => Array.prototype.copyWithin.call(a, 0, 0), \'copyWithin empty\': a => Array.prototype.copyWithin.call(a, 0, 3), \'splice none\': a => Array.prototype.splice.call(a), \'splice 0,0\': a => Array.prototype.splice.call(a, 0, 0), \'splice 0,1\': a => Array.prototype.splice.call(a, 0, 1), \'splice 1,1,x\': a => Array.prototype.splice.call(a, 1, 1, \'x\'), \'splice end,0,x\': a => Array.prototype.splice.call(a, 3, 0, \'x\'), \'push\': a => Array.prototype.push.call(a, 4), \'push none\': a => Array.prototype.push.call(a), \'pop\': a => Array.prototype.pop.call(a), \'shift\': a => Array.prototype.shift.call(a), \'unshift\': a => Array.prototype.unshift.call(a, 0), \'unshift none\': a => Array.prototype.unshift.call(a), \'length = 0\': a => { \'use strict\'; a.length = 0; return a.length }, \'length = same\': a => { \'use strict\'; a.length = a.length; return a.length }, \'length grow\': a => { \'use strict\'; a.length = 10; return a.length }, \'a[0] = v strict\': a => { \'use strict\'; a[0] = 7; return a[0] }, \'a[len] = v strict\': a => { \'use strict\'; a[a.length] = 7; return a.length }, \'a[0] = v sloppy\': a => { a[0] = 7; return a[0] }, \'delete a[0] strict\': a => { \'use strict\'; return delete a[0] }, \'delete a[0] sloppy\': a => { return delete a[0] }, \'toSorted\': a => Array.prototype.toSorted.call(a), \'toReversed\': a => Array.prototype.toReversed.call(a), \'with\': a => Array.prototype.with.call(a, 0, 5), \'toSpliced\': a => Array.prototype.toSpliced.call(a, 0, 1), \'concat\': a => a.concat ? a.concat([1]) : 0, \'Array.prototype.length=\': a => Reflect.set(a, \'length\', 1), \'Reflect.set 0\': a => Reflect.set(a, 0, 1), \'Reflect.defineProperty 0\': a => Reflect.defineProperty(a, 0, { value: 99 }), \'Reflect.deleteProperty 2\': a => Reflect.deleteProperty(a, 2), \'Object.assign\': a => { Object.assign(a, { 0: 8 }); return 1 }, \'destructure assign\': a => { \'use strict\'; [a[0], a[1]] = [a[1], a[0]]; return 1 }, \'a[0]++\': a => { \'use strict\'; a[0]++; return 1 }, \'a[1] += 1\': a => { \'use strict\'; a[1] += 1; return 1 }, \'a[5] ??= 1\': a => { \'use strict\'; a[5] ??= 1; return 1 }, \'a[0] ||= 1\': a => { \'use strict\'; a[0] ||= 1; return 1 }, }; function fzShow(a) { try { return JSON.stringify(Array.from(a)) + \' len=\' + a.length } catch (e) { return \'unshowable \' + e.name } } function frz(kind) { for (var o in fzOps) { var a; try { a = fzKinds[kind](); var r = fzOps[o](a); L(o + \': \' + (r === a ? \'same\' : JSON.stringify(r)) + \' -> \' + fzShow(a)) } catch (e) { L(o + \': \' + e.name + \' -> \' + (a ? fzShow(a) : \'\')) } } }');
c('array, frozen sorted', 'L => frz("frozen sorted")', 'sort: TypeError -> [1,2,3] len=3 | sort cmp: TypeError -> [1,2,3] len=3 | reverse: TypeError -> [1,2,3] len=3 | fill: TypeError -> [1,2,3] len=3 | fill empty range: same -> [1,2,3] len=3 | copyWithin: TypeError -> [1,2,3] len=3 | copyWithin noop: TypeError -> [1,2,3] len=3 | copyWithin empty: same -> [1,2,3] len=3 | splice none: TypeError -> [1,2,3] len=3 | splice 0,0: TypeError -> [1,2,3] len=3 | splice 0,1: TypeError -> [1,2,3] len=3 | splice 1,1,x: TypeError -> [1,2,3] len=3 | splice end,0,x: TypeError -> [1,2,3] len=3 | push: TypeError -> [1,2,3] len=3 | push none: TypeError -> [1,2,3] len=3 | pop: TypeError -> [1,2,3] len=3 | shift: TypeError -> [1,2,3] len=3 | unshift: TypeError -> [1,2,3] len=3 | unshift none: TypeError -> [1,2,3] len=3 | length = 0: TypeError -> [1,2,3] len=3 | length = same: TypeError -> [1,2,3] len=3 | length grow: TypeError -> [1,2,3] len=3 | a[0] = v strict: TypeError -> [1,2,3] len=3 | a[len] = v strict: TypeError -> [1,2,3] len=3 | a[0] = v sloppy: 1 -> [1,2,3] len=3 | delete a[0] strict: TypeError -> [1,2,3] len=3 | delete a[0] sloppy: false -> [1,2,3] len=3 | toSorted: [1,2,3] -> [1,2,3] len=3 | toReversed: [3,2,1] -> [1,2,3] len=3 | with: [5,2,3] -> [1,2,3] len=3 | toSpliced: [2,3] -> [1,2,3] len=3 | concat: [1,2,3,1] -> [1,2,3] len=3 | Array.prototype.length=: false -> [1,2,3] len=3 | Reflect.set 0: false -> [1,2,3] len=3 | Reflect.defineProperty 0: false -> [1,2,3] len=3 | Reflect.deleteProperty 2: false -> [1,2,3] len=3 | Object.assign: TypeError -> [1,2,3] len=3 | destructure assign: TypeError -> [1,2,3] len=3 | a[0]++: TypeError -> [1,2,3] len=3 | a[1] += 1: TypeError -> [1,2,3] len=3 | a[5] ??= 1: TypeError -> [1,2,3] len=3 | a[0] ||= 1: 1 -> [1,2,3] len=3');
c('array, frozen unsorted', 'L => frz("frozen unsorted")', 'sort: TypeError -> [3,1,2] len=3 | sort cmp: TypeError -> [3,1,2] len=3 | reverse: TypeError -> [3,1,2] len=3 | fill: TypeError -> [3,1,2] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: TypeError -> [3,1,2] len=3 | copyWithin noop: TypeError -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: TypeError -> [3,1,2] len=3 | splice 0,0: TypeError -> [3,1,2] len=3 | splice 0,1: TypeError -> [3,1,2] len=3 | splice 1,1,x: TypeError -> [3,1,2] len=3 | splice end,0,x: TypeError -> [3,1,2] len=3 | push: TypeError -> [3,1,2] len=3 | push none: TypeError -> [3,1,2] len=3 | pop: TypeError -> [3,1,2] len=3 | shift: TypeError -> [3,1,2] len=3 | unshift: TypeError -> [3,1,2] len=3 | unshift none: TypeError -> [3,1,2] len=3 | length = 0: TypeError -> [3,1,2] len=3 | length = same: TypeError -> [3,1,2] len=3 | length grow: TypeError -> [3,1,2] len=3 | a[0] = v strict: TypeError -> [3,1,2] len=3 | a[len] = v strict: TypeError -> [3,1,2] len=3 | a[0] = v sloppy: 3 -> [3,1,2] len=3 | delete a[0] strict: TypeError -> [3,1,2] len=3 | delete a[0] sloppy: false -> [3,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: [3,1,2,1] -> [3,1,2] len=3 | Array.prototype.length=: false -> [3,1,2] len=3 | Reflect.set 0: false -> [3,1,2] len=3 | Reflect.defineProperty 0: false -> [3,1,2] len=3 | Reflect.deleteProperty 2: false -> [3,1,2] len=3 | Object.assign: TypeError -> [3,1,2] len=3 | destructure assign: TypeError -> [3,1,2] len=3 | a[0]++: TypeError -> [3,1,2] len=3 | a[1] += 1: TypeError -> [3,1,2] len=3 | a[5] ??= 1: TypeError -> [3,1,2] len=3 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, frozen empty', 'L => frz("frozen empty")', 'sort: same -> [] len=0 | sort cmp: same -> [] len=0 | reverse: same -> [] len=0 | fill: same -> [] len=0 | fill empty range: same -> [] len=0 | copyWithin: same -> [] len=0 | copyWithin noop: same -> [] len=0 | copyWithin empty: same -> [] len=0 | splice none: TypeError -> [] len=0 | splice 0,0: TypeError -> [] len=0 | splice 0,1: TypeError -> [] len=0 | splice 1,1,x: TypeError -> [] len=0 | splice end,0,x: TypeError -> [] len=0 | push: TypeError -> [] len=0 | push none: TypeError -> [] len=0 | pop: TypeError -> [] len=0 | shift: TypeError -> [] len=0 | unshift: TypeError -> [] len=0 | unshift none: TypeError -> [] len=0 | length = 0: TypeError -> [] len=0 | length = same: TypeError -> [] len=0 | length grow: TypeError -> [] len=0 | a[0] = v strict: TypeError -> [] len=0 | a[len] = v strict: TypeError -> [] len=0 | a[0] = v sloppy: undefined -> [] len=0 | delete a[0] strict: true -> [] len=0 | delete a[0] sloppy: true -> [] len=0 | toSorted: [] -> [] len=0 | toReversed: [] -> [] len=0 | with: RangeError -> [] len=0 | toSpliced: [] -> [] len=0 | concat: [1] -> [] len=0 | Array.prototype.length=: false -> [] len=0 | Reflect.set 0: false -> [] len=0 | Reflect.defineProperty 0: false -> [] len=0 | Reflect.deleteProperty 2: true -> [] len=0 | Object.assign: TypeError -> [] len=0 | destructure assign: TypeError -> [] len=0 | a[0]++: TypeError -> [] len=0 | a[1] += 1: TypeError -> [] len=0 | a[5] ??= 1: TypeError -> [] len=0 | a[0] ||= 1: TypeError -> [] len=0');
c('array, frozen one', 'L => frz("frozen one")', 'sort: same -> [1] len=1 | sort cmp: same -> [1] len=1 | reverse: same -> [1] len=1 | fill: TypeError -> [1] len=1 | fill empty range: same -> [1] len=1 | copyWithin: same -> [1] len=1 | copyWithin noop: TypeError -> [1] len=1 | copyWithin empty: same -> [1] len=1 | splice none: TypeError -> [1] len=1 | splice 0,0: TypeError -> [1] len=1 | splice 0,1: TypeError -> [1] len=1 | splice 1,1,x: TypeError -> [1] len=1 | splice end,0,x: TypeError -> [1] len=1 | push: TypeError -> [1] len=1 | push none: TypeError -> [1] len=1 | pop: TypeError -> [1] len=1 | shift: TypeError -> [1] len=1 | unshift: TypeError -> [1] len=1 | unshift none: TypeError -> [1] len=1 | length = 0: TypeError -> [1] len=1 | length = same: TypeError -> [1] len=1 | length grow: TypeError -> [1] len=1 | a[0] = v strict: TypeError -> [1] len=1 | a[len] = v strict: TypeError -> [1] len=1 | a[0] = v sloppy: 1 -> [1] len=1 | delete a[0] strict: TypeError -> [1] len=1 | delete a[0] sloppy: false -> [1] len=1 | toSorted: [1] -> [1] len=1 | toReversed: [1] -> [1] len=1 | with: [5] -> [1] len=1 | toSpliced: [] -> [1] len=1 | concat: [1,1] -> [1] len=1 | Array.prototype.length=: false -> [1] len=1 | Reflect.set 0: false -> [1] len=1 | Reflect.defineProperty 0: false -> [1] len=1 | Reflect.deleteProperty 2: true -> [1] len=1 | Object.assign: TypeError -> [1] len=1 | destructure assign: TypeError -> [1] len=1 | a[0]++: TypeError -> [1] len=1 | a[1] += 1: TypeError -> [1] len=1 | a[5] ??= 1: TypeError -> [1] len=1 | a[0] ||= 1: 1 -> [1] len=1');
c('array, frozen holes', 'L => frz("frozen holes")', 'sort: TypeError -> [1,null,3] len=3 | sort cmp: TypeError -> [1,null,3] len=3 | reverse: TypeError -> [1,null,3] len=3 | fill: TypeError -> [1,null,3] len=3 | fill empty range: same -> [1,null,3] len=3 | copyWithin: TypeError -> [1,null,3] len=3 | copyWithin noop: TypeError -> [1,null,3] len=3 | copyWithin empty: same -> [1,null,3] len=3 | splice none: TypeError -> [1,null,3] len=3 | splice 0,0: TypeError -> [1,null,3] len=3 | splice 0,1: TypeError -> [1,null,3] len=3 | splice 1,1,x: TypeError -> [1,null,3] len=3 | splice end,0,x: TypeError -> [1,null,3] len=3 | push: TypeError -> [1,null,3] len=3 | push none: TypeError -> [1,null,3] len=3 | pop: TypeError -> [1,null,3] len=3 | shift: TypeError -> [1,null,3] len=3 | unshift: TypeError -> [1,null,3] len=3 | unshift none: TypeError -> [1,null,3] len=3 | length = 0: TypeError -> [1,null,3] len=3 | length = same: TypeError -> [1,null,3] len=3 | length grow: TypeError -> [1,null,3] len=3 | a[0] = v strict: TypeError -> [1,null,3] len=3 | a[len] = v strict: TypeError -> [1,null,3] len=3 | a[0] = v sloppy: 1 -> [1,null,3] len=3 | delete a[0] strict: TypeError -> [1,null,3] len=3 | delete a[0] sloppy: false -> [1,null,3] len=3 | toSorted: [1,3,null] -> [1,null,3] len=3 | toReversed: [3,null,1] -> [1,null,3] len=3 | with: [5,null,3] -> [1,null,3] len=3 | toSpliced: [null,3] -> [1,null,3] len=3 | concat: [1,null,3,1] -> [1,null,3] len=3 | Array.prototype.length=: false -> [1,null,3] len=3 | Reflect.set 0: false -> [1,null,3] len=3 | Reflect.defineProperty 0: false -> [1,null,3] len=3 | Reflect.deleteProperty 2: false -> [1,null,3] len=3 | Object.assign: TypeError -> [1,null,3] len=3 | destructure assign: TypeError -> [1,null,3] len=3 | a[0]++: TypeError -> [1,null,3] len=3 | a[1] += 1: TypeError -> [1,null,3] len=3 | a[5] ??= 1: TypeError -> [1,null,3] len=3 | a[0] ||= 1: 1 -> [1,null,3] len=3');
c('array, sealed', 'L => frz("sealed")', 'sort: same -> [1,2,3] len=3 | sort cmp: same -> [1,2,3] len=3 | reverse: same -> [2,1,3] len=3 | fill: same -> [9,9,9] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: same -> [1,2,2] len=3 | copyWithin noop: same -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: [] -> [3,1,2] len=3 | splice 0,0: [] -> [3,1,2] len=3 | splice 0,1: TypeError -> [1,2,2] len=3 | splice 1,1,x: [1] -> [3,"x",2] len=3 | splice end,0,x: TypeError -> [3,1,2] len=3 | push: TypeError -> [3,1,2] len=3 | push none: 3 -> [3,1,2] len=3 | pop: TypeError -> [3,1,2] len=3 | shift: TypeError -> [1,2,2] len=3 | unshift: TypeError -> [3,1,2] len=3 | unshift none: 3 -> [3,1,2] len=3 | length = 0: TypeError -> [3,1,2] len=3 | length = same: 3 -> [3,1,2] len=3 | length grow: 10 -> [3,1,2,null,null,null,null,null,null,null] len=10 | a[0] = v strict: 7 -> [7,1,2] len=3 | a[len] = v strict: TypeError -> [3,1,2] len=3 | a[0] = v sloppy: 7 -> [7,1,2] len=3 | delete a[0] strict: TypeError -> [3,1,2] len=3 | delete a[0] sloppy: false -> [3,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: [3,1,2,1] -> [3,1,2] len=3 | Array.prototype.length=: false -> [3,1,2] len=3 | Reflect.set 0: true -> [1,1,2] len=3 | Reflect.defineProperty 0: true -> [99,1,2] len=3 | Reflect.deleteProperty 2: false -> [3,1,2] len=3 | Object.assign: 1 -> [8,1,2] len=3 | destructure assign: 1 -> [1,3,2] len=3 | a[0]++: 1 -> [4,1,2] len=3 | a[1] += 1: 1 -> [3,2,2] len=3 | a[5] ??= 1: TypeError -> [3,1,2] len=3 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, sealed empty', 'L => frz("sealed empty")', 'sort: same -> [] len=0 | sort cmp: same -> [] len=0 | reverse: same -> [] len=0 | fill: same -> [] len=0 | fill empty range: same -> [] len=0 | copyWithin: same -> [] len=0 | copyWithin noop: same -> [] len=0 | copyWithin empty: same -> [] len=0 | splice none: [] -> [] len=0 | splice 0,0: [] -> [] len=0 | splice 0,1: [] -> [] len=0 | splice 1,1,x: TypeError -> [] len=0 | splice end,0,x: TypeError -> [] len=0 | push: TypeError -> [] len=0 | push none: 0 -> [] len=0 | pop: undefined -> [] len=0 | shift: undefined -> [] len=0 | unshift: TypeError -> [] len=0 | unshift none: 0 -> [] len=0 | length = 0: 0 -> [] len=0 | length = same: 0 -> [] len=0 | length grow: 10 -> [null,null,null,null,null,null,null,null,null,null] len=10 | a[0] = v strict: TypeError -> [] len=0 | a[len] = v strict: TypeError -> [] len=0 | a[0] = v sloppy: undefined -> [] len=0 | delete a[0] strict: true -> [] len=0 | delete a[0] sloppy: true -> [] len=0 | toSorted: [] -> [] len=0 | toReversed: [] -> [] len=0 | with: RangeError -> [] len=0 | toSpliced: [] -> [] len=0 | concat: [1] -> [] len=0 | Array.prototype.length=: true -> [null] len=1 | Reflect.set 0: false -> [] len=0 | Reflect.defineProperty 0: false -> [] len=0 | Reflect.deleteProperty 2: true -> [] len=0 | Object.assign: TypeError -> [] len=0 | destructure assign: TypeError -> [] len=0 | a[0]++: TypeError -> [] len=0 | a[1] += 1: TypeError -> [] len=0 | a[5] ??= 1: TypeError -> [] len=0 | a[0] ||= 1: TypeError -> [] len=0');
c('array, nonext', 'L => frz("nonext")', 'sort: same -> [1,2,3] len=3 | sort cmp: same -> [1,2,3] len=3 | reverse: same -> [2,1,3] len=3 | fill: same -> [9,9,9] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: same -> [1,2,2] len=3 | copyWithin noop: same -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: [] -> [3,1,2] len=3 | splice 0,0: [] -> [3,1,2] len=3 | splice 0,1: [3] -> [1,2] len=2 | splice 1,1,x: [1] -> [3,"x",2] len=3 | splice end,0,x: TypeError -> [3,1,2] len=3 | push: TypeError -> [3,1,2] len=3 | push none: 3 -> [3,1,2] len=3 | pop: 2 -> [3,1] len=2 | shift: 3 -> [1,2] len=2 | unshift: TypeError -> [3,1,2] len=3 | unshift none: 3 -> [3,1,2] len=3 | length = 0: 0 -> [] len=0 | length = same: 3 -> [3,1,2] len=3 | length grow: 10 -> [3,1,2,null,null,null,null,null,null,null] len=10 | a[0] = v strict: 7 -> [7,1,2] len=3 | a[len] = v strict: TypeError -> [3,1,2] len=3 | a[0] = v sloppy: 7 -> [7,1,2] len=3 | delete a[0] strict: true -> [null,1,2] len=3 | delete a[0] sloppy: true -> [null,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: [3,1,2,1] -> [3,1,2] len=3 | Array.prototype.length=: true -> [3] len=1 | Reflect.set 0: true -> [1,1,2] len=3 | Reflect.defineProperty 0: true -> [99,1,2] len=3 | Reflect.deleteProperty 2: true -> [3,1,null] len=3 | Object.assign: 1 -> [8,1,2] len=3 | destructure assign: 1 -> [1,3,2] len=3 | a[0]++: 1 -> [4,1,2] len=3 | a[1] += 1: 1 -> [3,2,2] len=3 | a[5] ??= 1: TypeError -> [3,1,2] len=3 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, nonext empty', 'L => frz("nonext empty")', 'sort: same -> [] len=0 | sort cmp: same -> [] len=0 | reverse: same -> [] len=0 | fill: same -> [] len=0 | fill empty range: same -> [] len=0 | copyWithin: same -> [] len=0 | copyWithin noop: same -> [] len=0 | copyWithin empty: same -> [] len=0 | splice none: [] -> [] len=0 | splice 0,0: [] -> [] len=0 | splice 0,1: [] -> [] len=0 | splice 1,1,x: TypeError -> [] len=0 | splice end,0,x: TypeError -> [] len=0 | push: TypeError -> [] len=0 | push none: 0 -> [] len=0 | pop: undefined -> [] len=0 | shift: undefined -> [] len=0 | unshift: TypeError -> [] len=0 | unshift none: 0 -> [] len=0 | length = 0: 0 -> [] len=0 | length = same: 0 -> [] len=0 | length grow: 10 -> [null,null,null,null,null,null,null,null,null,null] len=10 | a[0] = v strict: TypeError -> [] len=0 | a[len] = v strict: TypeError -> [] len=0 | a[0] = v sloppy: undefined -> [] len=0 | delete a[0] strict: true -> [] len=0 | delete a[0] sloppy: true -> [] len=0 | toSorted: [] -> [] len=0 | toReversed: [] -> [] len=0 | with: RangeError -> [] len=0 | toSpliced: [] -> [] len=0 | concat: [1] -> [] len=0 | Array.prototype.length=: true -> [null] len=1 | Reflect.set 0: false -> [] len=0 | Reflect.defineProperty 0: false -> [] len=0 | Reflect.deleteProperty 2: true -> [] len=0 | Object.assign: TypeError -> [] len=0 | destructure assign: TypeError -> [] len=0 | a[0]++: TypeError -> [] len=0 | a[1] += 1: TypeError -> [] len=0 | a[5] ??= 1: TypeError -> [] len=0 | a[0] ||= 1: TypeError -> [] len=0');
c('array, len ro', 'L => frz("len ro")', 'sort: same -> [1,2,3] len=3 | sort cmp: same -> [1,2,3] len=3 | reverse: same -> [2,1,3] len=3 | fill: same -> [9,9,9] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: same -> [1,2,2] len=3 | copyWithin noop: same -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: TypeError -> [3,1,2] len=3 | splice 0,0: TypeError -> [3,1,2] len=3 | splice 0,1: TypeError -> [1,2,null] len=3 | splice 1,1,x: TypeError -> [3,"x",2] len=3 | splice end,0,x: TypeError -> [3,1,2] len=3 | push: TypeError -> [3,1,2] len=3 | push none: TypeError -> [3,1,2] len=3 | pop: TypeError -> [3,1,null] len=3 | shift: TypeError -> [1,2,null] len=3 | unshift: TypeError -> [3,1,2] len=3 | unshift none: TypeError -> [3,1,2] len=3 | length = 0: TypeError -> [3,1,2] len=3 | length = same: TypeError -> [3,1,2] len=3 | length grow: TypeError -> [3,1,2] len=3 | a[0] = v strict: 7 -> [7,1,2] len=3 | a[len] = v strict: TypeError -> [3,1,2] len=3 | a[0] = v sloppy: 7 -> [7,1,2] len=3 | delete a[0] strict: true -> [null,1,2] len=3 | delete a[0] sloppy: true -> [null,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: [3,1,2,1] -> [3,1,2] len=3 | Array.prototype.length=: false -> [3,1,2] len=3 | Reflect.set 0: true -> [1,1,2] len=3 | Reflect.defineProperty 0: true -> [99,1,2] len=3 | Reflect.deleteProperty 2: true -> [3,1,null] len=3 | Object.assign: 1 -> [8,1,2] len=3 | destructure assign: 1 -> [1,3,2] len=3 | a[0]++: 1 -> [4,1,2] len=3 | a[1] += 1: 1 -> [3,2,2] len=3 | a[5] ??= 1: TypeError -> [3,1,2] len=3 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, len ro empty', 'L => frz("len ro empty")', 'sort: same -> [] len=0 | sort cmp: same -> [] len=0 | reverse: same -> [] len=0 | fill: same -> [] len=0 | fill empty range: same -> [] len=0 | copyWithin: same -> [] len=0 | copyWithin noop: same -> [] len=0 | copyWithin empty: same -> [] len=0 | splice none: TypeError -> [] len=0 | splice 0,0: TypeError -> [] len=0 | splice 0,1: TypeError -> [] len=0 | splice 1,1,x: TypeError -> [] len=0 | splice end,0,x: TypeError -> [] len=0 | push: TypeError -> [] len=0 | push none: TypeError -> [] len=0 | pop: TypeError -> [] len=0 | shift: TypeError -> [] len=0 | unshift: TypeError -> [] len=0 | unshift none: TypeError -> [] len=0 | length = 0: TypeError -> [] len=0 | length = same: TypeError -> [] len=0 | length grow: TypeError -> [] len=0 | a[0] = v strict: TypeError -> [] len=0 | a[len] = v strict: TypeError -> [] len=0 | a[0] = v sloppy: undefined -> [] len=0 | delete a[0] strict: true -> [] len=0 | delete a[0] sloppy: true -> [] len=0 | toSorted: [] -> [] len=0 | toReversed: [] -> [] len=0 | with: RangeError -> [] len=0 | toSpliced: [] -> [] len=0 | concat: [1] -> [] len=0 | Array.prototype.length=: false -> [] len=0 | Reflect.set 0: false -> [] len=0 | Reflect.defineProperty 0: false -> [] len=0 | Reflect.deleteProperty 2: true -> [] len=0 | Object.assign: TypeError -> [] len=0 | destructure assign: TypeError -> [] len=0 | a[0]++: TypeError -> [] len=0 | a[1] += 1: TypeError -> [] len=0 | a[5] ??= 1: TypeError -> [] len=0 | a[0] ||= 1: TypeError -> [] len=0');
c('array, elem ro', 'L => frz("elem ro")', 'sort: TypeError -> [1,1,2] len=3 | sort cmp: TypeError -> [1,1,2] len=3 | reverse: same -> [2,1,3] len=3 | fill: TypeError -> [9,1,2] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: TypeError -> [1,1,2] len=3 | copyWithin noop: TypeError -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: [] -> [3,1,2] len=3 | splice 0,0: [] -> [3,1,2] len=3 | splice 0,1: TypeError -> [1,1,2] len=3 | splice 1,1,x: TypeError -> [3,1,2] len=3 | splice end,0,x: [] -> [3,1,2,"x"] len=4 | push: 4 -> [3,1,2,4] len=4 | push none: 3 -> [3,1,2] len=3 | pop: 2 -> [3,1] len=2 | shift: TypeError -> [1,1,2] len=3 | unshift: TypeError -> [3,1,1,2] len=4 | unshift none: 3 -> [3,1,2] len=3 | length = 0: 0 -> [] len=0 | length = same: 3 -> [3,1,2] len=3 | length grow: 10 -> [3,1,2,null,null,null,null,null,null,null] len=10 | a[0] = v strict: 7 -> [7,1,2] len=3 | a[len] = v strict: 4 -> [3,1,2,7] len=4 | a[0] = v sloppy: 7 -> [7,1,2] len=3 | delete a[0] strict: true -> [null,1,2] len=3 | delete a[0] sloppy: true -> [null,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: [3,1,2,1] -> [3,1,2] len=3 | Array.prototype.length=: true -> [3] len=1 | Reflect.set 0: true -> [1,1,2] len=3 | Reflect.defineProperty 0: true -> [99,1,2] len=3 | Reflect.deleteProperty 2: true -> [3,1,null] len=3 | Object.assign: 1 -> [8,1,2] len=3 | destructure assign: TypeError -> [1,1,2] len=3 | a[0]++: 1 -> [4,1,2] len=3 | a[1] += 1: TypeError -> [3,1,2] len=3 | a[5] ??= 1: 1 -> [3,1,2,null,null,1] len=6 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, elem0 ro', 'L => frz("elem0 ro")', 'sort: TypeError -> [3,1,2] len=3 | sort cmp: TypeError -> [3,1,2] len=3 | reverse: TypeError -> [3,1,2] len=3 | fill: TypeError -> [3,1,2] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: TypeError -> [3,1,2] len=3 | copyWithin noop: TypeError -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: [] -> [3,1,2] len=3 | splice 0,0: [] -> [3,1,2] len=3 | splice 0,1: TypeError -> [3,1,2] len=3 | splice 1,1,x: [1] -> [3,"x",2] len=3 | splice end,0,x: [] -> [3,1,2,"x"] len=4 | push: 4 -> [3,1,2,4] len=4 | push none: 3 -> [3,1,2] len=3 | pop: 2 -> [3,1] len=2 | shift: TypeError -> [3,1,2] len=3 | unshift: TypeError -> [3,3,1,2] len=4 | unshift none: 3 -> [3,1,2] len=3 | length = 0: 0 -> [] len=0 | length = same: 3 -> [3,1,2] len=3 | length grow: 10 -> [3,1,2,null,null,null,null,null,null,null] len=10 | a[0] = v strict: TypeError -> [3,1,2] len=3 | a[len] = v strict: 4 -> [3,1,2,7] len=4 | a[0] = v sloppy: 3 -> [3,1,2] len=3 | delete a[0] strict: true -> [null,1,2] len=3 | delete a[0] sloppy: true -> [null,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: [3,1,2,1] -> [3,1,2] len=3 | Array.prototype.length=: true -> [3] len=1 | Reflect.set 0: false -> [3,1,2] len=3 | Reflect.defineProperty 0: true -> [99,1,2] len=3 | Reflect.deleteProperty 2: true -> [3,1,null] len=3 | Object.assign: TypeError -> [3,1,2] len=3 | destructure assign: TypeError -> [3,1,2] len=3 | a[0]++: TypeError -> [3,1,2] len=3 | a[1] += 1: 1 -> [3,2,2] len=3 | a[5] ??= 1: 1 -> [3,1,2,null,null,1] len=6 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, elem nonconfig', 'L => frz("elem nonconfig")', 'sort: same -> [1,2,3] len=3 | sort cmp: same -> [1,2,3] len=3 | reverse: same -> [2,1,3] len=3 | fill: same -> [9,9,9] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: same -> [1,2,2] len=3 | copyWithin noop: same -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: [] -> [3,1,2] len=3 | splice 0,0: [] -> [3,1,2] len=3 | splice 0,1: [3] -> [1,2] len=2 | splice 1,1,x: [1] -> [3,"x",2] len=3 | splice end,0,x: [] -> [3,1,2,"x"] len=4 | push: 4 -> [3,1,2,4] len=4 | push none: 3 -> [3,1,2] len=3 | pop: 2 -> [3,1] len=2 | shift: 3 -> [1,2] len=2 | unshift: 4 -> [0,3,1,2] len=4 | unshift none: 3 -> [3,1,2] len=3 | length = 0: TypeError -> [3,1] len=2 | length = same: 3 -> [3,1,2] len=3 | length grow: 10 -> [3,1,2,null,null,null,null,null,null,null] len=10 | a[0] = v strict: 7 -> [7,1,2] len=3 | a[len] = v strict: 4 -> [3,1,2,7] len=4 | a[0] = v sloppy: 7 -> [7,1,2] len=3 | delete a[0] strict: true -> [null,1,2] len=3 | delete a[0] sloppy: true -> [null,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: [3,1,2,1] -> [3,1,2] len=3 | Array.prototype.length=: false -> [3,1] len=2 | Reflect.set 0: true -> [1,1,2] len=3 | Reflect.defineProperty 0: true -> [99,1,2] len=3 | Reflect.deleteProperty 2: true -> [3,1,null] len=3 | Object.assign: 1 -> [8,1,2] len=3 | destructure assign: 1 -> [1,3,2] len=3 | a[0]++: 1 -> [4,1,2] len=3 | a[1] += 1: 1 -> [3,2,2] len=3 | a[5] ??= 1: 1 -> [3,1,2,null,null,1] len=6 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, elem getter only', 'L => frz("elem getter only")', 'sort: TypeError -> [1,1,2] len=3 | sort cmp: TypeError -> [1,1,2] len=3 | reverse: same -> [2,1,3] len=3 | fill: TypeError -> [9,1,2] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: TypeError -> [1,1,2] len=3 | copyWithin noop: TypeError -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: [] -> [3,1,2] len=3 | splice 0,0: [] -> [3,1,2] len=3 | splice 0,1: TypeError -> [1,1,2] len=3 | splice 1,1,x: TypeError -> [3,1,2] len=3 | splice end,0,x: [] -> [3,1,2,"x"] len=4 | push: 4 -> [3,1,2,4] len=4 | push none: 3 -> [3,1,2] len=3 | pop: 2 -> [3,1] len=2 | shift: TypeError -> [1,1,2] len=3 | unshift: TypeError -> [3,1,1,2] len=4 | unshift none: 3 -> [3,1,2] len=3 | length = 0: 0 -> [] len=0 | length = same: 3 -> [3,1,2] len=3 | length grow: 10 -> [3,1,2,null,null,null,null,null,null,null] len=10 | a[0] = v strict: 7 -> [7,1,2] len=3 | a[len] = v strict: 4 -> [3,1,2,7] len=4 | a[0] = v sloppy: 7 -> [7,1,2] len=3 | delete a[0] strict: true -> [null,1,2] len=3 | delete a[0] sloppy: true -> [null,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: [3,1,2,1] -> [3,1,2] len=3 | Array.prototype.length=: true -> [3] len=1 | Reflect.set 0: true -> [1,1,2] len=3 | Reflect.defineProperty 0: true -> [99,1,2] len=3 | Reflect.deleteProperty 2: true -> [3,1,null] len=3 | Object.assign: 1 -> [8,1,2] len=3 | destructure assign: TypeError -> [1,1,2] len=3 | a[0]++: 1 -> [4,1,2] len=3 | a[1] += 1: TypeError -> [3,1,2] len=3 | a[5] ??= 1: 1 -> [3,1,2,null,null,1] len=6 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, frozen arraylike', 'L => frz("frozen arraylike")', 'sort: TypeError -> [3,1,2] len=3 | sort cmp: TypeError -> [3,1,2] len=3 | reverse: TypeError -> [3,1,2] len=3 | fill: TypeError -> [3,1,2] len=3 | fill empty range: same -> [3,1,2] len=3 | copyWithin: TypeError -> [3,1,2] len=3 | copyWithin noop: TypeError -> [3,1,2] len=3 | copyWithin empty: same -> [3,1,2] len=3 | splice none: TypeError -> [3,1,2] len=3 | splice 0,0: TypeError -> [3,1,2] len=3 | splice 0,1: TypeError -> [3,1,2] len=3 | splice 1,1,x: TypeError -> [3,1,2] len=3 | splice end,0,x: TypeError -> [3,1,2] len=3 | push: TypeError -> [3,1,2] len=3 | push none: TypeError -> [3,1,2] len=3 | pop: TypeError -> [3,1,2] len=3 | shift: TypeError -> [3,1,2] len=3 | unshift: TypeError -> [3,1,2] len=3 | unshift none: TypeError -> [3,1,2] len=3 | length = 0: TypeError -> [3,1,2] len=3 | length = same: TypeError -> [3,1,2] len=3 | length grow: TypeError -> [3,1,2] len=3 | a[0] = v strict: TypeError -> [3,1,2] len=3 | a[len] = v strict: TypeError -> [3,1,2] len=3 | a[0] = v sloppy: 3 -> [3,1,2] len=3 | delete a[0] strict: TypeError -> [3,1,2] len=3 | delete a[0] sloppy: false -> [3,1,2] len=3 | toSorted: [1,2,3] -> [3,1,2] len=3 | toReversed: [2,1,3] -> [3,1,2] len=3 | with: [5,1,2] -> [3,1,2] len=3 | toSpliced: [1,2] -> [3,1,2] len=3 | concat: 0 -> [3,1,2] len=3 | Array.prototype.length=: false -> [3,1,2] len=3 | Reflect.set 0: false -> [3,1,2] len=3 | Reflect.defineProperty 0: false -> [3,1,2] len=3 | Reflect.deleteProperty 2: false -> [3,1,2] len=3 | Object.assign: TypeError -> [3,1,2] len=3 | destructure assign: TypeError -> [3,1,2] len=3 | a[0]++: TypeError -> [3,1,2] len=3 | a[1] += 1: TypeError -> [3,1,2] len=3 | a[5] ??= 1: TypeError -> [3,1,2] len=3 | a[0] ||= 1: 1 -> [3,1,2] len=3');
c('array, frozen sorted arraylike', 'L => frz("frozen sorted arraylike")', 'sort: TypeError -> [1,2,3] len=3 | sort cmp: TypeError -> [1,2,3] len=3 | reverse: TypeError -> [1,2,3] len=3 | fill: TypeError -> [1,2,3] len=3 | fill empty range: same -> [1,2,3] len=3 | copyWithin: TypeError -> [1,2,3] len=3 | copyWithin noop: TypeError -> [1,2,3] len=3 | copyWithin empty: same -> [1,2,3] len=3 | splice none: TypeError -> [1,2,3] len=3 | splice 0,0: TypeError -> [1,2,3] len=3 | splice 0,1: TypeError -> [1,2,3] len=3 | splice 1,1,x: TypeError -> [1,2,3] len=3 | splice end,0,x: TypeError -> [1,2,3] len=3 | push: TypeError -> [1,2,3] len=3 | push none: TypeError -> [1,2,3] len=3 | pop: TypeError -> [1,2,3] len=3 | shift: TypeError -> [1,2,3] len=3 | unshift: TypeError -> [1,2,3] len=3 | unshift none: TypeError -> [1,2,3] len=3 | length = 0: TypeError -> [1,2,3] len=3 | length = same: TypeError -> [1,2,3] len=3 | length grow: TypeError -> [1,2,3] len=3 | a[0] = v strict: TypeError -> [1,2,3] len=3 | a[len] = v strict: TypeError -> [1,2,3] len=3 | a[0] = v sloppy: 1 -> [1,2,3] len=3 | delete a[0] strict: TypeError -> [1,2,3] len=3 | delete a[0] sloppy: false -> [1,2,3] len=3 | toSorted: [1,2,3] -> [1,2,3] len=3 | toReversed: [3,2,1] -> [1,2,3] len=3 | with: [5,2,3] -> [1,2,3] len=3 | toSpliced: [2,3] -> [1,2,3] len=3 | concat: 0 -> [1,2,3] len=3 | Array.prototype.length=: false -> [1,2,3] len=3 | Reflect.set 0: false -> [1,2,3] len=3 | Reflect.defineProperty 0: false -> [1,2,3] len=3 | Reflect.deleteProperty 2: false -> [1,2,3] len=3 | Object.assign: TypeError -> [1,2,3] len=3 | destructure assign: TypeError -> [1,2,3] len=3 | a[0]++: TypeError -> [1,2,3] len=3 | a[1] += 1: TypeError -> [1,2,3] len=3 | a[5] ??= 1: TypeError -> [1,2,3] len=3 | a[0] ||= 1: 1 -> [1,2,3] len=3');

section('2. sort, Proxy traps of the array methods, typed arrays over a resized or detached buffer');
c('sorted elem ro', '() => { var a = [1, 2, 3]; Object.defineProperty(a, 1, { writable: false }); return a.sort() }', 'THROW TypeError');
c('sorted getter only', '() => { var a = [1, 2, 3]; Object.defineProperty(a, 1, { get() { return 2 }, configurable: true }); return a.sort() }', 'THROW TypeError');
c('setter log', '() => { var log = []; var a = [1, 2, 3]; var v = 2; Object.defineProperty(a, 1, { get() { log.push(\'get\'); return v }, set(x) { log.push(\'set \' + x); v = x }, configurable: true }); a.sort(); return log }', '=> ["get","set 2"]');
c('proxy log', '() => { var log = []; var a = new Proxy([1, 2, 3], { set(t, k, v, r) { log.push(\'set \' + String(k) + \'=\' + v); return Reflect.set(t, k, v, r) }, get(t, k, r) { if (typeof k == \'string\') log.push(\'get \' + k); return Reflect.get(t, k, r) }, has(t, k) { log.push(\'has \' + String(k)); return Reflect.has(t, k) }, deleteProperty(t, k) { log.push(\'delete \' + String(k)); return Reflect.deleteProperty(t, k) } }); Array.prototype.sort.call(a); return log }', '=> ["get length","has 0","get 0","has 1","get 1","has 2","get 2","set 0=1","set 1=2","set 2=3"]');
c('proxy log unsorted holes', '() => { var log = []; var a = new Proxy([3, , undefined, 1], { set(t, k, v, r) { log.push(\'set \' + String(k) + \'=\' + v); return Reflect.set(t, k, v, r) }, get(t, k, r) { if (typeof k == \'string\') log.push(\'get \' + k); return Reflect.get(t, k, r) }, has(t, k) { log.push(\'has \' + String(k)); return Reflect.has(t, k) }, deleteProperty(t, k) { log.push(\'delete \' + String(k)); return Reflect.deleteProperty(t, k) } }); Array.prototype.sort.call(a); return log }', '=> ["get length","has 0","get 0","has 1","has 2","get 2","has 3","get 3","set 0=1","set 1=3","set 2=undefined","delete 3"]');
c('proxy reverse', '() => { var log = []; var a = new Proxy([1, 2, 3], { set(t, k, v, r) { log.push(\'set \' + String(k) + \'=\' + v); return Reflect.set(t, k, v, r) }, get(t, k, r) { if (typeof k == \'string\') log.push(\'get \' + k); return Reflect.get(t, k, r) }, has(t, k) { log.push(\'has \' + String(k)); return Reflect.has(t, k) }, deleteProperty(t, k) { log.push(\'delete \' + String(k)); return Reflect.deleteProperty(t, k) } }); Array.prototype.reverse.call(a); return log }', '=> ["get length","has 0","get 0","has 2","get 2","set 0=3","set 2=1"]');
c('proxy fill', '() => { var log = []; var a = new Proxy([1, 2], { set(t, k, v, r) { log.push(\'set \' + String(k) + \'=\' + v); return Reflect.set(t, k, v, r) }, get(t, k, r) { if (typeof k == \'string\') log.push(\'get \' + k); return Reflect.get(t, k, r) } }); Array.prototype.fill.call(a, 0); return log }', '=> ["get length","set 0=0","set 1=0"]');
c('proxy copyWithin', '() => { var log = []; var a = new Proxy([1, 2, 3], { set(t, k, v, r) { log.push(\'set \' + String(k) + \'=\' + v); return Reflect.set(t, k, v, r) }, get(t, k, r) { if (typeof k == \'string\') log.push(\'get \' + k); return Reflect.get(t, k, r) }, has(t, k) { log.push(\'has \' + String(k)); return Reflect.has(t, k) }, deleteProperty(t, k) { log.push(\'delete \' + String(k)); return Reflect.deleteProperty(t, k) } }); Array.prototype.copyWithin.call(a, 0, 1); return log }', '=> ["get length","has 1","get 1","set 0=2","has 2","get 2","set 1=3"]');
c('proxy push/pop/shift/unshift/splice', '() => { var log = []; var a = new Proxy([1, 2, 3], { set(t, k, v, r) { log.push(\'set \' + String(k) + \'=\' + v); return Reflect.set(t, k, v, r) }, get(t, k, r) { if (typeof k == \'string\') log.push(\'get \' + k); return Reflect.get(t, k, r) }, has(t, k) { log.push(\'has \' + String(k)); return Reflect.has(t, k) }, deleteProperty(t, k) { log.push(\'delete \' + String(k)); return Reflect.deleteProperty(t, k) }, defineProperty(t, k, d) { log.push(\'define \' + String(k)); return Reflect.defineProperty(t, k, d) } }); a.push(4); log.push(\'--\'); a.pop(); log.push(\'--\'); a.shift(); log.push(\'--\'); a.unshift(0); log.push(\'--\'); a.splice(1, 1, \'x\', \'y\'); return log }', '=> ["get push","get length","set 3=4","define 3","set length=4","define length","--","get pop","get length","get 3","delete 3","set length=3","define length","--","get shift","get length","get 0","has 1","get 1","set 0=2","define 0","has 2","get 2","set 1=3","define 1","delete 2","set length=2","define length","--","get unshift","get length","has 1","get 1","set 2=3","define 2","has 0","get 0","set 1=2","define 1","set 0=0","define 0","set length=3","define length","--","get splice","get length","get constructor","has 1","get 1","has 2","get 2","set 3=3","define 3","set 1=x","define 1","set 2=y","define 2","set length=4","define length"]');
c('frozen typed', '() => { var a = new Uint8Array([3, 1, 2]); try { Object.freeze(a) } catch (e) { return \'cannot freeze: \' + e.name } }', '=> "cannot freeze: TypeError"');
c('frozen empty typed', '() => { var a = Object.freeze(new Uint8Array(0)); a.sort(); return Object.isFrozen(a) }', '=> true');
c('typed sort sorted', '() => Array.from(new Uint8Array([1, 2, 3]).sort())', '=> [1,2,3]');
c('typed detached sort', '() => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); b.transfer(); return a.sort().length }', 'THROW TypeError');
c('typed detached fill', '() => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); b.transfer(); return a.fill(1).length }', 'THROW TypeError');
c('typed detached reverse', '() => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); b.transfer(); return a.reverse().length }', 'THROW TypeError');
c('typed detached copyWithin', '() => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); b.transfer(); return a.copyWithin(0, 1).length }', 'THROW TypeError');
c('typed detached set', '() => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); b.transfer(); a.set([1]); return 1 }', 'THROW TypeError');
c('typed detached idx write', '() => { \'use strict\'; var b = new ArrayBuffer(4); var a = new Uint8Array(b); b.transfer(); a[0] = 1; return [a[0], a.length, a.byteLength, a.byteOffset] }', '=> [undefined,0,0,0]');
c('typed detached during sort', '() => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); a.set([4, 3, 2, 1]); a.sort((x, y) => { try { b.transfer() } catch (e) {} return x - y }); return a.length }', '=> 0');
c('typed detached during fill', '() => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); a.fill({ valueOf() { b.transfer(); return 1 } }); return a.length }', 'THROW TypeError');
c('typed detached join/includes/indexOf', '() => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); b.transfer(); return [a.join(), a.includes(0), a.indexOf(0), a.at(0), Array.from(a)] }', 'THROW TypeError');
c('resizable shrink', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var a = new Uint8Array(b); var f = new Uint8Array(b, 0, 8); b.resize(4); return [a.length, f.length, f.byteLength, f.byteOffset] }', '=> [4,0,0,0]');
c('resizable shrink ops on OOB', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var f = new Uint8Array(b, 0, 8); b.resize(4); return f.fill(1).length }', 'THROW TypeError');
c('resizable shrink sort on OOB', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var f = new Uint8Array(b, 0, 8); b.resize(4); return f.sort().length }', 'THROW TypeError');
c('resizable shrink idx', '() => { \'use strict\'; var b = new ArrayBuffer(8, { maxByteLength: 16 }); var f = new Uint8Array(b, 0, 8); b.resize(4); f[0] = 1; return [f[0], 0 in f, Object.keys(f)] }', '=> [undefined,false,[]]');
c('resizable grow tracking', '() => { var b = new ArrayBuffer(4, { maxByteLength: 16 }); var a = new Uint8Array(b); b.resize(8); a[7] = 9; return [a.length, a[7], Array.from(a.fill(2))] }', '=> [8,9,[2,2,2,2,2,2,2,2]]');
c('resizable shrink during fill', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var a = new Uint8Array(b); a.fill({ valueOf() { b.resize(2); return 5 } }); return Array.from(a) }', '=> [5,5]');
c('resizable shrink during sort', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var a = new Uint8Array(b); a.set([8, 7, 6, 5, 4, 3, 2, 1]); var done = false; a.sort((x, y) => { if (!done) { done = true; b.resize(4) } return x - y }); return Array.from(a) }', '=> [1,2,3,4]');
c('resizable shrink during copyWithin', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var a = new Uint8Array(b); a.set([1, 2, 3, 4, 5, 6, 7, 8]); a.copyWithin(0, { valueOf() { b.resize(4); return 2 } }); return Array.from(a) }', '=> [3,4,3,4]');
c('resizable shrink during set', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var a = new Uint8Array(b); a.set({ length: 3, 0: 1, get 1() { b.resize(1); return 2 }, 2: 3 }); return Array.from(a) }', '=> [1]');
c('resizable shrink during slice', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var a = new Uint8Array(b); a.set([1, 2, 3, 4, 5, 6, 7, 8]); return Array.from(a.slice(0, { valueOf() { b.resize(2); return 6 } })) }', '=> [1,2,0,0,0,0]');
c('resizable shrink during subarray', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var a = new Uint8Array(b); return a.subarray(0, { valueOf() { b.resize(2); return 6 } }).length }', 'THROW RangeError');
c('resizable DataView', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var d = new DataView(b, 0, 8); b.resize(4); return d.byteLength }', 'THROW TypeError');
c('resizable DataView tracking', '() => { var b = new ArrayBuffer(8, { maxByteLength: 16 }); var d = new DataView(b); b.resize(4); return [d.byteLength, (() => { try { return d.getUint8(6) } catch (e) { return e.name } })()] }', '=> [4,"RangeError"]');
c('array frozen during sort', '() => { var a = [3, 2, 1]; var n = 0; try { a.sort((x, y) => { if (!n++) Object.freeze(a); return x - y }) } catch (e) { return [e.name, a] } return a }', '=> ["TypeError",[3,2,1]]');
c('array length shrunk during sort', '() => { var a = [3, 2, 1]; var n = 0; a.sort((x, y) => { if (!n++) a.length = 0; return x - y }); return a }', '=> [1,2,3]');
c('array grown in comparator', '() => { var a = [3, 2, 1]; var n = 0; a.sort((x, y) => { if (!n++) a.push(0); return x - y }); return a }', '=> [1,2,3,0]');
c('sort undefined + holes', '() => { var a = [3, undefined, , 1]; a.sort(); return [a, 2 in a, 3 in a, a.length] }', '=> [[1,3,undefined,<hole>],true,false,4]');
c('sort proto element through hole', '() => { var a = [3, , 1]; Array.prototype[1] = 2; try { a.sort(); return [a, a.hasOwnProperty(1)] } finally { delete Array.prototype[1] } }', '=> [[1,2,3],true]');
c('sort stable', '() => { var a = []; for (var i = 0; i < 40; i++) a.push({ k: i % 3, i }); a.sort((x, y) => x.k - y.k); return a.map(o => o.i).join() }', '=> "0,3,6,9,12,15,18,21,24,27,30,33,36,39,1,4,7,10,13,16,19,22,25,28,31,34,37,2,5,8,11,14,17,20,23,26,29,32,35,38"');
c('sort comparator throws', '() => { var a = [3, 2, 1]; try { a.sort(() => { throw new Error(\'c\') }) } catch (e) { return [e.message, a] } }', '=> ["c",[3,2,1]]');
c('sort comparator not fn', '() => [1].sort(null)', 'THROW TypeError');
c('sort string default', '() => [10, 9, 1, \'b\', \'a\', undefined, null].sort()', '=> [1,10,9,"a","b",null,undefined]');
await drain();
helpers('function pxy(L) { return new Proxy([1, 2, 3], { set(t, k, v, r) { L(\'set \' + String(k) + \'=\' + v); return Reflect.set(t, k, v, r) }, get(t, k, r) { if (typeof k == \'string\') L(\'get \' + k); return Reflect.get(t, k, r) }, has(t, k) { L(\'has \' + String(k)); return Reflect.has(t, k) }, deleteProperty(t, k) { L(\'delete \' + String(k)); return Reflect.deleteProperty(t, k) }, defineProperty(t, k, d) { L(\'define \' + String(k)); return Reflect.defineProperty(t, k, d) } }) }');
c('proxy of [1,2,3] with five traps: push', 'L => { (a => a.push(4))(pxy(L)) }', 'get push | get length | set 3=4 | define 3 | set length=4 | define length');
c('proxy of [1,2,3] with five traps: pop', 'L => { (a => a.pop())(pxy(L)) }', 'get pop | get length | get 2 | delete 2 | set length=2 | define length');
c('proxy of [1,2,3] with five traps: shift', 'L => { (a => a.shift())(pxy(L)) }', 'get shift | get length | get 0 | has 1 | get 1 | set 0=2 | define 0 | has 2 | get 2 | set 1=3 | define 1 | delete 2 | set length=2 | define length');
c('proxy of [1,2,3] with five traps: unshift', 'L => { (a => a.unshift(0))(pxy(L)) }', 'get unshift | get length | has 2 | get 2 | set 3=3 | define 3 | has 1 | get 1 | set 2=2 | define 2 | has 0 | get 0 | set 1=1 | define 1 | set 0=0 | define 0 | set length=4 | define length');
c('proxy of [1,2,3] with five traps: splice', 'L => { (a => a.splice(1, 1, \'x\', \'y\'))(pxy(L)) }', 'get splice | get length | get constructor | has 1 | get 1 | has 2 | get 2 | set 3=3 | define 3 | set 1=x | define 1 | set 2=y | define 2 | set length=4 | define length');
c('proxy of [1,2,3] with five traps: set idx', 'L => { (a => { a[5] = 1 })(pxy(L)) }', 'set 5=1 | define 5');
c('proxy of [1,2,3] with five traps: set length', 'L => { (a => { a.length = 1 })(pxy(L)) }', 'set length=1 | define length');
c('proxy of [1,2,3] with five traps: reflect set receiver', 'L => { (a => { Reflect.set([], \'length\', 1, a) })(pxy(L)) }', 'define length');
c('proxy defineProperty invariants still enforced', 'L => { var t = {}; Object.defineProperty(t, \'x\', { value: 1, writable: true, configurable: false }); var r = []; var lie = new Proxy(t, { defineProperty() { return true } }); for (var d of [{ value: 2 }, { writable: true }, { writable: false }, { value: 2, writable: false }, { configurable: true }, { enumerable: true }, { get() { } }]) { try { Object.defineProperty(lie, \'x\', d); r.push(\'ok\') } catch (e) { r.push(e.name) } } return r }', '=> ["ok","ok","TypeError","TypeError","TypeError","TypeError","TypeError"]');
c('proxy defineProperty: frozen target value mismatch', 'L => { var t = Object.freeze({ x: 1 }); var lie = new Proxy(t, { defineProperty() { return true } }); var r = []; for (var d of [{ value: 1 }, { value: 2 }, {}]) { try { Object.defineProperty(lie, \'x\', d); r.push(\'ok\') } catch (e) { r.push(e.name) } } return r }', '=> ["ok","TypeError","ok"]');

section('3. Order of evaluation: assignment, compound assignment, destructuring, spread, templates, Proxy traps');
/* 'with assignment after delete': the binding is found in the object before the
   right-hand side deletes it, and the assignment then goes to the object
   (SetMutableBinding of an object environment, sloppy mode). This engine does
   that; V8 assigns the outer variable instead. */
await drain();
helpers('function px(L, name, target) { return new Proxy(target || {}, { get(t, k, r) { L(name + \'.get \' + String(k)); return Reflect.get(t, k, r) }, set(t, k, v, r) { L(name + \'.set \' + String(k)); return Reflect.set(t, k, v, r) }, has(t, k) { L(name + \'.has \' + String(k)); return Reflect.has(t, k) }, deleteProperty(t, k) { L(name + \'.delete \' + String(k)); return Reflect.deleteProperty(t, k) }, defineProperty(t, k, d) { L(name + \'.define \' + String(k)); return Reflect.defineProperty(t, k, d) }, getOwnPropertyDescriptor(t, k) { L(name + \'.gopd \' + String(k)); return Reflect.getOwnPropertyDescriptor(t, k) }, ownKeys(t) { L(name + \'.ownKeys\'); return Reflect.ownKeys(t) }, getPrototypeOf(t) { L(name + \'.getProto\'); return Reflect.getPrototypeOf(t) }, setPrototypeOf(t, p) { L(name + \'.setProto\'); return Reflect.setPrototypeOf(t, p) }, isExtensible(t) { L(name + \'.isExt\'); return Reflect.isExtensible(t) }, preventExtensions(t) { L(name + \'.prevExt\'); return Reflect.preventExtensions(t) }, apply(t, th, a) { L(name + \'.apply\'); return Reflect.apply(t, th, a) }, construct(t, a, nt) { L(name + \'.construct\'); return Reflect.construct(t, a, nt) }, }) } function key(L, n) { return { toString() { L(\'key \' + n); return n } } } function obj(L, o) { return new Proxy(o || {}, { get(t, k, r) { L(\'get \' + String(k)); return Reflect.get(t, k, r) }, set(t, k, v, r) { L(\'set \' + String(k)); return Reflect.set(t, k, v, r) } }) }');
c('key order: =', 'L => { var o = obj(L); (L(\'obj\'), o)[(L(\'keyexpr\'), key(L, \'a\'))] = (L(\'rhs\'), 1) }', 'obj | keyexpr | rhs | key a | set a');
c('key order: = null', 'L => { var o = null; o[key(L, \'a\')] = (L(\'rhs\'), 1) }', 'rhs | THROW TypeError');
c('key order: = undefined', 'L => { var o; o[key(L, \'a\')] = (L(\'rhs\'), 1) }', 'rhs | THROW TypeError');
c('key order: = on number', 'L => { (5)[key(L, \'a\')] = (L(\'rhs\'), 1) }', 'rhs | key a');
c('key order: = rhs throws', 'L => { var o = obj(L); o[key(L, \'a\')] = (() => { throw new Error(\'x\') })() }', 'THROW Error');
c('key order: = key throws', 'L => { var o = obj(L); o[{ toString() { L(\'key\'); throw new Error(\'k\') } }] = L(\'rhs\') }', 'rhs | key | THROW Error');
c('key order: +=', 'L => { var o = obj(L, { a: 1 }); o[key(L, \'a\')] += (L(\'rhs\'), 1); return o.a }', 'key a | get a | rhs | key a | set a | get a | => 2');
c('key order: += null', 'L => { var o = null; o[key(L, \'a\')] += (L(\'rhs\'), 1) }', 'THROW TypeError');
c('key order: ++ pre', 'L => { var o = obj(L, { a: 1 }); return ++o[key(L, \'a\')] }', 'key a | get a | key a | set a | => 2');
c('key order: -- post', 'L => { var o = obj(L, { a: 1 }); return o[key(L, \'a\')]-- }', 'key a | get a | key a | set a | => 1');
c('key order: ??=', 'L => { var o = obj(L, { a: null }); o[key(L, \'a\')] ??= (L(\'rhs\'), 1) }', 'key a | get a | rhs | key a | set a');
c('key order: ??= short', 'L => { var o = obj(L, { a: 0 }); o[key(L, \'a\')] ??= (L(\'rhs\'), 1) }', 'key a | get a');
c('key order: &&=', 'L => { var o = obj(L, { a: 1 }); o[key(L, \'a\')] &&= (L(\'rhs\'), 2) }', 'key a | get a | rhs | key a | set a');
c('key order: ||=', 'L => { var o = obj(L, { a: 0 }); o[key(L, \'a\')] ||= (L(\'rhs\'), 2) }', 'key a | get a | rhs | key a | set a');
c('key order: **=', 'L => { var o = obj(L, { a: 3 }); o[key(L, \'a\')] **= 2; return o.a }', 'key a | get a | key a | set a | get a | => 9');
c('key order: key changes between', 'L => { var n = 0; var k = { toString() { return \'k\' + n++ } }; var o = { k0: 1 }; o[k] += 10; return o }', '=> {k0:1,k1:11}');
c('key order: destructure target', 'L => { var o = obj(L); [o[key(L, \'a\')], o[key(L, \'b\')]] = [(L(\'v1\'), 1), 2] }', 'v1 | key a | set a | key b | set b');
c('key order: destructure obj target', 'L => { var o = obj(L); ({ x: o[key(L, \'a\')] } = { get x() { L(\'get x\'); return 1 } }) }', 'get x | key a | set a');
c('key order: for-of target', 'L => { var o = obj(L); for (o[key(L, \'a\')] of [1, 2]); }', 'key a | set a | key a | set a');
c('key order: for-in target', 'L => { var o = obj(L); for (o[key(L, \'a\')] in { p: 1 }); }', 'key a | set a');
c('key order: chained', 'L => { var o = obj(L), q = obj(L); o[key(L, \'a\')] = q[key(L, \'b\')] = (L(\'rhs\'), 1) }', 'rhs | key b | set b | key a | set a');
c('key order: array idx', 'L => { var a = [1, 2, 3]; var i = 0; a[i++] = a[i++] + a[i]; return [a, i] }', '=> [[5,2,3],2]');
c('key order: array idx compound', 'L => { var a = [1, 2, 3]; var i = 0; a[i++] += a[i++]; return [a, i] }', '=> [[3,2,3],2]');
c('key order: typed', 'L => { var a = new Uint8Array(2); a[key(L, \'0\')] = { valueOf() { L(\'valueOf\'); return 7 } }; return a[0] }', 'key 0 | valueOf | => 7');
c('key order: typed oob key order', 'L => { var a = new Uint8Array(2); a[key(L, \'5\')] = { valueOf() { L(\'valueOf\'); return 7 } }; return a.length }', 'key 5 | valueOf | => 2');
c('key order: string key number', 'L => { var o = {}; o[1.5] = 1; o[-0] = 2; o[1e21] = 3; o[2 ** 31] = 4; o[-1] = 5; return Object.keys(o) }', '=> ["0","2147483648","1.5","1e+21","-1"]');
c('key order: symbol key', 'L => { var s = Symbol(\'s\'); var o = {}; o[s] = 1; o[s] += 1; o[s]++; return o[s] }', '=> 3');
c('key order: super[k] =', 'L => { class A { } class B extends A { m() { super[key(L, \'a\')] = (L(\'rhs\'), 1); return this.a } } return new B().m() }', 'rhs | key a | => 1');
c('key order: super[k] +=', 'L => { class A { get a() { L(\'get a\'); return 1 } set a(v) { L(\'set a \' + v) } } class B extends A { m() { super[key(L, \'a\')] += (L(\'rhs\'), 1) } } new B().m() }', 'key a | get a | rhs | key a | set a 2');
c('key order: delete null[k]', 'L => { var o = null; delete o[key(L, \'a\')] }', 'THROW TypeError');
c('key order: call null[k]', 'L => { var o = null; o[key(L, \'a\')]() }', 'THROW TypeError');
c('key order: get null[k]', 'L => { var o = null; return o[key(L, \'a\')] }', 'THROW TypeError');
c('key order: in order', 'L => { return (L(\'l\'), key(L, \'a\')) in (L(\'r\'), obj(L, {})) }', 'l | r | key a | => false');
c('key order: template', 'L => { return `${(L(1), \'a\')}${{ toString() { L(\'ts\'); return \'b\' } }}${(L(3), \'c\')}` }', '1 | ts | 3 | => "abc"');
c('key order: template valueOf vs toString', 'L => { var o = { valueOf() { L(\'valueOf\'); return 1 }, toString() { L(\'toString\'); return \'s\' } }; return `${o}|` + o }', 'toString | valueOf | => "s|1"');
c('key order: template symbol', 'L => { return `${Symbol()}` }', 'THROW TypeError');
c('key order: template types', 'L => { return `${1}${-0}${1.5}${null}${undefined}${true}${10n}${[1, [2]]}${{}}${1e21}${NaN}` }', '=> "101.5nullundefinedtrue101,2[object Object]1e+21NaN"');
c('key order: template toPrimitive', 'L => { return `${{ [Symbol.toPrimitive](h) { L(h); return 7 } }}` }', 'string | => "7"');
c('key order: template nested', 'L => { return `a${`b${(L(\'in\'), 1)}c`}d${(L(\'out\'), 2)}` }', 'in | out | => "ab1cd2"');
c('key order: template toString returns object', 'L => { return `${{ toString() { return {} }, valueOf() { L(\'vo\'); return 5 } }}` }', 'vo | => "5"');
c('key order: tagged not converted', 'L => { function tag(s, v) { return typeof v } return tag`${{ toString() { L(\'never\') } }}` }', '=> "object"');
c('assign order o[k] = v', 'L => { var o = px(L, \'o\'); (L(\'obj\'), o)[key(L, \'a\')] = (L(\'rhs\'), 1) }', 'obj | rhs | key a | o.set a | o.gopd a | o.define a');
c('compound o[k] += v', 'L => { var o = px(L, \'o\', { a: 1 }); (L(\'obj\'), o)[key(L, \'a\')] += (L(\'rhs\'), 1) }', 'obj | key a | o.get a | rhs | key a | o.set a | o.gopd a | o.define a');
c('o[k]++', 'L => { var o = px(L, \'o\', { a: 1 }); o[key(L, \'a\')]++ }', 'key a | o.get a | key a | o.set a | o.gopd a | o.define a');
c('o[k] ??= v', 'L => { var o = px(L, \'o\', { a: null }); o[key(L, \'a\')] ??= (L(\'rhs\'), 1) }', 'key a | o.get a | rhs | key a | o.set a | o.gopd a | o.define a');
c('o[k] ||= v short', 'L => { var o = px(L, \'o\', { a: 1 }); o[key(L, \'a\')] ||= (L(\'rhs\'), 1) }', 'key a | o.get a');
c('null base assign', 'L => { var o = null; o[key(L, \'a\')] = (L(\'rhs\'), 1) }', 'rhs | THROW TypeError');
c('undefined base compound', 'L => { var o; o[key(L, \'a\')] += (L(\'rhs\'), 1) }', 'THROW TypeError');
c('null base call', 'L => { var o = null; o[key(L, \'a\')](L(\'arg\')) }', 'THROW TypeError');
c('delete o[k]', 'L => { var o = px(L, \'o\', { a: 1 }); return delete o[key(L, \'a\')] }', 'key a | o.delete a | => true');
c('k in o', 'L => { var o = px(L, \'o\', { a: 1 }); return key(L, \'a\') in o }', 'key a | o.has a | => true');
c('super prop', 'L => { class A { get x() { L(\'A.x get\'); return 1 } set x(v) { L(\'A.x set\') } } class B extends A { m() { super.x = (L(\'rhs\'), 2); return super.x } } return new B().m() }', 'rhs | A.x set | A.x get | => 1');
c('destructure obj', 'L => { var { a, b = (L(\'default b\'), 2), ...rest } = px(L, \'s\', { a: 1, c: 3, d: 4 }); return [a, b, rest] }', 's.get a | s.get b | default b | s.ownKeys | s.gopd c | s.get c | s.gopd d | s.get d | => [1,2,{c:3,d:4}]');
c('destructure obj computed', 'L => { var { [key(L, \'a\')]: x, [key(L, \'b\')]: y = L(\'dflt\') } = px(L, \'s\', { a: 1 }); }', 'key a | s.get a | key b | s.get b | dflt');
c('destructure assign targets', 'L => { var tgt = px(L, \'t\'); var src = px(L, \'s\', { a: 1, b: 2 }); ({ a: (L(\'target a\'), tgt).x, b: (L(\'target b\'), tgt).y } = src) }', 'target a | s.get a | t.set x | t.gopd x | t.define x | target b | s.get b | t.set y | t.gopd y | t.define y');
c('destructure array assign targets', 'L => { var tgt = px(L, \'t\'); [(L(\'target 0\'), tgt).x, (L(\'target 1\'), tgt).y = (L(\'dflt\'), 5)] = [1] }', 'target 0 | t.set x | t.gopd x | t.define x | target 1 | dflt | t.set y | t.gopd y | t.define y');
c('destructure array holes rest', 'L => { var tgt = px(L, \'t\'); [, tgt.a, ...tgt.r] = [1, 2, 3, 4] }', 't.set a | t.gopd a | t.define a | t.set r | t.gopd r | t.define r');
c('destructure nested', 'L => { var { a: { b }, c: [d] } = px(L, \'s\', { a: px(L, \'sa\', { b: 1 }), c: [2] }); return [b, d] }', 's.get a | sa.get b | s.get c | => [1,2]');
c('destructure from null', 'L => { var { a } = null }', 'THROW TypeError');
c('destructure empty from undefined', 'L => { var {} = undefined }', 'THROW TypeError');
c('destructure array from non-iterable', 'L => { var [a] = {} }', 'THROW TypeError');
c('spread obj', 'L => { return { ...px(L, \'s\', { a: 1, b: 2 }) } }', 's.ownKeys | s.gopd a | s.get a | s.gopd b | s.get b | => {a:1,b:2}');
c('spread obj with symbol + nonenum', 'L => { var s = { a: 1, [Symbol.for(\'q\')]: 2 }; Object.defineProperty(s, \'h\', { value: 3 }); var r = { ...px(L, \'s\', s) }; return Object.keys(r) }', 's.ownKeys | s.gopd a | s.get a | s.gopd h | s.gopd Symbol(q) | s.get Symbol(q) | => ["a"]');
c('spread obj getters', 'L => { return { x: 0, ...{ get a() { L(\'get a\'); return 1 } }, get b() { L(\'get b\'); return 2 } }.a }', 'get a | => 1');
c('spread obj null', 'L => { return { ...null, ...undefined, ...1, ...\'ab\', ...[9] } }', '=> {0:9,1:"b"}');
c('obj rest excludes', 'L => { var { a, ...r } = px(L, \'s\', { a: 1, b: 2 }); return r }', 's.get a | s.ownKeys | s.gopd b | s.get b | => {b:2}');
c('Object.assign', 'L => { Object.assign(px(L, \'t\'), px(L, \'s\', { a: 1, b: 2 })) }', 's.ownKeys | s.gopd a | s.get a | t.set a | t.gopd a | t.define a | s.gopd b | s.get b | t.set b | t.gopd b | t.define b');
c('spread call args order', 'L => { function f() { return arguments.length } return f(L(\'a1\'), ...(L(\'spread\'), [1, 2]), L(\'a3\')) }', 'a1 | spread | a3 | => 4');
c('array spread proxy', 'L => { return [...px(L, \'s\', [1, 2])] }', 's.get Symbol(Symbol.iterator) | s.get length | s.get 0 | s.get length | s.get 1 | s.get length | => [1,2]');
c('for-in proto chain shadow', 'L => { var p = { a: 1, b: 2 }; var o = Object.create(p); Object.defineProperty(o, \'a\', { value: 1, enumerable: false }); o.c = 3; var r = []; for (var k in o) r.push(k); return r }', '=> ["c","b"]');
c('for-in delete during', 'L => { var o = { a: 1, b: 2, c: 3 }; var r = []; for (var k in o) { r.push(k); delete o.b } return r }', '=> ["a","c"]');
c('for-in add during', 'L => { var o = { a: 1 }; var r = []; for (var k in o) { r.push(k); o.z = 1 } return r }', '=> ["a"]');
c('for-in order', 'L => { var o = { b: 1, 2: 1, a: 1, 1: 1, [Symbol()]: 1, \'-1\': 1, \'01\': 1 }; var r = []; for (var k in o) r.push(k); return r }', '=> ["1","2","b","a","-1","01"]');
c('Object.keys proxy', 'L => { return Object.keys(px(L, \'s\', { a: 1 })) }', 's.ownKeys | s.gopd a | => ["a"]');
c('Object.entries proxy', 'L => { return Object.entries(px(L, \'s\', { a: 1 })) }', 's.ownKeys | s.gopd a | s.get a | => [["a",1]]');
c('JSON.stringify proxy', 'L => { return JSON.stringify(px(L, \'s\', { a: 1 })) }', 's.get toJSON | s.ownKeys | s.gopd a | s.get a | => "{"a":1}"');
c('JSON.stringify proxy array', 'L => { return JSON.stringify(px(L, \'s\', [1])) }', 's.get toJSON | s.get length | s.get 0 | => "[1]"');
c('Object.freeze proxy', 'L => { Object.freeze(px(L, \'s\', { a: 1 })) }', 's.prevExt | s.ownKeys | s.gopd a | s.define a');
c('Object.isFrozen proxy', 'L => { return Object.isFrozen(px(L, \'s\', { a: 1 })) }', 's.isExt | => false');
c('Object.getOwnPropertyDescriptors proxy', 'L => { Object.getOwnPropertyDescriptors(px(L, \'s\', { a: 1 })) }', 's.ownKeys | s.gopd a');
c('instanceof proxy', 'L => { function F() {} return px(L, \'s\', new F()) instanceof px(L, \'F\', F) }', 'F.get Symbol(Symbol.hasInstance) | F.get prototype | s.getProto | => true');
c('call proxy', 'L => { function F() { return 7 } return px(L, \'F\', F)() }', 'F.apply | => 7');
c('class extends proxy', 'L => { function F() {} var P2 = px(L, \'F\', F); class C extends P2 {} new C(); }', 'F.get prototype | F.construct');
c('with proxy', 'L => { var o = px(L, \'w\', { a: 1 }); with (o) { a = 2; return typeof zz + a } }', 'w.has a | w.get Symbol(Symbol.unscopables) | w.set a | w.gopd a | w.define a | w.has zz | w.has a | w.get Symbol(Symbol.unscopables) | w.get a | => "undefined2"');
c('with unscopables', 'L => { var o = { a: 1, b: 2, [Symbol.unscopables]: { a: true } }; var a = \'outer\', b = \'outer\'; with (o) { return [a, b] } }', '=> ["outer",2]');
c('with function call this', 'L => { var o = { f() { return this === o } }; with (o) { return f() } }', '=> true');
c('with assignment after delete', 'L => { var o = { x: 1 }; var x = \'outer\'; with (o) { x = (delete o.x, 5) } return [x, o.x] }', '=> ["outer",5]');
c('with var hoist', 'L => { var o = { v: 1 }; with (o) { var v = 2; } return [v, o.v] }', '=> [undefined,2]');
c('with typeof undeclared', 'L => { with ({}) { return typeof nope } }', '=> "undefined"');
c('with fn decl', 'L => { var o = { g: 1 }; with (o) { function g() {} } return [typeof g, o.g] }', '=> ["function",1]');
c('with let in block', 'L => { var o = { z: 1 }; with (o) { let z = 2; return z } }', '=> 2');
c('with closure', 'L => { var o = { z: 1 }; var f; with (o) { f = () => z } o.z = 5; return f() }', '=> 5');
c('with proxy has false', 'L => { var q = \'outer\'; var o = new Proxy({ q: 1 }, { has(t, k) { L(\'has \' + String(k)); return false } }); with (o) { return q } }', 'has q | => "outer"');
c('getter/setter define order', 'L => { var o = { get a() { return 1 }, set a(v) {}, a: 2, get a() { return 3 } }; var d = Object.getOwnPropertyDescriptor(o, \'a\'); return [typeof d.get, typeof d.set, d.value] }', '=> ["function","undefined",undefined]');
c('__proto__ literal', 'L => { var o = { __proto__: Array.prototype, [\'__proto__\']: 5 }; return [o instanceof Array, Object.keys(o)] }', '=> [true,["__proto__"]]');
c('computed key order', 'L => { return Object.keys({ [(L(\'k1\'), \'a\')]: L(\'v1\'), [(L(\'k2\'), \'b\')]: L(\'v2\') }) }', 'k1 | v1 | k2 | v2 | => ["a","b"]');
c('class field order', 'L => { class C { [(L(\'key a\'), \'a\')] = L(\'init a\'); static [(L(\'key s\'), \'s\')] = L(\'init s\'); [(L(\'key b\'), \'b\')] = L(\'init b\'); constructor() { L(\'ctor\') } } L(\'defined\'); new C(); }', 'key a | key s | key b | init s | defined | init a | init b | ctor');
c('class static block order', 'L => { class C { static a = L(\'a\'); static { L(\'block\') } static b = L(\'b\'); } }', 'a | block | b');
c('class heritage eval order', 'L => { try { class C extends (L(\'heritage\'), null) { [(L(\'key\'), \'m\')]() {} } new C() } catch (e) { L(e.name) } }', 'heritage | key | TypeError');
c('template literal order', 'L => { return `${(L(1), \'a\')}${{ toString() { L(\'ts\'); return \'b\' } }}${(L(3), \'c\')}` }', '1 | ts | 3 | => "abc"');
c('tagged template', 'L => { function tag(s, ...v) { return [s.raw.join(\'|\'), s === tag.last, (tag.last = s, v)] } var f = () => tag`a${1}\\n${2}`; var r1 = f(); var r2 = f(); return [r1[0], r2[1]] }', '=> ["a|\\u005cn|",true]');
c('binary op order', 'L => { return ({ valueOf() { L(\'l\'); return 1 } }) + ({ valueOf() { L(\'r\'); return 2 } }) }', 'l | r | => 3');
c('compare order >', 'L => { return ({ valueOf() { L(\'l\'); return 1 } }) > ({ valueOf() { L(\'r\'); return 2 } }) }', 'l | r | => false');
c('compare order <=', 'L => { return ({ valueOf() { L(\'l\'); return 1 } }) <= ({ valueOf() { L(\'r\'); return 2 } }) }', 'l | r | => true');
c('toPrimitive order', 'L => { var o = { [Symbol.toPrimitive](h) { L(\'hint \' + h); return 1 }, valueOf() { L(\'valueOf\') }, toString() { L(\'toString\') } }; return [`${o}`, o + \'\', +o, o == 1, o < 2, [o].join()] }', 'hint string | hint default | hint number | hint default | hint number | hint string | => ["1","1",1,true,true,"1"]');
c('call args before callee check', 'L => { var o = {}; try { o.nope(L(\'arg\')) } catch (e) { L(e.name) } }', 'arg | TypeError');
c('new args before ctor check', 'L => { try { new (void 0)(L(\'arg\')) } catch (e) { L(e.name) } }', 'arg | TypeError');
c('optional chain short', 'L => { var o = null; return [o?.a[L(\'skipped\')], o?.[L(\'skipped2\')], o?.f(L(\'skipped3\'))] }', '=> [undefined,undefined,undefined]');
c('exponent assoc & unary', 'L => { return [2 ** 3 ** 2, (-2) ** 2] }', '=> [512,4]');
c('comma/void/typeof', 'L => { return [typeof void 0, (1, 2), typeof typeof 1] }', '=> ["undefined",2,"string"]');
c('label break block', 'L => { a: { L(\'in\'); break a; L(\'no\') } L(\'out\') }', 'in | out');
c('label continue nested', 'L => { var r = []; o: for (var i = 0; i < 3; i++) { for (var j = 0; j < 3; j++) { if (j == 1) continue o; r.push(i + \'\' + j) } } return r }', '=> ["00","10","20"]');
c('switch fallthrough default middle', 'L => { function f(x) { var r = \'\'; switch (x) { case 1: r += \'a\'; default: r += \'d\'; case 2: r += \'b\'; break; case 3: r += \'c\' } return r } return [f(1), f(2), f(3), f(9)] }', '=> ["adb","b","c","db"]');
c('switch case eval order', 'L => { switch (L(\'disc\'), 2) { case (L(\'c1\'), 1): break; case (L(\'c2\'), 2): L(\'hit\'); case (L(\'c3\'), 3): L(\'fall\') } }', 'disc | c1 | c2 | hit | fall');
c('switch lexical', 'L => { switch (1) { case 0: let x = 1; break; case 1: try { x } catch (e) { return e.name } } }', '=> "ReferenceError"');
c('try finally return override', 'L => { function f() { try { return 1 } finally { return 2 } } function g() { try { throw 1 } finally { return 3 } } function h() { for (;;) { try { return 1 } finally { break } } return 4 } function k() { l: try { return 1 } finally { break l } return 5 } return [f(), g(), h(), k()] }', '=> [2,3,4,5]');
c('finally order', 'L => { function f() { try { L(\'try\'); return L(\'ret\') } finally { L(\'finally\') } } f() }', 'try | ret | finally');
c('catch param shadow var', 'L => { var e = \'outer\'; try { throw \'in\' } catch (e) { var e = \'assigned\' } return e }', '=> "outer"');
c('catch destructure', 'L => { try { throw { a: 1, b: [2] } } catch ({ a, b: [c] }) { return [a, c] } }', '=> [1,2]');
c('fn name inference', 'L => { var a = function () {}; var b = () => {}; var c = class {}; var o = { d() {}, e: function () {}, [\'f\' + 1]: () => {}, get g() { return 1 } }; var { h = function () {} } = {}; var s = Symbol(\'sym\'); var o2 = { [s]() {} }; return [a.name, b.name, c.name, o.d.name, o.e.name, o.f1.name, Object.getOwnPropertyDescriptor(o, \'g\').get.name, h.name, o2[s].name, (function () {}).name, (class { static name = \'x\' }).name, (() => {}).bind().name] }', '=> ["a","b","c","d","e","f1","get g","h","[sym]","","x","bound "]');
c('fn length', 'L => { return [(function (a, b = 1, c) {}).length, ((...a) => {}).length, (function (a, { b }, [c]) {}).length, (function () {}).bind(null, 1).length, ((a, b) => {}).bind(null, 1).length] }', '=> [1,0,3,0,1]');
c('arguments callee strict', 'L => { return (function () { \'use strict\'; try { return arguments.callee } catch (e) { return e.name } })() }', '=> "TypeError"');
c('arguments mapping', 'L => { function f(a, b) { arguments[0] = 9; b = 8; delete arguments[1]; arguments[1] = 7; a = 5; return [a, b, arguments[0], arguments[1], arguments.length] } return f(1, 2) }', '=> [5,8,5,7,2]');
c('arguments mapping extra', 'L => { function f(a) { a = 2; return [arguments.length, arguments[0], 0 in arguments] } return f() }', '=> [0,undefined,false]');
c('arguments define', 'L => { function f(a) { Object.defineProperty(arguments, 0, { writable: false }); a = 2; return [a, arguments[0]] } return f(1) }', '=> [2,1]');
c('arguments iterable', 'L => { function f() { return [...arguments, Object.prototype.toString.call(arguments), typeof arguments[Symbol.iterator]] } return f(1, 2) }', '=> [1,2,"[object Arguments]","function"]');
c('this sloppy primitive', 'L => { function f() { return typeof this } function g() { \'use strict\'; return typeof this } return [f.call(1), g.call(1), f.call(null) === \'object\', g.call(null)] }', '=> ["object","number",true,"object"]');
c('getter on primitive receiver', 'L => { Object.defineProperty(Number.prototype, \'zz\', { get() { \'use strict\'; return typeof this }, configurable: true }); try { return (5).zz } finally { delete Number.prototype.zz } }', '=> "number"');
c('set on primitive', 'L => { \'use strict\'; try { (5).x = 1 } catch (e) { return e.name } return \'no throw\' }', '=> "TypeError"');
c('set on primitive sloppy', 'L => { (5).x = 1; return \'no throw\' }', '=> "no throw"');
c('assign to const', 'L => { const c = 1; try { c = (L(\'rhs evaluated\'), 2) } catch (e) { return e.name } }', 'rhs evaluated | => "TypeError"');
c('assign to undeclared strict', 'L => { \'use strict\'; try { undeclared_zz = (L(\'rhs\'), 1) } catch (e) { return e.name } }', 'rhs | => "ReferenceError"');
c('assign undeclared sloppy, resolved before rhs', 'L => { try { undeclared_q1 = (L(\'rhs\'), globalThis.undeclared_q1 = 5, 1); return undeclared_q1 } finally { delete globalThis.undeclared_q1 } }', 'rhs | => 1');
c('typeof TDZ', 'L => { try { typeof tdz; let tdz } catch (e) { return e.name } }', '=> "ReferenceError"');
c('TDZ in closure before init', 'L => { var f = () => v; try { f() } catch (e) { L(e.name) } let v = 1; return f() }', 'ReferenceError | => 1');
c('let loop closures', 'L => { var fs = []; for (let i = 0; i < 3; i++) fs.push(() => i); var gs = []; for (var j = 0; j < 3; j++) gs.push(() => j); return [fs.map(f => f()), gs.map(f => f())] }', '=> [[0,1,2],[3,3,3]]');
c('let loop closure mutate', 'L => { var fs = []; for (let i = 0; i < 3; i++) { fs.push(() => i); i++ } return fs.map(f => f()) }', '=> [1,3]');
c('for-in/of let closures', 'L => { var fs = []; for (let k in { a: 1, b: 2 }) fs.push(() => k); for (const v of [1, 2]) fs.push(() => v); return fs.map(f => f()) }', '=> ["a","b",1,2]');
c('block fn hoist sloppy', 'L => { var r = [typeof bf]; { function bf() {} } r.push(typeof bf); return r }', '=> ["undefined","function"]');
c('block fn hoist conditional', 'L => { var r = [typeof cf]; if (false) { function cf() {} } r.push(typeof cf); return r }', '=> ["undefined","undefined"]');
c('fn decl in block overwritten', 'L => { { function q() { return 1 } q = 2; function q() { return 3 } } return typeof q }', '=> "number"');
c('var redeclare fn', 'L => { function v() {} var v; var w = typeof v; var v = 1; return [w, typeof v] }', '=> ["function","number"]');
c('named fn expr binding ro', 'L => { var f = function g() { g = 1; return typeof g }; var h = function g2() { \'use strict\'; try { g2 = 1 } catch (e) { return e.name } }; return [f(), h()] }', '=> ["function","TypeError"]');
c('class name binding inner const', 'L => { class C { static m() { try { C = 1 } catch (e) { return e.name } } } var r = C.m(); C = 5; return [r, C] }', '=> ["TypeError",5]');
c('generator return/throw states', 'L => { function* g() { try { yield 1; yield 2 } finally { L(\'fin\') } } var i = g(); return [i.return(7), i.next(), (() => { var j = g(); j.next(); return j.return(8) })(), (() => { var j = g(); try { j.throw(new Error(\'x\')) } catch (e) { return [e.message, j.next()] } })()] }', 'fin | => [{value:7,done:true},{value:undefined,done:true},{value:8,done:true},["x",{value:undefined,done:true}]]');
c('generator running reentry', 'L => { var i; function* g() { try { i.next() } catch (e) { yield e.name } } i = g(); return i.next() }', '=> {value:"TypeError",done:false}');
c('getter this in proto chain', 'L => { var p = { get x() { return this.v } }; var o = Object.create(p); o.v = 5; return [o.x, Reflect.get(p, \'x\', { v: 9 })] }', '=> [5,9]');
c('setter in proto chain blocks define', 'L => { \'use strict\'; var p = {}; Object.defineProperty(p, \'ro\', { value: 1, writable: false }); var o = Object.create(p); try { o.ro = 2 } catch (e) { return [e.name, Object.keys(o)] } }', '=> ["TypeError",[]]');
c('Reflect.set receiver define', 'L => { var t2 = {}; var r = px(L, \'r\'); Reflect.set(t2, \'a\', 1, r); return Object.keys(t2) }', 'r.gopd a | r.define a | => []');
c('Reflect.ownKeys order', 'L => { var o = { b: 1, 10: 1, a: 1, 2: 1, [Symbol.for(\'s\')]: 1, \'4294967295\': 1, \'4294967294\': 1, \'-0\': 1 }; return Reflect.ownKeys(o).map(String) }', '=> ["2","10","4294967294","b","a","4294967295","-0","Symbol(s)"]');

await drain();
finish();
