/* test_stack_chain.js - the JavaScript stack grows on demand.
 *
 * Run:  qjs amiga/tests/test_stack_chain.js
 *       and again with other sizes, each of which changes what is
 *       expected below (the test reads the sizes it was started with):
 *         qjs --stack-floor 256 amiga/tests/test_stack_chain.js
 *         qjs --stack-chunk 64  amiga/tests/test_stack_chain.js
 *         qjs --stack-size 512  amiga/tests/test_stack_chain.js
 *         qjs --stack-size 0    amiga/tests/test_stack_chain.js
 *              (no cap: recursion runs until memory is short; needs a
 *               few minutes and all free memory for a moment)
 *         qjs --stack-chunk 0   amiga/tests/test_stack_chain.js
 *              (growth off: only the first sections apply)
 *       On the Mac, perf/stack-tests.sh runs all of these under vamos.
 *
 * qjs starts on a stack of 64 KB (or the Shell's, if larger). Since
 * the chained stack (docs/STACK.md), a script that needs more gets it:
 * quickjs.library continues the nested call on a further block of
 * memory and gives the block back when the call returns. This test
 * recurses far beyond 64 KB in every way that is meant to grow, and
 * checks with os.stackInfo() that the blocks were really used, reused
 * and returned.
 *
 * A machine that locks up or resets while this runs has failed it.
 *
 * Prints one PASS or FAIL line per check, INFO lines with figures,
 * and a final count.
 */

import * as os from 'qjs:os';
import * as std from 'qjs:std';

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

/**
 * Print the count and leave. Used at the end and where the rest of the
 * test does not apply.
 * @returns {void}
 */
function finish() {
    print(passed + ' passed, ' + failed + ' failed');
}

/**
 * @typedef {Object} StackInfo
 * @property {number} floor setting, bytes
 * @property {number} chunk setting, bytes; 0 = growth off
 * @property {number} cap setting, bytes; 0 = no cap
 * @property {number} baseSize the task's own stack, bytes; 0 = unknown
 * @property {boolean} baseForced JavaScript runs on blocks only
 * @property {number} depth blocks in use now
 * @property {number} depthMax most blocks in use at once
 * @property {number} bytesInUse memory of the blocks in use
 * @property {number} bytesCached memory of the spare block
 * @property {number} bytesMax most memory held at once
 * @property {number} switches calls continued on another block
 * @property {number} allocations blocks taken from the system
 * @property {number} frees blocks given back
 * @property {number} refusals times no block could be had
 * @property {number} marginUsed deepest the stack went into the margin
 *     at the bottom of any block given back so far, bytes
 */

/**
 * The figures of the stack right now. (os.stackInfo(n) with a number
 * also makes the next n requests for a block fail; section 4.)
 * @returns {StackInfo} the figures
 */
function info() {
    return os.stackInfo();
}

if (typeof os.stackInfo !== 'function') {
    check('os.stackInfo exists (a library with the chained stack)', false);
    finish();
    std.exit(1);
}

const START = info();
const KB = 1024;
/* Blocks in use while this file's top level runs: none, or one when
 * the task stack is below the floor and everything runs on blocks. */
const TOP = START.depth;
print('INFO floor ' + START.floor / KB + ' KB, block ' + START.chunk / KB +
      ' KB, cap ' + (START.cap === 0 ? 'none' : START.cap / KB + ' KB') +
      ', task stack ' + (START.baseSize === 0 ? 'unknown' :
                         Math.round(START.baseSize / KB) + ' KB') +
      (START.baseForced ? ' (below the floor: blocks only)' : ''));

/* What one nested call of a plain function takes: measured 777 bytes
 * on the 68020 soft-float library and 801 on the 68040 FPU one. */
const BYTES_PER_CALL = 800;
/* The stack the sections below aim to fill: a good half of the cap,
 * and never less than 256 KB, which is four times what qjs starts on. */
const WORK = Math.max(256 * KB,
                      Math.floor((START.cap === 0 ? 1024 * KB : START.cap) * 0.55));
/* How many blocks that much stack must have needed at its deepest:
 * two, so that going from block to block is seen and not only from
 * the task stack to a block. */
const DEEP_BLOCKS = 2;

/**
 * The sum 1 + 2 + ... + n by recursion, n calls deep.
 * @param {number} n how deep
 * @returns {number} n * (n + 1) / 2
 */
