/*
 * cli_qjsb_versions.c -- the part of "qjs -v" that lists the bytecode
 * files (.qjsb) beside the library.
 *
 * Linked into the qjs command, not the library. The library reads
 * these files only when a script first uses something that is in one
 * of them; this listing is the one place where they are all opened,
 * and only for -v. For each file found it prints the path and the
 * file's own AmigaDOS version string, the text `version file <path>`
 * prints, and adds a remark if the header's binary fields say the
 * loaded library will refuse the file. docs/QJSB-FORMAT.md describes
 * the header.
 *
 * The directories are the ones the library searches, in its order
 * (qjsb_loader.c): the one named by the local variable QJSB_DIR, if
 * set, then LIBS:quickjs.
 */
#include <stdio.h>
#include <string.h>

#include <exec/types.h>
#include <exec/libraries.h>
#include <dos/dos.h>
#include <dos/var.h>
#include <proto/dos.h>

#include "qjsb_format.h"

#define SUFFIX      ".qjsb"
#define PATH_SIZE   256

static unsigned long field16(const unsigned char *p)
{
    return ((unsigned long)p[0] << 8) | p[1];
}

static unsigned long field32(const unsigned char *p)
{
    return ((unsigned long)p[0] << 24) | ((unsigned long)p[1] << 16) |
           ((unsigned long)p[2] << 8) | p[3];
}

/* Print one line for the file at `path`. */
static void show_file(const char *path, unsigned long library_version)
{
    static unsigned char header[QJSB_HEADER_SIZE + 1];
    const char *text = (const char *)header + QJSB_H_VERSION_TEXT;
    unsigned long built_for;
    BPTR file = Open((STRPTR)path, MODE_OLDFILE);
    LONG got;

    if (!file) {
        printf("%s: cannot be opened\n", path);
        return;
    }
    got = Read(file, header, QJSB_HEADER_SIZE);
    Close(file);
    header[QJSB_HEADER_SIZE] = '\0';

    if (got < QJSB_HEADER_SIZE || field32(header + QJSB_H_MAGIC) != QJSB_MAGIC ||
        strncmp(text, "$VER: ", 6) != 0) {
        printf("%s: not a .qjsb file\n", path);
        return;
    }

    printf("%s: %s", path, text + 6);

    built_for = field16(header + QJSB_H_BUILT_FOR);
    if (field16(header + QJSB_H_FORMAT) != QJSB_FORMAT_VERSION)
        printf(" - format %lu, not readable by this library",
               field16(header + QJSB_H_FORMAT));
    else if ((field16(header + QJSB_H_FLAGS) & QJSB_FLAG_EXACT) &&
             built_for != library_version)
        printf(" - NOT for this library: only for %lu.%03lu",
               built_for / 1000, built_for % 1000);
    else if (built_for > library_version)
        printf(" - NOT for this library: needs %lu.%03lu or newer",
               built_for / 1000, built_for % 1000);
    printf("\n");
}

/* List the .qjsb files of one directory; returns how many. */
static int show_directory(const char *directory, unsigned long library_version)
{
    static char path[PATH_SIZE];
    struct FileInfoBlock *info;
    size_t length, name_length;
    int count = 0;
    BPTR lock;

    lock = Lock((STRPTR)directory, ACCESS_READ);
    if (!lock)
        return 0;

    info = AllocDosObject(DOS_FIB, NULL);
    if (info && Examine(lock, info)) {
        while (ExNext(lock, info)) {
            name_length = strlen(info->fib_FileName);
            if (info->fib_DirEntryType >= 0 || name_length <= strlen(SUFFIX) ||
                strcmp(info->fib_FileName + name_length - strlen(SUFFIX),
                       SUFFIX) != 0)
                continue;

            length = strlen(directory);
            if (length + 1 + name_length + 1 > sizeof(path))
                continue;
            strcpy(path, directory);
            if (path[length - 1] != ':' && path[length - 1] != '/')
                path[length++] = '/';
            strcpy(path + length, info->fib_FileName);

            show_file(path, library_version);
            count++;
        }
    }
    if (info)
        FreeDosObject(DOS_FIB, info);
    UnLock(lock);
    return count;
}

/* Called by version() in qjs.c with the loaded library's lib_Version. */
void qjs_show_qjsb_versions(unsigned long library_version)
{
    static char directory[PATH_SIZE];
    int count = 0;

    if (GetVar((STRPTR)QJSB_DIR_VARIABLE, directory, sizeof(directory),
               GVF_LOCAL_ONLY) > 0)
        count += show_directory(directory, library_version);

    count += show_directory(QJSB_DEFAULT_DIR, library_version);

    if (count == 0)
        printf("no .qjsb files in " QJSB_DEFAULT_DIR
               " (extended features, Amiga and Reaction wrappers missing)\n");
}
