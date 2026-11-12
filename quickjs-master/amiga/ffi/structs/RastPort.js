/* quickjs-master/amiga/ffi/structs/RastPort.js
 *
 * Wraps a struct RastPort pointer. Exposes drawing methods that
 * delegate to Graphics.* — instances are typically obtained via
 * Window.rastPort, never allocated by user code.
 */

import { Struct } from './Struct.js';

export class RastPort extends Struct {
  /* check-structs: struct RastPort */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * graphics/rastport.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    TxHeight:   58,
    TxBaseline: 62,
  });

  /** sizeof(struct RastPort). A window's RastPort belongs to
   *  Intuition; this is for a RastPort of your own (see scratch()).
   *  @type {number} */
  static SIZE = 100;

  /**
   * Make a RastPort that is not attached to anything, for measuring
   * text before a window exists, or in a font other than the screen's:
   *
   *   let measure = RastPort.scratch(font);
   *   let width   = measure.textWidth('Hello');
   *   let height  = measure.fontHeight;
   *   measure.free();
   *
   * It has no bitmap, so it cannot be drawn into; textWidth,
   * fontHeight and fontBaseline are what it is for. free() it when
   * done.
   *
   * @param {number} [font] - struct TextFont pointer to measure in
   * @returns {RastPort} an owned RastPort; call free()
   */
  static scratch(font) {
    let rastPort = new RastPort();

    globalThis.amiga.Graphics.InitRastPort(rastPort);
    if (font) globalThis.amiga.Graphics.SetFont(rastPort, font);

    return rastPort;
  }

  /**
   * REPL help text — a human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `RastPort(ptr)
where:
  ptr - an existing struct RastPort pointer, typically win.rastPort
        from a Window wrapper. For a RastPort of your own, to measure
        text with, use RastPort.scratch(font).

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
  get fontHeight()   { return this.read16(RastPort.OFFSET.TxHeight); }

  /** @returns {number} pixels from the top of a line to its baseline */
  get fontBaseline() { return this.read16(RastPort.OFFSET.TxBaseline); }

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
