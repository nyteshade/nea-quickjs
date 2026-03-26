/* amiga_test.js — Amiga port test suite
 *
 * Run: qjs --std amiga/tests/amiga_test.js
 *  or: qjs -m amiga/tests/amiga_test.js
 *
 * Tests all SAS/C-specific fixes and known edge cases.
 * Each test prints PASS or FAIL with a description.
 */
import * as std from "qjs:std";
import * as os from "qjs:os";

var pass = 0, fail = 0;

function test(desc, got, expected) {
    if (got === expected) {
        pass++;
    } else {
        fail++;
        std.puts("FAIL: " + desc + "\n");
        std.puts("  expected: " + JSON.stringify(expected) + "\n");
        std.puts("  got:      " + JSON.stringify(got) + "\n");
    }
}

function test_approx(desc, got, expected, eps) {
    if (typeof eps === "undefined") eps = 1e-10;
    if (Math.abs(got - expected) < eps) {
        pass++;
    } else {
        fail++;
        std.puts("FAIL: " + desc + "\n");
        std.puts("  expected: " + expected + "\n");
        std.puts("  got:      " + got + "\n");
    }
}

function section(name) {
    std.puts("\n--- " + name + " ---\n");
}

/* ================================================================
 * Bug 4 / Bug 13: INT32_MIN and integer arithmetic
 * ================================================================ */
section("Integer arithmetic (Bug 4, 13)");

test("100 + 110 = 210", 100 + 110, 210);
test("typeof(1+1) is number", typeof(1+1), "number");
test("1 + 1 = 2", 1 + 1, 2);
test("-1 + 1 = 0", -1 + 1, 0);
test("2147483647 + 0", 2147483647 + 0, 2147483647);
test("0 - 1 = -1", 0 - 1, -1);
test("10 * 20 = 200", 10 * 20, 200);

/* ================================================================
 * Bug 14: toString for integers
 * ================================================================ */
section("Integer toString (Bug 14)");

test("(5).toString()", (5).toString(), "5");
test("(0).toString()", (0).toString(), "0");
test("(-1).toString()", (-1).toString(), "-1");
test("(255).toString(16)", (255).toString(16), "ff");
test("(1000000).toString()", (1000000).toString(), "1000000");

/* ================================================================
 * Bug 1 / Bug 6: Float formatting (dtoa)
 * ================================================================ */
section("Float formatting (Bug 1, 6)");

test("String(210)", String(210), "210");
test("String(3.14) has digits", String(3.14).indexOf("3.14") === 0, true);
test("String(0) = '0'", String(0), "0");
test("String(-0) = '0'", String(-0), "0");
test("String(Infinity)", String(Infinity), "Infinity");
test("String(-Infinity)", String(-Infinity), "-Infinity");
test("String(NaN)", String(NaN), "NaN");
test("(1.5).toFixed(1)", (1.5).toFixed(1), "1.5");
test("(1.5).toFixed(3)", (1.5).toFixed(3), "1.500");
test("(100).toExponential(2)", (100).toExponential(2), "1.00e+2");

/* ================================================================
 * Bug 4: MAX_SAFE_INTEGER / array operations
 * ================================================================ */
section("Arrays and MAX_SAFE_INTEGER (Bug 4)");

test("JSON.stringify([1,2,3])", JSON.stringify([1,2,3]), "[1,2,3]");
test("[1,2,3].length", [1,2,3].length, 3);
test("Array.from({length:3}, (_,i)=>i)", JSON.stringify(Array.from({length:3}, (_,i)=>i)), "[0,1,2]");
test("new Uint8Array(4).length", new Uint8Array(4).length, 4);

/* ================================================================
 * Math functions (amiga_compat.c implementations)
 * ================================================================ */
section("Math functions");

