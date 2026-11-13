#!/usr/bin/env node
/*
 * gen_numeric_edge.js - writes amiga/tests/test_numeric_edge.js.
 *
 *   node amiga/tests/host/gen_numeric_edge.js
 *
 * The test's expected values are whatever this machine's node computes
 * for the expressions and operand tables below, recorded as bit
 * patterns, so the Amiga side compares exactly and needs no arithmetic
 * of its own to judge. Edit the lists here and regenerate; do not edit
 * the generated file.
 *
 * Three kinds of check are generated:
 *   1. every pairing of VALUES under the arithmetic operators, exact;
 *   2. every pairing of VALUES under the comparisons, exact;
 *   3. the expressions in EXPRESSIONS. Exact, except that a result of
 *      a transcendental Math function (or **) that is an ordinary
 *      number may differ from node's by a few units in the last place
 *      (2e-15 relative): the specification does not fix those bits.
 *      NaN, infinities, zeros and their signs are always exact.
 *
 * SKIP lists expressions that are in the audit this list came from but
 * do not belong in the test, with the reason.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const VALUES = ['NaN', 'Infinity', '-Infinity', '0', '-0', '1', '-1', '0.5', '-2.5', '3', '-7',
    '5e-324', '-5e-324', '2.2250738585072014e-308', '1.7976931348623157e308',
    '2147483647', '-2147483648', '4294967295', '9007199254740991', '9007199254740992',
    '1e21', '0.1', '123456789.125', '1e300', '1e-300'];

const ARITH = [['+', 'a + b'], ['-', 'a - b'], ['*', 'a * b'], ['/', 'a / b'], ['%', 'a % b']];
const COMPARE = [['<', 'a < b'], ['<=', 'a <= b'], ['>', 'a > b'], ['>=', 'a >= b'],
    ['==', 'a == b'], ['!=', 'a != b'], ['===', 'a === b'], ['!==', 'a !== b'],
    ['Object.is', 'Object.is(a, b)'], ['[a].includes(b)', '[a].includes(b)'],
    ['[a].indexOf(b)==0', '[a].indexOf(b) === 0'], ['Set', 'new Set([a]).has(b)'],
    ['switch', '(function () { switch (a) { case b: return true; } return false; })()'],
    ['Float64Array.includes', 'new Float64Array([a]).includes(b)'],
    ['if(a<b)', '(function () { if (a < b) return true; return false; })()'],
    ['if(a>=b)', '(function () { if (a >= b) return true; return false; })()'],
    ['Math.min is a', 'Object.is(Math.min(a, b), a)'], ['Math.max is a', 'Object.is(Math.max(a, b), a)']];

const SKIP = [
    // the order a sort leaves under an inconsistent comparator is the engine's own
    /\.sort\(function\(a,b\)\{return (a-b|a<b\?-1:a>b\?1:0|NaN|Infinity|-Infinity)\}\)/,
    /\.sort\(function\(a,b\)\{return b-a\}\)\)\.map/,
    // non-integer digits in other radices are approximated differently by QuickJS on every platform
    /toString\((2|3|7|16|36)\)/,
    // differences of QuickJS itself from node, on every platform (reported separately)
    /BigInt\.asUintN\(64, -1n\)/,
    // reads native byte order: the Amiga is big-endian
    /getFloat64\(0, true\)/,
    // time zone of the machine
    /new Date\(2020, 0, 1|new Date\(NaN, 0\)|getTimezoneOffset|toString\(\)$|getFullYear\(\)$/,
];
const APPROX = /Math\.(sin|cos|tan|asin|acos|atan|atan2|exp|expm1|log|log2|log10|log1p|sinh|cosh|tanh|asinh|acosh|atanh|cbrt|hypot|pow)\(|\*\*|Math\.(E|LN2|LN10|LOG2E|LOG10E|SQRT2|SQRT1_2|PI)\b.*[*/]/;

