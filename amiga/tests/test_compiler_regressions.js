/*
 * test_compiler_regressions.js -- JavaScript-visible effects of compiler
 * bugs, so that a library built with a bad compiler is caught by a test
 * instead of by a user.
 *
 * Run with: qjs tests/test_compiler_regressions.js
 * (the file is a module: it has import statements)
 *
 * Section A is the one known wrong answer. vbccm68k built from the
 * August 2025 vbcc sources reloaded a constant at a function's exit
 * label. In JS_GetScriptOrModuleName that constant was the 0 of
 * "return JS_ATOM_NULL" and the register was d0, so the function
 * answered "no name" every time. Libraries 0.200 to 0.232 were built
 * that way: import() was always rejected and import.meta threw.
 *
 * Section B exercises the seven other functions of the library whose
 * machine code the same bug changed (is_num_string, js_bigint_divrem,
 * js_parse_array_literal, js_parse_postfix_expr, get_exported_names,
 * js_parse_directives, JS_AddIntrinsicBaseObjects). There the reloaded
 * constant went to a register that the function restores before it
 * returns, so they behaved correctly; these checks pass with the old
 * compiler and the fixed one, and are here to keep it that way.
 *
 * See tools/vbcc-patches/README.md for the compiler side.
 */
import * as std from 'qjs:std';
import * as os from 'qjs:os';

let pass = 0, fail = 0;

/**
 * Record one check.
 * @param {boolean} cond - true when the behaviour is right
 * @param {string} msg - what was checked
 * @returns {void}
 */
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

/**
 * Run fn and report whether it threw.
 * @param {function(): *} fn - code under test
 * @returns {{value: *, error: *}} the result, or the exception
 */
function attempt(fn) {
    try { return { value: fn(), error: null }; }
    catch (e) { return { value: undefined, error: e }; }
}

/**
 * Wait for a promise and report how it settled.
 * @param {Promise<*>} p - promise under test
 * @returns {Promise<{value: *, error: *}>} the value, or the rejection
 */
async function settle(p) {
    try { return { value: await p, error: null }; }
    catch (e) { return { value: undefined, error: e }; }
}

/**
 * import() from a function three calls deep, so that the engine has to
 * find the calling script from a stack with several frames on it.
 * @param {number} depth - calls still to make before importing
 * @returns {Promise<Object>} the module namespace
 */
function importFromDepth(depth) {
    if (depth > 0) return importFromDepth(depth - 1);
    return import('qjs:os');
}

print("=== Compiler regression test ===");

print("A. JS_GetScriptOrModuleName (import(), import.meta)");
{
    let r = attempt(() => typeof import.meta);
    ok(r.error === null && r.value === "object",
       "import.meta is an object" + (r.error ? " (threw: " + r.error + ")" : ""));

    r = await settle(import('qjs:os'));
    ok(r.error === null && r.value !== undefined && typeof r.value.now === "function",
       "import('qjs:os') resolves to the os module" +
       (r.error ? " (rejected: " + r.error + ")" : ""));
    ok(r.error === null && r.value !== undefined && r.value.now === os.now,
       "import('qjs:os') is the same module as the static import");

    r = await settle(import('qjs:std'));
    ok(r.error === null && r.value !== undefined && typeof r.value.exit === "function",
       "import('qjs:std') resolves to the std module" +
       (r.error ? " (rejected: " + r.error + ")" : ""));

    r = await settle(importFromDepth(3));
    ok(r.error === null && r.value !== undefined && typeof r.value.now === "function",
       "import() from a nested call" + (r.error ? " (rejected: " + r.error + ")" : ""));

    r = await settle((async () => (await import('qjs:os')).now === os.now)());
    ok(r.error === null && r.value === true,
       "import() inside an async arrow function" +
       (r.error ? " (rejected: " + r.error + ")" : ""));

    r = await settle(import('qjs:no-such-module'));
    ok(r.error !== null && !/no function filename/.test(String(r.error)),
       "import() of a missing module is rejected for the right reason" +
       (r.error ? " (" + r.error + ")" : ""));
}

