/*
 * amiga_compat_vbcc.c — POSIX compatibility implementations for VBCC/AmigaOS
 *
 * Provides gettimeofday(), localtime_r(), gmtime_r(), and other POSIX
 * functions missing from VBCC's AmigaOS runtime (vc.lib).
 */

/* Must come before any AmigaOS headers */
#define __USE_NEW_TIMEVAL__ 1

#include <sys/time.h>
#include <time.h>
#include <string.h>

#include <exec/types.h>
#include <dos/dos.h>
#include <proto/dos.h>

/* ---- gettimeofday ---- */

/* AmigaOS epoch: Jan 1, 1978. Unix epoch: Jan 1, 1970.
 * Difference: 8 years = 2922 days (1970-1977, includes 2 leap years: 72, 76) */
#define AMIGA_UNIX_EPOCH_DIFF  252460800L  /* 2922 * 86400 */

int gettimeofday(struct timeval *tv, void *tz)
{
    struct DateStamp ds;

    if (!tv)
        return -1;

    DateStamp(&ds);

    /* ds_Days: days since Jan 1, 1978
     * ds_Minute: minutes since midnight
     * ds_Tick: ticks since last minute (50 ticks/sec) */
    tv->tv_sec = (long)ds.ds_Days * 86400L
               + (long)ds.ds_Minute * 60L
               + (long)ds.ds_Tick / 50L
               + AMIGA_UNIX_EPOCH_DIFF;
    tv->tv_usec = ((long)ds.ds_Tick % 50L) * 20000L;

    return 0;
}

/* ---- localtime_r / gmtime_r ---- */

/* Thread-safe wrappers — AmigaOS is single-process so the static
 * buffer from localtime()/gmtime() is fine, but we copy to the
 * caller's buffer for API compatibility. */

struct tm *localtime_r(const time_t *timep, struct tm *result)
{
    struct tm *tmp = localtime(timep);
    if (!tmp)
        return NULL;
    memcpy(result, tmp, sizeof(struct tm));
    return result;
}

struct tm *gmtime_r(const time_t *timep, struct tm *result)
{
    struct tm *tmp = gmtime(timep);
    if (!tmp)
        return NULL;
    memcpy(result, tmp, sizeof(struct tm));
    return result;
}

/* ---- POSIX stubs ---- */

/* isatty: fd 0/1/2 are interactive on AmigaOS (CON: handler) */
int isatty(int fd)
{
    return (fd >= 0 && fd <= 2) ? 1 : 0;
}