const EXPRESSIONS = ['-0', '0 * -1', '-1 * 0', '0 / -1', '-0 + 0', '-0 - 0', '-0 + -0', '0 - 0', '-(0)', '+(-0)', '-0 % 1', '1e400', '-1e400', '1e-400', '5e-324', '2.5e-324',
  '0 < NaN', 'NaN < 0', '0 <= NaN', 'NaN <= 0', '0 > NaN', 'NaN > 0', '0 >= NaN', 'NaN >= 0', 'NaN == NaN', 'NaN != NaN', 'NaN === NaN', 'NaN !== NaN',
  '0 === -0', '0 == -0', 'Infinity > 1e308', '-Infinity < -1e308', 'Infinity == Infinity', 'Infinity - Infinity', 'Infinity * 0', '0 / 0', '1 / 0', '-1 / 0', '1 / -0',
  '0.1 + 0.2', '0.1 * 3', '1e21 + 1', '2 ** 53 + 1', '2 ** -1074', '2 ** 1024', '2 ** 1023 * 2', '(-8) ** (1/3)', '(-2) ** 3', '(-2) ** -3', '0 ** 0', 'NaN ** 0', '1 ** Infinity', '(-0) ** 3', '(-0) ** -3', '0 ** -1',
  '2147483647 + 1', '-2147483648 - 1', '2147483647 * 2', '65536 * 65536', '-2147483648 * -1', '-2147483648 / -1', '-2147483648 % -1', '5 % -5', '-5 % 5', '0 % 5', '-0 % 5', '5 % 0', '5.5 % 2', '-5.5 % 2', '5.5 % -2', '1e300 % 7', '5 % Infinity', '-5 % Infinity', 'Infinity % 5',
  '7 / 2', '-7 / 2', '6 / 3', '6 / -3', '0 / 5', '0 / -5', '1 / 3', '9007199254740992 + 1', '9007199254740992 + 2', '4294967295 >>> 0', '-1 >>> 0', '1 << 31', '1 << 32', '-1 >> 31', '2147483648 | 0', '4294967296 | 0', '1e21 | 0', '-1e21 | 0', 'NaN | 0', 'Infinity | 0', '~~-0.5', '~~2147483648.5', '3000000000 >> 1', '3000000000 >>> 1', '-3000000000 >> 1',
  'Number.MAX_VALUE', 'Number.MIN_VALUE', 'Number.EPSILON', 'Number.MAX_SAFE_INTEGER', 'Number.MIN_SAFE_INTEGER', 'Number.POSITIVE_INFINITY', 'Number.NEGATIVE_INFINITY', 'Number.NaN', 'Number.MAX_VALUE * 2', 'Number.MIN_VALUE / 2', '-Number.MIN_VALUE / 2', 'Number.MAX_VALUE + 1e291', 'Number.MAX_VALUE + 1e292', '1 + Number.EPSILON', '1 + Number.EPSILON / 2',
  'Math.PI', 'Math.E', 'Math.LN2', 'Math.LN10', 'Math.LOG2E', 'Math.LOG10E', 'Math.SQRT2', 'Math.SQRT1_2',
  'Math.max()', 'Math.min()', 'Math.max(NaN, 1)', 'Math.max(1, NaN)', 'Math.min(NaN, 1)', 'Math.min(1, NaN)', 'Math.max(-0, 0)', 'Math.max(0, -0)', 'Math.min(0, -0)', 'Math.min(-0, 0)', 'Math.max(1, 2, 3.5)', 'Math.min(1.5, 2, 3)', 'Math.max(-Infinity, NaN)', 'Math.min(Infinity, -Infinity)', 'Math.max(1, "x")', 'Math.max(1, 2.5, 2)', 'Math.min(-1, -2.5, 0)',
  'Math.round(0.5)', 'Math.round(-0.5)', 'Math.round(1.5)', 'Math.round(2.5)', 'Math.round(-1.5)', 'Math.round(-2.5)', 'Math.round(0.49999999999999994)', 'Math.round(-0.2)', 'Math.round(4503599627370495.5)', 'Math.round(4503599627370497)', 'Math.round(-0)', 'Math.round(1e300)', 'Math.round(2147483647.5)', 'Math.round(-2147483648.5)',
  'Math.floor(-0.5)', 'Math.ceil(-0.5)', 'Math.trunc(-0.5)', 'Math.trunc(0.5)', 'Math.floor(1e300)', 'Math.ceil(-1e300)', 'Math.floor(-0)', 'Math.ceil(-0)', 'Math.trunc(-0)', 'Math.floor(2147483648.5)', 'Math.ceil(-2147483648.5)', 'Math.trunc(4294967296.7)', 'Math.floor(5e-324)', 'Math.ceil(5e-324)', 'Math.ceil(-5e-324)', 'Math.floor(-5e-324)',
  'Math.sign(-0)', 'Math.sign(0)', 'Math.sign(-3)', 'Math.sign(NaN)', 'Math.abs(-0)', 'Math.abs(-Infinity)', 'Math.abs(-2147483648)', 'Math.sqrt(-0)', 'Math.sqrt(-1)', 'Math.sqrt(4)', 'Math.sqrt(2)', 'Math.sqrt(Infinity)', 'Math.sqrt(1e-320)', 'Math.cbrt(-8)', 'Math.cbrt(27)', 'Math.cbrt(-0)',
  'Math.pow(2, 10)', 'Math.pow(2, 0.5)', 'Math.pow(-8, 1/3)', 'Math.pow(0, -1)', 'Math.pow(-0, -1)', 'Math.pow(-0, -2)', 'Math.pow(-0, 1)', 'Math.pow(-0, 2)', 'Math.pow(NaN, 0)', 'Math.pow(1, NaN)', 'Math.pow(1, Infinity)', 'Math.pow(-1, Infinity)', 'Math.pow(2, Infinity)', 'Math.pow(0.5, Infinity)', 'Math.pow(2, -Infinity)', 'Math.pow(0.5, -Infinity)', 'Math.pow(Infinity, -1)', 'Math.pow(-Infinity, 3)', 'Math.pow(-Infinity, 2)', 'Math.pow(-Infinity, -3)', 'Math.pow(2, 1024)', 'Math.pow(2, -1075)', 'Math.pow(2, -1074)', 'Math.pow(10, 308)', 'Math.pow(10, -323)', 'Math.pow(-2, 0.5)', 'Math.pow(-2, 2)', 'Math.pow(-2, 3)', 'Math.pow(3, 2)', 'Math.pow(10, 2)', 'Math.pow(10, 15)', 'Math.pow(2, 31)', 'Math.pow(2, 53)', 'Math.pow(7, 0)', 'Math.pow(7, 1)', 'Math.pow(7, -1)', 'Math.pow(4, 0.5)', 'Math.pow(1.5, 2)',
  'Math.atan2(0, 0)', 'Math.atan2(0, -0)', 'Math.atan2(-0, 0)', 'Math.atan2(-0, -0)', 'Math.atan2(1, 0)', 'Math.atan2(-1, 0)', 'Math.atan2(0, -1)', 'Math.atan2(-0, -1)', 'Math.atan2(0, 1)', 'Math.atan2(-0, 1)', 'Math.atan2(Infinity, Infinity)', 'Math.atan2(Infinity, -Infinity)', 'Math.atan2(1, Infinity)', 'Math.atan2(1, -Infinity)', 'Math.atan2(-1, -Infinity)', 'Math.atan2(NaN, 1)', 'Math.atan2(1, 1)',
  'Math.exp(0)', 'Math.exp(-0)', 'Math.exp(1)', 'Math.exp(710)', 'Math.exp(-746)', 'Math.exp(-Infinity)', 'Math.exp(Infinity)', 'Math.exp(NaN)', 'Math.expm1(-0)', 'Math.expm1(1e-10)', 'Math.expm1(-Infinity)', 'Math.expm1(0.4)', 'Math.log(0)', 'Math.log(-0)', 'Math.log(-1)', 'Math.log(1)', 'Math.log(Infinity)', 'Math.log(NaN)', 'Math.log(Math.E)', 'Math.log2(8)', 'Math.log2(1024)', 'Math.log2(0)', 'Math.log2(-1)', 'Math.log2(0.5)', 'Math.log10(1000)', 'Math.log10(0)', 'Math.log10(1e-5)', 'Math.log1p(-1)', 'Math.log1p(-2)', 'Math.log1p(-0)', 'Math.log1p(1e-10)',
  'Math.sin(0)', 'Math.sin(-0)', 'Math.sin(Infinity)', 'Math.sin(NaN)', 'Math.sin(Math.PI)', 'Math.sin(Math.PI / 2)', 'Math.sin(1e22)', 'Math.cos(0)', 'Math.cos(Infinity)', 'Math.cos(Math.PI)', 'Math.cos(1e22)', 'Math.tan(-0)', 'Math.tan(Infinity)', 'Math.tan(Math.PI / 4)', 'Math.asin(2)', 'Math.asin(-0)', 'Math.asin(1)', 'Math.acos(2)', 'Math.acos(1)', 'Math.acos(-1)', 'Math.atan(-0)', 'Math.atan(Infinity)', 'Math.atan(-Infinity)', 'Math.atan(1)',
  'Math.sinh(-0)', 'Math.sinh(Infinity)', 'Math.sinh(-Infinity)', 'Math.sinh(1)', 'Math.sinh(1e-10)', 'Math.cosh(0)', 'Math.cosh(-Infinity)', 'Math.cosh(1)', 'Math.tanh(-0)', 'Math.tanh(Infinity)', 'Math.tanh(-Infinity)', 'Math.tanh(1)', 'Math.tanh(1e-10)', 'Math.asinh(-0)', 'Math.asinh(Infinity)', 'Math.asinh(-Infinity)', 'Math.asinh(1)', 'Math.asinh(1e-10)', 'Math.asinh(1e300)', 'Math.acosh(1)', 'Math.acosh(0.5)', 'Math.acosh(Infinity)', 'Math.acosh(2)', 'Math.acosh(1e300)', 'Math.atanh(-0)', 'Math.atanh(1)', 'Math.atanh(-1)', 'Math.atanh(2)', 'Math.atanh(0.5)', 'Math.atanh(1e-10)',
  'Math.hypot()', 'Math.hypot(3, 4)', 'Math.hypot(NaN, Infinity)', 'Math.hypot(Infinity, NaN)', 'Math.hypot(-0)', 'Math.hypot(1e200, 1e200)', 'Math.hypot(1e-200, 1e-200)', 'Math.hypot(-3)', 'Math.hypot(NaN, 1)', 'Math.hypot(3, 4, 12)',
  'Math.fround(5.5)', 'Math.fround(5.05)', 'Math.fround(1e40)', 'Math.fround(-1e40)', 'Math.fround(1e-46)', 'Math.fround(-1e-46)', 'Math.fround(1e-45)', 'Math.fround(16777217)', 'Math.fround(3.4028235677973366e38)', 'Math.fround(3.4028234663852886e38)', 'Math.fround(1.401298464324817e-45)', 'Math.fround(1.1754943508222875e-38)', 'Math.fround(1e-40)',
  'Math.clz32(0)', 'Math.clz32(1)', 'Math.clz32(-1)', 'Math.clz32(0.5)', 'Math.clz32(4294967296)', 'Math.imul(0xffffffff, 5)', 'Math.imul(2147483647, 2147483647)', 'Math.imul(-5, 12)', 'Math.imul(65536, 65536)', 'Math.imul(1.9, 2.9)',
  'isNaN("x")', 'isNaN(undefined)', 'isNaN(null)', 'isFinite("1")', 'isFinite(null)', 'Number.isNaN("x")', 'Number.isInteger(5.0)', 'Number.isInteger(5.5)', 'Number.isInteger(1e300)', 'Number.isInteger(-0)', 'Number.isSafeInteger(2**53)', 'Number.isSafeInteger(2**53-1)', 'Number.isSafeInteger(-(2**53-1))', 'Number.isSafeInteger(1.5)',
  'Number.parseFloat("1.5e2x")', 'Number.parseInt("077")', 'parseInt("0x1f")', 'parseInt("1e3")', 'parseInt("-0")', 'parseInt("9007199254740993")', 'parseInt("zz", 36)', 'parseInt("11", 2)', 'parseInt("1".repeat(400))', 'parseInt(1e21)', 'parseInt(0.0000005)', 'parseInt(-0.0000005)', 'parseInt("123", 1)', 'parseInt("123", 37)', 'parseInt(null)', 'parseInt("Infinity")',
  '(25).toString(2)', '(-255).toString(16)', '(0.5).toString(2)', '(0.1).toString(3)', '(1e21).toString(7)', '(-0).toString()', '(123.456).toString(36)', '(2**53).toString(2)', '(1/3).toString(2)', '(255.5).toString(16)', '(1e-7).toString(16)', '(5e-324).toString(2).length', '(1.7976931348623157e308).toString(36).length',
  '(1.005).toFixed(2)', '(1.45).toFixed(1)', '(8.345).toFixed(2)', '(0).toFixed(2)', '(-0).toFixed(2)', '(-0.0001).toFixed(2)', '(0.5).toFixed(0)', '(1.5).toFixed(0)', '(2.5).toFixed(0)', '(-1.5).toFixed(0)', '(1e21).toFixed(2)', '(123.456).toFixed(10)', '(0.000001).toFixed(7)', '(1234.5678).toFixed(100).length', '(999.995).toFixed(2)', '(1e20).toFixed(2)',
  '(123.456).toExponential(2)', '(0).toExponential()', '(-0).toExponential(2)', '(1e-7).toExponential()', '(123456).toExponential(0)', '(5e-324).toExponential()', '(1.7976931348623157e308).toExponential()', '(0.00015).toExponential(0)', '(1.25).toExponential(1)', '(1.35).toExponential(1)', '(NaN).toExponential(2)', '(Infinity).toExponential()',
  '(123.456).toPrecision(4)', '(0.000123).toPrecision(2)', '(123456).toPrecision(2)', '(1e21).toPrecision(3)', '(0).toPrecision(3)', '(-0).toPrecision(3)', '(1.25).toPrecision(2)', '(1.35).toPrecision(2)', '(99.99).toPrecision(3)', '(5e-324).toPrecision(3)', '(1e-7).toPrecision(1)', '(15).toPrecision(1)', '(25).toPrecision(1)',
  'String(1e21)', 'String(1e-7)', 'String(123456789012345680000)', 'String(0.000001)', 'String(1.7976931348623157e308)', 'String(5e-324)', 'String(-1e-7)', 'String(100)', 'String(1e5)', 'String(0.1+0.2)', 'String(1/3)', 'String(2/3)', 'String(4.35)', 'String(1.1*1.1)', 'String(9.95)', 'String(2**31)', 'String(-(2**31))', 'String(2**32)', 'String(2**53)', 'String(2**64)', 'String(2**70)', 'String(1e20)', 'String(123e-20)', 'String(-1.5e-9)', 'String(4294967295.5)', 'String(0.1*0.1)', 'String(1e23)', 'String(8.41e21)', 'String(2**-1074)', 'String(2**1023)', 'String(Math.PI*1e10)', 'String(100/3)', 'String(1e15+0.3)', 'String(1e16+2)', 'String(5e-7)', 'String(0.000001234)', 'String(1234567.875)',
  'JSON.stringify([NaN, Infinity, -Infinity, -0, 0, 1.5, 1e21, 1e-7])', 'JSON.stringify({a: -0, b: NaN})', 'JSON.parse("[-0, 1e400, -1e400, 1e-400, 0.1, 1E2, -1.5e-3]").map(B).join()', 'JSON.parse("-0") === 0 && 1 / JSON.parse("-0")', 'JSON.stringify(-0)', 'JSON.stringify(5e-324)', 'JSON.stringify(2**53)', 'JSON.stringify(new Date(NaN))', 'JSON.stringify(new Date(0))',
  '[3, 1, 2].sort().join()', '[3, 1, NaN, 2, -0, 0, Infinity, -Infinity].sort(function(a,b){return a-b}).map(B).join()', '[10, 9, 1, 100, -1, 2.5, NaN, 1e21, 1e-7].sort().join()', '[NaN, 1, NaN, 0].sort(function(a,b){return a<b?-1:a>b?1:0}).join()', '[0, -0, 0, -0].sort(function(a,b){return a-b}).map(B).join()', '[2, 1, 3].sort(function(a,b){return NaN}).join()', '[5, 1, 4].sort(function(a,b){return b-a}).join()', '[1, 2, 3].sort(function(a,b){return Infinity}).join()', '[1, 2, 3].sort(function(a,b){return -Infinity}).join()', '[3, 2, 1].sort(function(a,b){return 0.1 * (a-b)}).join()', '[3, 2, 1].sort(function(a,b){return -0}).join()', '[1.5, 1.25, 1.75, -1.5, 1e-320, -1e-320, 0].sort(function(a,b){return a-b}).join()',
  'Array.from(new Float64Array([3, NaN, 1, -0, 0, -Infinity, Infinity, 5e-324, -5e-324, NaN, 2.5]).sort()).map(B).join()', 'Array.from(new Float32Array([3, NaN, 1, -0, 0, -Infinity, Infinity, 1e-45, NaN, 2.5]).sort()).map(B).join()', 'Array.from(new Float64Array([3, NaN, 1, -0, 0]).sort(function(a,b){return b-a})).map(B).join()', 'Array.from(new Int32Array([3, -1, 2147483647, -2147483648, 0]).sort()).join()', 'Array.from(new Uint32Array([3, 4294967295, 2147483648, 0]).sort()).join()', 'Array.from(new Float64Array([1, 2, 3]).sort(function(a,b){return NaN})).join()', 'Array.from(new Float64Array([0, -0, 0, -0]).sort()).map(B).join()', 'Array.from(new Float64Array([1,NaN,3]).toSorted()).map(B).join()',
  'new Float64Array([1, NaN, -0]).includes(NaN)', 'new Float64Array([1, NaN, -0]).indexOf(NaN)', 'new Float64Array([1, NaN, -0]).includes(0)', 'new Float64Array([1, NaN, -0]).indexOf(0)', 'new Float64Array([1, NaN, -0]).lastIndexOf(0)', 'new Float32Array([1.5, NaN]).includes(1.5)', 'new Float32Array([0.1]).includes(0.1)', 'new Float32Array([0.1]).indexOf(Math.fround(0.1))', 'new Float32Array([NaN]).includes(NaN)', 'new Int8Array([1, 2]).includes(NaN)', 'new Int8Array([1, 2]).indexOf(2.5)', 'new Int8Array([0, 2]).indexOf(-0)', 'new Int8Array([1, 2]).includes(2.0)', 'new Uint8Array([255]).includes(255.5)', 'new Uint32Array([4294967295]).includes(4294967295)', 'new Int32Array([-1]).includes(4294967295)', 'new Float64Array([Infinity]).indexOf(Infinity)', 'new Float64Array([-Infinity]).includes(-Infinity)', 'new Int16Array([5]).includes(Infinity)', 'new Uint8Array([0]).includes(NaN)', 'new Float64Array(3).fill(-0).map(function(v){return 1/v}).join()', 'new Float64Array([1,2,3]).join()', 'new Float32Array([0.1, 1e40, -1e40, 1e-50]).join()', 'new Float64Array([1.5, -0, NaN]).toString()', 'new Float64Array([1,5,3]).with(1, NaN).map(function(v){return v!==v?9:v}).join()', 'new Float64Array([1, 2, 3, 4]).find(function(v){return v > 2.5})', 'new Float64Array([1, 2, 3, 4]).findLast(function(v){return v < 2.5})', 'new Float64Array([1, 2, 3, 4]).reduce(function(a,v){return a+v/2}, 0)', 'new Float64Array([1, 2, 3, 4]).subarray(1.9, -0.1).join()', 'new Float64Array([1, 2, 3, 4]).slice(NaN, Infinity).join()', 'new Float64Array([1, 2, 3, 4]).at(-0.5)', 'new Float64Array([1, 2, 3, 4]).at(NaN)', 'new Float64Array([1, 2, 3, 4]).at(-Infinity)',
  '[1, NaN, -0].includes(NaN)', '[1, NaN, -0].indexOf(NaN)', '[1, NaN, -0].includes(0)', '[1, NaN, -0].indexOf(0)', '[1, NaN, -0].lastIndexOf(0)', '[1, NaN].lastIndexOf(NaN)', '[1, 2, 3].includes(2, NaN)', '[1, 2, 3].indexOf(2, -Infinity)', '[1, 2, 3].indexOf(1, Infinity)', '[1, 2, 3].includes(3, -0.5)', '[1.5, "1.5"].indexOf("1.5")', '[1, 2, 3].lastIndexOf(3, -Infinity)', '[1, 2, 3].lastIndexOf(1, NaN)', '[1,2,3,4,5].slice(-Infinity, 2.9).join()', '[1,2,3,4,5].splice(NaN, 1.5).join()', '[1,2,3].fill(9, -0.5, NaN).join()', '[1,2,3,4].copyWithin(Infinity, 0).join()', '[1,2,3].at(-0)', '[1,2,3].with(-1, 9).join()', '[[1,[2]]].flat(Infinity).join()', '[[1,[2]]].flat(NaN).length', 'Array(3).fill(0).map(function(_, i){return i / 2}).join()',
  'new Set([NaN, NaN, 0, -0, 1, 1.0]).size', 'Array.from(new Set([-0])).map(B).join()', 'new Map([[NaN, 1], [NaN, 2]]).size', 'new Map([[0, 1], [-0, 2]]).get(0)', 'new Map([[1.5, "a"]]).get(1.5)', 'new Map([[1, "a"]]).get(1.0)', 'new Map([[2**31, "a"]]).get(2147483648)', 'new Set([1, 2]).has(1.0000000000000002)', 'new WeakSet().has(NaN)', 'Object.is(NaN, 0/0)', 'Object.is(0, -0)', 'Object.is(-0, -0)', 'Object.is(NaN, NaN)', 'Object.is(1, 1.0)', 'Object.is(5e-324, 5e-324)',
  '(function(x){switch(x){case NaN: return 1; case 0: return 2; default: return 3}})(NaN)', '(function(x){switch(x){case 1: return 1; case 0: return 2; default: return 3}})(-0)', '(function(x){switch(x){case 1.5: return 1; case 0: return 2; default: return 3}})(1.5)', '(function(x){switch(x){case 1: return 1; case 2: return 2; default: return 3}})(2.0)', '(function(x){switch(x){case Infinity: return 1; case -Infinity: return 2; default: return 3}})(-Infinity)',
  'new Date(NaN).getTime()', 'new Date(8.64e15).getTime()', 'new Date(8.64e15 + 1).getTime()', 'new Date(-8.64e15).getTime()', 'new Date(-8.64e15 - 1).getTime()', 'new Date(1.9).getTime()', 'new Date(-1.9).getTime()', 'new Date(-0).getTime()', 'new Date(2020, 0, 1, 0, 0, 0, NaN).getTime()', 'new Date(NaN, 0).getTime()', 'new Date(Infinity).getTime()', 'Date.UTC(2020)', 'Date.UTC(2020, 1, 30)', 'Date.UTC(275760, 8, 13)', 'Date.UTC(275760, 8, 13, 0, 0, 0, 1)', 'Date.UTC(-271821, 3, 20)', 'Date.UTC(-271821, 3, 19, 23, 59, 59, 999)', 'Date.UTC(1970, 0, 1, 0, 0, 0, 0.9)', 'Date.UTC(1970, 0, 1, 0, 0, 0, -0.9)', 'Date.UTC(99, 11.9)', 'Date.UTC(2020, NaN)', 'Date.UTC(2020, 0, Infinity)', 'new Date(NaN).getFullYear()', 'new Date(NaN).toString()', 'new Date(NaN).getTimezoneOffset()', 'String(new Date(0).setUTCFullYear(NaN))', 'new Date(0).setUTCHours(1e20)', 'new Date(0).setTime(-0)', 'new Date(0).setTime(1.5)', 'new Date(0).setUTCMilliseconds(-1.5)', 'new Date(86400000 * 365.25 * 30 + 0.5).toISOString()', 'new Date(-1).toISOString()', '(function(){var d=new Date(0);d.setUTCMilliseconds(NaN);return d.getTime()})()', '(function(){var d=new Date(0);d.setUTCHours(Infinity);return d.getTime()})()', '(function(){var d=new Date(5);return d.setUTCSeconds(1, NaN)})()', 'new Date(-62135596800001).toISOString()', 'new Date(253402300800000).toISOString()', 'new Date(-62198755200000).toISOString()', 'new Date(8.64e15).toISOString()', 'new Date(-8.64e15).toISOString()', 'Date.parse("2020-02-30T00:00:00Z")', 'Date.parse("1970-01-01T00:00:00.5Z")', 'Date.parse("+275760-09-13T00:00:00.000Z")', 'Date.parse("+275760-09-13T00:00:00.001Z")', 'Date.parse("x")', 'new Date(2020, 0, 1) < new Date(NaN)', 'new Date(NaN) > new Date(0)', 'new Date(NaN) - new Date(0)', 'new Date(1e12).getUTCDay()', 'new Date(-1e12).getUTCDay()', 'new Date(-1).getUTCMilliseconds()', 'new Date(-1e15).getUTCFullYear()', 'new Date(1e15).getUTCFullYear()', 'new Date(2**31 * 1000).getUTCFullYear()', 'new Date("2020-01-01T00:00:00Z").valueOf() / 1000',
  '1n < NaN', '1n > NaN', '1n == NaN', '1n < Infinity', '1n > -Infinity', '2n ** 64n > 1e19', '2n ** 64n < 1e20', '2n ** 1100n > Number.MAX_VALUE', '2n ** 1100n < Infinity', '9007199254740993n == 9007199254740992', '9007199254740993n > 9007199254740992', '1n == 1.5', '1n < 1.5', '2n > 1.5', '0n == -0', 'Number(2n ** 64n)', 'Number(-(2n ** 1100n))', 'Number(9007199254740993n)', 'Number(9007199254740995n)', 'BigInt(1e21)', 'BigInt(-0)', 'BigInt(2**53)', 'BigInt.asUintN(64, -1n)', 'String(BigInt(Number.MAX_VALUE)).length', '(function(){try{return BigInt(1.5)}catch(e){return e.name}})()', '(function(){try{return BigInt(NaN)}catch(e){return e.name}})()', '(function(){try{return BigInt(Infinity)}catch(e){return e.name}})()',
  '"a".repeat(2.9)', '"abc".substring(NaN, 2)', '"abc".substring(2, -Infinity)', '"abc".slice(-0.5)', '"abc".at(-1.9)', '"abc".charCodeAt(1.9)', '"abc".codePointAt(NaN)', '"abc".indexOf("c", -Infinity)', '"abc".lastIndexOf("a", NaN)', '"abc".padEnd(5.9, "x")', '"abc".substr(-1.5, 1.5)', '"abcdef".slice(1.5, -1.5)', '"abc"[1.0]', '"abc"[-0]', '"abc"["1.0"]', 'String.fromCharCode(65.9, -1, 65536 + 66, NaN).length', '(function(){try{return String.fromCodePoint(1.5)}catch(e){return e.name}})()', '(function(){try{return "a".repeat(-1)}catch(e){return e.name}})()', '(function(){try{return "a".repeat(Infinity)}catch(e){return e.name}})()', '(function(){try{return (1).toFixed(101).length}catch(e){return e.name}})()', '(function(){try{return (1).toString(1.5)}catch(e){return e.name}})()', '(function(){try{return new Array(-1)}catch(e){return e.name}})()', '(function(){try{return new Array(1.5)}catch(e){return e.name}})()', '(function(){try{return new Array(4294967296)}catch(e){return e.name}})()', '(function(){try{var a=[];a.length=NaN;return 0}catch(e){return e.name}})()', '(function(){try{return new Float64Array(-1)}catch(e){return e.name}})()', '(function(){try{return new Float64Array(1.5).length}catch(e){return e.name}})()', '(function(){try{return new Float64Array(NaN).length}catch(e){return e.name}})()', '(function(){try{return new ArrayBuffer(Infinity)}catch(e){return e.name}})()',
  '[0, -0, 1].map(B).join()', '(function(){var r=[];for(const x of [0,-0,1])r.push(B(x));return r.join()})()', '(function(){var r=[];for(var x of [-0])r.push(B(x));return r.join()})()', '(function(){var r=[];for(let x of [-0, -0.0, 0 * -1])r.push(B(x));return r.join()})()', '(function(){var r=[];[0,-0,1].forEach(function(x){r.push(B(x))});return r.join()})()', '(function(){var a=[0,-0,1],r=[];for(var i=0;i<3;i++)r.push(B(a[i]));return r.join()})()', '(function(){var r=[];for(const x of [1.5,-0,2.5])r.push(B(x));return r.join()})()', '(function(){var r=[];for(const x of [-0])r.push(B(x));return r.join()})()', '(function(){var r=[];for(const x of [0,-0])r.push(B(x));return r.join()})()', '(function(){var a=[0,-0,1];var r=[];for(const x of a)r.push(B(x));return r.join()})()', '(function(){var r=[];for(const x of [0,-0,1].values())r.push(B(x));return r.join()})()', '(function(){var [a,b,c]=[0,-0,1];return B(b)})()', '(function(){return [...[0,-0,1]].map(B).join()})()', '(function(){return Array.from([0,-0,1]).map(B).join()})()', '(function(){return Math.max(...[0,-0]) + "," + B(Math.min(...[0,-0]))})()', '(function(){var a=[0,-0,1];a.push(-0);return a.map(B).join()})()', '(function(){var a=[1,2,3];a[1]=-0;return a.map(B).join()})()', '(function(){var a=[-0];return B(a.pop())+B([-0].shift())+B([1,-0].at(-1))})()', '(function(){var a=[1,-0,3];return a.slice(1,2).map(B)+a.concat([-0]).map(B).join()})()', '(function(){var o={a:-0};return B(o.a)+B(Object.values(o)[0])})()', '(function(){var x=-0;return B(x)})()', '(function(){var x=0;x=-x;return B(x)})()', '(function(){var x=0;return B(-x)})()', '(function(){var x=0;return B(x*-1)})()', '(function(){var x=-0;x+=0;return B(x)})()', '(function(){var x=-0;x-=0;return B(x)})()', '(function(){var x=-0;x++;return B(x)})()', '(function(){var x=-0;return B(x--)})()', '(function(){var x=-0;return B(+x)+B(x|0)+B(x*1)+B(x/1)+B(x%1)+B(x**1)})()', '(function(){var x=-1;x++;return B(x)})()', '(function(){var x=1;x--;return B(x)})()', '(function(){var x=-0.5;return B(Math.round(x))+B(Math.ceil(x))+B(Math.trunc(x))})()', '(function(){var x=-7;return B(x%7)+B(x%-7)+B(x/Infinity)+B(x*0)})()', '(function(){var x=-4;return B(x%2)+B(x%4)+B((x+4)*-1)+B(0/x)+B((x+4)/x)})()', '(function(){var a=-4,b=4;return B(a+b)+B(b+a)+B(a-a)+B(-a-b)+B(-(a+b))})()', '(function(){var x=0;return B(-x)+B(- -x)+B(-(-x))+B(0-x)+B(x-0)+B(-x-0)+B(-x+0)})()', '(function(){var x=5;return B(-x)+B(-(x-5))+B((x-5)*-3)+B(-(x-5)/3)})()', '(function(){return B(-"0")+B(-"")+B(-null)+B(-false)+B(-[])+B(+"-0")+B(Number("-0"))})()', '(function(){return B(Math.round(-0.4))+B(Math.round(-0))+B(Math.floor(-0))+B(Math.ceil(-0.9))+B(Math.trunc(-0.9))+B(Math.sign(-0))+B(Math.abs(-0))+B(Math.sqrt(-0))+B(Math.cbrt(-0))+B(Math.fround(-0))})()', '(function(){return B(Math.min(0,-0))+B(Math.max(-0,0))+B(Math.min(-0))+B(Math.max(-0))+B(Math.max(-0,-0))+B(Math.min(0, 0))})()', '(function(){return B(parseFloat("-0"))+B(parseInt("-0"))+B(Number("-0.0"))+B(-0.0)+B(JSON.parse("-0"))+B(JSON.parse("[-0]")[0])+B(JSON.parse("-0.0"))+B(JSON.parse("-0e0"))})()', '(function(){return B(new Float64Array([-0])[0])+B(new Float32Array([-0])[0])+B(new Int32Array([-0])[0])+B(new DataView(new Float64Array([-0]).buffer).getFloat64(0, true))})()', '(function*(){yield -0})().next().value === 0 && B((function*(){yield -0})().next().value)', '(function(){var r=[];for(var k in {"-0":1,"0":2})r.push(k);return r.join()})()', '(function(){var a=[];a[-0]=5;return a.length+Object.keys(a).join()})()', '(function(){var o={};o[-0]=1;o[0.5]=2;o[1e21]=3;o[1e-7]=4;o[NaN]=5;o[-Infinity]=6;o[2**32]=7;o[4294967295]=8;o[4294967294]=9;return Object.keys(o).join()})()', '(function(){var a=[];a[4294967294]=1;return a.length})()', '(function(){var a=[];a[4294967295]=1;return a.length})()', '(function(){var a=[1,2,3];return a[1.0]+a["1"]+String(a[1.5])+String(a[-0])+String(a["-0"])+String(a[NaN])})()', '(function(){var a=[1,2,3];a[1.5]=9;a[2**32]=8;return a.length+","+Object.keys(a).join()})()',
  '(function(){var n=0;for(var i=0;i<NaN;i++){n++;if(n>3)break}return n})()', '(function(){var n=0;for(var i=0;i<2.5;i++)n++;return n})()', '(function(){var n=0;for(var i=0.5;i<=2.5;i+=0.5)n++;return n})()', '(function(){var n=0;for(var i=3;i>-0.5;i--)n++;return n})()', '(function(){var n=0;for(var i=0;i<Infinity;i++){n++;if(n>3)break}return n})()', '(function(){var n=0;for(var i=0;i>-Infinity;i--){n++;if(n>3)break}return n})()', '(function(){var n=0,x=NaN;while(x>0||x<0||x==0||x>=0||x<=0){n++;break}return n})()', '(function(){var n=0,x=NaN;do{n++}while(n<x);return n})()', '(function(){var x=NaN;return (x<1?1:0)+(x>1?2:0)+(x==1?4:0)+(x!=1?8:0)+(x<=1?16:0)+(x>=1?32:0)+(x===x?64:0)+(x!==x?128:0)+(!(x<1)?256:0)+(!(x>=1)?512:0)})()', '(function(){var x=NaN,y=NaN;return (x<y?1:0)+(x>y?2:0)+(x==y?4:0)+(x!=y?8:0)+(x<=y?16:0)+(x>=y?32:0)+(x===y?64:0)+(x!==y?128:0)})()', '(function(){var x=1,y=NaN;return (x<y?1:0)+(x>y?2:0)+(x==y?4:0)+(x!=y?8:0)+(x<=y?16:0)+(x>=y?32:0)+(x===y?64:0)+(x!==y?128:0)})()', '(function(){var x=1.5,y=NaN;return (x<y?1:0)+(x>y?2:0)+(x==y?4:0)+(x!=y?8:0)+(x<=y?16:0)+(x>=y?32:0)+(x===y?64:0)+(x!==y?128:0)})()', '(function(){var x="a",y=NaN;return (x<y?1:0)+(x>y?2:0)+(x==y?4:0)+(x!=y?8:0)+(x<=y?16:0)+(x>=y?32:0)+(x===y?64:0)+(x!==y?128:0)})()', '(function(){var x=undefined,y=1;return (x<y?1:0)+(x>y?2:0)+(x==y?4:0)+(x!=y?8:0)+(x<=y?16:0)+(x>=y?32:0)})()', '(function(){var x={valueOf:function(){return NaN}},y=1;return (x<y?1:0)+(x>y?2:0)+(x==y?4:0)+(x!=y?8:0)+(x<=y?16:0)+(x>=y?32:0)})()', '(function(){var x=NaN;return [x<0, x>0, 0<x, 0>x, x<=0, x>=0, x==0, x!=0, x===0, x!==0, x<0.5, x>0.5, 0.5<x, 0.5>=x].join()})()', '(function(){var x=NaN;return [x<1n, x>1n, x==1n, x<"1", x>"1", x==null, x==undefined, x==false, x==true, x=="NaN", x==[NaN]].join()})()', '(function(){var x=0/0;var y=x;return [x==y, x===y, x!=y, x!==y, x<y, x<=y, x>y, x>=y].join()})()', '(function(){var x=Infinity-Infinity;return [typeof x, x!==x, isNaN(x), Number.isNaN(x), x==x].join()})()', '(function(){var x=Math.sqrt(-1);return [x!==x, x<0, x>0, x==0].join()})()', '(function(){var x=parseFloat("x");return [x!==x, x<0, x>0, x==0].join()})()', '(function(){var x=undefined+1;return [x!==x, x<0, x>0, x==0].join()})()', '(function(){var a=[NaN];return [a[0]!==a[0], a[0]<0, a[0]>0, a[0]==0, a[0]===a[0]].join()})()', '(function(){var o={n:NaN};return [o.n!==o.n, o.n<0, o.n>0, o.n==0, o.n===o.n].join()})()', '(function(){var x=NaN;var c=0;if(x<0)c|=1;if(x>0)c|=2;if(x<=0)c|=4;if(x>=0)c|=8;if(x==0)c|=16;if(x!=0)c|=32;if(x===0)c|=64;if(x!==0)c|=128;if(!(x<0))c|=256;if(!(x>0))c|=512;return c})()', '(function(){var x=NaN,i=0;var c=0;if(i<x)c|=1;if(i>x)c|=2;if(i<=x)c|=4;if(i>=x)c|=8;if(i==x)c|=16;if(i!=x)c|=32;if(i===x)c|=64;if(i!==x)c|=128;return c})()', '(function(){var x=Infinity,c=0;if(x>1e308)c|=1;if(x>=Infinity)c|=2;if(x==Infinity)c|=4;if(-x<-1e308)c|=8;if(x>-x)c|=16;if(x!=x)c|=32;if(x-x==x-x)c|=64;return c})()', '(function(){var x=-0,y=0,c=0;if(x==y)c|=1;if(x===y)c|=2;if(x<y)c|=4;if(x>y)c|=8;if(x<=y)c|=16;if(x>=y)c|=32;if(x!=y)c|=64;if(x!==y)c|=128;return c})()', '(function(){var x=5e-324,y=0,c=0;if(x==y)c|=1;if(x>y)c|=2;if(-x<y)c|=4;if(x>-x)c|=8;if(x/2==0)c|=16;if(x*2==1e-323)c|=32;return c})()',
  '(0.1).toFixed(20)', '(0.5).toFixed(1)', '5e-324 * 2', '5e-324 / 2', '5e-324 * 0.5', '5e-324 + 5e-324', '2.2250738585072014e-308 / 2', '2.2250738585072014e-308 - 5e-324', '2.2250738585072014e-308 * 0.9999', '1e-310 * 1e10', '1e-310 / 1e10', '1e-310 + 1e-310', '1e-310 * 1e-10', '1e-320 * 1e320 === Infinity', '1e-160 * 1e-160', '1e-162 * 1e-162', '4.9e-324 * 1e308', '1.7976931348623157e308 + 9.9e291', '1.7976931348623157e308 + 1e292', '1.7976931348623157e308 * 1.0000000000000002', '1.7976931348623157e308 - 1.7976931348623157e308', '1.7976931348623157e308 / 0.5', '1e308 + 1e308', '1e308 * 10', '-1e308 * 10', '1e308 / 1e-10', '1 / 5e-324', '1 / 1e-310', '5e-324 / 1e-310', '1e-310 / 5e-324', '1e-310 % 3e-320', '5e-320 % 5e-324', '1e-310 - 1e-310', '1e-310 < 2e-310', '1e-310 == 1e-310', '-1e-310 < 1e-310', '5e-324 > 0', '-5e-324 < 0', '5e-324 == 0', 'Math.sqrt(5e-324)', 'Math.sqrt(1e-310)', 'Math.abs(-5e-324)', 'Math.floor(1e-310)', 'Math.ceil(1e-310)', 'Math.round(1e-310)', 'Math.trunc(-1e-310)', 'Math.sign(-1e-310)', '1e-310 | 0', '(1e-310).toString()', '(4.94e-324).toString()', '(1e-310 * 3).toString()', '(2.225e-308).toString()', '1e-310 + 1',
  '2147483647 + 0.5', '2147483648 - 0.5', '2147483647.5 | 0', '2147483648.5 | 0', '-2147483648.5 | 0', '-2147483649.5 | 0', '4294967295.5 | 0', '4294967296.5 | 0', '4294967295.5 >>> 0', '-0.5 >>> 0', '-1.5 >>> 0', '9007199254740992 | 0', '9007199254740993 | 0', '18446744073709551616 | 0', '18446744073709555712 | 0', '-18446744073709555712 | 0', '1e19 | 0', '1.5e19 >>> 0', '(2**63) | 0', '(2**63 + 2**32) | 0', '(2**84 + 2**32) | 0', '(2**85 + 2**33) >>> 0', '-(2**31) | 0', '(2**31 - 1) + (2**31 - 1)', '(2**31) * (2**31)', '(2**31 - 1) * (2**31 - 1)', '46341 * 46341', '46340 * 46340', '-46341 * 46341', '65535 * 65537', '3037000500 * 3037000500', '94906267 * 94906267', '94906265 * 94906265', '2147483647 - -2147483648', '-2147483648 + -2147483648', '-2147483648 - 2147483647', '1073741824 + 1073741824', '1073741824 * 2', '1073741824 * -2', '1073741824 * -2 - 1', '2147483647 / 1', '2147483647 / 2', '-2147483648 / 2', '2147483647 % 2', '-2147483647 % 2', '2147483648 % 2', '4294967297 % 4294967296', '9007199254740993 % 2', '9007199254740992 % 3', '1e21 % 1e3', '-1e21 % 7', '123456789.123 % 1', '-123456789.5 % 1', '5.5 % 1.1', '1 % 0.1', '0.3 % 0.1', '10 % 3.3', '-10 % 3.3', '1e308 % 1e-308', '1e308 % 3', '5 % 5e-324', '5e-324 % 5', '4 % 2', '4 % -2', '-4 % 2', '2**53 / 3', '(2**53 + 2) / 2', '1e15 / 1e-15', '3 / 2 | 0', '-3 / 2 | 0', '7 / 7', '0 / 7', '-0 / 7', '7 / -0', '100 / 3', '100 / 4', '100 / -4', '-100 / -4', '1 / 3 * 3', '4 / 3 * 3 - 4', '49 / 49', '1e300 * 1e10 / 1e10',
  '(function(){var a=2147483647;a++;return B(a)})()', '(function(){var a=-2147483648;a--;return B(a)})()', '(function(){var a=2147483647;a+=1;return B(a)})()', '(function(){var a=2147483647;return B(a+a)+B(a*a)+B(-a-a)+B(a*-a)+B(a*2)+B(a<<1)+B(a>>>31)})()', '(function(){var a=-2147483648;return B(-a)+B(a/-1)+B(a%-1)+B(a*-1)+B(Math.abs(a))+B(a-1)+B(a+a)+B(a*a)+B(a>>>0)+B(~a)})()', '(function(){var a=65536;return B(a*a)+B(a*a*a)+B(a*65535)+B(-a*a)+B(a*32768)+B(a*-32768)+B(a*32767)})()', '(function(){var a=9007199254740991;return B(a+1)+B(a+2)+B(a+3)+B(a*2)+B(-a-1)+B(-a-2)+B(a-0.5)+B(a/2)})()', '(function(){var a=4294967295;return B(a+1)+B(a|0)+B(a>>>0)+B(a*a)+B(a>>1)+B(a<<1)+B(~a)+B(a&a)+B(a^0)})()', '(function(){var a=1.5,b=2;return B(a+b)+B(a*b)+B(a-b)+B(a/b)+B(a%b)+B(-a)+B(a<b)+B(a>=b)})()', '2 ** 1.5', '1.5 ** 2', '(function(){var a=0.1,b=0.2;return B(a+b)+B(a*b)+B(a-b)+B(a/b)+B(a%b)+B(b%a)+B((a+b)===0.3)+B(a+b>0.3)})()', '(function(){var s=0;for(var i=0;i<100;i++)s+=0.1;return B(s)})()', '(function(){var s=1;for(var i=0;i<1100;i++)s*=2;return B(s)})()', '(function(){var s=1;for(var i=0;i<1100;i++)s/=2;return B(s)})()', '(function(){var s=1,n=0;while(s>0){s/=2;n++}return n})()', '(function(){var s=1,n=0;while(s<Infinity){s*=2;n++}return n})()', '(function(){var s=1,n=0;while(1+s!==1){s/=2;n++}return n})()', '(function(){var s=0;for(var i=1;i<=20;i++)s+=1/i;return B(s)})()', '(function(){var f=1;for(var i=2;i<=25;i++)f*=i;return B(f)+String(f)})()', '(function(){var f=1;for(var i=2;i<=171;i++)f*=i;return B(f)})()', '(function(){var x=1e300;return B(x*x)+B(-x*x)+B(x*x-x*x)+B(x*x/(x*x))+B(1/(x*x))+B(-1/(x*x))})()', '(function(){var i=2147483640,n=0;for(;i<2147483650;i++)n++;return n+B(i)})()', '(function(){var i=-2147483640,n=0;for(;i>-2147483650;i--)n++;return n+B(i)})()', '(function(){var i=2147483646;i+=1;var a=i;i+=1;return B(a)+B(i)+typeof i+(i>a)+(i===a+1)})()', '(function(){var x=2147483648;return [x>2147483647, x>=2147483648, x<2147483649, x==2147483648, x===2147483648.0, x!=2147483647, 2147483647<x, -x<-2147483647, -x==-2147483648, (x|0)<0].join()})()', '(function(){var x=9007199254740992;return [x==x+1, x<x+1, x<x+2, x+1>x, x-1<x, x===9007199254740993, x>9007199254740991].join()})()', '(function(){var x=1.5;return [x>1, x<2, x>=1.5, x<=1.5, x==1.5, 1<x, 2>x, x!=1, x>1n, x<2n].join()})()', '(function(){var x=-1.5;return [x>-1, x<-2, x>=-1.5, x<=-1.5, x<0, x>-2, x<-1, 0>x, -2<x].join()})()',
];

