/* quickjs-master/amiga/ffi/structs/RastPort.js
 *
 * Wraps a struct RastPort pointer. Exposes drawing methods that
 * delegate to Graphics.* — instances are typically obtained via
 * Window.rastPort, never allocated by user code.
 */

import { Struct } from './Struct.js';

export class RastPort extends Struct {
  /* SIZE not exposed — RastPort is allocated by Intuition. */

  /**
   * REPL help text — a human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `RastPort(ptr)
where:
  ptr - REQUIRED: an existing struct RastPort pointer. Typically
        obtained as win.rastPort from a Window wrapper. You cannot
        allocate a RastPort from scratch via this wrapper.

Instance methods (delegate to graphics.library):
  setColor(pen)              - SetAPen
  setBgColor(pen)            - SetBPen
  move(x, y)                 - Move (no drawing)
  draw(x, y)                 - Draw line from cursor to (x,y)
  rectFill(x1, y1, x2, y2)   - RectFill with A-pen
  text(x, y, str)            - Move + render JS string (allocates
                               and frees C-string internally)`;
  }

  /**
   * Set foreground pen.
   *
   * @param {number} pen
   * @returns {undefined}
   */
  setColor(pen) {
    globalThis.amiga.Graphics.SetAPen(this, pen);
  }

  /**
   * Set background pen.
   *
   * @param {number} pen
   */
  setBgColor(pen) {
    globalThis.amiga.Graphics.SetBPen(this, pen);
  }

  /**
   * Position the graphics cursor.
   *
   * @param {number} x
   * @param {number} y
   */
  move(x, y) {
    globalThis.amiga.Graphics.Move(this, x, y);
  }

  /**
   * Draw a line from the cursor to (x,y).
   *
   * @param {number} x
   * @param {number} y
   */
  draw(x, y) {
    globalThis.amiga.Graphics.Draw(this, x, y);
  }

  /**
   * Draw a filled rectangle.
   *
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  rectFill(x1, y1, x2, y2) {
    globalThis.amiga.Graphics.RectFill(this, x1, y1, x2, y2);
  }

  /**
   * Move + render a string. Allocates + frees the C string internally.
   *
   * @param {number} x
   * @param {number} y
   * @param {string} str
   */
  text(x, y, str) {
    let bytes = str.length + 1;
    let p = globalThis.amiga.allocMem(bytes);

    if (!p) {
      return;
    }

    try {
      globalThis.amiga.pokeString(p, str);
      this.move(x, y);
      globalThis.amiga.Graphics.Text(this, p, str.length);
    }

    finally {
      globalThis.amiga.freeMem(p, bytes);
    }
  }
}
