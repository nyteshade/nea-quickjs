/* Which extended.js features a script has caused to be applied. */
function applied() { return qjs.modules.list().filter((m) => m.applied).map((m) => m.name).join(' ') || '(none)'; }
print('start:', applied());
print('hello'.length);
print('print only:', applied());
const u = new URL('http://example.org/a?b=1');
print('URL:', u.searchParams.get('b'), '|', applied());
print('path:', path.join('Work:', 'x', 'y'), '|', applied());
print('require amiga:', typeof require('amiga').call, '|', applied());
print('process:', typeof process.stdout, typeof process.argv, '|', applied());
globalThis.assert = 5;
print('override:', assert, typeof Buffer.from, assert);
print('mem:', process.memoryUsage().engine.mallocSize > 0);
