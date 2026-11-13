/*
 * test_engine_conformance.js -- does the JavaScript engine give the
 * answers the language defines?
 *
 * Run:  qjs amiga/tests/test_engine_conformance.js
 *       (the file is a module: it has import statements)
 *
 * This library is QuickJS-ng built for a big-endian 68k by a compiler
 * (vbcc) that few JavaScript engines have met. Each check below asks
 * the engine a question whose answer does not depend on the machine
 * and compares it with what Node.js 26 prints for the same expression.
 *
 * Section A holds the wrong answers found on 0.236 and fixed in the
 * build after it. None of them was caused by the compiler or by byte
 * order: they are faults of the engine itself, present in the upstream
 * sources on every machine.
 *   - BigInt.asUintN returned negative operands unchanged
 *     (asUintN(64, -1n) was -1n) and lost the top bit of others
 *   - a negative BigInt compared the wrong way round with a negative
 *     Number of a different magnitude (-1n < -0.5 was false)
 *   - print() and console.log() showed a BigInt as "[tag 7]"
 *   - {...'ab'} was {} instead of {0:'a',1:'b'}
 *   - a capture group inside a quantified group kept what an earlier
 *     iteration had captured
 *   - [^\W] with the i and u flags did not match 's' or 'k'
 *   - iterator.filter(f).take(n) over an array threw "not a function"
 *   - a suspended async function that was reachable only through a
 *     closure over one of its own variables was freed by the garbage
 *     collector; the closure then called freed memory (section C)
 *   - leaving a "for await" loop with break did not wait for the
 *     iterator's return(), and a loop that ran to its end called
 *     return() although it must not (section C)
 *   - of several expired timers the oldest ran first, not the one
 *     that was due first (section C)
 *
 * Section B is a sample of the sweep that found them: several hundred
 * expressions over BigInt, number formatting, the language, strings,
 * regular expressions, arrays, typed arrays and DataView. On 0.236 all
 * of section B already passed except the lines repeated in section A.
 *
 * Section C runs last because it needs the event loop: "for await",
 * closures over the variables of async functions and generators
 * across garbage collections, the order of microtasks, timers.
 *
 * What is NOT here, on purpose (see docs/NODEJS-DELTA.md, "The engine
 * itself"): Number.prototype.toString with a radix that is not a power
 * of two (the digits are implementation-defined and differ from V8's),
 * and features this engine version lacks (the RegExp v flag, RegExp
 * modifiers, duplicate named groups, Atomics, Uint8Array base64).
 *
 * The file is long because it is a table: one line per question. It
 * is generated; to add a case, add it to the table by hand in the same
 * form, with the answer Node.js gives.
 *
 * It executes about 500 million 68k instructions: seconds on a 68060,
 * a few minutes on a plain 68020.
 *
 * Prints one PASS or FAIL line per check, INFO lines for things only a
 * person can judge, and a final count. Output is plain ASCII.
 */
import * as std from 'qjs:std';
import * as os from 'qjs:os';

let passed = 0;
let failed = 0;

/**
 * Escape every character outside printable ASCII, and the backslash,
 * so that a rendering is the same on any console.
 * @param {string} s text to escape
 * @returns {string} ASCII-only text
 */
function esc(s) {
    var out = '', i, ch;
    for (i = 0; i < s.length; i++) {
        ch = s.charCodeAt(i);
        if (ch >= 32 && ch < 127 && ch !== 92) out += s[i];
        else out += '\\u' + ('0000' + ch.toString(16)).slice(-4);
    }
    return out;
}

/**
 * Render a value as one line of ASCII that distinguishes -0, holes,
 * BigInt, typed arrays and nested structure.
 * @param {*} v value to render
 * @returns {string} the rendering
 */
function show(v) {
    var parts, i, keys;
    if (typeof v === 'string') return '"' + esc(v) + '"';
    if (typeof v === 'bigint') return v.toString() + 'n';
    if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (typeof v === 'symbol') return esc(v.toString());
    if (v === null || v === undefined || typeof v === 'boolean') return String(v);
    if (typeof v === 'function') return 'function';
    if (Array.isArray(v)) {
        parts = [];
        for (i = 0; i < v.length; i++) parts.push(i in v ? show(v[i]) : '<hole>');
        return '[' + parts.join(',') + ']';
    }
    if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
        parts = [];
        for (i = 0; i < v.length; i++) parts.push(show(v[i]));
        return v.constructor.name + '[' + parts.join(',') + ']';
    }
    if (v instanceof Error) return v.name;
    if (v instanceof Date) return 'Date(' + v.getTime() + ')';
    if (v instanceof RegExp) return esc(String(v));
    keys = Object.keys(v);
    parts = [];
    for (i = 0; i < keys.length; i++) parts.push(esc(keys[i]) + ':' + show(v[keys[i]]));
    return '{' + parts.join(',') + '}';
}

/**
 * Record one comparison of two renderings.
 * @param {string} label name of the check
 * @param {string} got what the engine produced
 * @param {string} expected what it must produce
 * @returns {void}
 */
function compare(label, got, expected) {
    var at, from;
    if (got === expected) {
        passed++;
        print('PASS ' + label);
        return;
    }
    failed++;
    at = 0;
    while (at < got.length && at < expected.length && got[at] === expected[at]) at++;
    from = at > 30 ? at - 30 : 0;
    print('FAIL ' + label);
    print('     first difference at character ' + at);
    print('     got      ' + (from ? '...' : '') + got.slice(from, from + 120));
    print('     expected ' + (from ? '...' : '') + expected.slice(from, from + 120));
}

/**
 * Run one case and compare the rendering of its value (or the name of
 * what it threw) with the expected rendering.
 * @param {string} label name of the check
 * @param {function(): *} fn computes the value
 * @param {string} expected rendering Node.js gives
 * @returns {void}
 */
function check(label, fn, expected) {
    var got;
    try { got = show(fn()); } catch (e) { got = 'throws ' + (e && e.name); }
    compare(label, got, expected);
}

/**
 * Print a section heading.
 * @param {string} title what the following checks cover
 * @returns {void}
 */
function section(title) {
    print('');
    print('--- ' + title);
}

print('=== Engine conformance test ===');

section('A. Wrong answers found on 0.236 and fixed in the build after it');
check('BigInt.asUintN(64, -1n) is 2^64-1', () => BigInt.asUintN(64, -1n),
    '18446744073709551615n');
check('BigInt.asUintN of negative values at 8..128 bits', () => [8, 32, 53, 63, 64, 65, 128].map(b => BigInt.asUintN(b, -2n)),
    '[254n,4294967294n,9007199254740990n,9223372036854775806n,18446744073709551614n,36893488147419103230n,340282366920938463463374607431768211454n]');
check('BigInt.asUintN keeps a set top bit positive', () => [BigInt.asUintN(32, 0x1ffffffffn), BigInt.asUintN(32, 2147483648n), BigInt.asUintN(64, 2n ** 64n - 1n), BigInt.asUintN(64, 2n ** 63n), BigInt.asUintN(33, -2147483648n), BigInt.asUintN(96, -(2n ** 70n))],
    '[4294967295n,2147483648n,18446744073709551615n,9223372036854775808n,6442450944n,79228161333672716876132646912n]');
check('BigInt.asUintN then asIntN round trip', () => [-1n, -128n, -(2n ** 31n), -(2n ** 63n), 5n, 2n ** 62n].map(v => BigInt.asIntN(64, BigInt.asUintN(64, v)) === v),
    '[true,true,true,true,true,true]');
check('BigInt.asUintN with a huge bit count', () => [BigInt.asUintN(2 ** 53 - 1, 5n), (() => { try { return BigInt.asUintN(2 ** 53 - 1, -1n); } catch (e) { return e.name; } })()],
    '[5n,"RangeError"]');
check('negative BigInt against negative Number', () => [-1n < -0.5, -1n > -1.5, -(2n ** 64n) < -1, -(2n ** 64n) < -4294967296, -(2n ** 32n) > -1.8446744073709552e19, -5n < -4.5, -5n > -5.5, -(2n ** 64n) == -1.8446744073709552e19, -3n >= -3.5, -3n <= -2.5, -1.5 < -1n, -0.5 > -1n],
    '[true,true,true,true,true,true,true,true,true,true,true,true]');
check('mixed sort of negative BigInt and Number', () => [-1n, -0.5, -1.5, -(2n ** 64n), -4294967296.5, -4294967296n, 0, -2n].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    '[-18446744073709551616n,-4294967296.5,-4294967296n,-2n,-1.5,-1n,-0.5,0]');
check('object spread of a string', () => [{ ...'ab' }, { x: 1, ...'z' }, Object.keys({ ...'\ud83d\ude00' }).length, { ...5 }, { ...null }, { ...true }, { ...['p', 'q'] }],
    '[{0:"a",1:"b"},{0:"z",x:1},2,{},{},{},{0:"p",1:"q"}]');
check('rest destructuring of a string', () => { var { 0: first, length, ...rest } = 'hey'; return [first, length, rest]; },
    '["h",3,{1:"e",2:"y"}]');
check('captures reset on each iteration of a quantifier', () => [/(?:(a)|b)+/.exec('ab').slice(), /(?:(a)|(b))+/.exec('ab').slice(), /(?:(a)|(b)|(c))*/.exec('abc').slice(), /(?:(x)?y)+/.exec('xyy').slice(), /(?:(a)|b){2}/.exec('ab').slice(), /(?:(a)|b){1,3}?c/.exec('abc').slice(), /((a)|(b))+/.exec('ab').slice(), 'aXbY'.replace(/(?:(a)|(b)|.)+/, '[$1][$2]'), /(?:(?:(a)|b)(c)?)+/.exec('acb').slice(), /(?<=(?:(a)|b)+)c/.exec('abc').slice()],
    '[["ab",undefined],["ab",undefined,"b"],["abc",undefined,undefined,"c"],["xyy",undefined],["ab",undefined],["abc",undefined],["ab","b",undefined,"b"],"[][]",["acb",undefined,undefined],["c","a"]]');
check('captures of a backreference inside a loop', () => [/(?:(a)\1|b)+/.exec('aab').slice(), /(?:(.)x\1|y)+/.exec('axay').slice()],
    '[["aab",undefined],["axay",undefined]]');
check('[^\\W] and [\\W] with /iu and the two folding letters', () => ['s', 'S', 'k', 'K', '\u017f', '\u212a', '-', '_', '5'].map(ch => [/[^\W]/iu.test(ch), /[\W]/iu.test(ch), /[^\W\d_]/iu.test(ch), /\W/iu.test(ch), /[\w]/iu.test(ch), /[^\w]/iu.test(ch)].map(Number).join('')),
    '["101010","101010","101010","101010","101010","101010","010101","100010","100010"]');
check('iterator helpers chained over an array iterator', () => [[1, 2, 3, 4].values().map(x => x * 2).filter(x => x > 2).take(2).toArray(), [1, 2, 3, 4].values().filter(x => x > 1).take(1).toArray(), [1, 2, 3].values().map(x => x).take(0).toArray(), [...new Set([1, 2, 3]).values().drop(1).take(1)], new Map([[1, 'a'], [2, 'b']]).keys().map(k => k * 3).take(1).toArray(), 'abc'[Symbol.iterator]().filter(ch => ch !== 'a').take(1).toArray(), [1, 2].values().flatMap(x => [x, x]).take(3).toArray()],
    '[[4,6],[2],[],[2],[3],["b"],[1,1,2]]');
check('iterator helper return() without an underlying return', () => { var h = [1, 2, 3].values().map(x => x); h.next(); return [h.return(), h.next()]; },
    '[{value:undefined,done:true},{value:undefined,done:true}]');
check('iterator helper take() closes an iterator that has return', () => { var log = []; var it = { __proto__: Iterator.prototype, i: 0, next() { return { value: this.i++, done: false }; }, return() { log.push('closed'); return {}; } }; return [it.filter(x => x % 2).take(2).toArray(), log]; },
    '[[1,3],["closed"]]');

/* print() goes to the console and cannot be read back by the script. */
print('INFO the next line must read: 1n -5n 18446744073709551616n [ 1n ] { a: -1n }');
print('INFO', 1n, -5n, 2n ** 64n, [1n], { a: -1n });

section('A2. Behaviour that is by design: what it is, so that a change is noticed');
/* Number.prototype.toString(radix): for a radix that is not a power of
 * two the standard leaves the digits to the implementation. This engine
 * prints the shortest digit string that reads back as the same number;
 * V8 prints more digits, some of them wrong ((1e21).toString(36) is
 * "5v1j4f4ds7c000" there, which is not 1e21). So the check is the
 * property, not V8's digits. */
check('toString(radix) of an integer reads back as the same number, radix 2..36', () => {
    var bad = [], r, i, v, s, acc, j, R,
        xs = [1, 35, 36, 1295, 65535, 65536, 2147483647, 2147483648, 4294967295, 4294967296,
              123456789012, 9007199254740991, 2 ** 53, 2 ** 60, 2 ** 64, 2 ** 80, 1e21, 1e22, 3 ** 40, 7 ** 25];
    for (r = 2; r <= 36; r++) {
        R = BigInt(r);
        for (i = 0; i < xs.length; i++) {
            v = xs[i];
            s = v.toString(r);
            if (r === 10) {
                /* radix 10 switches to exponent notation at 1e21 */
                if (Number(s) !== v) bad.push(r + ':' + v);
            } else {
                acc = 0n;
                for (j = 0; j < s.length; j++) acc = acc * R + BigInt(parseInt(s[j], r));
                if (Number(acc) !== v) bad.push(r + ':' + v);
            }
            if ((-v).toString(r) !== '-' + s) bad.push(r + ':-' + v);
        }
    }
    return bad;
}, '[]');
check('(1e21).toString(36) is the shortest string that reads back as 1e21', () => (1e21).toString(36), '"5v1j4f4ds7a000"');
check('toString(radix) of exact fractions', () => [(0.5).toString(3), (1 / 3).toString(3), (1 / 36).toString(36), (0.2).toString(5), (255.5).toString(36), (-0.75).toString(12), Math.pow(7, -3).toString(7)],
    '["0.11111111111111111111111111111111112","0.1","0.1","0.1","73.i","-0.9","0.001"]');
check('toString(radix) of powers of the radix', () => {
    var bad = [], r, k;
    for (r = 2; r <= 36; r++) for (k = 1; k <= 12; k += 3) {
        if (r === 10) continue; /* 1e-7 and below print with an exponent */
        if (Math.pow(r, k).toString(r) !== '1' + '0'.repeat(k)) bad.push(r + '^' + k);
        if (Math.pow(r, -k).toString(r) !== '0.' + '0'.repeat(k - 1) + '1') bad.push(r + '^-' + k);
    }
    return bad;
}, '[]');

/* std file.readAsString(max_size) and file.read(): max_size counts
 * BYTES of the file, as upstream QuickJS documents, and the bytes are
 * then decoded as UTF-8. A character whose bytes straddle the limit is
 * cut in two and does not come back as that character. Read the whole
 * file, or read lines with getline(), when the text is not ASCII. */
check('std file: readAsString() of the whole file keeps multi-byte characters', () => {
    var name = 'T:qjs_conformance.tmp', text = 'h\u00e9llo \u20ac \ud83d\ude00 end\nsecond line \u00fc\n', f, whole, lines = [], line, head, rest;
    f = std.open(name, 'w'); f.puts(text); f.close();
    f = std.open(name, 'r'); whole = f.readAsString(); f.close();
    f = std.open(name, 'r'); while ((line = f.getline()) !== null) lines.push(line); f.close();
    f = std.open(name, 'r'); head = f.readAsString(2); rest = f.readAsString(); f.close();
    os.remove(name);
    return [whole === text, lines, head.length >= 1 && head[0] === 'h', head + rest === text];
}, '[true,["h\\u00e9llo \\u20ac \\ud83d\\ude00 end","second line \\u00fc"],true,false]');

/* os.Worker needs threads (JS_HAVE_THREADS, pthreads upstream); this
 * build has none, so the constructor is not exported at all. */
check('os.Worker is absent in this build', () => typeof os.Worker, '"undefined"');
check('import.meta of this file', () => [typeof import.meta, typeof import.meta.url, /\.js$/.test(import.meta.url), import.meta.main], '["object","string",true,true]');

section('B. BigInt: asIntN/asUintN, arithmetic across 2^31, 2^32, 2^63 and 2^64, conversions, typed arrays, DataView');
var BITS = [0, 1, 8, 31, 32, 33, 53, 63, 64, 65, 128];
var VALS = [0n, 1n, -1n, 127n, 128n, -128n, 255n, 256n, 2147483647n, 2147483648n, -2147483648n, -2147483649n, 4294967295n, 4294967296n, -4294967296n, 9223372036854775807n, 9223372036854775808n, -9223372036854775808n, -9223372036854775809n, 18446744073709551615n, 18446744073709551616n, -18446744073709551616n, 0x123456789abcdef0123456789abcdefn, -0x123456789abcdef0123456789abcdefn];
check('print-style String(5n)', () => String(5n) + '/' + String(-5n) + '/' + String(2n ** 70n),
    '"5/-5/1180591620717411303424"');
check('asUintN(64,-1n)', () => BigInt.asUintN(64, -1n),
    '18446744073709551615n');
check('asUintN 0', () => VALS.map(v => BigInt.asUintN(0, v)),
    '[0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n]');
check('asIntN 0', () => VALS.map(v => BigInt.asIntN(0, v)),
    '[0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n,0n]');
check('asUintN 1', () => VALS.map(v => BigInt.asUintN(1, v)),
    '[0n,1n,1n,1n,0n,0n,1n,0n,1n,0n,0n,1n,1n,0n,0n,1n,0n,0n,1n,1n,0n,0n,1n,1n]');
check('asIntN 1', () => VALS.map(v => BigInt.asIntN(1, v)),
    '[0n,-1n,-1n,-1n,0n,0n,-1n,0n,-1n,0n,0n,-1n,-1n,0n,0n,-1n,0n,0n,-1n,-1n,0n,0n,-1n,-1n]');
check('asUintN 8', () => VALS.map(v => BigInt.asUintN(8, v)),
    '[0n,1n,255n,127n,128n,128n,255n,0n,255n,0n,0n,255n,255n,0n,0n,255n,0n,0n,255n,255n,0n,0n,239n,17n]');
check('asIntN 8', () => VALS.map(v => BigInt.asIntN(8, v)),
    '[0n,1n,-1n,127n,-128n,-128n,-1n,0n,-1n,0n,0n,-1n,-1n,0n,0n,-1n,0n,0n,-1n,-1n,0n,0n,-17n,17n]');
check('asUintN 31', () => VALS.map(v => BigInt.asUintN(31, v)),
    '[0n,1n,2147483647n,127n,128n,2147483520n,255n,256n,2147483647n,0n,0n,2147483647n,2147483647n,0n,0n,2147483647n,0n,0n,2147483647n,2147483647n,0n,0n,162254319n,1985229329n]');
check('asIntN 31', () => VALS.map(v => BigInt.asIntN(31, v)),
    '[0n,1n,-1n,127n,128n,-128n,255n,256n,-1n,0n,0n,-1n,-1n,0n,0n,-1n,0n,0n,-1n,-1n,0n,0n,162254319n,-162254319n]');
check('asUintN 32', () => VALS.map(v => BigInt.asUintN(32, v)),
    '[0n,1n,4294967295n,127n,128n,4294967168n,255n,256n,2147483647n,2147483648n,2147483648n,2147483647n,4294967295n,0n,0n,4294967295n,0n,0n,4294967295n,4294967295n,0n,0n,2309737967n,1985229329n]');
check('asIntN 32', () => VALS.map(v => BigInt.asIntN(32, v)),
    '[0n,1n,-1n,127n,128n,-128n,255n,256n,2147483647n,-2147483648n,-2147483648n,2147483647n,-1n,0n,0n,-1n,0n,0n,-1n,-1n,0n,0n,-1985229329n,1985229329n]');
check('asUintN 33', () => VALS.map(v => BigInt.asUintN(33, v)),
    '[0n,1n,8589934591n,127n,128n,8589934464n,255n,256n,2147483647n,2147483648n,6442450944n,6442450943n,4294967295n,4294967296n,4294967296n,8589934591n,0n,0n,8589934591n,8589934591n,0n,0n,6604705263n,1985229329n]');
check('asIntN 33', () => VALS.map(v => BigInt.asIntN(33, v)),
    '[0n,1n,-1n,127n,128n,-128n,255n,256n,2147483647n,2147483648n,-2147483648n,-2147483649n,4294967295n,-4294967296n,-4294967296n,-1n,0n,0n,-1n,-1n,0n,0n,-1985229329n,1985229329n]');
check('asUintN 53', () => VALS.map(v => BigInt.asUintN(53, v)),
    '[0n,1n,9007199254740991n,127n,128n,9007199254740864n,255n,256n,2147483647n,2147483648n,9007197107257344n,9007197107257343n,4294967295n,4294967296n,9007194959773696n,9007199254740991n,0n,0n,9007199254740991n,9007199254740991n,0n,0n,920735923817967n,8086463330923025n]');
check('asIntN 53', () => VALS.map(v => BigInt.asIntN(53, v)),
    '[0n,1n,-1n,127n,128n,-128n,255n,256n,2147483647n,2147483648n,-2147483648n,-2147483649n,4294967295n,4294967296n,-4294967296n,-1n,0n,0n,-1n,-1n,0n,0n,920735923817967n,-920735923817967n]');
check('asUintN 63', () => VALS.map(v => BigInt.asUintN(63, v)),
    '[0n,1n,9223372036854775807n,127n,128n,9223372036854775680n,255n,256n,2147483647n,2147483648n,9223372034707292160n,9223372034707292159n,4294967295n,4294967296n,9223372032559808512n,9223372036854775807n,0n,0n,9223372036854775807n,9223372036854775807n,0n,0n,81985529216486895n,9141386507638288913n]');
check('asIntN 63', () => VALS.map(v => BigInt.asIntN(63, v)),
    '[0n,1n,-1n,127n,128n,-128n,255n,256n,2147483647n,2147483648n,-2147483648n,-2147483649n,4294967295n,4294967296n,-4294967296n,-1n,0n,0n,-1n,-1n,0n,0n,81985529216486895n,-81985529216486895n]');
check('asUintN 64', () => VALS.map(v => BigInt.asUintN(64, v)),
    '[0n,1n,18446744073709551615n,127n,128n,18446744073709551488n,255n,256n,2147483647n,2147483648n,18446744071562067968n,18446744071562067967n,4294967295n,4294967296n,18446744069414584320n,9223372036854775807n,9223372036854775808n,9223372036854775808n,9223372036854775807n,18446744073709551615n,0n,0n,81985529216486895n,18364758544493064721n]');
check('asIntN 64', () => VALS.map(v => BigInt.asIntN(64, v)),
    '[0n,1n,-1n,127n,128n,-128n,255n,256n,2147483647n,2147483648n,-2147483648n,-2147483649n,4294967295n,4294967296n,-4294967296n,9223372036854775807n,-9223372036854775808n,-9223372036854775808n,9223372036854775807n,-1n,0n,0n,81985529216486895n,-81985529216486895n]');
check('asUintN 65', () => VALS.map(v => BigInt.asUintN(65, v)),
    '[0n,1n,36893488147419103231n,127n,128n,36893488147419103104n,255n,256n,2147483647n,2147483648n,36893488145271619584n,36893488145271619583n,4294967295n,4294967296n,36893488143124135936n,9223372036854775807n,9223372036854775808n,27670116110564327424n,27670116110564327423n,18446744073709551615n,18446744073709551616n,18446744073709551616n,18528729602926038511n,18364758544493064721n]');
check('asIntN 65', () => VALS.map(v => BigInt.asIntN(65, v)),
    '[0n,1n,-1n,127n,128n,-128n,255n,256n,2147483647n,2147483648n,-2147483648n,-2147483649n,4294967295n,4294967296n,-4294967296n,9223372036854775807n,9223372036854775808n,-9223372036854775808n,-9223372036854775809n,18446744073709551615n,-18446744073709551616n,-18446744073709551616n,-18364758544493064721n,18364758544493064721n]');
check('asUintN 128', () => VALS.map(v => BigInt.asUintN(128, v)),
    '[0n,1n,340282366920938463463374607431768211455n,127n,128n,340282366920938463463374607431768211328n,255n,256n,2147483647n,2147483648n,340282366920938463463374607429620727808n,340282366920938463463374607429620727807n,4294967295n,4294967296n,340282366920938463463374607427473244160n,9223372036854775807n,9223372036854775808n,340282366920938463454151235394913435648n,340282366920938463454151235394913435647n,18446744073709551615n,18446744073709551616n,340282366920938463444927863358058659840n,1512366075204170929049582354406559215n,338770000845734292534325025077361652241n]');
check('asIntN 128', () => VALS.map(v => BigInt.asIntN(128, v)),
    '[0n,1n,-1n,127n,128n,-128n,255n,256n,2147483647n,2147483648n,-2147483648n,-2147483649n,4294967295n,4294967296n,-4294967296n,9223372036854775807n,9223372036854775808n,-9223372036854775808n,-9223372036854775809n,18446744073709551615n,18446744073709551616n,-18446744073709551616n,1512366075204170929049582354406559215n,-1512366075204170929049582354406559215n]');
check('asUintN errors', () => [() => BigInt.asUintN(-1, 1n), () => BigInt.asUintN(64, 1), () => BigInt.asUintN(2 ** 53, 1n)].map(f => { try { return f(); } catch (e) { return e.name; } }),
    '["RangeError","TypeError","RangeError"]');
var EDGE = [2n ** 31n - 1n, 2n ** 31n, 2n ** 32n - 1n, 2n ** 32n, 2n ** 63n - 1n, 2n ** 63n, 2n ** 64n - 1n, 2n ** 64n];
check('add 1', () => EDGE.map(v => v + 1n),
    '[2147483648n,2147483649n,4294967296n,4294967297n,9223372036854775808n,9223372036854775809n,18446744073709551616n,18446744073709551617n]');
