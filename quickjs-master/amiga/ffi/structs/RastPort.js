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
                               and frees C-string internally)
  textWidth(str)             - pixel width of str in the current font

Properties (read-only, graphics/rastport.h):
  fontHeight    {number} rp_TxHeight, +58: pixels in one line of text
  fontBaseline  {number} rp_TxBaseline, +62: top of a line to its
                         baseline; text(x, y) puts the BASELINE at y`;
  }

  /** @returns {number} height in pixels of the current font */
  get fontHeight()   { return this.read16(58); }

  /** @returns {number} pixels from the top of a line to its baseline */
  get fontBaseline() { return this.read16(62); }

  /**
   * The width of a piece of text in this RastPort's current font.
   *
   * @param {string} str - plain ASCII / Latin-1
   * @returns {number} pixels
   */
  textWidth(str) {
    str = String(str);
    if (str.length === 0) return 0;

    return globalThis.amiga.withString(str, (pointer) =>
      globalThis.amiga.Graphics.TextLength(this, pointer, str.length));
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
    str = String(str);

    globalThis.amiga.withString(str, (pointer) => {
      this.move(x, y);
      globalThis.amiga.Graphics.Text(this, pointer, str.length);
    });
  }
}
