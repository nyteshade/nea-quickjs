/*
 * test_fpu_numeric.js -- numeric results that were wrong on the FPU
 * variants of quickjs.library up to 0.231 (and a few that were wrong
 * on every variant). Valid on all six variants.
 *
 * What it covers, with the old wrong answer:
 *   - 65536*65536 was 0 (int64 -> double helper tested the wrong flags)
 *   - Math.floor(3e9) was 2147483647 on the 68040 (rounding went
 *     through a 32-bit integer); ceil, trunc, round, -0, NaN, Infinity
 *   - 2**32 was 4294967295.9999967 (pow was exp(y*log(x)))
 *   - 0.1+0.2 was 0.3 and 1/1e10 was 9.999999999999999e-11 when the
 *     calling program had opened mathieeedoubbas.library (FPU left
 *     rounding toward zero)
 *   - Math.fround did nothing; Math.cbrt returned 0, 1 or garbage
 *   - int64 conversions used by Date, typed arrays and BigInt
 *   - % with large and negative operands
 *
 * Expected values are what node prints. Exact results are compared
 * with ===; functions built on sin/exp/log are allowed the last few
 * digits (see near()).
 *
 * Under vamos the FPU variants stop in the last section (Date.UTC):
 * an emulator limit, see there. On an Amiga the run ends with the
 * "=== Results" line.
 *
 * Run with: qjs tests/test_fpu_numeric.js
 */

let pass = 0, fail = 0;

/**
 * Record one check.
 * @param {boolean} cond - true if the check holds
 * @param {string} msg - what was checked
 * @returns {void}
 */
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

/**
 * Show a number so that -0 and 0 differ.
 * @param {number} v - the number
 * @returns {string} its text
 */
function show(v) {
    return (v === 0 && 1 / v < 0) ? "-0" : String(v);
}

/**
 * Check that two numbers are the same value: NaN equals NaN, 0 does
 * not equal -0.
 * @param {number} got - the computed value
 * @param {number} want - the expected value
 * @param {string} msg - the expression, for the report
 * @returns {void}
 */
function same(got, want, msg) {
    const good = Object.is(got, want);
    ok(good, msg + " = " + show(want) + (good ? "" : " (got " + show(got) + ")"));
}

/**
 * Check that a number is within a relative distance of the expected
 * one (default 4e-15, about 18 units in the last place). Used for the
 * transcendental functions, whose last digits depend on the maths
 * library or FPU of the machine.
 * @param {number} got - the computed value
 * @param {number} want - the expected value
 * @param {string} msg - the expression, for the report
 * @param {number} [tol] - allowed relative error
 * @returns {void}
 */
function near(got, want, msg, tol) {
    const t = tol === undefined ? 4e-15 : tol;
    const good = Object.is(got, want) ||
                 Math.abs(got - want) <= t * Math.abs(want);
    ok(good, msg + " ~ " + show(want) + (good ? "" : " (got " + show(got) + ")"));
}

/**
 * Hide a value from constant folding: the engine must compute with it
 * at run time.
 * @param {number} x - any number
 * @returns {number} x
 */
function v(x) { return x; }

print("=== FPU numeric test ===");

print("-- integer multiply beyond 32 bits (int64 -> double)");
same(v(65536) * v(65536), 4294967296, "65536*65536");
same(v(131072) * v(98304), 12884901888, "131072*98304");
same(v(-65536) * v(65536), -4294967296, "-65536*65536");
same(v(1073741824) * v(8), 8589934592, "1073741824*8");
same(v(46341) * v(46341), 2147488281, "46341*46341");
same(v(2147483647) * v(2147483647), 4611686014132420609, "2147483647*2147483647");
same(v(-2147483648) * v(-2147483648), 4611686018427387904, "-2147483648*-2147483648");
same(v(123456789) * v(987654321), 121932631112635260, "123456789*987654321");
same(v(94906267) * v(94906267), 9007199515875288, "94906267*94906267 (rounds to even)");
same(v(3) * v(1431655765), 4294967295, "3*1431655765");
same(Math.imul(v(65536), v(65536)), 0, "Math.imul(65536,65536)");

