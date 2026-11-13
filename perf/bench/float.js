// floating-point arithmetic on locals (non-integer doubles throughout)
function f(n) { let x = 0.5, s = 0.25; for (let i = 0; i < n; i++) { x = x * 1.000001 + 0.25; s = s + x / 3.5 - 0.125; } return s; }
print(f(100000));
