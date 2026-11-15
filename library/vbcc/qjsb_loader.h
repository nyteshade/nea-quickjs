/*
 * qjsb_loader.h -- reading entries out of LIBS:quickjs/<name>.qjsb.
 * See qjsb_loader.c.
 */
#ifndef QJSB_LOADER_H
#define QJSB_LOADER_H

#include "quickjs.h"

/* An open .qjsb file whose header and index have been read and
 * checked. */
typedef struct QJSBFile QJSBFile;

/* The local shell variable naming a directory searched before
 * LIBS:quickjs/, and the directory used when it is not set or has no
 * such file. */
#define QJSB_DIR_VARIABLE   "QJSB_DIR"
#define QJSB_DEFAULT_DIR    "LIBS:quickjs"

/* Open <directory>/<container>.qjsb and check that this library may
 * use it.
 *   returns 1 and sets *file: opened
 *   returns 0: there is no such file, and `optional` was non-zero
 *   returns -1: an exception is pending that names the file and says
 *               what is wrong with it (missing, not a .qjsb file,
 *               damaged, built for another library or engine)
 * what_for, if not NULL, is put in the "cannot open" message: the
 * thing the script used that needs the file. */
int qjsb_open(JSContext *ctx, const char *container, int optional,
              const char *what_for, QJSBFile **file);

/* Close the file and free what qjsb_open allocated. */
void qjsb_close(JSContext *ctx, QJSBFile *file);

/* Whether the file has an entry of that name and kind. */
int qjsb_has_entry(const QJSBFile *file, const char *entry, int kind);

/* Read one entry (one Seek, one Read) and deserialise it: a function
 * for QJSB_KIND_SCRIPT, to be run with JS_EvalFunction; a module for
 * QJSB_KIND_MODULE. JS_EXCEPTION if there is no such entry of that
 * kind, or it cannot be read, or fails its check. */
JSValue qjsb_read_entry(JSContext *ctx, QJSBFile *file, const char *entry,
                        int kind);

/* The file's path as it was opened, for messages. */
const char *qjsb_path(const QJSBFile *file);

/* Whether `name` may be used as a container name: letters, digits,
 * '_', '-' and '.' only, so that a module specifier cannot name a file
 * outside the directory. */
int qjsb_valid_container_name(const char *name, size_t length);

/* Write "<directory>/<leaf>" into path for the override directory
 * (which == 0) or the default one (which == 1). Returns 0 if there is
 * no such directory setting or the result does not fit. */
int qjsb_make_path(int which, const char *leaf, char *path, size_t size);

#endif