function triangle(n) {
    return n === 0 ? 0 : n + triangle(n - 1);
}

/**
 * Go n calls deep, call `bottom` there and bring its result back up.
 * @param {number} n how deep
 * @param {function(): *} bottom called at the deepest point
 * @returns {*} what bottom returned
 */
function descend(n, bottom) {
    return n === 0 ? bottom() : descend(n - 1, bottom);
}

/**
 * Recurse until the engine stops it.
 * @returns {{error: *, depth: number}} what was thrown and how deep it got
 */
function runaway() {
    let depth = 0;
    /** @returns {number} never */
    function again() { depth++; return again() + 1; }
    try {
        again();
    } catch (error) {
        return { error, depth };
    }
    return { error: null, depth };
}

/* ---- 0. growth turned off ------------------------------------------- */

if (START.chunk === 0) {
    const stopped = runaway();
    check('with growth off, runaway recursion ends in RangeError',
          stopped.error instanceof RangeError, String(stopped.error));
    print('INFO   stopped ' + stopped.depth + ' calls deep');
    check('with growth off, no block was ever taken',
          info().allocations === 0 && info().switches === 0,
          JSON.stringify(info()));
    check('ordinary recursion still works', triangle(20) === 210);
    finish();
    std.exit(failed === 0 ? 0 : 1);
}

/* ---- 0b. a task stack that leaves nothing to grow ---------------------- */

if (!START.baseForced && START.baseSize > 200 * KB) {
    /* e.g. after "Stack 500000": most of what this test would put on
     * blocks fits the task stack, and what it expects to see does not
     * happen. Only the plainest check applies. */
    const calls = Math.floor(WORK / BYTES_PER_CALL);
    let result = null;
    try {
        result = triangle(calls);
    } catch (error) {
        result = String(error);
    }
    check('recursion ' + calls + ' calls deep returns the right value',
          result === calls * (calls + 1) / 2, result);
    print('INFO the task stack is ' + Math.round(START.baseSize / KB) +
          ' KB: too large for the rest of this test. Run it from a Shell');
    print('INFO with the default stack, or with a Stack setting below 200000.');
    finish();
    std.exit(failed === 0 ? 0 : 1);
}

/* ---- 1. deep recursion succeeds ------------------------------------- */

const deepCalls = Math.floor(WORK / BYTES_PER_CALL);
{
    const before = info();
    let result = null;
    let thrown = null;
    try {
        result = triangle(deepCalls);
    } catch (error) {
        thrown = error;
    }
    const after = info();
    check('recursion ' + deepCalls + ' calls deep (about ' +
          Math.round(WORK / KB) + ' KB of stack) returns the right value',
          thrown === null && result === deepCalls * (deepCalls + 1) / 2,
          thrown === null ? result : String(thrown));
    check('it ran on more than one block',
          after.depthMax >= DEEP_BLOCKS, 'depthMax ' + after.depthMax);
    check('every block was left again',
          after.depth === TOP && after.bytesInUse === START.bytesInUse,
          JSON.stringify(after));
    check('one block is kept for reuse, the others went back',
          after.bytesCached > 0 &&
          after.allocations - after.frees === 1 + TOP,
          'allocated ' + after.allocations + ', freed ' + after.frees);
    print('INFO   ' + (after.switches - before.switches) + ' switches, ' +
          (after.allocations - before.allocations) + ' blocks taken, most held ' +
          Math.round(after.bytesMax / KB) + ' KB');
}

/* ---- 2. the sizes are honoured -------------------------------------- */

{
    /* the figures as seen from the deepest call */
    const deep = descend(deepCalls, info);
    const first = START.baseForced ? Math.max(START.floor, START.chunk) : START.chunk;
    check('deep down the blocks are of the sizes asked for',
          deep.depth >= DEEP_BLOCKS &&
          deep.bytesInUse === first + (deep.depth - 1) * START.chunk,
          deep.depth + ' blocks, ' + deep.bytesInUse + ' bytes');
    if (START.baseForced)
        check('the first block is at least the floor',
              first >= START.floor);
    else
        check('the task stack meets the floor and is used as it is',
              START.baseSize >= START.floor - START.floor / 8,
              START.baseSize);
}

/* ---- 3. the cap: RangeError, and a working engine afterwards -------- */