print("B. functions whose code the bug changed without changing the answer");
{
    /* is_num_string: which property keys count as array indexes */
    const o = {};
    o["10"] = "a"; o["2"] = "b"; o["x"] = "c"; o["01"] = "d";
    o["4294967294"] = "e"; o["4294967295"] = "f"; o["-1"] = "g"; o["1.5"] = "h";
    ok(Object.keys(o).join(",") === "2,10,4294967294,x,01,4294967295,-1,1.5",
       "integer-like keys sort first, others keep insertion order");
    const a = [];
    a["3"] = 1;
    ok(a.length === 4, "a['3'] = 1 grows the array to length 4");
    a["03"] = 1;
    ok(a.length === 4, "a['03'] is an ordinary property");

    /* js_bigint_divrem */
    ok(7n / 2n === 3n && 7n % 2n === 1n, "7n / 2n and 7n % 2n");
    ok(-7n / 2n === -3n && -7n % 2n === -1n, "-7n / 2n and -7n % 2n");
    ok(7n / -2n === -3n && 7n % -2n === 1n, "7n / -2n and 7n % -2n");
    ok((2n ** 100n) / (2n ** 37n) === 2n ** 63n, "2n**100n / 2n**37n");
    ok((10n ** 30n + 7n) % (10n ** 15n) === 7n, "(10n**30n + 7n) % 10n**15n");
    ok((10n ** 30n) / 3n === 333333333333333333333333333333n, "10n**30n / 3n");
    ok(0n / 5n === 0n && 5n % 5n === 0n, "0n / 5n and 5n % 5n");
    let r = attempt(() => 1n / 0n);
    ok(r.error instanceof RangeError, "1n / 0n throws RangeError");
    r = attempt(() => 1n % 0n);
    ok(r.error instanceof RangeError, "1n % 0n throws RangeError");

    /* js_parse_array_literal */
    const src = [1, 2, 3];
    const lit = [0, , ...src, , 9];
    ok(lit.length === 7 && lit[0] === 0 && !(1 in lit) && lit[2] === 1 &&
       lit[4] === 3 && !(5 in lit) && lit[6] === 9,
       "array literal with holes and a spread");
    ok([].length === 0 && [,].length === 1 && [, ,].length === 2 && [1, ].length === 1,
       "array literals: empty, holes only, trailing comma");
    const big = eval("[" + new Array(40).fill("7").join(",") + "]");
    ok(big.length === 40 && big[0] === 7 && big[39] === 7, "40-element array literal");
    ok([[1, [2, [3]]], [4]][0][1][1][0] === 3, "nested array literals");

    /* js_parse_postfix_expr */
    const obj = { f(x) { return x + 1; }, g: null, h: { k: [10, 20] }, t(s, v) { return s[0] + v + s[1]; } };
    ok(obj.f(1) === 2 && obj["f"](2) === 3, "member call, computed member call");
    ok(obj.g?.x === undefined && obj.h?.k?.[1] === 20 && obj.g?.() === undefined,
       "optional chaining on null and on a value");
    ok(obj.t`a${1}b` === "a1b", "tagged template through a member");
    ok(new (class { constructor() { this.nt = new.target !== undefined; } })().nt === true,
       "new.target in a constructor");
    let n = 5;
    ok(n++ === 5 && n-- === 6 && n === 5, "postfix ++ and --");
    ok((() => [1, 2, 3])()[1] === 2 && "abc".toUpperCase().length === 3,
       "call result indexed, chained calls");
    ok(new Array(3).length === 3 && new Date(0).getTime() === 0, "new with arguments");

    /* get_exported_names: the keys of a module namespace object (the
       static one, so that this check does not depend on section A) */
    const ns = os;
    const names = Object.keys(ns);
    ok(names.length > 5 && names.indexOf("now") >= 0,
       "module namespace lists its exports (" + names.length + " names)");
    ok(names.slice().sort().join() === names.join(), "namespace keys are sorted");
    ok(Object.prototype.toString.call(ns) === "[object Module]", "namespace is a Module object");

    /* js_parse_directives */
    ok((function () { "use strict"; return this === undefined; })(),
       '"use strict" directive makes this undefined');
    ok(new Function("return this !== undefined")(), "no directive: sloppy function");
    ok(new Function("'use strict'; return this === undefined")(), "'use strict' in new Function");
    ok(new Function("'use\\x20strict'; return this !== undefined")(),
       "an escaped directive is not a directive");
    ok(new Function("'a'; 'b'; 'use strict'; return this === undefined")(),
       "directive after other string statements");
    r = attempt(() => new Function("'use strict'; with ({}) {}"));
    ok(r.error instanceof SyntaxError, "strict code rejects with");

    /* JS_AddIntrinsicBaseObjects: the global objects it installs */
    const globals = ["Object", "Function", "Error", "TypeError", "RangeError", "SyntaxError",
        "EvalError", "ReferenceError", "URIError", "AggregateError", "Array", "Number",
        "Boolean", "String", "Symbol", "Math", "Reflect", "globalThis", "parseInt",
        "parseFloat", "isNaN", "isFinite", "decodeURI", "encodeURIComponent", "escape",
        "unescape", "Iterator", "queueMicrotask"];
    const missing = globals.filter((g) => typeof globalThis[g] === "undefined");
    ok(missing.length === 0, "base globals are defined" +
       (missing.length ? " (missing: " + missing.join(" ") + ")" : ""));
    ok(Number.MAX_SAFE_INTEGER === 9007199254740991 && Number.EPSILON > 0 &&
       Number.MIN_SAFE_INTEGER === -9007199254740991, "Number constants");
    ok(Math.PI > 3.14159 && Math.PI < 3.1416 && Math.max(1, 2) === 2, "Math object");
    /* that the three value globals exist and hold the right kind of
       value; how infinities and NaNs compare is another test's subject */
    ok(typeof Infinity === "number" && Infinity > 1e308 && isNaN(NaN) &&
       typeof NaN === "number" && undefined === void 0, "Infinity, NaN, undefined");
    ok(Object.getPrototypeOf(TypeError) === Error && new RangeError("x") instanceof Error,
       "native error hierarchy");
    ok(Symbol.iterator !== undefined && typeof [][Symbol.iterator] === "function" &&
       typeof Symbol.asyncIterator === "symbol", "well-known symbols");
    ok(parseInt("ff", 16) === 255 && parseFloat("1.5e3") === 1500 &&
       encodeURIComponent("a b&c") === "a%20b%26c" && decodeURI("%41") === "A",
       "global functions");
}

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
if (fail > 0) std.exit(1);
