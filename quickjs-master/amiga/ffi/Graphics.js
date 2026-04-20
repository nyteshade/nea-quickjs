/* quickjs-master/amiga/ffi/Graphics.js
 *
 * Wrapper for graphics.library. Pilot scope: ~20 of 163 LVOs
 * covering pens, lines, fills, text, color.
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';

export class Graphics extends LibraryBase {
  /** @type {string} */
  static libraryName = 'graphics.library';

  /** @type {number} */
  static libraryVersion = 39;

  /** @type {Object<string, number>} */
  static lvo = globalThis.amiga.graphics.lvo;

  /**
   * Drawing mode constants for SetDrMd.
   */
  static consts = class GraphicsConsts extends CEnumeration {
    static {
      GraphicsConsts.define('JAM1',       0x00);
      GraphicsConsts.define('JAM2',       0x01);
      GraphicsConsts.define('COMPLEMENT', 0x02);
      GraphicsConsts.define('INVERSVID',  0x04);
    }
  };

  /* ============================================================
   * Pen / drawing mode setters
   * ============================================================ */

  /**
   * Set the A (foreground) pen number on a RastPort.
   *
   * @param {RastPort|number} rport — RastPort wrapper or raw pointer
   * @param {number}          pen   — color index (0..ncolors-1)
   * @returns {number} previous A-pen value
   */
  static SetAPen(rport, pen) {
    return this.call(this.lvo.SetAPen,
      { a1: ptrOf(rport), d0: pen | 0 });
  }

  /**
   * Set the B (background) pen number on a RastPort.
   *
   * @param {RastPort|number} rport
   * @param {number}          pen
   * @returns {number} previous B-pen value
   */
  static SetBPen(rport, pen) {
    return this.call(this.lvo.SetBPen,
      { a1: ptrOf(rport), d0: pen | 0 });
  }

  /**
   * Set the drawing mode on a RastPort. Use `Graphics.consts.JAM1`,
   * `JAM2`, `COMPLEMENT`, or `INVERSVID` (bits may be OR'd).
   *
   * @param {RastPort|number} rport
   * @param {number}          mode  — bitmask of JAM1/JAM2/COMPLEMENT/INVERSVID
   * @returns {number} previous DrMd value
   */
  static SetDrMd(rport, mode) {
    return this.call(this.lvo.SetDrMd,
      { a1: ptrOf(rport), d0: mode | 0 });
  }

  /* ============================================================
   * Cursor + lines
   * ============================================================ */

  /**
   * Move the RastPort pen to (x, y) without drawing.
   *
   * @param {RastPort|number} rport
   * @param {number}          x
   * @param {number}          y
   * @returns {undefined}
   */
  static Move(rport, x, y) {
    return this.call(this.lvo.Move, {
      a1: ptrOf(rport), d0: x | 0, d1: y | 0,
    });
  }

  /**
   * Draw a line from the current pen position to (x, y).
   *
   * @param {RastPort|number} rport
   * @param {number}          x
   * @param {number}          y
   * @returns {undefined}
   */
  static Draw(rport, x, y) {
    return this.call(this.lvo.Draw, {
      a1: ptrOf(rport), d0: x | 0, d1: y | 0,
    });
  }

  /* ============================================================
   * Fills
   * ============================================================ */

  /**
   * Fill a rectangle (inclusive) with the current A-pen.
   *
   * @param {RastPort|number} rport
   * @param {number}          x1
   * @param {number}          y1
   * @param {number}          x2
   * @param {number}          y2
   * @returns {undefined}
   */
  static RectFill(rport, x1, y1, x2, y2) {
    return this.call(this.lvo.RectFill, {
      a1: ptrOf(rport),
      d0: x1 | 0, d1: y1 | 0,
      d2: x2 | 0, d3: y2 | 0,
    });
  }

  /**
   * Fill a raw memory block with zeroes using the blitter.
   *
   * @param {number} memBlock — aligned ptr
   * @param {number} count    — bytes to clear
   * @param {number} flags    — BLTCLEAR_* flags
   * @returns {undefined}
   */
  static BltClear(memBlock, count, flags) {
    return this.call(this.lvo.BltClear, {
      a1: ptrOf(memBlock), d0: count | 0, d1: flags | 0,
    });
  }

  /**
   * Set the area-fill pattern for RectFill/Flood. `pattern` is a
   * planar bitmap ptr (2^size lines tall). Set `pattern=0` to clear.
   *
   * @param {RastPort|number} rport
   * @param {number}          pattern — ptr to pattern words, or 0
   * @param {number}          size    — power-of-2 line count (e.g. 1=2px, 4=16px)
   * @returns {undefined}
   */
  static SetAfPt(rport, pattern, size) {
    return this.call(this.lvo.SetAfPt, {
      a1: ptrOf(rport), a0: ptrOf(pattern), d0: size | 0,
    });
  }

  /* ============================================================
   * Text
   * ============================================================ */

  /**
   * Render `length` characters from `str` at the current pen
   * position, advancing the cursor.
   *
   * @param {RastPort|number} rport
   * @param {number}          str    — ptr to char data (not null-terminated need)
   * @param {number}          length — chars to render
   * @returns {undefined}
   */
  static Text(rport, str, length) {
    return this.call(this.lvo.Text, {
      a1: ptrOf(rport), a0: ptrOf(str), d0: length | 0,
    });
  }

  /**
   * Return the pixel width of `length` chars of `str` in the
   * RastPort's current font.
   *
   * @param {RastPort|number} rport
   * @param {number}          str
   * @param {number}          length
   * @returns {number} pixel width
   */
  static TextLength(rport, str, length) {
    return this.call(this.lvo.TextLength, {
      a1: ptrOf(rport), a0: ptrOf(str), d0: length | 0,
    });
  }

  /**
   * Install a font (TextFont ptr) on the RastPort.
   *
   * @param {RastPort|number} rport
   * @param {number}          font — TextFont ptr from OpenFont
   * @returns {number} previous font ptr
   */
  static SetFont(rport, font) {
    return this.call(this.lvo.SetFont, {
      a1: ptrOf(rport), a0: ptrOf(font),
    });
  }

  /* ============================================================
   * Pixels
   * ============================================================ */

  /**
   * Read the pen number at (x, y). Returns -1 if out of bounds.
   *
   * @param {RastPort|number} rport
   * @param {number}          x
   * @param {number}          y
   * @returns {number}
   */
  static ReadPixel(rport, x, y) {
    return this.call(this.lvo.ReadPixel, {
      a1: ptrOf(rport), d0: x | 0, d1: y | 0,
    });
  }

  /**
   * Plot a pixel at (x, y) using the current A-pen.
   *
   * @param {RastPort|number} rport
   * @param {number}          x
   * @param {number}          y
   * @returns {number} 0 on success, -1 if out of bounds
   */
  static WritePixel(rport, x, y) {
    return this.call(this.lvo.WritePixel, {
      a1: ptrOf(rport), d0: x | 0, d1: y | 0,
    });
  }

  /* ============================================================
   * Color map
   * ============================================================ */

  /**
   * Bulk-load `count` 12-bit RGB values (starting at pen 0) into a
   * ViewPort's ColorMap.
   *
   * @param {number} viewPort — ViewPort ptr
   * @param {number} colors   — ptr to UWORDs (0x0RGB each)
   * @param {number} count
   * @returns {undefined}
   */
  static LoadRGB4(viewPort, colors, count) {
    return this.call(this.lvo.LoadRGB4, {
      a0: ptrOf(viewPort), a1: ptrOf(colors), d0: count | 0,
    });
  }

  /**
   * Set one color-map entry to a 12-bit RGB (each 0..15).
   *
   * @param {number} viewPort
   * @param {number} index — pen number
   * @param {number} r — 0..15
   * @param {number} g — 0..15
   * @param {number} b — 0..15
   * @returns {undefined}
   */
  static SetRGB4(viewPort, index, r, g, b) {
    return this.call(this.lvo.SetRGB4, {
      a0: ptrOf(viewPort),
      d0: index | 0, d1: r | 0, d2: g | 0, d3: b | 0,
    });
  }

  /**
   * Read a 12-bit packed RGB value from a ColorMap entry.
   *
   * @param {number} colorMap
   * @param {number} entry — pen number
   * @returns {number} 0x0RGB value
   */
  static GetRGB4(colorMap, entry) {
    return this.call(this.lvo.GetRGB4,
      { a0: ptrOf(colorMap), d0: entry | 0 });
  }

  /* ============================================================
   * Misc
   * ============================================================ */

  /** Block until vertical blank (top of frame). @returns {undefined} */
  static WaitTOF()  { return this.call(this.lvo.WaitTOF,  {}); }

  /** Block until pending blitter operations finish. @returns {undefined} */
  static WaitBlit() { return this.call(this.lvo.WaitBlit, {}); }
}