print("-- floor / ceil / trunc / round over the whole range");
same(Math.floor(v(3e9)), 3000000000, "Math.floor(3e9)");
same(Math.floor(v(-3000000000.7)), -3000000001, "Math.floor(-3000000000.7)");
same(Math.floor(v(1794353317748.5)), 1794353317748, "Math.floor(1794353317748.5)");
same(Math.floor(v(2147483648.5)), 2147483648, "Math.floor(2147483648.5)");
same(Math.floor(v(-2147483648.5)), -2147483649, "Math.floor(-2147483648.5)");
same(Math.floor(v(4503599627370495.5)), 4503599627370495, "Math.floor(2^52-0.5)");
same(Math.floor(v(9007199254740992)), 9007199254740992, "Math.floor(2^53)");
same(Math.floor(v(1e300)), 1e300, "Math.floor(1e300)");
same(Math.floor(v(-0.5)), -1, "Math.floor(-0.5)");
same(Math.floor(v(-0)), -0, "Math.floor(-0)");
same(Math.floor(v(5e-324)), 0, "Math.floor(5e-324)");
same(Math.floor(v(Infinity)), Infinity, "Math.floor(Infinity)");
same(Math.floor(v(-Infinity)), -Infinity, "Math.floor(-Infinity)");
same(Math.floor(v(NaN)), NaN, "Math.floor(NaN)");
same(Math.ceil(v(3000000000.7)), 3000000001, "Math.ceil(3000000000.7)");
same(Math.ceil(v(-3e9)), -3000000000, "Math.ceil(-3e9)");
same(Math.ceil(v(2147483647.5)), 2147483648, "Math.ceil(2147483647.5)");
same(Math.ceil(v(4294967296.5)), 4294967297, "Math.ceil(4294967296.5)");
same(Math.ceil(v(-0.5)), -0, "Math.ceil(-0.5)");
same(Math.ceil(v(-5e-324)), -0, "Math.ceil(-5e-324)");
same(Math.ceil(v(0.25)), 1, "Math.ceil(0.25)");
same(Math.ceil(v(Infinity)), Infinity, "Math.ceil(Infinity)");
same(Math.ceil(v(NaN)), NaN, "Math.ceil(NaN)");
same(Math.trunc(v(-3000000000.7)), -3000000000, "Math.trunc(-3000000000.7)");
same(Math.trunc(v(1794353317748.5)), 1794353317748, "Math.trunc(1794353317748.5)");
same(Math.trunc(v(-0.5)), -0, "Math.trunc(-0.5)");
same(Math.trunc(v(1e20)), 100000000000000000000, "Math.trunc(1e20)");
same(Math.trunc(v(-Infinity)), -Infinity, "Math.trunc(-Infinity)");
same(Math.trunc(v(NaN)), NaN, "Math.trunc(NaN)");
same(Math.round(v(2.5)), 3, "Math.round(2.5)");
same(Math.round(v(-2.5)), -2, "Math.round(-2.5)");
same(Math.round(v(0.49999999999999994)), 0, "Math.round(0.49999999999999994)");
same(Math.round(v(-0.5)), -0, "Math.round(-0.5)");
same(Math.round(v(3000000000.5)), 3000000001, "Math.round(3000000000.5)");
same(Math.round(v(4503599627370497)), 4503599627370497, "Math.round(2^52+1)");
same(Math.round(v(-3e9)), -3000000000, "Math.round(-3e9)");

print("-- conversions to 32-bit integers");
same(v(3e9) | 0, -1294967296, "3e9|0");
same(v(-3e9) | 0, 1294967296, "-3e9|0");
same(v(4294967296.5) | 0, 0, "4294967296.5|0");
same(v(1e20) | 0, 1661992960, "1e20|0");
same(v(3e9) >>> 0, 3000000000, "3e9>>>0");
same(v(-1.5) >>> 0, 4294967295, "-1.5>>>0");
same(~~v(2147483648.5), -2147483648, "~~2147483648.5");
same(v(NaN) | 0, 0, "NaN|0");
same(v(Infinity) | 0, 0, "Infinity|0");

