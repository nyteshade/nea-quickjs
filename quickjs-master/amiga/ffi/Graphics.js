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

  /* Pen / drawing mode setters */

  static SetAPen(rport, pen) {
    return this.call(this.lvo.SetAPen,
      { a1: ptrOf(rport), d0: pen | 0 });
  }

  static SetBPen(rport, pen) {
    return this.call(this.lvo.SetBPen,
      { a1: ptrOf(rport), d0: pen | 0 });
  }

  static SetDrMd(rport, mode) {
    return this.call(this.lvo.SetDrMd,
      { a1: ptrOf(rport), d0: mode | 0 });
  }

  /* Cursor + lines */

  static Move(rport, x, y) {
    return this.call(this.lvo.Move, {
      a1: ptrOf(rport), d0: x | 0, d1: y | 0,
    });
  }

  static Draw(rport, x, y) {
    return this.call(this.lvo.Draw, {
      a1: ptrOf(rport), d0: x | 0, d1: y | 0,
    });
  }

  /* Fills */

  static RectFill(rport, x1, y1, x2, y2) {
    return this.call(this.lvo.RectFill, {
      a1: ptrOf(rport),
      d0: x1 | 0, d1: y1 | 0,
      d2: x2 | 0, d3: y2 | 0,
    });
  }

  static BltClear(memBlock, count, flags) {
    return this.call(this.lvo.BltClear, {
      a1: ptrOf(memBlock), d0: count | 0, d1: flags | 0,
    });
  }

  /* Text */

  static Text(rport, str, length) {
    return this.call(this.lvo.Text, {
      a1: ptrOf(rport), a0: ptrOf(str), d0: length | 0,
    });
  }

  static TextLength(rport, str, length) {
    return this.call(this.lvo.TextLength, {
      a1: ptrOf(rport), a0: ptrOf(str), d0: length | 0,
    });
  }

  static SetFont(rport, font) {
    return this.call(this.lvo.SetFont, {
      a1: ptrOf(rport), a0: ptrOf(font),
    });
  }

  /* Pixels */

  static ReadPixel(rport, x, y) {
    return this.call(this.lvo.ReadPixel, {
      a1: ptrOf(rport), d0: x | 0, d1: y | 0,
    });
  }

  static WritePixel(rport, x, y) {
    return this.call(this.lvo.WritePixel, {
      a1: ptrOf(rport), d0: x | 0, d1: y | 0,
    });
  }

  /* Color map */

  static LoadRGB4(viewPort, colors, count) {
    return this.call(this.lvo.LoadRGB4, {
      a0: ptrOf(viewPort), a1: ptrOf(colors), d0: count | 0,
    });
  }

  static SetRGB4(viewPort, index, r, g, b) {
    return this.call(this.lvo.SetRGB4, {
      a0: ptrOf(viewPort),
      d0: index | 0, d1: r | 0, d2: g | 0, d3: b | 0,
    });
  }

  static GetRGB4(colorMap, entry) {
    return this.call(this.lvo.GetRGB4,
      { a0: ptrOf(colorMap), d0: entry | 0 });
  }

  /* Misc */

  static WaitTOF()  { return this.call(this.lvo.WaitTOF,  {}); }
  static WaitBlit() { return this.call(this.lvo.WaitBlit, {}); }
}
