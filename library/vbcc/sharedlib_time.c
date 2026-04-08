/*
 * sharedlib_time.c — Time functions for shared library context.
 *
 * gettimeofday: uses DateStamp from dos.library via the global
 * DOSBase (see note below about the one necessary global).
 *
 * localtime_r/gmtime_r: wrappers around single-threaded
 * localtime/gmtime (AmigaOS is single-tasking per process).
 *
 * mktime: calendar-to-epoch conversion.
 *
 * NOTE ON GLOBALS: These functions are called from deep inside
 * the QuickJS engine with no library base context. DateStamp
 * requires DOSBase. We store DOSBase as a file-scope variable
 * set during init. This is the minimum viable approach — the
 * alternative requires modifying every time-related call in the
 * 60,000-line QuickJS engine.
 */

#include <exec/types.h>
#include <dos/dos.h>
#include <string.h>
#include <time.h>

/* sys/time.h from our include/ stub */
#include <sys/time.h>

/* DOSBase — set via sharedlib_time_init() from CustomLibInit.
 * dos.library DateStamp LVO: -192 */
static struct Library *sl_DOSBase;

void sharedlib_time_init(struct Library *dosBase)
{
    sl_DOSBase = dosBase;
}

void sharedlib_time_cleanup(void)
{
    sl_DOSBase = NULL;
}

/* DateStamp — dos.library LVO -192
 * Uses VBCC inline assembly syntax which embeds `jsr -192(a6)` directly
 * at the call site, sidestepping the __reg("a6") frame pointer issue
 * that affects function-pointer dispatch. */
static struct DateStamp * __sl_DateStamp(
    __reg("a6") struct Library *base,
    __reg("d1") struct DateStamp *ds) = "\tjsr\t-192(a6)";

#define sl_DateStamp(ds) __sl_DateStamp(sl_DOSBase, (ds))

/* AmigaOS epoch: Jan 1, 1978. Unix epoch: Jan 1, 1970.
 * 8 years = 2922 days (includes leap years 72, 76) */
#define AMIGA_UNIX_EPOCH_DIFF 252460800L

int gettimeofday(struct timeval *tv, void *tz)
{
    struct DateStamp ds;

    if (!tv || !sl_DOSBase)
        return -1;

    sl_DateStamp(&ds);

    tv->tv_sec = (long)ds.ds_Days * 86400L
               + (long)ds.ds_Minute * 60L
               + (long)ds.ds_Tick / 50L
               + AMIGA_UNIX_EPOCH_DIFF;
    tv->tv_usec = ((long)ds.ds_Tick % 50L) * 20000L;
    return 0;
}

/* ---- localtime_r / gmtime_r ---- */

/* Days in each month (non-leap) */
static const int mdays[12] = {31,28,31,30,31,30,31,31,30,31,30,31};

static int is_leap(int y)
{
    return (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
}

/* Minimal gmtime_r: break Unix timestamp into struct tm (UTC) */
struct tm *gmtime_r(const long *timep, struct tm *result)
{
    long t = *timep;
    int days, y, m;

    if (!result) return NULL;

    result->tm_sec  = (int)(t % 60); t /= 60;
    result->tm_min  = (int)(t % 60); t /= 60;
    result->tm_hour = (int)(t % 24);
    days = (int)(t / 24);

    /* Day of week: Jan 1, 1970 was Thursday (4) */
    result->tm_wday = (int)((days + 4) % 7);

    /* Year */
    y = 1970;
    for (;;) {
        int ydays = is_leap(y) ? 366 : 365;
        if (days < ydays) break;
        days -= ydays;
        y++;
    }
    result->tm_year = y - 1900;
    result->tm_yday = days;

    /* Month */
    for (m = 0; m < 11; m++) {
        int md = mdays[m];
        if (m == 1 && is_leap(y)) md = 29;
        if (days < md) break;
        days -= md;
    }
    result->tm_mon = m;
    result->tm_mday = days + 1;
    result->tm_isdst = 0;

    return result;
}

/* AmigaOS has no timezone support — localtime = gmtime */
struct tm *localtime_r(const long *timep, struct tm *result)
{
    return gmtime_r(timep, result);
}

/* ---- mktime ---- */

long mktime(struct tm *tm)
{
    int y, m;
    long days;

    if (!tm) return -1;

    y = tm->tm_year + 1900;
    m = tm->tm_mon;

    /* Normalize month */
    while (m < 0)  { m += 12; y--; }
    while (m >= 12) { m -= 12; y++; }

    /* Days from 1970 to start of year */
    days = 0;
    if (y > 1970) {
        int i;
        for (i = 1970; i < y; i++)
            days += is_leap(i) ? 366 : 365;
    } else {
        int i;
        for (i = y; i < 1970; i++)
            days -= is_leap(i) ? 366 : 365;
    }

    /* Days in months of this year */
    {
        int i;
        for (i = 0; i < m; i++) {
            days += mdays[i];
            if (i == 1 && is_leap(y)) days++;
        }
    }

    days += tm->tm_mday - 1;

    return days * 86400L + tm->tm_hour * 3600L
         + tm->tm_min * 60L + tm->tm_sec;
}
