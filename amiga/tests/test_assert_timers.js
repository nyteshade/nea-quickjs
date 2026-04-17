/*
 * test_assert_timers.js -- Smoke test for 0.101 additions:
 *   - assert module (ok/equal/strictEqual/deepEqual/throws/rejects/match)
 *   - timers/promises (setTimeout, setImmediate, AbortSignal)
 *   - process.stdout / process.stderr Writable shape
 *   - path.posix / path.win32 aliases
 *
 * Requires library 0.101+.
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== 0.101 additions smoke test ===");

/* -------- assert -------- */
try {
    ok(typeof globalThis.assert === 'function',       "assert is a function");
    ok(typeof globalThis.assert.ok === 'function',    "assert.ok");
    ok(typeof globalThis.assert.equal === 'function', "assert.equal");

    /* Passing case — should not throw */
    let threw = false;
    try { assert.ok(true, 'truthy'); } catch (_) { threw = true; }
    ok(!threw, "assert.ok(true) does not throw");

    /* Failing case — must throw AssertionError */
    threw = false;
    try { assert.ok(false, 'falsy'); } catch (e) {
        threw = (e.name === 'AssertionError' || /falsy/.test(e.message));
    }
    ok(threw, "assert.ok(false) throws AssertionError");

    /* deepEqual */
    threw = false;
    try { assert.deepEqual({a:1, b:[2,3]}, {a:1, b:[2,3]}); } catch (_) { threw = true; }
    ok(!threw, "assert.deepEqual matching objects");

    threw = false;
    try { assert.deepEqual({a:1}, {a:2}); } catch (_) { threw = true; }
    ok(threw, "assert.deepEqual mismatched throws");

    /* throws */
    try {
        assert.throws(() => { throw new Error('boom'); });
        ok(true, "assert.throws catches thrown");
    } catch (_) { ok(false, "assert.throws wrongly rejected thrown fn"); }

    try {
        assert.throws(() => {});  /* doesn't throw — should assert fail */
        ok(false, "assert.throws(non-throwing) should itself throw");
    } catch (_) { ok(true, "assert.throws(non-throwing) throws as expected"); }

    /* match */
    try {
        assert.match("hello", /ell/);
        ok(true, "assert.match on matching regex");
    } catch (_) { ok(false, "assert.match wrongly rejected match"); }
} catch (e) { print("  FAIL: assert init " + e); fail++; }

/* -------- timers.promises -------- */
(async () => {
    try {
        ok(typeof timers === 'object' && typeof timers.promises === 'object',
           "globalThis.timers.promises exists");
        ok(typeof timers.promises.setTimeout === 'function',
           "timers.promises.setTimeout");

        const start = Date.now();
        await timers.promises.setTimeout(50, 'ret');
        const elapsed = Date.now() - start;
        ok(elapsed >= 40,
           `setTimeout waited at least 40ms (got ${elapsed}ms)`);

        /* value forwarding */
        const v = await timers.promises.setTimeout(10, 'hello');
        ok(v === 'hello', "timers.promises.setTimeout resolves with value");

        /* setImmediate */
        const im = await timers.promises.setImmediate('immediate-val');
        ok(im === 'immediate-val', "timers.promises.setImmediate resolves");

        /* AbortSignal cancellation */
        const ac = new AbortController();
        setTimeout(() => ac.abort(), 5);
        try {
            await timers.promises.setTimeout(100, 'never', { signal: ac.signal });
            ok(false, "aborted setTimeout should have rejected");
        } catch (e) {
            ok(e.name === 'AbortError' || /abort/i.test(e.message),
               "AbortSignal cancels setTimeout: " + (e.message || e.name));
        }
    } catch (e) { print("  FAIL: timers.promises " + e); fail += 4; }

    /* -------- process.stdout / stderr -------- */
    try {
        ok(typeof process.stdout === 'object',          "process.stdout exists");
        ok(typeof process.stdout.write === 'function',  "process.stdout.write");
        ok(process.stdout.isTTY === true,               "process.stdout.isTTY");
        ok(typeof process.stderr.write === 'function',  "process.stderr.write");
        ok(typeof process.stdin.on === 'function',      "process.stdin.on stub");
        /* Write doesn't throw */
        let threw = false;
        try { process.stdout.write(''); } catch (_) { threw = true; }
        ok(!threw, "process.stdout.write('') doesn't throw");
    } catch (e) { print("  FAIL: process.stdio " + e); fail += 4; }

    /* -------- path aliases -------- */
    try {
        ok(globalThis.path.posix === globalThis.path, "path.posix aliases path");
        ok(globalThis.path.win32 === globalThis.path, "path.win32 aliases path");
        /* Through the alias — same join behavior */
        const j = path.posix.join('RAM:', 'foo', 'bar');
        ok(j === 'RAM:foo/bar', "path.posix.join works via alias: " + j);
    } catch (e) { print("  FAIL: path aliases " + e); fail += 3; }

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
