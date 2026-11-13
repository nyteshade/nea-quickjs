// property get/set on a plain object (3 gets + 2 sets per iteration)
function f(n) { const o = { a: 1, b: 2, c: 3 }; for (let i = 0; i < n; i++) { o.a = o.b + o.c; o.c = o.a - i; } return o.a + o.c; }
print(f(100000));
