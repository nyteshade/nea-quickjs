import { ptrOf } from '../../../quickjs-master/amiga/ffi/ptrOf.js';

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log('PASS', m); }
  else   { fail++; console.log('FAIL', m); }
}

ok(ptrOf(null) === 0,                 'null -> 0');
ok(ptrOf(undefined) === 0,            'undefined -> 0');
ok(ptrOf(0) === 0,                    '0 -> 0');
ok(ptrOf(0x1234) === 0x1234,          'number passthrough');
ok(ptrOf({ ptr: 0x5678 }) === 0x5678, 'object with .ptr unwraps');
ok(ptrOf({ ptr: 0 }) === 0,           'object with .ptr=0');
ok(ptrOf('not a pointer') === 0,      'non-numeric string -> 0 (NaN | 0)');

console.log(`Results: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
