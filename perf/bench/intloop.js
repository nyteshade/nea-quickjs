// integer loop arithmetic on locals (int32 fast paths)
function f(n) { let s = 0; for (let i = 0; i < n; i++) { s = (s + i * 3) ^ (i >> 2); } return s; }
print(f(200000));
