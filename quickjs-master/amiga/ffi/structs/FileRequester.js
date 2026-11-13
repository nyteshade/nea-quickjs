/* quickjs-master/amiga/ffi/structs/FileRequester.js
 *
 * struct FileRequester (libraries/asl.h): what AllocAslRequest(
 * ASL_FileRequest) returns and AslRequest() fills in. Read-only, and
 * valid only until FreeAslRequest(): read what you need first.
 *
 * The bundle keeps this class private (it is not a global);
 * Asl.openFileRequest uses it.
 */

import { Struct } from './Struct.js';

export class FileRequester extends Struct {
  /* check-structs: struct FileRequester */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * libraries/asl.h. Checked against the compiler's own layout of the
   * struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    fr_File:     4,
    fr_Drawer:   8,
    fr_LeftEdge: 22,
    fr_TopEdge:  24,
    fr_Width:    26,
    fr_Height:   28,
    fr_NumArgs:  32,
  });

  /** asl.library allocates these; a script never does. */
  static SIZE = 0;

  /** @returns {string|null} contents of the File gadget */
  get file() {
    let pointer = this.read32(FileRequester.OFFSET.fr_File);

    return pointer ? globalThis.amiga.peekString(pointer, 256) : null;
  }

  /** @returns {string|null} contents of the Drawer gadget */
  get drawer() {
    let pointer = this.read32(FileRequester.OFFSET.fr_Drawer);

    return pointer ? globalThis.amiga.peekString(pointer, 512) : null;
  }

  /** @returns {number} the requester's left edge when it closed */
  get leftEdge() { return this.read16(FileRequester.OFFSET.fr_LeftEdge); }

  /** @returns {number} the requester's top edge when it closed */
  get topEdge() { return this.read16(FileRequester.OFFSET.fr_TopEdge); }

  /** @returns {number} the requester's width when it closed */
  get width() { return this.read16(FileRequester.OFFSET.fr_Width); }

  /** @returns {number} the requester's height when it closed */
  get height() { return this.read16(FileRequester.OFFSET.fr_Height); }

  /** @returns {number} how many files a multi-select request chose */
  get numArgs() { return this.read32(FileRequester.OFFSET.fr_NumArgs); }
}
