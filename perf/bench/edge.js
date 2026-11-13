// edge cases for the opcodes rewritten in the r2 prototype; output must equal the
// unmodified library (and node).  No negative % here (shipped soft library gets that wrong).
var out = [];
function z(x) { return x === 0 ? (1 / x < 0 ? "-0" : "+0") : String(x); }
function arith(a, b) { return [z(a + b), z(a - b), z(a * b), z(a / b), a < b, a <= b, a > b, a >= b, a == b, a != b, a === b, a !== b, a & b, a | b, a ^ b, a << b, a >> b, a >>> b].join(","); }
var vals = [0, 1, -1, 2, 3, 7, -7, 65535, 65536, 46341, -46341, 1073741824, 2147483647, -2147483647, -2147483648, 0.5, -0.5, 1e10, "3", "x", true, null, undefined];
for (var i = 0; i < vals.length; i++) for (var j = 0; j < vals.length; j++) out.push(arith(vals[i], vals[j]));
function incs() { let a = 2147483646, b = -2147483647, c = 2147483647, d = 0.5, e = "5"; a++; a++; b--; b--; c += 1; c += 2147483647; d++; e++; let f = a++, g = b--, h = -c, k = -0, m = -(-2147483648);
  var q = 0; q = -q; return [a, b, c, d, e, f, g, h, z(k), m, z(q)].join(","); }
out.push(incs());
function loops(n) { let s = 0, t = 1; for (let i = 0; i < n; i++) { s += i; t = (t * 3) | 0; if (i % 3 == 0) continue; s -= 1; } var k = 0; while (k < 5) k++; do { k += 2; } while (k < 20); return [s, t, k].join(","); }
out.push(loops(1000));
function tdz() { try { x; let x = 1; return "no"; } catch (e) { return e.name; } }
function tdz2() { try { y = 2; let y; return "no"; } catch (e) { return e.name; } }
out.push(tdz(), tdz2());
function props() { var p = { a: 1, get g() { return this.a + 100; }, set s(v) { this.a = v; } }; var o = Object.create(p); o.b = "str"; var r = [o.a, o.b, o.g, o.missing, p.g];
  o.s = 5; r.push(o.a, p.a); o.a = { n: 1 }; o.a = o.a; o.a.n = o.a.n + 1; r.push(o.a.n); var f = Object.freeze({ x: 1 }); try { f.x = 2; } catch (e) { r.push(e.name); } r.push(f.x);
  var arr = [1, 2, 3]; r.push(arr.length, arr[0], arr[2], arr[3], arr[-1], arr["1"]); arr[5] = 9; r.push(arr.length, arr[4], arr[5]); var s = "hey"; r.push(s.length, s[1], s[9]);
  var ta = new Uint8Array(4); ta[1] = 300; r.push(ta[1], ta[7]); try { null.x; } catch (e) { r.push(e.name); } try { undefined.y = 1; } catch (e) { r.push(e.name); } return r.join(","); }
out.push(props());
function clos() { var fs = []; for (let i = 0; i < 3; i++) fs.push(function (x) { return i * 10 + x; }); var c = 0; function inc() { c++; return c; } inc(); inc(); return [fs[0](1), fs[2](2), c].join(","); }
out.push(clos());
function refs() { var a = "ab", b = a, o = { v: a }; for (var i = 0; i < 50; i++) { var t = o.v; o.v = t + "c"; b = o.v; var d = [b, t]; d = null; } return o.v.length + ":" + b.length; }
out.push(refs());
function sw(v) { switch (v) { case 1: return "one"; case "a": return "A"; default: return v ? "t" : "f"; } }
out.push(sw(1), sw("a"), sw(0), sw({}), typeof sw, void 0, !0, !"", ~5, +"7", -"8");
function args() { var s = 0; for (var i = 0; i < arguments.length; i++) s += arguments[i]; return s; }
function rec(n) { return n < 2 ? n : rec(n - 1) + rec(n - 2); }
out.push(args(1, 2, 3, 4.5), rec(15), [3, 1, 2].sort().join(""), [1, 2, 3].map(function (x) { return x * x; }).join(""), JSON.stringify({ a: [1, { b: 2 }], c: "d" }));
function exc() { var r = []; try { try { throw new Error("e1"); } finally { r.push("f"); } } catch (e) { r.push(e.message); } for (var k in { p: 1, q: 2 }) r.push(k); for (var v of [7, 8]) r.push(v); return r.join(","); }
out.push(exc());
function gen() { function* g() { var i = 0; while (i < 3) yield i++; } var r = []; for (var v of g()) r.push(v); return r.join(""); }
out.push(gen());
print(out.join("\n"));
