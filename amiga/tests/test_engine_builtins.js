/*
 * test_engine_builtins.js -- JSON with cycles, BigInt, toJSON and the
 * order of replacer and reviver calls; structuredClone; Error, cause,
 * AggregateError, captureStackTrace; Date construction and parsing at
 * the extremes; normalize, localeCompare and the toLocale functions.
 *
 * Companion of test_engine_conformance.js and of docs/NODEJS-DELTA.md,
 * "The engine itself".
 *
 * WRONG ANSWERS FOUND ON 0.238 AND FIXED IN THE BUILD AFTER IT.
 *   - structuredClone was JSON.parse(JSON.stringify(v)): a cycle threw
 *     TypeError, a shared object became two, Date became a string, Map,
 *     Set and typed arrays became {}, -0 became 0, NaN became null, a
 *     function was dropped silently, structuredClone(undefined) threw
 *     SyntaxError. It is now the structured clone algorithm (section 2;
 *     it needs quickjs.library, the Mac build of the engine has no
 *     structuredClone).
 *   - Error.captureStackTrace(Object.freeze({})) returned without a
 *     word; it throws TypeError now.
 *
 * WHAT THIS BUILD DOES NOT HAVE, stated by the cases marked "this
 * build": no Intl and no Temporal; localeCompare compares normalised
 * code units and ignores its locale and options; toLocaleUpperCase and
 * toLocaleLowerCase ignore the locale; Number, BigInt and Date
 * toLocaleString use one fixed format (no grouping, US date order with
 * leading zeros); JSON.rawJSON and the reviver's third argument are
 * absent; SuppressedError is absent; error.stack holds the frames only,
 * without the "Name: message" line V8 puts first.
 *
 * Every Date case is independent of the time zone of the machine.
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
 * Run:  qjs amiga/tests/test_engine_builtins.js
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

print('=== Engine conformance: JSON, structuredClone, errors, Date, strings ===');

section('1. JSON');
c('JSON cycle', 'L => { var a = {}; a.a = a; JSON.stringify(a) }', 'THROW TypeError');
c('JSON cycle array', 'L => { var a = []; a[0] = { b: a }; JSON.stringify(a) }', 'THROW TypeError');
c('JSON cycle via toJSON ok', 'L => { var a = { toJSON() { return 1 } }; a.self = a; return JSON.stringify({ a }) }', '=> "{"a":1}"');
c('JSON repeated non-cycle', 'L => { var s = { x: 1 }; return JSON.stringify([s, s, { s }]) }', '=> "[{"x":1},{"x":1},{"s":{"x":1}}]"');
c('JSON bigint', 'L => JSON.stringify({ a: 1n })', 'THROW TypeError');
c('JSON bigint toJSON', 'L => { BigInt.prototype.toJSON = function () { return this.toString() + \'n\' }; try { return JSON.stringify({ a: 1n, b: [2n] }) } finally { delete BigInt.prototype.toJSON } }', '=> "{"a":"1n","b":["2n"]}"');
c('JSON bigint replacer', 'L => JSON.stringify({ a: 1n }, (k, v) => typeof v == \'bigint\' ? Number(v) : v)', '=> "{"a":1}"');
c('JSON boxed', 'L => JSON.stringify([new Number(1), new String(\'s\'), new Boolean(false), Object(1n) && 0, Object(Symbol())])', '=> "[1,"s",false,0,{}]"');
c('JSON undefined/fn/symbol', 'L => [JSON.stringify(undefined), JSON.stringify(() => {}), JSON.stringify(Symbol()), JSON.stringify({ a: undefined, b() {}, c: Symbol() }), JSON.stringify([undefined, () => {}, Symbol()])]', '=> [undefined,undefined,undefined,"{}","[null,null,null]"]');
c('JSON numbers', 'L => JSON.stringify([NaN, Infinity, -Infinity, -0, 1e21, 1e-7, 0.1 + 0.2, 123456789012345680000, 5e-324])', '=> "[null,null,null,0,1e+21,1e-7,0.30000000000000004,123456789012345680000,5e-324]"');
c('JSON strings', 'L => JSON.stringify([\'\u2028\u2029\', \'\\ud800\', \'\\udc00\\ud800\', \'\ud83d\ude00\', \'\\x00\\x1f\\x7f\', \'"\\\\/\\b\\f\\n\\r\\t\'])', '=> "["\\u2028\\u2029","\\u005cud800","\\u005cudc00\\u005cud800","\\ud83d\\ude00","\\u005cu0000\\u005cu001f\\u007f","\\u005c"\\u005c\\u005c/\\u005cb\\u005cf\\u005cn\\u005cr\\u005ct"]"');
c('JSON toJSON order', 'L => { var o = { toJSON(k) { L(\'toJSON \' + JSON.stringify(k)); return { get x() { L(\'get x\'); return 1 }, y: { toJSON(k2) { L(\'toJSON \' + k2); return 2 } } } } }; return JSON.stringify({ a: o }, function (k, v) { L(\'replacer \' + JSON.stringify(k) + \' this=\' + (Array.isArray(this) ? \'arr\' : typeof this)); return v }) }', 'replacer "" this=object | toJSON "a" | replacer "a" this=object | get x | replacer "x" this=object | toJSON y | replacer "y" this=object | => "{"a":{"x":1,"y":2}}"');
c('JSON replacer array', 'L => JSON.stringify({ b: 1, a: 2, 1: 3, c: { a: 4, d: 5 } }, [\'a\', 1, \'c\', \'a\', new String(\'b\'), {}, 2n > 1n])', '=> "{"a":2,"1":3,"c":{"a":4},"b":1}"');
c('JSON replacer array numbers dedupe', 'L => JSON.stringify({ 1: 1, \'1\': 2, 2: 3 }, [1, \'1\', 2, new Number(2)])', '=> "{"1":2,"2":3}"');
c('JSON indent', 'L => [JSON.stringify({ a: [1, { b: 2 }], c: {} , d: [] }, null, 2), JSON.stringify([1], null, 20).length, JSON.stringify([1], null, \'abcdefghijklmnop\'), JSON.stringify([1], null, new Number(1)), JSON.stringify({ a: 1 }, null, \'\')]', '=> ["{\\u000a  "a": [\\u000a    1,\\u000a    {\\u000a      "b": 2\\u000a    }\\u000a  ],\\u000a  "c": {},\\u000a  "d": []\\u000a}",15,"[\\u000aabcdefghij1\\u000a]","[\\u000a 1\\u000a]","{"a":1}"]');
c('JSON Date', 'L => [JSON.stringify(new Date(0)), JSON.stringify(new Date(NaN)), JSON.stringify({ d: new Date(8.64e15) })]', '=> [""1970-01-01T00:00:00.000Z"","null","{"d":"+275760-09-13T00:00:00.000Z"}"]');
c('JSON Map/Set/typed', 'L => JSON.stringify([new Map([[1, 2]]), new Set([1]), new Uint8Array([1, 2]), new ArrayBuffer(2), /re/g, new Error(\'e\')])', '=> "[{},{},{"0":1,"1":2},{},{},{}]"');
c('JSON proxy array', 'L => JSON.stringify(new Proxy([1, 2], {}))', '=> "[1,2]"');
c('JSON revoked proxy', 'L => { var r = Proxy.revocable([], {}); r.revoke(); return JSON.stringify(r.proxy) }', 'THROW TypeError');
c('JSON key order', 'L => JSON.stringify({ b: 1, 2: 1, a: 1, 1: 1 })', '=> "{"1":1,"2":1,"b":1,"a":1}"');
c('JSON getter throws', 'L => JSON.stringify({ get a() { throw new RangeError(\'x\') } })', 'THROW RangeError');
c('JSON deep', 'L => { var o = {}, c = o; for (var i = 0; i < 300; i++) c = c.a = {}; return JSON.stringify(o).length }', '=> 1802');
c('JSON.parse reviver order', 'L => { JSON.parse(\'{"a":[1,{"b":2}],"c":3}\', function (k, v) { L(JSON.stringify(k) + \':\' + JSON.stringify(v)); return v }) }', '"0":1 | "b":2 | "1":{"b":2} | "a":[1,{"b":2}] | "c":3 | "":{"a":[1,{"b":2}],"c":3}');
c('JSON.parse reviver delete/replace', 'L => JSON.parse(\'{"a":1,"b":2,"c":[1,2,3]}\', function (k, v) { if (k == \'a\') return undefined; if (k == \'1\') return undefined; if (k == \'b\') return v * 2; return v })', '=> {b:4,c:[1,<hole>,3]}');
c('JSON.parse reviver mutates', 'L => JSON.parse(\'{"a":1,"b":2}\', function (k, v) { if (k == \'a\') { this.b = \'changed\'; delete this.zz } return v })', '=> {a:1,b:"changed"}');
c('JSON.parse reviver context arg', 'L => { var r = []; JSON.parse(\'[1.0, "s", {"a": 1e2}]\', function (k, v, ctx) { r.push(ctx && ctx.source); return v }); return r }', '=> [undefined,undefined,undefined,undefined,undefined]');
c('JSON.parse __proto__', 'L => { var o = JSON.parse(\'{"__proto__": {"x": 1}, "a": 1}\'); return [Object.keys(o), o.x, Object.getPrototypeOf(o) === Object.prototype] }', '=> [["__proto__","a"],undefined,true]');
c('JSON.parse dup keys', 'L => JSON.parse(\'{"a":1,"a":2}\')', '=> {a:2}');
c('JSON.parse numbers', 'L => [JSON.parse(\'-0\'), 1 / JSON.parse(\'-0\'), JSON.parse(\'1E2\'), JSON.parse(\'1e-2\'), JSON.parse(\'123456789012345678901234567890\'), JSON.parse(\'0.1e1\')]', '=> [-0,-Infinity,100,0.01,1.2345678901234568e+29,1]');
c('JSON.parse errors', 'L => [\'01\', \'1.\', \'.1\', \'+1\', \'0x1\', "\'a\'", \'{a:1}\', \'[1,]\', \'{"a":1,}\', \'"\\t"\', \'"\\\\x41"\', \'NaN\', \'undefined\', \'\', \' \', \'1 2\', \'{"a"}\', \'[\', \'"\\ud800"\', \'tru\', \'\u00a01\', \'1\u2028\'].map(s => { try { JSON.parse(s); return \'ok\' } catch (e) { return e.name[0] } }).join(\'\')', '=> "SSSSSSSSSSSSSSSSSSokSSS"');
c('JSON.parse whitespace', 'L => JSON.parse(\' \\t\\n\\r[ 1 , 2 ] \\n\')', '=> [1,2]');
c('JSON.parse big nesting', 'L => { var s = \'[\'.repeat(500) + \']\'.repeat(500); return JSON.stringify(JSON.parse(s)).length }', '=> 1000');
c('JSON.parse non-string', 'L => [JSON.parse(1), JSON.parse(null), JSON.parse(true), JSON.parse({ toString() { return \'[2]\' } })]', '=> [1,null,true,[2]]');
c('JSON.rawJSON', 'L => typeof JSON.rawJSON == \'function\' ? [JSON.stringify({ a: JSON.rawJSON(\'1e1000\') }), JSON.isRawJSON(JSON.rawJSON(\'1\'))] : \'absent\'', '=> "absent"');
c('JSON toStringTag', 'L => [Object.prototype.toString.call(JSON), JSON[Symbol.toStringTag]]', '=> ["[object JSON]","JSON"]');
c('JSON well-formed', 'L => [JSON.stringify(\'\\ud834\'), JSON.stringify(\'\\udf06\\ud834\'), JSON.stringify({ \'\\ud800\': 1 })]', '=> [""\\u005cud834"",""\\u005cudf06\\u005cud834"","{"\\u005cud800":1}"]');

section('2. structuredClone (quickjs.library only)');
/* Expected strings that are this build's and not Node.js's: 'sc proxy' (a Proxy
   is cloned as the object it shows; V8 throws DataCloneError), 'sc2 getter order'
   (getters of a nested object run after those of the object holding it), 'sc2
   very deep' (5000 levels are cloned; V8 runs out of stack). */
