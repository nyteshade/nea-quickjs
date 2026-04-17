/*
 * test_child_process.js -- Smoke test for D5 child_process on Amiga.
 *
 * Uses dos.library SystemTagList under the hood. Runs stock AmigaOS
 * commands (C:Echo, C:List) and checks output + exit code.
 *
 * Requires library 0.090+.
 */

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== child_process smoke test ===");

/* 1. Global is installed */
ok(typeof globalThis.child_process === 'object',        "globalThis.child_process exists");
ok(typeof globalThis.child_process.spawnSync === 'function', "child_process.spawnSync is a function");
ok(typeof globalThis.child_process.spawn === 'function',     "child_process.spawn is a function");
ok(typeof globalThis.child_process.execSync === 'function',  "child_process.execSync is a function");
ok(typeof globalThis.child_process.exec === 'function',      "child_process.exec is a function");

/* 2. Native raw function present */
ok(typeof globalThis.__qjs_spawnSync === 'function', "native __qjs_spawnSync exists");

/* 3. Simple Echo — stdout capture */
try {
    const r = child_process.spawnSync("C:Echo", ["hello from qjs"]);
    ok(typeof r === 'object',                   "spawnSync returns object");
    ok(typeof r.stdout === 'string',            "result.stdout is string");
    ok(typeof r.stderr === 'string',            "result.stderr is string");
    ok(typeof r.exitCode === 'number',          "result.exitCode is number");
    ok(r.signal === null,                       "result.signal is null");
    ok(r.stdout.indexOf("hello from qjs") >= 0, "stdout contains echoed text");
    ok(r.exitCode === 0,                        "Echo exit code 0");
} catch (e) { print("  FAIL: Echo threw " + e); fail += 2; }

/* 4. execSync — single-string cmdline */
try {
    const r = child_process.execSync("C:Echo sync exec");
    ok(r.stdout.indexOf("sync exec") >= 0, "execSync captures output");
    ok(r.exitCode === 0,                   "execSync exit code 0");
} catch (e) { print("  FAIL: execSync threw " + e); fail += 2; }

/* 5. spawn (Promise wrapper) */
(async () => {
    try {
        const r = await child_process.spawn("C:Echo", ["async test"]);
        ok(r.stdout.indexOf("async test") >= 0, "spawn Promise resolves with output");
        ok(r.exitCode === 0,                    "spawn exit code 0");
    } catch (e) { print("  FAIL: spawn threw " + e); fail += 2; }

    /* 6. exec (Promise wrapper, shell-style) */
    try {
        const r = await child_process.exec("C:Echo via exec");
        ok(r.stdout.indexOf("via exec") >= 0, "exec Promise resolves");
    } catch (e) { print("  FAIL: exec threw " + e); fail++; }

    /* 7. Non-zero exit code — run something that should fail.
     * Use a path on T: (always mounted) so AmigaDOS doesn't open the
     * "please insert volume" requester. File just doesn't exist. */
    try {
        const r = child_process.spawnSync("C:List", ["T:nonexistent-qjs-test-file-xyz"]);
        /* Don't assert a specific exit value — just that it's non-zero. */
        ok(r.exitCode !== 0, "List on nonexistent file returns non-zero exit");
    } catch (e) { print("  FAIL: List bogus threw " + e); fail++; }

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
