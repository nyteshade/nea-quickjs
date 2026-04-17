/*
 * test_fetch.js -- Test the async fetch() API
 *
 * Run with: qjs -m test_fetch.js
 * Requires: TCP/IP stack running (Roadshow, AmiTCP, or similar)
 *
 * Uses httpbin.org for testing HTTP methods and responses.
 */

import * as std from 'qjs:std';

/* ----------------------------------------------------------------
 * Self-captured output.
 *
 * Shell `>` redirection breaks on Amiga when fetch opens AmiSSL in
 * a worker — the parent CLI's pr_COS (output file handle) gets
 * clobbered partway through, and subsequent `print` calls land on
 * the console instead of the redirected file. Root cause is inside
 * AmiSSL and not yet diagnosed (see docs/AMISSL_MAINTASK_BUG.md for
 * the related main-task issue).
 *
 * Workaround: open our own output/test_fetch.output via std.open
 * BEFORE any fetch runs, tee every print into it, flush aggressively.
 * Callers should run `qjs tests/test_fetch.js` with no shell `>`.
 * -------------------------------------------------------------- */
const _logFile = (() => {
    try { return std.open('output/test_fetch.output', 'wb'); }
    catch (_) { return null; }
})();

const _origPrint = globalThis.print;
globalThis.print = function (...args) {
    const line = args.map(String).join(' ');
    _origPrint(line);
    if (_logFile) {
        _logFile.puts(line);
        _logFile.puts('\n');
        _logFile.flush();
    }
};

function _closeLog() {
    if (_logFile) { try { _logFile.close(); } catch (_) {} }
}

let pass = 0, fail = 0;

function assert(cond, msg) {
    if (cond) {
        print("  PASS: " + msg);
        pass++;
    } else {
        print("  FAIL: " + msg);
        fail++;
    }
}

async function test_basic_get() {
    print("\n--- Test: Basic HTTP GET ---");
    try {
        const response = await fetch("http://httpbin.org/get");
        assert(response instanceof Object, "response is object");
        assert(response.status === 200, "status is 200, got " + response.status);
        assert(response.ok === true, "ok is true");
        assert(typeof response.statusText === "string", "statusText is string");
        assert(response.url === "http://httpbin.org/get", "url matches");

        const text = await response.text();
        assert(typeof text === "string", "text() returns string");
        assert(text.length > 0, "text() is non-empty (got " + text.length + " chars)");

        print("  Response body (first 100 chars): " + text.substring(0, 100));
    } catch (e) {
        print("  FAIL: Exception: " + e.message);
        fail++;
    }
}

async function test_json_response() {
    print("\n--- Test: JSON response ---");
    try {
        const response = await fetch("http://httpbin.org/json");
        assert(response.status === 200, "status is 200");

        const data = await response.json();
        assert(typeof data === "object", "json() returns object");
        assert(data !== null, "json() is not null");
        print("  JSON keys: " + Object.keys(data).join(", "));
    } catch (e) {
        print("  FAIL: Exception: " + e.message);
        fail++;
    }
}

async function test_headers() {
    print("\n--- Test: Response headers ---");
    try {
        const response = await fetch("http://httpbin.org/get");
        const headers = response.headers;
        assert(headers !== null && headers !== undefined, "headers object exists");

        const ct = headers.get("content-type");
        assert(ct !== null, "content-type header exists");
        if (ct) print("  Content-Type: " + ct);

        assert(headers.has("content-type") === true, "has('content-type') is true");
        assert(headers.has("x-nonexistent") === false, "has('x-nonexistent') is false");
    } catch (e) {
        print("  FAIL: Exception: " + e.message);
        fail++;
    }
}

async function test_404() {
    print("\n--- Test: 404 response ---");
    try {
        const response = await fetch("http://httpbin.org/status/404");
        assert(response.status === 404, "status is 404, got " + response.status);
        assert(response.ok === false, "ok is false for 404");
    } catch (e) {
        print("  FAIL: Exception: " + e.message);
        fail++;
    }
}

async function test_https() {
    print("\n--- Test: HTTPS GET ---");
    try {
        const response = await fetch("https://httpbin.org/get");
        assert(response.status === 200, "HTTPS status is 200, got " + response.status);
        assert(response.ok === true, "HTTPS ok is true");

        const text = await response.text();
        assert(text.length > 0, "HTTPS response has body (" + text.length + " chars)");
    } catch (e) {
        print("  FAIL: Exception: " + e.message);
        fail++;
    }
}

async function test_arraybuffer() {
    print("\n--- Test: arrayBuffer() ---");
    try {
        const response = await fetch("http://httpbin.org/bytes/16");
        const buf = await response.arrayBuffer();
        assert(buf instanceof ArrayBuffer, "arrayBuffer() returns ArrayBuffer");
        assert(buf.byteLength > 0, "ArrayBuffer has data (" + buf.byteLength + " bytes)");
    } catch (e) {
        print("  FAIL: Exception: " + e.message);
        fail++;
    }
}

async function test_bad_url() {
    print("\n--- Test: Bad URL error ---");
    try {
        await fetch("not-a-url");
        print("  FAIL: Should have thrown");
        fail++;
    } catch (e) {
        assert(true, "Bad URL throws error: " + e.message);
    }
}

async function run_all() {
    print("=== fetch() API Test Suite ===");

    await test_basic_get();
    await test_json_response();
    await test_headers();
    await test_404();
    await test_https();
    await test_arraybuffer();
    await test_bad_url();

    print("\n=== Results: " + pass + " passed, " + fail + " failed ===");
    _closeLog();
    if (fail > 0) std.exit(1);
}

run_all();
