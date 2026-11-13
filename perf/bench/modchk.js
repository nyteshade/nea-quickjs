// correctness probe for / and % (values printed as strings so -0 shows via 1/x)
function m(a, b) { return a % b; }
function d(a, b) { return a / b; }
var r = [];
var as = [0, 1, -1, 7, -7, 10, -10, 2147483647, -2147483648, 6, -6];
var bs = [1, -1, 2, -2, 5, -5, 7, 3, -3, 2147483647, -2147483648, 0];
for (var i = 0; i < as.length; i++) for (var j = 0; j < bs.length; j++) {
  var x = m(as[i], bs[j]), y = d(as[i], bs[j]);
  r.push(as[i] + "%" + bs[j] + "=" + x + (x === 0 ? (1 / x < 0 ? "(-0)" : "(+0)") : ""));
  r.push(as[i] + "/" + bs[j] + "=" + y + (y === 0 ? (1 / y < 0 ? "(-0)" : "(+0)") : ""));
}
print(r.join(" "));
print(m(-7, 5), m(7, -5), m(-7.5, 2), d(7, 2), d(-8, 2), m(5.5, 2));
