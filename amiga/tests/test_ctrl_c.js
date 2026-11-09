/* test_ctrl_c.js — Check that Shell Ctrl-C stops a runaway script
 *
 * This test needs a human. Half of it runs on its own; the other half
 * needs you to press Ctrl-C at the right moment, so it cannot be part
 * of the automatic suite.
 *
 * It checks the feature "Ctrl-C stops a running script" (0.200).
 *
 * ------------------------------------------------------------------
 * PART 1 — automatic. Run this file and confirm it finishes.
 * ------------------------------------------------------------------
 *
 *     qjs test_ctrl_c.js
 *
 * Expected: three "ok" lines and no error.
 *
 * This part matters because the Ctrl-C check runs very often while
 * code is executing. If that check ever returned "stop" by mistake,
 * normal scripts would break. This proves they do not.
 *
 * ------------------------------------------------------------------
 * PART 2 — manual. Do these from the Shell, one at a time.
 * ------------------------------------------------------------------
 *
 * 2a. Runaway at the Shell prompt.
 *
 *     qjs -e "print('before'); for(;;);"
 *
 *     You should see "before", then the machine will appear to hang.
 *     Press Ctrl-C.
 *
 *     Pass: you get an "interrupted" error and your Shell prompt back.
 *           The machine still responds to typing.
 *     Fail: nothing happens and you must reset the machine.
 *
 * 2b. Runaway inside the interactive prompt.
 *
 *     qjs
 *     > for(;;);
 *
 *     Press Ctrl-C. Then type:
 *
 *     > 1+1
 *
 *     Pass: you are back at the prompt, and 1+1 still prints 2.
 *           That proves the interpreter survived, not just the Shell.
 *     Fail: prompt never returns, or the prompt returns but the next
 *           line errors out.
 *
 * 2c. Runaway that tries to swallow the stop.
 *
 *     qjs -e "try { for(;;); } catch (e) { print('swallowed'); }"
 *
 *     Press Ctrl-C.
 *
 *     Pass: it reports an interrupted error. It must NOT print
 *           "swallowed". The stop is deliberately not catchable, so a
 *           buggy script cannot trap it.
 *     Fail: you see "swallowed" - the stop is catchable.
 *
 * 2d. Quitting the prompt should be unchanged.
 *
 *     qjs
 *
 *     Then press your usual end-of-input key (Ctrl-D).
 *
 *     Pass: returns to the Shell prompt cleanly.
 *
 * ------------------------------------------------------------------
 * IF PART 2 DOES NOTHING AT ALL
 * ------------------------------------------------------------------
 *
 * Check that the new library is the one actually loaded. The old copy
 * can stay in memory after a program exits. Until it is cleared, the
 * new program is talking to the old library, and the Ctrl-C check never
 * runs.
 *
 * Run the flushlibs helper, or reboot, then try 2a again.
 */

const results = [];

function ok(cond, what) {
    results.push(cond);
    print(cond ? 'ok   - ' + what : 'FAIL - ' + what);
    return cond;
}

/* A plain counting loop. If the Ctrl-C check misfired, this would stop
 * early or throw, so finishing at all is the point. */
let total = 0;
for (let i = 0; i < 500000; i++) {
    total += i;
}
ok(total === 124999750000, 'a counting loop of 500000 steps finished');

/* A loop that only calls functions. Different shape, same question. */
let calls = 0;
function spin() { calls++; }
for (let i = 0; i < 100000; i++) {
    spin();
}
ok(calls === 100000, 'a loop of 100000 function calls finished');

/* Code that catches everything must still run to completion when
 * nobody pressed Ctrl-C. */
let caught = 0;
for (let i = 0; i < 1000; i++) {
    try { throw new Error('x'); } catch (e) { caught++; }
}
ok(caught === 1000, 'a loop of 1000 caught errors finished');

const failed = results.filter(r => !r).length;
print('');
if (failed === 0) {
    print('PART 1 PASSED. Now do PART 2 by hand - see the top of this file.');
} else {
    print('PART 1 FAILED: ' + failed + ' check(s) did not pass.');
}
