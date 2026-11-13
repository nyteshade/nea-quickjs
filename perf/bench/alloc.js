// object allocation / free churn (1 object + 1 array literal per iteration, ring of 64 kept alive)
function f(n) { const ring = new Array(64); let t = 0; for (let i = 0; i < n; i++) { const o = { x: i, y: i + 1 }; ring[i & 63] = [o, i]; t += o.y - o.x; } return t + ring.length; }
print(f(50000));