/* Without a cap a runaway recursion takes all the memory there is
 * before it is stopped: not something to do to a machine for a test.
 * Section 4 shows what happens when no block can be had. */
const ROUNDS = START.cap === 0 ? 0 : 5;
if (ROUNDS === 0)
    print('INFO no cap: the runaway recursions are left out');

const depths = [];
let allRangeErrors = true;
let allLeft = true;
let allWorking = true;
for (let round = 0; round < ROUNDS; round++) {
    const stopped = runaway();
    depths.push(stopped.depth);
    if (!(stopped.error instanceof RangeError))
        allRangeErrors = false;
    const now = info();
    if (now.depth !== TOP || now.bytesInUse !== START.bytesInUse)
        allLeft = false;
    if (triangle(50) !== 1275 || [3, 1, 2].sort().join() !== '1,2,3')
        allWorking = false;
}
if (START.cap !== 0) {
    const now = info();
    check('runaway recursion ends in a RangeError that can be caught, 5 times',
          allRangeErrors);
    check('after each one every block was left', allLeft, JSON.stringify(now));
    check('after each one the engine works', allWorking);
    check('each one got equally deep',
          Math.max(...depths) - Math.min(...depths) <= 2, depths.join(' '));
    print('INFO   stopped ' + depths[0] + ' calls deep');
    check('the blocks never held more than the cap',
          now.bytesMax <= START.cap, now.bytesMax + ' of ' + START.cap);
    check('and the cap was really reached (within a block and the task stack)',
          now.bytesMax >= START.cap - START.chunk - Math.max(START.baseSize, 64 * KB),
          now.bytesMax + ' of ' + START.cap);
    check('recursion got at least half as deep as the cap allows',
          depths[0] >= START.cap / BYTES_PER_CALL / 2, depths[0]);
    check('no block was refused for lack of memory', now.refusals === 0,
          now.refusals);
}

/* ---- 4. when the system has no memory for a block ------------------- */

{
    /* os.stackInfo(n) makes the next n requests for a block fail. One
     * attempt to grow asks for the full size, then half, then half of
     * that, down to 32 KB. */
    std.gc();
    const before = os.stackInfo(1);
    const halved = descend(deepCalls, info);
    check('one refused request: recursion goes on, on a block of half the size',
          halved.bytesInUse - START.bytesInUse ===
              START.chunk / 2 + (halved.depth - TOP - 1) * START.chunk,
          halved.depth + ' blocks, ' + halved.bytesInUse + ' bytes');
    os.stackInfo(0);
    std.gc();

    const refusedBefore = os.stackInfo(1000000).refusals;
    let stopped = null;
    let result = null;
    try {
        result = triangle(deepCalls);
    } catch (error) {
        stopped = error;
    }
    const during = info();
    const worksWhileShort = triangle(20) === 210;
    os.stackInfo(0);
    check('every request refused: deep recursion ends in a RangeError that can be caught',
          stopped instanceof RangeError, stopped === null ? result : String(stopped));
    check('the refusal was counted and no block was taken',
          during.refusals > refusedBefore &&
          during.allocations === before.allocations + halved.depth - TOP,
          JSON.stringify(during));
    check('shallow code works while memory is short', worksWhileShort);
    check('and deep recursion works again once memory is back',
          triangle(deepCalls) === deepCalls * (deepCalls + 1) / 2);
}

/* ---- 5. a loop that straddles the end of a block -------------------- */

/**
 * At every level from here down to `last`, call a small recursive
 * function 20 times and note how many block switches and how many
 * allocations those 20 calls caused. Somewhere on the way down the 20
 * calls cross the end of a block every time.
 * @param {number} level this level
 * @param {number} last the deepest level
 * @param {Array<Array<number>>} out receives [switches, allocations] per level
 * @returns {void}
 */
function straddle(level, last, out) {
    const before = info();
    for (let i = 0; i < 20; i++)
        triangle(3);
    const after = info();
    out.push([after.switches - before.switches,
              after.allocations - before.allocations]);
    if (level < last)
        straddle(level + 1, last, out);
}

