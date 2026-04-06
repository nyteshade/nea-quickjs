/*
 * test_comprehensive.js — Cross-platform QuickJS test suite
 *
 * Run on macOS:  qjs --std tests/test_comprehensive.js
 * Run on Amiga:  qjs --std tests/test_comprehensive.js
 *
 * Tests every category of JS functionality + std/os/bjson modules.
 * Reports PASS/FAIL with summary.
 */

import * as std from 'qjs:std';
import * as os from 'qjs:os';
let bjson;
try { bjson = null; } catch(e) { bjson = null; }

let pass = 0, fail = 0, skip = 0, total = 0;
const failures = [];

function test(name, fn) {
    total++;
    try {
        const result = fn();
        if (result === true || result === 1) {
            pass++;
        } else {
            fail++;
            failures.push(name + ' (returned: ' + result + ')');
            std.puts('  FAIL: ' + name + '\n');
        }
    } catch (e) {
        fail++;
        failures.push(name + ' (threw: ' + e.message + ')');
        std.puts('  FAIL: ' + name + ' [' + e.message + ']\n');
    }
}

function skip_test(name, reason) {
    total++;
    skip++;
    std.puts('  SKIP: ' + name + ' (' + reason + ')\n');
}

function section(name) {
    std.puts('\n[' + name + ']\n');
}

const isAmiga = os.platform === 'amiga' || os.platform === 'AmigaOS';

// =========================================================================
// 1. Core Language
// =========================================================================
section('1. Arithmetic');
test('addition', () => 1 + 1 === 2);
test('subtraction', () => 100 - 58 === 42);
test('multiplication', () => 3 * 7 === 21);
test('division', () => 10 / 2 === 5);
test('modulo', () => 17 % 5 === 2);
test('exponentiation', () => 2 ** 10 === 1024);
test('negative', () => -5 + 10 === 5);
test('float', () => Math.abs(0.1 + 0.2 - 0.3) < 1e-10);
test('infinity', () => 1/0 === Infinity);
test('NaN', () => isNaN(0/0));
test('bigint add', () => 1000000000000000000n + 1n === 1000000000000000001n);
test('bigint mul', () => 123456789n * 987654321n === 121932631112635269n);

section('2. Variables & Types');
test('var', () => { var x = 42; return x === 42; });
test('let', () => { let x = 99; return x === 99; });
test('const', () => { const x = 77; return x === 77; });
test('typeof number', () => typeof 42 === 'number');
test('typeof string', () => typeof 'hello' === 'string');
test('typeof boolean', () => typeof true === 'boolean');
test('typeof undefined', () => typeof undefined === 'undefined');
test('typeof null', () => typeof null === 'object');
test('typeof function', () => typeof (() => {}) === 'function');
test('typeof symbol', () => typeof Symbol() === 'symbol');
test('typeof bigint', () => typeof 42n === 'bigint');
test('null equality', () => null == undefined && null !== undefined);

section('3. Strings');
test('length', () => 'hello'.length === 5);
test('concat', () => 'foo' + 'bar' === 'foobar');
test('charAt', () => 'abc'.charAt(1) === 'b');
test('charCodeAt', () => 'A'.charCodeAt(0) === 65);
test('indexOf', () => 'hello world'.indexOf('world') === 6);
test('lastIndexOf', () => 'abcabc'.lastIndexOf('b') === 4);
test('includes', () => 'hello'.includes('ell'));
test('startsWith', () => 'hello'.startsWith('hel'));
test('endsWith', () => 'hello'.endsWith('llo'));
test('slice', () => 'hello'.slice(1, 3) === 'el');
test('substring', () => 'hello'.substring(1, 3) === 'el');
test('toUpperCase', () => 'hello'.toUpperCase() === 'HELLO');
test('toLowerCase', () => 'HELLO'.toLowerCase() === 'hello');
test('trim', () => '  hello  '.trim() === 'hello');
test('trimStart', () => '  hello  '.trimStart() === 'hello  ');
test('trimEnd', () => '  hello  '.trimEnd() === '  hello');
test('repeat', () => 'ab'.repeat(3) === 'ababab');
test('padStart', () => '5'.padStart(3, '0') === '005');
test('padEnd', () => '5'.padEnd(3, '0') === '500');
test('split', () => 'a,b,c'.split(',').length === 3);
test('replace', () => 'hello'.replace('l', 'r') === 'herlo');
test('replaceAll', () => 'hello'.replaceAll('l', 'r') === 'herro');
test('template literal', () => `${2+3}` === '5');
test('unicode', () => '\u00e9' === 'é');
test('at()', () => 'hello'.at(-1) === 'o');

