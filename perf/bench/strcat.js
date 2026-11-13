// string concatenation (append, reset every 64 appends)
function f(n) { let s = '', t = 0; for (let i = 0; i < n; i++) { s += 'ab'; if ((i & 63) == 63) { t += s.length; s = ''; } } return t; }
print(f(100000));
