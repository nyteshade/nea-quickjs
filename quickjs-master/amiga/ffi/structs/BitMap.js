/* quickjs-master/amiga/ffi/structs/BitMap.js
 *
 * struct BitMap (graphics/gfx.h). Planar bitmap descriptor.
 *
 * Field offsets (2-byte alignment):
 *   +0   BytesPerRow  (UWORD)
 *   +2   Rows         (UWORD)
 *   +4   Flags        (UBYTE)
 *   +5   Depth        (UBYTE)
 *   +6   pad          (UWORD)
 *   +8   Planes       (PLANEPTR × 8)   — first 8 bitplane pointers
 *  +40   (end for classic BitMap; BitMap_V39 extends here)
 *
 * Flags: BMF_CLEAR (1), BMF_DISPLAYABLE (2), BMF_INTERLEAVED (4),
 *        BMF_STANDARD (8), BMF_MINPLANES (0x10).
 */

import { Struct } from './Struct.js';

export class BitMap extends Struct {
  /** @type {number} */
  static SIZE = 40;

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `BitMap(ptr?)
where:
  ptr? - optional existing BitMap* pointer. Omit to allocate a raw
         40-byte BitMap header (caller still needs to AllocRaster
         the planes and fill in the Planes array).

Fields:
  bytesPerRow  {number} +0 UWORD
  rows         {number} +2 UWORD
  flags        {number} +4 UBYTE  (BMF_CLEAR/DISPLAYABLE/INTERLEAVED...)
  depth        {number} +5 UBYTE  bit-plane count (1..8)
  getPlane(i)  {number} PLANEPTR for plane i (0..depth-1)
  setPlane(i,p){undefined} write PLANEPTR

For displayable/planar operations prefer Graphics.AllocBitMap (not
yet wrapped) over manual construction.`;
  }

  /** @returns {number} */
  get bytesPerRow() { return this.read16(0); }
  set bytesPerRow(v){ this.write16(0, v | 0); }

  /** @returns {number} */
  get rows()        { return this.read16(2); }
  set rows(v)       { this.write16(2, v | 0); }

  /** @returns {number} UBYTE */
  get flags()       { return this.read8(4); }
  set flags(v)      { this.write8(4, v | 0); }

  /** @returns {number} UBYTE */
  get depth()       { return this.read8(5); }
  set depth(v)      { this.write8(5, v | 0); }

  /**
   * Get one bit-plane pointer from the Planes[] array.
   *
   * @param {number} i — 0..7
   * @returns {number} PLANEPTR (raw memory ptr)
   */
  getPlane(i) {
    if (i < 0 || i > 7) return 0;
    return this.read32(8 + i * 4);
  }

  /**
   * Set one bit-plane pointer.
   *
   * @param {number} i — 0..7
   * @param {number} ptr — PLANEPTR
   */
  setPlane(i, ptr) {
    if (i < 0 || i > 7) return;
    this.write32(8 + i * 4, ptr | 0);
  }
}