c('structuredClone exists', 'L => typeof structuredClone', '=> "function"');
c('sc basic', 'L => { var o = { a: [1, { b: 2 }], d: new Date(5), r: /x/gi, m: new Map([[1, { k: 1 }]]), s: new Set([1]), n: null, u: undefined, big: 5n }; var c = structuredClone(o); return [c !== o, c.a[1].b, c.d instanceof Date, c.d.getTime(), String(c.r), c.r.lastIndex, c.m.get(1).k, c.s.has(1), \'u\' in c, typeof c.big] }', '=> [true,2,true,5,"/x/gi",0,1,true,true,"bigint"]');
c('sc cycle', 'L => { var o = { name: \'o\' }; o.self = o; o.arr = [o]; var c = structuredClone(o); return [c.self === c, c.arr[0] === c, c !== o] }', '=> [true,true,true]');
c('sc shared ref', 'L => { var s = { x: 1 }; var c = structuredClone({ a: s, b: s }); return c.a === c.b }', '=> true');
c('sc function throws', 'L => { try { structuredClone({ f() {} }) } catch (e) { return [e.name, e.constructor === DOMException, e.code] } }', '=> ["DataCloneError",true,25]');
c('sc symbol throws', 'L => { try { structuredClone(Symbol()) } catch (e) { return e.name } }', '=> "DataCloneError"');
c('sc symbol key ignored', 'L => Object.getOwnPropertySymbols(structuredClone({ [Symbol(\'s\')]: 1, a: 1 })).length', '=> 0');
c('sc getters', 'L => { var c = structuredClone({ get g() { L(\'getter called\'); return 3 } }); return Object.getOwnPropertyDescriptor(c, \'g\') }', 'getter called | => {value:3,writable:true,enumerable:true,configurable:true}');
c('sc proto dropped', 'L => { class K { constructor() { this.v = 1 } m() {} } var c = structuredClone(new K()); return [c instanceof K, Object.getPrototypeOf(c) === Object.prototype, c.v] }', '=> [false,true,1]');
c('sc non-enumerable dropped', 'L => { var o = {}; Object.defineProperty(o, \'h\', { value: 1 }); return Object.getOwnPropertyNames(structuredClone(o)) }', '=> []');
c('sc typed/buffer', 'L => { var b = new Uint8Array([1, 2, 3]); var c = structuredClone({ b, sub: b.subarray(1), buf: b.buffer }); return [c.b instanceof Uint8Array, Array.from(c.b), Array.from(c.sub), c.b.buffer === c.sub.buffer, c.buf === c.b.buffer, c.buf.byteLength, c.b.buffer !== b.buffer] }', '=> [true,[1,2,3],[2,3],true,true,3,true]');
c('sc transfer', 'L => { var b = new ArrayBuffer(8); var c = structuredClone(b, { transfer: [b] }); return [b.byteLength, c.byteLength, b.detached] }', '=> [0,8,true]');
c('sc errors', 'L => { var e = new RangeError(\'m\', { cause: 5 }); e.extra = 1; var c = structuredClone(e); return [c instanceof RangeError, c.message, c.name, c.cause, c.extra, typeof c.stack] }', '=> [true,"m","RangeError",5,undefined,"string"]');
c('sc boxed', 'L => { var c = structuredClone([new Number(1), new String(\'s\'), new Boolean(false), Object(2n)]); return c.map(x => Object.prototype.toString.call(x) + \':\' + String(x)) }', '=> ["[object Number]:1","[object String]:s","[object Boolean]:false","[object BigInt]:2"]');
c('sc holes/sparse', 'L => { var a = [1, , 3]; a.x = \'p\'; var c = structuredClone(a); return [c.length, 1 in c, c.x] }', '=> [3,false,"p"]');
c('sc -0/NaN', 'L => { var c = structuredClone([-0, NaN]); return [Object.is(c[0], -0), Number.isNaN(c[1])] }', '=> [true,true]');
c('sc WeakMap throws', 'L => { try { structuredClone(new WeakMap()) } catch (e) { return e.name } }', '=> "DataCloneError"');
c('sc proxy', 'L => { try { return structuredClone(new Proxy({ a: 1 }, {})) } catch (e) { return e.name } }', '=> {a:1}');
c('sc key order', 'L => Object.keys(structuredClone({ b: 1, a: 2, 1: 3 }))', '=> ["1","b","a"]');
c('sc Map order + cycle', 'L => { var m = new Map(); m.set(\'self\', m); m.set(\'z\', 1); m.set(\'a\', 2); var c = structuredClone(m); return [c.get(\'self\') === c, [...c.keys()]] }', '=> [true,["self","z","a"]]');
c('sc deep', 'L => { var o = {}, c = o; for (var i = 0; i < 200; i++) c = c.a = {}; var d = structuredClone(o); var n = 0; while (d.a) { d = d.a; n++ } return n }', '=> 200');
c('sc primitives', 'L => [structuredClone(1), structuredClone(\'s\'), structuredClone(null), structuredClone(undefined) === undefined, structuredClone(true)]', '=> [1,"s",null,true,true]');
c('sc no args', 'L => { try { structuredClone() } catch (e) { return e.name } }', '=> "TypeError"');
c('sc2 getter order + result', 'L => { var c = structuredClone({ get a() { L(\'a\'); return { get b() { L(\'b\'); return 1 } } }, get c() { L(\'c\'); return 2 } }); return c }', 'a | c | b | => {a:{b:1},c:2}');
c('sc2 __proto__ key', 'L => { var o = JSON.parse(\'{"__proto__": {"x": 1}}\'); var c = structuredClone(o); return [Object.keys(c), Object.getPrototypeOf(c) === Object.prototype, c.x] }', '=> [["__proto__"],true,undefined]');
c('sc2 array extra + nested cycle', 'L => { var a = [1]; a.self = a; a.push(a); var c = structuredClone(a); return [c[1] === c, c.self === c, c.length] }', '=> [true,true,2]');
c('sc2 set/map nested', 'L => { var s = new Set([[1], new Map([[{ k: 1 }, new Set([2])]])]); var c = structuredClone(s); var it = [...c]; return [it[0], [...it[1].keys()][0], [...[...it[1].values()][0]]] }', '=> [[1],{k:1},[2]]');
c('sc2 typed kinds', 'L => [new Int8Array([-1]), new Uint8ClampedArray([255]), new Int16Array([1]), new Uint16Array([1]), new Int32Array([1]), new Uint32Array([1]), new Float32Array([1.5]), new Float64Array([-0]), new BigInt64Array([1n]), new BigUint64Array([2n])].map(a => { var c = structuredClone(a); return c.constructor.name + \':\' + c.length + \':\' + String(c[0]) + \':\' + (c.buffer !== a.buffer) })', '=> ["Int8Array:1:-1:true","Uint8ClampedArray:1:255:true","Int16Array:1:1:true","Uint16Array:1:1:true","Int32Array:1:1:true","Uint32Array:1:1:true","Float32Array:1:1.5:true","Float64Array:1:0:true","BigInt64Array:1:1:true","BigUint64Array:1:2:true"]');
c('sc2 typed offset', 'L => { var b = new ArrayBuffer(16); var a = new Uint16Array(b, 4, 3); a[0] = 7; var c = structuredClone(a); return [c.byteOffset, c.length, c.buffer.byteLength, c[0]] }', '=> [4,3,16,7]');
c('sc2 dataview', 'L => { var d = new DataView(new ArrayBuffer(8), 2, 4); d.setUint8(0, 9); var c = structuredClone(d); return [c instanceof DataView, c.byteOffset, c.byteLength, c.getUint8(0)] }', '=> [true,2,4,9]');
c('sc2 resizable', 'L => { var b = new ArrayBuffer(4, { maxByteLength: 8 }); var c = structuredClone(b); return [c.resizable, c.maxByteLength, c.byteLength] }', '=> [true,8,4]');
c('sc2 transfer errors', 'L => { var r = []; try { structuredClone(1, { transfer: [{}] }) } catch (e) { r.push(e.name) } var b = new ArrayBuffer(1); try { structuredClone(1, { transfer: [b, b] }) } catch (e) { r.push(e.name) } r.push(b.byteLength); var c = new ArrayBuffer(2); structuredClone(1, { transfer: [c] }); r.push(c.detached); return r }', '=> ["DataCloneError","DataCloneError",1,true]');
c('sc2 transfer keeps view', 'L => { var b = new ArrayBuffer(4); var a = new Uint8Array(b); a[1] = 5; var c = structuredClone({ a, b }, { transfer: [b] }); return [b.detached, a.length, c.a[1], c.a.buffer === c.b] }', '=> [true,0,5,true]');
c('sc2 detached', 'L => { var b = new ArrayBuffer(4); b.transfer(); try { structuredClone(b) } catch (e) { return e.name } }', '=> "DataCloneError"');
c('sc2 error kinds', 'L => [new TypeError(\'t\'), new EvalError(\'e\'), new URIError(\'u\'), new SyntaxError(\'s\'), new ReferenceError(\'r\'), new AggregateError([1], \'agg\'), (() => { class My extends Error { } var e = new My(\'m\'); e.name = \'Custom\'; return e })(), Object.assign(new Error(\'x\'), { name: \'RangeError\' })].map(e => { var c = structuredClone(e); return c.name + \'/\' + c.message + \'/\' + Object.getPrototypeOf(c).constructor.name + \'/\' + (\'errors\' in c) })', '=> ["TypeError/t/TypeError/false","EvalError/e/EvalError/false","URIError/u/URIError/false","SyntaxError/s/SyntaxError/false","ReferenceError/r/ReferenceError/false","Error/agg/Error/false","Error/m/Error/false","RangeError/x/RangeError/false"]');
c('sc2 error no message, cause cycle', 'L => { var e = new Error(); e.cause = e; var c = structuredClone(e); return [c.hasOwnProperty(\'message\'), c.cause === c, Object.keys(c)] }', '=> [false,true,[]]');
c('sc2 uncloneable', 'L => [new WeakSet(), new WeakRef({}), Promise.resolve(), new FinalizationRegistry(() => { }), (function* () { })(), Symbol.iterator, class { }, Math.max].map(v => { try { structuredClone({ v }); return \'ok\' } catch (e) { return e.name } })', '=> ["DataCloneError","DataCloneError","DataCloneError","DataCloneError","DataCloneError","DataCloneError","DataCloneError","DataCloneError"]');
c('sc2 clones of builtins namespaces', 'L => [typeof structuredClone(Math), typeof structuredClone(JSON), Object.keys(structuredClone(globalThis.Reflect)).length]', '=> ["object","object",0]');
c('sc2 date invalid / regexp flags', 'L => { var c = structuredClone([new Date(NaN), /a/dgimsuy, Object.assign(/x/g, { lastIndex: 3 })]); return [String(c[0].getTime()), c[1].flags, c[2].lastIndex] }', '=> ["NaN","dgimsuy",0]');
c('sc2 string object props', 'L => { var s = new String(\'ab\'); s.x = 1; var c = structuredClone(s); return [c.length, c.x, typeof c] }', '=> [2,undefined,"object"]');
c('sc2 sparse big', 'L => { var a = []; a[1000] = 1; var c = structuredClone(a); return [c.length, Object.keys(c)] }', '=> [1001,["1000"]]');
c('sc2 length/name', 'L => [structuredClone.length, structuredClone.name]', '=> [2,"structuredClone"]');
c('sc2 very deep', 'L => { var o = {}, c = o; for (var i = 0; i < 5000; i++) c = c.a = {}; var d = structuredClone(o); var n = 0; while (d.a) { d = d.a; n++ } return n }', '=> 5000');
c('sc2 undefined option', 'L => [structuredClone(1, undefined), structuredClone(1, null), structuredClone(1, {})]', '=> [1,1,1]');