print("-- pow: whole-number exponents are exact");
same(v(2) ** v(32), 4294967296, "2**32");
same(Math.pow(v(2), v(31)), 2147483648, "Math.pow(2,31)");
same(Math.pow(v(2), v(53)), 9007199254740992, "Math.pow(2,53)");
same(Math.pow(v(2), v(64)), 18446744073709552000, "Math.pow(2,64)");
same(Math.pow(v(2), v(1023)), 8.98846567431158e+307, "Math.pow(2,1023)");
same(Math.pow(v(2), v(1024)), Infinity, "Math.pow(2,1024)");
same(Math.pow(v(2), v(-1074)), 5e-324, "Math.pow(2,-1074)");
same(Math.pow(v(2), v(-1075)), 0, "Math.pow(2,-1075)");
same(v(10) ** v(15), 1000000000000000, "10**15");
same(Math.pow(v(10), v(22)), 1e22, "Math.pow(10,22)");
same(Math.pow(v(10), v(23)), 1e23, "Math.pow(10,23)");
same(Math.pow(v(10), v(308)), 1e308, "Math.pow(10,308)");
same(Math.pow(v(10), v(-5)), 0.00001, "Math.pow(10,-5)");
same(Math.pow(v(10), v(-1)), 0.1, "Math.pow(10,-1)");
same(Math.pow(v(10), v(2)), 100, "Math.pow(10,2)");
same(Math.pow(v(3), v(20)), 3486784401, "Math.pow(3,20)");
same(Math.pow(v(7), v(7)), 823543, "Math.pow(7,7)");
same(Math.pow(v(-2), v(3)), -8, "Math.pow(-2,3)");
same(Math.pow(v(-2), v(4)), 16, "Math.pow(-2,4)");
same(Math.pow(v(-2), v(63)), -9223372036854775808, "Math.pow(-2,63)");
same(Math.pow(v(1.5), v(2)), 2.25, "Math.pow(1.5,2)");
same(Math.pow(v(1.1), v(10)), 2.5937424601000023, "Math.pow(1.1,10)");
same(Math.pow(v(0.1), v(3)), 0.0010000000000000002, "Math.pow(0.1,3)");
same(Math.pow(v(5), v(3)), 125, "Math.pow(5,3)");
same(Math.pow(v(2), v(-2)), 0.25, "Math.pow(2,-2)");

print("-- pow: fractional exponents");
same(Math.pow(v(4), v(0.5)), 2, "Math.pow(4,0.5)");
same(Math.pow(v(2), v(0.5)), 1.4142135623730951, "Math.pow(2,0.5)");
same(Math.pow(v(100), v(0.5)), 10, "Math.pow(100,0.5)");
near(Math.pow(v(8), v(1 / 3)), 2, "Math.pow(8,1/3)");
near(Math.pow(v(9), v(1.5)), 27, "Math.pow(9,1.5)");
near(Math.pow(v(2), v(1.5)), 2.8284271247461903, "Math.pow(2,1.5)");
near(Math.pow(v(16), v(0.25)), 2, "Math.pow(16,0.25)");
near(Math.pow(v(2), v(0.1)), 1.0717734625362931, "Math.pow(2,0.1)");
near(Math.pow(v(1.0000001), v(1e7)), 2.7182816941320818, "Math.pow(1.0000001,1e7)");
near(Math.pow(v(12345.678), v(2.5)), 16935084336.7375, "Math.pow(12345.678,2.5)");
near(Math.pow(v(1e-300), v(0.5)), 1e-150, "Math.pow(1e-300,0.5)");

