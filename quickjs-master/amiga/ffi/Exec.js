/* quickjs-master/amiga/ffi/Exec.js
 *
 * Wrapper for exec.library. ROM-resident; always available.
 *
 * Pilot scope: ~30 LVO methods covering memory, message ports,
 * signals, library/device opens, and IO-request basics. The full
 * FFI table at amiga.exec.lvo has all 115; users who want the rest
 * can call them via amiga.call directly until generated.
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';

/**
 * Wrapper for exec.library — memory, tasks, signals, message ports,
 * library/device management.
 */
export class Exec extends LibraryBase {
  /** @type {string} */
  static libraryName    = 'exec.library';

  /** @type {number} */
  static libraryVersion = 0;

  /** @type {Object<string, number>} */
  static lvo            = globalThis.amiga.exec.lvo;

  /**
   * Memory flags for AllocMem/AllocVec. Cases coerce to their
   * numeric value via Symbol.toPrimitive.
   *
   * @example
   * Exec.AllocMem(64,
   *   Exec.consts.MEMF_PUBLIC | Exec.consts.MEMF_CLEAR);
   */
  static consts = class ExecConsts extends CEnumeration {
    static {
      ExecConsts.define('MEMF_ANY',        0x00000000);
      ExecConsts.define('MEMF_PUBLIC',     0x00000001);
      ExecConsts.define('MEMF_CHIP',       0x00000002);
      ExecConsts.define('MEMF_FAST',       0x00000004);
      ExecConsts.define('MEMF_LOCAL',      0x00000100);
      ExecConsts.define('MEMF_24BITDMA',   0x00000200);
      ExecConsts.define('MEMF_KICK',       0x00000400);
      ExecConsts.define('MEMF_CLEAR',      0x00010000);
      ExecConsts.define('MEMF_LARGEST',    0x00020000);
      ExecConsts.define('MEMF_REVERSE',    0x00080000);
      ExecConsts.define('MEMF_TOTAL',      0x00040000);
      ExecConsts.define('MEMF_NO_EXPUNGE', 0x80000000);
    }
  };

  /** @returns {number} library base, or 0 on failure */
  static OpenLibrary(name, version) {
    return globalThis.amiga.openLibrary(name, version | 0);
  }

  /** @param {number} lib library base */
  static CloseLibrary(lib) {
    return globalThis.amiga.closeLibrary(ptrOf(lib));
  }

  /** AllocMem(size, requirements) — d0=size, d1=requirements */
  static AllocMem(size, flags) {
    return this.call(this.lvo.AllocMem,
      { d0: size | 0, d1: flags | 0 });
  }

  /** FreeMem(memoryBlock, size) — a1=memoryBlock, d0=size */
  static FreeMem(ptr, size) {
    return this.call(this.lvo.FreeMem,
      { a1: ptrOf(ptr), d0: size | 0 });
  }

  /** AllocVec(size, requirements) — d0=size, d1=requirements */
  static AllocVec(size, flags) {
    return this.call(this.lvo.AllocVec,
      { d0: size | 0, d1: flags | 0 });
  }

  /** FreeVec(memoryBlock) — a1=memoryBlock */
  static FreeVec(ptr) {
    return this.call(this.lvo.FreeVec, { a1: ptrOf(ptr) });
  }

  /** FindTask(name) — a1=name (NULL = current task). Returns task ptr. */
  static FindTask(name) {
    return this.call(this.lvo.FindTask, { a1: ptrOf(name) });
  }

  /** Wait(signalSet) — d0=signalSet. Returns received signals. */
  static Wait(sigMask) {
    return this.call(this.lvo.Wait, { d0: sigMask | 0 });
  }

  /** Signal(task, signals) — a1=task, d0=signals */
  static Signal(task, sigs) {
    return this.call(this.lvo.Signal,
      { a1: ptrOf(task), d0: sigs | 0 });
  }

  /** AllocSignal(signalNum) — d0=signalNum (-1 for any). Returns bit#. */
  static AllocSignal(num) {
    return this.call(this.lvo.AllocSignal, { d0: num | 0 });
  }

