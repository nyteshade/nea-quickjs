/* amiga/tests/test_ffi_classes.js
 *
 * Q2 wrapper-class FFI regression test (library 0.128). Each section
 * runs in a resilient run() block (try/catch + stdout flush) so a
 * single exception doesn't truncate the rest.
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function _flush() { try { std.out.flush(); } catch (_) {} }
function ok(c, m) {
  if (c) { print('  PASS: ' + m); pass++; }
  else   { print('  FAIL: ' + m); fail++; }
  _flush();
}
function section(t) { print('\n-- ' + t + ' --'); _flush(); }
async function run(title, fn) {
  section(title);
  try { await fn(); }
  catch (e) {
    fail++;
    print('  FAIL: [section] threw: ' + (e && e.message || e));
    if (e && e.stack) {
      print('    ' + String(e.stack).split('\n').slice(0, 4).join('\n    '));
    }
    _flush();
  }
}

(async () => {

if (typeof LibraryBase !== 'function' ||
    typeof Intuition !== 'function') {
  print('FATAL: Q2 wrapper classes not installed — library < 0.128?');
  std.exit(2);
}

await run('classes present', async () => {
  ok(typeof LibraryBase === 'function',  'LibraryBase');
  ok(typeof CEnumeration === 'function', 'CEnumeration');
  ok(typeof Exec === 'function',         'Exec');
  ok(typeof Dos === 'function',          'Dos');
  ok(typeof Intuition === 'function',    'Intuition');
  ok(typeof Graphics === 'function',     'Graphics');
  ok(typeof GadTools === 'function',     'GadTools');

  ok(typeof Window === 'function',       'Window struct');
  ok(typeof NewWindow === 'function',    'NewWindow struct');
  ok(typeof Screen === 'function',       'Screen struct');
  ok(typeof IntuiMessage === 'function', 'IntuiMessage struct');
  ok(typeof RastPort === 'function',     'RastPort struct');
  ok(typeof MsgPort === 'function',      'MsgPort struct');

  /* Library wrappers — amiga.<ClassName> */
  ok(amiga.Intuition === Intuition, 'amiga.Intuition');
  ok(amiga.Exec === Exec,           'amiga.Exec');
  ok(amiga.Graphics === Graphics,   'amiga.Graphics');
  ok(amiga.GadTools === GadTools,   'amiga.GadTools');
  ok(amiga.Dos === Dos,             'amiga.Dos');

  /* Structs — amiga.<libname>.<StructName> (canonical home). */
  ok(amiga.intuition.Window === Window,           'amiga.intuition.Window');
  ok(amiga.intuition.Screen === Screen,           'amiga.intuition.Screen');
  ok(amiga.intuition.NewWindow === NewWindow,     'amiga.intuition.NewWindow');
  ok(amiga.intuition.IntuiMessage === IntuiMessage,'amiga.intuition.IntuiMessage');
  ok(amiga.intuition.Image === Image,             'amiga.intuition.Image');
  ok(amiga.intuition.Gadget === Gadget,           'amiga.intuition.Gadget');
  ok(amiga.graphics.TextAttr === TextAttr,        'amiga.graphics.TextAttr');
  ok(amiga.graphics.RastPort === RastPort,        'amiga.graphics.RastPort');
  ok(amiga.exec.MsgPort === MsgPort,              'amiga.exec.MsgPort');

  /* Flat amiga.<StructName> is intentionally not set — library
   * nesting is the canonical home for struct wrappers. */
  ok(amiga.Window === undefined,   'amiga.Window unset (nested only)');
  ok(amiga.TextAttr === undefined, 'amiga.TextAttr unset (nested only)');
  ok(amiga.MsgPort === undefined,  'amiga.MsgPort unset (nested only)');

  /* Q1 lowercase namespace still holds .lvo. */
  ok(typeof amiga.intuition.lvo === 'object', 'amiga.intuition.lvo is the Q1 table');
  ok(typeof amiga.graphics.lvo  === 'object', 'amiga.graphics.lvo is the Q1 table');

  /* Constructable structs expose a human-readable signature getter. */
  ok(typeof TextAttr.signature === 'string',     'TextAttr.signature is string');
  ok(TextAttr.signature.startsWith('TextAttr('), 'TextAttr.signature starts with "TextAttr("');
  ok(typeof NewWindow.signature === 'string',    'NewWindow.signature is string');
  ok(typeof Window.signature === 'string',       'Window.signature (wrap-only)');
  ok(typeof IntuiMessage.signature === 'string', 'IntuiMessage.signature');
});