section('3. Error, cause, AggregateError, captureStackTrace, DOMException');
c('error cause', 'L => { var e = new Error(\'m\', { cause: 0 }); var e2 = new Error(\'m\', {}); var e3 = new Error(\'m\', { cause: undefined }); return [e.cause, \'cause\' in e2, \'cause\' in e3, Object.getOwnPropertyDescriptor(e, \'cause\').enumerable, Object.keys(e)] }', '=> [0,false,true,false,[]]');
c('error options getter', 'L => { new Error(\'m\', { get cause() { L(\'get cause\'); return 1 } }); new Error(\'m\', 5); new Error(\'m\', null) }', 'get cause');
c('error props', 'L => { var e = new TypeError(\'msg\'); return [Object.getOwnPropertyNames(e).sort(), e.toString(), Object.prototype.toString.call(e), e.name, Object.getOwnPropertyDescriptor(e, \'message\').enumerable, TypeError.prototype.name, Object.getPrototypeOf(TypeError) === Error, TypeError.length, Error.length] }', '=> [["message","stack"],"TypeError: msg","[object Error]","TypeError",false,"TypeError",true,1,1]');
c('error no message', 'L => { var e = new Error(); var e2 = new Error(undefined); var e3 = new Error(\'\'); return [\'message\' in e && e.hasOwnProperty(\'message\'), e2.hasOwnProperty(\'message\'), e3.hasOwnProperty(\'message\'), String(e)] }', '=> [false,false,true,"Error"]');
c('error message coercion', 'L => [new Error(5).message, new Error(null).message, new Error({ toString() { return \'ts\' } }).message, new Error(Symbol.iterator.description).message]', '=> ["5","null","ts","Symbol.iterator"]');
c('error toString', 'L => [Error.prototype.toString.call({ name: \'N\', message: \'M\' }), Error.prototype.toString.call({}), Error.prototype.toString.call({ name: \'\', message: \'M\' }), Error.prototype.toString.call({ name: \'N\', message: \'\' }), Error.prototype.toString.call({ name: undefined, message: undefined })]', '=> ["N: M","Error","M","N","Error"]');
c('error called without new', 'L => { var e = Error(\'x\'); var t2 = TypeError(\'y\'); return [e instanceof Error, t2 instanceof TypeError, t2.message] }', '=> [true,true,"y"]');
c('AggregateError', 'L => { var e = new AggregateError([1, new Error(\'in\')], \'agg\', { cause: \'c\' }); return [e.message, e.errors.length, e.errors[1].message, e.cause, e.name, Object.getOwnPropertyDescriptor(e, \'errors\').enumerable, e instanceof Error, AggregateError.length, Object.getOwnPropertyNames(e).sort()] }', '=> ["agg",2,"in","c","AggregateError",false,true,2,["cause","errors","message","stack"]]');
c('AggregateError iterable', 'L => { var e = new AggregateError(new Set([1, 2])); return [e.errors, e.message, e.hasOwnProperty(\'message\')] }', '=> [[1,2],"",false]');
c('AggregateError non-iterable', 'L => { try { new AggregateError(5) } catch (e) { return e.name } }', '=> "TypeError"');
c('AggregateError order', 'L => { new AggregateError({ [Symbol.iterator]() { L(\'iter\'); return [][Symbol.iterator]() } }, { toString() { L(\'msg\'); return \'m\' } }, { get cause() { L(\'cause\'); return 1 } }) }', 'msg | cause | iter');
c('Promise.any aggregate', 'L => typeof AggregateError.prototype.errors', '=> "undefined"');
c('captureStackTrace', 'L => { if (typeof Error.captureStackTrace != \'function\') return \'absent\'; var o = {}; Error.captureStackTrace(o); function outer() { return inner() } function inner() { var q = {}; Error.captureStackTrace(q, outer); return q.stack } var s = outer(); return [typeof o.stack, Object.getOwnPropertyDescriptor(o, \'stack\') !== undefined, /inner|outer/.test(s), Error.captureStackTrace(o) === undefined] }', '=> ["string",true,false,true]');
c('captureStackTrace non-object', 'L => { try { Error.captureStackTrace(5) } catch (e) { return e.name } return \'no throw\' }', '=> "TypeError"');
c('captureStackTrace frozen', 'L => { try { Error.captureStackTrace(Object.freeze({})) } catch (e) { return e.name } return \'no throw\' }', '=> "TypeError"');
c('stackTraceLimit effect', 'L => { var old = Error.stackTraceLimit; try { Error.stackTraceLimit = 2; function r(n) { return n ? r(n - 1) : new Error(\'x\') } var e = r(10); var n = e.stack.split(\'\\n\').filter(l => /^\\s+at /.test(l)).length; Error.stackTraceLimit = 0; var e0 = r(3); var n0 = e0.stack.split(\'\\n\').filter(l => /^\\s+at /.test(l)).length; return [n, n0] } finally { Error.stackTraceLimit = old } }', '=> [2,0]');
c('stack assignable', 'L => { var e = new Error(\'x\'); e.stack = \'custom\'; return e.stack }', '=> "custom"');
c('prepareStackTrace', 'L => { if (!(\'prepareStackTrace\' in Error) && typeof Error.captureStackTrace != \'function\') return \'absent\'; var old = Error.prepareStackTrace; try { Error.prepareStackTrace = (e, frames) => { return \'P:\' + e.message + \':\' + Array.isArray(frames) + \':\' + typeof (frames[0] && frames[0].getFunctionName) + \':\' + (frames[0] && frames[0].getFunctionName()) + \':\' + typeof (frames[0] && frames[0].getLineNumber()) }; function named() { return new Error(\'m\').stack } return named() } finally { Error.prepareStackTrace = old } }', '=> "P:m:true:function:named:number"');
c('error isError', 'L => typeof Error.isError == \'function\' ? [Error.isError(new TypeError()), Error.isError({}), Error.isError(Object.create(Error.prototype))] : \'absent\'', '=> [true,false,false]');
c('DOMException', 'L => typeof DOMException == \'function\' ? (() => { var d = new DOMException(\'m\', \'AbortError\'); return [d.name, d.code, d.message, d instanceof Error, Object.prototype.toString.call(d), DOMException.ABORT_ERR, new DOMException(\'x\').name, new DOMException(\'x\', \'Nope\').code] })() : \'absent\'', '=> ["AbortError",20,"m",true,"[object DOMException]",20,"Error",0]');
c('SuppressedError', 'L => typeof SuppressedError == \'function\' ? (() => { var e = new SuppressedError(1, 2, \'m\'); return [e.error, e.suppressed, e.message, e.name] })() : \'absent\'', '=> "absent"');
c('throw in finally replaces', 'L => { try { try { throw new Error(\'a\') } finally { throw new Error(\'b\') } } catch (e) { return e.message } }', '=> "b"');
c('error in toString of thrown', 'L => { try { throw { toString() { throw new Error(\'inner\') } } } catch (e) { return typeof e } }', '=> "object"');
/* this build: the format of error.stack (frames only, four spaces, 'at name (file:line:column)') */
c('this build: stack has no header line', 'L => { function namedFn() { return new Error(\'boom\') } var e = namedFn(); var lines = e.stack.split(\'\\n\'); return [/^    at namedFn \\(.*:\\d+:\\d+\\)$/.test(lines[0]), lines.some(l => /boom/.test(l)), Object.getOwnPropertyDescriptor(e, \'stack\') !== undefined] }', '=> [true,false,true]');
c('this build: frame names', 'L => { class K { constructor() { this.s = new Error(\'c\').stack } m() { return new Error(\'m\').stack } static sm() { return new Error(\'s\').stack } get g() { return new Error(\'g\').stack } } var k = new K(); var arrow = () => new Error(\'a\').stack; return [k.s, k.m(), K.sm(), k.g, arrow(), (function () { return new Error(\'b\').stack })()].map(s => s.split(\'\\n\')[0].trim().replace(/ \\(.*\\)/, \'\')) }', '=> ["at K","at m","at sm","at get g","at arrow","at <anonymous>"]');
c('this build: Error.stackTraceLimit is an accessor', 'L => { var d = Object.getOwnPropertyDescriptor(Error, \'stackTraceLimit\'); return [typeof Error.stackTraceLimit, \'get\' in d, d.enumerable, d.configurable] }', '=> ["number",true,false,true]');
c('error subclass', 'L => { class MyErr extends Error { constructor(m) { super(m); this.name = \'MyErr\' } } var e = new MyErr(\'x\'); return [e instanceof MyErr, e instanceof Error, String(e), Object.prototype.toString.call(e)] }', '=> [true,true,"MyErr: x","[object Error]"]');

