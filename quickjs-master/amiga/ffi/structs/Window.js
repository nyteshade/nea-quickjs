/* quickjs-master/amiga/ffi/structs/Window.js
 *
 * Wraps a struct Window pointer returned by Intuition.OpenWindow*.
 *
 * Field offsets (intuition/intuition.h, 2-byte alignment):
 *   +0   NextWindow (4)
 *   +4   LeftEdge (2), +6 TopEdge (2), +8 Width (2), +10 Height (2)
 *  +12   MouseY (2), +14 MouseX (2)
 *  +16   MinWidth, +18 MinHeight, +20 MaxWidth, +22 MaxHeight
 *  +24   Flags (4)
 *  +28   MenuStrip (4)
 *  +32   Title (STRPTR)
 *  +36   FirstRequest (4)
 *  +40   DMRequest (4)
 *  +44   ReqCount (2)
 *  +46   WScreen (Screen*, 4)
 *  +50   RPort (RastPort*, 4)
 *  +54   BorderLeft, BorderTop, BorderRight, BorderBottom (4 × BYTE)
 *  +58   BorderRPort (4)
 *  +62   FirstGadget (4)
 *  +66   Parent, +70 Descendant (4 each)
 *  +74   Pointer (4)
 *  +78   PtrHeight, PtrWidth, XOffset, YOffset (4 × BYTE)
 *  +82   IDCMPFlags (4)
 *  +86   UserPort (MsgPort*, 4)
 */

import { Struct } from './Struct.js';
import { Screen } from './Screen.js';
import { RastPort } from './RastPort.js';
import { MsgPort } from './MsgPort.js';
import { IntuiMessage } from './IntuiMessage.js';

export class Window extends Struct {
  /* SIZE not exposed — Window is allocated by Intuition. */

  /** @returns {number} */
  get leftEdge() { return this.read16(4); }

  /** @returns {number} */
  get topEdge()  { return this.read16(6); }

  /** @returns {number} */
  get width()    { return this.read16(8); }

  /** @returns {number} */
  get height()   { return this.read16(10); }

  /** @returns {string|null} */
  get title() {
    let p = this.read32(32);

    return p ? globalThis.amiga.peekString(p, 256) : null;
  }

  /** @returns {Screen|null} */
  get screen() {
    let p = this.read32(46);

    return p ? new Screen(p) : null;
  }

  /** @returns {RastPort|null} */
  get rastPort() {
    let p = this.read32(50);

    return p ? new RastPort(p) : null;
  }

  /** @returns {MsgPort|null} */
  get userPort() {
    let p = this.read32(86);

    return p ? new MsgPort(p) : null;
  }

  /**
   * Close this window. Idempotent — safe to call multiple times.
   * After: this.ptr = 0 and further methods will throw.
   *
   * @returns {undefined}
   */
  close() {
    if (!this.ptr) {
      return;
    }

    globalThis.amiga.lib.Intuition.CloseWindow(this);
    this.ptr = 0;
  }

  /**
   * Move this window by (dx, dy) on its screen.
   *
   * @param {number} dx
   * @param {number} dy
   */
  move(dx, dy) {
    return globalThis.amiga.lib.Intuition.MoveWindow(this, dx, dy);
  }

  /**
   * Bring this window to the front of its screen.
   */
  toFront() {
    return globalThis.amiga.lib.Intuition.WindowToFront(this);
  }

  /**
   * Send to the back.
   */
  toBack() {
    return globalThis.amiga.lib.Intuition.WindowToBack(this);
  }

  /**
   * Yields IntuiMessages until the window closes or the consumer
   * breaks. Each iteration:
   *   1. Wait()s on the UserPort's signal bit
   *   2. Drains all queued messages via GetMsg
   *   3. Yields each one
   *   4. Replies to the message in the iterator's finally block
   *      (so a consumer that breaks mid-loop still cleans up the
   *      most recent message)
   *
   * @example
   * for (let msg of win.messages()) {
   *   if (msg.class === Intuition.consts.IDCMP_CLOSEWINDOW) break;
   * }
   *
   * @yields {IntuiMessage}
   */
  * messages() {
    let port = this.userPort;

    if (!port) {
      return;
    }

    let sigMask = port.sigMask;
    let Exec = globalThis.amiga.lib.Exec;

    while (this.ptr) {
      Exec.Wait(sigMask);

      let raw;

      while ((raw = Exec.GetMsg(port)) !== 0) {
        let msg = new IntuiMessage(raw);

        try {
          yield msg;
        }

        finally {
          Exec.ReplyMsg(msg);
        }
      }
    }
  }
}
