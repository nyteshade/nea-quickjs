/*
 * qjsb_loader.c -- reading entries out of .qjsb files.
 *
 * Since 0.240 the JavaScript that quickjs.library is delivered with
 * (the extended features, the Amiga library wrappers, the Reaction
 * classes) is not part of the library image. It is bytecode in files
 * beside the library:
 *
 *     LIBS:quickjs/extended.qjsb, amiga.qjsb, reaction.qjsb
 *
 * and add-ons are further files there. Each file holds named entries
 * behind an index (docs/QJSB-FORMAT.md, qjsb_format.h). This file
 * opens one, checks that it belongs to this library, and reads single
 * entries.
 *
 * Disk access is slow on a real Amiga, so the calls are counted:
 * opening a file is one Open and one Read (header and index together,
 * unless the index is longer than QJSB_FIRST_READ); each entry is one
 * Seek and one Read of exactly its bytes. Nothing is cached between
 * calls and no file stays open, so a file can be replaced while a
 * script runs and nothing has to be cleaned up when a context ends.
 *
 * Every failure is a JavaScript exception naming the file. Bytecode is
 * not validated by the engine, so nothing is handed to it that fails
 * its check.
 *
 * Only dos.library is used, through sl_DOSBase, in the form the other
 * sharedlib_*.c files use (the call is inline assembly, which keeps
 * vbcc from loading A6 before the other arguments).
 */
#include "amiga_compat_vbcc.h"
#include <stddef.h>
#include <string.h>

#include "quickjs.h"
#include "qjsb_format.h"
#include "qjsb_loader.h"
#include "qjsb_stamp.h"         /* generated: quickjs-master/gen/ */

struct Library;
extern struct Library *sl_DOSBase;

/* dos/dos.h and dos/var.h values, from sdks/NDK3.2R4/Include_H */
#define QJSB_MODE_OLDFILE          1005L    /* MODE_OLDFILE */
#define QJSB_OFFSET_BEGINNING      (-1L)    /* OFFSET_BEGINNING */
#define QJSB_GVF_LOCAL_ONLY        0x200L   /* GVF_LOCAL_ONLY */
#define QJSB_ERROR_OBJECT_NOT_FOUND 205L    /* ERROR_OBJECT_NOT_FOUND */
#define QJSB_ERROR_DIR_NOT_FOUND   204L     /* ERROR_DIR_NOT_FOUND */

static long __qjsb_Open(__reg("a6") struct Library *base,
                        __reg("d1") const char *name,
                        __reg("d2") long mode) = "\tjsr\t-30(a6)";
static long __qjsb_Close(__reg("a6") struct Library *base,
                         __reg("d1") long file) = "\tjsr\t-36(a6)";
static long __qjsb_Read(__reg("a6") struct Library *base,
                        __reg("d1") long file,
                        __reg("d2") void *buffer,
                        __reg("d3") long length) = "\tjsr\t-42(a6)";
static long __qjsb_Seek(__reg("a6") struct Library *base,
                        __reg("d1") long file,
                        __reg("d2") long position,
                        __reg("d3") long mode) = "\tjsr\t-66(a6)";
static long __qjsb_IoErr(__reg("a6") struct Library *base) = "\tjsr\t-132(a6)";
static long __qjsb_GetVar(__reg("a6") struct Library *base,
                          __reg("d1") const char *name,
                          __reg("d2") char *buffer,
                          __reg("d3") long size,
                          __reg("d4") long flags) = "\tjsr\t-906(a6)";

/* Bytes read with the Open: the header and, for a file with up to
 * about a hundred entries, the whole index. */
#define QJSB_FIRST_READ   2048
#define QJSB_PATH_SIZE    256

struct QJSBFile {
    long fh;                            /* BPTR from Open */
    unsigned long index_size;
    unsigned long file_size;
    unsigned int count;
    const unsigned char *index;         /* in first[] or in whole */
    unsigned char *whole;               /* header and index, when they did
                                           not fit in first[] */
    char path[QJSB_PATH_SIZE];
    unsigned char first[QJSB_FIRST_READ];
};

static unsigned long get16(const unsigned char *p)
{
    return ((unsigned long)p[0] << 8) | p[1];
}