const dv = new DataView(new ArrayBuffer(8));
function hex8(n) { return (n >>> 0).toString(16).padStart(8, '0'); }
/** The value as text: a number as its 16 hex digits ("NaN" for any NaN), anything else as type:text. */
function B(v) {
    if (typeof v !== 'number') return typeof v + ':' + String(v);
    dv.setFloat64(0, v);
    const hi = dv.getUint32(0), lo = dv.getUint32(4);
    if (((hi >>> 20) & 0x7ff) === 0x7ff && ((hi & 0xfffff) !== 0 || lo !== 0)) return 'NaN';
    return hex8(hi) + hex8(lo);
}
globalThis.B = B;

const vals = VALUES.map((s) => (0, eval)(s));
const arith = ARITH.map(([name, src]) => {
    const f = new Function('a', 'b', 'return ' + src + ';');
    return [name, src, vals.map((a) => vals.map((b) => B(f(a, b))).join(' '))];
});
const compare = COMPARE.map(([name, src]) => {
    const f = new Function('a', 'b', 'return ' + src + ';');
    return [name, src, vals.map((a) => vals.map((b) => (f(a, b) ? '1' : '0')).join(''))];
});
const exprs = [];
for (const src of EXPRESSIONS) {
    if (SKIP.some((re) => re.test(src))) continue;
    let want;
    try { const v = (0, eval)(src); want = B(v); } catch (e) { want = 'throws ' + e.name; }
    exprs.push([src, want, APPROX.test(src) ? 1 : 0]);
}

