/* test_symbol_key.js — verify Symbol works as object property key
 * Run: qjs test_symbol_key.js
 */
print('=== STRONG SYMBOL TEST ===');
print('typeof Symbol():', typeof Symbol());
print('typeof Symbol.for("x"):', typeof Symbol.for('x'));
print('typeof Symbol.iterator:', typeof Symbol.iterator);
print('Symbol.for("x") === "x":', Symbol.for('x') === 'x');
print('Symbol.for("x") instanceof Symbol attempt...');
try {
    print('  ', Symbol.for('x') instanceof Symbol);
} catch(e) {
    print('  threw:', e.message);
}

let s = Symbol.for('test.key');
print('');
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
