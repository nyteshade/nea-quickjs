/* test_stack_limit.js - runaway recursion must throw, not crash.
 *
 * Run:  qjs amiga/tests/test_stack_limit.js
 *       (try it after "Stack 65536" and again after "Stack 400000")
 *
 * Until 0.231 the interpreter assumed 1 MB of stack whatever the Shell
 * had given it. Recursion that went deeper than the real stack wrote
 * over whatever memory lay below it: a crash, or worse, later. The
 * limit now follows the task's real stack (tc_SPLower), less a margin.
 *
 * Every kind of recursion below must end in a RangeError that the
 * script can catch, and the interpreter must work afterwards. Where
 * the FFI is present the test also paints a pattern over the lowest
 * 16 KB of the stack first (the margin the library keeps free) and
 * looks at it afterwards: the bottom 4 KB must be untouched, and the
 * deepest byte that was touched is reported.
 *
 * A machine that locks up or resets while this runs has failed it.
 *
 * Prints one PASS or FAIL line per check, INFO lines with figures,
 * and a final count.
 */

let passed = 0;
let failed = 0;

/**
 * Record one check.
 * @param {string} label what was checked
 * @param {boolean} ok whether it held
 * @param {*} [detail] shown after a failure
 * @returns {void}
 */
function check(label, ok, detail) {
    if (ok) {
        passed++;
        print('PASS ' + label);
    } else {
        failed++;
        print('FAIL ' + label + (detail === undefined ? '' : ' (' + detail + ')'));
    }
}

/* ---- the task's stack, if it can be read ---------------------------- */

/* Offsets of tc_SPLower and tc_SPUpper in struct Task (exec/tasks.h):
 * the 14 byte Node, then six UBYTEs and four ULONGs, two UWORDs and
 * tc_SPReg come to 58. */
const TC_SPLOWER = 58;
const TC_SPUPPER = 62;
const PATTERN = 0x5a5aa5a5;
const PAINTED_BYTES = 16384;    /* QJS_STACK_MARGIN in qjsfuncs.c */
const MUST_STAY_FREE = 4096;

let stackLower = 0;
let stackUpper = 0;
let painted = false;

/**
 * Find the bounds of this task's stack and paint the bottom of it.
 * Leaves `painted` false when there is no FFI, the bounds are not
 * believable, or the stack is so small that the paint would be near
 * the stack pointer.
 * @returns {void}
 */
function paintStackBottom() {
    if (typeof amiga !== 'object' || typeof amiga.peek32 !== 'function')
        return;
    const sysBase = amiga.peek32(4);
    const task = amiga.call(sysBase, amiga.exec.lvo.FindTask, { a1: 0 });
    stackLower = amiga.peek32(task + TC_SPLOWER);
    stackUpper = amiga.peek32(task + TC_SPUPPER);
    if (stackLower === 0 || stackUpper <= stackLower ||
        stackUpper - stackLower < 60000)
        return;
    for (let offset = 0; offset < PAINTED_BYTES; offset += 4)
        amiga.poke32(stackLower + offset, PATTERN);
    painted = true;
}

/**
 * How much of the paint survived, counted from the bottom of the stack.
 * @returns {number} bytes from the bottom that still hold the pattern
 */
function untouchedBytes() {
    let offset = 0;
    while (offset < PAINTED_BYTES &&
           amiga.peek32(stackLower + offset) === PATTERN)
        offset += 4;
    return offset;
}

paintStackBottom();
if (stackLower !== 0 || stackUpper !== 0)
    print('INFO stack of this task: ' + (stackUpper - stackLower) + ' bytes');
if (!painted)
    print('INFO stack bottom not painted (no FFI, unknown bounds, or under 60000 bytes)');

/* ---- recursion of every kind ---------------------------------------- */

let depth = 0;

/**
 * Build an array nested inside itself many times.
 * @param {number} levels how deep
 * @returns {Array<*>} the outermost array
 */
function nested(levels) {
    let value = [];
    for (let i = 0; i < levels; i++)
        value = [value];
    return value;
}

/**
 * Each entry runs without end, or far deeper than any Amiga stack
 * allows, until the interpreter stops it.
 * @type {Object<string, function(): void>}
 */
