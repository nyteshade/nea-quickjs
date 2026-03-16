/*
 * amiga_compat.c -- AmigaOS implementations of POSIX functions used by QuickJS
 */

#include "amiga_compat.h"

/* AmigaOS headers */
#include <exec/types.h>
#include <exec/memory.h>
#include <devices/timer.h>
#include <proto/exec.h>
#include <proto/dos.h>

/* -----------------------------------------------------------------------
 * gettimeofday() via AmigaOS DateStamp (50Hz resolution)
 *
 * AmigaOS DateStamp counts from 1 Jan 1978.
 * Unix epoch is 1 Jan 1970.
 * Difference: 8 years = 2922 days = 252460800 seconds.
 * --------------------------------------------------------------------- */
#define AMIGA_TO_UNIX_EPOCH  252460800L

int gettimeofday(struct timeval *tv, struct timezone *tz)
{
    struct DateStamp ds;

    if (tv != NULL) {
        DateStamp(&ds);   /* fills ds_Days, ds_Minute, ds_Tick (50Hz) */
        tv->tv_sec  = (long)(ds.ds_Days)   * 86400L
                    + (long)(ds.ds_Minute) * 60L
                    + AMIGA_TO_UNIX_EPOCH;
        tv->tv_usec = (long)(ds.ds_Tick) * 20000L; /* 1/50s = 20000 us */
    }
    if (tz != NULL) {
        tz->tz_minuteswest = 0;
        tz->tz_dsttime     = 0;
    }
    return 0;
}
