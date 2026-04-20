/* quickjs-master/amiga/ffi/Diskfont.js
 *
 * Wrapper for diskfont.library — opens disk-resident fonts and
 * lists available fonts on the system.
 *
 * Pilot scope:
 *   OpenDiskFont(ta)      — a0=ta, returns TextFont* (or 0)
 *   AvailFonts(buf,size,flags) — a0=buf, d0=size, d1=flags
 *
 * Font-close is done via graphics.library CloseFont (which Graphics
 * wrapper doesn't expose yet — use raw amiga.call to graphics.lvo
 * CloseFont until it lands).
 */

import { LibraryBase } from './LibraryBase.js';
import { CEnumeration } from './CEnumeration.js';
import { ptrOf } from './ptrOf.js';

/**
 * diskfont.library — load disk fonts by TextAttr.
 */
export class Diskfont extends LibraryBase {
  /** @type {string} */
  static libraryName = 'diskfont.library';

  /** @type {number} */
  static libraryVersion = 39;

  /** @type {Object<string, number>} */
  static lvo = globalThis.amiga.diskfont.lvo;

  /**
   * AFF_* flags for AvailFonts and fields on AvailFontsHeader.
   *
   *   AFF_MEMORY = 1 << 0   — in-memory fonts (already open)
   *   AFF_DISK   = 1 << 1   — on-disk fonts
   *   AFF_SCALED = 1 << 2   — scalable fonts
   *   AFF_BITMAP = 1 << 8   — bitmap fonts
   *   AFF_TAGGED = 1 << 16  — AFF with TagItem list
   */
  static consts = class DiskfontConsts extends CEnumeration {
    static {
      DiskfontConsts.define('AFF_MEMORY', 0x00000001);
      DiskfontConsts.define('AFF_DISK',   0x00000002);
      DiskfontConsts.define('AFF_SCALED', 0x00000004);
      DiskfontConsts.define('AFF_BITMAP', 0x00000100);
      DiskfontConsts.define('AFF_TAGGED', 0x00010000);
    }
  };

  /**
   * OpenDiskFont(textAttr) — load a disk-resident font described by
   * the given TextAttr (with .ta_Name pointing at a FONT: path like
   * "topaz.font" and .ta_YSize the point size).
   *
   * @param {TextAttr|number} ta — TextAttr wrapper or raw ptr
   * @returns {number} TextFont* pointer (0 on failure)
   */
  static OpenDiskFont(ta) {
    return this.call(this.lvo.OpenDiskFont, { a0: ptrOf(ta) });
  }

  /**
   * AvailFonts(buffer, bufSize, flags) — fills buffer with a
   * struct AvailFontsHeader followed by AvailFonts entries. Returns
   * a nonzero byte count if the buffer was too small (= required
   * size), or 0 on success.
   *
   * @param {number} buffer  — memory ptr (allocate with amiga.allocMem)
   * @param {number} bufSize
   * @param {number} flags   — OR of AFF_* from Diskfont.consts
   * @returns {number} 0 on success, or required size if too small
   */
  static AvailFonts(buffer, bufSize, flags) {
    return this.call(this.lvo.AvailFonts, {
      a0: ptrOf(buffer), d0: bufSize | 0, d1: flags | 0,
    });
  }
}