section('4. Date');
c('Date extremes', 'L => [new Date(8.64e15).toISOString(), new Date(-8.64e15).toISOString(), new Date(8.64e15 + 1).getTime(), new Date(-8.64e15 - 1).getTime(), Date.UTC(275760, 8, 13), Date.UTC(275760, 8, 13, 0, 0, 0, 1), Date.UTC(-271821, 3, 20), Date.UTC(-271821, 3, 19, 23, 59, 59, 999)]', '=> ["+275760-09-13T00:00:00.000Z","-271821-04-20T00:00:00.000Z",NaN,NaN,8640000000000000,NaN,-8640000000000000,NaN]');
c('Date years', 'L => [new Date(Date.UTC(0, 0, 1)).toISOString(), new Date(Date.UTC(99, 0, 1)).toISOString(), new Date(Date.UTC(100, 0, 1)).toISOString(), (() => { var d = new Date(0); d.setUTCFullYear(0); return d.toISOString() })(), (() => { var d = new Date(0); d.setUTCFullYear(-1); return d.toISOString() })(), (() => { var d = new Date(0); d.setUTCFullYear(10000); return d.toISOString() })(), new Date(Date.UTC(1900, 1, 29)).toISOString(), new Date(Date.UTC(2000, 1, 29)).toISOString(), new Date(Date.UTC(2100, 1, 29)).toISOString()]', '=> ["1900-01-01T00:00:00.000Z","1999-01-01T00:00:00.000Z","0100-01-01T00:00:00.000Z","0000-01-01T00:00:00.000Z","-000001-01-01T00:00:00.000Z","+010000-01-01T00:00:00.000Z","1900-03-01T00:00:00.000Z","2000-02-29T00:00:00.000Z","2100-03-01T00:00:00.000Z"]');
c('Date.UTC args', 'L => [Date.UTC(), Date.UTC(2020), Date.UTC(2020, 12), Date.UTC(2020, -1), Date.UTC(2020, 0, 0), Date.UTC(2020, 0, 1, 24), Date.UTC(2020, 0, 1, 0, 60), Date.UTC(2020, 0, 1, 0, 0, 0, 1000), Date.UTC(NaN), Date.UTC(2020, 0.9, 1.9), Date.UTC(1e9), Date.UTC(99.9)]', '=> [NaN,1577836800000,1609459200000,1575158400000,1577750400000,1577923200000,1577840400000,1577836801000,NaN,1577836800000,NaN,915148800000]');
c('Date.parse ISO', 'L => [\'2020-01-01\', \'2020-01\', \'2020\', \'2020-01-01T00:00Z\', \'2020-01-01T00:00:00.123Z\', \'2020-01-01T00:00:00.1Z\', \'2020-01-01T00:00:00.123456Z\', \'2020-01-01T24:00:00Z\', \'2020-01-01T24:00:01Z\', \'2020-02-30\', \'2020-13-01\', \'+002020-01-01T00:00:00Z\', \'-000001-01-01T00:00:00Z\', \'-000000-01-01T00:00:00Z\', \'+275760-09-13T00:00:00.000Z\', \'+275760-09-13T00:00:00.001Z\', \'2020-01-01T00:00:00+01:00\', \'2020-01-01T00:00:00-0100\', \'2020-01-01T00:00:00+0100\', \'2020-01-01T00:00+24:00\', \'20200101\', \'2020-01-01T00:00:60Z\', \'2020-01-01T00:60Z\', \'2020-01-01 00:00:00Z\', \'2020-01-01T00Z\', \'2020-01-01Z\'].map(s => Date.parse(s))', '=> [1577836800000,1577836800000,1577836800000,1577836800000,1577836800123,1577836800100,1577836800123,1577923200000,NaN,1583020800000,NaN,1577836800000,-62198755200000,NaN,8640000000000000,NaN,1577833200000,1577840400000,1577833200000,NaN,NaN,NaN,NaN,1577836800000,NaN,1577836800000]');
c('Date.parse legacy UTC forms', 'L => [\'Thu, 01 Jan 1970 00:00:00 GMT\', \'Thu, 01 Jan 1970 00:00:00 UTC\', \'Thu Jan 01 1970 00:00:00 GMT+0000\', \'Thu Jan 01 1970 00:00:00 GMT+0100\', \'Thu Jan 01 1970 00:00:00 GMT-0130 (Somewhere)\', \'Jan 1 1970 00:00:00 GMT\', \'1 Jan 1970 00:00:00 GMT\', \'January 1, 1970 00:00:00 UTC\', \'1/1/1970 00:00:00 GMT\', \'1970/01/01 00:00:00 GMT\', \'Thu, 01 Jan 1970 00:00:00 +0000\', \'Thu, 01 Jan 1970 12:00:00 AM GMT\', \'Thu, 01 Jan 1970 12:00:00 PM GMT\', \'Sat, 31 Dec 275760 00:00:00 GMT\', \'Fri, 01 Jan 99 00:00:00 GMT\', \'Mon, 01 Jan 49 00:00:00 GMT\', \'Sun, 01 Jan 50 00:00:00 GMT\', \'Thu, 01 Jan 1970 00:00:00 EST\', \'Thu, 01 Jan 1970 00:00:00 PDT\', \'Thu, 01 Jan 1970 00:00:00 Z\', \'garbage\', \'\', \'Thu, 01 Foo 1970 00:00:00 GMT\', \'1970\', \'12/31/1969 23:59:59 GMT\', \'Dec 31 1969 23:59:59.999 GMT\', \'Wed, 31 Dec 1969 24:00:00 GMT\'].map(s => Date.parse(s))', '=> [0,0,0,-3600000,5400000,0,0,0,0,0,0,0,43200000,NaN,915148800000,2493072000000,-631152000000,18000000,25200000,0,NaN,NaN,NaN,0,-1000,-1,0]');
c('Date round trip formats', 'L => { var d = new Date(Date.UTC(2021, 5, 7, 8, 9, 10, 11)); return [d.toISOString(), d.toUTCString(), d.toJSON(), Date.parse(d.toISOString()) === d.getTime(), Date.parse(d.toUTCString()) === Math.floor(d.getTime() / 1000) * 1000, Date.parse(d.toString()) === Math.floor(d.getTime() / 1000) * 1000, d.toGMTString === d.toUTCString] }', '=> ["2021-06-07T08:09:10.011Z","Mon, 07 Jun 2021 08:09:10 GMT","2021-06-07T08:09:10.011Z",true,true,true,true]');
c('Date UTC getters/setters', 'L => { var d = new Date(Date.UTC(2020, 1, 29, 23, 59, 59, 999)); var r = [d.getUTCDay(), d.getUTCDate(), d.getUTCMonth(), d.getUTCFullYear(), d.getUTCHours(), d.getUTCMilliseconds()]; d.setUTCMonth(1, 30); r.push(d.toISOString()); d.setUTCHours(25, 61, 61, 1001); r.push(d.toISOString()); d.setUTCDate(0); r.push(d.toISOString()); d.setUTCMilliseconds(-1); r.push(d.toISOString()); r.push(d.setUTCFullYear(NaN), d.getTime(), d.setUTCFullYear(2000), d.setTime(8.64e15 + 1)); return r }', '=> [6,29,1,2020,23,999,"2020-03-01T23:59:59.999Z","2020-03-02T02:02:02.001Z","2020-02-29T02:02:02.001Z","2020-02-29T02:02:01.999Z",NaN,NaN,946684800000,NaN]');
c('Date setter arg order/coercion', 'L => { var d = new Date(0); d.setUTCHours({ valueOf() { L(\'h\'); return 1 } }, { valueOf() { L(\'m\'); return 2 } }, { valueOf() { L(\'s\'); return 3 } }, { valueOf() { L(\'ms\'); return 4 } }); var n = new Date(NaN); n.setUTCHours({ valueOf() { L(\'nan-h\'); return 1 } }); return [d.getTime(), n.getTime()] }', 'h | m | s | ms | nan-h | => [3723004,NaN]');
c('Date ctor forms', 'L => [new Date(2020, 0).getFullYear(), new Date(0, 0).getFullYear(), new Date(99, 0).getFullYear(), new Date(100, 0).getFullYear(), new Date(-1, 0).getFullYear(), new Date(\'2020\').getTime(), new Date(new Date(5)).getTime(), new Date(true).getTime(), new Date(null).getTime(), new Date(undefined).getTime(), new Date(\'5\').getTime() === new Date(5).getTime(), new Date(1e81).getTime(), new Date(1.9).getTime(), new Date(-1.9).getTime(), new Date({ valueOf() { return 7 } }).getTime(), new Date({ toString() { return \'1970-01-01T00:00:00.008Z\' }, valueOf() { return {} } }).getTime(), typeof Date(), Date.length, new Date(2020, 0, 1, 0, 0, 0, 0.9).getMilliseconds()]', '=> [2020,1900,1999,100,-1,1577836800000,5,1,0,NaN,false,NaN,1,-1,7,8,"string",7,0]');
c('Date toPrimitive', 'L => { var d = new Date(0); return [typeof (d + 1), typeof (d - 1), d[Symbol.toPrimitive](\'number\'), typeof d[Symbol.toPrimitive](\'default\'), (() => { try { d[Symbol.toPrimitive](\'x\') } catch (e) { return e.name } })(), `${d}` === d.toString(), d == d.toString(), d < new Date(1)] }', '=> ["string","number",0,"string","TypeError",true,true,true]');
c('Date invalid', 'L => { var d = new Date(NaN); return [String(d), d.toJSON(), (() => { try { d.toISOString() } catch (e) { return e.name } })(), d.getDay(), d.toUTCString(), d.toDateString(), d.toLocaleString(), d.getTimezoneOffset(), JSON.stringify({ d })] }', '=> ["Invalid Date",null,"RangeError",NaN,"Invalid Date","Invalid Date","Invalid Date",NaN,"{"d":null}"]');
c('Date string shapes (local)', 'L => { var d = new Date(2021, 5, 7, 8, 9, 10); return [/^Mon Jun 07 2021 08:09:10 GMT[+-]\\d{4}( \\(.+\\))?$/.test(d.toString()), d.toDateString(), /^08:09:10 GMT[+-]\\d{4}( \\(.+\\))?$/.test(d.toTimeString()), d.getDay(), d.getHours(), new Date(d.getTime()).getTimezoneOffset() === d.getTimezoneOffset(), Number.isInteger(d.getTimezoneOffset())] }', '=> [true,"Mon Jun 07 2021",true,1,8,true,true]');
c('Date local round trip', 'L => { var r = []; for (var y of [1970, 1999, 2000, 2024, 2038, 2100, 1900, 1, 9999]) for (var m of [0, 2, 3, 5, 9, 10]) { var d = new Date(2000, m, 15, 12, 30); d.setFullYear(y); var back = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()); if (back.getTime() !== d.getTime() || d.getHours() !== 12 || d.getMonth() !== m || d.getFullYear() !== y) r.push(y + \'-\' + m) } return r }', '=> ["1-0","1-2","1-3","1-5","1-9","1-10"]');
c('Date local midnight walk', 'L => { var bad = 0; var d = new Date(2024, 0, 1); for (var i = 0; i < 366; i++) { var x = new Date(2024, 0, 1 + i); if (x.getHours() !== 0 && x.getHours() !== 1) bad++; if (x.getDate() !== new Date(2024, 0, 1 + i, 12).getDate()) bad++ } return bad }', '=> 0');
c('Date.now monotone-ish', 'L => { var a = Date.now(), b = Date.now(); return [typeof a, b >= a, a > 1.6e12, Number.isInteger(a)] }', '=> ["number",true,true,true]');
c('Date methods present', 'L => [\'getYear\', \'setYear\', \'toGMTString\', \'toLocaleDateString\', \'toLocaleTimeString\', \'toLocaleString\'].map(k => typeof Date.prototype[k])', '=> ["function","function","function","function","function","function"]');
c('Date getYear/setYear', 'L => { var d = new Date(Date.UTC(2005, 6, 1, 12)); var r = [d.getYear()]; d.setYear(99); r.push(d.getFullYear()); d.setYear(2010); r.push(d.getFullYear()); return r }', '=> [105,1999,2010]');

