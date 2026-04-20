/* quickjs-master/amiga/ffi/structs/DrawInfo.js
 *
 * struct DrawInfo (intuition/screens.h). Read-only descriptor handed
 * to BOOPSI images (via SYSIA_DrawInfo / IA_DrawInfo) so they can
 * render using the correct pens and system font.
 *
 * Field offsets (2-byte alignment):
 *   +0   dri_Version    (UWORD)
 *   +2   dri_NumPens    (UWORD)
 *   +4   dri_Pens       (UWORD *)
 *   +8   dri_Font       (struct TextFont *)
 *  +12   dri_Depth      (UWORD)
 *  +14   dri_Resolution (struct {UWORD X; UWORD Y;})  → 4 bytes
 *  +18   dri_Flags      (ULONG)
 *  +22   dri_CheckMark  (struct Image *)    — 3.2R4
 *  +26   dri_AmigaKey   (struct Image *)    — 3.2R4
 *   ...reserved / private follows
 *
 * Obtained via Intuition.GetScreenDrawInfo(screen) and released
 * with Intuition.FreeScreenDrawInfo(screen, dri) — neither is
 * wrapped yet, so use raw amiga.call for now.
 */

import { Struct } from './Struct.js';

export class DrawInfo extends Struct {
  /* Allocated by Intuition; we wrap. */

  /**
   * REPL help text — human-readable constructor signature.
   *
   * @returns {string}
   */
  static get signature() {
    return `DrawInfo(ptr)
where:
  ptr - REQUIRED: existing struct DrawInfo pointer from
        Intuition.GetScreenDrawInfo(screen). Release with
        Intuition.FreeScreenDrawInfo(screen, dri) when done.

Fields (read-only getters):
  version    {number}  dri_Version, +0
  numPens    {number}  dri_NumPens, +2
  pens       {number}  ptr to UWORD pen array, +4
  font       {number}  TextFont* ptr, +8
  depth      {number}  screen depth, +12
  resolutionX {number} +14 (UWORD)
  resolutionY {number} +16 (UWORD)
  flags      {number}  dri_Flags, +18
  checkMark  {Image|null} CheckMark image, +22 (3.2R4)
  amigaKey   {Image|null} AmigaKey image, +26 (3.2R4)

Typical use (raw-FFI escape hatch, wrapper pending):
  let dri = amiga.call(IntuitionBase,
    amiga.intuition.lvo.GetScreenDrawInfo, { a0: screen.ptr });
  let d = new DrawInfo(dri);
  print(d.numPens + ' pens, depth ' + d.depth);`;
  }

  /** @returns {number} */
  get version()     { return this.read16(0); }

  /** @returns {number} */
  get numPens()     { return this.read16(2); }

  /** @returns {number} UWORD* pen array pointer */
  get pens()        { return this.read32(4); }

  /** @returns {number} TextFont* pointer */
  get font()        { return this.read32(8); }

  /** @returns {number} screen depth in bit-planes */
  get depth()       { return this.read16(12); }

  /** @returns {number} horizontal resolution */
  get resolutionX() { return this.read16(14); }

  /** @returns {number} vertical resolution */
  get resolutionY() { return this.read16(16); }

  /** @returns {number} dri_Flags bitfield */
  get flags()       { return this.read32(18); }

  /**
   * Read one entry from the pen array.
   *
   * @param {number} index — 0..numPens-1
   * @returns {number}  pen number (UWORD)
   */
  getPen(index) {
    let p = this.pens;

    if (!p || index < 0 || index >= this.numPens) return 0;

    return globalThis.amiga.peek16(p + index * 2);
  }
}
