/*
 * test_regex.js -- Smoke test for regex on Amiga.
 *
 * Previously hung on any regex literal at library 0.087 and earlier
 * (VBCC optimizer miscompiled lre_compile / lre_exec_backtrack /
 * re_parse_char_class at -O1). Fixed at 0.089 by building libregexp.c
 * at -O0. This test covers the cases that historically hung.
 *
 * Run with: qjs tests/test_regex.js
 */

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== Regex smoke test ===");

// 1. Trivial literals
try {
    ok(/a/.test("abc"),  "/a/ matches abc");
    ok(!/a/.test("xyz"), "/a/ doesn't match xyz");
} catch (e) { print("  FAIL: /a/ threw " + e); fail++; }

// 2. The infamous single-char escape — /\+/g — hung the URLSearchParams ctor
try {
    ok("a+b+c".replace(/\+/g, "-") === "a-b-c", "/\\+/g replace");
    ok("100%20words".replace(/%20/g, " ") === "100 words", "/%20/g replace");
} catch (e) { print("  FAIL: simple replace threw " + e); fail++; }

// 3. Char class with `/` — hung URL._parse
try {
    const r = /[/?#]/;
    ok(r.test("a/b"),  "/[\\/?#]/ matches a/b");
    ok(r.test("a?b"),  "/[\\/?#]/ matches a?b");
    ok(!r.test("abc"), "/[\\/?#]/ doesn't match abc");
} catch (e) { print("  FAIL: char class with / threw " + e); fail++; }

// 4. Buffer's char class with $ and + mixed
try {
    const r = /[^A-Za-z0-9+/=]/g;
    ok("abcDEF123+/=xyz".replace(r, "") === "abcDEF123+/=xyz", "base64 clean regex");
    ok("  foo  ".replace(r, "") === "foo", "base64 clean strips spaces");
} catch (e) { print("  FAIL: base64-clean regex threw " + e); fail++; }

// 5. util isSafeIdent pattern — anchor + char class
try {
    ok(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test("validName"), "isSafeIdent accepts validName");
    ok(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test("_foo"),      "isSafeIdent accepts _foo");
    ok(!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test("1bad"),     "isSafeIdent rejects 1bad");
} catch (e) { print("  FAIL: isSafeIdent pattern threw " + e); fail++; }

// 6. URL scheme pattern — compound char class with escape
try {
    const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):(.*)$/.exec("https://example.com");
    ok(m && m[1] === "https", "URL scheme extractor");
    ok(m && m[2] === "//example.com", "URL scheme tail");
} catch (e) { print("  FAIL: URL scheme pattern threw " + e); fail++; }

// 7. Anchors
try {
    ok(/^hello/.test("hello world"),  "^ anchor");
    ok(/world$/.test("hello world"),  "$ anchor");
    ok(!/^world/.test("hello world"), "^ anchor negative");
} catch (e) { print("  FAIL: anchors threw " + e); fail++; }

// 8. Capture groups
try {
    const m = "abc123".match(/([a-z]+)(\d+)/);
    ok(m && m[1] === "abc" && m[2] === "123", "capture groups");
} catch (e) { print("  FAIL: captures threw " + e); fail++; }

// 9. Quantifiers
try {
    ok(/a+/.test("aaa"),    "a+ matches aaa");
    ok(!/a+/.test(""),      "a+ doesn't match empty");
    ok(/a*/.test(""),       "a* matches empty");
    ok(/a{2,4}/.test("aa"), "a{2,4} matches aa");
    ok(!/a{5}/.test("aaa"), "a{5} doesn't match aaa");
} catch (e) { print("  FAIL: quantifiers threw " + e); fail++; }

// 10. Alternation
try {
    ok(/cat|dog/.test("I have a cat"), "alternation cat");
    ok(/cat|dog/.test("I have a dog"), "alternation dog");
    ok(!/cat|dog/.test("I have a bird"), "alternation neither");
} catch (e) { print("  FAIL: alternation threw " + e); fail++; }

// 11. RegExp constructor (runtime compilation)
try {
    const r = new RegExp("\\d+", "g");
    ok("abc123def456".replace(r, "#") === "abc#def#", "new RegExp('\\d+', 'g')");
} catch (e) { print("  FAIL: RegExp constructor threw " + e); fail++; }

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
if (fail > 0) std.exit(1);
