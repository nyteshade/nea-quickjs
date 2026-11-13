/* quickjs-master/amiga/ffi/boopsi/gadgets/texteditor/ARexxCmdMessage.js
 *
 * struct GP_TEXTEDITOR_ARexxCmd (gadgets/texteditor.h): the message
 * TextEditor sends for GM_TEXTEDITOR_ARexxCmd.
 *
 * A new one is zero-filled. GInfo is left that way on purpose: the
 * message goes through Intuition.DoGadgetMethodA(), which fills it in.
 */

import { Struct } from '../../../structs/Struct.js';

export class ARexxCmdMessage extends Struct {
  /* check-structs: struct GP_TEXTEDITOR_ARexxCmd */
  /**
   * Byte offsets of the message's fields, named as in
   * gadgets/texteditor.h. Checked against the compiler's own layout
   * of the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    MethodID: 0,
    GInfo:    4,
    command:  8,
  });

  /** @type {number} */
  static SIZE = 12;

  /** @param {number} id - TextEditor.METHOD.ARexxCmd */
  set methodID(id) { this.write32(ARexxCmdMessage.OFFSET.MethodID, id); }

  /** @param {number} value - the command, as a C string pointer */
  set command(value) { this.write32(ARexxCmdMessage.OFFSET.command, value); }
}
