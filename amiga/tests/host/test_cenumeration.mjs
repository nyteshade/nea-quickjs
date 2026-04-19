import { Enumeration } from '../../../quickjs-master/amiga/extended/vendor/ne-enumeration/enumeration.mjs';
import { CEnumeration } from '../../../quickjs-master/amiga/ffi/CEnumeration.js';

class IDCMP extends CEnumeration {
  static {
    IDCMP.define('CLOSEWINDOW', 0x200);
    IDCMP.define('GADGETUP',    { cName: 'IDCMP_GADGETUP', value: 0x40 });
  }
}

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log('PASS', m); }
  else   { fail++; console.log('FAIL', m); }
}

ok(IDCMP.CLOSEWINDOW.valueOf() === 0x200, 'primitive valueOf');
ok(IDCMP.GADGETUP.valueOf() === 0x40,     'structured valueOf drills');
ok(Number(IDCMP.GADGETUP) === 0x40,       'Symbol.toPrimitive number drills');
ok(`${IDCMP.GADGETUP}` === 'GADGETUP',    'Symbol.toPrimitive string returns key');

ok(IDCMP.from(0x200) === IDCMP.CLOSEWINDOW,           'from(value) primitive');
ok(IDCMP.from(0x40) === IDCMP.GADGETUP,               'from(value) drills structured value field');
ok(IDCMP.from('IDCMP_GADGETUP') === IDCMP.GADGETUP,   'from(cName) matches structured field');
ok(IDCMP.from('CLOSEWINDOW') === IDCMP.CLOSEWINDOW,   'from(key) inherited');
ok(IDCMP.from('NOPE') === null,                       'unknown returns null');

console.log(`Results: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
