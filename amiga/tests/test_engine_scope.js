/*
 * test_engine_scope.js -- parameters with default values, functions
 * declared in blocks, eval, Function(), with, labels, global
 * declarations: does the engine bind names the way the language says?
 *
 * Companion of test_engine_conformance.js (see there for the general
 * idea) and of docs/NODEJS-DELTA.md, "The engine itself".
 *
 * WRONG ANSWERS FOUND ON 0.238 AND FIXED IN THE BUILD AFTER IT. All were
 * in the upstream engine and showed on any machine.
 *   - A parameter had two bindings as soon as the parameter list had a
 *     default value: closures in the defaults used one, the body the
 *     other. function f(a, g = () => a) { a = 2; return g(); } returned
 *     1; a default that assigned an earlier parameter was not seen by
 *     the body; a direct eval in the body assigned the wrong one.
 *     (Section 1: about 60 of its cases failed.)
 *   - eval("var arguments = 5") in a function did not change what the
 *     function saw as 'arguments'.
 *   - A function declared in a block was two different function
 *     objects, one for the block and one for the enclosing function:
 *     { function q() {} inner = q } left inner !== q. An assignment to
 *     the name inside the block was lost when a second declaration of
 *     the same name followed. 'if (c) function f() {} else function
 *     f() {}' always gave the second one. { function arguments() {} }
 *     did not assign 'arguments'.
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
 * Run:  qjs amiga/tests/test_engine_scope.js
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

print('=== Engine conformance: scopes and declarations ===');

section('1. Parameters with default values: one binding, shared with the closures of the defaults');
c('default: 1', '()=>{function f(a, g = () => a) { a = 2; return g(); } return f(1)}', '=> 2');
c('default: 2 var', '()=>{function f(a, g = () => a) { var a; a = 2; return [g(),a]; } return f(1)}', '=> [1,2]');
c('default: 2b var init', '()=>{function f(a, g = () => a) { var a = 5; return [g(),a]; } return f(1)}', '=> [1,5]');
c('default: 3 args', '()=>{function f(a, g = () => a) { arguments[0] = 9; return [g(),a]; } return f(1)}', '=> [1,1]');
c('default: 3b args', '()=>{function f(a, g = () => a) { a = 7; return [g(),a, arguments[0]]; } return f(1)}', '=> [7,7,1]');
c('default: 4 setter', '()=>{function f(a, g = (v) => {a = v}) { g(5); return a; } return f(1)}', '=> 5');
c('default: 5 tdz', '()=>{function f(a = b, b = 1) { return a } return f()}', 'THROW ReferenceError');
c('default: 6 earlier', '()=>{function f(a, b = a+1, c = () => a+b) { a = 10; b = 20; return c() } return f(1)}', '=> 30');
c('default: 7 destr', '()=>{function f({x}, g = () => x) { x = 2; return g(); } return f({x:1})}', '=> 2');
c('default: 7b destr dflt', '()=>{function f([x = 3] = [], g = () => x) { x++; return g(); } return f()}', '=> 4');
c('default: 8 arrow', '()=>{var f = (a, g = () => a) => { a = 2; return g(); }; return f(1)}', '=> 2');
c('default: 9 method', '()=>{var o = { f(a, g = () => a) { a = 2; return g(); } }; return o.f(1)}', '=> 2');
c('default: 10 gen', '()=>{function* f(a, g = () => a) { a = 2; yield g(); } return f(1).next().value}', '=> 2');
c('default: 11 body closure', '()=>{function f(a, g = () => a) { var h = () => a; a = 2; return [g(), h()]; } return f(1)}', '=> [2,2]');
c('default: 12 body func decl', '()=>{function f(a, g = () => a) { function a(){}; return [typeof g(), typeof a]; } return f(1)}', '=> ["number","function"]');
c('default: 13 eval', '()=>{function f(a, g = () => a) { eval(\'a = 3\'); return g(); } return f(1)}', '=> 3');
c('default: 13b eval in default', '()=>{function f(a, g = eval(\'() => a\')) { a = 3; return g(); } return f(1)}', '=> 3');
c('default: 13c eval var in body', '()=>{function f(a, g = () => a) { eval(\'var a = 3\'); return [g(), a]; } return f(1)}', '=> [1,3]');
c('default: 14 rest', '()=>{function f(g = () => r, ...r) { r = 4; return g(); } return f(undefined, 1)}', '=> 4');
c('default: 15 inc', '()=>{function f(a, g = () => a) { a++; a += 2; return g(); } return f(1)}', '=> 4');
c('default: 16 nested', '()=>{function f(a, g = () => () => a) { a = 2; return g()(); } return f(1)}', '=> 2');
c('default: 17 class ctor', '()=>{class C { constructor(a, g = () => a) { a = 2; this.v = g(); } } return new C(1).v}', '=> 2');
c('default: 18 strict', '()=>{\'use strict\'; function f(a, g = () => a) { a = 2; return [g(), arguments[0]]; } return f(1)}', '=> [2,1]');
c('default: 19 let in body shadow block', '()=>{function f(a, g = () => a) { { let a = 5; } a = 2; return g(); } return f(1)}', '=> 2');
c('default: 20 default modifies', '()=>{function f(a, b = (a = 5), g = () => a) { return [a, g()]; } return f(1)}', '=> [5,5]');
c('default: 21 var body sees param', '()=>{function f(a, g = () => a) { var a; return a; } return f(1)}', '=> 1');
c('default: 22 var w closure', '()=>{function f(a, g = () => a, s = (v) => { a = v }) { var a; s(8); return [a, g()]; } return f(1)}', '=> [1,8]');
c('default: 23 arguments in default', '()=>{function f(a, g = () => arguments[0]) { a = 2; return g(); } return f(1)}', '=> 1');
c('default: 24 no closure but default', '()=>{function f(a, b = 3) { a = 2; b = a + b; return [a, b, arguments.length]; } return f(1)}', '=> [2,5,1]');
c('default: 25 body fn sees', '()=>{function f(a, g = () => a) { function h() { a = 42 } h(); return g(); } return f(1)}', '=> 42');
c('default: 26 default fn declared in body name', '()=>{function f(g = () => h, x = 1) { function h(){}; return typeof g; } return f()}', '=> "function"');
c('default: 27 default refers body var', '()=>{function f(g = () => v) { var v = 1; return g(); } return f()}', 'THROW ReferenceError');
c('default: 28 catch param', '()=>{function f(a, g = () => a) { try { throw 3 } catch (a) { a = 9 } return g(); } return f(1)}', '=> 1');
c('default: 29 for let', '()=>{function f(a, g = () => a) { for (let a = 0; a < 2; a++); for (a = 5; a < 7; a++); return g(); } return f(1)}', '=> 7');
c('default: 30 destructure assign', '()=>{function f(a, g = () => a) { [a] = [11]; ({a} = {a: a + 1}); return g(); } return f(1)}', '=> 12');
c('default: 31 delete typeof', '()=>{function f(a, g = () => typeof a) { a = \'x\'; return g(); } return f(1)}', '=> "string"');
c('default: 32 new.target/this', '()=>{function f(a, g = () => [this.k, a]) { a = 2; return g(); } return f.call({k: 4}, 1)}', '=> [4,2]');
ca('default: async function', 'async L => { async function f(a, g = () => a) { a = 2; await 0; return g(); } return await f(1) }', '=> 2');
ca('default: async generator', 'async L => { async function* h(a, g = () => a) { a = 2; yield g(); } return (await h(1).next()).value }', '=> 2');
ca('default: async arrow', 'async L => { var af = async (a, g = () => a) => { await 0; a = 2; return g(); }; return await af(1) }', '=> 2');
c('default (more): a', '()=>{function f(a, g = () => a) { eval(\'var a = 3\'); return [g(), a, eval(\'a\')]; } return f(1)}', '=> [1,3,3]');
c('default (more): b', '()=>{function f(a, g = () => a) { eval(\'var a = 3\'); return [g(), (()=>a)()]; } return f(1)}', '=> [1,3]');
c('default (more): c', '()=>{function f(a) { eval(\'var a = 3\'); return [a, arguments[0]]; } return f(1)}', '=> [3,3]');
c('default (more): d', '()=>{function f(a, g = () => a) { var r = eval(\'var q = 3; a = 4; a\'); return [g(), a, q, r]; } return f(1)}', '=> [4,4,3,4]');
c('default (more): e2', '()=>{ return eval(\'(function f(a = 1) { let a; })\') }', 'THROW SyntaxError');
c('default (more): e3', '()=>{ return eval(\'(function f({a}, b = 1) { let a; })\') }', 'THROW SyntaxError');
c('default (more): e4', '()=>{ return eval(\'(function f(a, a = 1) { })\') }', 'THROW SyntaxError');
c('default (more): e5', '()=>{ return eval(\'"use strict"; (function f(eval = 1) { })\') }', 'THROW SyntaxError');
c('default (more): e6', '()=>{ return eval(\'(function f(a = 1) { "use strict" })\') }', 'THROW SyntaxError');
c('default (more): f annexB', '()=>{function f(a, g = () => a) { { function a(){} } return [typeof g(), typeof a]; } return f(1)}', '=> ["number","number"]');
c('default (more): g fn top', '()=>{function f(a = 1, g = () => a) { function a(){}; return [typeof g(), typeof a]; } return f()}', '=> ["number","function"]');
c('default (more): h arguments param', '()=>{function f(arguments = 5, g = () => arguments) { arguments = 6; return g(); } return f()}', '=> 6');
c('default (more): i args obj', '()=>{function f(a = 5, g = () => a) { a = 6; return [arguments.length, arguments[0], g()]; } return f(undefined)}', '=> [1,undefined,6]');
c('default (more): j default modifies + var', '()=>{function f(a, b = (a = 5), g = () => a) { var a; return [a, g()]; } return f(1)}', '=> [5,5]');
c('default (more): k destr var', '()=>{function f({x}, g = () => x) { var x; x++; return [x, g()]; } return f({x:1})}', '=> [2,1]');
c('default (more): l length', '()=>{function f(a, b = 1, c) {} return f.length}', '=> 1');
c('default (more): m class expr', '()=>{function f(a, C = class { m() { return a } }) { a = 7; return new C().m(); } return f(1)}', '=> 7');
c('default (more): n with', '()=>{function f(a, g = () => a) { with ({}) { a = 3 } return g(); } return f(1)}', '=> 3');
c('default (more): n2 with has', '()=>{function f(a, g = () => a) { with ({a: 0}) { a = 3 } return g(); } return f(1)}', '=> 1');
c('default (more): o typeof undeclared', '()=>{function f(a = 1) { return typeof zz } return f()}', '=> "undefined"');
c('default (more): p func name', '()=>{var f = function h(a = 1, g = () => h) { return typeof g() }; return f()}', '=> "function"');
c('default (more): p2 param named as func', '()=>{var f = function h(h = 1, g = () => h) { h++; return g() }; return f()}', '=> 2');
c('default (more): q delete', '()=>{function f(a = 1) { return delete a } return f()}', '=> false');
c('default (more): r compound', '()=>{function f(a = 1, g = () => a) { a ||= 9; a &&= 8; a ??= 7; a **= 2; return [a, g()] } return f()}', '=> [64,64]');
c('default (more): s gen args', '()=>{function* f(a = 1, g = () => a) { a = yield a; yield g(); } var i = f(); i.next(); return i.next(50).value}', '=> 50');
c('default (more): t recursion', '()=>{function f(n, acc = [], g = () => n) { n--; acc.push(g()); return n > 0 ? f(n, acc) : acc } return f(3)}', '=> [2,1,0]');
c('default (more): u many', '()=>{function f(a, b, c, d, e = () => [a,b,c,d]) { a++; b++; c++; d++; return e() } return f(1,2,3,4)}', '=> [2,3,4,5]');
c('default (more): v self ref tdz', '()=>{function f(a = a) {} return f()}', 'THROW ReferenceError');
c('default (more): w ok self', '()=>{function f(a = a) { return a } return f(3)}', '=> 3');
c('default (more): x closure tdz', '()=>{function f(g = () => b, b = g) { return typeof g() } return f()}', '=> "function"');
c('default (more): y new Function', '()=>{var f = new Function(\'a\', \'g = () => a\', \'a = 2; return g()\'); return f(1)}', '=> 2');
c('default (more): z2 arrow body expr', '()=>{var f = (a, g = () => a) => (a = 2, g()); return f(1)}', '=> 2');
c('default (more): z3 nested default fn', '()=>{function f(a, g = function(b = a) { return b }) { a = 2; return g(); } return f(1)}', '=> 2');
c('default (more): z4 ctor derived', '()=>{class A { constructor(v){ this.v = v } } class B extends A { constructor(a, g = () => a) { a = 2; super(g()); } } return new B(1).v}', '=> 2');
c('default (more): z5 eval strict', '()=>{\'use strict\'; function f(a, g = () => a) { eval(\'var a = 3\'); return [g(), a]; } return f(1)}', '=> [1,1]');
c('default (more): z6 eval assigns arrow in body', '()=>{function f(a, g = () => a) { (() => eval(\'a = 9\'))(); return [g(), a]; } return f(1)}', '=> [9,9]');
c('default (more): z7 eval in default sees later tdz', '()=>{function f(a = eval(\'b\'), b = 1) { } return f()}', 'THROW ReferenceError');
c('default (more): z8 eval var in default', '()=>{function f(a = eval(\'var z = 1; z\'), g = () => z) { return [a, typeof z, g()]; } return f()}', '=> [1,"number",1]');
c('default (more): z9 rest destr', '()=>{function f(g = () => r, ...[r, q]) { r = 4; return [g(), q]; } return f(undefined, 1, 2)}', '=> [4,2]');
c('default (more): z10 body closure after var', '()=>{function f(a, g = () => a) { var a = 5; var h = () => a; a = 6; return [g(), h()]; } return f(1)}', '=> [1,6]');
c('default (more): z11 for-in var', '()=>{function f(a, g = () => a) { for (var a in {k: 1}); return [g(), a]; } return f(1)}', '=> [1,"k"]');
c('default (more): z12 inner fn var hoist', '()=>{function f(a, g = () => a) { if (false) { var a; } a = 3; return [g(), a]; } return f(1)}', '=> [1,3]');
c('default (more): z13 catch', '()=>{function f(a = 1, g = () => a) { try { throw 0 } catch { a = 4 } finally { a++ } return g(); } return f()}', '=> 5');
c('default (more): z14 label loop closure', '()=>{function f(n = 3, g = () => n) { var r = []; while (n-- > 0) r.push(g()); return r; } return f()}', '=> [2,1,0]');
c('default, eval declares a var of the same name: 1', '()=>{function f(a, g = () => a) { eval(\'var a = 3\'); return [g(), a]; } return f(1)}', '=> [1,3]');
c('default, eval declares a var of the same name: 2', '()=>{function f(a, g = () => a) { eval(\'var a = 3\'); return a; } return f(1)}', '=> 3');
c('default, eval declares a var of the same name: 3', '()=>{function f(a, g = () => a) { eval(\'var a = 3\'); var r = a; return r; } return f(1)}', '=> 3');
c('default, eval declares a var of the same name: 4', '()=>{function f(a, g = () => a) { eval(\'var a = 3\'); a = 5; return [a, g()]; } return f(1)}', '=> [5,1]');
c('default, eval declares a var of the same name: 5', '()=>{function f(a, g = () => a) { eval(\'var a = 3\'); a++; return [a, g(), typeof a, delete a, a]; } return f(1)}', '=> [4,1,"number",true,1]');

section('2. arguments');
/* 'eval in default': a direct eval in a default value may not declare a var
   called like a parameter or 'arguments' (EvalDeclarationInstantiation, step 3.d).
   This engine throws the SyntaxError; V8 returns 5. */
