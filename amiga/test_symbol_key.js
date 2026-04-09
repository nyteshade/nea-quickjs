/* test_symbol_key.js — verify Symbol works as object property key
 * Run: qjs test_symbol_key.js
 */
let s = Symbol.for('test.key');
print('typeof s:', typeof s);
print('String(s):', String(s));

let x = {};
x[s] = 'value';

print('Object.keys(x):', JSON.stringify(Object.keys(x)));
print('Object.getOwnPropertySymbols(x).length:', Object.getOwnPropertySymbols(x).length);
print('x[s]:', x[s]);

/* If symbol is being coerced to string, x['Symbol(test.key)'] would have it */
print("x['Symbol(test.key)']:", x['Symbol(test.key)']);
print("x['test.key']:", x['test.key']);