static unsigned long get32(const unsigned char *p)
{
    return ((unsigned long)p[0] << 24) | ((unsigned long)p[1] << 16) |
           ((unsigned long)p[2] << 8) | p[3];
}

/* The check of docs/QJSB-FORMAT.md: the bytes as big-endian 32-bit
 * words, the last padded with zeros; per word, rotate the sum left by
 * one bit and add the word. `data` is at an even address. */
static unsigned long qjsb_check(const unsigned char *data, unsigned long length)
{
    const unsigned long *word = (const unsigned long *)data;
    unsigned long words = length >> 2;
    unsigned long sum = 0, last;

    while (words--)
        sum = ((sum << 1) | (sum >> 31)) + *word++;

    if (length & 3) {
        const unsigned char *tail = (const unsigned char *)word;

        last = (unsigned long)tail[0] << 24;
        if ((length & 3) > 1) last |= (unsigned long)tail[1] << 16;
        if ((length & 3) > 2) last |= (unsigned long)tail[2] << 8;
        sum = ((sum << 1) | (sum >> 31)) + last;
    }
    return sum;
}

int qjsb_valid_container_name(const char *name, size_t length)
{
    size_t index;

    if (length == 0 || length > 30)
        return 0;
    for (index = 0; index < length; index++) {
        char c = name[index];

        if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
              (c >= '0' && c <= '9') || c == '_' || c == '-' || c == '.'))
            return 0;
    }
    return 1;
}

int qjsb_make_path(int which, const char *leaf, char *path, size_t size)
{
    size_t length;

    if (which == 0) {
        /* A local variable only (`set QJSB_DIR Work:dev/quickjs` in the
         * shell that starts the program): looking for a global one
         * would open a file in ENV: every time. */
        long got = __qjsb_GetVar(sl_DOSBase, QJSB_DIR_VARIABLE, path,
                                 (long)size, QJSB_GVF_LOCAL_ONLY);

        if (got <= 0)
            return 0;
        path[size - 1] = '\0';
    } else {
        if (size < sizeof(QJSB_DEFAULT_DIR))
            return 0;
        strcpy(path, QJSB_DEFAULT_DIR);
    }

    length = strlen(path);
    if (length == 0 || length + 1 + strlen(leaf) + 1 > size)
        return 0;
    if (path[length - 1] != ':' && path[length - 1] != '/')
        path[length++] = '/';
    strcpy(path + length, leaf);
    return 1;
}

const char *qjsb_path(const QJSBFile *file)
{
    return file->path;
}

void qjsb_close(JSContext *ctx, QJSBFile *file)
{
    if (!file)
        return;
    if (file->fh)
        __qjsb_Close(sl_DOSBase, file->fh);
    if (file->whole)
        js_free(ctx, file->whole);
    js_free(ctx, file);
}

/* Read exactly `length` bytes, or throw. */
static int qjsb_read_exact(JSContext *ctx, QJSBFile *file, void *buffer,
                           unsigned long length)
{
    long got = __qjsb_Read(sl_DOSBase, file->fh, buffer, (long)length);

    if (got == (long)length)
        return 0;
    if (got < 0)
        JS_ThrowPlainError(ctx, "cannot read %s (DOS error %ld)", file->path,
                           __qjsb_IoErr(sl_DOSBase));
    else
        JS_ThrowPlainError(ctx, "%s is damaged: it ends too early",
                           file->path);
    return -1;
}

