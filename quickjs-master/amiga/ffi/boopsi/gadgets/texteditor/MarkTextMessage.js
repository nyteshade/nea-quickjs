/* quickjs-master/amiga/ffi/boopsi/gadgets/texteditor/MarkTextMessage.js
 *
 * struct GP_TEXTEDITOR_MarkText (gadgets/texteditor.h): the message
 * TextEditor sends for GM_TEXTEDITOR_MarkText.
 *
 * A new one is zero-filled. GInfo is left that way on purpose: the
 * message goes through Intuition.DoGadgetMethodA(), which fills it in.
 */

import { Struct } from '../../../structs/Struct.js';

export class MarkTextMessage extends Struct {
  /* check-structs: struct GP_TEXTEDITOR_MarkText */
  /**
   * Byte offsets of the message's fields, named as in
   * gadgets/texteditor.h. Checked against the compiler's own layout
   * of the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    MethodID:     0,
    GInfo:        4,
    start_crsr_x: 8,
    start_crsr_y: 12,
    stop_crsr_x:  16,
    stop_crsr_y:  20,
  });

  /** @type {number} */
  static SIZE = 24;

  /** @param {number} id - TextEditor.METHOD.MarkText */
  set methodID(id) { this.write32(MarkTextMessage.OFFSET.MethodID, id); }

  /** @param {number} value - column where the block starts */
  set startX(value) { this.write32(MarkTextMessage.OFFSET.start_crsr_x, value); }

  /** @param {number} value - line where the block starts */
  set startY(value) { this.write32(MarkTextMessage.OFFSET.start_crsr_y, value); }

  /** @param {number} value - column where the block ends */
  set stopX(value) { this.write32(MarkTextMessage.OFFSET.stop_crsr_x, value); }

  /** @param {number} value - line where the block ends */
  set stopY(value) { this.write32(MarkTextMessage.OFFSET.stop_crsr_y, value); }
}
