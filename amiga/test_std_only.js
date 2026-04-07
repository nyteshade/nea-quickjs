/* test_std_only.js — Test ONLY std/os module operations
 * If this crashes, the bug is in std/os module handling.
 * If this works, corruption is cumulative from earlier tests.
 * Run: qjs -m test_std_only.js
 */
import * as std from 'qjs:std';
import * as os from 'qjs:os';

print('=== std/os isolation test ===');

print('1. std.puts');
std.puts('hello from std.puts\n');

print('2. std.printf');
std.printf('printf: %d\n', 42);

print('3. std.sprintf');
var s = std.sprintf('%s=%d', 'x', 99);
print('  sprintf result: ' + s);

print('4. std.getenv');
var p = std.getenv('PATH');
print('  PATH type: ' + typeof p);

print('5. std.strerror');
print('  strerror(1): ' + std.strerror(1));

print('6. std.gc');
std.gc();
print('  gc OK');

print('7. std.evalScript');
var r = std.evalScript('1+1');
print('  evalScript result: ' + r);

print('8. file write');
var f = std.open('qjs_test_io.txt', 'w');
if (f) {
    f.puts('hello from quickjs\n');
    f.close();
    print('  write OK');
} else {
    print('  FAIL: could not open for write');
}

print('9. file read');
f = std.open('qjs_test_io.txt', 'r');
if (f) {
    var line = f.getline();
    f.close();
    print('  read: ' + line);
} else {
    print('  FAIL: could not open for read');
}

print('10. os.platform');
print('  platform: ' + os.platform);

print('11. os.now');
print('  now: ' + os.now());

print('12. os.getcwd');
try {
    var cwd = os.getcwd();
    print('  cwd: ' + cwd);
} catch(e) {
    print('  getcwd error: ' + e.message);
}

print('13. cleanup');
try { os.remove('qjs_test_io.txt'); } catch(e) {}

print('=== all std/os tests passed ===');
