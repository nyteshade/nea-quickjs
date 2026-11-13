/*
 * probe_mul.js - where does a wrong product above 2^32 come from?
 *
 * 65536 * 65536 printed 6553665536 on an Amiga at 0.228; the right
 * answer is 4294967296. This prints one line of values that tell the
 * multiplication apart from the number-to-text conversion.
 *
 * Expected output:
 *   A 4294967296 4294967297 10000000000 9007199254740991
 *   B 4294967296 4295032832 10000000000 2147488281
 *   C true 65536 100000000 1 0
 *   D 4294967296 4294967296 4294967296
 *
 * Run: qjs tests/probe_mul.js
 */

let a = 65536;
let b = 65536;

/* A: literals only. Wrong here means number-to-text is at fault. */
print('A', 4294967296, 4294967297, 1e10, Number.MAX_SAFE_INTEGER);

/* B: two integers whose product does not fit in 32 bits. */
print('B', a * b, a * 65537, 100000 * 100000, 46341 * 46341);

/* C: the product tested without printing it. */
let product = a * b;

print('C', product === 4294967296, product / 65536,
      (product - 4294967296) + 100000000,
      Math.floor(product / 4294967296), product % 65536);

/* D: the same value reached without an integer multiply. */
print('D', a * 65536.0, 2 ** 32, 4294967295 + 1);