c('arguments: arguments fn', 'L => { function f() { var b = typeof arguments; { function arguments() {} } return [b, typeof arguments] } return f() }', '=> ["object","function"]');
c('arguments: arguments fn not reached', 'L => { function f() { if (false) { function arguments() {} } return [typeof arguments, arguments.length] } return f(1, 2) }', '=> ["object",2]');
c('arguments: arguments fn in arrow', 'L => { function f() { return (() => { { function arguments() {} } return typeof arguments })() } return f() }', '=> "function"');
c('arguments: arguments var', 'L => { function f() { var arguments; return typeof arguments } return f() }', '=> "object"');
c('arguments: arguments var init', 'L => { function f() { var arguments = 1; return typeof arguments } return f() }', '=> "number"');
c('arguments: arguments top fn', 'L => { function f() { function arguments() {} return typeof arguments } return f() }', '=> "function"');
c('arguments: arguments param', 'L => { function f(arguments) { return typeof arguments } return f() }', '=> "undefined"');
c('arguments: arguments let', 'L => { function f() { let arguments = 1; return typeof arguments } return f() }', '=> "number"');
c('arguments: arguments in default with body var', 'L => { function f(a = arguments.length) { var arguments = \'v\'; return [a, arguments] } return f(undefined, 1) }', '=> [2,"v"]');
c('arguments: arguments in default closure', 'L => { function f(g = () => arguments) { return g() === arguments } return f() }', '=> true');
c('arguments: arguments eval var', 'L => { function f() { eval(\'var arguments = 5\'); return arguments } return f() }', '=> 5');
c('arguments: arguments eval var w/ defaults', 'L => { function f(a = 1) { try { eval(\'var arguments = 5\') } catch (e) { return e.name } return arguments } return f() }', '=> 5');
c('arguments: arguments eval in default', 'L => { function f(a = eval(\'var arguments = 5\')) { return arguments } try { return f() } catch (e) { return e.name } }', '=> "SyntaxError"');
c('arguments: if/else fn loops', 'L => { var r = []; for (var i = 0; i < 3; i++) { if (i % 2) function ff() { return \'odd\' } else function ff() { return \'even\' } r.push(ff()) } return r }', '=> ["even","odd","even"]');
c('arguments: if fn closure capture per iteration', 'L => { var fs = []; for (let i = 0; i < 3; i++) { if (i != 1) function gg() { return i } fs.push(gg) } return fs.map(f => f()) }', '=> [0,0,2]');