{
    std.gc(); /* start without a spare block */
    const before = info();
    const levels = [];
    straddle(1, Math.min(400, Math.floor(WORK / BYTES_PER_CALL)), levels);
    const after = info();
    let mostSwitches = 0;
    let mostAllocations = 0;
    let straddling = 0;
    for (const [switches, allocations] of levels) {
        mostSwitches = Math.max(mostSwitches, switches);
        mostAllocations = Math.max(mostAllocations, allocations);
        if (switches >= 20)
            straddling++;
    }
    check('at some depth each of 20 calls crossed to another block',
          mostSwitches >= 20, 'most switches at one level: ' + mostSwitches);
    check('20 crossings never took more than one block from the system',
          mostAllocations <= 1, 'most allocations at one level: ' + mostAllocations);
    check('the whole descent took no more blocks than its depth in blocks, plus the spare',
          after.allocations - before.allocations <= after.depthMax + 1,
          (after.allocations - before.allocations) + ' blocks for depth ' + after.depthMax);
    print('INFO   ' + straddling + ' of ' + levels.length +
          ' levels straddled; ' + (after.switches - before.switches) +
          ' switches, ' + (after.allocations - before.allocations) + ' blocks taken');
}

/* ---- 6. nested source text and JSON --------------------------------- */

/**
 * How many arrays are nested inside each other.
 * @param {*} value the outermost
 * @returns {number} the nesting depth
 */
function arrayDepth(value) {
    let depth = 0;
    while (Array.isArray(value)) {
        depth++;
        value = value[0];
    }
    return depth;
}

/**
 * Run one nesting case and check its value and that it needed blocks.
 * @param {string} label what is nested
 * @param {function(): *} run builds and evaluates it
 * @param {*} expected the value run must return
 * @returns {void}
 */
function nestingCase(label, run, expected) {
    const before = info();
    let result;
    try {
        result = run();
    } catch (error) {
        result = String(error);
    }
    const after = info();
    /* (on blocks only, a large first block may hold all of it) */
    check(label, result === expected &&
          (after.switches > before.switches || START.baseForced),
          'got ' + String(result).slice(0, 60) + ', ' +
          (after.switches - before.switches) + ' switches');
}

/* The parser takes 1.3 to 2 KB of stack per nested expression (the
 * whole ladder of operator precedences lies between two of them) and
 * much less per nested statement or JSON value. */
const exprLevels = Math.floor(WORK / 2400);
const stmtLevels = Math.floor(WORK / 500);
const jsonLevels = Math.floor(WORK / 150);

nestingCase('source: ' + exprLevels + ' nested array literals',
            () => arrayDepth(eval('['.repeat(exprLevels) + ']'.repeat(exprLevels))),
            exprLevels);
nestingCase('source: ' + exprLevels + ' nested parentheses',
            () => eval('('.repeat(exprLevels) + '7' + ')'.repeat(exprLevels)), 7);
nestingCase('source: ' + exprLevels + ' nested object literals',
            () => {
                let value = eval('({a:'.repeat(exprLevels) + '1' + '})'.repeat(exprLevels));
                let depth = 0;
                while (typeof value === 'object') { depth++; value = value.a; }
                return depth;
            }, exprLevels);
nestingCase('source: ' + exprLevels + ' nested calls',
            () => eval('Number('.repeat(exprLevels) + '2' + ')'.repeat(exprLevels)), 2);
nestingCase('source: ' + Math.floor(exprLevels / 2) + ' nested function expressions, called',
            () => eval('(function(){return '.repeat(Math.floor(exprLevels / 2)) + '5' +
                       '})()'.repeat(Math.floor(exprLevels / 2))), 5);
nestingCase('source: ' + Math.floor(exprLevels / 2) + ' nested arrow functions, called',
            () => eval('(()=>'.repeat(Math.floor(exprLevels / 2)) + '8' +
                       ')()'.repeat(Math.floor(exprLevels / 2))), 8);
nestingCase('source: ' + Math.floor(exprLevels / 2) + ' nested template literals',
            () => eval('`${'.repeat(Math.floor(exprLevels / 2)) + '1' +
                       '}`'.repeat(Math.floor(exprLevels / 2))), '1');
nestingCase('source: ' + stmtLevels + ' nested blocks',
            () => { eval('{'.repeat(stmtLevels) + 'globalThis.chainMark = 3;' + '}'.repeat(stmtLevels)); return globalThis.chainMark; },
            3);
nestingCase('source: a chain of ' + stmtLevels + ' else-ifs',
            () => { eval('if (0) {} else '.repeat(stmtLevels) + 'globalThis.chainMark = 4;'); return globalThis.chainMark; },
            4);
