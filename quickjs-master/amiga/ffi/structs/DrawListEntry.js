/* quickjs-master/amiga/ffi/structs/DrawListEntry.js
 *
 * struct DrawList (images/drawlist.h): ONE directive of the array a
 * drawlist.image is given in DRAWLIST_Directives. The header calls the
 * element "DrawList"; the wrapper is named for what it is, an entry,
 * and the BOOPSI class that draws the array keeps the name DrawList.
 *
 * The bundle keeps this class private (it is not a global);
 * DrawList.packDirectives uses it.
 */

import { Struct } from './Struct.js';

export class DrawListEntry extends Struct {
  /* check-structs: struct DrawList */
  /**
   * Byte offsets of the fields, named as in images/drawlist.h.
   * Checked against the compiler's own layout of the struct by
   * scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    dl_Directive: 0,
    dl_X1:        2,
    dl_Y1:        4,
    dl_X2:        6,
    dl_Y2:        8,
    dl_Pen:       10,
  });

  /** @type {number} */
  static SIZE = 12;

  /** @param {number} value - a DLST_* directive (DrawOp.*) */
  set directive(value) { this.write16(DrawListEntry.OFFSET.dl_Directive, value); }

  /** @param {number} value - first x, on the reference grid */
  set x1(value) { this.write16(DrawListEntry.OFFSET.dl_X1, value); }

  /** @param {number} value - first y, on the reference grid */
  set y1(value) { this.write16(DrawListEntry.OFFSET.dl_Y1, value); }

  /** @param {number} value - second x, on the reference grid */
  set x2(value) { this.write16(DrawListEntry.OFFSET.dl_X2, value); }

  /** @param {number} value - second y, on the reference grid */
  set y2(value) { this.write16(DrawListEntry.OFFSET.dl_Y2, value); }

  /** @param {number} value - the pen to draw with */
  set pen(value) { this.write16(DrawListEntry.OFFSET.dl_Pen, value); }
}
