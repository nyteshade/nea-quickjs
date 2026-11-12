/* quickjs-master/amiga/ffi/structs/Screen.js
 *
 * Field offsets per intuition/screens.h (2-byte alignment):
 *   +0   NextScreen (4)
 *   +4   FirstWindow (4)
 *   +8   LeftEdge, +10 TopEdge, +12 Width, +14 Height (WORD each)
 *  +16   MouseY (2), +18 MouseX (2)
 *  +20   Flags (UWORD, 2)
 *  +22   Title (STRPTR, 4)
 *  +26   DefaultTitle (STRPTR, 4)
 *  +30   BarHeight, BarVBorder, ..., WBorBottom (9 × BYTE)
 *  +40   Font (struct TextAttr *, 4 — 1 byte pad at +39)
 */

import { Struct } from './Struct.js';
import { TextAttr } from './TextAttr.js';

export class Screen extends Struct {
  /* check-structs: struct Screen */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * intuition/screens.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    LeftEdge:  8,
    TopEdge:   10,
    Width:     12,
    Height:    14,
    Flags:     20,
    Title:     22,
    BarHeight: 30,
    Font:      40,
  });

  /* SIZE not exposed — Screen is allocated by Intuition. */

  /**
   * REPL help text — a human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `Screen(ptr)
where:
  ptr - REQUIRED: an existing struct Screen pointer from
        Intuition.OpenScreenTags / LockPubScreen. You cannot
        allocate a Screen from scratch — only Intuition may.

Fields (read-only getters): leftEdge, topEdge, width, height,
  flags, title, barHeight, font (TextAttr wrapper).

Lifecycle is managed by Intuition.CloseScreen or UnlockPubScreen.`;
  }

  /** @returns {number} */
  get leftEdge() { return this.read16(Screen.OFFSET.LeftEdge); }

  /** @returns {number} */
  get topEdge()  { return this.read16(Screen.OFFSET.TopEdge); }

  /** @returns {number} */
  get width()    { return this.read16(Screen.OFFSET.Width); }

  /** @returns {number} */
  get height()   { return this.read16(Screen.OFFSET.Height); }

  /** @returns {number} */
  get flags()    { return this.read16(Screen.OFFSET.Flags); }

  /** @returns {string|null} */
  get title() {
    let p = this.read32(Screen.OFFSET.Title);

    return p ? globalThis.amiga.peekString(p, 64) : null;
  }

  /** @returns {number} */
  get barHeight() { return this.read8(Screen.OFFSET.BarHeight); }

  /** @returns {TextAttr|null} */
  get font() {
    let p = this.read32(Screen.OFFSET.Font);

    return p ? new TextAttr(p) : null;
  }
}
