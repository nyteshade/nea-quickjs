/* quickjs-master/amiga/ffi/boopsi/gadgets/texteditor/ExportTextMessage.js
 *
 * struct GP_TEXTEDITOR_ExportText (gadgets/texteditor.h): the message
 * TextEditor sends for GM_TEXTEDITOR_ExportText.
 *
 * A new one is zero-filled. GInfo is left that way on purpose: the
 * message goes through Intuition.DoGadgetMethodA(), which fills it in.
 */

import { Struct } from '../../../structs/Struct.js';

export class ExportTextMessage extends Struct {
  /* check-structs: struct GP_TEXTEDITOR_ExportText */
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
  });

  /** @type {number} */
  static SIZE = 8;

  /** @param {number} id - TextEditor.METHOD.ExportText */
  set methodID(id) { this.write32(ExportTextMessage.OFFSET.MethodID, id); }
}
