/* quickjs-master/amiga/ffi/structs/TextFont.js
 *
 * struct TextFont (graphics/text.h): an open font, as OpenFont(),
 * OpenDiskFont() and DrawInfo.dri_Font give it. Read-only: the font
 * belongs to graphics.library.
 *
 * The bundle keeps this class private (it is not a global); ScreenFont
 * uses it to read the screen font's measurements.
 */

import { Struct } from './Struct.js';

export class TextFont extends Struct {
  /* check-structs: struct TextFont */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * graphics/text.h. Checked against the compiler's own layout of the
   * struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    tf_YSize:    20,
    tf_Style:    22,
    tf_Flags:    23,
    tf_XSize:    24,
    tf_Baseline: 26,
  });

  /** @type {number} */
  static SIZE = 52;

  /** @returns {number} height of a line of text, in pixels */
  get ySize() { return this.read16(TextFont.OFFSET.tf_YSize); }

  /** @returns {number} Graphics.consts.FSF_* bits the font has built in */
  get style() { return this.read8(TextFont.OFFSET.tf_Style); }

  /** @returns {number} Graphics.consts.FPF_* bits */
  get flags() { return this.read8(TextFont.OFFSET.tf_Flags); }

  /** @returns {number} nominal character width, in pixels */
  get xSize() { return this.read16(TextFont.OFFSET.tf_XSize); }

  /** @returns {number} pixels from the top of a line to its baseline */
  get baseline() { return this.read16(TextFont.OFFSET.tf_Baseline); }
}
