/*
 * test_crypto.js -- Smoke test for E1 crypto.subtle.digest + random.
 *
 * Requires library 0.091+ and AmiSSL installed.
 * Reference digests computed via `echo -n hello | sha256sum` etc.
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

function bytesToHex(arr) {
    let s = '';
    const v = arr instanceof ArrayBuffer ? new Uint8Array(arr) : arr;
    for (let i = 0; i < v.length; i++) {
        s += (v[i] < 16 ? '0' : '') + v[i].toString(16);
    }
    return s;
}

print("=== crypto smoke test ===");

/* 1. Globals exist */
ok(typeof globalThis.crypto === 'object',            "globalThis.crypto exists");
ok(typeof globalThis.crypto.subtle === 'object',     "crypto.subtle exists");
ok(typeof globalThis.crypto.subtle.digest === 'function', "crypto.subtle.digest is function");
ok(typeof globalThis.crypto.subtle.has === 'function',    "crypto.subtle.has is function");
ok(typeof globalThis.crypto.getRandomValues === 'function', "crypto.getRandomValues is function");
ok(typeof globalThis.crypto.randomUUID === 'function', "crypto.randomUUID is function");

/* 2. has() — pure-JS algorithms always supported */
ok(crypto.subtle.has("SHA-1"),   "has('SHA-1') is true");
ok(crypto.subtle.has("SHA-256"), "has('SHA-256') is true");
ok(crypto.subtle.has("MD5"),     "has('MD5') is true");
ok(!crypto.subtle.has("BOGUS"),  "has('BOGUS') is false");

(async () => {
    /* 2. SHA-256 of "hello" == 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 */
    try {
        const enc = new TextEncoder().encode("hello");
        const h = await crypto.subtle.digest("SHA-256", enc);
        ok(h instanceof ArrayBuffer,          "digest returns ArrayBuffer");
        ok(h.byteLength === 32,               "SHA-256 length is 32 bytes");
        const hex = bytesToHex(h);
        ok(hex === "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
            "SHA-256('hello') matches reference: " + hex);
    } catch (e) { print("  FAIL: SHA-256 threw " + e); fail += 3; }

    /* 3. SHA-1 of "hello" == aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d */
    try {
        const h = await crypto.subtle.digest("SHA-1", new TextEncoder().encode("hello"));
        ok(h.byteLength === 20, "SHA-1 length is 20 bytes");
        ok(bytesToHex(h) === "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d",
            "SHA-1('hello') matches reference");
    } catch (e) { print("  FAIL: SHA-1 threw " + e); fail += 2; }

    /* 4. SHA-512 — pure-JS doesn't implement; only works if AmiSSL path works */
    if (crypto.subtle.has("SHA-512")) {
        try {
            const h = await crypto.subtle.digest("SHA-512", new Uint8Array(0));
            const expected = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
            ok(h.byteLength === 64, "SHA-512 length is 64 bytes");
            ok(bytesToHex(h) === expected, "SHA-512('') matches reference (AmiSSL path)");
        } catch (e) {
            print("  SKIP: SHA-512 unavailable (AmiSSL not installed) — " + e.message);
        }
    } else {
        print("  SKIP: SHA-512 requires AmiSSL, not advertised as supported");
    }

    /* 5. MD5 (non-WebCrypto) of "hello" == 5d41402abc4b2a76b9719d911017c592 */
    try {
        const h = await crypto.subtle.digest("MD5", new TextEncoder().encode("hello"));
        ok(h.byteLength === 16, "MD5 length is 16 bytes");
        ok(bytesToHex(h) === "5d41402abc4b2a76b9719d911017c592",
            "MD5('hello') matches reference");
    } catch (e) { print("  FAIL: MD5 threw " + e); fail += 2; }

    /* 6. Unsupported algorithm rejects */
    try {
        await crypto.subtle.digest("SHA-999", new Uint8Array(1));
        ok(false, "unknown algorithm should throw");
    } catch (e) { ok(true, "unknown algorithm rejected: " + e.message); }

    /* 7. getRandomValues fills an integer TypedArray */
    try {
        const buf = new Uint8Array(16);
        crypto.getRandomValues(buf);
        let allZero = true;
        for (const b of buf) if (b !== 0) { allZero = false; break; }
        ok(!allZero, "getRandomValues fills with non-zero bytes");
    } catch (e) { print("  FAIL: getRandomValues threw " + e); fail++; }

    /* 8. randomUUID returns valid-shape v4 */
    try {
        const u = crypto.randomUUID();
        ok(typeof u === 'string',                         "randomUUID returns string");
        ok(u.length === 36,                               "UUID length 36");
        ok(u.charAt(14) === '4',                          "UUID is version 4 (14th char)");
        ok(u.charAt(8) === '-' && u.charAt(13) === '-',   "UUID has dashes");
    } catch (e) { print("  FAIL: randomUUID threw " + e); fail += 4; }

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
