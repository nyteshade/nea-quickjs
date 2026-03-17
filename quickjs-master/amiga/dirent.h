/*
 * dirent.h -- POSIX directory stub for SAS/C 6.58 / AmigaOS
 * Provides minimal DIR/dirent types for quickjs-libc.c.
 */
#ifndef _AMIGA_DIRENT_H
#define _AMIGA_DIRENT_H

#include <stddef.h>

#define NAME_MAX  107   /* AmigaOS max filename length */

struct dirent {
    char d_name[NAME_MAX + 1];
    int  d_type;
};

#define DT_UNKNOWN  0
#define DT_DIR      4
#define DT_REG      8

typedef struct _AmigaDIR {
    void *lock;         /* AmigaOS lock */
    struct dirent ent;
    int   done;
} DIR;

DIR           *opendir(const char *path);
struct dirent *readdir(DIR *dp);
int            closedir(DIR *dp);

#endif /* _AMIGA_DIRENT_H */