check('sub 1', () => EDGE.map(v => v - 1n),
    '[2147483646n,2147483647n,4294967294n,4294967295n,9223372036854775806n,9223372036854775807n,18446744073709551614n,18446744073709551615n]');
check('neg', () => EDGE.map(v => -v),
    '[-2147483647n,-2147483648n,-4294967295n,-4294967296n,-9223372036854775807n,-9223372036854775808n,-18446744073709551615n,-18446744073709551616n]');
check('neg sub 1', () => EDGE.map(v => -v - 1n),
    '[-2147483648n,-2147483649n,-4294967296n,-4294967297n,-9223372036854775808n,-9223372036854775809n,-18446744073709551616n,-18446744073709551617n]');
check('neg add 1', () => EDGE.map(v => -v + 1n),
    '[-2147483646n,-2147483647n,-4294967294n,-4294967295n,-9223372036854775806n,-9223372036854775807n,-18446744073709551614n,-18446744073709551615n]');
check('mul self', () => EDGE.map(v => v * v),
    '[4611686014132420609n,4611686018427387904n,18446744065119617025n,18446744073709551616n,85070591730234615847396907784232501249n,85070591730234615865843651857942052864n,340282366920938463426481119284349108225n,340282366920938463463374607431768211456n]');
check('mul -3', () => EDGE.map(v => v * -3n),
    '[-6442450941n,-6442450944n,-12884901885n,-12884901888n,-27670116110564327421n,-27670116110564327424n,-55340232221128654845n,-55340232221128654848n]');
check('square neg', () => EDGE.map(v => (-v) * (-v)),
    '[4611686014132420609n,4611686018427387904n,18446744065119617025n,18446744073709551616n,85070591730234615847396907784232501249n,85070591730234615865843651857942052864n,340282366920938463426481119284349108225n,340282366920938463463374607431768211456n]');
check('div 3', () => EDGE.map(v => v / 3n),
    '[715827882n,715827882n,1431655765n,1431655765n,3074457345618258602n,3074457345618258602n,6148914691236517205n,6148914691236517205n]');
check('div -3', () => EDGE.map(v => v / -3n),
    '[-715827882n,-715827882n,-1431655765n,-1431655765n,-3074457345618258602n,-3074457345618258602n,-6148914691236517205n,-6148914691236517205n]');
check('neg div 3', () => EDGE.map(v => -v / 3n),
    '[-715827882n,-715827882n,-1431655765n,-1431655765n,-3074457345618258602n,-3074457345618258602n,-6148914691236517205n,-6148914691236517205n]');
check('rem 7', () => EDGE.map(v => v % 7n),
    '[1n,2n,3n,4n,0n,1n,1n,2n]');
check('rem -7', () => EDGE.map(v => v % -7n),
    '[1n,2n,3n,4n,0n,1n,1n,2n]');
check('neg rem 7', () => EDGE.map(v => -v % 7n),
    '[-1n,-2n,-3n,-4n,0n,-1n,-1n,-2n]');
check('neg rem -7', () => EDGE.map(v => -v % -7n),
    '[-1n,-2n,-3n,-4n,0n,-1n,-1n,-2n]');
check('div big', () => EDGE.map(v => (v * v + 5n) / v),
    '[2147483647n,2147483648n,4294967295n,4294967296n,9223372036854775807n,9223372036854775808n,18446744073709551615n,18446744073709551616n]');
check('rem big', () => EDGE.map(v => (v * v + 5n) % v),
    '[5n,5n,5n,5n,5n,5n,5n,5n]');
check('div signs small', () => [7n / 2n, -7n / 2n, 7n / -2n, -7n / -2n, 7n % 2n, -7n % 2n, 7n % -2n, -7n % -2n],
    '[3n,-3n,-3n,3n,1n,-1n,1n,-1n]');
check('div by zero', () => 1n / 0n,
    'throws RangeError');
check('rem by zero', () => 1n % 0n,
    'throws RangeError');
check('pow', () => [2n ** 0n, 2n ** 31n, 2n ** 32n, 2n ** 63n, 2n ** 64n, (-2n) ** 63n, (-2n) ** 64n, 3n ** 100n, 10n ** 30n, 0n ** 0n],
    '[1n,2147483648n,4294967296n,9223372036854775808n,18446744073709551616n,-9223372036854775808n,18446744073709551616n,515377520732011331036461129765621272702107522001n,1000000000000000000000000000000n,1n]');
check('pow neg exp', () => 2n ** -1n,
    'throws RangeError');
check('shl', () => [1n << 30n, 1n << 31n, 1n << 32n, 1n << 62n, 1n << 63n, 1n << 64n, 1n << 65n, -1n << 31n, -1n << 32n, -1n << 63n, -1n << 64n, 5n << 0n, 3n << 100n],
    '[1073741824n,2147483648n,4294967296n,4611686018427387904n,9223372036854775808n,18446744073709551616n,36893488147419103232n,-2147483648n,-4294967296n,-9223372036854775808n,-18446744073709551616n,5n,3802951800684688204490109616128n]');
check('shr', () => EDGE.map(v => [v >> 1n, v >> 31n, v >> 32n, v >> 33n, v >> 63n, v >> 64n, v >> 200n]),
    '[[1073741823n,0n,0n,0n,0n,0n,0n],[1073741824n,1n,0n,0n,0n,0n,0n],[2147483647n,1n,0n,0n,0n,0n,0n],[2147483648n,2n,1n,0n,0n,0n,0n],[4611686018427387903n,4294967295n,2147483647n,1073741823n,0n,0n,0n],[4611686018427387904n,4294967296n,2147483648n,1073741824n,1n,0n,0n],[9223372036854775807n,8589934591n,4294967295n,2147483647n,1n,0n,0n],[9223372036854775808n,8589934592n,4294967296n,2147483648n,2n,1n,0n]]');
check('shr neg', () => EDGE.map(v => [-v >> 1n, -v >> 31n, -v >> 32n, -v >> 33n, -v >> 63n, -v >> 64n, -v >> 200n]),
    '[[-1073741824n,-1n,-1n,-1n,-1n,-1n,-1n],[-1073741824n,-1n,-1n,-1n,-1n,-1n,-1n],[-2147483648n,-2n,-1n,-1n,-1n,-1n,-1n],[-2147483648n,-2n,-1n,-1n,-1n,-1n,-1n],[-4611686018427387904n,-4294967296n,-2147483648n,-1073741824n,-1n,-1n,-1n],[-4611686018427387904n,-4294967296n,-2147483648n,-1073741824n,-1n,-1n,-1n],[-9223372036854775808n,-8589934592n,-4294967296n,-2147483648n,-2n,-1n,-1n],[-9223372036854775808n,-8589934592n,-4294967296n,-2147483648n,-2n,-1n,-1n]]');
check('shift by negative', () => [8n << -1n, 8n >> -1n, 2n ** 64n << -32n, 1n >> -64n, -5n >> 1n, -5n >> 100n],
    '[4n,16n,4294967296n,18446744073709551616n,-3n,-1n]');
check('and', () => EDGE.map(v => [v & 0xffn, v & -1n, v & -256n, -v & 0xffffffffffffn, v & (v - 1n)]),
    '[[255n,2147483647n,2147483392n,281472829227009n,2147483646n],[0n,2147483648n,2147483648n,281472829227008n,0n],[255n,4294967295n,4294967040n,281470681743361n,4294967294n],[0n,4294967296n,4294967296n,281470681743360n,0n],[255n,9223372036854775807n,9223372036854775552n,1n,9223372036854775806n],[0n,9223372036854775808n,9223372036854775808n,0n,0n],[255n,18446744073709551615n,18446744073709551360n,1n,18446744073709551614n],[0n,18446744073709551616n,18446744073709551616n,0n,0n]]');
check('or', () => EDGE.map(v => [v | 1n, v | -1n, -v | 0xffn, v | (1n << 70n)]),
    '[[2147483647n,-1n,-2147483393n,1180591620719558787071n],[2147483649n,-1n,-2147483393n,1180591620719558787072n],[4294967295n,-1n,-4294967041n,1180591620721706270719n],[4294967297n,-1n,-4294967041n,1180591620721706270720n],[9223372036854775807n,-1n,-9223372036854775553n,1189814992754266079231n],[9223372036854775809n,-1n,-9223372036854775553n,1189814992754266079232n],[18446744073709551615n,-1n,-18446744073709551361n,1199038364791120855039n],[18446744073709551617n,-1n,-18446744073709551361n,1199038364791120855040n]]');
check('xor', () => EDGE.map(v => [v ^ 1n, v ^ -1n, -v ^ 0xffn, v ^ v, v ^ -v]),
    '[[2147483646n,-2147483648n,-2147483394n,0n,-2n],[2147483649n,-2147483649n,-2147483393n,0n,-4294967296n],[4294967294n,-4294967296n,-4294967042n,0n,-2n],[4294967297n,-4294967297n,-4294967041n,0n,-8589934592n],[9223372036854775806n,-9223372036854775808n,-9223372036854775554n,0n,-2n],[9223372036854775809n,-9223372036854775809n,-9223372036854775553n,0n,-18446744073709551616n],[18446744073709551614n,-18446744073709551616n,-18446744073709551362n,0n,-2n],[18446744073709551617n,-18446744073709551617n,-18446744073709551361n,0n,-36893488147419103232n]]');
check('not', () => EDGE.map(v => [~v, ~-v]),
    '[[-2147483648n,2147483646n],[-2147483649n,2147483647n],[-4294967296n,4294967294n],[-4294967297n,4294967295n],[-9223372036854775808n,9223372036854775806n],[-9223372036854775809n,9223372036854775807n],[-18446744073709551616n,18446744073709551614n],[-18446744073709551617n,18446744073709551615n]]');
check('inc dec', () => EDGE.map(v => { var a = v, b = v; a++; b--; return [a, b, ++a, --b]; }),
    '[[2147483648n,2147483646n,2147483649n,2147483645n],[2147483649n,2147483647n,2147483650n,2147483646n],[4294967296n,4294967294n,4294967297n,4294967293n],[4294967297n,4294967295n,4294967298n,4294967294n],[9223372036854775808n,9223372036854775806n,9223372036854775809n,9223372036854775805n],[9223372036854775809n,9223372036854775807n,9223372036854775810n,9223372036854775806n],[18446744073709551616n,18446744073709551614n,18446744073709551617n,18446744073709551613n],[18446744073709551617n,18446744073709551615n,18446744073709551618n,18446744073709551614n]]');
check('compare bigint', () => EDGE.map((v, i) => [v < EDGE[(i + 1) % 8], v > -v, v == v + 0n, v === v * 1n, -v < v, v <= v, v >= v + 1n]),
    '[[true,true,true,true,true,true,false],[true,true,true,true,true,true,false],[true,true,true,true,true,true,false],[true,true,true,true,true,true,false],[true,true,true,true,true,true,false],[true,true,true,true,true,true,false],[true,true,true,true,true,true,false],[false,true,true,true,true,true,false]]');
check('compare number', () => [1n < 2, 2 > 1n, 1n == 1, 1n === 1, 2n ** 53n == 2 ** 53, 2n ** 53n + 1n == 2 ** 53 + 1, 2n ** 53n + 1n > 2 ** 53, 2n ** 64n > 1.8446744073709552e19, 2n ** 64n == 1.8446744073709552e19, 2n ** 64n < Infinity, -(2n ** 64n) > -Infinity, 1n < NaN, 1n > NaN, 1n == NaN, 0n == -0, 1n < 1.5, 2n > 1.5, -1n > -1.5, 2n ** 1024n > 1.7976931348623157e308, 2n ** 1024n == Infinity, 9007199254740993n > 9007199254740992, 9007199254740993n < 9007199254740994],
    '[true,true,true,false,true,false,true,false,true,true,true,false,false,false,true,true,true,true,true,false,true,true]');
check('compare string', () => [1n == '1', 2n > '1', 1n < '2', 1n == 'x', 1n < 'x', 18446744073709551616n == '18446744073709551616', 0n == '', 255n == '0xff'],
    '[true,true,true,false,false,true,true,true]');
