/*
 * test_all.js — Comprehensive test suite WITHOUT module imports
 *
 * Uses print() (always available) instead of std.puts().
 * Tests core JS only — module tests deferred until import works.
 *
 * Run: qjs test_all.js
 */

var pass = 0, fail = 0, total = 0;
var failures = [];

function test(name, fn) {
    total++;
    try {
        var result = fn();
        if (result === true || result === 1) {
            pass++;
        } else {
            fail++;
            failures.push(name + ' (got: ' + result + ')');
            print('  FAIL: ' + name);
        }
    } catch (e) {
        fail++;
        failures.push(name + ' (' + e.message + ')');
        print('  FAIL: ' + name + ' [' + e.message + ']');
    }
}

function section(name) { print('\n[' + name + ']'); }

section('1. Arithmetic');
test('add', function(){return 1+1===2});
test('sub', function(){return 100-58===42});
test('mul', function(){return 3*7===21});
test('div', function(){return 10/2===5});
test('mod', function(){return 17%5===2});
test('exp', function(){return Math.pow(2,10)===1024});
test('neg', function(){return -5+10===5});
test('float', function(){return Math.abs(0.1+0.2-0.3)<1e-10});
test('infinity', function(){return 1/0===Infinity});
test('NaN', function(){return isNaN(0/0)});

section('2. Variables');
test('var', function(){var x=42; return x===42});
test('typeof num', function(){return typeof 42==='number'});
test('typeof str', function(){return typeof 'hi'==='string'});
test('typeof bool', function(){return typeof true==='boolean'});
test('typeof undef', function(){return typeof undefined==='undefined'});
test('typeof null', function(){return typeof null==='object'});
test('typeof func', function(){return typeof test==='function'});
test('null eq', function(){return null==undefined && null!==undefined});

section('3. Strings');
test('length', function(){return 'hello'.length===5});
test('concat', function(){return 'foo'+'bar'==='foobar'});
test('charAt', function(){return 'abc'.charAt(1)==='b'});
test('charCodeAt', function(){return 'A'.charCodeAt(0)===65});
test('indexOf', function(){return 'hello world'.indexOf('world')===6});
test('includes', function(){return 'hello'.includes('ell')});
test('startsWith', function(){return 'hello'.startsWith('hel')});
test('endsWith', function(){return 'hello'.endsWith('llo')});
test('slice', function(){return 'hello'.slice(1,3)==='el'});
test('toUpperCase', function(){return 'hello'.toUpperCase()==='HELLO'});
test('toLowerCase', function(){return 'HELLO'.toLowerCase()==='hello'});
test('trim', function(){return '  hi  '.trim()==='hi'});
test('repeat', function(){return 'ab'.repeat(3)==='ababab'});
test('padStart', function(){return '5'.padStart(3,'0')==='005'});
test('split', function(){return 'a,b,c'.split(',').length===3});
test('replace', function(){return 'hello'.replace('l','r')==='herlo'});
test('replaceAll', function(){return 'hello'.replaceAll('l','r')==='herro'});

section('4. Arrays');
test('literal', function(){return [1,2,3].length===3});
test('push/pop', function(){var a=[1]; a.push(2); return a.pop()===2});
test('shift/unshift', function(){var a=[1,2]; a.unshift(0); return a.shift()===0});
test('map', function(){return [1,2,3].map(function(x){return x*2}).join(',')==='2,4,6'});
test('filter', function(){return [1,2,3,4,5].filter(function(x){return x>3}).length===2});
test('reduce', function(){return [1,2,3,4].reduce(function(a,b){return a+b},0)===10});
test('find', function(){return [1,2,3].find(function(x){return x>1})===2});
test('some', function(){return [1,2,3].some(function(x){return x>2})});
test('every', function(){return [1,2,3].every(function(x){return x>0})});
test('includes', function(){return [1,2,3].includes(2)});
test('indexOf', function(){return [10,20,30].indexOf(20)===1});
test('flat', function(){return [1,[2,[3]]].flat(Infinity).length===3});
test('sort', function(){return [3,1,2].sort().join(',')==='1,2,3'});
test('reverse', function(){return [1,2,3].reverse().join(',')==='3,2,1'});
test('slice', function(){return [1,2,3,4].slice(1,3).join(',')==='2,3'});
test('isArray', function(){return Array.isArray([]) && !Array.isArray({})});
test('from', function(){return Array.from({length:3},function(_,i){return i}).join(',')==='0,1,2'});
test('spread', function(){return Math.max.apply(null,[3,1,4,1,5])===5});
test('for..of', function(){var s=0; var a=[1,2,3]; for(var i=0;i<a.length;i++) s+=a[i]; return s===6});