section('3. Functions declared in blocks (annex B.3.3)');
/* 'nested block same fn name': the inner declaration is not copied to the
   function scope, because a 'var' of that name inside the outer block, which
   declares the name itself, would be a syntax error (B.3.3.1). This engine
   follows that; V8 copies it anyway and answers 2. */
c('block function: dup block fn', 'L => { { function q() { return 1 } function q() { return 3 } } return q() }', '=> 3');
c('block function: dup block fn + assign', 'L => { { function q() { return 1 } q = 2; function q() { return 3 } } return typeof q }', '=> "number"');
c('block function: nested block same fn name', 'L => { { function q() { return 1 } { function q() { return 2 } } } return q() }', '=> 1');
c('block function: let outer blocks hoist', 'L => { { let q = 0; { function q() { return 2 } } } return typeof q }', '=> "undefined"');
c('block function: fn in block then var', 'L => { { function q() { return 1 } } var q; return typeof q }', '=> "function"');
c('block function: fn in block, var initialised before', 'L => { var q = 5; { function q() { return 1 } } return typeof q }', '=> "function"');
c('block function: fn in block, not executed yet', 'L => { var r = typeof q; var q2 = 5; { r += typeof q; function q() {} } return r }', '=> "undefinedfunction"');
c('block function: fn in block generator not hoisted', 'L => { { function* q() {} } return typeof q }', '=> "undefined"');
c('block function: fn in block async not hoisted', 'L => { { async function q() {} } return typeof q }', '=> "undefined"');
c('block function: fn in block called before decl in block', 'L => { { var r = q(); function q() { return 7 } } return r }', '=> 7');
c('block function: fn in block closure sees block binding', 'L => { var f; { function q() { return q } f = q; q = 1 } return [typeof f(), typeof q] }', '=> ["number","function"]');
c('block function: fn decl in loop each iter new', 'L => { var a = []; for (var i = 0; i < 2; i++) { function q() {} a.push(q) } return [a[0] === a[1], a[1] === q] }', '=> [false,true]');
c('block function: fn in if else', 'L => { if (true) function a1() { return 1 } else function a1() { return 2 } return a1() }', '=> 1');
c('block function: fn in else', 'L => { if (false) function a2() { return 1 } else function a2() { return 2 } return a2() }', '=> 2');
c('block function: fn in block global indirect eval', 'L => { try { return (0, eval)(\'var before = typeof gq; { function gq() {} } [before, typeof gq, Object.getOwnPropertyDescriptor(globalThis, "gq").configurable, (function(){ var x; { function gz(){}; x = gz } return x === gz })()]\') } finally { delete globalThis.gq } }', '=> ["undefined","function",true,true]');
c('block function: fn in block global identity', 'L => { try { return (0, eval)(\'var inner; { function gq2() {} inner = gq2 } inner === gq2\') } finally { delete globalThis.gq2 } }', '=> true');
c('block function: fn in eval block', 'L => { eval(\'{ function eq() {} }\'); return typeof eq }', '=> "function"');
c('block function: fn in switch dup', 'L => { switch (1) { case 0: function sq() { return 0 } case 1: function sq() { return 1 } } return sq() }', '=> 1');
c('block function: fn top-level param default', 'L => { function f(a = 1, g = () => a) { var before = typeof a; function a() {} return [before, typeof g()] } return f() }', '=> ["function","number"]');
c('block function: fn block param default', 'L => { function f(a = 1, g = () => a) { { function a() {} } return [typeof a, typeof g()] } return f() }', '=> ["number","number"]');
c('block function: fn top-level simple param', 'L => { function f(a) { var before = typeof a; function a() {} return before } return f(1) }', '=> "function"');
c('block function: arguments fn', 'L => { function f() { { function arguments() {} } return typeof arguments } return f() }', '=> "function"');