check('sort mixed', () => [3n, 1, 2n, -1, 2n ** 64n, 1e3, -(2n ** 64n)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    '[-18446744073709551616n,-1,1,2n,3n,1000,18446744073709551616n]');
check('Number()', () => VALS.map(v => Number(v)),
    '[0,1,-1,127,128,-128,255,256,2147483647,2147483648,-2147483648,-2147483649,4294967295,4294967296,-4294967296,9223372036854776000,9223372036854776000,-9223372036854776000,-9223372036854776000,18446744073709552000,18446744073709552000,-18446744073709552000,1.512366075204171e+36,-1.512366075204171e+36]');
check('Number() rounding', () => [9007199254740993n, 9007199254740995n, 9007199254740992n + 3n, 2n ** 64n + 2n ** 11n, 2n ** 64n + 2n ** 11n + 1n, 2n ** 64n + 3n * 2n ** 11n, 2n ** 1023n, 2n ** 1024n - 1n, 2n ** 1024n, -(2n ** 1024n), 2n ** 1024n - 2n ** 970n, 2n ** 1024n - 2n ** 970n - 1n].map(Number),
    '[9007199254740992,9007199254740996,9007199254740996,18446744073709552000,18446744073709556000,18446744073709560000,8.98846567431158e+307,Infinity,Infinity,-Infinity,Infinity,1.7976931348623157e+308]');
check('BigInt(number)', () => [0, -0, 1, -1, 2147483647, 2147483648, -2147483648, 4294967295, 4294967296, 2 ** 53, -(2 ** 53), 2 ** 63, 2 ** 64, 1e21, 1e30, -1e30, 1.7976931348623157e308, 123456789012345680000].map(BigInt),
    '[0n,0n,1n,-1n,2147483647n,2147483648n,-2147483648n,4294967295n,4294967296n,9007199254740992n,-9007199254740992n,9223372036854775808n,18446744073709551616n,1000000000000000000000n,1000000000000000019884624838656n,-1000000000000000019884624838656n,179769313486231570814527423731704356798070567525844996598917476803157260780028538760589558632766878171540458953514382464234321326889464182768467546703537516986049910576551282076245490090389328944075868508455133942304583236903222948165808559332123348274797826204144723168738177180919299881250404026184124858368n,123456789012345683968n]');
check('BigInt(1.5)', () => BigInt(1.5),
    'throws RangeError');
check('BigInt(NaN)', () => BigInt(NaN),
    'throws RangeError');
check('BigInt(Infinity)', () => BigInt(Infinity),
    'throws RangeError');
check('BigInt(string)', () => ['0', '-0', '  12  ', '0x10', '0o17', '0b101', '-5', '+5', '18446744073709551616', '-18446744073709551616', '0xffffffffffffffffffffffff', '', '\n', '000123'].map(BigInt),
    '[0n,0n,12n,16n,15n,5n,-5n,5n,18446744073709551616n,-18446744073709551616n,79228162514264337593543950335n,0n,0n,123n]');
check('BigInt bad strings', () => ['1.5', '1e3', '-0x10', '1n', 'abc', '0x', '1 2'].map(s => { try { return BigInt(s); } catch (e) { return e.name; } }),
    '["SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError"]');
check('BigInt(bool etc)', () => [BigInt(true), BigInt(false), BigInt([5]), BigInt({ valueOf() { return 7n; } })],
    '[1n,0n,5n,7n]');
check('BigInt(undefined)', () => BigInt(undefined),
    'throws TypeError');
check('BigInt(null)', () => BigInt(null),
    'throws TypeError');
check('BigInt(symbol)', () => BigInt(Symbol()),
    'throws TypeError');
check('toString 2', () => VALS.map(v => v.toString(2)),
    '["0","1","-1","1111111","10000000","-10000000","11111111","100000000","1111111111111111111111111111111","10000000000000000000000000000000","-10000000000000000000000000000000","-10000000000000000000000000000001","11111111111111111111111111111111","100000000000000000000000000000000","-100000000000000000000000000000000","111111111111111111111111111111111111111111111111111111111111111","1000000000000000000000000000000000000000000000000000000000000000","-1000000000000000000000000000000000000000000000000000000000000000","-1000000000000000000000000000000000000000000000000000000000000001","1111111111111111111111111111111111111111111111111111111111111111","10000000000000000000000000000000000000000000000000000000000000000","-10000000000000000000000000000000000000000000000000000000000000000","1001000110100010101100111100010011010101111001101111011110000000100100011010001010110011110001001101010111100110111101111","-1001000110100010101100111100010011010101111001101111011110000000100100011010001010110011110001001101010111100110111101111"]');
check('toString 8', () => VALS.map(v => v.toString(8)),
    '["0","1","-1","177","200","-200","377","400","17777777777","20000000000","-20000000000","-20000000001","37777777777","40000000000","-40000000000","777777777777777777777","1000000000000000000000","-1000000000000000000000","-1000000000000000000001","1777777777777777777777","2000000000000000000000","-2000000000000000000000","11064254742325715736004432126361152746757","-11064254742325715736004432126361152746757"]');
check('toString 10', () => VALS.map(v => v.toString(10)),
    '["0","1","-1","127","128","-128","255","256","2147483647","2147483648","-2147483648","-2147483649","4294967295","4294967296","-4294967296","9223372036854775807","9223372036854775808","-9223372036854775808","-9223372036854775809","18446744073709551615","18446744073709551616","-18446744073709551616","1512366075204170929049582354406559215","-1512366075204170929049582354406559215"]');
check('toString 16', () => VALS.map(v => v.toString(16)),
    '["0","1","-1","7f","80","-80","ff","100","7fffffff","80000000","-80000000","-80000001","ffffffff","100000000","-100000000","7fffffffffffffff","8000000000000000","-8000000000000000","-8000000000000001","ffffffffffffffff","10000000000000000","-10000000000000000","123456789abcdef0123456789abcdef","-123456789abcdef0123456789abcdef"]');
check('toString 36', () => VALS.map(v => v.toString(36)),
    '["0","1","-1","3j","3k","-3k","73","74","zik0zj","zik0zk","-zik0zk","-zik0zl","1z141z3","1z141z4","-1z141z4","1y2p0ij32e8e7","1y2p0ij32e8e8","-1y2p0ij32e8e8","-1y2p0ij32e8e9","3w5e11264sgsf","3w5e11264sgsg","-3w5e11264sgsg","2fapl4n1azs5kkwzrxa98bn3","-2fapl4n1azs5kkwzrxa98bn3"]');
check('toString 3', () => VALS.map(v => v.toString(3)),
    '["0","1","-1","11201","11202","-11202","100110","100111","12112122212110202101","12112122212110202102","-12112122212110202102","-12112122212110202110","102002022201221111210","102002022201221111211","-102002022201221111211","2021110011022210012102010021220101220221","2021110011022210012102010021220101220222","-2021110011022210012102010021220101220222","-2021110011022210012102010021220101221000","11112220022122120101211020120210210211220","11112220022122120101211020120210210211221","-11112220022122120101211020120210210211221","2111010112220000212021122210010202012202002102002222120101120102221201200210","-2111010112220000212021122210010202012202002102002222120101120102221201200210"]');
check('toString 7', () => VALS.map(v => v.toString(7)),
    '["0","1","-1","241","242","-242","513","514","104134211161","104134211162","-104134211162","-104134211163","211301422353","211301422354","-211301422354","22341010611245052052300","22341010611245052052301","-22341010611245052052301","-22341010611245052052302","45012021522523134134601","45012021522523134134602","-45012021522523134134602","4563526444653126251024104413064601565614004","-4563526444653126251024104413064601565614004"]');
check('toString 32', () => VALS.map(v => v.toString(32)),
    '["0","1","-1","3v","40","-40","7v","80","1vvvvvv","2000000","-2000000","-2000001","3vvvvvv","4000000","-4000000","7vvvvvvvvvvvv","8000000000000","-8000000000000","-8000000000001","fvvvvvvvvvvvv","g000000000000","-g000000000000","14d2mf2dbpnng28q5cu4qnjff","-14d2mf2dbpnng28q5cu4qnjff"]');
check('toString round trip', () => VALS.every(v => [2, 10, 16, 36].every(r => { var s = v.toString(r), neg = s[0] === '-', d = neg ? s.slice(1) : s, acc = 0n, i; for (i = 0; i < d.length; i++) acc = acc * BigInt(r) + BigInt(parseInt(d[i], r)); return (neg ? -acc : acc) === v; })),
    'true');
check('toString bad radix', () => (1n).toString(1),
    'throws RangeError');
check('toString radix 37', () => (1n).toString(37),
    'throws RangeError');
check('big decimal', () => (10n ** 100n + 1n).toString(),
    '"10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"');
check('big hex', () => (2n ** 200n - 1n).toString(16),
    '"ffffffffffffffffffffffffffffffffffffffffffffffffff"');
check('factorial 30', () => { var f = 1n, i; for (i = 1n; i <= 30n; i++) f *= i; return f; },
    '265252859812191058636308480000000n');
check('fib 200', () => { var a = 0n, b = 1n, i, t; for (i = 0; i < 200; i++) { t = a + b; a = b; b = t; } return a; },
    '280571172992510140037611932413038677189525n');
check('toLocaleString', () => typeof (123n).toLocaleString(),
    '"string"');
check('typeof', () => [typeof 1n, typeof Object(1n), typeof BigInt, Object(1n) instanceof BigInt, Object.prototype.toString.call(1n)],
    '["bigint","object","function",true,"[object BigInt]"]');
check('unary plus', () => +1n,
    'throws TypeError');
check('mix add', () => 1n + 1,
    'throws TypeError');
check('mix string concat', () => ['a' + 1n, 1n + 'a', `${2n ** 64n}`],
    '["a1","1a","18446744073709551616"]');
check('truthiness', () => [!0n, !1n, !!(2n ** 64n), 0n ? 1 : 2, -0n === 0n, Object.is(-0n, 0n)],
    '[true,false,true,2,true,true]');
check('>>> throws', () => 1n >>> 0n,
    'throws TypeError');
check('Math.max throws', () => Math.max(1n, 2n),
    'throws TypeError');
check('JSON.stringify throws', () => JSON.stringify({ a: 1n }),
    'throws TypeError');
check('JSON toJSON', () => { BigInt.prototype.toJSON = function () { return this.toString(); }; var s = JSON.stringify({ a: 2n ** 64n }); delete BigInt.prototype.toJSON; return s; },
    '"{"a":"18446744073709551616"}"');
check('Number.isInteger(1n)', () => [Number.isInteger(1n), Number.isSafeInteger(1n), isNaN === undefined],
    '[false,false,false]');
check('parseInt(bigint)', () => [parseInt(123n), parseFloat(2n ** 64n), parseInt('123n')],
    '[123,18446744073709552000,123]');
check('BigInt64Array basic', () => new BigInt64Array([0n, -1n, 2n ** 63n - 1n, -(2n ** 63n), 2n ** 63n, 2n ** 64n, 2n ** 64n + 5n, -(2n ** 64n) - 5n, 4294967296n, -4294967296n, 2147483648n]),
    'BigInt64Array[0n,-1n,9223372036854775807n,-9223372036854775808n,-9223372036854775808n,0n,5n,-5n,4294967296n,-4294967296n,2147483648n]');
check('BigUint64Array basic', () => new BigUint64Array([0n, -1n, 2n ** 63n - 1n, -(2n ** 63n), 2n ** 63n, 2n ** 64n, 2n ** 64n + 5n, -(2n ** 64n) - 5n, 4294967296n, -4294967296n, 2147483648n]),
    'BigUint64Array[0n,18446744073709551615n,9223372036854775807n,9223372036854775808n,9223372036854775808n,0n,5n,18446744073709551611n,4294967296n,18446744069414584320n,2147483648n]');
check('BigInt64Array bytes', () => new Uint8Array(new BigInt64Array([0x0102030405060708n, -2n]).buffer).length,
    '16');
check('BigInt64Array number throws', () => { var a = new BigInt64Array(1); a[0] = 1; return a; },
    'throws TypeError');
check('BigUint64Array shared buffer', () => { var b = new ArrayBuffer(16), s = new BigInt64Array(b), u = new BigUint64Array(b); s[0] = -1n; s[1] = -(2n ** 63n); return [u[0], u[1], s[0], s[1]]; },
    '[18446744073709551615n,9223372036854775808n,-1n,-9223372036854775808n]');
check('BigInt64Array methods', () => { var a = new BigInt64Array([5n, -3n, 2n ** 40n, -(2n ** 40n), 0n]); return [a.slice().sort(), a.indexOf(2n ** 40n), a.includes(-3n), a.map(x => x * 2n), a.reduce((x, y) => x + y, 0n), a.join(','), Array.from(a.subarray(1, 3)), a.fill(7n, 3).at(-1), a.findLast(x => x < 0n)]; },
    '[BigInt64Array[-1099511627776n,-3n,0n,5n,1099511627776n],2,true,BigInt64Array[10n,-6n,2199023255552n,-2199023255552n,0n],2n,"5,-3,1099511627776,-1099511627776,0",[-3n,1099511627776n],7n,-3n]');
check('BigUint64Array sort', () => new BigUint64Array([2n ** 64n - 1n, 0n, 2n ** 63n, 2n ** 32n, 1n, 2n ** 63n - 1n]).sort(),
    'BigUint64Array[0n,1n,4294967296n,9223372036854775807n,9223372036854775808n,18446744073709551615n]');
check('BigInt64Array sort', () => new BigInt64Array([2n ** 63n - 1n, 0n, -(2n ** 63n), 2n ** 32n, -1n, -(2n ** 32n)]).sort(),
    'BigInt64Array[-9223372036854775808n,-4294967296n,-1n,0n,4294967296n,9223372036854775807n]');
check('DataView setBigInt64 BE', () => { var d = new DataView(new ArrayBuffer(8)); d.setBigInt64(0, -0x0102030405060708n); return Array.from(new Uint8Array(d.buffer)); },
    '[254,253,252,251,250,249,248,248]');
check('DataView setBigInt64 LE', () => { var d = new DataView(new ArrayBuffer(8)); d.setBigInt64(0, -0x0102030405060708n, true); return Array.from(new Uint8Array(d.buffer)); },
    '[248,248,249,250,251,252,253,254]');
check('DataView setBigUint64 BE', () => { var d = new DataView(new ArrayBuffer(8)); d.setBigUint64(0, 0xf1f2f3f4f5f6f7f8n); return Array.from(new Uint8Array(d.buffer)); },
    '[241,242,243,244,245,246,247,248]');
check('DataView setBigUint64 LE', () => { var d = new DataView(new ArrayBuffer(8)); d.setBigUint64(0, 0xf1f2f3f4f5f6f7f8n, true); return Array.from(new Uint8Array(d.buffer)); },
    '[248,247,246,245,244,243,242,241]');
check('DataView getBig*', () => { var d = new DataView(new Uint8Array([0x80, 1, 2, 3, 4, 5, 6, 0xff, 0x7f]).buffer); return [d.getBigInt64(0), d.getBigInt64(0, true), d.getBigUint64(0), d.getBigUint64(0, true), d.getBigInt64(1), d.getBigUint64(1, true)]; },
    '[-9223088349902469377n,-70363229389192832n,9223655723807082239n,18376380844320358784n,72623859790446463n,9223097180489974273n]');
check('DataView round trip', () => VALS.map(v => { var d = new DataView(new ArrayBuffer(16)); d.setBigInt64(3, v); d.setBigUint64(8, v, true); return [d.getBigInt64(3), d.getBigUint64(8, true)]; }),
    '[[0n,0n],[65536n,1n],[-1n,18446744073709551615n],[8323072n,127n],[8388608n,128n],[-8323073n,18446744073709551488n],[16711680n,255n],[256n,256n],[2147483647n,2147483647n],[2147483648n,2147483648n],[-2147483648n,18446744071562067968n],[-2147483649n,18446744071562067967n],[4294967295n,4294967295n],[4294967296n,4294967296n],[-4294967296n,18446744069414584320n],[9223372036854775807n,9223372036854775807n],[-9223372036854775808n,9223372036854775808n],[-9223372036854775808n,9223372036854775808n],[9223372036854775807n,9223372036854775807n],[-1n,18446744073709551615n],[0n,0n],[0n,0n],[81985529220943275n,81985529216486895n],[-81985529220877740n,18364758544493064721n]]');
check('DataView range', () => new DataView(new ArrayBuffer(8)).getBigInt64(1),
    'throws RangeError');
check('typed array from DataView', () => { var d = new DataView(new ArrayBuffer(8)); d.setBigUint64(0, 0x0102030405060708n, true); return [new BigUint64Array(d.buffer)[0] === d.getBigUint64(0, false) || new BigUint64Array(d.buffer)[0] === d.getBigUint64(0, true)]; },
    '[true]');
check('hash keys', () => { var m = new Map([[1n, 'a'], [2n ** 64n, 'b'], [1, 'c']]); return [m.get(1n), m.get(2n ** 64n), m.get(1), m.size, new Set([1n, 1n, 2n ** 64n, 2n ** 64n, 1]).size]; },
    '["a","b","c",3,3]');
check('property key', () => { var o = {}; o[1n] = 'a'; o[2n ** 64n] = 'b'; return [Object.keys(o), o['1'], o['18446744073709551616'], [10, 20, 30][1n]]; },
    '[["1","18446744073709551616"],"a","b",20]');
check('string index/ops', () => ['abc'.repeat(2), [1n, 2n, 3n].join('-'), String([2n ** 64n]), (2n ** 64n).toString().length],
    '["abcabc","1-2-3","18446744073709551616",20]');
check('gcd big', () => { function g(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; } return g(2n ** 127n - 1n, 2n ** 61n - 1n) + g(10n ** 40n, 6n ** 40n); },
    '1099511627777n');
check('modpow', () => { function mp(b, e, m) { var r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; } return [mp(2n, 1000n, 1000000007n), mp(3n, 2n ** 64n, 2n ** 61n - 1n), mp(7n, 123456789n, 2n ** 89n - 1n)]; },
    '[688423210n,43046721n,539876195698677932762130776n]');
check('isqrt', () => { function sq(n) { var x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; } return [sq(10n ** 40n), sq(2n ** 127n), sq(2n ** 64n - 1n)]; },
    '[100000000000000000000n,13043817825332782212n,4294967295n]');
check('long division identity', () => { var ok = true, a = 0x123456789abcdef0123456789abcdef0123456789n, d, i; for (i = 1n; i < 200n; i++) { d = (i * 0x9e3779b97f4a7c15n) ^ (i << 70n); [a, -a].forEach(x => [d, -d].forEach(y => { if ((x / y) * y + (x % y) !== x) ok = false; if (x % y !== 0n && (x % y < 0n) !== (x < 0n)) ok = false; })); } return ok; },
    'true');
check('mul/div 32-bit boundaries', () => { var ok = [], xs = [0xffffffffn, 0x100000000n, 0x100000001n, 0x7fffffffn, 0x80000000n, 0x80000001n, 0xffffffffffffffffn, 0x10000000000000000n, 0xfffffffffffffffffffffffn], i, j; for (i = 0; i < xs.length; i++) for (j = 0; j < xs.length; j++) { var p = xs[i] * xs[j]; if (p / xs[j] !== xs[i] || p % xs[j] !== 0n || (p + 1n) % xs[j] !== (xs[j] === 1n ? 0n : 1n) || (-p) / xs[i] !== -xs[j]) ok.push([i, j]); } return ok; },
    '[]');
check('products', () => [0xffffffffn * 0xffffffffn, 0x100000000n * 0x100000000n, 0xffffffffffffffffn * 0xffffffffffffffffn, -0x80000000n * -0x80000000n, -0x80000000n * 0x80000000n, 0x7fffffffn * 0x7fffffffn, -0x8000000000000000n * -0x8000000000000000n, 46341n * 46341n, 65536n * 65536n, -65536n * 65536n, 3037000500n * 3037000500n],
    '[18446744065119617025n,18446744073709551616n,340282366920938463426481119284349108225n,4611686018427387904n,-4611686018427387904n,4611686014132420609n,85070591730234615865843651857942052864n,2147488281n,4294967296n,-4294967296n,9223372037000250000n]');
check('sums', () => [0x7fffffffn + 1n, -0x80000000n - 1n, 0xffffffffn + 1n, 0x7fffffffn + 0x7fffffffn, -0x80000000n + -0x80000000n, 0x7fffffffffffffffn + 1n, -0x8000000000000000n - 1n, 0xffffffffffffffffn + 1n, 0x100000000n - 1n, 0x10000000000000000n - 1n, 0n - 0x80000000n, 0n - -0x80000000n],
    '[2147483648n,-2147483649n,4294967296n,4294967294n,-4294967296n,9223372036854775808n,-9223372036854775809n,18446744073709551616n,4294967295n,18446744073709551615n,-2147483648n,2147483648n]');
check('literal forms', () => [0x10n, 0o17n, 0b101n, 1_000_000n, 0xFFFF_FFFF_FFFF_FFFFn],
    '[16n,15n,5n,1000000n,18446744073709551615n]');
check('toString small ints all radix', () => { var out = [], r; for (r = 2; r <= 36; r++) out.push((-1295n).toString(r)); return out; },
    '["-10100001111","-1202222","-110033","-20140","-5555","-3530","-2417","-1688","-1295","-a78","-8bb","-788","-687","-5b5","-50f","-483","-3hh","-3b3","-34f","-2je","-2ej","-2a7","-25n","-21k","-1nl","-1kq","-1i7","-1fj","-1d5","-1ao","-18f","-168","-143","-120","-zz"]');
check('BigInt.prototype.valueOf', () => [Object(5n).valueOf(), BigInt.prototype.valueOf.call(7n)],
    '[5n,7n]');
check('exponent tower', () => (2n ** 10n) ** 10n === 2n ** 100n,
    'true');
check('big compare ordering', () => { var xs = [-(2n ** 64n), -(2n ** 63n) - 1n, -(2n ** 63n), -(2n ** 32n), -(2n ** 31n) - 1n, -(2n ** 31n), -1n, 0n, 1n, 2n ** 31n - 1n, 2n ** 31n, 2n ** 32n, 2n ** 63n - 1n, 2n ** 63n, 2n ** 64n], bad = [], i, j; for (i = 0; i < xs.length; i++) for (j = 0; j < xs.length; j++) { if ((xs[i] < xs[j]) !== (i < j) || (xs[i] <= xs[j]) !== (i <= j) || (xs[i] == xs[j]) !== (i === j) || (xs[i] > xs[j]) !== (i > j)) bad.push([i, j]); if ((Number(xs[i]) < xs[j]) !== (i < j) && Number(xs[i]) != xs[i]) { /* rounded */ } } return bad; },
    '[]');
check('number vs bigint ordering', () => { var ns = [-1.8446744073709552e19, -9223372036854775808, -4294967296, -2147483648.5, -2147483648, -1.5, -0.5, 0, 0.5, 1.5, 2147483647, 2147483647.5, 4294967295.5, 4294967296, 9223372036854775808, 1.8446744073709552e19], bs = [-(2n ** 64n), -(2n ** 63n), -(2n ** 32n), -(2n ** 31n), -1n, 0n, 1n, 2n ** 31n - 1n, 2n ** 31n, 2n ** 32n - 1n, 2n ** 32n, 2n ** 63n, 2n ** 64n], out = []; bs.forEach(b => { var row = ''; ns.forEach(n => { row += b < n ? '<' : b > n ? '>' : b == n ? '=' : '?'; }); out.push(row); }); return out; },
    '["=<<<<<<<<<<<<<<<",">=<<<<<<<<<<<<<<",">>=<<<<<<<<<<<<<",">>>>=<<<<<<<<<<<",">>>>>><<<<<<<<<<",">>>>>>>=<<<<<<<<",">>>>>>>>><<<<<<<",">>>>>>>>>>=<<<<<",">>>>>>>>>>>><<<<",">>>>>>>>>>>><<<<",">>>>>>>>>>>>>=<<",">>>>>>>>>>>>>>=<",">>>>>>>>>>>>>>>="]');

section('B. Number: toString(radix) for the power-of-two radices, toFixed/toPrecision/toExponential, parseInt/parseFloat, integer conversions');
var NUMS = [0, -0, 1, -1, 0.5, -0.5, 0.1, 0.2, 0.3, 1 / 3, 2 / 3, 0.1 + 0.2, 255, 256, -255.5, 1e21, -1e21, 1e22, 1e23, 1e100, 1e300, 1.7976931348623157e308, 5e-324, 2.2250738585072014e-308, 1e-7, 1e-10, 1.5e-20, 123456789.123456789, 2147483647, 2147483648, 4294967295, 4294967296, 9007199254740991, 9007199254740992, 9007199254740993, 18446744073709551616, 0.000001, 1e-6, 123.456, -123.456, 3.141592653589793, 2.718281828459045, 1e15 + 0.5, 4503599627370496.5, 4503599627370495.5, 0.999999999999, 35.999999, 1295.5, 1 / 1024, 1 / 1296, 0.015625, 2 ** -30, 2 ** 70 + 2 ** 20, 6 ** 20, 36 ** 10, 36 ** 12, 36 ** 13, 7 ** 25, 1e21 + 2 ** 20, 123456789012345680000, 0.1 * 3, 1e-5, 1.1e-5, 100, 1000000, 0.75, 1 / 7];
check('toString(16)', () => NUMS.map(n => n.toString(16)),
    '["0","0","1","-1","0.8","-0.8","0.1999999999999a","0.33333333333334","0.4ccccccccccccc","0.55555555555554","0.aaaaaaaaaaaaa8","0.4cccccccccccd","ff","100","-ff.8","3635c9adc5dea00000","-3635c9adc5dea00000","21e19e0c9bab2400000","152d02c7e14af6000000","1249ad2594c37d0000000000000000000000000000000000000000000000000000000000000000000000","17e43c8800759c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","fffffffffffff800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","0.00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004","0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004","0.000001ad7f29abcaf48","0.000000006df37f675ef6ec","0.000000000000000046d5e325b6c66c","75bcd15.1f9add4","7fffffff","80000000","ffffffff","100000000","1fffffffffffff","20000000000000","20000000000000","10000000000000000","0.000010c6f7a0b5ed8d","0.000010c6f7a0b5ed8d","7b.74bc6a7ef9dc","-7b.74bc6a7ef9dc","3.243f6a8885a3","2.b7e151628aed2","38d7ea4c68000.8","10000000000000","fffffffffffff.8","0.fffffffffee688","23.ffffef39086","50f.8","0.004","0.00329161f9add3c","0.04","0.00000004","400000000000100000","cfd41b9100000","cfd41b9100000","41c21cb8e1000000","93f4c09ffa4000000","48b310d44c5e100000","3635c9adc5deb00000","6b14e9f812f368000","0.4cccccccccccd","0.0000a7c5ac471b4788","0.0000b88ca3e7d1351","64","f4240","0.c","0.24924924924924"]');
check('toString(32)', () => NUMS.map(n => n.toString(32)),
    '["0","0","1","-1","0.g","-0.g","0.36cpj6cpj6d","0.6cpj6cpj6cq","0.9j6cpj6cpj6","0.alalalalala","0.lalalalalak","0.9j6cpj6cpj8","7v","80","-7v.g","r3biddonfa0000","-r3biddonfa0000","8f1jo69nap40000","2kmg5hv19br00000","4i9lkip9grt00000000000000000000000000000000000000000000000000000000","2vi3p200eme000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","fvvvvvvvvvu00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","0.00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002","0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008","0.00003bbv56lslt4","0.0000003dudvmennmtg","0.0000000000000hmlscirdhjc","3lnj8l.3uddqg","1vvvvvv","2000000","3vvvvvv","4000000","7vvvvvvvvvv","80000000000","80000000000","g000000000000","0.00011hnnk2qur38","0.00011hnnk2qur38","3r.eiu6kvnprg","-3r.eiu6kvnprg","3.4gvml245kc","2.mvgl2okatkg","sdfqicd000.g","40000000000","3vvvvvvvvvv.g","0.vvvvvvvusq4","13.vvvuue88c","18f.g","0.01","0.00p92ofpln9s","0.0g","0.000001","100000000010000","37t86sh0000","37t86sh0000","43ggsn3gg0000","4juj09vui00000","14b646k9hf10000","r3biddonfb0000","3b2jkvg4njd000","0.9j6cpj6cpj8","0.000afhdc8sdkf2","0.000bh353sv8ja4","34","ugi0","0.o","0.4i94i94i94i"]');
check('toString(10)', () => NUMS.map(n => n.toString(10)),
    '["0","0","1","-1","0.5","-0.5","0.1","0.2","0.3","0.3333333333333333","0.6666666666666666","0.30000000000000004","255","256","-255.5","1e+21","-1e+21","1e+22","1e+23","1e+100","1e+300","1.7976931348623157e+308","5e-324","2.2250738585072014e-308","1e-7","1e-10","1.5e-20","123456789.12345679","2147483647","2147483648","4294967295","4294967296","9007199254740991","9007199254740992","9007199254740992","18446744073709552000","0.000001","0.000001","123.456","-123.456","3.141592653589793","2.718281828459045","1000000000000000.5","4503599627370496","4503599627370495.5","0.999999999999","35.999999","1295.5","0.0009765625","0.0007716049382716049","0.015625","9.313225746154785e-10","1.1805916207174124e+21","3656158440062976","3656158440062976","4738381338321617000","170581728179578200000","1.341068619663965e+21","1.000000000000001e+21","123456789012345680000","0.30000000000000004","0.00001","0.000011","100","1000000","0.75","0.14285714285714285"]');
check('specials', () => [NaN.toString(16), Infinity.toString(2), (-Infinity).toString(36), (0).toString(2), (-0).toString(2)],
    '["NaN","Infinity","-Infinity","0","0"]');
check('radix errors', () => [1, 37, 0, -1, 2.5, 36.9, '16', undefined, null, NaN].map(x => { try { return (255).toString(x); } catch (e) { return e.name; } }),
    '["RangeError","RangeError","RangeError","RangeError","11111111","73","ff","255","RangeError","RangeError"]');
check('parseInt', () => ['0x1f', '0X1F', '  42px', '-0', '077', '1e3', '', 'z', '9007199254740993', '123456789012345678901234567890', '-0x10', '+5', '0b11', '1_000', '\u00a012', '0.9', '-.5', 'Infinity'].map(s => parseInt(s)),
    '[31,31,42,-0,77,1,NaN,NaN,9007199254740992,1.2345678901234568e+29,-16,5,0,1,12,0,NaN,NaN]');
check('parseInt radix', () => [['ff', 16], ['FF', 16], ['zz', 36], ['ZZ', 36], ['111', 2], ['12', 2], ['2', 2], ['777', 8], ['0x10', 16], ['0x10', 10], ['0x10', 0], ['10', 37], ['10', 1], ['10', -5], ['10', 2.9], ['10', '16'], ['1'.repeat(60), 2], ['f'.repeat(20), 16], ['z'.repeat(15), 36], ['8000000000000000', 16], ['20000000000000', 16], ['20000000000001', 16], ['1fffffffffffff', 16], ['3ffffffffffffe', 16], ['3fffffffffffff', 16]].map(a => parseInt(a[0], a[1])),
    '[255,255,1295,1295,7,1,NaN,511,16,0,16,NaN,NaN,NaN,2,16,1152921504606847000,1.2089258196146292e+24,2.2107391972073336e+23,9223372036854776000,9007199254740992,9007199254740992,9007199254740991,18014398509481982,18014398509481984]');
check('parseFloat', () => ['1.5', '.5', '5.', '-1e3', '1e-3', '1e', '1e+', '0x10', 'Infinity', '-Infinity', 'infinity', 'NaN', '  3.14abc', '1.7976931348623157e308', '1.7976931348623159e308', '5e-324', '2e-324', '3e-324', '4.9e-324', '1e400', '-1e400', '0.1e1', '1_0', '', '.', '-.', '+.5e1', '123456789012345678901234567890', '9007199254740993', '0.30000000000000004', '1.0000000000000002', '4.35', '0.000001', '1e23', '8.5e-320', '2.2250738585072011e-308'].map(parseFloat),
    '[1.5,0.5,5,-1000,0.001,1,1,0,Infinity,-Infinity,NaN,NaN,3.14,1.7976931348623157e+308,Infinity,5e-324,0,5e-324,5e-324,Infinity,-Infinity,1,1,NaN,NaN,NaN,5,1.2345678901234568e+29,9007199254740992,0.30000000000000004,1.0000000000000002,4.35,0.000001,1e+23,8.5e-320,2.225073858507201e-308]');
check('Number()', () => ['', ' ', '0x1F', '0b101', '0o17', '1e3', '-1e-3', '.5', '5.', '1_0', '12px', 'Infinity', '-Infinity', '+Infinity', 'infinity', '0x', '-0x10', ' 12 ', '\n1\t', '1e1000', '-0', '0.0000001', '00012', '1.', '.', 'e5', '1e', '\u00a01\ufeff'].map(Number),
    '[0,0,31,5,15,1000,-0.001,0.5,5,NaN,NaN,Infinity,-Infinity,Infinity,NaN,NaN,NaN,12,1,Infinity,-0,1e-7,12,1,NaN,NaN,NaN,1]');
check('float round trip default', () => NUMS.map(n => Number(String(n)) === n || Object.is(Number(String(n)), n)),
    '[true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true]');
check('String(number)', () => NUMS.map(String),
    '["0","0","1","-1","0.5","-0.5","0.1","0.2","0.3","0.3333333333333333","0.6666666666666666","0.30000000000000004","255","256","-255.5","1e+21","-1e+21","1e+22","1e+23","1e+100","1e+300","1.7976931348623157e+308","5e-324","2.2250738585072014e-308","1e-7","1e-10","1.5e-20","123456789.12345679","2147483647","2147483648","4294967295","4294967296","9007199254740991","9007199254740992","9007199254740992","18446744073709552000","0.000001","0.000001","123.456","-123.456","3.141592653589793","2.718281828459045","1000000000000000.5","4503599627370496","4503599627370495.5","0.999999999999","35.999999","1295.5","0.0009765625","0.0007716049382716049","0.015625","9.313225746154785e-10","1.1805916207174124e+21","3656158440062976","3656158440062976","4738381338321617000","170581728179578200000","1.341068619663965e+21","1.000000000000001e+21","123456789012345680000","0.30000000000000004","0.00001","0.000011","100","1000000","0.75","0.14285714285714285"]');
check('more String(number)', () => [1e21, 1e-7, 123456789012345680000, 0.000001, 1e20, 999999999999999900000, 1.5e-7, 4.35, 0.1 + 0.7, 1.005, 5e-324, 1.7976931348623157e308, 100, 1e5, 123e-20, 0.5e-6, 2 ** 53, 2 ** 64, 2 ** -1074, 4.9e-324, 1.2345678901234567e-300, 1 / 3, -1 / 3, 9.5e-7, 1e21 - 65536].map(String),
    '["1e+21","1e-7","123456789012345680000","0.000001","100000000000000000000","999999999999999900000","1.5e-7","4.35","0.7999999999999999","1.005","5e-324","1.7976931348623157e+308","100","100000","1.23e-18","5e-7","9007199254740992","18446744073709552000","5e-324","5e-324","1.2345678901234568e-300","0.3333333333333333","-0.3333333333333333","9.5e-7","1e+21"]');
check('toFixed', () => [[0, 0], [0.5, 0], [1.5, 0], [2.5, 0], [-2.5, 0], [1.005, 2], [1.45, 1], [8.345, 2], [0.000001, 7], [1e21, 2], [123.456, 0], [123.456, 10], [0, 20], [0.1, 20], [1.1, 100], [-0, 2], [-0.0001, 2], [1e-10, 5], [999.995, 2], [0.5, 1], [10.235, 2], [1234567.891, 3], [2 ** 53, 2], [5e-324, 100], [NaN, 2], [Infinity, 2], [1e20, 2], [0.045, 2], [1.255, 2]].map(a => a[0].toFixed(a[1])),
    '["0","1","2","3","-3","1.00","1.4","8.35","0.0000010","1e+21","123","123.4560000000","0.00000000000000000000","0.10000000000000000555","1.1000000000000000888178419700125232338905334472656250000000000000000000000000000000000000000000000000","0.00","-0.00","0.00000","1000.00","0.5","10.23","1234567.891","9007199254740992.00","0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","NaN","Infinity","100000000000000000000.00","0.04","1.25"]');
check('toFixed range', () => (1).toFixed(101),
    'throws RangeError');
check('toPrecision', () => [[0, 1], [0.5, 1], [123.456, 4], [123.456, 2], [123.456, 1], [0.000123, 2], [1e21, 3], [1e21, 22], [1.5, 1], [2.5, 1], [15, 1], [25, 1], [1.45, 2], [123456, 2], [0.00001, 1], [1e-7, 3], [99.99, 3], [-0, 3], [1 / 3, 20], [2 / 3, 100], [5e-324, 3], [1.7976931348623157e308, 21], [NaN, 3], [-Infinity, 3], [9.9999, 3], [100, 3], [100, 2]].map(a => a[0].toPrecision(a[1])),
    '["0","0.5","123.5","1.2e+2","1e+2","0.00012","1.00e+21","1000000000000000000000","2","3","2e+1","3e+1","1.4","1.2e+5","0.00001","1.00e-7","100","0.00","0.33333333333333331483","0.6666666666666666296592325124947819858789443969726562500000000000000000000000000000000000000000000000","4.94e-324","1.79769313486231570815e+308","NaN","-Infinity","10.0","100","1.0e+2"]');
check('toPrecision range', () => (1).toPrecision(0),
    'throws RangeError');
check('toExponential', () => [[0, 0], [0, undefined], [1, undefined], [123456, undefined], [123456, 2], [0.00015, 1], [0.00025, 1], [1.5, 0], [2.5, 0], [-1.5, 0], [1e21, 5], [5e-324, undefined], [5e-324, 20], [1.7976931348623157e308, undefined], [1.7976931348623157e308, 100], [1 / 3, 30], [NaN, 1], [Infinity, 1], [99.99, 1], [9.5, 0], [0.1, 20], [255, 3], [1.45, 1], [1.005, 2]].map(a => a[0].toExponential(a[1])),
    '["0e+0","0e+0","1e+0","1.23456e+5","1.23e+5","1.5e-4","2.5e-4","2e+0","3e+0","-2e+0","1.00000e+21","5e-324","4.94065645841246544177e-324","1.7976931348623157e+308","1.7976931348623157081452742373170435679807056752584499659891747680315726078002853876058955863276687817e+308","3.333333333333333148296162562474e-1","NaN","Infinity","1.0e+2","1e+1","1.00000000000000005551e-1","2.550e+2","1.4e+0","1.00e+0"]');
check('number literals', () => [0x7fffffff, 0xffffffff, 0x100000000, 0o777, 0b11111111, 1e3, 1E3, .5e1, 5.e1, 1_000.5, 0.1e-2, 0xffffffffffffffff, 0x20000000000001, 9007199254740993, 1.7976931348623157e308, 2e308, 5e-325, 0.1 + 0.2, 1e21 + 1],
    '[2147483647,4294967295,4294967296,511,255,1000,1000,5,50,1000.5,0.001,18446744073709552000,9007199254740992,9007199254740992,1.7976931348623157e+308,Infinity,0,0.30000000000000004,1e+21]');
check('Number constants', () => [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MAX_VALUE, Number.MIN_VALUE, Number.EPSILON, Number.EPSILON === 2 ** -52],
    '[9007199254740991,-9007199254740991,1.7976931348623157e+308,5e-324,2.220446049250313e-16,true]');
check('int conversions', () => [1e21 | 0, 2 ** 32 | 0, 2 ** 31 | 0, -(2 ** 31) | 0, 2 ** 32 + 5 | 0, -(2 ** 32) - 5 | 0, 2 ** 53 | 0, 2 ** 53 + 2 | 0, 1e300 | 0, NaN | 0, Infinity | 0, -1 >>> 0, -1.9 >>> 0, 2 ** 32 + 7.9 >>> 0, -(2 ** 31) >>> 0, 4294967295.9 | 0, -4294967295.9 | 0, 2 ** 63 | 0, 2 ** 64 + 2 ** 12 | 0, 2 ** 84 + 2 ** 33 | 0, -(2 ** 84 + 2 ** 33) >>> 0, 1.5 | 0, -1.5 | 0, 0.9 | 0, -0.9 | 0, 3000000000 | 0, 3000000000 >> 1, 3000000000 >>> 1, 1 << 31, 1 << 32, 1 << 33, 1 << -1, -1 >> 31, -1 >>> 31, -1 >>> 32, 5 >> 33],
    '[-559939584,0,-2147483648,-2147483648,5,-5,0,2,0,0,0,4294967295,4294967295,7,2147483648,-1,1,0,4096,0,0,1,-1,0,0,-1294967296,-647483648,1500000000,-2147483648,1,2,-2147483648,-1,1,4294967295,2]');
check('Math.imul etc', () => [Math.imul(0xffffffff, 5), Math.imul(65537, 65537), Math.imul(2 ** 31, 2), Math.imul(-5, 12), Math.imul(0x7fffffff, 0x7fffffff), Math.clz32(0), Math.clz32(1), Math.clz32(-1), Math.clz32(0.5), Math.fround(5.5), Math.fround(5.05), Math.fround(2 ** 150), Math.fround(1e-50), Math.fround(16777217), Math.trunc(-0.5), Math.sign(-0), Math.hypot(3, 4), Math.hypot(1e200, 1e200), Math.round(2.5), Math.round(-2.5), Math.round(0.49999999999999994), Math.round(-0.5), Math.round(4503599627370497), Math.round(1.5), Math.max(), Math.min(), Math.max(-0, 0), Math.min(0, -0), Math.max(1, NaN)],
    '[-5,131073,0,-60,1,32,31,0,32,5.5,5.050000190734863,Infinity,0,16777216,-0,-0,5,1.414213562373095e+200,3,-2,0,-0,4503599627370497,2,-Infinity,Infinity,0,-0,NaN]');
check('integer arithmetic overflow', () => [2147483647 + 1, -2147483648 - 1, 2147483647 * 2, 65536 * 65536, 46341 * 46341, -2147483648 * -1, -(-2147483648), 2147483647 * 2147483647, 123456789 * 987654321, 0x7fffffff + 0x7fffffff, -2147483648 / -1, -2147483648 % -1, 5 % -3, -5 % 3, 5.5 % 2, -5.5 % 2, 2 ** 53 % 3, 1e21 % 7, 7 % Infinity, Infinity % 7, 0 % 5, -0 % 5, 5 / 0, -5 / 0, 0 / 0, 1 / 3 * 3, 2 ** 31, 2 ** 32, 2 ** -1, (-2) ** 31, (-2) ** 32, 7 ** 0.5, 10 ** 15, 10 ** 21, 10 ** 22, 10 ** -5, 1e15 + 0.3, 0.1 * 0.1],
    '[2147483648,-2147483649,4294967294,4294967296,2147488281,2147483648,2147483648,4611686014132420600,121932631112635260,4294967294,2147483648,-0,2,-2,1.5,-1.5,2,6,7,NaN,0,-0,Infinity,-Infinity,NaN,1,2147483648,4294967296,0.5,-2147483648,4294967296,2.6457513110645907,1000000000000000,1e+21,1e+22,0.00001,1000000000000000.2,0.010000000000000002]');
check('increment at boundary', () => { var a = 2147483647, b = -2147483648, x = 9007199254740991, d = 4294967295; a++; b--; x++; d++; return [a, b, x, d, ++a, --b]; },
    '[2147483648,-2147483649,9007199254740992,4294967296,2147483649,-2147483650]');
check('compare numbers', () => [0 === -0, Object.is(0, -0), NaN !== NaN, 1 < 2, 2147483648 > 2147483647, -2147483649 < -2147483648, 4294967296 > 4294967295, 1e21 > 1e20, 5e-324 > 0, -5e-324 < 0, NaN < 1, NaN >= 1, Infinity > 1.7976931348623157e308, '10' < '9', '10' < 9, 10 < '9', null >= 0, undefined == 0, null == 0, '' == 0, '0' == false, [] == 0, [1] == 1, [1, 2] == '1,2'],
    '[true,false,true,true,true,true,true,true,true,true,false,false,true,true,false,false,true,false,false,true,true,true,true,true]');
check('Number methods', () => [Number.isInteger(5.0), Number.isInteger(5.1), Number.isInteger(2 ** 60), Number.isSafeInteger(2 ** 53), Number.isSafeInteger(2 ** 53 - 1), Number.isFinite('5'), isFinite('5'), Number.isNaN('x'), isNaN('x'), Number.parseFloat === parseFloat, Number.parseInt === parseInt, (25).toString(), (25.0).toString(), (-25).toString(2), (0.5).toString(2), (255).toString(16).toUpperCase()],
    '[true,false,true,false,true,false,true,false,true,true,true,"25","25","-11001","0.1","FF"]');
check('number toString random radix round trip', () => { var bad = 0, seed = 12345, i, r, v, s, neg, parts, ip, fp, acc, j, scale; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; } for (i = 0; i < 400; i++) { r = 2 + rnd() % 35; v = (rnd() * 2147483648 + rnd()) / Math.pow(2, rnd() % 40); if (rnd() & 1) v = -v; s = v.toString(r); neg = s[0] === '-'; if (neg) s = s.slice(1); parts = s.split('.'); acc = 0; for (j = 0; j < parts[0].length; j++) acc = acc * r + parseInt(parts[0][j], r); scale = 1 / r; if (parts[1]) for (j = 0; j < parts[1].length; j++) { acc += parseInt(parts[1][j], r) * scale; scale /= r; } if (Math.abs(acc - Math.abs(v)) > Math.abs(v) * 1e-13) bad++; } return bad; },
    '0');