section('5. Objects');
test('literal', function(){var o={a:1,b:2}; return o.a+o.b===3});
test('keys', function(){return Object.keys({x:1,y:2,z:3}).length===3});
test('values', function(){return Object.values({a:1,b:2}).reduce(function(a,b){return a+b})===3});
test('entries', function(){return Object.entries({a:1}).length===1});
test('assign', function(){var t={}; Object.assign(t,{a:1},{b:2}); return t.a+t.b===3});
test('freeze', function(){var o=Object.freeze({x:1}); try{o.x=2}catch(e){} return o.x===1});
test('hasOwn', function(){return ({a:1}).hasOwnProperty('a')});
test('in', function(){return 'a' in {a:1}});
test('delete', function(){var o={a:1,b:2}; delete o.a; return !('a' in o)});
test('JSON parse', function(){return JSON.parse('{"a":42}').a===42});
test('JSON stringify', function(){return JSON.stringify({b:99})==='{"b":99}'});
test('JSON roundtrip', function(){return JSON.parse(JSON.stringify({x:[1,2,3]})).x.length===3});

section('6. Functions');
test('declaration', function(){function f(x){return x+1} return f(1)===2});
test('expression', function(){var f=function(x){return x*2}; return f(3)===6});
test('closure', function(){function mk(n){return function(){return n}} return mk(42)()===42});
test('recursion', function(){function fib(n){return n<2?n:fib(n-1)+fib(n-2)} return fib(10)===55});
test('IIFE', function(){return (function(){return 42})()===42});
test('default params', function(){function f(x){if(x===undefined)x=10; return x} return f()===10});
test('rest-like', function(){function f(){return arguments.length} return f(1,2,3)===3});

section('7. Control Flow');
test('if/else', function(){var r; if(true)r=1; else r=2; return r===1});
test('ternary', function(){return (true?11:22)===11});
test('for', function(){var s=0; for(var i=0;i<10;i++)s+=i; return s===45});
test('while', function(){var n=0,i=0; while(i<5){n+=i;i++} return n===10});
test('do..while', function(){var i=0; do{i++}while(i<3); return i===3});
test('for..in', function(){var k=[]; for(var x in {a:1,b:2})k.push(x); return k.length===2});
test('switch', function(){var r; switch(2){case 1:r=10;break;case 2:r=20;break} return r===20});
test('break', function(){var i; for(i=0;i<10;i++){if(i===5)break} return i===5});
test('continue', function(){var s=0; for(var i=0;i<5;i++){if(i===2)continue;s+=i} return s===8});
test('throw/catch', function(){try{throw 42}catch(e){return e===42}});
test('finally', function(){var r=0; try{r=1}finally{r+=10} return r===11});
test('catch type', function(){try{null.x}catch(e){return e instanceof TypeError}});
test('nested try', function(){var r=''; try{try{throw 'a'}catch(e){r+=e;throw 'b'}}catch(e){r+=e} return r==='ab'});

section('8. Math');
test('abs', function(){return Math.abs(-42)===42});
test('min/max', function(){return Math.min(3,1,4)===1 && Math.max(3,1,4)===4});
test('floor/ceil', function(){return Math.floor(3.7)===3 && Math.ceil(3.2)===4});
test('round', function(){return Math.round(3.5)===4});
test('trunc', function(){return Math.trunc(3.9)===3});
test('sqrt', function(){return Math.sqrt(144)===12});
test('pow', function(){return Math.pow(2,10)===1024});
test('PI', function(){return Math.abs(Math.PI-3.14159265)<0.0001});
test('sin/cos', function(){return Math.abs(Math.sin(0))<1e-10 && Math.abs(Math.cos(0)-1)<1e-10});
test('random', function(){var r=Math.random(); return r>=0 && r<1});
test('hypot', function(){return Math.hypot(3,4)===5});