await run('IntuiMessage.class returns CEnumeration case', async () => {
  /* Allocate a fake IntuiMessage buffer, write Class = IDCMP_CLOSEWINDOW,
   * then wrap + read via the getter. Strict === must match the case. */
  let buf = amiga.allocMem(52);
  ok(buf !== 0, 'allocMem for fake IntuiMessage');

  amiga.poke32(buf + 20, 0x200);  /* IDCMP_CLOSEWINDOW */
  let m = new IntuiMessage(buf);

  ok(m.class === Intuition.consts.IDCMP_CLOSEWINDOW,
     'msg.class === C.IDCMP_CLOSEWINDOW (strict ===)');

  ok((m.class | 0) === 0x200,
     'case coerces to raw flag via | 0');

  ok(m.classRaw === 0x200,
     'classRaw always returns raw flag');

  /* Unknown flag falls back to raw number. */
  amiga.poke32(buf + 20, 0x12345678);
  let m2 = new IntuiMessage(buf);

  ok(m2.class === 0x12345678,
     'unknown flag falls back to raw number');

  amiga.freeMem(buf, 52);
});

await run('LibraryBase lifecycle', async () => {
  let b1 = Intuition.ensureLibrary();
  ok(b1 !== 0, 'ensureLibrary returns non-zero base');

  let b2 = Intuition.ensureLibrary();
  ok(b1 === b2, 'second call returns same base');

  Intuition.closeLibrary();
  ok(Intuition.libraryBase === 0, 'closeLibrary zeros base');

  let b3 = Intuition.ensureLibrary();
  ok(b3 !== 0, 'ensureLibrary re-opens after close');
});

await run('Exec.AllocMem/FreeMem round-trip', async () => {
  let mem = Exec.AllocMem(64,
    Exec.consts.MEMF_PUBLIC | Exec.consts.MEMF_CLEAR);

  ok(mem !== 0, 'AllocMem returned non-zero');

  ok(amiga.peek8(mem) === 0, 'memory zeroed by MEMF_CLEAR');

  amiga.poke32(mem, 0xDEADBEEF);
  ok(amiga.peek32(mem) === 0xDEADBEEF, 'memory writable');

  Exec.FreeMem(mem, 64);
  ok(true, 'FreeMem returned without crash');
});

await run('CEnumeration.consts coercion + lookup', async () => {
  ok(Number(Intuition.consts.WA_Width) === 0x80000066,
     'CEnum -> number');
  ok(Number(Intuition.consts.IDCMP_CLOSEWINDOW) === 0x200,
     'IDCMP value');

  let c = Intuition.consts.from(0x200);
  ok(c === Intuition.consts.IDCMP_CLOSEWINDOW, 'from(value) lookup');

  c = Intuition.consts.from('WA_Title');
  ok(c === Intuition.consts.WA_Title, 'from(key) lookup');

  ok(Intuition.consts.from('NOPE') === null, 'unknown returns null');
});

await run('Intuition.OpenWindowTags + Window struct + close', async () => {
  let win = Intuition.OpenWindowTags([
    [Intuition.consts.WA_Left,   80],
    [Intuition.consts.WA_Top,    40],
    [Intuition.consts.WA_Width,  320],
    [Intuition.consts.WA_Height, 100],
    [Intuition.consts.WA_Flags,  Intuition.consts.WFLG_DRAGBAR
                               | Intuition.consts.WFLG_DEPTHGADGET
                               | Intuition.consts.WFLG_CLOSEGADGET
                               | Intuition.consts.WFLG_ACTIVATE],
    [Intuition.consts.WA_IDCMP,  Intuition.consts.IDCMP_CLOSEWINDOW
                               | Intuition.consts.IDCMP_MOUSEBUTTONS],
  ]);

  ok(win !== null,             'OpenWindowTags returned a Window');
  ok(win instanceof Window,    'Window instance');
  ok(win.ptr !== 0,            'win.ptr non-zero');
  ok(win.width === 320,        'win.width getter');
  ok(win.height === 100,       'win.height getter');
  ok(win.rastPort !== null,    'win.rastPort wrapper');
  ok(win.userPort !== null,    'win.userPort wrapper');
  ok(win.userPort.sigBit > 0,  'userPort.sigBit > 0');
  ok(win.userPort.sigMask === (1 << win.userPort.sigBit), 'sigMask shifts');

  win.close();
  ok(win.ptr === 0, 'win.close zeros ptr');

  win.close();
  ok(true, 'second close did not throw');
});

await run('NewWindow constructor + OpenWindow + close', async () => {
  let nw = new NewWindow({
    width: 320, height: 100,
    flags: Intuition.consts.WFLG_DRAGBAR
         | Intuition.consts.WFLG_CLOSEGADGET
         | Intuition.consts.WFLG_ACTIVATE,
    idcmp: Intuition.consts.IDCMP_CLOSEWINDOW,
    title: 'NewWindow Test',
  });

  ok(nw.ptr !== 0,        'NewWindow allocated');
  ok(nw.width === 320,    'width getter');
  ok(nw.title === 'NewWindow Test', 'title getter (round-trip)');

  let win = Intuition.OpenWindow(nw);
  ok(win !== null, 'OpenWindow with NewWindow returns Window');

  if (win) win.close();
  nw.free();
  ok(nw.ptr === 0, 'NewWindow.free zeros ptr');
});

print('');
print('=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
_flush();
if (fail > 0) std.exit(1);
})();
