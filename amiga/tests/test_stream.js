/*
 * test_stream.js -- Smoke test for the `stream` manifest.
 * Requires library 0.095+.
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== stream smoke test ===");

ok(typeof globalThis.stream === 'object',                 "globalThis.stream exists");
ok(typeof globalThis.stream.Readable === 'function',      "stream.Readable is function");
ok(typeof globalThis.stream.Writable === 'function',      "stream.Writable is function");
ok(typeof globalThis.stream.Transform === 'function',     "stream.Transform is function");
ok(typeof globalThis.stream.PassThrough === 'function',   "stream.PassThrough is function");

const { Readable, Writable, Transform, PassThrough } = globalThis.stream;

(async () => {
    /* 1. Readable.from([...]) drains an array */
    try {
        const r = Readable.from([1, 2, 3]);
        const got = [];
        r.on('data', c => got.push(c));
        await new Promise(res => r.on('end', res));
        ok(got.length === 3 && got[0] === 1 && got[2] === 3, "Readable.from drains array");
    } catch (e) { print("  FAIL: Readable.from " + e); fail++; }

    /* 2. push(null) fires 'end' */
    try {
        const r = new Readable();
        let ended = false;
        r.on('end', () => { ended = true; });
        r.push("a"); r.push("b"); r.push(null);
        await Promise.resolve(); await Promise.resolve();
        ok(ended, "push(null) triggers 'end'");
    } catch (e) { print("  FAIL: push null " + e); fail++; }

    /* 3. Writable collects via .write + .end */
    try {
        const got = [];
        const w = new Writable({
            write(chunk, cb) { got.push(chunk); cb(); }
        });
        let finished = false;
        w.on('finish', () => { finished = true; });
        w.write("hello ");
        w.write("world");
        w.end();
        await Promise.resolve(); await Promise.resolve();
        ok(got.length === 2 && got[0] === "hello ", "Writable.write collects chunks");
        ok(finished, "Writable.end triggers 'finish'");
    } catch (e) { print("  FAIL: Writable " + e); fail++; }

    /* 4. pipe Readable -> Writable */
    try {
        const collected = [];
        const w = new Writable({ write(c, cb) { collected.push(c); cb(); } });
        const r = Readable.from(['x', 'y', 'z']);
        r.pipe(w);
        await new Promise(res => w.on('finish', res));
        ok(collected.join('') === 'xyz', "pipe delivers all chunks in order");
    } catch (e) { print("  FAIL: pipe " + e); fail++; }

    /* 5. write-after-end fires 'error' */
    try {
        const w = new Writable({ write(c, cb) { cb(); } });
        let err = null;
        w.on('error', e => { err = e; });
        w.end();
        await Promise.resolve();
        w.write("late", e => { /* callback captures err */ });
        await Promise.resolve(); await Promise.resolve();
        ok(err !== null && /end/.test(err.message), "write-after-end emits error");
    } catch (e) { print("  FAIL: write-after-end " + e); fail++; }

    /* 6. Transform passes chunks through (default impl) */
    try {
        const t = new Transform();
        const got = [];
        t.on('data', c => got.push(c));
        t.write("alpha");
        t.write("beta");
        t.end();
        await Promise.resolve(); await Promise.resolve();
        ok(got.length === 2 && got[0] === 'alpha', "Transform default passes through");
    } catch (e) { print("  FAIL: Transform " + e); fail++; }

    /* 7. Custom Transform uppercases */
    try {
        const upper = new Transform({
            transform(chunk, enc, cb) { cb(null, String(chunk).toUpperCase()); }
        });
        let out = '';
        upper.on('data', c => { out += c; });
        upper.write("hello");
        upper.write(" world");
        upper.end();
        await Promise.resolve(); await Promise.resolve();
        ok(out === "HELLO WORLD", "Custom Transform applies fn");
    } catch (e) { print("  FAIL: Custom Transform " + e); fail++; }

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
