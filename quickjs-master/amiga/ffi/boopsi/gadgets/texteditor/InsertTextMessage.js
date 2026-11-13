/* quickjs-master/amiga/ffi/boopsi/gadgets/texteditor/InsertTextMessage.js
 *
 * struct GP_TEXTEDITOR_InsertText (gadgets/texteditor.h): the message
 * TextEditor sends for GM_TEXTEDITOR_InsertText.
 *
 * A new one is zero-filled. GInfo is left that way on purpose: the
 * message goes through Intuition.DoGadgetMethodA(), which fills it in.
 */

import { Struct } from '../../../structs/Struct.js';

export class InsertTextMessage extends Struct {
  /* check-structs: struct GP_TEXTEDITOR_InsertText */
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
    text:     8,
    pos:      12,
  });

  /** @type {number} */
  static SIZE = 16;

  /** @param {number} id - TextEditor.METHOD.InsertText */
  set methodID(id) { this.write32(InsertTextMessage.OFFSET.MethodID, id); }

  /** @param {number} value - the text to insert, as a C string pointer */
  set text(value) { this.write32(InsertTextMessage.OFFSET.text, value); }

  /** @param {number} value - TextEditor.InsertPos.*: where to insert */
  set pos(value) { this.write32(InsertTextMessage.OFFSET.pos, value); }
}
