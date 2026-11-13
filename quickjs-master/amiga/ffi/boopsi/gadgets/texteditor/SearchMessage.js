/* quickjs-master/amiga/ffi/boopsi/gadgets/texteditor/SearchMessage.js
 *
 * struct GP_TEXTEDITOR_Search (gadgets/texteditor.h): the message
 * TextEditor sends for GM_TEXTEDITOR_Search.
 *
 * A new one is zero-filled. GInfo is left that way on purpose: the
 * message goes through Intuition.DoGadgetMethodA(), which fills it in.
 */

import { Struct } from '../../../structs/Struct.js';

export class SearchMessage extends Struct {
  /* check-structs: struct GP_TEXTEDITOR_Search */
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
    string:   8,
    flags:    12,
  });

  /** @type {number} */
  static SIZE = 16;

  /** @param {number} id - TextEditor.METHOD.Search */
  set methodID(id) { this.write32(SearchMessage.OFFSET.MethodID, id); }

  /** @param {number} value - the text to find, as a C string pointer */
  set string(value) { this.write32(SearchMessage.OFFSET.string, value); }

  /** @param {number} value - TextEditor.SearchFlags.* bits */
  set flags(value) { this.write32(SearchMessage.OFFSET.flags, value); }
}
