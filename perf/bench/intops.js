// same loop shape as intdiv.js but with shifts/and instead of / and % (control)
function f(n) { let s = 0; for (let i = 0; i < n; i++) { s = (s + ((i >> 1) | 0) + (i & 7) + (-i & 5)) | 0; } return s; }
print(f(100000));