/* Check the header and index now in `data`; -1 with an exception. */
static int qjsb_check_header(JSContext *ctx, QJSBFile *file,
                             unsigned char *data)
{
    unsigned long bc_version = get16(data + QJSB_H_BC_VERSION);
    unsigned long built_for  = get16(data + QJSB_H_BUILT_FOR);
    unsigned long stamp      = get32(data + QJSB_H_ENGINE_STAMP);
    unsigned long flags      = get16(data + QJSB_H_FLAGS);
    unsigned long stored, sum;

    if (bc_version != QJSB_BC_VERSION || stamp != QJSB_ENGINE_STAMP ||
        ((flags & QJSB_FLAG_EXACT) && built_for != QJSB_BUILT_FOR)) {
        JS_ThrowPlainError(ctx,
            "%s was built for quickjs.library %lu.%03lu (bytecode %lu.%08lx) "
            "but this is quickjs.library %lu.%03lu (bytecode %lu.%08lx); "
            "install the .qjsb files that belong to this library",
            file->path, built_for / 1000, built_for % 1000, bc_version, stamp,
            (unsigned long)QJSB_BUILT_FOR / 1000,
            (unsigned long)QJSB_BUILT_FOR % 1000,
            (unsigned long)QJSB_BC_VERSION, (unsigned long)QJSB_ENGINE_STAMP);
        return -1;
    }

    if (built_for > QJSB_BUILT_FOR) {
        JS_ThrowPlainError(ctx,
            "%s needs quickjs.library %lu.%03lu or newer but this is "
            "quickjs.library %lu.%03lu",
            file->path, built_for / 1000, built_for % 1000,
            (unsigned long)QJSB_BUILT_FOR / 1000,
            (unsigned long)QJSB_BUILT_FOR % 1000);
        return -1;
    }

    stored = get32(data + QJSB_H_CHECK);
    memset(data + QJSB_H_CHECK, 0, 4);
    sum = qjsb_check(data, QJSB_HEADER_SIZE + file->index_size);
    if (sum != stored) {
        JS_ThrowPlainError(ctx, "%s is damaged: its index fails its check",
                           file->path);
        return -1;
    }
    return 0;
}

int qjsb_open(JSContext *ctx, const char *container, int optional,
              const char *what_for, QJSBFile **result)
{
    QJSBFile *file;
    char leaf[40];
    long got, error = 0;
    int which;

    *result = NULL;

    if (!qjsb_valid_container_name(container, strlen(container))) {
        if (optional)
            return 0;
        JS_ThrowPlainError(ctx, "'%s' is not a .qjsb file name", container);
        return -1;
    }
    strcpy(leaf, container);
    strcat(leaf, ".qjsb");

    file = js_mallocz(ctx, sizeof(*file));
    if (!file)
        return -1;

    for (which = 0; which < 2 && !file->fh; which++) {
        if (!qjsb_make_path(which, leaf, file->path, sizeof(file->path)))
            continue;
        file->fh = __qjsb_Open(sl_DOSBase, file->path, QJSB_MODE_OLDFILE);
        if (!file->fh)
            error = __qjsb_IoErr(sl_DOSBase);
    }

    if (!file->fh) {
        if (optional && (error == QJSB_ERROR_OBJECT_NOT_FOUND ||
                         error == QJSB_ERROR_DIR_NOT_FOUND || error == 0)) {
            qjsb_close(ctx, file);
            return 0;
        }
        if (error == QJSB_ERROR_OBJECT_NOT_FOUND ||
            error == QJSB_ERROR_DIR_NOT_FOUND) {
            if (what_for)
                JS_ThrowPlainError(ctx,
                    "'%s' needs %s, which is missing: copy the 'quickjs' "
                    "drawer that comes with quickjs.library into LIBS:",
                    what_for, file->path);
            else
                JS_ThrowPlainError(ctx,
                    "%s is missing: copy the 'quickjs' drawer that comes "
                    "with quickjs.library into LIBS:", file->path);
        } else {
            JS_ThrowPlainError(ctx, "cannot open %s (DOS error %ld)",
                               file->path, error);
        }
        goto fail;
    }

    got = __qjsb_Read(sl_DOSBase, file->fh, file->first, QJSB_FIRST_READ);
    if (got < 0) {
        JS_ThrowPlainError(ctx, "cannot read %s (DOS error %ld)", file->path,
                           __qjsb_IoErr(sl_DOSBase));
        goto fail;
    }
    if (got < QJSB_HEADER_SIZE ||
        get32(file->first + QJSB_H_MAGIC) != QJSB_MAGIC) {
        JS_ThrowPlainError(ctx, "%s is not a QuickJS bytecode (.qjsb) file",
                           file->path);
        goto fail;
    }
    if (get16(file->first + QJSB_H_FORMAT) != QJSB_FORMAT_VERSION) {
        JS_ThrowPlainError(ctx,
            "%s has .qjsb format %lu but this quickjs.library reads format %d",
            file->path, get16(file->first + QJSB_H_FORMAT),
            QJSB_FORMAT_VERSION);
        goto fail;
    }

    file->count      = (unsigned int)get16(file->first + QJSB_H_COUNT);
    file->index_size = get32(file->first + QJSB_H_INDEX_SIZE);
    file->file_size  = get32(file->first + QJSB_H_FILE_SIZE);

    if (file->index_size > file->file_size ||
        QJSB_HEADER_SIZE + file->index_size > file->file_size) {
        JS_ThrowPlainError(ctx, "%s is damaged: bad index size", file->path);
        goto fail;
    }

    if (QJSB_HEADER_SIZE + file->index_size <= (unsigned long)got) {
        if (qjsb_check_header(ctx, file, file->first))
            goto fail;
        file->index = file->first + QJSB_HEADER_SIZE;
    } else {
        /* a long index: fetch the rest of it, which follows on */
        unsigned long total = QJSB_HEADER_SIZE + file->index_size;

        file->whole = js_malloc(ctx, total + 4);
        if (!file->whole)
            goto fail;
        memcpy(file->whole, file->first, (size_t)got);
        if (qjsb_read_exact(ctx, file, file->whole + got,
                            total - (unsigned long)got))
            goto fail;
        if (qjsb_check_header(ctx, file, file->whole))
            goto fail;
        file->index = file->whole + QJSB_HEADER_SIZE;
    }

    *result = file;
    return 1;

fail:
    qjsb_close(ctx, file);
    return -1;
}

