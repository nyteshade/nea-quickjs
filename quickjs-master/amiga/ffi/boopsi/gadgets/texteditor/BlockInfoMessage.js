/* quickjs-master/amiga/ffi/boopsi/gadgets/texteditor/BlockInfoMessage.js
 *
 * struct GP_TEXTEDITOR_BlockInfo (gadgets/texteditor.h): the message
 * TextEditor sends for GM_TEXTEDITOR_BlockInfo.
 *
 * A new one is zero-filled. GInfo is left that way on purpose: the
 * message goes through Intuition.DoGadgetMethodA(), which fills it in.
 */

import { Struct } from '../../../structs/Struct.js';

export class BlockInfoMessage extends Struct {
  /* check-structs: struct GP_TEXTEDITOR_BlockInfo */
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
    startx:   8,
    starty:   12,
    stopx:    16,
    stopy:    20,
  });

  /** @type {number} */
  static SIZE = 24;

  /** @param {number} id - TextEditor.METHOD.BlockInfo */
  set methodID(id) { this.write32(BlockInfoMessage.OFFSET.MethodID, id); }

  /** @param {number} value - where to store the start column: a ULONG pointer */
  set startX(value) { this.write32(BlockInfoMessage.OFFSET.startx, value); }

  /** @param {number} value - where to store the start line: a ULONG pointer */
  set startY(value) { this.write32(BlockInfoMessage.OFFSET.starty, value); }

  /** @param {number} value - where to store the end column: a ULONG pointer */
  set stopX(value) { this.write32(BlockInfoMessage.OFFSET.stopx, value); }

  /** @param {number} value - where to store the end line: a ULONG pointer */
  set stopY(value) { this.write32(BlockInfoMessage.OFFSET.stopy, value); }
}
