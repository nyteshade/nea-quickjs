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
  static consts = CEnumeration.lazy('ExecConsts', {
    /* consts-begin - written by scripts/gen_consts.py from the NDK headers; do not edit */
    /* Memory flags for AllocMem / AllocVec (exec/memory.h) */
    MEMF_ANY:        0,
    MEMF_PUBLIC:     1,   /* 1UL<<0 */
    MEMF_CHIP:       2,   /* 1UL<<1 */
    MEMF_FAST:       4,   /* 1UL<<2 */
    MEMF_LOCAL:      0x0100,   /* 1UL<<8 */
    MEMF_24BITDMA:   0x0200,   /* 1UL<<9 */
    MEMF_KICK:       0x0400,   /* 1UL<<10 */
    MEMF_CLEAR:      0x00010000,   /* 1UL<<16 */
    MEMF_LARGEST:    0x00020000,   /* 1UL<<17 */
    MEMF_REVERSE:    0x00040000,   /* 1UL<<18 */
    MEMF_TOTAL:      0x00080000,   /* 1UL<<19 */
    MEMF_NO_EXPUNGE: 0x80000000,   /* 1UL<<31 */

    /* Break signals: add to an Exec.Wait mask so Ctrl-C ends the wait (dos/dos.h) */
    SIGBREAKF_CTRL_C: 0x1000,   /* 1<<SIGBREAKB_CTRL_C */
    SIGBREAKF_CTRL_D: 0x2000,   /* 1<<SIGBREAKB_CTRL_D */
    SIGBREAKF_CTRL_E: 0x4000,   /* 1<<SIGBREAKB_CTRL_E */
    SIGBREAKF_CTRL_F: 0x8000,   /* (long)1<<SIGBREAKB_CTRL_F */

    /* Node types (exec/nodes.h) */
    NT_UNKNOWN:      0,
    NT_TASK:         1,
    NT_INTERRUPT:    2,
    NT_DEVICE:       3,
    NT_MSGPORT:      4,
    NT_MESSAGE:      5,
    NT_FREEMSG:      6,
    NT_REPLYMSG:     7,
    NT_RESOURCE:     8,
    NT_LIBRARY:      9,
    NT_MEMORY:       10,
    NT_SOFTINT:      11,
    NT_FONT:         12,
    NT_PROCESS:      13,
    NT_SEMAPHORE:    14,
    NT_SIGNALSEM:    15,
    NT_BOOTNODE:     16,
    NT_KICKMEM:      17,
    NT_GRAPHICS:     18,
    NT_DEATHMESSAGE: 19,
    NT_USER:         254,
    NT_EXTENDED:     255,

    /* Message port actions (exec/ports.h) */
    PA_SIGNAL:  0,
    PA_SOFTINT: 1,
    PA_IGNORE:  2,

    /* Device commands and flags (exec/io.h) */
    CMD_INVALID: 0,
    CMD_RESET:   1,
    CMD_READ:    2,
    CMD_WRITE:   3,
    CMD_UPDATE:  4,
    CMD_CLEAR:   5,
    CMD_STOP:    6,
    CMD_START:   7,
    CMD_FLUSH:   8,
    CMD_NONSTD:  9,
    IOF_QUICK:   1,   /* 1<<0 */

    /* Device errors: IORequest.error (exec/errors.h) */
    IOERR_OPENFAIL:   -1,
    IOERR_ABORTED:    -2,
    IOERR_NOCMD:      -3,
    IOERR_BADLENGTH:  -4,
    IOERR_BADADDRESS: -5,
    IOERR_UNITBUSY:   -6,
    IOERR_SELFTEST:   -7,
    /* consts-end */
  });

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

  /**
   * Run `fn` with `name` as a C string pointer. A JS string is copied
   * into a temporary NUL-terminated buffer that is freed afterwards;
   * a number, struct or null goes through ptrOf unchanged.
   *
   * ptrOf alone must not be used for names: it turns a JS string into
   * 0, so the OS call receives a NULL name. (OpenDevice and FindTask
   * did exactly that until 0.215.)
   *
   * @param {string|number|null} name
   * @param {(namePtr: number) => *} fn
   * @returns {*} whatever fn returns
   * @throws {Error} if the temporary buffer cannot be allocated
   */
  static _withName(name, fn) {
    if (typeof name !== 'string') return fn(ptrOf(name));

    /* exec reads the name during the call and keeps no pointer to it. */
    return globalThis.amiga.withString(name, fn);
  }

  /**
   * FindTask(name) — a1=name (null = the current task).
   *
   * @param {string|number|null} name
   * @returns {number} task pointer, 0 if there is no task of that name
   */
  static FindTask(name) {
    return this._withName(name, (namePtr) =>
      this.call(this.lvo.FindTask, { a1: namePtr }));
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

  /**
   * OpenDevice(name, unit, ioRequest, flags) — a0/d0/a1/d1.
   *
   * @param {string|number} name - e.g. 'timer.device'
   * @param {number} unit
   * @param {IORequest|number} ioRequest
   * @param {number} flags
   * @returns {number} 0 on success, otherwise an IOERR_ code. The
   *   result is the low byte of d0, sign-extended, as exec defines it.
   */
  static OpenDevice(name, unit, ioRequest, flags) {
    let result = this._withName(name, (namePtr) =>
      this.call(this.lvo.OpenDevice, {
        a0: namePtr, d0: unit | 0,
        a1: ptrOf(ioRequest), d1: flags | 0,
      }));

    return (result << 24) >> 24;
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
