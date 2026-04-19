import { Enumeration } from '../../../quickjs-master/amiga/extended/vendor/ne-enumeration/enumeration.mjs';

class Color extends Enumeration {
  static {
    Color.define('RED', 1);
    Color.define('GREEN', 2);
    Color.define('BLUE', 3);
  }
}

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log('PASS', m); }
  else   { fail++; console.log('FAIL', m); }
}

ok(Color.from('RED') === Color.RED,     'lookup by key');
ok(Color.from(2) === Color.GREEN,       'lookup by value (number)');
ok(Color.from('GREEN') === Color.GREEN, 'lookup by key wins over value');
ok(Color.from('NOPE') === null,         'unknown returns null');
ok(Color.from(99) === null,             'unknown value returns null');

console.log(`Results: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