section('5. String: normalize, case mapping, the rest of String.prototype');
await drain();
helpers('function hex(s) { var o = []; for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i).toString(16)); return o.join(\' \') }');
c('normalize', 'L => [\'\u00e9\', \'e\u0301\', \'\u1e9b\u0323\', \'\ufb01\', \'\u212b\', \'\uac00\', \'\u1100\u1161\', \'A\u030a\', \'\u01c4\', \'\u2460\', \'a\u0323\u0302\', \'a\u0302\u0323\', \'\ud834\udd5e\'].map(s => [\'NFC\', \'NFD\', \'NFKC\', \'NFKD\'].map(f => hex(s.normalize(f))).join(\'/\'))', '=> ["e9/65 301/e9/65 301","e9/65 301/e9/65 301","1e9b 323/17f 323 307/1e69/73 323 307","fb01/fb01/66 69/66 69","c5/41 30a/c5/41 30a","ac00/1100 1161/ac00/1100 1161","ac00/1100 1161/ac00/1100 1161","c5/41 30a/c5/41 30a","1c4/1c4/44 17d/44 5a 30c","2460/2460/31/31","1ead/61 323 302/1ead/61 323 302","1ead/61 323 302/1ead/61 323 302","d834 dd57 d834 dd65/d834 dd57 d834 dd65/d834 dd57 d834 dd65/d834 dd57 d834 dd65"]');
c('normalize args', 'L => [\'a\'.normalize(), \'a\'.normalize(undefined), (() => { try { \'a\'.normalize(\'nfc\') } catch (e) { return e.name } })(), (() => { try { \'a\'.normalize(null) } catch (e) { return e.name } })(), hex(\'\\ud800\'.normalize(\'NFD\')), String.prototype.normalize.length, \'\'.normalize(\'NFKD\')]', '=> ["a","a","RangeError","RangeError","d800",0,""]');
c('String misc unicode', 'L => [\'\u00df\'.toUpperCase(), \'\ufb00\'.toUpperCase(), \'\u0130\'.toLowerCase().length, \'\u03a3\'.toLowerCase(), \'A\u03a3\'.toLowerCase(), \'\u01c5\'.toLowerCase(), \'\u01c5\'.toUpperCase(), \'\ud801\udc00\'.toLowerCase() === \'\ud801\udc28\', \'abc\'.isWellFormed(), \'\\ud800\'.isWellFormed(), hex(\'a\\ud800b\'.toWellFormed()), \'x\'.at(-1), [...\'\ud83d\ude00a\'].length, \'\ud83d\ude00\'.codePointAt(0), String.fromCodePoint(0x1f600).length, \'a\u0301\'.length, \'ab\'.localeCompare(\'a\u0301b\') !== 0]', '=> ["SS","FF",2,"\\u03c3","a\\u03c2","\\u01c6","\\u01c4",true,true,false,"61 fffd 62","x",2,128512,2,2,true]');
c('String.raw / padding / repeat edges', 'L => [String.raw`a\\n${1}b`, String.raw({ raw: [\'x\', \'y\'] }, 1, 2), \'a\'.padStart(5, \'xy\'), \'a\'.padEnd(5, \'\'), \'abc\'.padStart(2), (() => { try { \'a\'.repeat(-1) } catch (e) { return e.name } })(), (() => { try { \'a\'.repeat(Infinity) } catch (e) { return e.name } })(), \'a\'.repeat(0), \'ab\'.substr(-1), \'abc\'.substring(2, 0), \'abc\'.slice(2, 0), \'a-b-c\'.split(\'-\', 2), \'abc\'.split(\'\'), \'\'.split(\'\'), \'\'.split(\'x\'), \'ab\'.split(/(?:)/u), \'a1b2\'.split(/(\\d)/), \'x\'.replaceAll(\'\', \'-\'), \'aaa\'.replaceAll(\'a\', \'$&$&\'), \'abc\'.replace(\'b\', \'$`$\\\'\'), \'abc\'.replace(/(?<n>b)/, \'[$<n>]\'), \'abc\'.replace(\'b\', () => \'$1\'), \'aXbxc\'.split(/x/i), \'test\'.search(/s/), \'ABC\'.at(5), \'abc\'.indexOf(\'\', 10), \'abc\'.lastIndexOf(\'c\', -5), \'abc\'.includes(\'\', 99), \'abc\'.startsWith(\'\', 99), \'abc\'.endsWith(\'c\', 99), \' \\t\\n\u00a0\ufeff\u2028x\u3000 \'.trim(), \'\u180e\'.trim().length, \'a\'.concat(1, null, undefined, [2]), \'abc\'.codePointAt(5), \'ab\'.anchor ? \'ab\'.anchor(\'"x"\') : \'no anchor\']', '=> ["a\\u005cn1b","x1y","xyxya","a","abc","RangeError","RangeError","","b","ab","",["a","b"],["a","b","c"],[],[""],["a","b"],["a","1","b","2",""],"-x-","aaaaaa","aacc","a[b]c","a$1c",["a","b","c"],2,undefined,3,-1,true,true,true,"x",1,"a1nullundefined2",undefined,"<a name="&quot;x&quot;">ab</a>"]');

