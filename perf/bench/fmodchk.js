/* Float remainder cases; output must equal node's. */
const xs = [0, -0, 1, -1, 7.5, -7.5, 5.5, 1e300, -1e300, 2147483648, -2147483648,
            4294967297, 0.1, -0.3, 1e-310, 123456789.125, Infinity, -Infinity, NaN];
const ys = [1, -1, 2, -2, 3, 0.1, -0.7, 5, 2147483647, -2147483648, 1e-5, 1e300,
            Infinity, 0, NaN];
function show(v) { return v === 0 ? (1 / v < 0 ? '-0' : '+0') : String(v); }
const out = [];
for (const x of xs) for (const y of ys) out.push(show(x) + '%' + show(y) + '=' + show(x % y));
for (let i = 0; i < out.length; i += 5) print(out.slice(i, i + 5).join('  '));
