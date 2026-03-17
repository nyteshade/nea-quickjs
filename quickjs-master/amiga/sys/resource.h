/*
 * sys/resource.h -- stub for SAS/C 6.58 / AmigaOS
 */
#ifndef _AMIGA_SYS_RESOURCE_H
#define _AMIGA_SYS_RESOURCE_H

#include <sys/time.h>   /* for struct timeval */

typedef unsigned long rlim_t;

struct rlimit {
    rlim_t rlim_cur;
    rlim_t rlim_max;
};

struct rusage {
    struct timeval ru_utime; /* user time used */
    struct timeval ru_stime; /* system time used */
};

#define RLIMIT_STACK  3
#define RLIM_INFINITY ((rlim_t)-1)

#define RUSAGE_SELF     0
#define RUSAGE_CHILDREN (-1)

int getrlimit(int resource, struct rlimit *rlp);
int setrlimit(int resource, const struct rlimit *rlp);
int getrusage(int who, struct rusage *usage);

#endif /* _AMIGA_SYS_RESOURCE_H */
