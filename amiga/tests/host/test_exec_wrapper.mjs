/* Mock amiga before importing Exec — its `static lvo = ...` evaluates
 * at import time and needs amiga.exec.lvo populated. */
let callLog = [];
let openedLibs = [];

globalThis.amiga = {
  exec: {
    lvo: {
      AllocMem: -198, FreeMem: -210, FindTask: -294, Wait: -318,
      Signal: -324, AllocSignal: -330, FreeSignal: -336, GetMsg: -372,
      PutMsg: -366, ReplyMsg: -378, WaitPort: -384, CreateMsgPort: -666,
      DeleteMsgPort: -672, Forbid: -132, Permit: -138, Disable: -120,
      Enable: -126, OpenDevice: -444, CloseDevice: -450, DoIO: -456,
      SendIO: -462, CheckIO: -468, WaitIO: -474, AbortIO: -480,
      CopyMem: -624, AvailMem: -216, AllocVec: -684, FreeVec: -690,
    },
  },
  openLibrary(name, version) { openedLibs.push({name, version}); return 0xCAFE; },
  closeLibrary() {},
  call(base, lvo, regs) { callLog.push({base, lvo, regs}); return 0xBEEF; },
};

const { Exec } = await import('../../../quickjs-master/amiga/ffi/Exec.js');

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log('PASS', m); }
  else   { fail++; console.log('FAIL', m); }
}

let r = Exec.AllocMem(64,
  Exec.consts.MEMF_PUBLIC | Exec.consts.MEMF_CLEAR);
ok(callLog.length === 1, 'one call recorded');
ok(callLog[0].lvo === -198, 'AllocMem LVO is -198');
ok(callLog[0].regs.d0 === 64, 'd0 = size');
ok(callLog[0].regs.d1 === 0x10001, 'd1 = MEMF_PUBLIC|MEMF_CLEAR');
ok(r === 0xBEEF, 'returns d0 from call');

Exec.FreeMem(0x1234, 64);
ok(callLog[1].lvo === -210, 'FreeMem LVO is -210');
ok(callLog[1].regs.a1 === 0x1234, 'a1 = ptr');
ok(callLog[1].regs.d0 === 64, 'd0 = size');

Exec.FreeMem({ ptr: 0x5678 }, 16);
ok(callLog[2].regs.a1 === 0x5678, 'ptrOf unwraps {ptr}');

Exec.Wait(0x100);
ok(callLog[3].lvo === -318, 'Wait LVO');
ok(callLog[3].regs.d0 === 0x100, 'Wait d0 = mask');

Exec.Forbid();
ok(callLog[4].lvo === -132, 'Forbid LVO');
ok(Object.keys(callLog[4].regs).length === 0, 'Forbid takes no args');

ok(typeof Exec.consts.MEMF_PUBLIC.value === 'number', 'consts has MEMF_PUBLIC');
ok(Number(Exec.consts.MEMF_CLEAR) === 0x10000, 'CEnum coerces to value');

console.log(`Results: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