/* The index record of an entry, or NULL. The index has passed its
 * check, but its records are still walked with bounds. */
static const unsigned char *qjsb_find(const QJSBFile *file, const char *entry,
                                      int kind)
{
    const unsigned char *record = file->index;
    const unsigned char *end = file->index + file->index_size;
    size_t wanted = strlen(entry);
    unsigned int index;

    for (index = 0; index < file->count; index++) {
        size_t length;

        if (record + QJSB_R_NAME > end)
            return NULL;
        length = record[QJSB_R_NAME_LENGTH];
        if (record + QJSB_R_NAME + length > end)
            return NULL;
        if (length == wanted && record[QJSB_R_KIND] == kind &&
            memcmp(record + QJSB_R_NAME, entry, wanted) == 0)
            return record;
        record += QJSB_R_NAME + length + (length & 1);
    }
    return NULL;
}

int qjsb_has_entry(const QJSBFile *file, const char *entry, int kind)
{
    return qjsb_find(file, entry, kind) != NULL;
}

JSValue qjsb_read_entry(JSContext *ctx, QJSBFile *file, const char *entry,
                        int kind)
{
    const unsigned char *record = qjsb_find(file, entry, kind);
    unsigned long offset, length;
    unsigned char *blob;
    JSValue object;

    if (!record)
        return JS_ThrowPlainError(ctx, "%s has no %s '%s'", file->path,
                                  kind == QJSB_KIND_MODULE ? "module"
                                                           : "entry", entry);

    offset = get32(record + QJSB_R_OFFSET);
    length = get32(record + QJSB_R_LENGTH);

    if (offset > file->file_size || length > file->file_size - offset)
        return JS_ThrowPlainError(ctx, "%s is damaged: '%s' lies outside it",
                                  file->path, entry);

    /* room for the check to read a whole last word */
    blob = js_malloc(ctx, length + 4);
    if (!blob)
        return JS_EXCEPTION;
    memset(blob + length, 0, 4);

    if (__qjsb_Seek(sl_DOSBase, file->fh, (long)offset,
                    QJSB_OFFSET_BEGINNING) < 0) {
        JS_ThrowPlainError(ctx, "cannot read %s (DOS error %ld)", file->path,
                           __qjsb_IoErr(sl_DOSBase));
        js_free(ctx, blob);
        return JS_EXCEPTION;
    }
    if (qjsb_read_exact(ctx, file, blob, length)) {
        js_free(ctx, blob);
        return JS_EXCEPTION;
    }
    if (qjsb_check(blob, length) != get32(record + QJSB_R_CHECK)) {
        js_free(ctx, blob);
        return JS_ThrowPlainError(ctx, "%s is damaged: '%s' fails its check",
                                  file->path, entry);
    }

    /* the engine copies what it keeps */
    object = JS_ReadObject(ctx, blob, (size_t)length, JS_READ_OBJ_BYTECODE);
    js_free(ctx, blob);
    return object;
}