nestingCase('JSON.parse of ' + jsonLevels + ' nested arrays',
            () => arrayDepth(JSON.parse('['.repeat(jsonLevels) + ']'.repeat(jsonLevels))),
            jsonLevels);
nestingCase('JSON.parse of ' + jsonLevels + ' nested objects',
            () => {
                let value = JSON.parse('{"a":'.repeat(jsonLevels) + '1' + '}'.repeat(jsonLevels));
                let depth = 0;
                while (typeof value === 'object') { depth++; value = value.a; }
                return depth;
            }, jsonLevels);
nestingCase('JSON.parse with a reviver, ' + Math.floor(jsonLevels / 8) + ' nested arrays',
            () => {
                let visits = 0;
                JSON.parse('['.repeat(Math.floor(jsonLevels / 8)) + ']'.repeat(Math.floor(jsonLevels / 8)),
                           (key, value) => { visits++; return value; });
                return visits;
            }, Math.floor(jsonLevels / 8));
{
    const levels = Math.floor(jsonLevels / 4);
    let value = [];
    for (let i = 1; i < levels; i++)
        value = [value];
    nestingCase('JSON.stringify of ' + levels + ' nested arrays',
                () => JSON.stringify(value).length, 2 * levels);
}
{
    const levels = Math.floor(jsonLevels / 2);
    let value = [1];
    for (let i = 1; i < levels; i++)
        value = [value];
    nestingCase('Array.prototype.flat(Infinity) of ' + levels + ' nested arrays',
                () => value.flat(Infinity).join(), '1');
}
if (START.cap !== 0) {
    let stopped = null;
    try {
        eval('['.repeat(20000) + ']'.repeat(20000));
    } catch (error) {
        stopped = error;
    }
    check('source nested far beyond the cap ends in a catchable error',
          stopped instanceof RangeError || stopped instanceof SyntaxError,
          String(stopped));
}

/* ---- 7. exceptions across blocks ------------------------------------ */

/**
 * Throw from n calls down.
 * @param {number} n how deep
 * @param {string} message the error's message
 * @returns {number} never
 */
function throwFrom(n, message) {
    if (n === 0)
        throw new Error(message);
    return throwFrom(n - 1, message) + 1;
}

/**
 * Go n calls down with a try/finally at every level.
 * @param {number} n how deep
 * @param {{count: number}} tally counts the finally blocks that ran
 * @returns {number} never
 */
function throwThroughFinally(n, tally) {
    try {
        if (n === 0)
            throw new Error('bottom');
        return throwThroughFinally(n - 1, tally) + 1;
    } finally {
        tally.count++;
    }
}

{
    let caught = null;
    try {
        throwFrom(deepCalls, 'from the deepest block');
    } catch (error) {
        caught = error;
    }
    check('an error thrown ' + deepCalls + ' calls down is caught at the top',
          caught instanceof Error && caught.message === 'from the deepest block' &&
          info().depth === TOP, String(caught));
    check('its stack trace is there and bounded',
          caught !== null && typeof caught.stack === 'string' &&
          caught.stack.split('\n').length < 200);

    /* thrown deep, caught half way down, and the value carried up */
    const half = Math.floor(deepCalls / 2);
    const carried = descend(half, () => {
        const here = info().depth;
        try {
            throwFrom(half, 'lower half');
        } catch (error) {
            return error.message + '/' + (info().depth === here);
        }
        return 'not thrown';
    });
    check('thrown in a deeper block, caught in a shallower one, result returned to the top',
          carried === 'lower half/true', carried);

    /* created at the top, thrown at the bottom, caught at the bottom,
     * rethrown, caught at the top */
    const original = new Error('made at the top');
    let rethrown = null;
    try {
        descend(deepCalls, () => {
            try {
                throw original;
            } catch (error) {
                error.seenAtDepth = info().depth;
                throw error;
            }
        });
    } catch (error) {
        rethrown = error;
    }
    check('made at the top, thrown and caught at the bottom, rethrown to the top',
          rethrown === original && original.seenAtDepth >= DEEP_BLOCKS,
          'seen at depth ' + original.seenAtDepth);

    const tally = { count: 0 };
    let through = null;
    try {
        throwThroughFinally(half, tally);
    } catch (error) {
        through = error;
    }
    check('every finally on the way up ran',
          through !== null && through.message === 'bottom' &&
          tally.count === half + 1, tally.count);

    /* a RangeError at the cap, caught deep down, after which the same
     * deep frame goes on working */
    if (START.cap !== 0) {
        const survived = descend(half, () => {
            const stopped = runaway();
            return (stopped.error instanceof RangeError) + '/' + triangle(30);
        });
        check('the cap reached from half way down is caught there, and that frame goes on',
              survived === 'true/465', survived);
    }
}