print("-- pow: the special cases of ECMAScript");
same(Math.pow(v(NaN), v(0)), 1, "Math.pow(NaN,0)");
same(Math.pow(v(NaN), v(1)), NaN, "Math.pow(NaN,1)");
same(Math.pow(v(1), v(NaN)), NaN, "Math.pow(1,NaN)");
same(Math.pow(v(1), v(Infinity)), NaN, "Math.pow(1,Infinity)");
same(Math.pow(v(-1), v(-Infinity)), NaN, "Math.pow(-1,-Infinity)");
same(Math.pow(v(2), v(Infinity)), Infinity, "Math.pow(2,Infinity)");
same(Math.pow(v(2), v(-Infinity)), 0, "Math.pow(2,-Infinity)");
same(Math.pow(v(0.5), v(Infinity)), 0, "Math.pow(0.5,Infinity)");
same(Math.pow(v(-0.5), v(-Infinity)), Infinity, "Math.pow(-0.5,-Infinity)");
same(Math.pow(v(0), v(0)), 1, "Math.pow(0,0)");
same(Math.pow(v(0), v(-1)), Infinity, "Math.pow(0,-1)");
same(Math.pow(v(-0), v(-3)), -Infinity, "Math.pow(-0,-3)");
same(Math.pow(v(-0), v(-2)), Infinity, "Math.pow(-0,-2)");
same(Math.pow(v(-0), v(3)), -0, "Math.pow(-0,3)");
same(Math.pow(v(-0), v(2)), 0, "Math.pow(-0,2)");
same(Math.pow(v(0), v(0.5)), 0, "Math.pow(0,0.5)");
same(Math.pow(v(0), v(-0.5)), Infinity, "Math.pow(0,-0.5)");
same(Math.pow(v(Infinity), v(2)), Infinity, "Math.pow(Infinity,2)");
same(Math.pow(v(Infinity), v(-2)), 0, "Math.pow(Infinity,-2)");
same(Math.pow(v(-Infinity), v(3)), -Infinity, "Math.pow(-Infinity,3)");
same(Math.pow(v(-Infinity), v(2)), Infinity, "Math.pow(-Infinity,2)");
same(Math.pow(v(-Infinity), v(-3)), -0, "Math.pow(-Infinity,-3)");
same(Math.pow(v(-Infinity), v(0.5)), Infinity, "Math.pow(-Infinity,0.5)");
same(Math.pow(v(-2), v(0.5)), NaN, "Math.pow(-2,0.5)");
same(Math.pow(v(-8), v(1 / 3)), NaN, "Math.pow(-8,1/3)");
same(Math.pow(v(-1), v(9007199254740991)), -1, "Math.pow(-1,2^53-1)");
same(Math.pow(v(-1), v(1e300)), 1, "Math.pow(-1,1e300)");
same(Math.pow(v(2), v(2147483648)), Infinity, "Math.pow(2,2^31)");
same(Math.pow(v(0.5), v(2147483648)), 0, "Math.pow(0.5,2^31)");
same(Math.pow(v(-2), v(2147483649)), -Infinity, "Math.pow(-2,2^31+1)");

print("-- rounding of + - * / (round to nearest, as IEEE 754 doubles)");
same(v(1) / v(1e10), 1e-10, "1/1e10");
same(v(2) / v(1e10), 2e-10, "2/1e10");
same(v(0.1) + v(0.2), 0.30000000000000004, "0.1+0.2");
same(v(0.1) * v(3), 0.30000000000000004, "0.1*3");
same(v(1.1) * v(1.1), 1.2100000000000002, "1.1*1.1");
same(v(0.7) + v(0.1), 0.7999999999999999, "0.7+0.1");
same(v(4.35) * v(100), 434.99999999999994, "4.35*100");
same(v(1) / v(3), 0.3333333333333333, "1/3");
same(v(2) / v(3), 0.6666666666666666, "2/3");
same(v(9007199254740992) + v(3), 9007199254740996, "2^53+3 (tie to even)");
same(v(1e16) + v(1), 10000000000000000, "1e16+1");
same(v(0.3) - v(0.1), 0.19999999999999998, "0.3-0.1");
same(v(5e-324) * v(0.5), 0, "5e-324*0.5 (tie to even)");
same(v(1e308) * v(10), Infinity, "1e308*10");
{
    let s = 0;
    for (let i = 0; i < 10; i++) s += v(0.1);
    same(s, 0.9999999999999999, "0.1 added ten times");
    let f = 1;
    for (let i = 1; i <= 25; i++) f *= i;
    same(f, 1.5511210043330986e+25, "25!");
}

print("-- remainder");
same(v(5.5) % v(2), 1.5, "5.5%2");
same(v(-5.5) % v(2), -1.5, "-5.5%2");
same(v(-7) % v(2.5), -2, "-7%2.5");
same(v(1e17) % v(7), 5, "1e17%7");
same(v(3e9) % v(7), 4, "3e9%7");
same(v(4294967296) % v(3), 1, "4294967296%3");
same(v(1e300) % v(3), 0, "1e300%3");
same(v(1e300) % v(7), 1, "1e300%7");
same(v(0.3) % v(0.1), 0.09999999999999998, "0.3%0.1");
same(v(-0) % v(5), -0, "-0%5");
same(v(-5) % v(5), -0, "-5%5");
same(v(2) % v(Infinity), 2, "2%Infinity");
same(v(Infinity) % v(2), NaN, "Infinity%2");
same(v(1) % v(0), NaN, "1%0");
same(v(123456789012) % v(1000), 12, "123456789012%1000");

