/*
 * sys/time.h — POSIX time stub for VBCC on AmigaOS
 *
 * Provides struct timeval and gettimeofday() declaration.
 * Implementation in src/amiga_compat_vbcc.c.
 */
#ifndef _SYS_TIME_H
#define _SYS_TIME_H

/* Prevent AmigaOS devices/timer.h from defining conflicting timeval */
#ifndef __USE_NEW_TIMEVAL__
#define __USE_NEW_TIMEVAL__ 1
#endif

struct timeval {
    long tv_sec;
    long tv_usec;
};

struct timezone {
    int tz_minuteswest;
    int tz_dsttime;
};

int gettimeofday(struct timeval *tv, void *tz);

#endif /* _SYS_TIME_H */