/* ---- 8. native functions calling back -------------------------------- */

/**
 * Run a recursion that goes through a native function at every level
 * and check its result and that it used blocks.
 * @param {string} label the native function in between
 * @param {number} bytesPerLevel roughly what one level takes
 * @param {function(number, function(): void): number} run recurses the
 *     given number of levels, calls the callback at the deepest one and
 *     returns the number of levels counted on the way back
 * @returns {void}
 */
function callbackCase(label, bytesPerLevel, run) {
    const levels = Math.floor(WORK / bytesPerLevel);
    let deepest = -1;
    let result;
    try {
        result = run(levels, () => { deepest = info().depth; });
    } catch (error) {
        result = String(error);
    }
    check(label + ', ' + levels + ' levels', result === levels && deepest >= DEEP_BLOCKS,
          'got ' + result + ', ' + deepest + ' blocks at the bottom');
}

callbackCase('Array.prototype.map with a callback that recurses', 3200, (levels, bottom) => {
    /** @param {number} n levels left @returns {number} levels counted */
    function f(n) { if (n === 0) { bottom(); return 0; } return [n].map((x) => f(x - 1))[0] + 1; }
    return f(levels);
});
callbackCase('Array.prototype.sort comparator', 4600, (levels, bottom) => {
    /** @param {number} n levels left @returns {number} levels counted */
    function f(n) {
        if (n === 0) { bottom(); return 0; }
        let below = 0;
        [2, 1].sort((x, y) => { below = f(n - 1); return x - y; });
        return below + 1;
    }
    return f(levels);
});
callbackCase('String.prototype.replace callback', 5800, (levels, bottom) => {
    /** @param {number} n levels left @returns {number} levels counted */
    function f(n) { if (n === 0) { bottom(); return 0; } return Number('a'.replace(/a/, () => String(f(n - 1)))) + 1; }
    return f(levels);
});
callbackCase('Function.prototype.apply', 2200, (levels, bottom) => {
    /** @param {number} n levels left @returns {number} levels counted */
    function f(n) { if (n === 0) { bottom(); return 0; } return f.apply(null, [n - 1]) + 1; }
    return f(levels);
});
callbackCase('Reflect.apply', 2200, (levels, bottom) => {
    /** @param {number} n levels left @returns {number} levels counted */
    function f(n) { if (n === 0) { bottom(); return 0; } return Reflect.apply(f, null, [n - 1]) + 1; }
    return f(levels);
});
callbackCase('a bound function', 2200, (levels, bottom) => {
    let bound = null;
    /** @param {number} n levels left @returns {number} levels counted */
    function f(n) { if (n === 0) { bottom(); return 0; } return bound(n - 1) + 1; }
    bound = f.bind(null);
    return bound(levels);
});
callbackCase('a getter', 1500, (levels, bottom) => {
    const object = {
        left: levels,
        get next() {
            if (this.left === 0) { bottom(); return 0; }
            this.left--;
            return this.next + 1;
        },
    };
    return object.next;
});
callbackCase('a constructor', 1100, (levels, bottom) => {
    /** @constructor @param {number} n levels left */
    function Level(n) { if (n === 0) { bottom(); this.count = 0; } else this.count = new Level(n - 1).count + 1; }
    return new Level(levels).count;
});
callbackCase('a Proxy get trap', 3200, (levels, bottom) => {
    const proxy = new Proxy({}, {
        get(target, key) {
            const n = Number(key);
            if (n === 0) { bottom(); return 0; }
            return proxy[n - 1] + 1;
        },
    });
    return proxy[levels];
});
callbackCase('toString called by string concatenation', 1500, (levels, bottom) => {
    let left = levels;
    let counted = 0;
    const object = {
        toString() {
            if (left === 0) { bottom(); return ''; }
            left--;
            const text = '' + object;
            counted++;
            return text;
        },
    };
    String(object);
    return counted;
});
callbackCase('toJSON called by JSON.stringify', 3600, (levels, bottom) => {
    /** @param {number} n levels left @returns {number} levels counted */
    function f(n) {
        if (n === 0) { bottom(); return 0; }
        return Number(JSON.stringify({ toJSON() { return f(n - 1); } })) + 1;
    }
    return f(levels);
});

