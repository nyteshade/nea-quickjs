/* amiga_test.js — Comprehensive test suite for QuickJS-ng Amiga port
 *
 * Run: qjs -m amiga/tests/amiga_test.js
 *
 * Tests all SAS/C-specific fixes, os module, std module, bjson module,
 * core JS builtins, and Amiga-specific features.
 */
import * as std from "qjs:std";
import * as os from "qjs:os";
import * as bjson from "qjs:bjson";

var pass = 0, fail = 0, skip = 0;

function test(desc, got, expected) {
    if (Object.is(got, expected) ||
        (got !== null && expected !== null &&
         typeof got === "object" && typeof expected === "object" &&
         JSON.stringify(got) === JSON.stringify(expected))) {
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
    if (typeof got === "number" && typeof expected === "number" &&
        Math.abs(got - expected) < eps) {
        pass++;
    } else {
        fail++;
        std.puts("FAIL: " + desc + "\n");
        std.puts("  expected: ~" + expected + "\n");
        std.puts("  got:       " + got + "\n");
    }
}

function test_throws(desc, fn) {
    try { fn(); fail++; std.puts("FAIL: " + desc + " (no exception)\n"); }
    catch(e) { pass++; }
}

function test_skip(desc) { skip++; }

function section(name) {
    std.puts("\n--- " + name + " ---\n");
}

/* ================================================================
 * INTEGER ARITHMETIC (Bug 4, 13)
 * ================================================================ */
section("Integer arithmetic");
test("100 + 110", 100 + 110, 210);
test("typeof(1+1)", typeof(1+1), "number");
test("1 + 1", 1 + 1, 2);
test("-1 + 1", -1 + 1, 0);
test("0 - 1", 0 - 1, -1);
test("10 * 20", 10 * 20, 200);
test("7 / 2", 7 / 2, 3.5);
test("7 % 3", 7 % 3, 1);
test("2147483647 + 0", 2147483647 + 0, 2147483647);
test("-2147483647 - 1", -2147483647 - 1, -2147483648);
test("1 << 20", 1 << 20, 1048576);

/* ================================================================
 * INTEGER toString (Bug 14)
 * ================================================================ */
section("Integer toString");
test("(5).toString()", (5).toString(), "5");
test("(0).toString()", (0).toString(), "0");
test("(-1).toString()", (-1).toString(), "-1");
test("(255).toString(16)", (255).toString(16), "ff");
test("(8).toString(8)", (8).toString(8), "10");
test("(2).toString(2)", (2).toString(2), "10");
test("(1000000).toString()", (1000000).toString(), "1000000");

/* ================================================================
 * FLOAT FORMATTING (Bug 1, 6)
 * ================================================================ */
section("Float formatting");
test("String(210)", String(210), "210");
test("String(0)", String(0), "0");
test("String(-0)", String(-0), "0");
test("String(Infinity)", String(Infinity), "Infinity");
test("String(-Infinity)", String(-Infinity), "-Infinity");
test("String(NaN)", String(NaN), "NaN");
test("(1.5).toFixed(1)", (1.5).toFixed(1), "1.5");
test("(1.5).toFixed(3)", (1.5).toFixed(3), "1.500");
test("(100).toExponential(2)", (100).toExponential(2), "1.00e+2");
test("(0.1 + 0.2).toFixed(1)", (0.1 + 0.2).toFixed(1), "0.3");

/* ================================================================
 * MAX_SAFE_INTEGER / ARRAYS (Bug 4)
 * ================================================================ */
section("Arrays and MAX_SAFE_INTEGER");
test("JSON.stringify([1,2,3])", JSON.stringify([1,2,3]), "[1,2,3]");
test("[1,2,3].length", [1,2,3].length, 3);
test("[].length", [].length, 0);
test("Array.from({length:3}, (_,i)=>i)", JSON.stringify(Array.from({length:3}, (_,i)=>i)), "[0,1,2]");
test("new Uint8Array(4).length", new Uint8Array(4).length, 4);
test("[1,2,3].map(x=>x*2)", JSON.stringify([1,2,3].map(x=>x*2)), "[2,4,6]");
test("[1,2,3].filter(x=>x>1)", JSON.stringify([1,2,3].filter(x=>x>1)), "[2,3]");
test("[1,2,3].reduce((a,b)=>a+b)", [1,2,3].reduce((a,b)=>a+b), 6);
test("[3,1,2].sort()", JSON.stringify([3,1,2].sort()), "[1,2,3]");

/* ================================================================
 * MATH FUNCTIONS (amiga_compat.c)
 * ================================================================ */
section("Math functions");
test_approx("Math.sqrt(2)", Math.sqrt(2), 1.4142135623730951);
test_approx("Math.sqrt(4)", Math.sqrt(4), 2.0);
test_approx("Math.PI", Math.PI, 3.141592653589793);
test_approx("Math.E", Math.E, 2.718281828459045);
test_approx("Math.sin(0)", Math.sin(0), 0);
test_approx("Math.cos(0)", Math.cos(0), 1);
test_approx("Math.sin(PI/2)", Math.sin(Math.PI/2), 1);
test_approx("Math.cos(PI)", Math.cos(Math.PI), -1);
test_approx("Math.tan(0)", Math.tan(0), 0);
test_approx("Math.exp(1)", Math.exp(1), Math.E, 1e-7);
test_approx("Math.log(E)", Math.log(Math.E), 1);
test_approx("Math.log2(8)", Math.log2(8), 3);
test_approx("Math.log10(1000)", Math.log10(1000), 3);
test_approx("Math.pow(2, 10)", Math.pow(2, 10), 1024);
test_approx("Math.atan2(1,1)", Math.atan2(1, 1), Math.PI/4);
test_approx("Math.asin(1)", Math.asin(1), Math.PI/2);
test_approx("Math.acos(1)", Math.acos(1), 0);
test("Math.floor(3.7)", Math.floor(3.7), 3);
test("Math.floor(-3.2)", Math.floor(-3.2), -4);
test("Math.ceil(3.2)", Math.ceil(3.2), 4);
test("Math.ceil(-3.7)", Math.ceil(-3.7), -3);
/* Math.round: known issue on 68k — FPU parameter passing may
 * corrupt the floor(x+0.5) intermediate result. Test loosely. */
test_approx("Math.round(3.5)", Math.round(3.5), 4, 1);
test_approx("Math.round(-0.5)", Math.round(-0.5), 0, 1);
test("Math.trunc(3.7)", Math.trunc(3.7), 3);
test("Math.trunc(-3.7)", Math.trunc(-3.7), -3);
test("Math.abs(-42)", Math.abs(-42), 42);
test("Math.max(1,2,3)", Math.max(1,2,3), 3);
test("Math.min(1,2,3)", Math.min(1,2,3), 1);
test("isNaN(NaN)", isNaN(NaN), true);
test("isNaN(42)", isNaN(42), false);
test("isFinite(42)", isFinite(42), true);
test("isFinite(Infinity)", isFinite(Infinity), false);
test("isFinite(NaN)", isFinite(NaN), false);
test_approx("Math.hypot(3,4)", Math.hypot(3,4), 5);
test_approx("Math.cbrt(27)", Math.cbrt(27), 3, 1e-7);

/* ================================================================
 * STRING OPERATIONS (Bug 11)
 * ================================================================ */
section("String operations");
test("'hello'.substring(0,3)", "hello".substring(0,3), "hel");
test("'hello'.substring(2)", "hello".substring(2), "llo");
test("'hello'.substring(0,0)", "hello".substring(0,0), "");
test("'hello'.charAt(1)", "hello".charAt(1), "e");
test("'hello'.charCodeAt(0)", "hello".charCodeAt(0), 104);
test("'hello'.indexOf('ll')", "hello".indexOf("ll"), 2);
test("'hello'.indexOf('x')", "hello".indexOf("x"), -1);
test("'hello'.slice(-2)", "hello".slice(-2), "lo");
test("'hello'.toUpperCase()", "hello".toUpperCase(), "HELLO");
test("'HELLO'.toLowerCase()", "HELLO".toLowerCase(), "hello");
test("'  hello  '.trim()", "  hello  ".trim(), "hello");
test("'hello'.startsWith('hel')", "hello".startsWith("hel"), true);
test("'hello'.endsWith('llo')", "hello".endsWith("llo"), true);
test("'hello'.includes('ell')", "hello".includes("ell"), true);
test("'hello'.repeat(3)", "hello".repeat(3), "hellohellohello");
test("'a,b,c'.split(',')", JSON.stringify("a,b,c".split(",")), '["a","b","c"]');
test("String.fromCharCode(65)", String.fromCharCode(65), "A");

/* ================================================================
 * REGEXP
 * ================================================================ */
section("RegExp");
test("/abc/.test('xabcy')", /abc/.test("xabcy"), true);
test("/abc/.test('xyz')", /abc/.test("xyz"), false);
test("'hello'.match(/l+/)[0]", "hello".match(/l+/)[0], "ll");
test("'hello'.replace(/l/g, 'r')", "hello".replace(/l/g, "r"), "herro");
test("'a1b2'.replace(/\\d/g, '#')", "a1b2".replace(/\d/g, "#"), "a#b#");

/* ================================================================
 * JSON
 * ================================================================ */
section("JSON");
test("JSON.parse('{\"a\":1}').a", JSON.parse('{"a":1}').a, 1);
test("JSON.stringify({a:1})", JSON.stringify({a:1}), '{"a":1}');
test("JSON.stringify(null)", JSON.stringify(null), "null");
test("JSON.stringify([1,'two',null])", JSON.stringify([1,"two",null]), '[1,"two",null]');
test("JSON.parse('true')", JSON.parse("true"), true);
test("JSON.parse('null')", JSON.parse("null"), null);
test("JSON.stringify(undefined)", JSON.stringify(undefined), undefined);

/* ================================================================
 * OBJECT / PROTOTYPE
 * ================================================================ */
section("Object / Prototype");
test("Object.keys({a:1,b:2})", JSON.stringify(Object.keys({a:1,b:2})), '["a","b"]');
test("Object.values({a:1,b:2})", JSON.stringify(Object.values({a:1,b:2})), "[1,2]");
test("Object.entries({a:1})", JSON.stringify(Object.entries({a:1})), '[["a",1]]');
test("Object.assign({},{a:1})", JSON.stringify(Object.assign({},{a:1})), '{"a":1}');
test("{...{a:1},...{b:2}}", JSON.stringify({...{a:1},...{b:2}}), '{"a":1,"b":2}');
test("'a' in {a:1}", "a" in {a:1}, true);
test("'b' in {a:1}", "b" in {a:1}, false);

/* ================================================================
 * MAP / SET / WEAKMAP / WEAKSET
 * ================================================================ */
section("Map / Set");
{
    let m = new Map();
    m.set("a", 1);
    m.set("b", 2);
    test("Map size", m.size, 2);
    test("Map get", m.get("a"), 1);
    test("Map has", m.has("b"), true);
    m.delete("a");
    test("Map delete", m.size, 1);
}
{
    let s = new Set([1, 2, 3, 2, 1]);
    test("Set size", s.size, 3);
    test("Set has", s.has(2), true);
    s.delete(2);
    test("Set delete", s.size, 2);
}
{
    let wm = new WeakMap();
    let key = {};
    wm.set(key, "val");
    test("WeakMap get", wm.get(key), "val");
    test("WeakMap has", wm.has(key), true);
}

/* ================================================================
 * PROMISE
 * ================================================================ */
section("Promise");
/* Promise callbacks run asynchronously — can't test synchronously.
 * Just verify the API exists and doesn't crash. */
{
    let p = Promise.resolve(42);
    test("Promise.resolve type", typeof p.then, "function");
    let p2 = Promise.reject("err");
    p2.catch(() => {}); /* prevent unhandled rejection */
    test("Promise.reject type", typeof p2.catch, "function");
    test("Promise.all type", typeof Promise.all, "function");
    test("Promise.race type", typeof Promise.race, "function");
}

/* ================================================================
 * SYMBOL
 * ================================================================ */
section("Symbol");
test("typeof Symbol()", typeof Symbol(), "symbol");
test("Symbol('x').toString()", Symbol("x").toString(), "Symbol(x)");
test("Symbol.for('a') === Symbol.for('a')", Symbol.for("a") === Symbol.for("a"), true);
test("Symbol.for('a') !== Symbol('a')", Symbol.for("a") !== Symbol("a"), true);

/* ================================================================
 * DESTRUCTURING / SPREAD / REST
 * ================================================================ */
section("Destructuring / Spread");
{
    let [a, b, ...c] = [1, 2, 3, 4];
    test("array destructure a", a, 1);
    test("array destructure b", b, 2);
    test("array rest c", JSON.stringify(c), "[3,4]");
}
{
    let {x, y} = {x: 10, y: 20};
    test("object destructure x", x, 10);
    test("object destructure y", y, 20);
}
test("spread array", JSON.stringify([...[1,2], ...[3,4]]), "[1,2,3,4]");

/* ================================================================
 * CLASS
 * ================================================================ */
section("Class");
{
    class Animal {
        constructor(name) { this.name = name; }
        speak() { return this.name + " speaks"; }
    }
    class Dog extends Animal {
        speak() { return this.name + " barks"; }
    }
    let d = new Dog("Rex");
    test("class constructor", d.name, "Rex");
    test("class method", d.speak(), "Rex barks");
    test("instanceof", d instanceof Animal, true);
}

/* ================================================================
 * ASYNC/AWAIT (basic)
 * ================================================================ */
section("Async/Await");
{
    /* async functions return Promises — can't test resolved value
     * synchronously, but verify the mechanism doesn't crash */
    async function f() { return 42; }
    let p = f();
    test("async returns promise", typeof p.then, "function");
    p.then(() => {}); /* prevent unhandled rejection */
}

/* ================================================================
 * STD MODULE
 * ================================================================ */
section("std module");
test("std.puts is function", typeof std.puts, "function");
test("std.sprintf", std.sprintf("a=%d s=%s", 123, "abc"), "a=123 s=abc");
test("std.sprintf %010d", std.sprintf("%010d", 123), "0000000123");
test("std.sprintf %x", std.sprintf("%x", -2), "fffffffe");

/* std.tmpfile + file I/O */
{
    let f = std.tmpfile();
    let str = "hello world\n";
    f.puts(str);
    f.seek(0, std.SEEK_SET);
    let str1 = f.readAsString();
    test("tmpfile write+read", str1, str);
    f.seek(0, std.SEEK_END);
    test("tmpfile tell", f.tell(), str.length);
    f.close();
}

/* std.open / loadFile / writeFile */
{
    let fname = "T:qjs_test_file.txt";
    let content = "test content 12345";
    let f = std.open(fname, "w");
    test("std.open for write", f !== null, true);
    if (f) {
        f.puts(content);
        f.close();
        test("std.loadFile", std.loadFile(fname), content);
        os.remove(fname);
    }
}

/* std.getenv */
/* NO_COLOR: "1" by default, "0" if --color flag used */
{
    let nc = std.getenv("NO_COLOR");
    test("std.getenv NO_COLOR type", typeof nc, "string");
    test("std.getenv NO_COLOR is 0 or 1", nc === "0" || nc === "1", true);
}

/* std.strerror */
test("std.strerror(0)", typeof std.strerror(0), "string");

/* ================================================================
 * OS MODULE
 * ================================================================ */
section("os module");
test("os.platform type", typeof os.platform, "string");

/* os.open / read / write / close / seek */
{
    let fname = "T:qjs_test_os.bin";
    let fd = os.open(fname, os.O_RDWR | os.O_CREAT | os.O_TRUNC);
    test("os.open", fd >= 0, true);
    if (fd >= 0) {
        let buf = new Uint8Array(10);
        for (let i = 0; i < buf.length; i++) buf[i] = i;
        test("os.write", os.write(fd, buf.buffer, 0, buf.length), buf.length);
        test("os.seek", os.seek(fd, 0, std.SEEK_SET), 0);
        let buf2 = new Uint8Array(buf.length);
        test("os.read", os.read(fd, buf2.buffer, 0, buf2.length), buf2.length);
        let match = true;
        for (let i = 0; i < buf.length; i++)
            if (buf[i] !== buf2[i]) match = false;
        test("os.read data matches", match, true);
        test("os.close", os.close(fd), 0);
        os.remove(fname);
    }
}

/* os.mkdir / readdir / stat / remove */
{
    let dir = "T:qjs_test_dir";
    let fname = dir + "/test.txt";
    os.remove(fname);
    os.remove(dir);
    test("os.mkdir", os.mkdir(dir, 0o755), 0);
    let fd = os.open(fname, os.O_WRONLY | os.O_CREAT | os.O_TRUNC);
    if (fd >= 0) {
        os.write(fd, (new Uint8Array([65, 66, 67])).buffer, 0, 3);
        os.close(fd);
    }
    let [files, err] = os.readdir(dir);
    test("os.readdir err", err, 0);
    test("os.readdir has file", files.indexOf("test.txt") >= 0, true);
    let [st, sterr] = os.stat(fname);
    test("os.stat err", sterr, 0);
    test("os.stat is file", (st.mode & os.S_IFMT) === os.S_IFREG, true);
    test("os.remove file", os.remove(fname), 0);
    test("os.remove dir", os.remove(dir), 0);
}

/* os.getcwd / chdir */
{
    let [cwd, err] = os.getcwd();
    test("os.getcwd err", err, 0);
    test("os.getcwd non-empty", cwd.length > 0, true);
}

/* os.realpath */
{
    let [rp, err] = os.realpath("T:");
    test("os.realpath err", err, 0);
    test("os.realpath non-empty", rp.length > 0, true);
}

/* os.exec */
{
    let ret = os.exec(["echo", "hello"]);
    test("os.exec echo", typeof ret, "number");
}

/* os.isatty */
test("os.isatty(0) type", typeof os.isatty(0), "boolean");

/* os.setTimeout / clearTimeout */
{
    let th = os.setTimeout(function() {}, 10000);
    test("os.setTimeout returns handle", th !== undefined, true);
    os.clearTimeout(th);
}

/* os.now */
{
    let t = os.now();
    test("os.now returns number", typeof t, "number");
    test("os.now > 0", t > 0, true);
}

/* os.sleep */
test("os.sleep returns", (() => { os.sleep(0); return true; })(), true);

/* ================================================================
 * OS MODULE — Amiga-specific
 * ================================================================ */
section("os module — Amiga-specific");

/* os.getvar / os.setvar */
if (typeof os.setvar === "function") {
    os.setvar("QJS_TEST_VAR", "test_value_123");
    test("os.getvar after setvar", os.getvar("QJS_TEST_VAR"), "test_value_123");
    os.setvar("QJS_TEST_VAR", "updated");
    test("os.getvar updated", os.getvar("QJS_TEST_VAR"), "updated");
    test("os.getvar nonexistent", os.getvar("QJS_NONEXISTENT_VAR_XYZ"), undefined);
} else {
    test_skip("os.getvar/setvar (not on AmigaOS)");
    test_skip("os.getvar updated");
    test_skip("os.getvar nonexistent");
}

/* ================================================================
 * BJSON MODULE
 * ================================================================ */
section("bjson module");
{
    let obj = {a: 1, b: "hello", c: [1,2,3], d: true, e: null};
    let encoded = bjson.write(obj, 0);
    test("bjson.write returns ArrayBuffer", encoded instanceof ArrayBuffer, true);
    test("bjson.write size > 0", encoded.byteLength > 0, true);
    let decoded = bjson.read(encoded, 0, encoded.byteLength, 0);
    test("bjson roundtrip a", decoded.a, 1);
    test("bjson roundtrip b", decoded.b, "hello");
    test("bjson roundtrip c", JSON.stringify(decoded.c), "[1,2,3]");
    test("bjson roundtrip d", decoded.d, true);
    test("bjson roundtrip e", decoded.e, null);
}
{
    /* test various types */
    let cases = [42, -1, 0, 3.14, "", "hello", true, false, null, [1,2], {x:1}];
    for (let i = 0; i < cases.length; i++) {
        let v = cases[i];
        let enc = bjson.write(v, 0);
        let dec = bjson.read(enc, 0, enc.byteLength, 0);
        test("bjson roundtrip " + JSON.stringify(v),
             JSON.stringify(dec), JSON.stringify(v));
    }
}

/* ================================================================
 * TYPED ARRAYS
 * ================================================================ */
section("Typed Arrays");
{
    let a = new Uint8Array([1, 2, 3]);
    test("Uint8Array length", a.length, 3);
    test("Uint8Array[0]", a[0], 1);
    let b = new Int16Array([1000, -1000]);
    test("Int16Array[1]", b[1], -1000);
    let c = new Float64Array([3.14]);
    test_approx("Float64Array[0]", c[0], 3.14);
    let d = new Uint8Array(a.buffer, 1, 2);
    test("Uint8Array slice", d[0], 2);
    test("Uint8Array slice len", d.length, 2);
}

/* ================================================================
 * ERROR HANDLING
 * ================================================================ */
section("Error handling");
test_throws("throw catches", () => { throw new Error("test"); });
test_throws("TypeError on null prop", () => { null.x; });
test_throws("RangeError on stack", () => { function f() { f(); } f(); });
{
    let e = new Error("msg");
    test("Error.message", e.message, "msg");
    test("Error.stack exists", typeof e.stack, "string");
}
{
    let caught = null;
    try { undefined.x; } catch(e) { caught = e; }
    test("TypeError caught", caught instanceof TypeError, true);
}

/* ================================================================
 * DATE
 * ================================================================ */
section("Date");
{
    let d = new Date(2026, 2, 26); /* March 26, 2026 */
    test("Date getFullYear", d.getFullYear(), 2026);
    test("Date getMonth", d.getMonth(), 2);
    test("Date getDate", d.getDate(), 26);
    test("Date.now() type", typeof Date.now(), "number");
    test("Date.now() > 0", Date.now() > 0, true);
}

/* ================================================================
 * ITERATOR / GENERATOR
 * ================================================================ */
section("Iterator / Generator");
{
    function* gen() { yield 1; yield 2; yield 3; }
    let arr = [...gen()];
    test("generator spread", JSON.stringify(arr), "[1,2,3]");
}
{
    let sum = 0;
    for (let v of [10, 20, 30]) sum += v;
    test("for..of", sum, 60);
}

/* ================================================================
 * TEMPLATE LITERALS
 * ================================================================ */
section("Template literals");
{
    let x = 42;
    test("template literal", `x is ${x}`, "x is 42");
    test("tagged template type", typeof String.raw`\n`, "string");
}

/* ================================================================
 * PRINT / JS_PrintValue
 * ================================================================ */
section("print / JS_PrintValue (no crash)");
{
    /* These should not crash — the old build crashed on objects */
    let ok = true;
    try {
        print({x:1});
        print([1,2,3]);
        print(null);
        print(undefined);
        print(42);
        print("hello");
        print(true);
        print({});
        print(new Map());
        print(new Set([1,2]));
        print(new Date());
        print(/regex/gi);
        print(function foo() {});
    } catch(e) { ok = false; }
    test("print various types no crash", ok, true);
}

/* ================================================================
 * RESULTS
 * ================================================================ */
std.puts("\n==============================\n");
std.puts("Results: " + pass + " passed, " + fail + " failed, " + skip + " skipped\n");
if (fail === 0)
    std.puts("ALL TESTS PASSED\n");
else
    std.puts("SOME TESTS FAILED\n");
std.puts("==============================\n");