section('B. Language: destructuring, generators, classes, Proxy/Reflect, Symbol, templates, labels, exceptions, closures, collections, JSON, Date');
check('destructure array', () => { var [a, , b = 5, ...r] = [1, 2, undefined, 4, 5]; return [a, b, r]; },
    '[1,5,[4,5]]');
check('destructure object', () => { var { a, b: { c: d = 9 } = {}, ...rest } = { a: 1, b: {}, x: 2, y: 3 }; return [a, d, rest]; },
    '[1,9,{x:2,y:3}]');
check('destructure nested defaults order', () => { var log = []; var { a = log.push('a'), b = log.push('b') } = { a: 1 }; return [a, b, log]; },
    '[1,1,["b"]]');
check('destructure swap', () => { var a = 1, b = 2; [a, b] = [b, a]; return [a, b]; },
    '[2,1]');
check('destructure string', () => { var [a, b, ...c2] = 'h\ud83d\ude00llo'; return [a, b, c2]; },
    '["h","\\ud83d\\ude00",["l","l","o"]]');
check('destructure iterator close', () => { var closed = 0, it = { [Symbol.iterator]() { return { next() { return { value: 1, done: false }; }, return() { closed++; return {}; } }; } }; var [x, y] = it; return [x, y, closed]; },
    '[1,1,1]');
check('destructure computed', () => { var k = 'zz', { [k]: v, [k + '1']: w = 7 } = { zz: 3 }; return [v, w]; },
    '[3,7]');
check('destructure null throws', () => { var { a } = null; },
    'throws TypeError');
check('destructure params', () => (function ({ a, b = 2 } = {}, [c2, d] = [3, 4], ...rest) { return [a, b, c2, d, rest]; })({ a: 1 }, undefined, 5, 6),
    '[1,2,3,4,[5,6]]');
check('fn length', () => [(function (a, b = 1, c2) { }).length, ((...a) => { }).length, (function (a, b) { }).length],
    '[1,0,2]');
check('spread', () => [[...'ab', ...[1, 2], ...new Set([3, 3])], Math.max(...[1, 5, 3]), { ...{ a: 1 }, b: 2, ...'xy' }],
    '[["a","b",1,2,3],5,{0:"x",1:"y",a:1,b:2}]');
check('generator basic', () => { function* g() { var x = yield 1; var y = yield x * 2; return x + y; } var it = g(); return [it.next(), it.next(10), it.next(5), it.next()]; },
    '[{value:1,done:false},{value:20,done:false},{value:15,done:true},{value:undefined,done:true}]');
check('generator return/throw', () => { var log = []; function* g() { try { yield 1; yield 2; } catch (e) { log.push('c' + e); yield 9; } finally { log.push('f'); } } var a = g(); a.next(); var r1 = a.throw('E'); var r2 = a.return(7); var b = g(); b.next(); var r3 = b.return(5); return [r1, r2, r3, log]; },
    '[{value:9,done:false},{value:7,done:true},{value:5,done:true},["cE","f","f"]]');
check('generator delegate', () => { function* inner() { var r = yield 'a'; return 'ret' + r; } function* outer() { var v = yield* inner(); yield v; yield* [1, 2]; } return [...outer()]; },
    '["a","retundefined",1,2]');
check('generator fib', () => { function* fib() { var a = 0, b = 1; for (; ;) { yield a;[a, b] = [b, a + b]; } } var out = []; for (var v of fib()) { if (v > 100) break; out.push(v); } return out; },
    '[0,1,1,2,3,5,8,13,21,34,55,89]');
check('iterator protocol', () => { var o = { from: 1, to: 4, [Symbol.iterator]() { var c2 = this.from, t = this.to; return { next: () => c2 <= t ? { value: c2++, done: false } : { value: undefined, done: true } }; } }; return [Array.from(o), [...o].reverse()]; },
    '[[1,2,3,4],[4,3,2,1]]');
