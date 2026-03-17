/*
 * grp.h -- POSIX group stub for SAS/C 6.58 / AmigaOS
 */
#ifndef _AMIGA_GRP_H
#define _AMIGA_GRP_H

struct group {
    char  *gr_name;
    char  *gr_passwd;
    int    gr_gid;
    char **gr_mem;
};

struct group *getgrgid(int gid);
struct group *getgrnam(const char *name);

#endif /* _AMIGA_GRP_H */
