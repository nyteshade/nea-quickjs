/* Mock amiga.* before importing LibraryBase. */
let openedNames = [];
let closedBases = [];
let callLog = [];

globalThis.amiga = {
  openLibrary(name, version) {
    openedNames.push({ name, version });
    return name === 'fail.library' ? 0 : 0x1000 + openedNames.length;
  },
  closeLibrary(base) { closedBases.push(base); },
  call(base, lvo, regs) { callLog.push({ base, lvo, regs }); return 42; },
};

const { LibraryBase } = await import(
  '../../../quickjs-master/amiga/ffi/LibraryBase.js'
);

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log('PASS', m); }
  else   { fail++; console.log('FAIL', m); }
}

class TestLib extends LibraryBase {
  static libraryName = 'test.library';
  static libraryVersion = 39;
  static lvo = { Foo: -42 };

  static Foo() {
    return this.call(this.lvo.Foo, { d0: 7 });
  }
}

let result = TestLib.Foo();
ok(result === 42,                          'method delegates to amiga.call');
ok(openedNames.length === 1,               'first call opens library');
ok(openedNames[0].name === 'test.library', 'opened correct name');
ok(openedNames[0].version === 39,          'opened correct version');
ok(TestLib.libraryBase === 0x1001,         'libraryBase cached');

TestLib.Foo();
ok(openedNames.length === 1, 'second call uses cached base');

TestLib.closeLibrary();
ok(closedBases.length === 1,    'closeLibrary releases base');
ok(TestLib.libraryBase === 0,   'libraryBase cleared after close');

class FailLib extends LibraryBase {
  static libraryName = 'fail.library';
  static libraryVersion = 0;
  static lvo = { X: -6 };

  static X() { return this.call(this.lvo.X, {}); }
}

let threw = false;
try { FailLib.X(); } catch (e) { threw = true; }
ok(threw, 'failed open throws Error');

LibraryBase.closeAll();
ok(closedBases.length === 1, 'closeAll skips already-closed lib');

console.log(`Results: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