const out = [];
out.push(`/*
 * test_numeric_edge.js -- numbers at their edges: NaN, infinities, signed
 * zeros, denormals, the int32 / uint32 / 2^53 boundaries, the largest
 * and smallest doubles, in arithmetic, comparisons, Math, conversions,
 * text <-> number, typed arrays, Date, BigInt, sort.
 *
 * GENERATED by amiga/tests/host/gen_numeric_edge.js; edit that, not this.
 * The expected values are node's, stored as bit patterns.
 *
 * Why it exists. Up to 0.231 the soft-float variants (quickjs.library is
 * the 68020 soft-float one) did their arithmetic with the operating
 * system's mathieeedoubbas.library, and on a machine without an FPU that
 * is not IEEE 754 arithmetic: 0 < NaN and NaN === NaN were true,
 * 1e308 * 10 was 1.797e308 instead of Infinity, 5e-324 / 2 was 5e-324
 * instead of 0, Math.floor(-0) was -1, 2147483647 * 4294967295 was wrong
 * in the eighth digit, Math.atan(0.9999999995) likewise, and loops such
 * as "while (x > 0) x /= 2" never ended. 0.232 gives those variants
 * their own arithmetic and maths functions. Every variant must pass.
 *
 * Results of transcendental functions that are ordinary numbers may
 * differ from node's in the last few bits (the checks marked "~");
 * everything else must match bit for bit.
 *
 * Run with: qjs tests/test_numeric_edge.js
 * Prints a PASS or FAIL line per check and a count at the end. Takes a
 * few minutes on a 68020.
 */

let pass = 0, fail = 0;

/**
 * Count and print one check.
 * @param {boolean} cond - whether the check passed
 * @param {string} msg - what was checked
 * @returns {void}
 */
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

const dv = new DataView(new ArrayBuffer(8));

/**
 * A 32-bit value as eight hex digits.
 * @param {number} n - the value
 * @returns {string} the digits
 */
function hex8(n) {
    let s = (n >>> 0).toString(16);
    while (s.length < 8) s = "0" + s;
    return s;
}

/**
 * A value as text that shows exactly what it is: a number as the 16 hex
 * digits of its bit pattern ("NaN" for any NaN), anything else as
 * "type:text".
 * @param {*} v - the value
 * @returns {string} its exact rendering
 */
function B(v) {
    if (typeof v !== "number") return typeof v + ":" + String(v);
    dv.setFloat64(0, v);
    const hi = dv.getUint32(0), lo = dv.getUint32(4);
    if (((hi >>> 20) & 0x7ff) === 0x7ff && ((hi & 0xfffff) !== 0 || lo !== 0)) return "NaN";
    return hex8(hi) + hex8(lo);
}
globalThis.B = B;

/**
 * The number with the given bit pattern.
 * @param {string} hex - 16 hex digits, or "NaN"
 * @returns {number} the number
 */
function fromBits(hex) {
    if (hex === "NaN") return NaN;
    dv.setUint32(0, parseInt(hex.slice(0, 8), 16));
    dv.setUint32(4, parseInt(hex.slice(8), 16));
    return dv.getFloat64(0);
}

/**
 * Whether two exact renderings name numbers within a few units in the
 * last place of each other. Zeros, infinities and NaN never are: those
 * must match exactly. Uses integer comparison of the bit patterns'
 * halves, not floating-point arithmetic.
 * @param {string} got - rendering of the result
 * @param {string} want - rendering of the expected value
 * @returns {boolean} true if close enough
 */
function close(got, want) {
    if (got.length !== 16 || want.length !== 16) return false;
    const gh = parseInt(got.slice(0, 8), 16), wh = parseInt(want.slice(0, 8), 16);
    const gl = parseInt(got.slice(8), 16), wl = parseInt(want.slice(8), 16);
    if ((gh & 0x7ff00000) === 0x7ff00000 || (wh & 0x7ff00000) === 0x7ff00000) return false;
    if (((gh & 0x7fffffff) | gl) === 0 || ((wh & 0x7fffffff) | wl) === 0) return false;
    if (gh === wh) return Math.abs(gl - wl) <= 8;
    if (gh - wh === 1) return gl + 4294967296 - wl <= 8;
    if (wh - gh === 1) return wl + 4294967296 - gl <= 8;
    return false;
}

const VALUES = ${JSON.stringify(VALUES)};
const vals = VALUES.map(function (s) { return (0, eval)(s); });
`);
out.push(`print("=== Numeric edge cases ===");`);
out.push(`print("-- arithmetic on every pair of " + VALUES.length + " edge values (bit patterns)");`);
out.push(`const ARITH = [`);
for (const [name, src, rows] of arith) out.push(`  [${JSON.stringify(name)}, function (a, b) { return ${src}; }, [\n${rows.map((r) => '    ' + JSON.stringify(r)).join(',\n')}]],`);
out.push(`];`);
out.push(`for (const [name, fn, rows] of ARITH) {
    for (let i = 0; i < vals.length; i++) {
        const want = rows[i].split(" ");
        const wrong = [];
        for (let j = 0; j < vals.length; j++) {
            const got = B(fn(vals[i], vals[j]));
            if (got !== want[j]) wrong.push(VALUES[j] + " gives " + got + " not " + want[j]);
        }
        ok(wrong.length === 0, VALUES[i] + " " + name + " each value" + (wrong.length ? ": " + wrong.slice(0, 3).join("; ") : ""));
    }
}`);
out.push(`print("-- comparisons and equality on every pair");`);
out.push(`const COMPARE = [`);
for (const [name, src, rows] of compare) out.push(`  [${JSON.stringify(name)}, function (a, b) { return ${src}; }, [\n${rows.map((r) => '    ' + JSON.stringify(r)).join(',\n')}]],`);
out.push(`];`);
out.push(`for (const [name, fn, rows] of COMPARE) {
    for (let i = 0; i < vals.length; i++) {
        const wrong = [];
        for (let j = 0; j < vals.length; j++) {
            const got = fn(vals[i], vals[j]) ? "1" : "0";
            if (got !== rows[i][j]) wrong.push(VALUES[j] + " gives " + (got === "1"));
        }
        ok(wrong.length === 0, name + " with a = " + VALUES[i] + (wrong.length ? ": " + wrong.slice(0, 4).join("; ") : ""));
    }
}`);
out.push(`print("-- expressions (~ marks a result allowed to differ in its last bits)");`);
out.push(`const EXPRESSIONS = [`);
for (const [src, want, approx] of exprs) out.push(`  [${JSON.stringify(src)}, ${JSON.stringify(want)}, ${approx}],`);
out.push(`];`);
out.push(`for (const [src, want, approx] of EXPRESSIONS) {
    let got;
    try { got = B((0, eval)(src)); } catch (e) { got = "throws " + e.name; }
    const good = got === want || (approx === 1 && close(got, want));
    ok(good, (approx ? "~ " : "") + src + (good ? "" : " gave " + got + ", want " + want));
}

print("");
print("=== Results: " + pass + " passed, " + fail + " failed ===");
if (fail > 0 && typeof std !== "undefined") std.exit(1);
`);
const target = path.join(__dirname, '..', 'test_numeric_edge.js');
fs.writeFileSync(target, out.join('\n'));
console.log('wrote ' + target + ': ' + (arith.length + compare.length) * VALUES.length + ' table rows, ' + exprs.length + ' expressions');