section('4. eval (direct and indirect), its completion value, Function(), labels, with');
c('block fn identity', 'L => { var inner; { function q() {} inner = q } return inner === q }', '=> true');
c('block fn overwritten', 'L => { { function q() { return 1 } q = 2; function q() { return 3 } } return typeof q }', '=> "number"');
c('block fn assigned before decl', 'L => { { q = 5; function q() {} } return typeof q }', '=> "number"');
c('block fn assigned after decl', 'L => { { function q() {} q = 5 } return typeof q }', '=> "function"');
c('block fn before block', 'L => { var r = typeof q; { function q() {} } return [r, typeof q] }', '=> ["undefined","function"]');
c('block fn in if', 'L => { if (true) function q() {} return typeof q }', '=> "function"');
c('block fn not reached', 'L => { if (false) { function q() {} } return typeof q }', '=> "undefined"');
c('block fn with let conflict', 'L => { let q = 1; { function q() {} } return typeof q }', '=> "number"');
c('block fn param conflict', 'L => { return (function (q) { { function q() {} } return typeof q })(1) }', '=> "number"');
c('block fn in loop closure', 'L => { var fs = []; for (var i = 0; i < 2; i++) { function q() { return i } fs.push(q) } return [fs[0] === fs[1], q === fs[1]] }', '=> [false,true]');
c('block fn in switch', 'L => { switch (1) { case 1: function q() { return 1 } } return typeof q }', '=> "function"');
c('block fn in try', 'L => { try { function q() {} } catch (e) {} return typeof q }', '=> "function"');
c('block fn label', 'L => { l: function q() {} return typeof q }', '=> "function"');
c('nested blocks', 'L => { { { function q() {} } var r1 = typeof q } return [r1, typeof q] }', '=> ["function","function"]');
c('block fn strict', 'L => { \'use strict\'; { function q() {} } return typeof q }', '=> "undefined"');
c('direct eval var', 'L => { eval(\'var ev = 1\'); return typeof ev }', '=> "number"');
c('direct eval let', 'L => { eval(\'let el = 1\'); return typeof el }', '=> "undefined"');
c('direct eval fn', 'L => { eval(\'function ef() {}\'); return typeof ef }', '=> "function"');
c('direct eval strict var', 'L => { \'use strict\'; eval(\'var es = 1\'); return typeof es }', '=> "undefined"');
c('direct eval sees locals', 'L => { var loc = 5; let l2 = 6; return eval(\'loc + l2\') }', '=> 11');
c('direct eval assigns local', 'L => { var loc = 5; eval(\'loc = 7\'); return loc }', '=> 7');
c('indirect eval global', 'L => { var loc = 5; return [(0, eval)(\'typeof loc\'), typeof globalThis.eval] }', '=> ["undefined","function"]');
c('indirect eval var is global', 'L => { (0, eval)(\'var ieg = 1\'); try { return [typeof ieg, Object.getOwnPropertyDescriptor(globalThis, \'ieg\').configurable] } finally { delete globalThis.ieg } }', '=> ["number",true]');
c('eval alias', 'L => { var e = eval; var loc = 1; return e(\'typeof loc\') }', '=> "undefined"');
c('eval non-string', 'L => { var o = {}; return [eval(o) === o, eval(5), eval()] }', '=> [true,5,undefined]');
c('eval this', 'L => { return (function () { return eval(\'this\') }).call(7) + 1 }', '=> 8');
c('eval new.target', 'L => { function F() { return eval(\'new.target === F\') } return [new F() instanceof F, F()] }', '=> [true,false]');
c('eval new.target in arrow outside fn', 'L => { try { return (0, eval)(\'new.target\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('eval arguments', 'L => { return (function () { return eval(\'arguments.length\') })(1, 2) }', '=> 2');
c('eval super', 'L => { class A { m() { return 1 } } class B extends A { m() { return eval(\'super.m()\') + 1 } } return new B().m() }', '=> 2');
c('eval var conflicts with let', 'L => { let x = 1; try { eval(\'var x = 2\') } catch (e) { return e.name } return x }', '=> "SyntaxError"');
c('eval var conflicts with let in outer block', 'L => { { let y = 1; { try { eval(\'var y = 2\') } catch (e) { return e.name } } } }', '=> "SyntaxError"');
c('eval var over catch param', 'L => { try { throw 1 } catch (e) { eval(\'var e = 2\'); return e } }', '=> 2');
c('eval fn over var', 'L => { var f = 1; eval(\'function f() {}\'); return typeof f }', '=> "function"');
c('eval deletable var', 'L => { eval(\'var dv = 1\'); return [delete dv, typeof dv] }', '=> [true,"undefined"]');
c('non-eval var not deletable', 'L => { var nd = 1; return [delete nd, typeof nd] }', '=> [false,"number"]');
c('eval in arrow params', 'L => { var f = (a = eval(\'1 + 1\')) => a; return f() }', '=> 2');
c('eval closure survives', 'L => { function mk() { var c = 0; return eval(\'(function () { return ++c })\') } var f = mk(); f(); return f() }', '=> 2');
c('eval completion expr', 'L => eval(\'1; 2\')', '=> 2');
c('eval completion var', 'L => eval(\'var cv = 1\')', '');
c('eval completion empty', 'L => eval(\'\')', '');
c('eval completion if', 'L => [eval(\'1; if (true) { 2 }\'), eval(\'1; if (false) { 2 }\'), eval(\'1; if (true) { }\'), eval(\'3; if (true) ; else 4\')]', '=> [2,undefined,undefined,undefined]');
c('eval completion loops', 'L => [eval(\'1; for (var i = 0; i < 2; i++) { i }\'), eval(\'1; while (false) { }\'), eval(\'1; do { 5 } while (false)\'), eval(\'1; for (var k in { a: 1 }) { k }\'), eval(\'1; for (var v of [7, 8]) { v }\'), eval(\'2; for (var j = 0; j < 2; j++) { }\')]', '=> [1,undefined,5,"a",8,undefined]');
c('eval completion break/continue', 'L => [eval(\'1; do { 2; break } while (true)\'), eval(\'1; do { break } while (true)\'), eval(\'1; for (var i = 0; i < 2; i++) { 3; continue }\'), eval(\'l: { 4; break l; 5 }\'), eval(\'1; l2: { break l2 }\'), eval(\'6; do { 7; continue } while (false)\')]', '=> [2,undefined,3,4,1,7]');
c('eval completion try', 'L => [eval(\'1; try { 2 } finally { 3 }\'), eval(\'1; try { throw 2 } catch (e) { e + 1 }\'), eval(\'1; try { 2 } catch (e) { 3 }\'), eval(\'1; try { } finally { 3 }\'), eval(\'1; try { throw 0 } catch (e) { } \'), eval(\'1; try { 5 } catch (e) { } finally { }\')]', '=> [2,3,2,undefined,undefined,5]');
c('eval completion switch', 'L => [eval(\'1; switch (1) { case 1: 2; break; case 2: 3 }\'), eval(\'1; switch (9) { case 1: 2 }\'), eval(\'1; switch (1) { case 1: }\'), eval(\'1; switch (1) { case 1: 2; case 2: 3; default: }\'), eval(\'1; switch (1) { default: 4 }\')]', '=> [2,undefined,undefined,3,4]');
c('eval completion with', 'L => [eval(\'1; with ({}) { 2 }\'), eval(\'1; with ({}) { }\')]', '=> [2,undefined]');
c('eval completion block/fn/class', 'L => [eval(\'1; { }\'), eval(\'1; { 2; { } }\'), eval(\'1; function f() {}\'), eval(\'1; class C {}\'), eval(\'1; let z = 3\'), eval(\'1; ;\'), eval(\'1; var q = 2; q\'), eval(\'"use strict"\'), eval(\'1; label: 2\')]', '=> [1,2,1,1,1,1,2,"use strict",2]');
c('eval completion nested loop break', 'L => [eval(\'1; a: for (;;) { 2; for (;;) { 3; break a } }\'), eval(\'1; for (var i = 0; i < 3; i++) { if (i == 1) continue; i + 10 }\'), eval(\'var s = 0; for (var i = 0; i < 3; i++) { s += i }\')]', '=> [3,12,3]');
c('eval completion throw inside', 'L => { try { eval(\'1; throw 2\') } catch (e) { return e } }', '=> 2');
c('eval syntax error', 'L => { try { eval(\'var\') } catch (e) { return [e.name, e instanceof SyntaxError] } }', '=> ["SyntaxError",true]');
c('eval return outside fn', 'L => { try { eval(\'return 1\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('eval break outside', 'L => { try { eval(\'break\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('eval html comment', 'L => eval(\'1 <!-- 2\\n\')', '=> 1');
c('eval strict octal', 'L => { try { eval(\'"use strict"; 010\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('eval await ident', 'L => eval(\'var await = 3; await\')', '=> 3');
c('eval yield ident', 'L => eval(\'var yield = 4; yield\')', '=> 4');
c('eval let ident', 'L => eval(\'var let = 5; let\')', '=> 5');
c('eval async arrow', 'L => typeof eval(\'async x => x\')', '=> "function"');
c('Function ctor scope', 'L => { var loc = 1; return [new Function(\'return typeof loc\')(), Function(\'a\', \'b\', \'return a + b\')(1, 2), Function(\'a,b\', \'return a*b\')(2, 3), new Function()(), Function(\'return this\')() === globalThis] }', '=> ["undefined",3,6,undefined,true]');
c('Function ctor toString', 'L => [new Function(\'a\', \'b\', \'return a\').toString(), new Function().toString(), Function(\'/*x*/a\', \'return a\').toString()]', '=> ["function anonymous(a,b\\u000a) {\\u000areturn a\\u000a}","function anonymous(\\u000a) {\\u000a\\u000a}","function anonymous(/*x*/a\\u000a) {\\u000areturn a\\u000a}"]');
c('Function ctor injection', 'L => { try { new Function(\'a) { return 7 } function x(\', \'return 1\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('Function ctor body comment', 'L => { return new Function(\'return 1 // c\')() }', '=> 1');
c('Function ctor strict', 'L => { return new Function(\'"use strict"; return this\')() }', '');
c('Function ctor default param', 'L => { return new Function(\'a = 2\', \'g = () => a\', \'a++; return g()\')() }', '=> 3');
c('Function ctor not strict inherited', 'L => { \'use strict\'; return typeof new Function(\'return this\')() }', '=> "object"');
c('GeneratorFunction ctor', 'L => { var GF = Object.getPrototypeOf(function* () {}).constructor; return [...new GF(\'yield 1; yield 2\')()] }', '=> [1,2]');
c('AsyncFunction ctor', 'L => { var AF = Object.getPrototypeOf(async function () {}).constructor; return [typeof new AF(\'await 1\'), AF.name, new AF(\'a\', \'return a\').length] }', '=> ["function","AsyncFunction",1]');
c('Function.prototype props', 'L => [typeof Function.prototype, Function.prototype.name, Function.prototype.length, Function.prototype(), Object.getOwnPropertyNames(function () {}).sort(), Object.getOwnPropertyNames(() => {}).sort(), Object.getOwnPropertyNames(class {}).sort()]', '=> ["function","",0,undefined,["length","name","prototype"],["length","name"],["length","name","prototype"]]');
c('label same name nested fn', 'L => { a: { (function () { a: { break a } })(); break a } return 1 }', '=> 1');
c('label dup', 'L => { try { eval(\'a: a: 1\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('label continue non-loop', 'L => { try { eval(\'a: { continue a }\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('label on fn strict', 'L => { try { eval(\'"use strict"; a: function f() {}\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('label undefined', 'L => { try { eval(\'break nope\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('label yield/await names', 'L => eval(\'yield: 1; await: 2; let: 3; async: 4\')', '=> 4');
c('with strict', 'L => { try { eval(\'"use strict"; with ({}) {}\') } catch (e) { return e.name } }', '=> "SyntaxError"');
c('with primitive', 'L => { with (\'abc\') { return [length, typeof charAt] } }', '=> [3,"function"]');
c('with null', 'L => { try { with (null) { } } catch (e) { return e.name } }', '=> "TypeError"');
c('with getter this', 'L => { var o = { get g() { return this === o } }; with (o) { return g } }', '=> true');
c('with setter', 'L => { var o = { set s(v) { L(\'set \' + v) } }; with (o) { s = 1 } }', 'set 1');
c('with eval var', 'L => { var o = { v: 1 }; with (o) { eval(\'var v = 2; var w = 3\') } return [o.v, typeof w, v] }', '=> [2,"number",undefined]');
c('with nested', 'L => { with ({ a: 1, b: 1 }) with ({ a: 2 }) { return [a, b] } }', '=> [2,1]');
c('with call undefined this', 'L => { with ({}) { return (function () { \'use strict\'; return this })() } }', '');
c('with call through binding', 'L => { var o = { f() { \'use strict\'; return this === o } }; with (o) { return [f(), (f)(), (0, f)()] } }', '=> [true,true,false]');
c('with typeof / delete', 'L => { var o = { d: 1 }; with (o) { return [typeof d, delete d, typeof d, \'d\' in o] } }', '=> ["number",true,"undefined",false]');
c('with const assignment', 'L => { const c = 1; with ({}) { try { c = 2 } catch (e) { return e.name } } }', '=> "TypeError"');
c('with in generator', 'L => { function* g() { with ({ y: 1 }) { yield y; y = 2; yield y } } return [...g()] }', '=> [1,2]');
c('with closure in loop', 'L => { var fs = []; for (var i = 0; i < 2; i++) with ({ i2: i }) fs.push(() => i2); return fs.map(f => f()) }', '=> [0,1]');

section('5. Declarations at the top level of a script');
await drain();
helpers('var G = globalThis;');
c('global: let shadows global prop', 'L => { G.gp1 = { o: 1 }; var a = (0, eval)(\'let gp1 = 1; gp1\'); return [a, (0, eval)(\'gp1\'), typeof G.gp1, (0, eval)(\'typeof gp1\')] }', '=> [1,{o:1},"object","object"]');
c('global: let shadows global prop, fn reads', 'L => { G.gp2 = \'prop\'; function rd() { return gp2 } var before = rd(); (0, eval)(\'let gp2 = "lex"\'); return [before, rd(), G.gp2] }', '=> ["prop","prop","prop"]');
c('global: let vs non-configurable global', 'L => { Object.defineProperty(G, \'gp3\', { value: 1, configurable: false }); try { (0, eval)(\'let gp3 = 2\') } catch (e) { return e.name } return \'no throw\' }', '=> "no throw"');
c('global: let vs var global', 'L => { (0, eval)(\'var gp4 = 1\'); try { (0, eval)(\'let gp4 = 2\') } catch (e) { return e.name } return \'no throw\' }', '=> "no throw"');
c('global: let then var', 'L => { (0, eval)(\'let gp5 = 1\'); try { (0, eval)(\'var gp5 = 2\') } catch (e) { return e.name } return \'no throw\' }', '=> "no throw"');
c('global: let then let', 'L => { (0, eval)(\'let gp6 = 1\'); try { (0, eval)(\'let gp6 = 2\') } catch (e) { return e.name } return \'no throw\' }', '=> "no throw"');
c('global: let then function', 'L => { (0, eval)(\'let gp7 = 1\'); try { (0, eval)(\'function gp7() {}\') } catch (e) { return e.name } return \'no throw\' }', '=> "no throw"');
c('global: global let not on globalThis', 'L => { (0, eval)(\'let gp8 = 1; const gp9 = 2; class gp10 {}\'); return [\'gp8\' in G, \'gp9\' in G, \'gp10\' in G, (0, eval)(\'gp8 + gp9\'), (0, eval)(\'typeof gp10\')] }', 'THROW ReferenceError');
c('global: global const assign', 'L => { (0, eval)(\'const gp11 = 1\'); try { (0, eval)(\'gp11 = 2\') } catch (e) { return e.name } }', '');
c('global: global TDZ across scripts', 'L => { try { (0, eval)(\'gp12; let gp12 = 1\') } catch (e) { L(e.name) } try { return (0, eval)(\'gp12\') } catch (e) { return e.name } }', 'ReferenceError | => "ReferenceError"');
c('global: global fn decl props', 'L => { (0, eval)(\'function gp13() {}; var gp14 = 1; gp15 = 2\'); return [\'gp13\', \'gp14\', \'gp15\'].map(n => { var d = Object.getOwnPropertyDescriptor(G, n); return [d.writable, d.enumerable, d.configurable] }) }', '=> [[true,true,true],[true,true,true],[true,true,true]]');
c('global: global fn over non-configurable', 'L => { Object.defineProperty(G, \'gp16\', { value: 1, writable: true, enumerable: true, configurable: false }); (0, eval)(\'function gp16() {}\'); return typeof gp16 }', '=> "function"');
c('global: global fn over non-writable non-configurable', 'L => { Object.defineProperty(G, \'gp17\', { value: 1, writable: false, enumerable: false, configurable: false }); try { (0, eval)(\'function gp17() {}\') } catch (e) { return e.name } return typeof gp17 }', '=> "TypeError"');
c('global: global var over accessor', 'L => { Object.defineProperty(G, \'gp18\', { get() { return \'acc\' }, set(v) { L(\'set \' + v) }, configurable: true }); (0, eval)(\'var gp18 = 5\'); return gp18 }', 'set 5 | => "acc"');
c('global: undeclared assign creates deletable', 'L => { (0, eval)(\'gp19 = 1\'); var d = Object.getOwnPropertyDescriptor(G, \'gp19\'); return [d.configurable, delete G.gp19, typeof gp19] }', '=> [true,true,"undefined"]');
c('global: global this', 'L => [(0, eval)(\'this\') === G, (function () { return this })() === G, typeof globalThis, Object.getOwnPropertyDescriptor(G, \'globalThis\').enumerable]', '=> [true,true,"object",false]');
c('global: global getter prop read by name', 'L => { var n = 0; Object.defineProperty(G, \'gp20\', { get() { return ++n }, configurable: true }); return [gp20, gp20, typeof gp20, n] }', '=> [1,2,"number",3]');
c('global: global proto chain lookup', 'L => { Object.prototype.gp21 = \'proto\'; try { return [typeof gp21, gp21, \'gp21\' in G, (0, eval)(\'gp21\')] } finally { delete Object.prototype.gp21 } }', '=> ["string","proto",true,"proto"]');
c('global: global delete then reference', 'L => { G.gp22 = 1; function rd() { return gp22 } rd(); delete G.gp22; try { rd() } catch (e) { return e.name } }', '=> "ReferenceError"');
c('global: global redefine then read cached', 'L => { G.gp23 = 1; function rd() { return gp23 } var a = rd(); Object.defineProperty(G, \'gp23\', { get() { return \'getter\' } }); return [a, rd()] }', '=> [1,"getter"]');

await drain();
finish();