  /** FreeSignal(signalNum) — d0=signalNum */
  static FreeSignal(num) {
    return this.call(this.lvo.FreeSignal, { d0: num | 0 });
  }

  /** GetMsg(port) — a0=port. Returns message ptr or 0. */
  static GetMsg(port) {
    return this.call(this.lvo.GetMsg, { a0: ptrOf(port) });
  }

  /** PutMsg(port, message) — a0=port, a1=message */
  static PutMsg(port, msg) {
    return this.call(this.lvo.PutMsg,
      { a0: ptrOf(port), a1: ptrOf(msg) });
  }

  /** ReplyMsg(message) — a1=message */
  static ReplyMsg(msg) {
    return this.call(this.lvo.ReplyMsg, { a1: ptrOf(msg) });
  }

  /** WaitPort(port) — a0=port. Returns first message ptr (no remove). */
  static WaitPort(port) {
    return this.call(this.lvo.WaitPort, { a0: ptrOf(port) });
  }

  /** CreateMsgPort() — no args. Returns MsgPort* or 0. */
  static CreateMsgPort() {
    return this.call(this.lvo.CreateMsgPort, {});
  }

  /** DeleteMsgPort(port) — a0=port */
  static DeleteMsgPort(port) {
    return this.call(this.lvo.DeleteMsgPort, { a0: ptrOf(port) });
  }

  /** Forbid() — disable task switching */
  static Forbid()  { return this.call(this.lvo.Forbid,  {}); }

  /** Permit() — re-enable task switching */
  static Permit()  { return this.call(this.lvo.Permit,  {}); }

  /** Disable() — disable interrupts. PAIR with Enable(). */
  static Disable() { return this.call(this.lvo.Disable, {}); }

  /** Enable()  — re-enable interrupts */
  static Enable()  { return this.call(this.lvo.Enable,  {}); }

  /** OpenDevice(name, unit, ioRequest, flags) — a0/d0/a1/d1 */
  static OpenDevice(name, unit, ioRequest, flags) {
    return this.call(this.lvo.OpenDevice, {
      a0: ptrOf(name), d0: unit | 0,
      a1: ptrOf(ioRequest), d1: flags | 0,
    });
  }

  /** CloseDevice(ioRequest) — a1=ioRequest */
  static CloseDevice(ioReq) {
    return this.call(this.lvo.CloseDevice, { a1: ptrOf(ioReq) });
  }

  /** DoIO(ioRequest) — a1=ioRequest. Returns io_Error. */
  static DoIO(ioReq) {
    return this.call(this.lvo.DoIO, { a1: ptrOf(ioReq) });
  }

  /** SendIO(ioRequest) — a1=ioRequest */
  static SendIO(ioReq) {
    return this.call(this.lvo.SendIO, { a1: ptrOf(ioReq) });
  }

  /** CheckIO(ioRequest) — a1=ioRequest. Returns ptr if done, 0 if pending. */
  static CheckIO(ioReq) {
    return this.call(this.lvo.CheckIO, { a1: ptrOf(ioReq) });
  }

  /** WaitIO(ioRequest) — a1=ioRequest. Returns io_Error. */
  static WaitIO(ioReq) {
    return this.call(this.lvo.WaitIO, { a1: ptrOf(ioReq) });
  }

  /** AbortIO(ioRequest) — a1=ioRequest */
  static AbortIO(ioReq) {
    return this.call(this.lvo.AbortIO, { a1: ptrOf(ioReq) });
  }

  /** CopyMem(source, dest, size) — a0/a1/d0 */
  static CopyMem(src, dst, size) {
    return this.call(this.lvo.CopyMem, {
      a0: ptrOf(src), a1: ptrOf(dst), d0: size | 0,
    });
  }

  /** AvailMem(requirements) — d1=requirements */
  static AvailMem(flags) {
    return this.call(this.lvo.AvailMem, { d1: flags | 0 });
  }
}
