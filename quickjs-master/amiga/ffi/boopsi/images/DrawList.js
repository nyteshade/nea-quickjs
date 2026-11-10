/* quickjs-master/amiga/ffi/boopsi/images/DrawList.js
 *
 * drawlist.image - a scalable vector glyph. The image is described by
 * an array of drawing directives on an imaginary RefWidth x RefHeight
 * grid; the class scales them to whatever size it is asked to render.
 * glyph.image is built on this class. Extends imageclass.
 *
 * Tag and directive values derived from NDK3.2R4
 * Include_H/images/drawlist.h:
 *   DRAWLIST_Dummy = REACTION_Dummy + 0x17000 = 0x85017000
 *   DRAWLIST_Directives/RefHeight/RefWidth = +1/+2/+3
 * FD/drawlist_lib.fd has DRAWLIST_GetClass at -30, so the default
 * class lookup applies.
 */

import { ImageBase, IMAGE_ATTRS } from '../ImageBase.js';

/** @internal DRAWLIST_* tag IDs (images/drawlist.h). */
const DRAWLIST = Object.freeze({
  Directives: 0x85017001,  /* (struct DrawList *) directive array */
  RefHeight:  0x85017002,  /* (WORD) grid height                  */
  RefWidth:   0x85017003,  /* (WORD) grid width                   */
});

/**
 * DLST_* directive codes (images/drawlist.h). The unsupported ones
 * (BEVELBOX, ARC, START/BOUNDS) are left out.
 *
 * @readonly
 * @enum {number}
 */
export const DrawOp = Object.freeze({
  END:      0,   /* DLST_END      - terminates the list              */
  LINE:     1,   /* DLST_LINE     - line x1,y1 to x2,y2              */
  RECT:     2,   /* DLST_RECT     - RectFill x1,y1,x2,y2             */
  FILL:     3,   /* DLST_FILL     - Flood                            */
  ELLIPSE:  4,   /* DLST_ELLIPSE  - AreaEllipse (correct from V47)   */
  CIRCLE:   5,   /* DLST_CIRCLE   - AreaCircle (correct from V47)    */
  LINEPAT:  6,   /* DLST_LINEPAT  - line pattern in the pen field    */
  FILLPAT:  7,   /* DLST_FILLPAT  - fill pattern in the pen field    */
  AMOVE:    8,   /* DLST_AMOVE    - AreaMove x1,y1                   */
  ADRAW:    9,   /* DLST_ADRAW    - AreaDraw x1,y1                   */
  AFILL:    10,  /* DLST_AFILL    - AreaEnd: fill the outline so far */
  LINESIZE: 14,  /* DLST_LINESIZE - line thickness in the pen field  */
});

/** @internal sizeof(struct DrawList): WORD, UWORD x4, WORD. */
const DRAWLIST_ENTRY_BYTES = 12;

/**
 * drawlist.image - scalable vector glyph.
 *
 * @extends ImageBase
 */
export class DrawList extends ImageBase {
  /** @type {string} */
  static _classLibName = 'images/drawlist.image';

  /** @type {Object<string, {tagID: number, type: string}>} */
  static ATTRS = {
    ...IMAGE_ATTRS,
    /** Pointer to the struct DrawList array. Pass a JS array to the
     *  constructor instead and it is built and owned for you. */
    directives: { tagID: DRAWLIST.Directives, type: 'ptr' },
    /** Height of the grid the directive coordinates are written on. */
    refHeight:  { tagID: DRAWLIST.RefHeight,  type: 'int32' },
    /** Width of the grid the directive coordinates are written on. */
    refWidth:   { tagID: DRAWLIST.RefWidth,   type: 'int32' },
  };

  /**
   * Pack directives into a struct DrawList array. A DLST_END entry is
   * appended, so callers never write the terminator themselves.
   *
   * @param {Array<Array<number>>} list - entries of
   *   [op, x1, y1, x2, y2, pen]; trailing fields may be omitted and
   *   default to 0, except pen which defaults to 1
   * @returns {{ptr: number, size: number}} allocated block; the caller
   *   owns it and must freeMem(ptr, size)
   */
  static packDirectives(list) {
    let size = (list.length + 1) * DRAWLIST_ENTRY_BYTES;
    let ptr = globalThis.amiga.allocMem(size);
    if (!ptr) throw new Error('DrawList: allocMem failed for directives');

    for (let i = 0; i <= list.length; i++) {
      let d = (i < list.length) ? list[i] : [DrawOp.END, 0, 0, 0, 0, 0];
      let at = ptr + i * DRAWLIST_ENTRY_BYTES;
      globalThis.amiga.poke16(at + 0,  d[0] | 0);
      globalThis.amiga.poke16(at + 2,  d[1] | 0);
      globalThis.amiga.poke16(at + 4,  d[2] | 0);
      globalThis.amiga.poke16(at + 6,  d[3] | 0);
      globalThis.amiga.poke16(at + 8,  d[4] | 0);
      globalThis.amiga.poke16(at + 10, (d[5] === undefined) ? 1 : (d[5] | 0));
    }
    return { ptr, size };
  }

  /**
   * @param {object|number} init - init object, or a raw pointer to wrap
   * @param {Array<Array<number>>|number} [init.directives] - JS array
   *   of [op, x1, y1, x2, y2, pen] entries (packed and owned by this
   *   object), or a pointer to a caller-owned struct DrawList array
   * @param {number} [init.refWidth] - grid width
   * @param {number} [init.refHeight] - grid height
   */
  constructor(init) {
    let block = null;
    let clean = init;

    if (init && typeof init === 'object' && Array.isArray(init.directives)) {
      block = DrawList.packDirectives(init.directives);
      clean = { ...init, directives: block.ptr };
    }

    try {
      super(clean);
    }
    catch (e) {
      if (block) globalThis.amiga.freeMem(block.ptr, block.size);
      throw e;
    }

    /* The class keeps the pointer, not a copy: the array must live as
     * long as the image. Freed with the wrapper's other owned memory. */
    if (block) this._ownedStrings.push(block);
  }
}
