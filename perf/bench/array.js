// array indexing (1 get + 1 set per iteration on a fast array)
function f(n) { const a = []; for (let i = 0; i < 256; i++) a.push(i); let s = 0;
  for (let i = 0; i < n; i++) { a[i & 255] = a[(i + 7) & 255] + 1; } for (let i = 0; i < 256; i++) s += a[i]; return s; }
print(f(100000));
