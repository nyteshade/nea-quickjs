/* quickjs-master/amiga/ffi/structs/FileInfoBlock.js
 *
 * struct FileInfoBlock (dos/dos.h). Filled by Examine/ExNext to
 * describe a file or directory entry. Must be LONG-aligned
 * (AllocDosObject handles this; our allocMem path is LONG-aligned
 * on AmigaOS).
 *
 * Field offsets (2-byte alignment; all entries LONG-aligned by
 * the AmigaOS memory allocator):
 *   +0    fib_DiskKey      (LONG, 4)
 *   +4    fib_DirEntryType (LONG, 4)   <0 = file, >0 = directory
 *   +8    fib_FileName     (char[108]) — BCPL counted string: byte 0
 *                                         is length, bytes 1..N the
 *                                         chars. 107 max chars.
 * +116    fib_Protection   (LONG, 4)
 * +120    fib_EntryType    (LONG, 4)
 * +124    fib_Size         (LONG, 4)   — bytes in the file
 * +128    fib_NumBlocks    (LONG, 4)
 * +132    fib_Date         (struct DateStamp) — 3 × LONG = 12 bytes
 * +144    fib_Comment      (char[80])  — BCPL counted
 * +224    fib_OwnerUID     (UWORD)
 * +226    fib_OwnerGID     (UWORD)
 * +228    fib_Reserved     (char[32])
 *  total 260
 */

import { Struct } from './Struct.js';

export class FileInfoBlock extends Struct {
  /** @type {number} */
  static SIZE = 260;

  /**
   * REPL help text.
   *
   * @returns {string}
   */
  static get signature() {
    return `FileInfoBlock(ptr?)
where:
  ptr? - optional existing FileInfoBlock* pointer. Omit to allocate
         a zeroed 260-byte struct. Must be LONG-aligned; allocMem
         always returns LONG-aligned memory on AmigaOS.

Fields (read-only getters):
  diskKey        {number} LONG, +0
  dirEntryType   {number} LONG, +4  (<0 file, >0 dir)
  fileName       {string} BCPL string at +8, up to 107 chars
  protection     {number} LONG, +116
  size           {number} LONG, +124 (file bytes)
  numBlocks      {number} LONG, +128
  dateDays       {number} ds_Days,     +132
  dateMinute     {number} ds_Minute,   +136
  dateTick       {number} ds_Tick,     +140
  comment        {string} BCPL string at +144
  ownerUID       {number} UWORD, +224
  ownerGID       {number} UWORD, +226

Typical use:
  let fib = new FileInfoBlock();
  let lock = Dos.Lock('RAM:', -2 /*SHARED_LOCK*/);
  if (Dos.Examine(lock, fib)) {
    print(fib.fileName + ' (' + fib.size + ' bytes)');
  }
  Dos.UnLock(lock);
  fib.free();`;
  }

  /**
   * Read a BCPL-style counted string from an offset. Byte 0 is the
   * length, bytes 1..N are the chars.
   *
   * @param   {number} off
   * @param   {number} cap — max byte count at offset (incl. length)
   * @returns {string}
   */
  _readBCPL(off, cap) {
    let len = this.read8(off);

    if (len <= 0) return '';
    if (len > cap - 1) len = cap - 1;

    let chars = [];

    for (let i = 0; i < len; i++) {
      chars.push(String.fromCharCode(this.read8(off + 1 + i)));
    }

    return chars.join('');
  }

  /** @returns {number} LONG */
  get diskKey()      { return this.read32(0); }

  /** @returns {number} LONG (<0 file, >0 directory) */
  get dirEntryType() { return this.read32(4) | 0; }

  /** @returns {string} */
  get fileName()     { return this._readBCPL(8, 108); }

  /** @returns {number} LONG protection bits */
  get protection()   { return this.read32(116); }

  /** @returns {number} LONG byte size */
  get size()         { return this.read32(124); }

  /** @returns {number} LONG */
  get numBlocks()    { return this.read32(128); }

  /** @returns {number} DateStamp.ds_Days */
  get dateDays()     { return this.read32(132); }

  /** @returns {number} DateStamp.ds_Minute */
  get dateMinute()   { return this.read32(136); }

  /** @returns {number} DateStamp.ds_Tick */
  get dateTick()     { return this.read32(140); }

  /** @returns {string} comment, BCPL string */
  get comment()      { return this._readBCPL(144, 80); }

  /** @returns {number} UWORD */
  get ownerUID()     { return this.read16(224); }

  /** @returns {number} UWORD */
  get ownerGID()     { return this.read16(226); }
}
