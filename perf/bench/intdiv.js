// integer division and remainder on int32 values (i/2 exact or .5, positive and negative %)
function f(n) { let s = 0; for (let i = 0; i < n; i++) { s = (s + ((i / 2) | 0) + (i % 7) + (-i % 5)) | 0; } return s; }
print(f(100000));