print("-- text <-> number (64-bit divide, ldexp)");
same(String(v(1) / v(1e10)), "1e-10", "String(1/1e10)");
same(String(v(4294967296)), "4294967296", "String(2^32)");
same(String(v(1e21)), "1e+21", "String(1e21)");
same(String(v(123456789012345680000)), "123456789012345680000", "String(123456789012345680000)");
same(String(v(1.7976931348623157e308)), "1.7976931348623157e+308", "String(MAX_VALUE)");
same(String(v(5e-324)), "5e-324", "String(5e-324)");
same(Number("5e-324"), 5e-324, "Number('5e-324')");
same(Number("2.2250738585072014e-308"), 2.2250738585072014e-308, "Number('2.2250738585072014e-308')");
same(Number("9007199254740993"), 9007199254740992, "Number('9007199254740993')");
same(Number("0x100000000"), 4294967296, "Number('0x100000000')");
same(Number("1e400"), Infinity, "Number('1e400')");
same(parseInt("123456789012345678"), 123456789012345680, "parseInt('123456789012345678')");
same(v(255.5).toString(16), "ff.8", "(255.5).toString(16)");
same(v(4294967296).toString(2), "100000000000000000000000000000000", "(2^32).toString(2)");
same(v(123456789.123).toFixed(2), "123456789.12", "(123456789.123).toFixed(2)");
same(v(1e21).toFixed(2), "1e+21", "(1e21).toFixed(2)");
same(v(0.000001234).toExponential(3), "1.234e-6", "(0.000001234).toExponential(3)");
same(v(3e9).toPrecision(5), "3.0000e+9", "(3e9).toPrecision(5)");
same(JSON.stringify([v(3e9), v(2) ** v(32), v(1) / v(1e10)]), "[3000000000,4294967296,1e-10]", "JSON.stringify of large numbers");

print("-- Date, typed arrays, BigInt (double <-> int64)");
same(new Date(v(1794353317748.5)).getTime(), 1794353317748, "new Date(1794353317748.5).getTime()");
same(new Date(v(1794353317748)).toISOString(), "2026-11-10T23:28:37.748Z", "toISOString of 1794353317748");
same(new Date(v(8.64e15)).toISOString(), "+275760-09-13T00:00:00.000Z", "toISOString of the last date");
same(new Date(v(4102444800000)).getUTCDay(), 5, "getUTCDay of 2100-01-01");
{
    const i32 = new Int32Array([v(3e9), v(-3e9), v(4294967296.5), v(1e20), v(NaN), v(-0.9)]);
    same(Array.prototype.join.call(i32), "-1294967296,1294967296,0,1661992960,0,0", "Int32Array stores");
    const u8c = new Uint8ClampedArray([v(0.5), v(1.5), v(2.5), v(254.5), v(255.5), v(-1), v(300), v(NaN), v(127.5)]);
    same(Array.prototype.join.call(u8c), "0,2,2,254,255,0,255,0,128", "Uint8ClampedArray rounds halves to even");
    const f32 = new Float32Array([v(1.1), v(3e9), v(1e39), v(16777217)]);
    same(Array.prototype.join.call(f32), "1.100000023841858,3000000000,Infinity,16777216", "Float32Array stores");
}
if (typeof BigInt === "function") {
    same(String(BigInt(v(4294967296))), "4294967296", "BigInt(2^32)");
    same(String(BigInt(v(9007199254740992))), "9007199254740992", "BigInt(2^53)");
    same(String(BigInt(v(3e9)) * BigInt(v(3e9))), "9000000000000000000", "BigInt(3e9)*BigInt(3e9)");
    same(Number(BigInt("9007199254740993")), 9007199254740992, "Number(9007199254740993n)");
    same(Number(BigInt("-18446744073709551617")), -18446744073709552000, "Number(-(2n**64n)-1n)");
    same(String(BigInt("123456789012345678901234567890") / BigInt(1000000007)), "123456788148148161864", "BigInt division");
    same(String(BigInt("-123456789012345678") % BigInt(1000)), "-678", "BigInt remainder");
    const b64 = new BigInt64Array(1);
    b64[0] = BigInt("-9223372036854775808");
    same(Number(b64[0]), -9223372036854775808, "Number(BigInt64Array min)");
}