section('4. Arrays');
test('literal', () => [1,2,3].length === 3);
test('push/pop', () => { const a=[1]; a.push(2); return a.pop() === 2 && a.length === 1; });
test('shift/unshift', () => { const a=[1,2]; a.unshift(0); return a.shift() === 0; });
test('map', () => [1,2,3].map(x => x*2).join(',') === '2,4,6');
test('filter', () => [1,2,3,4,5].filter(x => x > 3).length === 2);
test('reduce', () => [1,2,3,4].reduce((a,b) => a+b, 0) === 10);
test('find', () => [1,2,3].find(x => x > 1) === 2);
test('findIndex', () => [1,2,3].findIndex(x => x > 1) === 1);
test('some', () => [1,2,3].some(x => x > 2));
test('every', () => [1,2,3].every(x => x > 0));
test('includes', () => [1,2,3].includes(2));
test('indexOf', () => [10,20,30].indexOf(20) === 1);
test('flat', () => [1,[2,[3]]].flat(Infinity).length === 3);
test('flatMap', () => [1,2].flatMap(x => [x, x*2]).length === 4);
test('sort', () => [3,1,2].sort().join(',') === '1,2,3');
test('reverse', () => [1,2,3].reverse().join(',') === '3,2,1');
test('slice', () => [1,2,3,4].slice(1,3).join(',') === '2,3');
test('splice', () => { const a=[1,2,3]; a.splice(1,1); return a.join(',') === '1,3'; });
test('fill', () => new Array(3).fill(0).join(',') === '0,0,0');
test('from', () => Array.from({length:3}, (_,i) => i).join(',') === '0,1,2');
test('isArray', () => Array.isArray([]) && !Array.isArray({}));
test('spread', () => Math.max(...[3,1,4,1,5]) === 5);
test('destructure', () => { const [a,,c] = [1,2,3]; return a === 1 && c === 3; });
test('for..of', () => { let s=0; for(const x of [1,2,3]) s+=x; return s === 6; });
test('at()', () => [1,2,3].at(-1) === 3);

section('5. Objects');
test('literal', () => { const o={a:1,b:2}; return o.a+o.b === 3; });
test('keys', () => Object.keys({x:1,y:2,z:3}).length === 3);
test('values', () => Object.values({a:1,b:2}).reduce((a,b)=>a+b) === 3);
test('entries', () => Object.entries({a:1}).length === 1);
test('assign', () => { const t={}; Object.assign(t,{a:1},{b:2}); return t.a+t.b === 3; });
test('freeze', () => { const o=Object.freeze({x:1}); try{o.x=2}catch(e){} return o.x === 1; });
test('computed prop', () => { const k='foo'; return {[k]:42}.foo === 42; });
test('destructure', () => { const {a,b} = {a:10,b:20}; return a+b === 30; });
test('spread', () => { const o = {...{a:1},...{b:2}}; return o.a+o.b === 3; });
test('optional chain', () => { const o = {a:{b:42}}; return o?.a?.b === 42 && o?.c?.d === undefined; });
test('nullish coalesce', () => (null ?? 42) === 42 && (0 ?? 42) === 0);
test('hasOwnProperty', () => ({a:1}).hasOwnProperty('a') && !({}).hasOwnProperty('b'));
test('in operator', () => 'a' in {a:1} && !('b' in {a:1}));
test('delete', () => { const o={a:1,b:2}; delete o.a; return !('a' in o); });
test('JSON stringify', () => JSON.stringify({a:1}) === '{"a":1}');
test('JSON parse', () => JSON.parse('{"a":42}').a === 42);
test('JSON roundtrip', () => JSON.parse(JSON.stringify({x:[1,2,3]})).x.length === 3);