const runaways = {
    'a function calling itself': () => {
        /** @returns {number} never */
        function f() { depth++; return f() + 1; }
        f();
    },
    'two functions calling each other': () => {
        /** @returns {number} never */
        function a() { depth++; return b() + 1; }
        /** @returns {number} never */
        function b() { depth++; return a() + 1; }
        a();
    },
    'a getter reading itself': () => {
        const object = { get x() { depth++; return this.x; } };
        object.x;
    },
    'a constructor constructing itself': () => {
        class Again { constructor() { depth++; new Again(); } }
        new Again();
    },
    'Function.prototype.apply': () => {
        /** @returns {number} never */
        function f() { depth++; return f.apply(null, [1, 2, 3]); }
        f();
    },
    'a sort callback': () => {
        /** @returns {void} */
        function f() { depth++; [3, 1, 2].sort((x, y) => { f(); return x - y; }); }
        f();
    },
    'a String.replace callback': () => {
        /** @returns {string} never */
        function f() { depth++; return 'a'.replace(/a/, () => f()); }
        f();
    },
    'a toString called by string concatenation': () => {
        const object = { toString() { depth++; return '' + object; } };
        String(object);
    },
    'JSON.stringify of 20000 nested arrays': () => {
        JSON.stringify(nested(20000));
    },
    'String() of 20000 nested arrays': () => {
        String(nested(20000));
    },
    'parsing 20000 nested parentheses': () => {
        eval('('.repeat(20000) + '1' + ')'.repeat(20000));
    },
    'parsing 20000 nested array literals': () => {
        eval('['.repeat(20000) + ']'.repeat(20000));
    },
    'a chain of 20000 proxies': () => {
        let proxy = {};
        for (let i = 0; i < 20000; i++)
            proxy = new Proxy(proxy, {});
        proxy.x;
    },
    'a generator delegating to itself': () => {
        /** @returns {Generator<number>} never */
        function* g() { depth++; yield* g(); }
        g().next();
    },
};

/* something to compare before and after: memory below a small stack is
 * most likely heap, and this is in the heap */
const witness = [];
for (let i = 0; i < 2000; i++)
    witness.push('item ' + (i * 7919) % 1000);
const witnessBefore = witness.join('|');

let plainDepth = 0;
for (const name in runaways) {
    depth = 0;
    let thrown = null;
    try {
        runaways[name]();
    } catch (error) {
        thrown = error;
    }
    /* a syntax error about nesting is as good an ending as RangeError:
     * what matters is that the script got an error it could catch */
    check(name + ' ends in a catchable error',
          thrown instanceof RangeError || thrown instanceof SyntaxError ||
          thrown instanceof InternalError,
          thrown === null ? 'no error at all' : String(thrown));
    if (depth > 0) {
        print('INFO   stopped ' + depth + ' calls deep');
        if (name === 'a function calling itself')
            plainDepth = depth;
    }
}

/* ---- afterwards ------------------------------------------------------ */

/**
 * An ordinary recursive function, to show recursion still works.
 * @param {number} n how far to count
 * @returns {number} n * (n + 1) / 2
 */
function triangle(n) {
    return n === 0 ? 0 : n + triangle(n - 1);
}

check('ordinary recursion still works (20 deep)', triangle(20) === 210);
check('the interpreter still computes', [1, 2, 3].map((x) => x * x).join() === '1,4,9');
check('heap data is unchanged', witness.join('|') === witnessBefore);
if (typeof std === 'object' && typeof std.gc === 'function') {
    std.gc();
    check('a garbage collection completes', true);
}

/* In an async function the error does not propagate as a throw: it
 * rejects the promise the function returned. */
/** @returns {Promise<number>} never fulfilled */
async function asyncRunaway() { return (await null, 0) + await asyncRunawayInner(); }
/** @returns {Promise<number>} never fulfilled */
async function asyncRunawayInner() { return asyncRunawayInner(); }
let asyncError = null;
try {
    await asyncRunaway();
} catch (error) {
    asyncError = error;
}
check('an async function calling itself rejects with RangeError',
      asyncError instanceof RangeError, String(asyncError));

let again = null;
try {
    runaways['a function calling itself']();
} catch (error) {
    again = error;
}
check('a second runaway is caught too', again instanceof RangeError,
      String(again));
check('RangeError says what happened',
      again !== null && /stack/i.test(again.message), again && again.message);

/* On a 64 KB stack plain recursion gets about 60 calls deep (callbacks
 * through sort or replace far fewer); fewer than 10 means the limit is far too tight to be useful. */
check('plain recursion gets at least 10 calls deep', plainDepth >= 10,
      'only ' + plainDepth);

if (painted) {
    const untouched = untouchedBytes();
    print('INFO deepest the stack went: ' + (PAINTED_BYTES - untouched) +
          ' bytes into the ' + PAINTED_BYTES + ' byte margin');
    check('the bottom ' + MUST_STAY_FREE + ' bytes of the stack were never touched',
          untouched >= MUST_STAY_FREE, 'only ' + untouched + ' bytes untouched');
}

print(passed + ' passed, ' + failed + ' failed');