check('class basics', () => { class A { #p = 1; static s = 'st'; static #sp = 5; x = 2; constructor(y) { this.y = y; } get p() { return this.#p; } set p(v) { this.#p = v * 2; } #m() { return 'priv' + this.#p; } m() { return this.#m(); } static sm() { return A.#sp; } static has(o) { return #p in o; } } var a = new A(3); a.p = 4; return [a.p, a.x, a.y, a.m(), A.s, A.sm(), A.has(a), A.has({}), Object.keys(a), typeof A, A.name, A.length]; },
    '[8,2,3,"priv8","st",5,true,false,["x","y"],"function","A",1]');
check('class inheritance', () => { class A { constructor() { this.a = 1; } who() { return 'A'; } static sw() { return 'SA'; } } class B extends A { constructor() { super(); this.b = 2; } who() { return 'B>' + super.who(); } static sw() { return 'SB>' + super.sw(); } } var b = new B(); return [b.a, b.b, b.who(), B.sw(), b instanceof A, Object.getPrototypeOf(B) === A, B.prototype.constructor === B]; },
    '[1,2,"B>A","SB>SA",true,true,true]');
check('class this before super', () => { class A { } class B extends A { constructor() { this.x = 1; super(); } } new B(); },
    'throws ReferenceError');
check('class call without new', () => { class A { } A(); },
    'throws TypeError');
check('class private brand check', () => { class A { #x = 1; static get(o) { return o.#x; } } return A.get({}); },
    'throws TypeError');
check('class static block & accessors', () => { var log = []; class A { static x = log.push('x'); static { log.push('blk'); A.y = 5; } static get z() { return 'z'; } static [Symbol.hasInstance](v) { return v === 1; } } return [log, A.y, A.z, 1 instanceof A, 2 instanceof A]; },
    '[["x","blk"],5,"z",true,false]');
check('class extends builtin', () => { class MyArr extends Array { sum() { return this.reduce((a, b) => a + b, 0); } } class MyErr extends Error { constructor(m) { super(m); this.name = 'MyErr'; } } var m = MyArr.from([1, 2, 3]); var e = new MyErr('boom'); return [m.sum(), m instanceof MyArr, m.map(x => x * 2) instanceof MyArr, m.length, e instanceof Error, e.name, e.message, String(e), Array.isArray(m)]; },
    '[6,true,true,3,true,"MyErr","boom","MyErr: boom",true]');
check('class field init order', () => { var log = []; class A { a = log.push('a'); constructor() { log.push('ctorA'); } } class B extends A { b = log.push('b'); constructor() { log.push('pre'); super(); log.push('post'); } } new B(); return log; },
    '["pre","a","ctorA","b","post"]');
check('new.target', () => { function F() { return new.target === F; } class A { constructor() { this.t = new.target.name; } } class B extends A { } return [new F() instanceof F, F(), new B().t]; },
    '[true,false,"B"]');
check('getter setter', () => { var o = { _v: 1, get v() { return this._v; }, set v(x) { this._v = x + 1; } }; o.v = 5; var d = Object.getOwnPropertyDescriptor(o, 'v'); return [o.v, typeof d.get, typeof d.set, d.enumerable, 'value' in d]; },
    '[6,"function","function",true,false]');
check('defineProperty', () => { 'use strict'; var o = {}; Object.defineProperty(o, 'x', { value: 1 }); var r = []; try { o.x = 2; } catch (e) { r.push(e.name); } try { delete o.x; } catch (e) { r.push(e.name); } r.push(o.x, Object.keys(o).length, JSON.stringify(Object.getOwnPropertyDescriptor(o, 'x'))); return r; },
    '["TypeError","TypeError",1,0,"{"value":1,"writable":false,"enumerable":false,"configurable":false}"]');
check('freeze seal', () => { var o = Object.freeze({ a: 1, n: { b: 2 } }); o.a = 9; o.n.b = 3; var s = Object.seal({ q: 1 }); s.q = 2; s.z = 1; delete s.q; return [o.a, o.n.b, Object.isFrozen(o), s, Object.isSealed(s), Object.isExtensible(s)]; },
    'throws TypeError');
check('proxy traps', () => { var log = []; var p = new Proxy({ a: 1 }, { get(t, k, r) { log.push('get ' + String(k)); return Reflect.get(t, k, r); }, set(t, k, v) { log.push('set ' + k); t[k] = v * 2; return true; }, has(t, k) { log.push('has ' + k); return k === 'magic' || k in t; }, deleteProperty(t, k) { log.push('del ' + k); return delete t[k]; }, ownKeys(t) { log.push('keys'); return [...Reflect.ownKeys(t), 'virt']; }, getOwnPropertyDescriptor(t, k) { return k === 'virt' ? { value: 'v', enumerable: true, configurable: true } : Reflect.getOwnPropertyDescriptor(t, k); } }); p.b = 2; var r = [p.a, p.b, 'magic' in p, 'nope' in p, delete p.a, Object.keys(p), JSON.stringify(p)]; return [r, log]; },
    '[[1,4,true,false,true,["b","virt"],"{"b":4}"],["set b","get a","get b","has magic","has nope","del a","keys","get toJSON","keys","get b","get virt"]]');
check('proxy function', () => { var p = new Proxy(function (a, b) { return a + b; }, { apply(t, th, args) { return t(...args) * 10; }, construct(t, args) { return { made: args }; } }); return [p(1, 2), new p(3), typeof p]; },
    '[30,{made:[3]},"function"]');
check('proxy invariants', () => { var t = {}; Object.defineProperty(t, 'x', { value: 1 }); var p = new Proxy(t, { get() { return 2; } }); return p.x; },
    'throws TypeError');
check('proxy revocable', () => { var r = Proxy.revocable({}, {}); r.proxy.a = 1; r.revoke(); return r.proxy.a; },
    'throws TypeError');
check('reflect', () => { var o = { a: 1 }; return [Reflect.has(o, 'a'), Reflect.ownKeys({ b: 1, [Symbol.for('s')]: 2, 1: 0 }), Reflect.defineProperty(o, 'c', { value: 3 }), Reflect.getPrototypeOf([]) === Array.prototype, Reflect.apply(Math.max, null, [1, 3, 2]), Reflect.construct(Date, [0]).getTime(), Reflect.set(Object.freeze({}), 'x', 1), Reflect.isExtensible(o), Reflect.deleteProperty(o, 'a'), o]; },
    '[true,["1","b",Symbol(s)],true,true,3,0,false,true,true,{}]');
check('symbol', () => { var s = Symbol('d'), o = { [s]: 1, r: 2 }; return [s.toString(), s.description, Symbol.for('k') === Symbol.for('k'), Symbol.keyFor(Symbol.for('k')), Symbol.keyFor(s), Object.keys(o), Object.getOwnPropertySymbols(o).length, typeof s, JSON.stringify(o), Symbol().description, Symbol.iterator.toString()]; },
    '["Symbol(d)","d",true,"k",undefined,["r"],1,"symbol","{"r":2}",undefined,"Symbol(Symbol.iterator)"]');
check('symbol to number throws', () => +Symbol(),
    'throws TypeError');
check('symbol concat throws', () => '' + Symbol(),
    'throws TypeError');
check('well-known symbols', () => { var o = { [Symbol.toPrimitive](h) { return h === 'number' ? 42 : h === 'string' ? 'str' : 'def'; } }; class T { get [Symbol.toStringTag]() { return 'TT'; } } var sp = { [Symbol.isConcatSpreadable]: true, length: 2, 0: 'a', 1: 'b' }; return [+o, `${o}`, o + '', String(new T()), [1].concat(sp), Object.prototype.toString.call(null), Object.prototype.toString.call(function* () { }), Object.prototype.toString.call(new Map())]; },
    '[42,"str","def","[object TT]",[1,"a","b"],"[object Null]","[object GeneratorFunction]","[object Map]"]');
check('tagged template', () => { function tag(s, ...v) { return [s.length, s.raw.join('|'), s.join('|'), v, Object.isFrozen(s)]; } var same = (function () { function id(s) { return s; } function f() { return id`x`; } return f() === f(); })(); return [tag`a${1}b\n${2}A`, same, String.raw`\n${1}\t`, `multi
line`]; },
    '[[3,"a|b\\u005cn|A","a|b\\u000a|A",[1,2],true],true,"\\u005cn1\\u005ct","multi\\u000aline"]');
check('template nesting', () => `a${`b${1 + 1}c`}d${[1, 2].map(x => `<${x}>`).join('')}`,
    '"ab2cd<1><2>"');
check('labelled break continue', () => { var out = []; outer: for (var i = 0; i < 4; i++) { inner: for (var j = 0; j < 4; j++) { if (j === 2) continue outer; if (i === 3) break outer; out.push(i * 10 + j); } } blk: { out.push('in'); if (out.length) break blk; out.push('never'); } var k = 0; lw: while (true) { do { k++; if (k > 5) break lw; } while (true); } return [out, k]; },
    '[[0,1,10,11,20,21,"in"],6]');
check('switch fallthrough', () => { function f(x) { var r = ''; switch (x) { case 1: r += 'a'; case 2: r += 'b'; break; default: r += 'd'; case 3: r += 'c'; } return r; } return [f(1), f(2), f(3), f(9), f('1')]; },
    '["ab","b","c","dc","dc"]');
check('finally ordering', () => { var log = []; function f() { try { log.push('t'); return 'r'; } finally { log.push('f'); } } function g() { try { throw 1; } catch (e) { log.push('c'); return 'gc'; } finally { log.push('gf'); return 'gf-wins'; } } function h() { for (var i = 0; i < 3; i++) { try { if (i === 1) continue; if (i === 2) break; log.push('h' + i); } finally { log.push('hf' + i); } } return i; } function k() { try { try { throw new Error('in'); } finally { log.push('kf1'); } } catch (e) { return e.message; } } return [f(), g(), h(), k(), log]; },
    '["r","gf-wins",2,"in",["t","f","c","gf","h0","hf0","hf1","hf2","kf1"]]');
check('exceptions', () => { var r = []; try { null.x; } catch (e) { r.push(e instanceof TypeError); } try { undefinedVar; } catch (e) { r.push(e.name); } try { (void 0)(); } catch (e) { r.push(e.name); } try { new Array(-1); } catch (e) { r.push(e.name); } try { 'x'.repeat(-1); } catch (e) { r.push(e.name); } try { decodeURIComponent('%'); } catch (e) { r.push(e.name); } try { JSON.parse('{'); } catch (e) { r.push(e.name); } try { eval('1 +'); } catch (e) { r.push(e.name); } try { throw { custom: 1 }; } catch ({ custom }) { r.push(custom); } try { (function f() { f(); })(); } catch (e) { r.push(e.name); } var e2 = new Error('m', { cause: 'why' }); r.push(e2.cause, new AggregateError([1, 2], 'ag').errors.length, typeof e2.stack); return r; },
    '[true,"ReferenceError","TypeError","RangeError","RangeError","URIError","SyntaxError","SyntaxError",1,"RangeError","why",2,"string"]');
check('error props', () => { var e = new RangeError('msg'); return [e.name, e.message, String(e), Object.keys(e), e instanceof Error, Object.prototype.toString.call(e), Error.prototype.name, RangeError.prototype.name, Error('x').message, String(new Error()), String(new Error('')), Error.prototype.toString.call({ name: 'N', message: 'M' })]; },
    '["RangeError","msg","RangeError: msg",[],true,"[object Error]","Error","RangeError","x","Error","Error","N: M"]');
check('closures in loops', () => { var fs = [], gs = [], hs = []; for (let i = 0; i < 3; i++) fs.push(() => i); for (var j = 0; j < 3; j++) gs.push(() => j); for (const k of [7, 8]) hs.push(() => k); var x = []; for (let i = 0; i < 3; i++) { x.push(() => i); i++; } return [fs.map(f => f()), gs.map(f => f()), hs.map(f => f()), x.map(f => f())]; },
    '[[0,1,2],[3,3,3],[7,8],[1,3]]');
check('closure counter', () => { function mk() { var n = 0; return { inc: () => ++n, get: () => n }; } var a = mk(), b = mk(); a.inc(); a.inc(); b.inc(); return [a.get(), b.get()]; },
    '[2,1]');
check('TDZ', () => { var r = []; try { x; let x = 1; } catch (e) { r.push(e.name); } try { (function () { typeof y; let y; })(); } catch (e) { r.push(e.name); } try { const z = 1; z = 2; } catch (e) { r.push(e.name); } return r; },
    '["ReferenceError","ReferenceError","TypeError"]');
check('hoisting', () => { var r = [typeof f, typeof g, v]; var v = 1; function f() { } var g = function () { }; { function blockf() { return 1; } } r.push(typeof blockf); return r; },
    '["function","undefined",undefined,"undefined"]');
check('this binding', () => { 'use strict'; var o = { f() { return this; }, a: () => typeof this, g() { return (() => this)(); } }; var f = o.f; return [o.f() === o, f() === undefined, o.g() === o, f.call(5), typeof f.bind('s')(), (function () { return typeof this; }).call(5)]; },
    '[true,true,true,5,"string","number"]');
check('sloppy this', () => [(function () { return typeof this; }).call(5), (function () { return this === globalThis; })()],
    '["number",false]');
check('arguments', () => { function f(a, b) { arguments[0] = 9; return [a, arguments.length, typeof arguments, Array.isArray(arguments), Array.prototype.slice.call(arguments)]; } function g(a) { 'use strict'; arguments[0] = 9; return a; } return [f(1, 2, 3), g(1)]; },
    '[[1,3,"object",false,[9,2,3]],1]');
check('default param scope', () => { var x = 1; function f(a = x, b = a + 1, c2 = () => a + b) { var x = 5; return [a, b, c2()]; } return f(); },
    '[1,2,3]');
check('optional chaining', () => { var o = { a: { b: null, f() { return 1; } } }; return [o?.a?.b?.c, o.x?.y.z, o.a.f?.(), o.a.g?.(), o?.['a']?.['f'](), o.a.b ?? 'dflt', 0 ?? 1, '' || 'x', null?.[0], delete o?.zz]; },
    '[undefined,undefined,1,undefined,1,"dflt",0,"x",undefined,true]');
check('logical assignment', () => { var a = null, b = 0, c2 = 1; a ??= 5; b ||= 6; c2 &&= 7; var o = { x: undefined }; o.x ??= 'n'; return [a, b, c2, o.x]; },
    '[5,6,7,"n"]');
check('exponent & misc operators', () => [2 ** 3 ** 2, (-2) ** 2, 7 % -3, -7 % 3, 1 / -0, typeof null, typeof undefined, typeof function () { }, typeof class { }, void 0, (1, 2), !!'' + !!'0', 'b' + 'a' + +'a' + 'a', [] + [], [] + {}, 1 + '2', '3' * '4', true + true, null + 1, undefined + 1, '5' - 2, +'', +' ', +'\n', +[], +[5], +{}, 1 < 2 < 3, 3 > 2 > 1, '2' > '12', 2 > '12', null == undefined, null === undefined, NaN == NaN],
    '[512,4,1,-1,-Infinity,"object","undefined","function","function",undefined,2,1,"baNaNa","","[object Object]","12",12,2,1,NaN,3,0,0,0,0,5,NaN,true,false,true,false,true,false,false]');
check('in / instanceof / delete', () => { var a = [1, , 3], o = { x: 1 }; return [1 in a, 0 in a, 'length' in a, 'x' in o, delete o.x, 'x' in o, delete a[0], a.length, [] instanceof Object, Object.create(null) instanceof Object, (() => { }) instanceof Function]; },
    '[false,true,true,true,true,false,true,3,true,false,true]');
check('comma/for-in order', () => { var o = { b: 1, 2: 0, a: 2, 1: 0, [Symbol('s')]: 1 }; var ks = []; for (var k in o) ks.push(k); function P() { this.own = 1; } P.prototype.inh = 2; var ps = []; for (var q in new P()) ps.push(q); return [ks, ps, Object.keys('ab'), Object.entries({ z: 1, 10: 2, 9: 3 })]; },
    '[["1","2","b","a"],["own","inh"],["0","1"],[["9",3],["10",2],["z",1]]]');
check('for-of with break closes', () => { var closed = false; function* g() { try { yield 1; yield 2; } finally { closed = true; } } for (var v of g()) break; return closed; },
    'true');
check('getter on prototype chain', () => { var base = { get v() { return this.k * 2; }, set v(x) { this.k = x; } }; var o = Object.create(base); o.v = 4; return [o.v, Object.keys(o), o.hasOwnProperty('v'), Object.getPrototypeOf(o) === base]; },
    '[8,["k"],false,true]');
check('object literal features', () => { var k = 'dyn', x = 1; var o = { x, [k + 1]: 2, m() { return super.toString === Object.prototype.toString; }, get g() { return 3; }, 'quoted key': 4, 5: 5, __proto__: { inherited: 6 } }; return [o.x, o.dyn1, o.m(), o.g, o['quoted key'], o[5], o.inherited, Object.keys(o)]; },
    '[1,2,true,3,4,5,6,["5","x","dyn1","m","g","quoted key"]]');
check('Object static', () => [Object.assign({}, { a: 1 }, null, 'xy'), Object.entries({ a: 1, b: 2 }), Object.fromEntries([['a', 1], ['b', 2]]), Object.values('ab'), Object.getOwnPropertyNames('ab'), Object.is(NaN, NaN), Object.is(0, -0), Object.groupBy ? Object.groupBy([1, 2, 3], x => x % 2 ? 'odd' : 'even') : 'n/a', Object.hasOwn({ a: 1 }, 'a')],
    '[{0:"x",1:"y",a:1},[["a",1],["b",2]],{a:1,b:2},["a","b"],["0","1","length"],true,false,{odd:[1,3],even:[2]},true]');
check('JSON edge', () => [JSON.stringify({ a: undefined, b: () => 1, c: Symbol(), d: NaN, e: -0, f: Infinity, g: new Date(0), h: [undefined, function () { }], i: null, j: 'q"\\\n\u2028\ud800', k: { toJSON() { return 'tj'; } } }), JSON.stringify([1, [2, { a: 3 }]], null, 2), JSON.stringify({ a: 1, b: 2, c: { a: 3, d: 4 } }, ['a', 'c']), JSON.stringify({ a: 1, b: 'x' }, (k, v) => typeof v === 'number' ? v + 1 : v), JSON.stringify('\u007f\u0000\u001f'), JSON.stringify(undefined), JSON.stringify(null), JSON.stringify({ a: [] }, null, '--'), JSON.stringify(Object.create({ inh: 1 })), JSON.stringify(new Number(5)), JSON.stringify(new String('s')), JSON.stringify({ a: 1e21, b: 1e-7, c: 0.1 + 0.2 }), JSON.stringify('\ud83d\ude00'), JSON.stringify([new Boolean(false)]), JSON.stringify({ 1: 1, b: 2, 0: 0 })],
    '["{"d":null,"e":0,"f":null,"g":"1970-01-01T00:00:00.000Z","h":[null,null],"i":null,"j":"q\\u005c"\\u005c\\u005c\\u005cn\\u2028\\u005cud800","k":"tj"}","[\\u000a  1,\\u000a  [\\u000a    2,\\u000a    {\\u000a      "a": 3\\u000a    }\\u000a  ]\\u000a]","{"a":1,"c":{"a":3}}","{"a":2,"b":"x"}",""\\u007f\\u005cu0000\\u005cu001f"",undefined,"null","{\\u000a--"a": []\\u000a}","{}","5",""s"","{"a":1e+21,"b":1e-7,"c":0.30000000000000004}",""\\ud83d\\ude00"","[false]","{"0":0,"1":1,"b":2}"]');
check('JSON.parse', () => [JSON.parse('{"a":[1,2,{"b":null}],"c":"\\u0041\\n","d":-0,"e":1e3,"f":1.5E-2}'), JSON.parse('"\\ud83d\\ude00"'), JSON.parse(' [1 , 2 ] '), JSON.parse('{"__proto__":1}').__proto__, JSON.parse('{"a":1,"a":2}'), JSON.parse('[1,2,3]', (k, v) => typeof v === 'number' ? v * 2 : v), JSON.parse('{"a":{"b":1}}', function (k, v) { return k === 'b' ? undefined : v; }), JSON.parse('123456789012345678901234567890'), JSON.parse('-0'), JSON.parse('1E400'), JSON.parse('true')],
    '[{a:[1,2,{b:null}],c:"A\\u000a",d:-0,e:1000,f:0.015},"\\ud83d\\ude00",[1,2],1,{a:2},[2,4,6],{a:{}},1.2345678901234568e+29,-0,Infinity,true]');
check('JSON.parse errors', () => ['{a:1}', "{'a':1}", '[1,]', '01', '1.', '.5', '+1', 'NaN', 'undefined', '"\n"', '"\\x41"', '{"a":1,}', '', ' ', '[1 2]', '"abc', 'nul', '0x10', '1e', '--1', '{"a"}', '\u00a01'].map(s => { try { JSON.parse(s); return 'ok'; } catch (e) { return e.name; } }),
    '["SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError"]');
check('JSON cycles', () => { var a = {}; a.self = a; return JSON.stringify(a); },
    'throws TypeError');
check('JSON deep', () => { var s = '', i; for (i = 0; i < 200; i++) s += '['; for (i = 0; i < 200; i++) s += ']'; var v = JSON.parse(s), d = 0; while (Array.isArray(v) && v.length) { v = v[0]; d++; } return [d, JSON.stringify(JSON.parse(s)).length]; },
    '[199,400]');
check('Map', () => { var m = new Map([[1, 'a'], ['1', 'b'], [NaN, 'n'], [-0, 'z']]); var o = {}; m.set(o, 'o').set(1, 'A'); return [m.size, m.get(1), m.get('1'), m.get(NaN), m.get(0), m.has(o), m.delete('1'), [...m.keys()].length, [...m.values()], [...m.entries()][0], Object.is([...m.keys()][2], 0)]; },
    '[5,"A","b","n","z",true,true,4,["A","n","z","o"],[1,"A"],true]');
check('Map iteration with mutation', () => { var m = new Map([[1, 1], [2, 2], [3, 3]]), seen = []; for (var [k] of m) { seen.push(k); if (k === 1) { m.delete(2); m.set(4, 4); } if (k === 4) m.set(1, 'again'); } m.forEach(function (v, k2, mm) { if (mm !== m) seen.push('bad'); }); return [seen, [...m.keys()]]; },
    '[[1,3,4],[1,3,4]]');
check('Set', () => { var s = new Set([3, 1, 3, 2, NaN, NaN, 0, -0, '1']); s.add(1).delete(3); var r = [s.size, [...s], s.has(NaN), s.has(-0)]; if (s.union) r.push([...new Set([1, 2]).union(new Set([2, 3]))], [...new Set([1, 2, 3]).intersection(new Set([2, 3, 4]))], [...new Set([1, 2, 3]).difference(new Set([2]))], [...new Set([1, 2]).symmetricDifference(new Set([2, 3]))], new Set([1]).isSubsetOf(new Set([1, 2])), new Set([1, 2]).isSupersetOf(new Set([1])), new Set([1]).isDisjointFrom(new Set([2]))); return r; },
    '[5,[1,2,NaN,0,"1"],true,true,[1,2,3],[2,3],[1,3],[1,3],true,true,true]');
check('Map groupBy', () => Map.groupBy ? [...Map.groupBy([1, 2, 3, 4], x => x % 2)].map(e => [e[0], e[1]]) : 'n/a',
    '[[1,[1,3]],[0,[2,4]]]');
check('WeakMap WeakSet WeakRef', () => { var wm = new WeakMap(), ws = new WeakSet(), k = {}, k2 = function () { }; wm.set(k, 1).set(k2, 2); ws.add(k); var r = [wm.get(k), wm.has(k2), wm.delete(k), wm.has(k), ws.has(k), ws.has({}), new WeakRef(k).deref() === k, typeof FinalizationRegistry]; try { wm.set(1, 1); } catch (e) { r.push(e.name); } try { ws.add('s'); } catch (e) { r.push(e.name); } return r; },
    '[1,true,true,false,true,false,true,"function","TypeError","TypeError"]');
check('WeakMap many keys', () => { var wm = new WeakMap(), keys = [], i, ok = true; for (i = 0; i < 500; i++) { keys.push({ i }); wm.set(keys[i], i); } for (i = 0; i < 500; i++) if (wm.get(keys[i]) !== i) ok = false; keys.length = 0; return ok; },
    'true');
check('eval & Function', () => { var x = 1; var r = [eval('x + 1'), (0, eval)('typeof x'), new Function('a', 'b', 'return a * b')(3, 4), eval('var ev = 5; ev'), typeof ev, eval('(function(){ return this === globalThis; })()'), eval('1;;;'), eval('if (true) { 3 }'), eval('do { 4; break; } while (false)'), Function.prototype.toString.call(function f(a) { return a; })]; return r; },
    '[2,"undefined",12,5,"undefined",false,1,3,4,"function f(a) { return a; }"]');
check('strict mode errors', () => { 'use strict'; var r = []; try { undeclared = 1; } catch (e) { r.push(e.name); } try { Object.freeze([1]).push(2); } catch (e) { r.push(e.name); } try { (function () { return arguments.callee; })(); } catch (e) { r.push(e.name); } try { eval('with({}){}'); } catch (e) { r.push(e.name); } try { eval('var eval;'); } catch (e) { r.push(e.name); } try { eval('010'); } catch (e) { r.push(e.name); } try { eval('delete x_'); } catch (e) { r.push(e.name); } return r; },
    '["ReferenceError","TypeError","TypeError","SyntaxError","SyntaxError","SyntaxError","SyntaxError"]');
check('syntax errors', () => ['let let = 1', 'class A { constructor(){} constructor(){} }', 'a => { }()', 'for (let x of [], []) ;', 'function f(a, a) { "use strict"; }', '({a:1} = 1)', 'x = 1 +;', 'var 1a', '"\\u{110000}"', 'async () => await', 'function* g() { yield = 1 }', '1++', 'new.target', 'super()', 'break', 'continue', 'return', 'import.meta', '`${`', '/(?<n>a)(?<n>b)/', 'a?.b = 1', 'let x; let x;', 'label: label: ;', '({ get a(x) {} })', '0b12', '1_', '1__0', '08.5n', '({a, b}) => {"use strict"; var a;}'].map(s => { try { new Function(s); return 'ok'; } catch (e) { return e.name; } }),
    '["SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","ok","SyntaxError","SyntaxError","SyntaxError","ok","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError"]');
check('ASI', () => { var a = 1, b = 2; var f = function () { return 1 }
    ; var r = (function () { return
        5; })(); var c2 = a
    ++b; return [r, a, b, c2, f()]; },
    '[undefined,1,3,1,1]');
check('getter/static name inference', () => { var o = { f() { }, g: function () { }, h: () => { }, ['k' + 1]: function () { }, get acc() { return 1; } }; var anon = function () { }; class C { static m() { } #p() { } } var bound = o.f.bind(null); return [o.f.name, o.g.name, o.h.name, o.k1.name, Object.getOwnPropertyDescriptor(o, 'acc').get.name, anon.name, C.m.name, bound.name, (function () { }).name, (class { }).name, Symbol('desc').description, (() => { }).name, new Function('return 1').name]; },
    '["f","g","h","k1","get acc","anon","m","bound f","","","desc","","anonymous"]');
check('function toString', () => [(function foo(a, b) { return a + b; }).toString(), ((a) => a * 2).toString(), (class A { m() { } }).toString(), Math.max.toString().replace(/\s+/g, ' ')],
    '["function foo(a, b) { return a + b; }","(a) => a * 2","class A { m() { } }","function max() { [native code] }"]');
check('bind/call/apply', () => { function f(a, b, c2) { return [this.v, a, b, c2]; } var b = f.bind({ v: 1 }, 2); function Pt(x, y) { this.x = x; this.y = y; } var BP = Pt.bind(null, 1); return [b(3, 4), f.call({ v: 5 }, 6), f.apply({ v: 7 }, [8, 9, 10]), b.length, new BP(2), new BP(2) instanceof Pt, f.apply({ v: 0 }, { length: 2, 0: 'x', 1: 'y' })]; },
    '[[1,2,3,4],[5,6,undefined,undefined],[7,8,9,10],2,{x:1,y:2},true,[0,"x","y",undefined]]');
check('recursion depth 200', () => { function d(n) { return n === 0 ? 0 : 1 + d(n - 1); } return d(200); },
    '200');
check('with statement', () => { return new Function('var o = { a: 1, b: 2 }; with (o) { a = 5; var s = a + b; } return [s, o.a];')(); },
    '[7,5]');
check('globalThis', () => [typeof globalThis, globalThis === (0, eval)('this'), typeof globalThis.Array, Object.prototype.toString.call(globalThis).length > 0],
    '["object",true,"function",true]');
check('comma in for and complex loops', () => { var out = []; for (var i = 0, j = 10; i < j; i += 3, j -= 2) out.push(i + ':' + j); var n = 0; do { n++; } while (n < 5); var w = 10; while (w-- > 7); for (var q in [5, 6]) out.push(typeof q); return [out, n, w]; },
    '[["0:10","3:8","string","string"],5,6]');
check('Date basic UTC', () => { var d = new Date(Date.UTC(2020, 1, 29, 23, 59, 58, 123)); return [d.getTime(), d.toISOString(), d.getUTCDay(), d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.toJSON(), new Date(0).toISOString(), new Date(-1).toISOString(), new Date(8.64e15).toISOString(), new Date(8.64e15 + 1).getTime(), new Date(NaN).getTime(), new Date(2 ** 31 * 1000).toISOString(), new Date(-(2 ** 31) * 1000 - 1).toISOString(), new Date(253402300800000).toISOString(), new Date(-62198755200000).toISOString()]; },
    '[1583020798123,"2020-02-29T23:59:58.123Z",6,2020,1,29,23,"2020-02-29T23:59:58.123Z","1970-01-01T00:00:00.000Z","1969-12-31T23:59:59.999Z","+275760-09-13T00:00:00.000Z",NaN,NaN,"2038-01-19T03:14:08.000Z","1901-12-13T20:45:51.999Z","+010000-01-01T00:00:00.000Z","-000001-01-01T00:00:00.000Z"]');
check('Date invalid toISOString', () => new Date(NaN).toISOString(),
    'throws RangeError');
check('Date.UTC', () => [Date.UTC(1970, 0), Date.UTC(2000, 0, 1), Date.UTC(99, 11, 31), Date.UTC(2024, 12, 1), Date.UTC(2024, -1, 1), Date.UTC(2024, 0, 0), Date.UTC(2024, 1, 30), Date.UTC(275760, 8, 13), Date.UTC(275760, 8, 13, 0, 0, 0, 1), Date.UTC(-271821, 3, 20), Date.UTC(1969, 11, 31, 23, 59, 59, 999), Date.UTC(2038, 0, 19, 3, 14, 8), Date.UTC(1900, 0, 1), Date.UTC(2100, 1, 29), Date.UTC(2000, 1, 29), Date.UTC(1, 0, 1), Date.UTC(0, 0, 1), Date.UTC()],
    '[0,946684800000,946598400000,1735689600000,1701388800000,1703980800000,1709251200000,8640000000000000,NaN,-8640000000000000,-1,2147483648000,-2208988800000,4107542400000,951782400000,-2177452800000,-2208988800000,NaN]');
check('Date.parse ISO', () => ['2020-01-01', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00.000+02:00', '2020-01-01T12:30:15.5-08:00', '2020-02-30', '2020-13-01', '+275760-09-13T00:00:00.000Z', '-000001-01-01T00:00:00Z', '2020', '2020-06', '1970-01-01T00:00:00.001Z', '2020-01-01T24:00:00Z', '2020-01-01T25:00:00Z', '0000-01-01T00:00:00Z', '9999-12-31T23:59:59.999Z', '2020-01-01T00:00Z', '2020-1-1', 'garbage', ''].map(s => Date.parse(s)),
    '[1577836800000,1577836800000,1577829600000,1577910615500,1583020800000,NaN,8640000000000000,-62198755200000,1577836800000,1590969600000,1,1577923200000,NaN,-62167219200000,253402300799999,1577836800000,1577836800000,NaN,NaN]');
check('Date.parse other formats with zone', () => ['Thu, 01 Jan 1970 00:00:00 GMT', 'Sat, 29 Feb 2020 12:00:00 GMT', 'Mon, 25 Dec 1995 13:30:00 +0430', '25 Dec 1995 13:30 GMT', 'Dec 25, 1995 GMT', 'Wed Jan 01 2020 05:00:00 GMT+0500', 'Tue Mar 01 2022 10:00:00 GMT-0800 (PST)', '2000-01-01T00:00:00+00:00', 'January 1, 2000 00:00:00 UTC', '1 January 2000 UTC', 'Sun Feb 01 1998 00:00:00 GMT+0700'].map(s => Date.parse(s)),
    '[0,1582977600000,819882000000,819898200000,819849600000,1577836800000,1646157600000,946684800000,946684800000,946684800000,886266000000]');
check('Date setters UTC', () => { var d = new Date(Date.UTC(2020, 0, 31)); d.setUTCMonth(1); var a = d.toISOString(); d.setUTCDate(0); var b = d.toISOString(); d.setUTCHours(25, 61, 61, 1001); var c2 = d.toISOString(); d.setUTCFullYear(2019, 11, 31); var e = d.toISOString(); d.setTime(1e12); d.setUTCMilliseconds(-1); return [a, b, c2, e, d.toISOString(), d.setUTCSeconds(NaN), d.getTime()]; },
    '["2020-03-02T00:00:00.000Z","2020-02-29T00:00:00.000Z","2020-03-01T02:02:02.001Z","2019-12-31T02:02:02.001Z","2001-09-09T01:46:39.999Z",NaN,NaN]');
check('Date strings UTC part', () => { var d = new Date(Date.UTC(2021, 11, 25, 8, 5, 9)); return [d.toUTCString(), d.toISOString(), new Date(Date.UTC(-1, 0, 1)).toISOString(), new Date(Date.UTC(10000, 0, 1)).toISOString(), new Date(Date.UTC(5, 5, 5)).toUTCString(), typeof d.toString(), d.toString().slice(0, 15).length, d.valueOf() === +d, d[Symbol.toPrimitive]('number'), typeof d[Symbol.toPrimitive]('default')]; },
    '["Sat, 25 Dec 2021 08:05:09 GMT","2021-12-25T08:05:09.000Z","-000001-01-01T00:00:00.000Z","+010000-01-01T00:00:00.000Z","Mon, 05 Jun 1905 00:00:00 GMT","string",15,true,1640419509000,"string"]');
check('Date arithmetic', () => { var a = new Date(Date.UTC(2024, 0, 1)), b = new Date(Date.UTC(2025, 0, 1)); return [(b - a) / 864e5, a < b, new Date(a.getTime() + 60 * 864e5).toISOString(), new Date(2 ** 53).getTime(), new Date(1.9).getTime(), new Date(-1.9).getTime(), new Date('1e3').getTime(), new Date(true).getTime(), new Date(null).getTime(), new Date(undefined).getTime(), new Date(new Date(5)).getTime(), new Date('5').getTime() === new Date('5').getTime()]; },
    '[366,true,"2024-03-01T00:00:00.000Z",NaN,1,-1,NaN,1,0,NaN,5,true]');
check('Date day of week table', () => { var out = [], y; for (y = 1600; y <= 2400; y += 100) out.push(new Date(Date.UTC(y, 2, 1)).getUTCDay()); return out; },
    '[3,1,6,4,3,1,6,4,3]');
check('Date leap years', () => [1900, 2000, 2004, 2100, 2400, 1600, 1, 4, 100, 400, -4, 0].map(y => { var d = new Date(Date.UTC(2000, 1, 29)); d.setUTCFullYear(y); return d.getUTCMonth() + '/' + d.getUTCDate(); }),
    '["2/1","1/29","1/29","2/1","1/29","1/29","2/1","1/29","2/1","1/29","1/29","1/29"]');

section('B. String and RegExp: Unicode, surrogate pairs, case mapping, normalisation, lookbehind, named groups, unicode and sticky flags');
var SMILE = '\ud83d\ude00', E_ACUTE = '\u00e9', COMB = 'e\u0301';
check('length & code points', () => [SMILE.length, [...SMILE].length, SMILE.codePointAt(0), SMILE.codePointAt(1), SMILE.charCodeAt(0), SMILE.charCodeAt(2), String.fromCodePoint(0x1f600) === SMILE, String.fromCharCode(0xd83d, 0xde00) === SMILE, String.fromCodePoint(65, 0x10ffff).length, String.fromCharCode(0x10041), 'abc'.at(-1), SMILE.at(-1), 'a'.codePointAt(5)],
    '[2,1,128512,56832,55357,NaN,true,true,3,"A","c","\\ude00",undefined]');
check('fromCodePoint range', () => String.fromCodePoint(0x110000),
    'throws RangeError');
check('fromCodePoint fraction', () => String.fromCodePoint(1.5),
    'throws RangeError');
check('case conversion', () => ['Stra\u00dfe'.toUpperCase(), '\u0130'.toLowerCase(), '\u03a3\u03a3'.toLowerCase(), 'A\u03a3'.toLowerCase(), '\ufb01'.toUpperCase(), '\u00ff'.toUpperCase(), '\u01c5'.toLowerCase(), '\u01c5'.toUpperCase(), '\ud801\udc00'.toLowerCase(), '\ud801\udc28'.toUpperCase(), 'i\u0307'.toUpperCase(), '\u1e9e'.toLowerCase(), 'abcXYZ'.toUpperCase(), '\u00e9\u00c9'.toUpperCase(), '\u0149'.toUpperCase(), '\u1f80'.toUpperCase()],
    '["STRASSE","i\\u0307","\\u03c3\\u03c2","a\\u03c2","FI","\\u0178","\\u01c6","\\u01c4","\\ud801\\udc28","\\ud801\\udc00","I\\u0307","\\u00df","ABCXYZ","\\u00c9\\u00c9","\\u02bcN","\\u1f08\\u0399"]');
check('normalize', () => [E_ACUTE.normalize('NFD') === COMB, COMB.normalize('NFC') === E_ACUTE, '\ufb01'.normalize('NFKC'), '\u212b'.normalize('NFC'), '\u1e9b\u0323'.normalize('NFD'), '\u1e9b\u0323'.normalize('NFKD'), '\uac00'.normalize('NFD').length, '\u1100\u1161'.normalize('NFC'), 'a\u0323\u0307'.normalize('NFC'), 'a\u0307\u0323'.normalize('NFD'), '\u0958'.normalize('NFC'), '\ud834\udd5e'.normalize('NFD').length],
    '[true,true,"fi","\\u00c5","\\u017f\\u0323\\u0307","s\\u0323\\u0307",2,"\\uac00","\\u1ea1\\u0307","a\\u0323\\u0307","\\u0915\\u093c",4]');
check('normalize bad form', () => 'a'.normalize('NFX'),
    'throws RangeError');
check('isWellFormed', () => 'a'.isWellFormed ? ['a\ud800'.isWellFormed(), SMILE.isWellFormed(), 'a\ud800b'.toWellFormed(), '\udc00\ud800'.toWellFormed()] : 'n/a',
    '[false,true,"a\\ufffdb","\\ufffd\\ufffd"]');
check('search methods', () => { var s = 'hello ' + SMILE + ' w\u00f6rld hello'; return [s.indexOf('hello', 1), s.lastIndexOf('hello'), s.indexOf(''), s.indexOf('', 99), s.lastIndexOf('', 3), s.includes(SMILE), s.includes('\ude00'), s.startsWith('ello', 1), s.endsWith('w\u00f6rld', 15), s.search(/w.rld/), s.indexOf('\u00f6'), s.lastIndexOf('l', 3), s.lastIndexOf('l', -5), s.indexOf('o', -5), 'abc'.indexOf('c', 2.9), 'aaa'.lastIndexOf('a', NaN), 'aaa'.lastIndexOf('a', 1.5)]; },
    '[15,15,0,20,3,true,true,true,false,9,10,3,-1,4,2,2,1]');
check('includes regex throws', () => 'a'.includes(/a/),
    'throws TypeError');
check('slice family', () => { var s = '0123456789'; return [s.slice(-3), s.slice(2, -2), s.slice(5, 2), s.substring(5, 2), s.substring(-1, 3), s.substring(NaN, 2), s.substr(-3, 2), s.substr(2), s.substr(2, 0), s.slice(2.9, 4.1), s.slice('2', '4'), SMILE.slice(0, 1).length, s.slice(), s.at(0), s.at(99), s.charAt(-1), s[20], s.substring(4, undefined), s.substr(1, Infinity)]; },
    '["789","234567","","234","012","01","78","23456789","","23","23",1,"0123456789","0",undefined,"",undefined,"456789","123456789"]');
check('pad/repeat/trim', () => ['5'.padStart(3, '0'), 'abc'.padEnd(8, '12'), 'abc'.padStart(2), 'x'.padStart(5, ''), 'x'.padEnd(4, SMILE).length, 'ab'.repeat(3), ''.repeat(1e6), 'ab'.repeat(0), ' \t\n\u00a0\ufeff\u2028x\u3000 '.trim(), '  x '.trimStart() + '|', '  x '.trimEnd() + '|', '\u180ex'.trim().length, '\u200bx'.trim().length],
    '["005","abc12121","abc","x",4,"ababab","","","x","x |","  x|",2,2]');
check('repeat range', () => 'a'.repeat(Infinity),
    'throws RangeError');
check('split', () => ['a,b,,c'.split(','), 'a,b,c'.split(',', 2), 'abc'.split(''), SMILE.split(''), ''.split(''), ''.split(','), 'abc'.split(), 'a1b22c'.split(/\d+/), 'a1b2c'.split(/(\d)/), 'abc'.split(/(?:)/), 'aXbxc'.split(/x/i), 'abc'.split('', 2), 'a b  c'.split(' '), 'test'.split(/(?=s)/), 'A<B>bold</B>and<CODE>coded</CODE>'.split(/<(\/)?([^<>]+)>/), 'ab'.split(/a*?/), 'ab'.split(/a*/), 'x'.split(undefined, 0)],
    '[["a","b","","c"],["a","b"],["a","b","c"],["\\ud83d","\\ude00"],[],[""],["abc"],["a","b","c"],["a","1","b","2","c"],["a","b","c"],["a","b","c"],["a","b"],["a","b","","c"],["te","st"],["A",undefined,"B","bold","/","B","and",undefined,"CODE","coded","/","CODE",""],["a","b"],["","b"],[]]');
check('replace', () => ['aaa'.replace('a', 'b'), 'aaa'.replace(/a/g, 'b'), 'aaa'.replaceAll('a', '$&$&'), 'abc'.replace('b', '[$`|$&|$\']'), 'abc'.replace(/(?<mid>b)/, '<$<mid>>'), 'abc'.replace(/(b)/, '$1$1$2$0$$'), 'John Smith'.replace(/(\w+)\s(\w+)/, '$2, $1'), 'abc'.replace(/b/, (m, off, str) => m.toUpperCase() + off + str), 'a1b2'.replace(/\d/g, d => d * 2), 'aaa'.replace(/a/gy, 'b'), 'x'.replace('x', '$'), 'abc'.replace('', '_'), 'abc'.replaceAll('', '_'), 'a.b.c'.replaceAll('.', '-'), 'abc'.replace(/(?<x>a)|(?<y>z)/, (...args) => JSON.stringify(args[args.length - 1])), SMILE.replace(/./, 'x').length, SMILE.replace(/./u, 'x').length, 'aXb'.replace(/x/i, '$&$&'), 'abcdefghijkl'.replace(/(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)(l)/, '$12$11$10$1')],
    '["baa","bbb","aaaaaa","a[a|b|c]c","a<b>c","abb$2$0$c","Smith, John","aB1abcc","a2b4","bbb","$","_abc","_a_b_c_","a-b-c","{"x":"a"}bc",2,1,"aXXb","lkja"]');
check('replaceAll non-global throws', () => 'a'.replaceAll(/a/, 'b'),
    'throws TypeError');
check('match/matchAll', () => ['a1b22c333'.match(/\d+/g), 'abc'.match(/(?<first>a)(b)?(x)?/).slice(), 'abc'.match(/(?<first>a)/).groups.first, 'abc'.match(/z/), 'abc'.match(/z/g), [...'a1b2'.matchAll(/[a-z](\d)/g)].map(m => [m[0], m[1], m.index]), 'abc'.match(/b/).index, 'abc'.match(/b/).input, 'aBc'.match(/b/i)[0], 'abc'.match('b')[0], 'a.c'.match('.')[0], 'abc'.match()[0]],
    '[["1","22","333"],["ab","a","b",undefined],"a",null,null,[["a1","1",0],["b2","2",2]],1,"abc","B","b","a",""]');
check('matchAll non-global throws', () => [...'a'.matchAll(/a/)],
    'throws TypeError');
check('localeCompare & compare', () => ['a'.localeCompare('b'), 'b'.localeCompare('a'), 'a'.localeCompare('a'), 'a' < 'B', 'a' < 'b', 'Z' < 'a', '\ud83d\ude00' < '\uffff', 'abc' < 'abcd', '' < 'a', '10' < '9', ['b', 'a', 'C', '\u00e9', 'e', 'Z'].sort(), ['b', 'a', 'C', 'e', 'Z'].sort((x, y) => x.localeCompare(y)).length],
    '[-1,1,0,false,true,true,true,true,true,true,["C","Z","a","b","e","\\u00e9"],5]');
check('concat & coercion', () => ['a'.concat(1, null, undefined, [2, 3], {}), String(null), String(undefined), String(123n), String(Symbol('x')), String([1, [2, 3]]), String({}), String(() => 1), `${[1, 2]}`, '' + -0, String(-0), [0, -0, +0].join(), (-0).toFixed(1), String([null]), String([undefined, 1]), String(new Date(NaN)), String(true), 'ab' + 1 + 2, 1 + 2 + 'ab'],
    '["a1nullundefined2,3[object Object]","null","undefined","123","Symbol(x)","1,2,3","[object Object]","() => 1","1,2","0","0","0,0,0","0.0","",",1","Invalid Date","true","ab12","3ab"]');
check('raw unicode escapes', () => ['\u{1F600}' === SMILE, '\x41\0'.length, '\u{0}'.length, 'a\
b', '\v\f\b'.length, '\u2028'.charCodeAt(0), "\'\"\\".length],
    '[true,2,1,"ab",3,8232,3]');
check('string iterator', () => { var s = 'a' + SMILE + '\ud800b', parts = []; for (var ch of s) parts.push(ch.length); return [parts, Array.from(s).length, [...s].map(x => x.codePointAt(0))]; },
    '[[1,2,1,1],4,[97,128512,55296,98]]');
check('big string building', () => { var s = '', i; for (i = 0; i < 5000; i++) s += String.fromCharCode(65 + i % 26); var t = s + '\u1234' + s; return [s.length, t.length, t.charCodeAt(5000), t.indexOf('\u1234'), t.lastIndexOf('ABC'), s.slice(2598, 2604), t.slice(4998, 5003).length, (s + s).split('Z').length]; },
    '[5000,10001,4660,5000,9993,"YZABCD",5,385]');
check('rope flatten & compare', () => { var a = 'x'.repeat(300), b = a + 'y', c2 = a + 'y'; var d = ''; for (var i = 0; i < 300; i++) d += 'x'; d += 'y'; return [b === c2, b === d, b < a, a < b, b.length, (b + SMILE + b).length, (b + SMILE).endsWith(SMILE), d.charAt(300), new Map([[b, 1]]).get(d), { [b]: 2 }[d]]; },
    '[true,true,false,true,301,604,true,"y",1,2]');
check('8-bit to 16-bit transitions', () => { var a = 'caf\u00e9', b = a + '\u0100', c2 = b.slice(0, 4); return [a === c2, a.length, c2.length, a.localeCompare(c2), a.toUpperCase(), b.toUpperCase(), (a + a).indexOf('\u00e9c'), b.indexOf('\u0100'), a.indexOf('\u0100'), '\u00ff' < '\u0100', a.split('\u00e9'), b.split('\u0100'), a.replace('\u00e9', '\u20ac'), encodeURIComponent(b), JSON.stringify(b)]; },
    '[true,4,4,0,"CAF\\u00c9","CAF\\u00c9\\u0100",3,4,-1,true,["caf",""],["caf\\u00e9",""],"caf\\u20ac","caf%C3%A9%C4%80",""caf\\u00e9\\u0100""]');
check('URI coding', () => [encodeURIComponent('a b&c/d?e=f#' + SMILE + E_ACUTE), encodeURI('http://x/a b?q=' + E_ACUTE + '#h'), decodeURIComponent('%F0%9F%98%80%C3%A9%20'), decodeURI('%41%2f%3F'), escape('a b+c/' + E_ACUTE + '\u0100'), unescape('%u0100%E9%20'), encodeURIComponent('-_.!~*\'()'), encodeURI(';/?:@&=+$,#')],
    '["a%20b%26c%2Fd%3Fe%3Df%23%F0%9F%98%80%C3%A9","http://x/a%20b?q=%C3%A9#h","\\ud83d\\ude00\\u00e9 ","A%2f%3F","a%20b+c/%E9%u0100","\\u0100\\u00e9 ","-_.!~*\'()",";/?:@&=+$,#"]');
check('URI errors', () => ['%', '%zz', '%C3', '%C3%28', '%F0%9F%98', '%ED%A0%80', '%C0%80', '%F4%90%80%80', '%80'].map(s => { try { return decodeURIComponent(s); } catch (e) { return e.name; } }),
    '["URIError","URIError","URIError","URIError","URIError","URIError","URIError","URIError","URIError"]');
check('encodeURI lone surrogate', () => encodeURIComponent('\ud800'),
    'throws URIError');
check('String.raw & misc statics', () => [String.raw({ raw: ['a', 'b', 'c'] }, 1, 2, 3), String.raw({ raw: 'xyz' }, '-', '+'), Object.getOwnPropertyNames(String.prototype).filter(n => ['anchor', 'big', 'blink', 'bold', 'fixed', 'fontcolor', 'fontsize', 'italics', 'link', 'small', 'strike', 'sub', 'sup'].indexOf(n) >= 0).length, 'x'.anchor('a"b'), 'x'.bold()],
    '["a1b2c","x-y+z",13,"<a name="a&quot;b">x</a>","<b>x</b>"]');
check('string as array-like', () => [Array.prototype.map.call('abc', x => x + x), Array.from('abc', (x, i) => x + i), Object.keys('ab'), 'abc'.hasOwnProperty(1), 'abc'.hasOwnProperty(3), Object.getOwnPropertyDescriptor('abc', 0), Array.prototype.join.call('abc', '-'), Array.prototype.reverse.call(['a', 'b']).join(''), new String('ab').length, typeof new String('a'), new String('a') == 'a', new String('a') === 'a'],
    '[["aa","bb","cc"],["a0","b1","c2"],["0","1"],true,false,{value:"a",writable:false,enumerable:true,configurable:false},"a-b-c","ba",2,"object",true,false]');
check('number formatting in strings', () => [(1234.5678).toFixed(2), (0.000001234).toString(), (1e21).toLocaleString().length > 0, (255).toString(16).padStart(4, '0'), (-7.5).toString(2), parseFloat('3.14abc'), Number('  12  '), (25).toString(36), 0.1 + 0.2 + '', 1 / 3 + ''],
    '["1234.57","0.000001234",true,"00ff","-111.1",3.14,12,"p","0.30000000000000004","0.3333333333333333"]');
check('utf-16 units in regexp non-unicode', () => [/^.$/.test(SMILE), /^.$/u.test(SMILE), /^..$/.test(SMILE), /\ud83d/.test(SMILE), /\ud83d/u.test(SMILE), /^[\ud83d\ude00]$/u.test(SMILE), /^[\ud83d\ude00]$/.test(SMILE), SMILE.match(/./gu).length, SMILE.match(/./g).length, /\u{1F600}/u.test(SMILE), /^\S$/u.test(SMILE), /^\W$/u.test(SMILE)],
    '[false,true,true,true,false,true,false,1,2,true,true,true]');
check('regexp flags & props', () => { var r = /a/dgimsuy; return [r.flags, r.source, r.global, r.ignoreCase, r.multiline, r.dotAll, r.unicode, r.sticky, r.hasIndices, r.lastIndex, String(r), new RegExp('/').source, new RegExp('').source, String(new RegExp('\n')), new RegExp('a', 'g').flags, RegExp('[').toString === undefined]; },
    'throws SyntaxError');
check('regexp bad flags', () => new RegExp('a', 'gg'),
    'throws SyntaxError');
check('lookbehind', () => ['$10 and 20'.match(/(?<=\$)\d+/)[0], '$10 and 20'.match(/(?<!\$)\b\d+/)[0], 'abcabc'.replace(/(?<=b)c/g, 'X'), 'abc'.match(/(?<=(a)(b))c/).slice(), 'aab'.match(/(?<=a+)b/).index, 'price: 42EUR'.match(/\d+(?=EUR)/)[0], 'ab'.match(/(?<!a)b/), 'xab'.match(/(?<=\Ba)b/).index, 'foobar'.match(/(?<=(o)\1)bar/)[0], 'abcdef'.match(/(?<=([a-c]+)([a-c]+))d/).slice(), 'ab'.match(/(?<=^a)b/)[0]],
    '["10","20","abXabX",["c","a","b"],2,"42",null,2,"bar",["d","a","bc"],"b"]');
check('lookahead', () => ['foobar'.match(/foo(?=bar)/)[0], 'foobaz'.match(/foo(?!bar)/)[0], 'a1'.match(/(?=(\d))/), 'ab'.match(/a(?=(b))\1/).slice(), 'aaa'.match(/(?=(a+))a*b\1/), 'baaabac'.match(/(?=(a+))a*b\1/).slice(), 'abc'.match(/(?!(a))b/).slice()],
    '["foo","foo",["","1"],["ab","b"],null,["aba","a"],["b",undefined]]');
check('named groups', () => { var m = '2024-03-15'.match(/(?<y>\d{4})-(?<m>\d\d)-(?<d>\d\d)/); return [m.groups.y, m.groups.m, m.groups.d, Object.keys(m.groups), '2024-03-15'.replace(/(?<y>\d{4})-(?<m>\d\d)-(?<d>\d\d)/, '$<d>/$<m>/$<y>'), 'aa'.match(/(?<c>a)\k<c>/)[0], 'ab'.match(/(?<c>a)\k<c>/), Object.getPrototypeOf(m.groups), /(?<a>x)|(?<b>y)/.exec('y').groups, 'x'.replace(/(?<n>x)/, '$<nope>|$<n')]; },
    '["2024","03","15",["y","m","d"],"15/03/2024","aa",null,null,{a:undefined,b:"y"},"|$<n"]');
check('backrefs & quantifiers', () => ['abab'.match(/(ab)\1/)[0], 'aaaa'.match(/a{2,3}/)[0], 'aaaa'.match(/a{2,3}?/)[0], 'aaaa'.match(/a{2,}/)[0], 'a'.match(/a{0}/)[0], 'abc'.match(/a*?/)[0], 'abbbc'.match(/ab+?/)[0], 'abbbc'.match(/ab*c/)[0], 'aXbXc'.match(/(.)X\1?/)[0], 'aa'.match(/(a)|b\1/).slice(), 'b'.match(/(a)|b\1/).slice(), 'abc'.match(/(?:a|ab)(?:c|bcd)?/)[0], 'aaab'.match(/(a*)*b/).slice(), 'ab'.match(/(a|ab)(c|bcd)?/).slice(), 'xyz'.match(/x{1}y{1,}z{0,1}/)[0], 'a{1'.match(/a{1/)[0], 'zaacbbbcac'.match(/(z)((a+)?(b+)?(c))*/).slice()],
    '["abab","aaa","aa","aaaa","","","ab","abbbc","aX",["a","a"],["b",undefined],"a",["aaab","aaa"],["a","a",undefined],"xyz","a{1",["zaacbbbcac","z","ac","a",undefined,"c"]]');
check('char classes', () => ['aB3_ -\n'.replace(/\w/g, 'w').replace(/\s/g, 's'), 'a\u00e9\u0100'.replace(/\W/g, '?'), '\u00a0\ufeff\u2003'.replace(/\s/g, 's'), 'a-z'.match(/[a\-z]+/)[0], 'a]b'.match(/[\]]/)[0], 'ab^'.match(/[\^a]+/)[0], '\b'.match(/[\b]/) !== null, 'abc'.match(/[^]/)[0], 'abc'.match(/[]/), '09az'.match(/[\d-z]+/)[0], 'K'.match(/[\u212a]/i), '\u212a'.match(/k/i), '\u212a'.match(/k/iu) !== null, '\u017f'.match(/s/iu) !== null, '\u017f'.match(/s/i), 'A'.match(/[^a]/i), '\u00c9'.match(/\u00e9/i) !== null, '\u03a3'.match(/\u03c2/i) !== null, 'I'.match(/\u0131/i), '\n\r\u2028'.match(/./gs).length, '\n\r\u2028a'.match(/./g).length],
    '["wwwws-s","a??","sss","a-z","]","a",true,"a",null,"09",null,null,true,true,null,null,true,true,null,3,1]');
check('unicode properties', () => [/\p{Lu}/u.test('A'), /\p{Lu}/u.test('a'), /\p{Script=Greek}/u.test('\u03b1'), /\p{Script=Latin}/u.test('\u03b1'), /\P{L}/u.test('1'), /^\p{Emoji}$/u.test(SMILE), /\p{General_Category=Decimal_Number}/u.test('\u0663'), /\p{Alphabetic}/u.test('\u00e9'), /\p{sc=Han}/u.test('\u4e2d'), /\p{scx=Hira}/u.test('\u3042'), /^\p{L}+$/u.test('h\u00e9llo\u4e2d'), /\p{ASCII}/u.test('\u00e9'), /\p{White_Space}/u.test('\u3000'), /[\p{N}\p{P}]+/u.exec('ab12,;cd')[0], /\p{Ll}/iu.test('A')],
    '[true,false,true,false,true,true,true,true,true,true,true,false,true,"12,;",true]');
check('unicode property bad', () => new RegExp('\\p{Nope}', 'u'),
    'throws SyntaxError');
check('unicode case folding u', () => [/\u{10400}/iu.test('\ud801\udc28'), /[\u{10400}-\u{10427}]/iu.test('\ud801\udc28'), /\u00df/iu.test('\u1e9e'), /[a-z]/iu.test('\u212a'), /\u03c3/iu.test('\u03c2'), /\u1e9e/i.test('\u00df'), /[^\W\d_]/iu.test('\u017f')],
    '[true,true,true,true,true,false,true]');
check('sticky', () => { var r = /a/y, out = []; out.push(r.test('ba'), r.lastIndex); r.lastIndex = 1; out.push(r.test('ba'), r.lastIndex, r.test('ba'), r.lastIndex); var g = /\d/gy; out.push('12a3'.match(g), '12a3'.replace(g, 'x'), 'a1'.replace(/\d/y, 'x'), 'a1'.search(/\d/y), 'a,b'.split(/,/y)); var t = /b/y; t.lastIndex = 1; out.push('abc'.replace(t, 'X'), t.lastIndex, /^a/my.test('b\na'), (function () { var m = /^a/my; m.lastIndex = 2; return m.test('b\na'); })()); return out; },
    '[false,0,true,2,false,0,["1","2"],"xxa3","a1",-1,["a","b"],"aXc",2,false,true]');
check('global lastIndex', () => { var r = /a/g, s = 'aXaXa', out = []; var m; while ((m = r.exec(s))) out.push(m.index + ':' + r.lastIndex); out.push(r.lastIndex); r.lastIndex = 10; out.push(r.test(s), r.lastIndex); var e = /(?:)/g, k = 0; while (e.exec('ab') && k < 10) { k++; e.lastIndex++; } out.push(k); var u = /(?:)/gu; out.push(SMILE.replace(u, '-').length, SMILE.replace(/(?:)/g, '-').length, 'abc'.replace(/x*/g, '-')); return out; },
    '["0:1","2:3","4:5",0,false,0,3,4,5,"-a-b-c-"]');
check('indices d flag', () => { var m = /(?<x>b)(c)?(z)?/d.exec('abc'); return [m.indices.map(i => i ? i.slice() : i), m.indices.groups.x, m.index]; },
    '[[[1,3],[1,2],[2,3],undefined],[1,2],1]');
check('multiline & dotAll & anchors', () => ['a\nb\r\nc'.match(/^\w$/gm), 'a\nb'.match(/a.b/), 'a\nb'.match(/a.b/s)[0], 'a\nb'.match(/a$/m)[0], 'a\nb'.match(/a$/), 'ab'.match(/\bb/), 'a b'.match(/\bb/).index, 'ab'.match(/\Bb/).index, '\u00e9a'.match(/\ba/).index, 'a\u2028b'.match(/^b/m).index, 'x'.match(/$^/), ''.match(/^$/)[0], 'aaa'.lastIndexOf('a'), 'a\n'.match(/a$/), 'a\n'.match(/a$/m).index],
    '[["a","b","c"],null,"a\\u000ab","a",null,null,2,1,1,2,null,"",2,null,0]');
check('escapes', () => [/\cJ/.test('\n'), /\x41B\u{43}/u.test('ABC'), /\u{43}/.test('u'.repeat(43)), /\0/.test('\0'), /[\0]/.test('\0'), /\//.test('/'), /[/]/.test('/'), /\-/.test('-'), /a\ b/.test('a b'), /\t\n\v\f\r/.test('\t\n\v\f\r'), /\1(a)/.exec('a').slice(), /\k/.test('k'), /\8/.test('8'), /[\c_]/.test('\x1f'), /\c/.test('\\c'), /]/.test(']'), /{/.test('{'), /\p{L}/.test('p{L}'), /\101/.test('A')],
    '[true,true,true,true,true,true,true,true,true,true,["a","a"],true,true,true,true,true,true,true,true]');
check('regexp unicode syntax errors', () => ['\\-', '\\1(a)\\2', '{', ']', '\\c', '\\k', 'a{2,1}', '(?<n>a)\\k<m>', '\\u{110000}', '[b-a]', '(?<1a>.)', '\\p{L', 'a**', '(?<=a)+', '\\8'].map(s => { try { new RegExp(s, 'u'); return 'ok'; } catch (e) { return e.name; } }),
    '["SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError"]');
check('regexp syntax errors non-unicode', () => ['(', ')', '[', 'a{2,1}', '?', '*', '+a', '(?<n>a)(?<n>b)', '[b-a]', '\\', '(?<=a)*', '(?=a)*', '(?<n>a)\\k<m>', '(?:', 'a|*', '(?<n', 'x{99999999999}'].map(s => { try { new RegExp(s); return 'ok'; } catch (e) { return e.name; } }),
    '["SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","SyntaxError","ok","SyntaxError","SyntaxError","SyntaxError","SyntaxError","ok"]');
check('RegExp.escape', () => RegExp.escape ? [RegExp.escape('a.b*c'), RegExp.escape('1+1'), RegExp.escape(' \n'), RegExp.escape('_-,')] : 'n/a',
    '["\\u005cx61\\u005c.b\\u005c*c","\\u005cx31\\u005c+1","\\u005cx20\\u005cn","_\\u005cx2d\\u005cx2c"]');
check('exec result shape', () => { var m = /(a)(?<n>b)?/.exec('xab'); return [Array.isArray(m), m.length, m.index, m.input, Object.keys(m), m.groups && m.groups.n, /a/.exec('b'), /(a)|(b)/.exec('b').slice(), /(?:(a)|b)+/.exec('ab').slice(), /(a*)*/.exec('b').slice(), /(a*)+/.exec('b').slice(), /()|/.exec('').slice()]; },
    '[true,3,1,"xab",["0","1","2","index","input","groups"],"b",null,["b",undefined,"b"],["ab",undefined],["",undefined],["",""],["",""]]');
check('Symbol.replace/split/match protocol', () => { var custom = { [Symbol.replace](s, r) { return 'R:' + s + r; }, [Symbol.split](s) { return ['S', s]; }, [Symbol.match](s) { return ['M' + s]; }, [Symbol.search]() { return 42; } }; class R2 extends RegExp { exec(s) { var m = super.exec(s); if (m) m[0] = m[0].toUpperCase(); return m; } } return ['x'.replace(custom, 'y'), 'x'.split(custom), 'x'.match(custom), 'x'.search(custom), 'abc'.replace(new R2('b'), '[$&]'), 'abc'.match(new R2('b', 'g')), 'a-b'.split(new R2('-')), RegExp.prototype[Symbol.matchAll] !== undefined, RegExp[Symbol.species] === RegExp]; },
    '["R:xy",["S","x"],["Mx"],42,"a[B]c",["B"],["a","b"],true,true]');
check('compile & toString', () => { var r = /a/g; return [typeof r.compile, String(/[/]\//), new RegExp('a/b').source, new RegExp('\\/').source, RegExp.prototype.toString.call({ source: 'S', flags: 'F' }), RegExp.prototype.source, RegExp.prototype.flags, new RegExp(/x/gi).flags, new RegExp(/x/gi, 'm').flags, RegExp(r) === r, new RegExp(r) === r]; },
    '["function","/[/]\\u005c//","a\\u005c/b","\\u005c/","/S/F","(?:)","","gi","m",true,false]');
check('long subject', () => { var s = 'ab'.repeat(5000) + 'c'; return [s.match(/(?:ab)*c/)[0].length, s.replace(/b/g, '').length, s.split('ab').length, /c$/.test(s), s.match(/a/g).length, s.search(/c/), s.lastIndexOf('ab'), /^(?:ab)+c$/.test(s)]; },
    '[10001,5001,5001,true,5000,10000,9998,true]');
check('case-insensitive ranges', () => [/[a-z]+/i.exec('HeLLo')[0], /[A-Z]+/i.exec('heLLo')[0], /[^a-z]/i.test('Q'), /[\u00e0-\u00ff]/i.test('\u00c0'), /[\u0400-\u042f]/i.test('\u0430'), /\u0430/i.test('\u0410'), /[k-l]/i.test('K'), /[\u03b1-\u03c9]+/i.exec('\u0391\u03a9')[0].length, /\w/i.test('\u017f'), /\w/iu.test('\u017f'), /[\w]/iu.test('\u212a'), /\W/iu.test('\u017f'), /[^\W]/iu.test('\u017f')],
    '["HeLLo","heLLo",false,true,true,true,true,2,false,true,true,false,true]');
check('toLocale*', () => ['I'.toLocaleLowerCase(), 'i'.toLocaleUpperCase(), 'a'.localeCompare('A') !== 0],
    '["i","I",true]');
check('TextEncoder-free utf8 via URI', () => { var s = 'h\u00e9llo ' + SMILE + ' \u4e2d'; var bytes = unescape(encodeURIComponent(s)); return [bytes.length, decodeURIComponent(escape(bytes)) === s]; },
    '[15,true]');

section('B. Array, typed arrays and DataView: sort stability, sparse arrays, both byte orders, float bit patterns');
check('sort default', () => [[10, 9, 1, 100, -1, undefined, , 'b', 'a', null, 2n].sort(), [3, 1, 2].sort().reverse(), [, 1, , 0].sort(), ['B', 'a', 'C'].sort(), [true, false].sort(), [-0, 0, -1].sort((a, b) => a - b)],
    '[[-1,1,10,100,2n,9,"a","b",null,undefined,<hole>],[3,2,1],[0,1,<hole>,<hole>],["B","C","a"],[false,true],[-1,-0,0]]');
check('sort stability', () => { var a = [], i; for (i = 0; i < 600; i++) a.push({ k: (i * 7919) % 13, i }); a.sort((x, y) => x.k - y.k); var ok = true; for (i = 1; i < a.length; i++) if (a[i - 1].k > a[i].k || (a[i - 1].k === a[i].k && a[i - 1].i > a[i].i)) ok = false; return [ok, a[0].i, a[599].i, a.length]; },
    '[true,0,591,600]');
check('sort with holes/undefined', () => { var a = [3, , 1, undefined, 2, , undefined]; a.sort(); return [a, a.length, 5 in a, 3 in a]; },
    '[[1,2,3,undefined,undefined,<hole>,<hole>],7,false,true]');
check('sort comparator errors', () => [1, 2].sort(5),
    'throws TypeError');
check('sort comparator inconsistent', () => [5, 1, 4, 2, 3].sort(() => 0),
    '[5,1,4,2,3]');
check('sort strings unicode', () => ['\ud83d\ude00', '\uffff', 'z', 'a\u0301', '\u00e1', 'a', 'A', '', ' '].sort(),
    '[""," ","A","a","a\\u0301","z","\\u00e1","\\ud83d\\ude00","\\uffff"]');
check('toSorted etc', () => [].toSorted ? (function () { var a = [3, 1, 2]; return [a.toSorted(), a.toReversed(), a.toSpliced(1, 1, 'x', 'y'), a.with(0, 9), a, [1, , 3].toSorted(), [1, , 3].toReversed()]; })() : 'n/a',
    '[[1,2,3],[2,1,3],[3,"x","y",2],[9,1,2],[3,1,2],[1,3,undefined],[3,undefined,1]]');
check('with range', () => [1].with(5, 1),
    'throws RangeError');
check('sparse arrays', () => { var a = [1, , 3]; a[10] = 11; var seen = []; a.forEach((v, i) => seen.push(i)); return [a.length, seen, a.map(x => x * 2), a.filter(() => true), Object.keys(a), a.indexOf(undefined), a.includes(undefined), a.findIndex(x => x === undefined), a.join('-'), a.reduce((s, v) => s + v, 0), a.flat().length, JSON.stringify(a), a.lastIndexOf(11), a.some(x => x === undefined), a.every(x => x !== undefined), [...a].length, Array.from(a)[1], a.keys().next().value, [, 'a'].entries().next().value, 1 in a.slice(0, 3), 1 in a.concat([])]; },
    '[11,[0,2,10],[2,<hole>,6,<hole>,<hole>,<hole>,<hole>,<hole>,<hole>,<hole>,22],[1,3,11],["0","2","10"],-1,true,1,"1--3--------11",15,3,"[1,null,3,null,null,null,null,null,null,null,11]",10,false,true,11,undefined,0,[0,undefined],false,false]');
check('length semantics', () => { var a = [1, 2, 3]; a.length = 1; a[5] = 6; var b = []; b[4294967294] = 'last'; var r = [a, a.length, b.length]; try { b.length = -1; } catch (e) { r.push(e.name); } try { new Array(4294967296); } catch (e) { r.push(e.name); } try { [].length = 1.5; } catch (e) { r.push(e.name); } var d = []; d['4294967295'] = 'not index'; r.push(d.length, Object.keys(d)); var e2 = []; e2['01'] = 1; e2['1.0'] = 1; e2[-1] = 1; r.push(e2.length); var f = [1, 2, 3]; Object.defineProperty(f, 1, { configurable: false }); f.length = 0; r.push(f.length); return r; },
    'throws TypeError');
check('new Array forms', () => [new Array(3).length, new Array('3'), new Array(1, 2), Array(2).fill().map((_, i) => i), Array.of(7), Array.of(7).length, Array.from({ length: 3 }, (_, i) => i * i), Array.from(new Set([1, 1, 2])), Array.from(new Map([[1, 2]])), Array.from('ab'), Array.from({ length: 2, 0: 'x' }), Array.isArray(new Array()), Array.isArray({ length: 0 }), Array.isArray(Array.prototype), Array.isArray(new Proxy([], {}))],
    '[3,["3"],[1,2],[0,1],[7],1,[0,1,4],[1,2],[[1,2]],["a","b"],["x",undefined],true,false,true,true]');
check('new Array(1.5)', () => new Array(1.5),
    'throws RangeError');
check('push pop shift unshift splice', () => { var a = [1, 2, 3]; var r = [a.push(4, 5), a.pop(), a.shift(), a.unshift(0, 0.5), a.splice(1, 2), a.splice(-1), a.splice(1, 0, 'x', 'y'), a.splice(), a.splice(1), a, [].pop(), [].shift(), [1, 2, 3].splice(1, undefined), [1, 2, 3].splice(undefined), [1, 2, 3].splice(0, -1), [1, 2, 3].splice(5, 1, 'z')]; return r; },
    '[5,5,1,5,[0.5,2],[4],[],[],["x","y",3],[0],undefined,undefined,[],[1,2,3],[],[]]');
check('slice concat', () => { var a = [1, 2, 3, 4, 5]; return [a.slice(-2), a.slice(1, -1), a.slice(3, 1), a.slice(NaN), a.slice(undefined, undefined), a.slice(-100, 100), a.concat(6, [7, [8]], 'ab'), [].concat([], [[]]).length, a.slice(1.9, 3.1), Array.prototype.slice.call({ 0: 'a', 2: 'c', length: 3 }), Array.prototype.concat.call(1, 2).length]; },
    '[[4,5],[2,3,4],[],[1,2,3,4,5],[1,2,3,4,5],[1,2,3,4,5],[1,2,3,4,5,6,7,[8],"ab"],1,[2,3],["a",<hole>,"c"],2]');
check('search', () => { var a = [1, NaN, -0, 'x', null, undefined, {}, 1]; return [a.indexOf(NaN), a.includes(NaN), a.indexOf(0), a.includes(0), a.lastIndexOf(1), a.indexOf(1, 1), a.indexOf(1, -1), a.indexOf(1, -100), a.lastIndexOf(1, -2), a.lastIndexOf(1, -100), a.find(x => x !== x), a.findIndex(x => x === 'x'), a.findLast(x => typeof x === 'number'), a.findLastIndex(x => x === 1), a.at(-1), a.at(8), a.at(-9), a.includes(1, 8), a.indexOf(undefined), a.includes(null)]; },
    '[-1,true,2,true,7,7,7,0,0,-1,NaN,3,1,7,1,undefined,undefined,false,5,true]');
check('iteration methods', () => { var a = [1, 2, 3, 4]; return [a.map((x, i, arr) => x * i + arr.length), a.filter(x => x & 1), a.reduce((s, x) => s + x), a.reduceRight((s, x) => s + '' + x), a.some(x => x > 3), a.every(x => x > 1), a.flatMap(x => [x, [x * 2]]), [[1, [2, [3, [4]]]]].flat(2), [[1, [2, [3, [4]]]]].flat(Infinity), a.entries().next().value, [...a.keys()], [...a.values()], a.join(), a.join(''), [null, undefined, 1].join('-'), [[1, 2], [3]].join(';'), a.fill(0, 1, 3), a.copyWithin(0, 2), [1, 2, 3, 4, 5].copyWithin(-2, 0), [1, 2, 3, 4, 5].copyWithin(1, 3, 4), [1, 2, 3].fill(9, -1), [1, 2, 3].reverse()]; },
    '[[4,6,10,16],[1,3],10,"4321",true,false,[1,[2],2,[4],3,[6],4,[8]],[1,2,[3,[4]]],[1,2,3,4],[0,1],[0,1,2,3],[1,2,3,4],"1,2,3,4","1234","--1","1,2;3",[0,4,0,4],[0,4,0,4],[1,2,3,1,2],[1,4,3,4,5],[1,2,9],[3,2,1]]');
check('reduce empty', () => [].reduce((a, b) => a + b),
    'throws TypeError');
check('mutation during iteration', () => { var a = [1, 2, 3], seen = []; a.forEach((v, i) => { seen.push(v); if (i === 0) { a.push(4); a[1] = 'changed'; } }); var b = [1, 2, 3, 4], seen2 = []; b.forEach(v => { seen2.push(v); b.pop(); }); var c2 = [1, 2, 3], seen3 = []; for (var v of c2) { seen3.push(v); if (v === 1) c2.push(9); } return [seen, seen2, seen3, [1, 2, 3].map((v, i, arr) => { arr.length = 2; return v; })]; },
    '[[1,"changed",3],[1,2],[1,2,3,9],[1,2,<hole>]]');
check('array-like generics', () => { var o = { length: 3, 0: 'a', 1: 'b', 2: 'c' }; return [Array.prototype.map.call(o, x => x.toUpperCase()), Array.prototype.join.call(o), Array.prototype.push.call(o, 'd'), o.length, Array.prototype.pop.call(o), Array.prototype.reverse.call(o)[0], Array.prototype.indexOf.call('hello', 'l'), Array.prototype.includes.call({ length: 1, 0: NaN }, NaN), Array.prototype.fill.call({ length: 2 }, 7), Array.prototype.slice.call('abc', 1), Array.prototype.sort.call({ length: 3, 0: 'c', 1: 'a', 2: 'b' })[0], Array.prototype.shift.call({ length: 0 }), Array.prototype.concat.call([], o).length, Array.from({ length: 2.9 }).length, Array.prototype.at.call('xyz', -1)]; },
    '[["A","B","C"],"a,b,c",4,4,"d","c",2,true,{0:7,1:7,length:2},["b","c"],"a",undefined,1,2,"z"]');
check('species & subclass', () => { class A extends Array { static get [Symbol.species]() { return Array; } } var a = A.from([1, 2, 3]); return [a instanceof A, a.map(x => x) instanceof A, a.filter(Boolean).constructor === Array, a.slice().constructor === Array, a.length, A.of(1, 2).length, new A(3).length]; },
    '[true,false,true,true,3,2,3]');
check('toString/toLocaleString', () => [[1, [2, [3]]].toString(), [].toString(), [null].toString(), [undefined, null].toString(), [{}].toString(), [1, 2].toLocaleString().length > 0, String([[]]), String([[[], []]]), [1, 2] + '', [] + 1, [2] * [3], Array.prototype.toString.call({ join() { return 'J'; } }), Array.prototype.toString.call({})],
    '["1,2,3","","",",","[object Object]",true,"",",","1,2","1",6,"J","[object Object]"]');
check('destructuring & holes copy', () => { var [a, , c2 = 'd', ...r] = [1, , undefined, 4, , 6]; return [a, c2, r, 1 in r, [...[, 1]], Object.keys([...[, 1]]), Array.from([, 1]).hasOwnProperty(0), Object.assign([1, 2], [, 9]), [, 1].concat([, 2]).hasOwnProperty(0)]; },
    '[1,"d",[4,undefined,6],true,[undefined,1],["0","1"],true,[1,9],false]');
check('fast array to slow transitions', () => { var a = [1, 2, 3]; a[100] = 1; a.length = 3; a.push(4); delete a[1]; a.unshift('u'); Object.defineProperty(a, 0, { get() { return 'G'; }, configurable: true }); var r = [a.length, a[0], 2 in a, a.join(), a.map(x => x)]; a.foo = 1; r.push(Object.keys(a), JSON.stringify(a)); Object.freeze(a); try { 'use strict'; a.push(1); } catch (e) { r.push(e.name); } return r; },
    '[5,"G",false,"G,1,,3,4",["G",1,<hole>,3,4],["0","1","3","4","foo"],"["G",1,null,3,4]","TypeError"]');
check('array holes via delete in loops', () => { var a = [0, 1, 2, 3, 4], out = []; delete a[2]; for (var i = 0; i < a.length; i++) out.push(i in a ? a[i] : 'h'); for (var k in a) out.push(k); return [out, a.flat(), a.findIndex(x => x === undefined), a.indexOf(undefined), a.length]; },
    '[[0,1,"h",3,4,"0","1","3","4"],[0,1,3,4],2,-1,5]');
check('typed array ctor & conversion', () => [new Uint8Array([1, 255, 256, -1, 1.9, -1.9, NaN, '7', null, undefined, true, 300.5]), new Int8Array([127, 128, 255, 256, -129, 1e10]), new Uint8ClampedArray([-1, 0, 0.5, 1.5, 2.5, 254.5, 255.5, 300, NaN, Infinity, -Infinity, 0.49999, 1.50001]), new Int16Array([32767, 32768, 65535, 65536, -32769]), new Uint16Array([-1, 65536, 65537.9]), new Int32Array([2147483647, 2147483648, 4294967295, 4294967296, -2147483649, 1e20, -1e20, 2 ** 53 + 2, Infinity, NaN]), new Uint32Array([-1, 4294967296, 4294967297.5, -4294967295, 2 ** 53, 2 ** 64, 2 ** 63 + 2 ** 20, -(2 ** 40) - 7]), new Float32Array([1.1, 16777217, 1e39, -1e39, 1e-46, 5e-324, NaN, -0, 3.4028235e38, 3.4028236e38, 1.401298464324817e-45, 7e-46]), new Float64Array([1.1, 5e-324, -0, 1.7976931348623157e308, NaN])],
    '[Uint8Array[1,255,0,255,1,255,0,7,0,0,1,44],Int8Array[127,-128,-1,0,127,0],Uint8ClampedArray[0,0,0,2,2,254,255,255,0,255,0,0,2],Int16Array[32767,-32768,-1,0,32767],Uint16Array[65535,0,1],Int32Array[2147483647,-2147483648,-1,0,2147483647,1661992960,-1661992960,2,0,0],Uint32Array[4294967295,0,1,1,0,0,1048576,4294967289],Float32Array[1.100000023841858,16777216,Infinity,-Infinity,0,0,NaN,-0,3.4028234663852886e+38,Infinity,1.401298464324817e-45,0],Float64Array[1.1,5e-324,-0,1.7976931348623157e+308,NaN]]');
check('typed array wrap consistency', () => { var vals = [0, 1, -1, 127.5, 128, 255, 256, 32767, 32768, 65535, 65536, 2147483647, 2147483648, 4294967295, 4294967296, -2147483648, -2147483649, 1e15, -1e15, 2 ** 52 + 1, 2 ** 63, 2 ** 64 + 4096, 1.5e300, -0.9, 0.9], bad = []; vals.forEach(v => { var m = isFinite(v) ? Math.trunc(v) : 0, u8 = new Uint8Array([v])[0], i16 = new Int16Array([v])[0], u32 = new Uint32Array([v])[0], i32 = new Int32Array([v])[0]; if (u32 !== (v >>> 0) || i32 !== (v | 0) || u8 !== ((v >>> 0) & 255) || i16 !== (((v | 0) << 16) >> 16)) bad.push(v); }); return bad; },
    '[]');
check('endianness independence', () => { var b = new ArrayBuffer(8), d = new DataView(b), u8 = new Uint8Array(b); d.setUint32(0, 0x01020304); d.setUint16(4, 0x0506, true); d.setInt8(6, -1); d.setUint8(7, 0x80); return [Array.from(u8), d.getUint32(0, true), d.getUint16(4), d.getInt16(6), d.getInt16(6, true), d.getInt32(4), d.getUint8(7), d.getInt8(7)]; },
    '[[1,2,3,4,6,5,255,128],67305985,1541,-128,-32513,101056384,128,-128]');
check('DataView floats', () => { var d = new DataView(new ArrayBuffer(16)); d.setFloat64(0, Math.PI); var be = Array.from(new Uint8Array(d.buffer, 0, 8)); d.setFloat64(8, Math.PI, true); var le = Array.from(new Uint8Array(d.buffer, 8, 8)); d.setFloat32(0, 1.5); var f32 = Array.from(new Uint8Array(d.buffer, 0, 4)); d.setFloat32(4, -2.75, true); return [be, le, f32, d.getFloat32(0), d.getFloat32(4, true), d.getFloat64(8, true), d.getFloat32(4), (d.setFloat64(0, -0), 1 / d.getFloat64(0)), (d.setFloat64(0, NaN), d.getFloat64(0)), (d.setFloat32(0, 1e40), d.getFloat32(0)), (d.setFloat64(0, 5e-324), d.getFloat64(0)), (d.setFloat64(0, 5e-324, true), d.getUint8(0)), (d.setFloat32(0, 16777217), d.getFloat32(0)), (d.setFloat64(0, 1.7976931348623157e308, true), d.getFloat64(0, true))]; },
    '[[64,9,33,251,84,68,45,24],[24,45,68,84,251,33,9,64],[63,192,0,0],1.5,-2.75,3.141592653589793,1.7488204834773717e-41,-Infinity,NaN,Infinity,5e-324,1,16777216,1.7976931348623157e+308]');
check('DataView ints all sizes both orders', () => { var d = new DataView(new ArrayBuffer(8)), out = []; [['Int8', 1], ['Uint8', 1], ['Int16', 2], ['Uint16', 2], ['Int32', 4], ['Uint32', 4]].forEach(function (t) { [0x12345678, -1, -2147483648, 0x80, 0x8000, 0xdeadbeef, 255.9].forEach(function (v) { [false, true].forEach(function (le) { d['set' + t[0]](1, v, le); out.push(d['get' + t[0]](1, le) + ':' + d['get' + t[0]](1, !le) + ':' + d.getUint8(1)); }); }); }); return out.join(' '); },
    '"120:120:120 120:120:120 -1:-1:255 -1:-1:255 0:0:0 0:0:0 -128:-128:128 -128:-128:128 0:0:0 0:0:0 -17:-17:239 -17:-17:239 -1:-1:255 -1:-1:255 120:120:120 120:120:120 255:255:255 255:255:255 0:0:0 0:0:0 128:128:128 128:128:128 0:0:0 0:0:0 239:239:239 239:239:239 255:255:255 255:255:255 22136:30806:86 22136:30806:120 -1:-1:255 -1:-1:255 0:0:0 0:0:0 128:-32768:0 128:-32768:128 -32768:128:128 -32768:128:0 -16657:-4162:190 -16657:-4162:239 255:-256:0 255:-256:255 22136:30806:86 22136:30806:120 65535:65535:255 65535:65535:255 0:0:0 0:0:0 128:32768:0 128:32768:128 32768:128:128 32768:128:0 48879:61374:190 48879:61374:239 255:65280:0 255:65280:255 305419896:2018915346:18 305419896:2018915346:120 -1:-1:255 -1:-1:255 -2147483648:128:128 -2147483648:128:0 128:-2147483648:0 128:-2147483648:128 32768:8388608:0 32768:8388608:0 -559038737:-272716322:222 -559038737:-272716322:239 255:-16777216:0 255:-16777216:255 305419896:2018915346:18 305419896:2018915346:120 4294967295:4294967295:255 4294967295:4294967295:255 2147483648:128:128 2147483648:128:0 128:2147483648:0 128:2147483648:128 32768:8388608:0 32768:8388608:0 3735928559:4022250974:222 3735928559:4022250974:239 255:4278190080:0 255:4278190080:255"');
check('DataView errors', () => { var d = new DataView(new ArrayBuffer(4), 1, 2); return [d.byteLength, d.byteOffset, () => d.getInt16(1), () => d.getInt8(2), () => d.setInt32(0, 1), () => d.getInt8(-1), () => new DataView(new ArrayBuffer(2), 3), () => new DataView({}), () => d.getUint16(0), () => DataView(new ArrayBuffer(1)), () => new DataView(new ArrayBuffer(2), 1, 2)].map(f => { if (typeof f !== 'function') return f; try { return f(); } catch (e) { return e.name; } }); },
    '[2,1,"RangeError","RangeError","RangeError","RangeError","RangeError","TypeError",0,"TypeError","RangeError"]');
check('typed array views & offsets', () => { var b = new ArrayBuffer(16), u8 = new Uint8Array(b), i; for (i = 0; i < 16; i++) u8[i] = i * 17; var u16 = new Uint16Array(b, 2, 3), u32 = new Uint32Array(b, 4, 2), f64 = new Float64Array(b, 8, 1), dv = new DataView(b); return [u16.length, u16.byteOffset, u16.byteLength, u16[0] === dv.getUint16(2, false) || u16[0] === dv.getUint16(2, true), u32[1] === dv.getUint32(8, false) || u32[1] === dv.getUint32(8, true), new Uint8Array(u16.buffer, u16.byteOffset, 2)[0], u8.subarray(4, 8).byteOffset, u8.subarray(-2)[0], u8.slice(-2).buffer === b, u8.subarray(-2).buffer === b, f64.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT, u8.subarray(4).subarray(2, 4)[0]]; },
    '[3,2,6,true,true,34,4,238,false,true,8,4,102]');
check('typed array misaligned', () => new Uint16Array(new ArrayBuffer(8), 1),
    'throws RangeError');
check('typed array bad length', () => new Uint32Array(new ArrayBuffer(7)),
    'throws RangeError');
check('native byte order is consistent', () => { var u32 = new Uint32Array([0x01020304]), u8 = new Uint8Array(u32.buffer), big = u8[0] === 1; var f = new Float64Array([1]), fb = new Uint8Array(f.buffer); var dv = new DataView(u32.buffer); return [u8[0] === 1 || u8[0] === 4, dv.getUint32(0, !big) === 0x01020304, (big ? fb[0] : fb[7]) === 0x3f, (big ? fb[1] : fb[6]) === 0xf0, new Uint16Array(new Uint8Array(big ? [0x12, 0x34] : [0x34, 0x12]).buffer)[0] === 0x1234, new Float32Array(new Uint8Array(big ? [0x3f, 0x80, 0, 0] : [0, 0, 0x80, 0x3f]).buffer)[0], new Float64Array(new Uint8Array(big ? [0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18] : [0x18, 0x2d, 0x44, 0x54, 0xfb, 0x21, 0x09, 0x40]).buffer)[0], new Int16Array(new Uint8Array(big ? [0xff, 0xfe] : [0xfe, 0xff]).buffer)[0], new BigInt64Array(new Uint8Array(big ? [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe] : [0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]).buffer)[0], new BigUint64Array(new Uint8Array(big ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]).buffer)[0]]; },
    '[true,true,true,true,true,1,3.141592653589793,-2,-2n,72623859790382856n]');
check('typed array methods', () => { var a = new Int16Array([5, -3, 8, 0, -3]); return [a.slice(1, 3), a.subarray(1, 3), a.map(x => x * 2), a.filter(x => x < 0), a.reduce((s, x) => s + x), a.indexOf(-3), a.lastIndexOf(-3), a.includes(8), a.join('|'), Array.from(a.entries())[1], a.find(x => x > 5), a.findIndex(x => x > 5), a.findLast(x => x < 0), a.every(x => x < 9), a.some(x => x > 7), a.at(-1), a.slice().reverse(), a.slice().sort(), a.slice().sort((x, y) => y - x), a.slice().fill(7, 1, 3), a.slice().copyWithin(0, 3), a.toString(), a.length, a.byteLength, [...a.keys()], a.toSorted ? a.toSorted() : null, a.with ? a.with(0, 99) : null, a.toReversed ? a.toReversed() : null]; },
    '[Int16Array[-3,8],Int16Array[-3,8],Int16Array[10,-6,16,0,-6],Int16Array[-3,-3],7,1,4,true,"5|-3|8|0|-3",[1,-3],8,2,-3,true,true,-3,Int16Array[-3,0,8,-3,5],Int16Array[-3,-3,0,5,8],Int16Array[8,5,0,-3,-3],Int16Array[5,7,7,0,-3],Int16Array[0,-3,8,0,-3],"5,-3,8,0,-3",5,10,[0,1,2,3,4],Int16Array[-3,-3,0,5,8],Int16Array[99,-3,8,0,-3],Int16Array[-3,0,8,-3,5]]');
check('typed array sort numeric incl special', () => [new Float64Array([3, -0, 0, NaN, -Infinity, Infinity, -1, 1e-320, -5e-324]).sort(), new Float32Array([NaN, 1, -1, 0, -0]).sort(), new Uint8Array([200, 100, 255, 0]).sort(), new Int8Array([-128, 127, 0, -1]).sort(), new Uint32Array([4294967295, 0, 2147483648, 2147483647]).sort(), new Int32Array([2147483647, -2147483648, 0, -1]).sort(), new Uint16Array([65535, 1, 32768]).sort(), new Float64Array([0, -0]).sort().map(x => 1 / x)],
    '[Float64Array[-Infinity,-1,-5e-324,-0,0,1e-320,3,Infinity,NaN],Float32Array[-1,-0,0,1,NaN],Uint8Array[0,100,200,255],Int8Array[-128,-1,0,127],Uint32Array[0,2147483647,2147483648,4294967295],Int32Array[-2147483648,-1,0,2147483647],Uint16Array[1,32768,65535],Float64Array[-Infinity,Infinity]]');
check('typed array set', () => { var a = new Uint8Array(8); a.set([1, 2, 3], 2); a.set(new Uint16Array([0x1ff, 5]), 5); var o = new Uint8Array([1, 2, 3, 4, 5]); o.set(o.subarray(0, 3), 2); var f = new Float32Array(2); f.set(new Float64Array([1.1, 2 ** 130])); var i = new Int8Array(3); i.set(new Float64Array([300.7, -129, NaN])); return [a, o, f, i]; },
    '[Uint8Array[0,0,1,2,3,255,5,0],Uint8Array[1,2,1,2,3],Float32Array[1.100000023841858,Infinity],Int8Array[44,127,0]]');
check('typed array set range', () => new Uint8Array(2).set([1, 2, 3]),
    'throws RangeError');
check('typed array out of bounds & props', () => { var a = new Uint8Array(2); a[5] = 1; a[-1] = 1; a['1.5'] = 1; a.foo = 'bar'; a['1'] = 9; return [a[5], a[-1], a.foo, a[1], Object.keys(a), 5 in a, 1 in a, '-0' in a, delete a[0], a.hasOwnProperty(0), Object.getOwnPropertyDescriptor(a, 0), a.length]; },
    'throws TypeError');
check('typed array conversions between kinds', () => [new Uint8Array(new Float64Array([1.9, -1.9, 256.5, NaN])), new Float32Array(new Int32Array([16777217, -2147483648])), new Int32Array(new Float32Array([1e10, -1.5])), new Uint8ClampedArray(new Int16Array([-5, 300])), new Float64Array(new Uint32Array([4294967295])), new Int16Array(new Uint8Array([200, 255])), new Uint8Array(new Int8Array([-1, -128])), Uint8Array.from('123'), Uint8Array.from({ length: 3 }, (v, i) => i * 100), Int8Array.of(1, 200, -200), new Uint8Array(new Set([1, 2])), new Uint8Array({ length: 2, 0: 7 })],
    '[Uint8Array[1,255,0,0],Float32Array[16777216,-2147483648],Int32Array[1410065408,-1],Uint8ClampedArray[0,255],Float64Array[4294967295],Int16Array[200,255],Uint8Array[255,128],Uint8Array[1,2,3],Uint8Array[0,100,200],Int8Array[1,-56,56],Uint8Array[1,2],Uint8Array[7,0]]');
check('typed array mix BigInt', () => new BigInt64Array(new Int32Array([1])),
    'throws TypeError');
check('ArrayBuffer', () => { var b = new ArrayBuffer(8); new Uint8Array(b).set([1, 2, 3, 4, 5, 6, 7, 8]); var s = b.slice(2, -2), r = [b.byteLength, s.byteLength, Array.from(new Uint8Array(s)), b.slice(6, 2).byteLength, ArrayBuffer.isView(new DataView(b)), ArrayBuffer.isView(b), b.slice(-3).byteLength, new ArrayBuffer(0).byteLength, Object.prototype.toString.call(b)]; if (b.resize) { var rb = new ArrayBuffer(4, { maxByteLength: 16 }), view = new Uint8Array(rb); rb.resize(8); r.push(rb.byteLength, view.length, rb.resizable, rb.maxByteLength); rb.resize(2); r.push(view.length); } if (b.transfer) { var t = b.transfer(4); r.push(t.byteLength, b.byteLength, b.detached, new Uint8Array(t)[3]); } return r; },
    '[8,4,[3,4,5,6],0,true,false,3,0,"[object ArrayBuffer]",8,8,true,16,2,4,0,true,4]');
check('ArrayBuffer bad length', () => new ArrayBuffer(-1),
    'throws RangeError');
check('Float16Array', () => typeof Float16Array === 'function' ? [new Float16Array([1.5, 65504, 65520, 1e-8, 0.1, -0, 2049, 2051])] : 'n/a',
    '[Float16Array[1.5,65504,Infinity,0,0.0999755859375,-0,2048,2052]]');
check('Float32 rounding', () => [Math.fround(0.1), Math.fround(1 + 2 ** -24), Math.fround(1 + 2 ** -23), Math.fround(1 + 2 ** -24 + 2 ** -40), Math.fround(3.4028235677973366e38), Math.fround(3.40282356779733661638e38), Math.fround(-1.401298464324817e-45 / 2), Math.fround(1.401298464324817e-45 / 2 + 1e-60), Math.fround(1e-39), Math.fround(16777215.5), Math.fround(16777216.5), Math.fround(16777217.5), Math.fround(-16777219), Math.fround(0.5 - 2 ** -26), Math.fround(1.1754943508222875e-38), Math.fround(1.1754942106924411e-38)],
    '[0.10000000149011612,1,1.0000001192092896,1.0000001192092896,Infinity,Infinity,-0,1.401298464324817e-45,1.0000002153053333e-39,16777216,16777216,16777218,-16777220,0.5,1.1754943508222875e-38,1.1754942106924411e-38]');
check('float64 bit patterns', () => { var d = new DataView(new ArrayBuffer(8)); return [0.1, -2, 1e300, 5e-324, 2.2250738585072014e-308, Infinity, -Infinity, -0, 123456789.125, 0.1 + 0.2, 2 ** 53, 1 / 3].map(v => { d.setFloat64(0, v); return d.getUint32(0).toString(16) + '_' + d.getUint32(4).toString(16); }); },
    '["3fb99999_9999999a","c0000000_0","7e37e43c_8800759c","0_1","100000_0","7ff00000_0","fff00000_0","80000000_0","419d6f34_54800000","3fd33333_33333334","43400000_0","3fd55555_55555555"]');
check('float32 bit patterns', () => { var d = new DataView(new ArrayBuffer(4)); return [0.1, -2, 1e38, 1e-45, 1.17549435e-38, Infinity, -0, 16777217, 0.1 + 0.2, 1 / 3, 3.4028235e38, 1e39, 1e-46, 2.5e-45].map(v => { d.setFloat32(0, v); return d.getUint32(0).toString(16); }); },
    '["3dcccccd","c0000000","7e967699","1","800000","7f800000","80000000","4b800000","3e99999a","3eaaaaab","7f7fffff","7f800000","0","2"]');
check('NaN payloads are canonical on read', () => { var d = new DataView(new ArrayBuffer(8)); d.setUint32(0, 0x7ff80000); d.setUint32(4, 1); var a = d.getFloat64(0); d.setUint32(0, 0xfff00000); d.setUint32(4, 5); var b = d.getFloat64(0); d.setUint32(0, 0x7fc00001); return [a !== a, b !== b, isNaN(d.getFloat32(0)), Object.is(a, NaN)]; },
    '[true,true,true,true]');
check('typed array iteration & spread', () => { var a = new Uint8Array([1, 2, 3]); var s = 0; for (var v of a) s += v; return [s, [...a], Math.max(...a), Array.prototype.slice.call(a), Array.prototype.map.call(a, x => x * 300), a.map(x => x * 300), JSON.stringify(a), JSON.stringify({ a }), Object.entries(a), Array.isArray(a), a instanceof Uint8Array, Object.getPrototypeOf(Uint8Array).name, a.constructor.name, a[Symbol.toStringTag]]; },
    '[6,[1,2,3],3,[1,2,3],[300,600,900],Uint8Array[44,88,132],"{"0":1,"1":2,"2":3}","{"a":{"0":1,"1":2,"2":3}}",[["0",1],["1",2],["2",3]],false,true,"TypedArray","Uint8Array","Uint8Array"]');
check('typed array subclass & species', () => { class U extends Uint8Array { sum() { return this.reduce((x, y) => x + y, 0); } } var u = new U([1, 2, 3]); return [u.sum(), u.map(x => x * 2) instanceof U, u.subarray(1) instanceof U, u.slice(1).sum(), U.from([4, 5]).sum(), U.BYTES_PER_ELEMENT]; },
    '[6,true,true,5,9,1]');
check('64-bit float arithmetic via arrays', () => { var f = new Float64Array(4); f[0] = 0.1; f[1] = 0.2; f[2] = f[0] + f[1]; f[3] = f[2] * 1e16; var g = new Float32Array(3); g[0] = 0.1; g[1] = 0.2; g[2] = g[0] + g[1]; return [f[2], f[3], g[0], g[2], g[0] + g[1], f[0] === 0.1, g[0] === 0.1, g[0] === Math.fround(0.1)]; },
    '[0.30000000000000004,3000000000000000.5,0.10000000149011612,0.30000001192092896,0.30000000447034836,true,false,true]');
check('int typed array arithmetic', () => { var a = new Int32Array(3), u = new Uint32Array(2), b = new Uint8Array(2), i16 = new Int16Array(1); a[0] = 2147483647; a[0]++; a[1] = -2147483648; a[1]--; a[2] = 65536 * 65536 + 5; u[0] = 0; u[0]--; u[1] = 4294967295; u[1] += 2; b[0] = 255; b[0]++; b[1] = 0; b[1] -= 1; i16[0] = 32767; i16[0] += 1; return [a, u, b, i16, a[0] + u[0], u[0] * 2, u[0] >> 1, u[0] >>> 1, a[0] >>> 0, (u[0] | 0), u[0] ^ a[0]]; },
    '[Int32Array[-2147483648,2147483647,5],Uint32Array[4294967295,1],Uint8Array[0,255],Int16Array[-32768],2147483647,8589934590,-1,2147483647,2147483648,-1,2147483647]');
check('structured data: nested arrays compare', () => { var grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c2) => r * 5 + c2)); var t = grid[0].map((_, c2) => grid.map(r => r[c2])); return [t[1], grid.flat().reduce((a, b) => a + b), grid.map(r => r.reduce((a, b) => a + b)), JSON.stringify(t) === JSON.stringify(grid[0].map((_, c2) => grid.map(r => r[c2])))]; },
    '[[1,6,11,16,21],300,[10,35,60,85,110],true]');
check('Iterator helpers', () => typeof Iterator === 'function' && Iterator.prototype.map ? [[1, 2, 3, 4].values().map(x => x * 2).filter(x => x > 2).take(2).toArray(), [1, 2, 3].values().drop(1).reduce((a, b) => a + b), [1, 2].values().flatMap(x => [x, x]).toArray(), [1, 2, 3].values().some(x => x > 2), [1, 2, 3].values().every(x => x > 2), [1, 2, 3].values().find(x => x > 1), Iterator.from({ next() { return { done: true }; } }).toArray()] : 'n/a',
    '[[4,6],5,[1,1,2,2],true,false,2,[]]');
check('Array.fromAsync exists', () => typeof Array.fromAsync,
    '"function"');
check('array index edge keys', () => { var a = []; a[4294967294] = 1; a['4294967295'] = 2; a[2 ** 32] = 3; var o = {}; o[1e21] = 1; o[0.1] = 2; o[-0] = 3; o[1e-7] = 4; o[2 ** 53] = 5; o[4294967295] = 6; o[4294967294] = 7; o[2147483648] = 8; return [a.length, Object.keys(a), Object.keys(o)]; },
    '[4294967295,["4294967294","4294967295","4294967296"],["0","2147483648","4294967294","1e+21","0.1","1e-7","9007199254740992","4294967295"]]');

/* ---- Section C: the event loop ------------------------------------- */

/**
 * Wait a number of milliseconds on the event loop.
 * @param {number} ms how long
 * @returns {Promise<void>} resolves after the wait
 */
function sleep(ms) { return new Promise(resolve => os.setTimeout(resolve, ms)); }

/**
 * Run a body that appends to a log, then compare the whole log with
 * the lines Node.js produces for the same body.
 * @param {string} label name of the check
 * @param {function(function(string): void): Promise<void>} body the code under test
 * @param {string[]} expected log lines in order
 * @returns {Promise<void>} resolves when the comparison is recorded
 */
async function checkLog(label, body, expected) {
    var log = [];
    try {
        await body(s => { log.push(s); });
    } catch (e) {
        log.push('body threw ' + (e && e.name));
    }
    compare(label, log.join(' | '), expected.join(' | '));
}

/**
 * "for await": how each way of leaving the loop treats the iterator.
 * @param {function(string): void} L appends one line to the log
 * @returns {Promise<void>} resolves when every loop has run
 */
async function forAwaitCases(L) {
    /**
     * An async iterator over 0..n-1 whose return() logs and takes two
     * turns of the microtask queue to settle.
     * @param {string} tag name used in the log
     * @param {number} n number of values
     * @param {boolean} [noReturn] leave the return method out
     * @returns {object} the iterator
     */
    function mk(tag, n, noReturn) {
        var it = { i: 0, [Symbol.asyncIterator]() { return this; }, next() { return Promise.resolve(this.i < n ? { value: this.i++, done: false } : { value: undefined, done: true }); } };
        if (!noReturn) it.return = function () { L(tag + ' return called'); return new Promise(r => Promise.resolve().then(() => Promise.resolve().then(() => { L(tag + ' return settled'); r({}); }))); };
        return it;
    }
    for await (var a of mk('A', 2)) L('a' + a);
    L('A ran to its end: return() not called');
    for await (var b of mk('B', 3)) { L('b' + b); if (b === 1) break; }
    L('B after break');
    outer: for (var k = 0; k < 2; k++) { for await (var c2 of mk('C' + k, 3)) { L('c' + c2); continue outer; } }
    L('C after continue outer');
    L('D ' + await (async () => { for await (var d of mk('D', 3)) { return 'ret' + d; } })());
    L('D after return');
    out2: for await (var e of mk('E', 2)) { for await (var f of mk('F', 2)) { L('ef' + e + f); break out2; } }
    L('EF after nested break');
    for await (var g of mk('G', 3, true)) { L('g' + g); break; }
    L('G no return method');
    async function* gen() { try { yield 1; yield 2; yield 3; } finally { L('gen cleanup start'); await null; L('gen cleanup end'); } }
    for await (var h of gen()) { L('h' + h); if (h === 2) break; }
    L('H after generator break');
    async function* relay() { for await (var x of mk('R', 5)) { yield x * 10; if (x === 1) return 'done'; } }
    var seen = []; for await (var r of relay()) seen.push(r);
    L('R relay ' + seen.join(','));
    async function* relay2() { try { for await (var x of mk('S', 5)) { yield x; } } finally { L('relay2 finally'); } }
    for await (var s of relay2()) { L('s' + s); break; }
    L('S after break of outer consumer');
    try { for await (var t of mk('T', 3)) { try { L('t' + t); break; } finally { L('T inner finally'); } } } finally { L('T outer finally'); }
    var bad = { [Symbol.asyncIterator]() { return this; }, next() { return Promise.resolve({ value: 1, done: false }); }, return() { return Promise.resolve(5); } };
    try { for await (var u of bad) break; L('U no error'); } catch (err) { L('U ' + err.name); }
    var rej = { [Symbol.asyncIterator]() { return this; }, next() { return Promise.resolve({ value: 1, done: false }); }, return() { return Promise.reject(new RangeError('from return')); } };
    try { for await (var v of rej) break; L('V no error'); } catch (err) { L('V ' + err.name); }
    for await (var w of [Promise.resolve('w1'), 'w2']) { L(w); if (w === 'w1') break; }
    L('W sync iterable');
    var cnt = 0; for (var q = 0; q < 3; q++) { for await (var z of mk('Z' + q, 2)) { cnt += z; } }
    L('Z count ' + cnt);
}

const FOR_AWAIT_EXPECTED = [
    'a0',
    'a1',
    'A ran to its end: return() not called',
    'b0',
    'b1',
    'B return called',
    'B return settled',
    'B after break',
    'c0',
    'C0 return called',
    'C0 return settled',
    'c0',
    'C1 return called',
    'C1 return settled',
    'C after continue outer',
    'D return called',
    'D return settled',
    'D ret0',
    'D after return',
    'ef00',
    'F return called',
    'F return settled',
    'E return called',
    'E return settled',
    'EF after nested break',
    'g0',
    'G no return method',
    'h1',
    'h2',
    'gen cleanup start',
    'gen cleanup end',
    'H after generator break',
    'R return called',
    'R return settled',
    'R relay 0,10',
    's0',
    'S return called',
    'S return settled',
    'relay2 finally',
    'S after break of outer consumer',
    't0',
    'T inner finally',
    'T return called',
    'T return settled',
    'T outer finally',
    'U TypeError',
    'V RangeError',
    'w1',
    'W sync iterable',
    'Z count 3'
];

/**
 * The order in which promise reactions, awaits and async generators
 * run, without any timer.
 * @param {function(string): void} L appends one line to the log
 * @returns {Promise<void>} resolves when the queue has drained
 */
async function microtaskCases(L) {
    /**
     * Resolve after a number of turns of the microtask queue.
     * @param {number} n turns to wait
     * @param {*} v value to resolve with
     * @returns {Promise<*>} the promise
     */
    function later(n, v) { var p = Promise.resolve(v); while (n-- > 0) p = p.then(x => x); return p; }
    var i;
    L('sync start');
    Promise.resolve().then(() => L('micro 1')).then(() => L('micro 3'));
    Promise.resolve().then(() => L('micro 2')).then(() => L('micro 4'));
    queueMicrotask(() => L('queueMicrotask'));
    (async function () { L('async body start'); await null; L('after await 1'); await new Promise(r => r()); L('after await 2'); })();
    new Promise((res, rej) => { L('executor'); rej(new Error('rej')); }).catch(e => L('caught ' + e.message)).finally(() => L('finally'));
    var thenable = { then(r) { L('thenable.then called'); r('tv'); } };
    Promise.resolve(thenable).then(v => L('thenable resolved ' + v));
    (async () => { try { await Promise.reject('R'); } catch (e) { L('async catch ' + e); } finally { L('async finally'); } return 'ret'; })().then(v => L('async returned ' + v));
    (async () => { var r = await Promise.all([later(3, 'a'), 'b', later(1, 'c')]); L('all ' + r.join('')); })();
    Promise.race([later(5, 'slow'), later(1, 'fast')]).then(v => L('race ' + v));
    Promise.allSettled([Promise.reject(1), 2]).then(r => L('allSettled ' + r.map(x => x.status[0] + (x.value || x.reason)).join(',')));
    Promise.any([Promise.reject(1), later(2, 'any-ok')]).then(v => L('any ' + v));
    Promise.any([Promise.reject(1)]).catch(e => L('any fail ' + e.constructor.name + ' ' + e.errors.length));
    (async () => { class T { constructor() { this.n = 0; } then(res) { this.n++; res(this.n); } } var t = new T(); L('custom thenable await ' + (await t) + (await t)); })();
    (function () { function* g() { var x = yield 1; L('gen got ' + x); } var it = g(); it.next(); Promise.resolve('pv').then(v => it.next(v)); })();
    (async () => { var order = []; var p1 = (async () => { order.push('a1'); await 0; order.push('a2'); await 0; order.push('a3'); })(); var p2 = (async () => { order.push('b1'); await 0; order.push('b2'); })(); await p1; await p2; L('interleave ' + order.join(' ')); })();
    (async () => { try { await (async () => { throw new TypeError('inner'); })(); } catch (e) { L('rethrow ' + e.name + ' ' + (e instanceof TypeError)); } })();
    (async () => { var p = Promise.reject(new Error('late')); await later(3); try { await p; } catch (e) { L('late handler ' + e.message); } })();
    (async () => { var s = ''; var chain = Promise.resolve(0); for (let j = 1; j <= 5; j++) chain = chain.then(v => { s += v; return v + j; }); L('chain ' + (await chain) + ' ' + s); })();
    (async () => { var res = await Promise.all([1, 2, 3].map(async (x, j) => { await later(3 - j); return x * 2; })); L('map async ' + res.join(',')); })();
    (async () => { var e1 = await Promise.reject(1).then(() => 'no', e => 'h' + e); var e2 = await Promise.resolve(1).finally(() => 'ignored'); var e3 = await Promise.reject(2).finally(() => { }).catch(e => 'c' + e); var e4 = await Promise.resolve(3).finally(() => { throw 'ft'; }).catch(e => e); L('then/finally ' + [e1, e2, e3, e4].join(' ')); })();
    (async () => { var it = (async function* () { var x = yield 1; var y = yield x + 1; return y * 2; })(); var a = await it.next(); var b = await it.next(10); var c2 = await it.next(7); var d = await it.next(); L('async gen protocol ' + JSON.stringify([a, b, c2, d])); var it2 = (async function* () { try { yield 1; } finally { L('async gen cleanup'); } })(); await it2.next(); var r = await it2.return('early'); L('async gen return ' + JSON.stringify(r)); var it3 = (async function* () { yield 1; })(); await it3.next(); try { await it3.throw(new RangeError('thrown in')); } catch (e) { L('async gen throw ' + e.name); } })();
    (async () => { var order = []; var p = Promise.resolve(); p.then(() => order.push(1)); await p; order.push(2); p.then(() => order.push(3)); await null; order.push(4); L('await vs then ' + order.join('')); })();
    (async () => { var p = new Promise(r => r(1)); var r2 = []; new Promise((res, rej) => { res('first'); res('second'); rej('third'); }).then(v => r2.push(v)); await later(2); L('promise identity ' + (Promise.resolve(p) === p) + ' ' + r2.join()); })();
    L('sync end');
    for (i = 0; i < 80; i++) await null;
}

const MICROTASK_EXPECTED = [
    'sync start',
    'async body start',
    'executor',
    'sync end',
    'micro 1',
    'micro 2',
    'queueMicrotask',
    'after await 1',
    'caught rej',
    'thenable.then called',
    'async catch R',
    'async finally',
    'gen got pv',
    'rethrow TypeError true',
    'micro 3',
    'micro 4',
    'after await 2',
    'finally',
    'thenable resolved tv',
    'async returned ret',
    'allSettled r1,f2',
    'any fail AggregateError 1',
    'await vs then 1234',
    'race fast',
    'promise identity true first',
    'any any-ok',
    'custom thenable await 12',
    'interleave a1 b1 a2 b2 a3',
    'all abc',
    'late handler late',
    'chain 15 013610',
    'map async 2,4,6',
    'async gen protocol [{"value":1,"done":false},{"value":11,"done":false},{"value":14,"done":true},{"done":true}]',
    'async gen cleanup',
    'async gen return {"value":"early","done":true}',
    'then/finally h1 1 c2 ft',
    'async gen throw RangeError'
];

/**
 * Closures over the variables of async functions and generators must
 * keep those variables alive across garbage collections. Until 0.236 a
 * suspended async function that could only be reached through such a
 * closure (here: from a timer) was freed as an unreachable cycle; the
 * timer then called a freed function. Depending on what the memory
 * held by then that was a wrong answer, "not a function", or a crash.
 * @returns {Promise<void>} resolves when the checks are recorded
 */
async function closureCases() {
    var out = [], keep4, wr7, f9, i;
    /**
     * Record one line of the result.
     * @param {string} s the line
     * @returns {void}
     */
    function L(s) { out.push(s); }

    /* 1: a promise's resolve function held in an async local, called from a timer */
    (async () => { var res; var p = new Promise(r => { res = r; }); os.setTimeout(() => res('v1'), 20); L('1 ' + (await p)); })();
    /* 2: the same through Promise.withResolvers */
    (async () => { var w = Promise.withResolvers(); os.setTimeout(() => w.resolve('v2'), 20); L('2 ' + (await w.promise)); })();
    /* 3: the timer writes an async local that the function reads after the await */
    (async () => { var flag = 'unset', res; var p = new Promise(r => { res = r; }); os.setTimeout(() => { flag = 'set'; res(); }, 20); await p; L('3 ' + flag); })();
    /* 4: a generator local captured by a closure that outlives the generator */
    keep4 = (function () { function* g() { var secret = { v: 'v4' }; yield () => secret.v; } return g().next().value; })();
    /* 5: a generator kept alive only by its own closure in a timer */
    (function () { function* g() { var n = 0; var bump = () => ++n; yield bump; yield n; } var it = g(); var bump = it.next().value; os.setTimeout(() => { bump(); bump(); L('5 ' + it.next().value); }, 20); })();
    /* 6: an async generator local captured by a timer closure */
    (async () => { async function* ag() { var res; var p = new Promise(r => { res = r; }); os.setTimeout(() => res('v6'), 20); yield await p; } for await (var v of ag()) L('6 ' + v); })();
    /* 7: garbage must still be collected: an async function suspended for ever whose closure is stored in its own frame */
    (function () { (async () => { var big = { payload: new Array(1000).fill(7) }; wr7 = new WeakRef(big); var self = () => big; await new Promise(() => { }); L('7 never ' + self); })(); })();
    /* 8: per-iteration closures in an async loop, with collections between the awaits */
    (async () => { var fns = []; for (let j = 0; j < 3; j++) { await null; fns.push(() => j); std.gc(); } await null; std.gc(); L('8 ' + fns.map(f => f()).join('')); })();
    /* 9: the arguments object of a non-strict async function */
    f9 = new Function('setT', 'L', 'return async function (a) { var args = arguments; var res; var p = new Promise(r => { res = r; }); setT(() => { a = "v9"; res(); }, 20); await p; L("9 " + args[0]); }')(os.setTimeout, L);
    f9('orig');

    std.gc();
    await null;
    std.gc();
    await sleep(5);
    std.gc();
    await sleep(60);
    std.gc();
    L('4 ' + keep4());
    /* a WeakRef target is kept until the job that read it has ended */
    for (i = 0; i < 3; i++) { await sleep(1); std.gc(); }
    L('7 collected ' + (wr7.deref() === undefined));
    out.sort();
    compare('closures over async and generator variables survive garbage collection',
        out.join(' | '),
        '1 v1 | 2 v2 | 3 set | 4 v4 | 5 2 | 6 v6 | 7 collected true | 8 012 | 9 v9');
}

/**
 * Timers run in the order they fall due, also when several have
 * expired before the loop gets to them.
 * @returns {Promise<void>} resolves when the checks are recorded
 */
async function timerCases() {
    var order = [], start, id;
    os.setTimeout(() => order.push('due at 40'), 40);
    os.setTimeout(() => order.push('due at 10'), 10);
    os.setTimeout(() => order.push('due at 0'), 0);
    os.setTimeout(() => order.push('due at 25'), 25);
    id = os.setTimeout(() => order.push('cancelled'), 5);
    os.clearTimeout(id);
    /* keep the loop away until all four have expired */
    start = Date.now();
    while (Date.now() - start < 80) { }
    await sleep(120);
    compare('expired timers run in the order they fell due',
        order.join(' | '), 'due at 0 | due at 10 | due at 25 | due at 40');

    order = [];
    os.setTimeout(() => { order.push('outer'); os.setTimeout(() => order.push('inner'), 0); Promise.resolve().then(() => order.push('microtask')); }, 0);
    os.setTimeout(() => order.push('second'), 1);
    await sleep(60);
    compare('microtasks of a timer run before the next timer',
        order.slice(0, 2).join(' | ') + ' ; ' + order.slice().sort().join(' | '),
        'outer | microtask ; inner | microtask | outer | second');
}

section('C. The event loop: for await, closures across GC, microtask order, timers');
(async () => {
    await checkLog('for await: break, continue, return and normal end close the iterator as specified', forAwaitCases, FOR_AWAIT_EXPECTED);
    await checkLog('order of promise reactions, awaits and async generators', microtaskCases, MICROTASK_EXPECTED);
    await closureCases();
    await timerCases();
})().catch(e => {
    failed++;
    print('FAIL section C stopped: ' + (e && e.name) + ' ' + (e && e.message));
}).then(() => {
    print('');
    print('=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
    if (failed > 0) std.exit(1);
});