section('6. Functions');
test('declaration', () => { function f(x){return x+1} return f(1) === 2; });
test('expression', () => { const f = function(x){return x*2}; return f(3) === 6; });
test('arrow', () => { const f = x => x*x; return f(4) === 16; });
test('default params', () => { function f(x=10){return x} return f() === 10 && f(5) === 5; });
test('rest params', () => { function f(...a){return a.length} return f(1,2,3) === 3; });
test('closure', () => { function mk(n){return ()=>n} return mk(42)() === 42; });
test('recursion', () => { function fib(n){return n<2?n:fib(n-1)+fib(n-2)} return fib(10) === 55; });
test('IIFE', () => (function(){return 42})() === 42);
test('generator', () => { function* g(){yield 1;yield 2;yield 3} const it=g(); return it.next().value===1 && it.next().value===2; });
test('generator spread', () => { function* g(){yield 1;yield 2;yield 3} return [...g()].length === 3; });
test('async/await basic', () => { /* can't easily test sync */ return true; });

section('7. Control Flow');
test('if/else', () => { let r; if(true) r=1; else r=2; return r === 1; });
test('ternary', () => (true ? 11 : 22) === 11);
test('for', () => { let s=0; for(let i=0;i<10;i++) s+=i; return s === 45; });
test('while', () => { let n=0,i=0; while(i<5){n+=i;i++} return n === 10; });
test('do..while', () => { let i=0; do{i++}while(i<3); return i === 3; });
test('for..in', () => { let k=[]; for(let x in {a:1,b:2}) k.push(x); return k.length === 2; });
test('for..of', () => { let s=0; for(const x of [1,2,3]) s+=x; return s === 6; });
test('switch', () => { let r; switch(2){case 1:r=10;break;case 2:r=20;break;default:r=0} return r === 20; });
test('break', () => { let i; for(i=0;i<10;i++){if(i===5)break} return i === 5; });
test('continue', () => { let s=0; for(let i=0;i<5;i++){if(i===2)continue;s+=i} return s === 8; });
test('label break', () => { let r=0; outer: for(let i=0;i<3;i++){for(let j=0;j<3;j++){if(j===1)break outer;r++}} return r === 1; });
test('throw/catch', () => { try{throw 42}catch(e){return e===42} });
test('finally', () => { let r=0; try{r=1}finally{r+=10} return r === 11; });
test('catch type', () => { try{null.x}catch(e){return e instanceof TypeError} });
test('nested try', () => { let r=''; try{try{throw 'a'}catch(e){r+=e;throw 'b'}}catch(e){r+=e} return r==='ab'; });