/* ---- 9. generators, async functions, promise jobs -------------------- */

/**
 * Yield 0, 1, ... n, each through n nested yield* delegations.
 * @param {number} n how many delegations
 * @returns {Generator<number>} the numbers
 */
function* countUp(n) {
    if (n > 0)
        yield* countUp(n - 1);
    yield n;
}

/**
 * A generator that reports how many blocks are in use each time it is
 * resumed.
 * @returns {Generator<number>} block counts
 */
function* reporter() {
    for (;;)
        yield info().depth;
}

/**
 * An async function that calls itself n times before anything awaits.
 * @param {number} n how deep
 * @returns {Promise<number>} n
 */
async function asyncChain(n) {
    if (n === 0)
        return 0;
    return 1 + await asyncChain(n - 1);
}

{
    const delegations = Math.floor(WORK / 4000);
    const before = info();
    let sum = 0;
    for (const value of countUp(delegations))
        sum += value;
    check('a generator delegating ' + delegations + ' deep yields every value',
          sum === delegations * (delegations + 1) / 2 &&
          info().switches > before.switches,
          'sum ' + sum + ', ' + (info().switches - before.switches) + ' switches');

    /* made at the top, resumed at the bottom */
    const shallow = reporter();
    const atTop = shallow.next().value;
    const atBottom = descend(deepCalls, () => shallow.next().value);
    const atTopAgain = shallow.next().value;
    check('a generator made at the top runs on the block of whoever resumes it',
          atTop === TOP && atBottom >= DEEP_BLOCKS && atTopAgain === TOP,
          atTop + ' ' + atBottom + ' ' + atTopAgain);

    /* made and started at the bottom, resumed at the top */
    const deepMade = descend(deepCalls, () => {
        const generator = reporter();
        return [generator, generator.next().value];
    });
    check('a generator made at the bottom is resumed at the top after its block is gone',
          deepMade[1] >= DEEP_BLOCKS && deepMade[0].next().value === TOP,
          String(deepMade[1]));

    const asyncLevels = Math.floor(WORK / 2400);
    const asyncBefore = info();
    const asyncResult = await asyncChain(asyncLevels);
    check('an async function calling itself ' + asyncLevels + ' deep resolves',
          asyncResult === asyncLevels && info().switches > asyncBefore.switches,
          asyncResult);

    /* awaited at the bottom of a deep recursion: the continuation runs
     * later, from the job queue, on the task stack */
    /**
     * @param {number} n how deep to go before awaiting
     * @returns {Promise<Array<number>>} blocks in use before and after the await
     */
    async function awaitAtBottom(n) {
        if (n > 0)
            return awaitAtBottom(n - 1);
        const beforeAwait = info().depth;
        await null;
        return [beforeAwait, info().depth];
    }
    const awaited = await awaitAtBottom(Math.floor(deepCalls / 3));
    check('an await at the bottom of a deep recursion resumes on the task stack',
          awaited[0] >= 1 && awaited[1] <= 1, awaited.join(' '));

    const jobBefore = info();
    const jobResult = await Promise.resolve(deepCalls).then((n) => triangle(n));
    check('a promise job recurses ' + deepCalls + ' deep',
          jobResult === deepCalls * (deepCalls + 1) / 2 &&
          info().switches > jobBefore.switches, jobResult);

    let rejected = null;
    try {
        await Promise.resolve().then(() => throwFrom(deepCalls, 'in a job'));
    } catch (error) {
        rejected = error;
    }
    check('an error thrown deep inside a promise job rejects the promise',
          rejected instanceof Error && rejected.message === 'in a job',
          String(rejected));
}

/* ---- 10. the task's stack bounds, for tools that look at them ------- */

/* Offsets of tc_SPLower and tc_SPUpper in struct Task (exec/tasks.h):
 * the 14 byte Node, then six UBYTEs and four ULONGs, two UWORDs and
 * tc_SPReg come to 58. */
const TC_SPLOWER = 58;
const TC_SPUPPER = 62;

