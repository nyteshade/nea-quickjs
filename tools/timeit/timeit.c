/*
 * timeit - time an AmigaDOS command with the system clock.
 *
 *   timeit [COUNT=n] <command line>
 *
 * Runs the command n times (default 1) through the Shell and prints
 * how long each run took in milliseconds, then the fastest and the
 * slowest. The clock is timer.device's system time, which counts
 * microseconds.
 *
 * It exists because AmigaDOS has no stopwatch for a command, and
 * because timing qjs from inside qjs cannot show two things: the cost
 * of loading quickjs.library from disk (the timing script has already
 * loaded it) and the true start-up time (launching a second qjs from
 * the first adds its own overhead). This program is plain C, uses no
 * floating point and needs only Kickstart 2.04 on any 68000.
 *
 * To time a cold load, flush the library first:
 *   avail flush
 *   timeit qjs -e 1
 * and compare with the same command run again straight after.
 *
 * Each run includes the Shell starting the program, which this
 * program cannot separate out; `timeit COUNT=5 version` gives a
 * feeling for that overhead on the machine.
 *
 * Build (on the Mac):
 *   vc +aos68k -cpu=68000 -O1 -o amiga/c/timeit tools/timeit/timeit.c -lamiga
 */

#include <exec/types.h>
#include <exec/io.h>
#include <devices/timer.h>
#include <dos/dos.h>
#include <dos/dostags.h>
#include <dos/rdargs.h>
#include <proto/exec.h>
#include <proto/dos.h>
#include <proto/timer.h>

static const char version[] = "$VER: timeit 1.0 (12.11.2026)";

/* ReadArgs: an optional numeric keyword, then the rest of the line. */
#define TEMPLATE "COUNT/K/N,COMMAND/A/F"

enum { ARG_COUNT, ARG_COMMAND, ARG_TOTAL };

#define MICROS_PER_MILLI  1000UL
#define MILLIS_PER_SECOND 1000UL
#define MAX_RUNS          1000L

struct Device *TimerBase;

/* Milliseconds from `before` to `after`, rounded to the nearest. */
static ULONG elapsed_ms(const struct timeval *before,
                        const struct timeval *after)
{
    struct timeval difference = *after;

    SubTime(&difference, (struct timeval *)before);

    return difference.tv_secs * MILLIS_PER_SECOND +
           (difference.tv_micro + MICROS_PER_MILLI / 2) / MICROS_PER_MILLI;
}

int main(void)
{
    LONG arguments[ARG_TOTAL] = { 0, 0 };
    struct RDArgs *parsed;
    struct timerequest request;
    struct timeval before, after;
    LONG count = 1, run, result = RETURN_OK;
    ULONG fastest = 0xFFFFFFFFUL, slowest = 0;
    STRPTR command;

    parsed = ReadArgs((STRPTR)TEMPLATE, arguments, NULL);
    if (!parsed) {
        PrintFault(IoErr(), (STRPTR)"timeit");
        Printf((STRPTR)"Usage: timeit [COUNT=n] <command line>\n");
        return RETURN_FAIL;
    }

    if (arguments[ARG_COUNT])
        count = *(LONG *)arguments[ARG_COUNT];
    if (count < 1) count = 1;
    if (count > MAX_RUNS) count = MAX_RUNS;

    command = (STRPTR)arguments[ARG_COMMAND];

    /* Only GetSysTime is used, which needs the device base and no
     * message port. */
    if (OpenDevice((STRPTR)TIMERNAME, UNIT_VBLANK,
                   (struct IORequest *)&request, 0) != 0) {
        Printf((STRPTR)"timeit: cannot open timer.device\n");
        FreeArgs(parsed);
        return RETURN_FAIL;
    }

    TimerBase = request.tr_node.io_Device;

    for (run = 1; run <= count; run++) {
        ULONG ms;
        LONG status;

        GetSysTime(&before);
        status = SystemTagList(command, NULL);
        GetSysTime(&after);

        if (status == -1) {
            Printf((STRPTR)"timeit: could not run \"%s\"\n", (LONG)command);
            result = RETURN_FAIL;
            break;
        }

        ms = elapsed_ms(&before, &after);
        if (ms < fastest) fastest = ms;
        if (ms > slowest) slowest = ms;

        Printf((STRPTR)"run %ld: %lu ms (return code %ld)\n", run, ms, status);

        if (CheckSignal(SIGBREAKF_CTRL_C)) {
            Printf((STRPTR)"*** Break\n");
            result = RETURN_WARN;
            break;
        }
    }

    if (count > 1 && slowest != 0)
        Printf((STRPTR)"fastest %lu ms, slowest %lu ms\n", fastest, slowest);

    CloseDevice((struct IORequest *)&request);
    FreeArgs(parsed);

    return result;
}