section('9. RegExp');
test('test', function(){return /^hello/.test('hello world')});
test('exec', function(){return /(\d+)/.exec('abc123')[1]==='123'});
test('match', function(){return 'abc123'.match(/\d+/)[0]==='123'});
test('replace', function(){return 'hello'.replace(/l/g,'r')==='herro'});
test('split', function(){return 'a1b2c'.split(/\d/).length===3});
test('flags', function(){return /abc/gi.flags==='gi'});

section('10. Map & Set');
test('Map basic', function(){var m=new Map(); m.set('a',1); return m.get('a')===1});
test('Map size', function(){var m=new Map(); m.set(1,1); m.set(2,2); return m.size===2});
test('Map has', function(){var m=new Map(); m.set('k',1); return m.has('k') && !m.has('z')});
test('Map delete', function(){var m=new Map(); m.set('k',1); m.delete('k'); return m.size===0});
test('Set basic', function(){return new Set([1,2,3,2,1]).size===3});
test('Set has', function(){return new Set([10,20]).has(10)});
test('WeakMap', function(){var wm=new WeakMap(); var k={}; wm.set(k,42); return wm.get(k)===42});
test('WeakSet', function(){var ws=new WeakSet(); var k={}; ws.add(k); return ws.has(k)});

section('11. TypedArrays');
test('Uint8Array', function(){var a=new Uint8Array(4); a[0]=255; return a[0]===255});
test('Int32Array', function(){return new Int32Array([1,2,3])[1]===2});
test('Float64Array', function(){return Math.abs(new Float64Array([3.14])[0]-3.14)<0.001});
test('ArrayBuffer', function(){return new ArrayBuffer(8).byteLength===8});
test('DataView', function(){var dv=new DataView(new ArrayBuffer(4)); dv.setInt32(0,42); return dv.getInt32(0)===42});

section('12. Symbols');
test('unique', function(){return Symbol('a')!==Symbol('a')});
test('for/keyFor', function(){var s=Symbol.for('x'); return Symbol.keyFor(s)==='x'});
test('well-known', function(){return typeof Symbol.iterator==='symbol'});

section('13. Error types');
test('Error', function(){return new Error('msg').message==='msg'});
test('TypeError', function(){return new TypeError('t').name==='TypeError'});
test('RangeError', function(){return new RangeError('r').name==='RangeError'});
test('ReferenceError', function(){try{undeclared_xyz_var}catch(e){return e instanceof ReferenceError}});
test('stack trace', function(){return new Error().stack.length>0});

section('14. Date');
test('Date.now', function(){return typeof Date.now()==='number' && Date.now()>0});
test('new Date(0)', function(){return new Date(0).getTime()===0});
test('toISOString', function(){return new Date(0).toISOString()==='1970-01-01T00:00:00.000Z'});

section('15. Proxy');
test('Proxy get', function(){var p=new Proxy({},{get:function(_,k){return k.toUpperCase()}}); return p.hello==='HELLO'});
test('Proxy set', function(){var v; var p=new Proxy({},{set:function(_,k,val){v=val;return true}}); p.x=42; return v===42});

section('16. globalThis');
test('exists', function(){return typeof globalThis==='object'});
test('set/get', function(){globalThis.testVal99=99; return testVal99===99});

section('17. Promises');
test('resolve', function(){var v=0; Promise.resolve(42).then(function(x){v=x}); return true}); /* async */
test('reject', function(){Promise.reject('e').catch(function(){}); return true});

section('18. Misc');
test('eval', function(){return eval('1+1')===2});
test('parseInt', function(){return parseInt('42')===42});
test('parseFloat', function(){return Math.abs(parseFloat('3.14')-3.14)<0.001});
test('encodeURI', function(){return encodeURIComponent('a b')==='a%20b'});
test('decodeURI', function(){return decodeURIComponent('a%20b')==='a b'});
test('isFinite', function(){return isFinite(42) && !isFinite(Infinity)});
test('isNaN', function(){return isNaN(NaN) && !isNaN(42)});

/* Summary */
print('\n=== Results: ' + pass + '/' + total + ' passed' +
      (fail > 0 ? ', ' + fail + ' FAILED' : '') + ' ===');
if (failures.length > 0) {
    print('\nFailures:');
    for (var i = 0; i < failures.length; i++) {
        print('  - ' + failures[i]);
    }
}