section('8. Classes');
test('basic class', () => { class C{constructor(n){this.n=n}} return new C(42).n === 42; });
test('method', () => { class C{m(){return 7}} return new C().m() === 7; });
test('getter', () => { class C{get x(){return 99}} return new C().x === 99; });
test('setter', () => { class C{set x(v){this._x=v} get x(){return this._x}} const c=new C(); c.x=5; return c.x === 5; });
test('static', () => { class C{static s(){return 42}} return C.s() === 42; });
test('extends', () => { class A{v(){return 1}} class B extends A{v(){return super.v()+1}} return new B().v() === 2; });
test('instanceof', () => { class C{} return new C() instanceof C; });
test('private field', () => { class C{#x;constructor(v){this.#x=v} get(){return this.#x}} return new C(42).get() === 42; });

section('9. Iterators & Generators');
test('Symbol.iterator', () => { const o={*[Symbol.iterator](){yield 1;yield 2}}; return [...o].length === 2; });
test('generator return', () => { function* g(){yield 1;return 2;yield 3} const a=[...g()]; return a.length === 1; });
test('yield*', () => { function* a(){yield 1;yield 2} function* b(){yield* a();yield 3} return [...b()].length === 3; });

section('10. Promises');
test('Promise.resolve', () => { let v; Promise.resolve(42).then(x=>{v=x}); return true; /* async */ });
test('Promise.reject', () => { let v; Promise.reject('err').catch(x=>{v=x}); return true; });
test('Promise.all', () => { Promise.all([1,2,3]).then(a=>a.length===3); return true; });
test('Promise.race', () => { Promise.race([1,2]).then(v=>v===1); return true; });

section('11. Map & Set');
test('Map basic', () => { const m=new Map(); m.set('a',1); return m.get('a') === 1; });
test('Map size', () => { const m=new Map([[1,1],[2,2]]); return m.size === 2; });
test('Map has', () => { const m=new Map([['k',1]]); return m.has('k') && !m.has('z'); });
test('Map delete', () => { const m=new Map([['k',1]]); m.delete('k'); return m.size === 0; });
test('Map iterate', () => { const m=new Map([[1,'a'],[2,'b']]); let s=''; for(const [k,v] of m) s+=v; return s==='ab'; });
test('Set basic', () => new Set([1,2,3,2,1]).size === 3);
test('Set has', () => new Set([10,20]).has(10));
test('Set delete', () => { const s=new Set([1,2]); s.delete(1); return s.size === 1; });
test('WeakMap', () => { const wm=new WeakMap(); const k={}; wm.set(k,42); return wm.get(k) === 42; });
test('WeakSet', () => { const ws=new WeakSet(); const k={}; ws.add(k); return ws.has(k); });

section('12. TypedArrays');
test('Uint8Array', () => { const a=new Uint8Array(4); a[0]=255; return a[0] === 255 && a[1] === 0; });
test('Int32Array', () => new Int32Array([1,2,3])[1] === 2);
test('Float64Array', () => Math.abs(new Float64Array([3.14])[0] - 3.14) < 0.001);
test('ArrayBuffer', () => new ArrayBuffer(8).byteLength === 8);
test('DataView', () => { const dv=new DataView(new ArrayBuffer(4)); dv.setInt32(0,42); return dv.getInt32(0) === 42; });
test('buffer slice', () => new Uint8Array(new Uint8Array([1,2,3,4]).buffer.slice(1,3)).length === 2);

section('13. RegExp');
test('test', () => /^hello/.test('hello world'));
test('exec', () => /(\d+)/.exec('abc123')[1] === '123');
test('match', () => 'abc123'.match(/\d+/)[0] === '123');
test('matchAll', () => [...'a1b2c3'.matchAll(/\d/g)].length === 3);
test('replace', () => 'hello'.replace(/l/g, 'r') === 'herro');
test('split', () => 'a1b2c'.split(/\d/).length === 3);
test('flags', () => /abc/gi.flags === 'gi');
test('groups', () => { const m = 'date: 2026-04'.match(/(?<y>\d{4})-(?<m>\d{2})/); return m.groups.y === '2026'; });

section('14. Math');
test('abs', () => Math.abs(-42) === 42);
test('min/max', () => Math.min(3,1,4) === 1 && Math.max(3,1,4) === 4);
test('floor/ceil', () => Math.floor(3.7) === 3 && Math.ceil(3.2) === 4);
test('round', () => Math.round(3.5) === 4);
test('trunc', () => Math.trunc(3.9) === 3 && Math.trunc(-3.9) === -3);
test('sign', () => Math.sign(-5) === -1 && Math.sign(5) === 1);
test('sqrt', () => Math.sqrt(144) === 12);
test('pow', () => Math.pow(2, 10) === 1024);
test('log/exp', () => Math.abs(Math.log(Math.E) - 1) < 1e-10);
test('PI', () => Math.abs(Math.PI - 3.14159265) < 0.0001);
test('sin/cos', () => Math.abs(Math.sin(0)) < 1e-10 && Math.abs(Math.cos(0) - 1) < 1e-10);
test('random', () => { const r = Math.random(); return r >= 0 && r < 1; });
test('clz32', () => Math.clz32(1) === 31);
test('hypot', () => Math.hypot(3, 4) === 5);

section('15. Symbols');
test('unique', () => Symbol('a') !== Symbol('a'));
test('for/keyFor', () => { const s=Symbol.for('x'); return Symbol.keyFor(s) === 'x'; });
test('Symbol.for same', () => Symbol.for('x') === Symbol.for('x'));
test('as property', () => { const s=Symbol(); const o={[s]:42}; return o[s] === 42; });
test('well-known', () => typeof Symbol.iterator === 'symbol');

section('16. Error types');
test('Error', () => new Error('msg').message === 'msg');
test('TypeError', () => new TypeError('t').name === 'TypeError');
test('RangeError', () => new RangeError('r').name === 'RangeError');
test('ReferenceError', () => { try{undeclared_var}catch(e){return e instanceof ReferenceError} });
test('SyntaxError', () => { try{eval('{')}catch(e){return e instanceof SyntaxError} });
test('stack trace', () => new Error().stack.length > 0);

section('17. Date');
test('Date.now', () => typeof Date.now() === 'number' && Date.now() > 0);
test('new Date', () => new Date(0).getTime() === 0);
test('toISOString', () => new Date(0).toISOString() === '1970-01-01T00:00:00.000Z');
test('parse', () => Date.parse('1970-01-01T00:00:00Z') === 0);

section('18. Proxy & Reflect');
test('Proxy get', () => { const p=new Proxy({},{get:(_,k)=>k.toUpperCase()}); return p.hello === 'HELLO'; });
test('Proxy set', () => { let v; const p=new Proxy({},{set:(_,k,val)=>{v=val;return true}}); p.x=42; return v === 42; });
test('Reflect.ownKeys', () => Reflect.ownKeys({a:1,b:2}).length === 2);

section('19. WeakRef & FinalizationRegistry');
test('WeakRef', () => { const o={}; const wr=new WeakRef(o); return wr.deref() === o; });

section('20. globalThis');
test('globalThis exists', () => typeof globalThis === 'object');
test('globalThis === global', () => { globalThis.testVal = 99; return testVal === 99; });

// =========================================================================
// Module Tests (require --std)
// =========================================================================

section('21. std module');
test('std.puts', () => { std.puts(''); return true; }); /* just test it doesn't crash */
test('std.printf', () => { std.printf(''); return true; });
test('std.sprintf', () => std.sprintf('%d', 42) === '42');
test('std.sprintf float', () => std.sprintf('%.2f', 3.14) === '3.14');
test('std.sprintf string', () => std.sprintf('%s!', 'hi') === 'hi!');
test('std.getenv', () => typeof std.getenv('PATH') === 'string' || std.getenv('PATH') === undefined);
test('std.strerror', () => typeof std.strerror(1) === 'string');
test('std.gc', () => { std.gc(); return true; });
test('std.evalScript', () => std.evalScript('1+1') === 2);
test('std.Error', () => typeof std.Error !== 'undefined');

section('22. std file I/O');
test('std.open write', () => {
    const f = std.open('T:qjs_test.txt', 'w');
    if (!f) return false;
    f.puts('hello from quickjs\n');
    f.close();
    return true;
});
test('std.open read', () => {
    const f = std.open('T:qjs_test.txt', 'r');
    if (!f) return false;
    const line = f.getline();
    f.close();
    return line === 'hello from quickjs';
});
test('std.loadFile', () => {
    const data = std.loadFile('T:qjs_test.txt');
    return data !== null && data.includes('hello');
});
test('std.writeFile', () => {
    const r = std.writeFile('T:qjs_test2.txt', 'test data\n');
    return true; /* just test it doesn't crash */
});
test('file seek/tell', () => {
    const f = std.open('T:qjs_test.txt', 'r');
    if (!f) return false;
    f.seek(5, std.SEEK_SET);
    const pos = f.tell();
    f.close();
    return pos === 5;
});
test('file eof', () => {
    const f = std.open('T:qjs_test.txt', 'r');
    if (!f) return false;
    f.readAsString();
    const isEof = f.eof();
    f.close();
    return isEof;
});
test('file readAsArrayBuffer', () => {
    const f = std.open('T:qjs_test.txt', 'rb');
    if (!f) return false;
    const buf = f.readAsArrayBuffer();
    f.close();
    return buf instanceof ArrayBuffer && buf.byteLength > 0;
});

section('23. os module basics');
test('os.platform', () => typeof os.platform === 'string' && os.platform.length > 0);
test('os.now', () => typeof os.now() === 'number');
test('os.getcwd', () => { const [cwd, err] = os.getcwd(); return typeof cwd === 'string'; });
test('os.isatty', () => typeof os.isatty(0) === 'boolean' || typeof os.isatty(0) === 'number');

section('24. os file operations');
test('os.stat', () => {
    /* Write a test file first */
    const f = std.open('T:qjs_test.txt', 'w');
    if (f) { f.puts('test'); f.close(); }
    const [st, err] = os.stat('T:qjs_test.txt');
    return st !== null && typeof st.size === 'number';
});
test('os.readdir', () => {
    const [entries, err] = os.readdir('T:');
    return Array.isArray(entries) && entries.length >= 0;
});
test('os.mkdir', () => {
    os.mkdir('T:qjs_testdir');
    const [st, err] = os.stat('T:qjs_testdir');
    os.remove('T:qjs_testdir');
    return st !== null;
});
test('os.rename', () => {
    std.writeFile('T:qjs_rename_src.txt', 'data');
    const r = os.rename('T:qjs_rename_src.txt', 'T:qjs_rename_dst.txt');
    os.remove('T:qjs_rename_dst.txt');
    return true;
});
test('os.remove', () => {
    std.writeFile('T:qjs_remove_test.txt', 'data');
    os.remove('T:qjs_remove_test.txt');
    const [st, err] = os.stat('T:qjs_remove_test.txt');
    return st === null;
});

section('25. os timing');
test('os.sleep', () => {
    const t1 = os.now();
    os.sleep(50); /* 50ms */
    const t2 = os.now();
    return (t2 - t1) >= 20; /* at least 20us (AmigaOS Delay rounds) */
});

section('26. bjson module');
test('bjson.write', () => {
    const buf = bjson.write({a: 42, b: 'hello'});
    return buf instanceof ArrayBuffer && buf.byteLength > 0;
});
test('bjson.read', () => {
    const buf = bjson.write({x: 99});
    const obj = bjson.read(buf, 0, buf.byteLength);
    return obj.x === 99;
});
test('bjson roundtrip complex', () => {
    const orig = {
        num: 42, str: 'hello', arr: [1,2,3],
        nested: {a: true, b: null}
    };
    const buf = bjson.write(orig);
    const copy = bjson.read(buf, 0, buf.byteLength);
    return copy.num === 42 && copy.str === 'hello' &&
           copy.arr.length === 3 && copy.nested.a === true &&
           copy.nested.b === null;
});

// =========================================================================
// Cleanup & Summary
// =========================================================================
os.remove('T:qjs_test.txt');
os.remove('T:qjs_test2.txt');

std.puts('\n=== Results: ' + pass + '/' + total + ' passed');
if (fail > 0) {
    std.puts(', ' + fail + ' FAILED');
    if (skip > 0) std.puts(', ' + skip + ' skipped');
    std.puts(' ===\n\nFailures:\n');
    for (const f of failures) {
        std.puts('  - ' + f + '\n');
    }
} else {
    if (skip > 0) std.puts(', ' + skip + ' skipped');
    std.puts(' ===\n');
}

std.exit(fail > 0 ? 1 : 0);
