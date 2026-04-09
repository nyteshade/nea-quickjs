/* test_core.js — Core JS tests without module imports
 * Run with: qjs -e "var r=std.loadFile('test_core.js');std.evalScript(r)"
 * Or just: qjs --std test_core.js (once module loading works)
 *
 * For now, use individual -e tests:
 *   qjs -e "print(1+1)"
 *   qjs -e "print(3*7)"
 *   qjs -e "print('hello ' + 'world')"
 *   etc.
 */

/* Since we can't import modules, use print() which is set up by add_helpers */

var pass = 0, fail = 0, total = 0;

function test(name, result) {
    total++;
    if (result === true) {
        pass++;
    } else {
        fail++;
        print('  FAIL: ' + name);
    }
}

print('=== Core JS Tests ===');

/* Arithmetic */
test('1+1', 1+1 === 2);
test('3*7', 3*7 === 21);
test('2**10', Math.pow(2,10) === 1024);
test('modulo', 17 % 5 === 2);

/* Strings */
test('string length', 'hello'.length === 5);
test('concat', 'foo' + 'bar' === 'foobar');
test('charAt', 'abc'.charAt(1) === 'b');
test('indexOf', 'hello world'.indexOf('world') === 6);
test('toUpperCase', 'hello'.toUpperCase() === 'HELLO');
test('split', 'a,b,c'.split(',').length === 3);
test('replace', 'hello'.replace('l', 'r') === 'herlo');
test('template', (function(){var x=42; return ''+x})() === '42');

/* Arrays */
test('array length', [1,2,3].length === 3);
test('push', (function(){var a=[]; a.push(1); a.push(2); return a.length})() === 2);
test('map', [1,2,3].map(function(x){return x*2}).join(',') === '2,4,6');
test('filter', [1,2,3,4,5].filter(function(x){return x>3}).length === 2);
test('reduce', [1,2,3,4].reduce(function(a,b){return a+b}, 0) === 10);
test('sort', [3,1,2].sort().join(',') === '1,2,3');

/* Objects */
test('object', (function(){var o={a:1,b:2}; return o.a+o.b})() === 3);
test('keys', Object.keys({x:1,y:2,z:3}).length === 3);
test('JSON parse', JSON.parse('{"a":42}').a === 42);
test('JSON stringify', JSON.stringify({b:99}) === '{"b":99}');

/* Functions */
test('function', (function(){function f(x){return x+1} return f(1)})() === 2);
test('arrow', (function(){var f=function(x){return x*x}; return f(4)})() === 16);
test('closure', (function(){function mk(n){return function(){return n}} return mk(42)()})() === 42);
test('recursion', (function(){function fib(n){return n<2?n:fib(n-1)+fib(n-2)} return fib(10)})() === 55);

/* Control flow */
test('for loop', (function(){var s=0; for(var i=0;i<10;i++) s+=i; return s})() === 45);
test('while', (function(){var n=0,i=0; while(i<5){n+=i;i++} return n})() === 10);
test('try/catch', (function(){try{throw 42}catch(e){return e}})() === 42);

/* Math */
test('Math.abs', Math.abs(-42) === 42);
test('Math.min', Math.min(3,1,4) === 1);
test('Math.max', Math.max(3,1,4) === 4);
test('Math.floor', Math.floor(3.7) === 3);
test('Math.sqrt', Math.sqrt(144) === 12);

/* RegExp */
test('regex test', /^hello/.test('hello world'));
test('regex match', 'abc123'.match(/\d+/)[0] === '123');

/* Map & Set */
test('Map', (function(){var m=new Map(); m.set('a',1); return m.get('a')})() === 1);
test('Set', new Set([1,2,3,2,1]).size === 3);

/* TypedArrays */
test('Uint8Array', (function(){var a=new Uint8Array(4); a[0]=255; return a[0]})() === 255);
test('ArrayBuffer', new ArrayBuffer(8).byteLength === 8);

/* Classes */
test('class', (function(){function C(n){this.n=n} return new C(42).n})() === 42);

/* Date */
test('Date.now', typeof Date.now() === 'number');

/* globalThis */
test('globalThis', typeof globalThis === 'object');

print('\n=== Results: ' + pass + '/' + total + ' passed' + (fail > 0 ? ', ' + fail + ' FAILED' : '') + ' ===');
