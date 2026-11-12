/* quickjs-master/amiga/ffi/structs/FileInfoBlock.js
 *
 * struct FileInfoBlock (dos/dos.h). Filled by Examine/ExNext to
 * describe a file or directory entry. Must be LONG-aligned
 * (AllocDosObject handles this; our allocMem path is LONG-aligned
 * on AmigaOS).
 *
 * Field offsets (from NDK 3.2R4 dos/dos.h line 61):
 *   +0    fib_DiskKey      (LONG, 4)
 *   +4    fib_DirEntryType (LONG, 4)   <0 = file, >0 = directory
 *   +8    fib_FileName     (TEXT[108]) — NULL-terminated C string.
 *                                        (Not a BCPL counted string
 *                                        — that's the pre-1.3 layout.
 *                                        Max 30 chars used in current
 *                                        filesystems.)
 * +116    fib_Protection   (LONG, 4)
 * +120    fib_EntryType    (LONG, 4)
 * +124    fib_Size         (LONG, 4)   — bytes in the file
 * +128    fib_NumBlocks    (LONG, 4)
 * +132    fib_Date         (struct DateStamp) — 3 × LONG = 12 bytes
 * +144    fib_Comment      (TEXT[80])  — NULL-terminated C string
 * +224    fib_OwnerUID     (UWORD)
 * +226    fib_OwnerGID     (UWORD)
 * +228    fib_Reserved     (char[32])
 *  total 260
 */

import { Struct } from './Struct.js';

export class FileInfoBlock extends Struct {
  /* check-structs: struct FileInfoBlock */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * dos/dos.h. Checked against the compiler's own layout of
   * the struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    fib_DiskKey:      0,
    fib_DirEntryType: 4,
    fib_FileName:     8,
    fib_Protection:   116,
    fib_Size:         124,
    fib_NumBlocks:    128,
    ds_Days:          132,   /* fib_Date.ds_Days */
    ds_Minute:        136,   /* fib_Date.ds_Minute */
    ds_Tick:          140,   /* fib_Date.ds_Tick */
    fib_Comment:      144,
    fib_OwnerUID:     224,
    fib_OwnerGID:     226,
  });

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
  fileName       {string} NULL-terminated C string at +8, up to 107 chars
  protection     {number} LONG, +116
  size           {number} LONG, +124 (file bytes)
  numBlocks      {number} LONG, +128
  dateDays       {number} ds_Days,     +132
  dateMinute     {number} ds_Minute,   +136
  dateTick       {number} ds_Tick,     +140
  comment        {string} NULL-terminated C string at +144, up to 79 chars
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
   * Read a NULL-terminated C string from an offset. Stops at the
   * first zero byte or at `cap` bytes, whichever comes first.
   *
   * @param   {number} off
   * @param   {number} cap — max byte count at offset (incl. NUL)
   * @returns {string}
   */
  _readCString(off, cap) {
    let chars = [];

    for (let i = 0; i < cap; i++) {
      let b = this.read8(off + i);

      if (b === 0) break;

      chars.push(String.fromCharCode(b));
    }

    return chars.join('');
  }

  /** @returns {number} LONG */
  get diskKey()      { return this.read32(FileInfoBlock.OFFSET.fib_DiskKey); }

  /** @returns {number} LONG (<0 file, >0 directory) */
  get dirEntryType() { return this.read32(FileInfoBlock.OFFSET.fib_DirEntryType) | 0; }

  /** @returns {string} */
  get fileName()     { return this._readCString(FileInfoBlock.OFFSET.fib_FileName, 108); }

  /** @returns {number} LONG protection bits */
  get protection()   { return this.read32(FileInfoBlock.OFFSET.fib_Protection); }

  /** @returns {number} LONG byte size */
  get size()         { return this.read32(FileInfoBlock.OFFSET.fib_Size); }

  /** @returns {number} LONG */
  get numBlocks()    { return this.read32(FileInfoBlock.OFFSET.fib_NumBlocks); }

  /** @returns {number} DateStamp.ds_Days */
  get dateDays()     { return this.read32(FileInfoBlock.OFFSET.ds_Days); }

  /** @returns {number} DateStamp.ds_Minute */
  get dateMinute()   { return this.read32(FileInfoBlock.OFFSET.ds_Minute); }

  /** @returns {number} DateStamp.ds_Tick */
  get dateTick()     { return this.read32(FileInfoBlock.OFFSET.ds_Tick); }

  /** @returns {string} comment, NULL-terminated C string */
  get comment()      { return this._readCString(FileInfoBlock.OFFSET.fib_Comment, 80); }

  /** @returns {number} UWORD */
  get ownerUID()     { return this.read16(FileInfoBlock.OFFSET.fib_OwnerUID); }

  /** @returns {number} UWORD */
  get ownerGID()     { return this.read16(FileInfoBlock.OFFSET.fib_OwnerGID); }
}
