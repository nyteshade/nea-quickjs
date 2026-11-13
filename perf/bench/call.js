// JS-to-JS function calls (1 call per iteration, 2 args)
function add(a, b) { return a + b; }
function f(n) { let s = 0; for (let i = 0; i < n; i++) { s = add(s, i) | 0; } return s; }
print(f(100000));
