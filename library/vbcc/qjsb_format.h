/*
 * qjsb_format.h -- the layout of a .qjsb file (QuickJS bytecode
 * container), as the library reads it.
 *
 * docs/QJSB-FORMAT.md is the specification. scripts/qjsb_format.py
 * writes the files and must agree with this header.
 *
 * Every number is big-endian. A file is:
 *
 *   header   QJSB_HEADER_SIZE bytes: 32 bytes of binary fields, then
 *            the file's AmigaDOS version string ("$VER: name 0.240
 *            (14.11.2026)", NUL-padded), which is for people and for
 *            C:Version; the loader compares the binary fields only
 *   index    one record per entry, see below
 *   blobs    each starting at a multiple of four
 */
#ifndef QJSB_FORMAT_H
#define QJSB_FORMAT_H

#define QJSB_MAGIC            0x514A5342ul    /* "QJSB" */
#define QJSB_FORMAT_VERSION   1

/* Offsets of the header's binary fields. */
#define QJSB_H_MAGIC          0     /* 4 */
#define QJSB_H_FORMAT         4     /* 2: QJSB_FORMAT_VERSION */
#define QJSB_H_FLAGS          6     /* 2: QJSB_FLAG_* */
#define QJSB_H_BC_VERSION     8     /* 2: the engine's BC_VERSION */
#define QJSB_H_BUILT_FOR      10    /* 2: a LIBRARY_VERSION, see the flag */
#define QJSB_H_ENGINE_STAMP   12    /* 4: check of the atom and opcode lists */
#define QJSB_H_COUNT          16    /* 2: number of entries */
#define QJSB_H_RESERVED       18    /* 2: zero */
#define QJSB_H_INDEX_SIZE     20    /* 4: bytes of index after the header */
#define QJSB_H_FILE_SIZE      24    /* 4: bytes in the whole file */
#define QJSB_H_CHECK          28    /* 4: check of header and index, taken
                                          with this field as zero */
#define QJSB_H_VERSION_TEXT   32    /* QJSB_VERSION_TEXT_SIZE bytes */
#define QJSB_VERSION_TEXT_SIZE 96
#define QJSB_HEADER_SIZE      128

/* With QJSB_FLAG_EXACT the file is for the one library version in
 * QJSB_H_BUILT_FOR: the library's own files, whose JavaScript and the
 * library's C belong together. Without it that field is the oldest
 * library version that may load the file: add-ons. */
#define QJSB_FLAG_EXACT       1

/* An index record: these fields, then the name (not terminated), then
 * one zero byte if the name's length is odd. */
#define QJSB_R_OFFSET         0     /* 4: of the blob, from the file's start */
#define QJSB_R_LENGTH         4     /* 4: of the blob */
#define QJSB_R_CHECK          8     /* 4: check of the blob */
#define QJSB_R_KIND           12    /* 1: QJSB_KIND_* */
#define QJSB_R_NAME_LENGTH    13    /* 1 */
#define QJSB_R_NAME           14

#define QJSB_KIND_SCRIPT      0     /* a classic script, to be evaluated */
#define QJSB_KIND_MODULE      1     /* an ES module, for the module loader */

/* The entry `import ... from 'qjs:<add-on>'` loads from <add-on>.qjsb. */
#define QJSB_MAIN_ENTRY       "@main"

/* Where the files are: the directory named by this local shell
 * variable, if it is set, is searched first; then this directory. */
#define QJSB_DIR_VARIABLE     "QJSB_DIR"
#define QJSB_DEFAULT_DIR      "LIBS:quickjs"

#endif