if (typeof amiga === 'object' && typeof amiga.peek32 === 'function') {
    const sysBase = amiga.peek32(4);
    const task = amiga.call(sysBase, amiga.exec.lvo.FindTask, { a1: 0 });
    /** @returns {Array<number>} tc_SPLower, tc_SPUpper */
    const bounds = () => [amiga.peek32(task + TC_SPLOWER), amiga.peek32(task + TC_SPUPPER)];
    const top = bounds();
    const bottom = descend(deepCalls, () => bounds().concat(info().depth));
    const topAgain = bounds();
    check('back at the top the task has its own stack bounds again',
          top[0] === topAgain[0] && top[1] === topAgain[1],
          top.join(' ') + ' / ' + topAgain.join(' '));
    /* vamos keeps the bounds in the emulator, not in the task
     * structure, so there they do not move. Its intuition.library is
     * an empty shell with no screen in it, which is how it is told
     * from an Amiga here. */
    let onAmiga = false;
    const intuition = amiga.openLibrary('intuition.library', 0);
    if (intuition) {
        const screen = amiga.call(intuition, amiga.intuition.lvo.LockPubScreen, { a0: 0 });
        if (screen) {
            onAmiga = true;
            amiga.call(intuition, amiga.intuition.lvo.UnlockPubScreen, { a0: 0, a1: screen });
        }
        amiga.closeLibrary(intuition);
    }
    if (onAmiga) {
        check('deep down the task bounds describe a block of ours, not the task stack',
              bottom[2] >= DEEP_BLOCKS && (bottom[0] !== top[0] || bottom[1] !== top[1]) &&
              bottom[1] - bottom[0] > START.chunk - 64 &&
              bottom[1] - bottom[0] <= START.chunk,
              bottom.join(' '));
    } else {
        print('INFO task bounds deep down: ' + (bottom[1] - bottom[0]) +
              ' bytes (not checked: this emulator does not keep them in the task)');
    }
}

/* ---- 11. the memory comes back --------------------------------------- */

{
    const MEMF_ANY = 0;
    const canMeasure = typeof amiga === 'object' && typeof amiga.call === 'function';
    const sysBase = canMeasure ? amiga.peek32(4) : 0;
    /** @returns {number} free memory in the system, bytes */
    const available = () => amiga.call(sysBase, amiga.exec.lvo.AvailMem, { d1: MEMF_ANY });

    /* once to settle whatever the heap wants for this, then measure */
    descend(deepCalls, () => (canMeasure ? available() : 0));
    std.gc();
    const settled = info();
    check('after a collection no block is held, not even the spare',
          settled.depth === TOP && settled.bytesInUse === START.bytesInUse &&
          settled.bytesCached === 0 &&
          settled.allocations - settled.frees === TOP,
          JSON.stringify(settled));
    if (canMeasure) {
        const freeBefore = available();
        const deep = descend(deepCalls, () => [available(), info().bytesInUse - START.bytesInUse]);
        std.gc();
        const freeAfter = available();
        check('deep down the blocks are memory taken from the system',
              freeBefore - deep[0] >= deep[1] - 16 * KB,
              (freeBefore - deep[0]) + ' bytes less free, ' + deep[1] + ' in blocks');
        check('afterwards free memory is back where it was (within 16 KB)',
              freeBefore - freeAfter <= 16 * KB,
              (freeBefore - freeAfter) + ' bytes missing');
        print('INFO   free memory ' + freeBefore + ' before, ' + deep[0] +
              ' deep down, ' + freeAfter + ' after');
    } else {
        print('INFO free memory not measured (no FFI)');
    }
    const end = info();
    /* Every block is painted at the bottom when taken and inspected
     * when given back. 16 KB must stay free there; the lowest 4 KB
     * untouched is the same requirement test_stack_limit.js makes of
     * the task stack. */
    check('no block was ever used into the lowest 4 KB of its margin',
          end.frees > 0 && end.marginUsed <= 12 * KB,
          end.marginUsed + ' bytes of 16384 used');
    print('INFO deepest any block went into its 16 KB margin: ' +
          end.marginUsed + ' bytes');
    print('INFO in all: ' + end.switches + ' switches, ' + end.allocations +
          ' blocks taken, ' + end.frees + ' given back, most blocks at once ' +
          end.depthMax + ', most memory ' + Math.round(end.bytesMax / KB) + ' KB');
}

finish();