/* From here on the 68020 FPU variant uses 6888x transcendental
 * instructions, which the vamos emulator does not have; everything
 * above runs there. */
print("-- Math.fround, Math.cbrt, Math.hypot, Math.atan2");
same(Math.fround(v(7.9)), 7.900000095367432, "Math.fround(7.9)");
same(Math.fround(v(1e300)), Infinity, "Math.fround(1e300)");
same(Math.fround(v(16777217)), 16777216, "Math.fround(16777217)");
same(Math.fround(v(1e-46)), 0, "Math.fround(1e-46)");
same(Math.fround(v(-0)), -0, "Math.fround(-0)");
same(Math.cbrt(v(0)), 0, "Math.cbrt(0)");
same(Math.cbrt(v(-0)), -0, "Math.cbrt(-0)");
same(Math.cbrt(v(Infinity)), Infinity, "Math.cbrt(Infinity)");
same(Math.cbrt(v(NaN)), NaN, "Math.cbrt(NaN)");
near(Math.cbrt(v(8)), 2, "Math.cbrt(8)");
near(Math.cbrt(v(27)), 3, "Math.cbrt(27)");
near(Math.cbrt(v(-8)), -2, "Math.cbrt(-8)");
near(Math.cbrt(v(1000)), 10, "Math.cbrt(1000)");
near(Math.cbrt(v(2)), 1.2599210498948732, "Math.cbrt(2)");
same(Math.hypot(v(3), v(4)), 5, "Math.hypot(3,4)");
same(Math.hypot(v(5), v(12)), 13, "Math.hypot(5,12)");
near(Math.hypot(v(1e200), v(1e200)), 1.4142135623730951e+200, "Math.hypot(1e200,1e200)");
near(Math.hypot(v(1e-200), v(1e-200)), 1.4142135623730951e-200, "Math.hypot(1e-200,1e-200)");
same(Math.hypot(v(Infinity), v(NaN)), Infinity, "Math.hypot(Infinity,NaN)");
same(Math.hypot(v(NaN), v(1)), NaN, "Math.hypot(NaN,1)");
same(Math.hypot(v(-5)), 5, "Math.hypot(-5)");
near(Math.atan2(v(1), v(1)), 0.7853981633974483, "Math.atan2(1,1)");
near(Math.atan2(v(1), v(-1)), 2.356194490192345, "Math.atan2(1,-1)");
near(Math.atan2(v(-1), v(-1)), -2.356194490192345, "Math.atan2(-1,-1)");
near(Math.atan2(v(0), v(-0)), Math.PI, "Math.atan2(0,-0)");
near(Math.atan2(v(-0), v(-1)), -Math.PI, "Math.atan2(-0,-1)");
same(Math.atan2(v(-0), v(1)), -0, "Math.atan2(-0,1)");
same(Math.atan2(v(0), v(0)), 0, "Math.atan2(0,0)");
near(Math.atan2(v(1), v(0)), 1.5707963267948966, "Math.atan2(1,0)");
near(Math.atan2(v(Infinity), v(-Infinity)), 2.356194490192345, "Math.atan2(Infinity,-Infinity)");
near(Math.atan2(v(1), v(-Infinity)), Math.PI, "Math.atan2(1,-Infinity)");
same(Math.atan2(v(1), v(Infinity)), 0, "Math.atan2(1,Infinity)");
same(Math.atan2(v(NaN), v(1)), NaN, "Math.atan2(NaN,1)");

