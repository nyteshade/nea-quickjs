function s(v){return v===0?(1/v<0?'-0':'+0'):String(v);}
const xs=[0, -0, 1]; const ys=[1,-1];
print(s(xs[1]), s(xs[1] % 1), s(-0 % 1));
for (const x of xs) print(s(x));
for (const x of xs) for (const y of ys) print(s(x)+'%'+s(y)+'='+s(x%y));
var n=NaN, z=0, o=1;
print(z<n, n<z, z<=n, n<=z, z>n, n>z, z>=n, n>=z, n==n, n!=n, n===n, n!==n, o<n, n<o, isNaN(n), n!==n);