test_approx("Math.sqrt(2)", Math.sqrt(2), 1.4142135623730951);
test_approx("Math.sqrt(4)", Math.sqrt(4), 2.0);
test_approx("Math.PI", Math.PI, 3.141592653589793);
test_approx("Math.E", Math.E, 2.718281828459045);
test_approx("Math.sin(0)", Math.sin(0), 0);
test_approx("Math.cos(0)", Math.cos(0), 1);
test_approx("Math.sin(Math.PI/2)", Math.sin(Math.PI/2), 1);
test_approx("Math.exp(1)", Math.exp(1), Math.E);
test_approx("Math.log(Math.E)", Math.log(Math.E), 1);
test_approx("Math.pow(2, 10)", Math.pow(2, 10), 1024);
test_approx("Math.atan2(1, 1)", Math.atan2(1, 1), Math.PI/4);
test("Math.floor(3.7)", Math.floor(3.7), 3);
test("Math.ceil(3.2)", Math.ceil(3.2), 4);
test("Math.round(3.5)", Math.round(3.5), 4);
test("Math.abs(-42)", Math.abs(-42), 42);
test("Math.max(1,2,3)", Math.max(1,2,3), 3);
test("Math.min(1,2,3)", Math.min(1,2,3), 1);
test("isNaN(NaN)", isNaN(NaN), true);
test("isFinite(42)", isFinite(42), true);
test("isFinite(Infinity)", isFinite(Infinity), false);

/* ================================================================
 * String operations (substring clamping, etc.)
 * ================================================================ */
section("String operations (Bug 11)");

test("'hello'.substring(0,3)", "hello".substring(0,3), "hel");
test("'hello'.substring(2)", "hello".substring(2), "llo");
test("'hello'.substring(0,0)", "hello".substring(0,0), "");
test("'hello'.charAt(1)", "hello".charAt(1), "e");
test("'hello'.indexOf('ll')", "hello".indexOf("ll"), 2);
test("'hello'.slice(-2)", "hello".slice(-2), "lo");

/* ================================================================
 * Object display (JS_PrintValue)
 * ================================================================ */
section("Object display (JS_PrintValue)");

var buf = "";
function capture(v) {
    /* Use print to capture — it goes to stdout */
    var old = std.out;
    /* Can't easily capture print output, just verify no crash */
    print(v);
    return true;
}

test("print({x:1}) no crash", capture({x:1}), true);
test("print([1,2,3]) no crash", capture([1,2,3]), true);
test("print(null) no crash", capture(null), true);
test("print(undefined) no crash", capture(undefined), true);
test("print(42) no crash", capture(42), true);
test("print('hello') no crash", capture("hello"), true);
test("print(true) no crash", capture(true), true);
test("print({}) no crash", capture({}), true);

/* ================================================================
 * JSON
 * ================================================================ */
section("JSON");

test("JSON.parse('{\"a\":1}').a", JSON.parse('{"a":1}').a, 1);
test("JSON.stringify({a:1})", JSON.stringify({a:1}), '{"a":1}');
test("JSON.stringify(null)", JSON.stringify(null), "null");
test("JSON.stringify([1,'two',null])", JSON.stringify([1,"two",null]), '[1,"two",null]');

/* ================================================================
 * Promises / async (basic)
 * ================================================================ */
section("Promises");

var promise_ok = false;
Promise.resolve(42).then(v => { promise_ok = (v === 42); });
/* Force microtask processing */
std.gc();
test("Promise.resolve(42)", promise_ok, true);

/* ================================================================
 * Module imports
 * ================================================================ */
section("Modules");

test("std is defined", typeof std, "object");
test("os is defined", typeof os, "object");
test("std.puts is function", typeof std.puts, "function");
test("os.platform is string", typeof os.platform, "string");

/* ================================================================
 * Amiga-specific
 * ================================================================ */
section("Amiga-specific");

test("NO_COLOR = '1'", std.getenv("NO_COLOR"), "1");

/* ================================================================
 * Results
 * ================================================================ */
std.puts("\n==============================\n");
std.puts("Results: " + pass + " passed, " + fail + " failed\n");
if (fail === 0)
    std.puts("ALL TESTS PASSED\n");
else
    std.puts("SOME TESTS FAILED\n");
std.puts("==============================\n");