print("-- functions at ordinary arguments");
same(Math.sqrt(v(2)), 1.4142135623730951, "Math.sqrt(2)");
same(Math.sqrt(v(1e10)), 100000, "Math.sqrt(1e10)");
same(Math.sqrt(v(-1)), NaN, "Math.sqrt(-1)");
near(Math.exp(v(1)), 2.718281828459045, "Math.exp(1)");
near(Math.exp(v(10)), 22026.465794806718, "Math.exp(10)");
near(Math.exp(v(-1)), 0.36787944117144233, "Math.exp(-1)");
same(Math.exp(v(0)), 1, "Math.exp(0)");
near(Math.log(v(10)), 2.302585092994046, "Math.log(10)");
near(Math.log(v(0.5)), -0.6931471805599453, "Math.log(0.5)");
same(Math.log(v(1)), 0, "Math.log(1)");
same(Math.log2(v(8)), 3, "Math.log2(8)");
same(Math.log2(v(1024)), 10, "Math.log2(1024)");
same(Math.log2(v(0.5)), -1, "Math.log2(0.5)");
near(Math.log2(v(3)), 1.584962500721156, "Math.log2(3)");
near(Math.log2(v(10)), 3.321928094887362, "Math.log2(10)");
near(Math.log10(v(1000)), 3, "Math.log10(1000)");
near(Math.log10(v(2)), 0.3010299956639812, "Math.log10(2)");
near(Math.log1p(v(1e-10)), 9.999999999500001e-11, "Math.log1p(1e-10)");
near(Math.log1p(v(0.001)), 0.0009995003330835331, "Math.log1p(0.001)");
near(Math.log1p(v(1)), 0.6931471805599453, "Math.log1p(1)");
near(Math.expm1(v(1e-10)), 1.00000000005e-10, "Math.expm1(1e-10)");
near(Math.expm1(v(1)), 1.718281828459045, "Math.expm1(1)");
near(Math.sin(v(1)), 0.8414709848078965, "Math.sin(1)");
near(Math.sin(v(0.5)), 0.479425538604203, "Math.sin(0.5)");
near(Math.cos(v(1)), 0.5403023058681398, "Math.cos(1)");
near(Math.cos(v(Math.PI)), -1, "Math.cos(PI)");
near(Math.tan(v(1)), 1.5574077246549023, "Math.tan(1)");
near(Math.tan(v(0.7853981633974483)), 1, "Math.tan(PI/4)");
near(Math.asin(v(0.5)), 0.5235987755982989, "Math.asin(0.5)");
near(Math.asin(v(1)), 1.5707963267948966, "Math.asin(1)");
near(Math.acos(v(0.5)), 1.0471975511965979, "Math.acos(0.5)");
near(Math.acos(v(-1)), Math.PI, "Math.acos(-1)");
near(Math.atan(v(1)), 0.7853981633974483, "Math.atan(1)");
near(Math.atan(v(1e10)), 1.5707963266948965, "Math.atan(1e10)");
near(Math.sinh(v(1)), 1.1752011936438014, "Math.sinh(1)");
near(Math.cosh(v(1)), 1.5430806348152437, "Math.cosh(1)");
near(Math.tanh(v(1)), 0.7615941559557649, "Math.tanh(1)");
near(Math.asinh(v(1)), 0.881373587019543, "Math.asinh(1)");
near(Math.asinh(v(1e-10)), 1e-10, "Math.asinh(1e-10)");
near(Math.asinh(v(-1e300)), -691.4686750787736, "Math.asinh(-1e300)");
near(Math.acosh(v(2)), 1.3169578969248166, "Math.acosh(2)");
near(Math.acosh(v(1e300)), 691.4686750787736, "Math.acosh(1e300)");
same(Math.acosh(v(1)), 0, "Math.acosh(1)");
near(Math.atanh(v(0.5)), 0.5493061443340548, "Math.atanh(0.5)");
near(Math.atanh(v(1e-10)), 1e-10, "Math.atanh(1e-10)");
same(Math.atanh(v(1)), Infinity, "Math.atanh(1)");

/* Last, because the vamos emulator on the build machine stops here on
 * the FPU variants: its FPU cannot store a double through an indexed
 * address, which the Date field code does. A real FPU can. */
print("-- Date.UTC, Date.parse");
same(Date.UTC(2026, 10, 13), 1794528000000, "Date.UTC(2026,10,13)");
same(Date.parse("2026-11-13T01:02:03.456Z"), 1794531723456, "Date.parse");

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
if (fail > 0 && typeof std !== "undefined") std.exit(1);