section('6. this build: no Intl, no Temporal, no locale data');
c('this build: Temporal / Intl present', 'L => [typeof Temporal, typeof Intl, typeof Intl === \'object\' ? Object.keys(Intl).length >= 0 : false]', '=> ["undefined","undefined",false]');
c('this build: localeCompare basic', 'L => [Math.sign(\'a\'.localeCompare(\'b\')), Math.sign(\'b\'.localeCompare(\'a\')), \'a\'.localeCompare(\'a\'), Math.sign(\'a\'.localeCompare(\'B\')), Math.sign(\'a\'.localeCompare(\'A\')), Math.sign(\'\u00e9\'.localeCompare(\'e\u0301\')), Math.sign(\'a\'.localeCompare(\'\u00e4\')), Math.sign(\'z\'.localeCompare(\'\u00e4\')), Math.sign(\'\'.localeCompare(\'a\')), Math.sign(\'10\'.localeCompare(\'9\')), Math.sign(\'a\'.localeCompare()), String.prototype.localeCompare.length]', '=> [-1,1,0,1,1,0,-1,-1,-1,-1,-1,1]');
c('this build: localeCompare sort', 'L => [\'b\', \'a\', \'B\', \'A\', \'\u00e9\', \'e\', \'f\', \'Z\', \'z\', \'1\', \'_\', \' \'].sort((x, y) => x.localeCompare(y)).map(hex).join(\',\')', '=> "20,31,41,42,5a,5f,61,62,65,66,7a,e9"');
c('this build: localeCompare options', 'L => { try { return [Math.sign(\'a\'.localeCompare(\'A\', undefined, { sensitivity: \'base\' })), Math.sign(\'10\'.localeCompare(\'9\', undefined, { numeric: true })), Math.sign(\'a\'.localeCompare(\'b\', \'de\'))] } catch (e) { return e.name } }', '=> [1,-1,-1]');
c('this build: toLocale case', 'L => [\'I\'.toLocaleLowerCase(), \'i\'.toLocaleUpperCase(), \'I\'.toLocaleLowerCase(\'tr\') === \'\u0131\', \'i\'.toLocaleUpperCase(\'tr\') === \'\u0130\', \'\u00df\'.toLocaleUpperCase(), \'\u03a3\u0391\u03a3\'.toLocaleLowerCase() === \'\u03c3\u03b1\u03c2\', \'I\u0307\'.toLocaleLowerCase(\'lt\').length, (() => { try { return \'a\'.toLocaleUpperCase(\'not a tag!!\') } catch (e) { return e.name } })()]', '=> ["i","I",false,false,"SS",true,2,"A"]');
c('this build: Number toLocaleString', 'L => [(1234567.891).toLocaleString(), (1234567.891).toLocaleString(\'en-US\'), (1234567.891).toLocaleString(\'de-DE\'), (0.5).toLocaleString(\'en-US\', { style: \'percent\' }), (1e21).toLocaleString(\'en-US\'), NaN.toLocaleString(), (-0).toLocaleString(), (12).toLocaleString(\'en-US\', { minimumFractionDigits: 2 }), 10n.toLocaleString(\'en-US\'), 1234567n.toLocaleString(\'en-US\')]', '=> ["1234567.891","1234567.891","1234567.891","0.5","1e+21","NaN","0","12","10","1234567"]');
c('this build: Array toLocaleString', 'L => [[1234.5, \'a\', null, undefined, new Date(NaN)].toLocaleString(), [].toLocaleString(), new Uint8Array([1, 2]).toLocaleString(), ({}).toLocaleString(), [[1, 2], [3]].toLocaleString()]', '=> ["1234.5,a,,,Invalid Date","","1,2","[object Object]","1,2,3"]');
c('this build: Date toLocale shapes', 'L => { var d = new Date(2021, 5, 7, 8, 9, 10); return [d.toLocaleDateString(\'en-US\'), d.toLocaleTimeString(\'en-US\'), d.toLocaleString(\'en-US\'), d.toLocaleDateString(\'en-US\', { weekday: \'long\', year: \'numeric\', month: \'long\', day: \'numeric\' }), d.toLocaleDateString(\'de-DE\'), d.toLocaleTimeString(\'en-GB\'), d.toLocaleDateString(undefined, { timeZone: \'UTC\' }).length > 0] }', '=> ["06/07/2021","08:09:10 AM","06/07/2021, 08:09:10 AM","06/07/2021","06/07/2021","08:09:10 AM",true]');

await drain();
finish();
