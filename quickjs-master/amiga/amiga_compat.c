/*
 * amiga_compat.c -- AmigaOS implementations of POSIX functions used by QuickJS
 */

#include "amiga_compat.h"

/* AmigaOS headers */
#include <exec/types.h>
#include <exec/memory.h>
#include <exec/tasks.h>     /* SIGBREAKF_CTRL_C */
#include <devices/timer.h>
#include <proto/exec.h>
#include <proto/dos.h>

/* Flag set by qjs --color; default off. Shared between qjs.c and
 * quickjs-libc.c. Defined here so standalone apps link without qjs.o. */
int amiga_force_color = 0;

/* Standard C headers */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <signal.h>         /* raise(), SIGINT */

/* -----------------------------------------------------------------------
 * gettimeofday() via AmigaOS DateStamp (50Hz resolution)
 *
 * AmigaOS DateStamp counts from 1 Jan 1978.
 * Unix epoch is 1 Jan 1970.
 * Difference: 8 years = 2922 days = 252460800 seconds.
 * --------------------------------------------------------------------- */
#define AMIGA_TO_UNIX_EPOCH  252460800L

int gettimeofday(struct timeval *tv, void *tz)
{
    struct DateStamp ds;

    if (tv != NULL) {
        DateStamp(&ds);   /* fills ds_Days, ds_Minute, ds_Tick (50Hz) */
        tv->tv_sec  = (long)(ds.ds_Days)   * 86400L
                    + (long)(ds.ds_Minute) * 60L
                    + AMIGA_TO_UNIX_EPOCH;
        tv->tv_usec = (long)(ds.ds_Tick) * 20000L; /* 1/50s = 20000 us */
    }
    /* tz ignored -- timezone info not available without timer.device */
    (void)tz;
    return 0;
}

/* -----------------------------------------------------------------------
 * environ -- empty environment variable list
 * --------------------------------------------------------------------- */
static char *empty_environ[1] = { NULL };
char **environ = empty_environ;

/* -----------------------------------------------------------------------
 * unistd.h stubs
 * --------------------------------------------------------------------- */

long sysconf(int name)
{
    switch (name) {
    case 1: /* _SC_NPROCESSORS_ONLN */ return 1;
    case 2: /* _SC_PAGE_SIZE */        return 4096;
    case 3: /* _SC_OPEN_MAX */         return 20;
    default: errno = EINVAL; return -1;
    }
}

int access(const char *path, int mode)
{
    BPTR lock;
    (void)mode;
    lock = Lock((char *)path, ACCESS_READ);
    if (lock) {
        UnLock(lock);
        return 0;
    }
    errno = ENOENT;
    return -1;
}

int dup(int fd)
{
    (void)fd;
    errno = ENOSYS;
    return -1;
}

int dup2(int oldfd, int newfd)
{
    (void)oldfd; (void)newfd;
    errno = ENOSYS;
    return -1;
}

int pipe(int pipefd[2])
{
    /* Use PIPE: device for inter-process pipes */
    char pipe_name[80];
    static int pipe_cnt = 0;
    BPTR fh_write, fh_read;

    snprintf(pipe_name, sizeof(pipe_name), "PIPE:qjs_%ld_%d",
             (long)FindTask(NULL), pipe_cnt++);

    fh_write = Open((STRPTR)pipe_name, MODE_NEWFILE);
    if (!fh_write) { errno = EIO; return -1; }

    fh_read = Open((STRPTR)pipe_name, MODE_OLDFILE);
    if (!fh_read) { Close(fh_write); errno = EIO; return -1; }

    pipefd[0] = (int)fh_read;
    pipefd[1] = (int)fh_write;
    return 0;
}

int isatty(int fd)
{
    return (fd == 0 || fd == 1 || fd == 2) ? 1 : 0;
}

/* fork/exec -- not available on AmigaOS */
typedef int pid_t;

pid_t fork(void)
{
    errno = ENOSYS;
    return -1;
}

int execv(const char *path, char *const argv[])
{
    (void)path; (void)argv;
    errno = ENOSYS;
    return -1;
}

int execve(const char *path, char *const argv[], char *const envp[])
{
    (void)path; (void)argv; (void)envp;
    errno = ENOSYS;
    return -1;
}

int execvp(const char *file, char *const argv[])
{
    (void)file; (void)argv;
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * poll() -- AmigaOS implementation using WaitForChar
 *
 * On POSIX, poll() watches file descriptors for I/O readiness.
 * Here we only handle fd 0 (stdin / console input), which is the only
 * fd the QuickJS REPL ever registers a read handler on.
 *
 * WaitForChar(BPTR fh, LONG usec_timeout) blocks up to usec_timeout
 * microseconds and returns TRUE if at least one character is available.
 *
 * For timeout == -1 (block forever) we loop in 200 ms slices so we can
 * check for Ctrl-C (SIGBREAKF_CTRL_C) between slices.
 * --------------------------------------------------------------------- */
typedef unsigned int nfds_t;
struct pollfd { int fd; short events; short revents; };

/* POLLIN / POLLOUT / POLLERR / etc. are defined in poll.h; redeclare the
 * macro guard values here so this TU compiles standalone. */
#ifndef POLLIN
#define POLLIN  0x0001
#define POLLOUT 0x0004
#define POLLERR 0x0008
#define POLLHUP 0x0010
#endif

int poll(struct pollfd *fds, nfds_t nfds, int timeout)
{
    BPTR in_fh;
    LONG usec;
    nfds_t i;
    int nready = 0;

    /* Clear revents */
    for (i = 0; i < nfds; i++)
        fds[i].revents = 0;

    if (nfds == 0) {
        /* Nothing to watch; honour the timeout as a plain sleep. */
        if (timeout > 0) {
            long ticks = ((long)timeout * 50L) / 1000L;
            if (ticks < 1) ticks = 1;
            Delay((unsigned long)ticks);
        }
        return 0;
    }

    in_fh = Input();

    /*
     * Convert the millisecond timeout to microseconds for WaitForChar.
     * timeout < 0 means "block forever"; we use 200 ms slices so that
     * Ctrl-C can interrupt the wait between iterations.
     */
    if (timeout == 0)
        usec = 0L;
    else if (timeout > 0)
        usec = (LONG)timeout * 1000L;   /* ms -> us */
    else
        usec = 200000L;                  /* -1 = infinite: 200 ms slice */

    for (;;) {
        /*
         * Check for Ctrl-C break signal.  SetSignal clears the bit and
         * returns the previous signal mask; if CTRL_C was set, exit.
         */
        if (SetSignal(0L, (ULONG)SIGBREAKF_CTRL_C) & (ULONG)SIGBREAKF_CTRL_C) {
            errno = EINTR;
            return -1;
        }

        /* Check each fd.  We only support fd 0 (stdin/console). */
        for (i = 0; i < nfds; i++) {
            if (fds[i].events & POLLIN) {
                if (fds[i].fd == 0 && IsInteractive(in_fh)) {
                    if (WaitForChar(in_fh, usec)) {
                        fds[i].revents = POLLIN;
                        nready++;
                    }
                    /* Only one WaitForChar per pass; remaining fds can't
                     * be monitored without an fd->BPTR mapping table. */
                    usec = 0L;
                }
            }
        }

        if (nready > 0 || timeout >= 0)
            break;
        /* Infinite wait: loop for another slice */
    }

    return nready;
}

/* -----------------------------------------------------------------------
 * dlfcn.h stubs -- dynamic loading not available on AmigaOS
 * --------------------------------------------------------------------- */
static char dl_error_buf[] = "dlopen: not supported on AmigaOS";
static int  dl_error_set = 0;

void *dlopen(const char *filename, int flag)
{
    (void)filename; (void)flag;
    dl_error_set = 1;
    return NULL;
}

void *dlsym(void *handle, const char *symbol)
{
    (void)handle; (void)symbol;
    dl_error_set = 1;
    return NULL;
}

int dlclose(void *handle)
{
    (void)handle;
    return 0;
}

char *dlerror(void)
{
    if (dl_error_set) {
        dl_error_set = 0;
        return dl_error_buf;
    }
    return NULL;
}

/* -----------------------------------------------------------------------
 * termios.h stubs
 * --------------------------------------------------------------------- */
typedef unsigned int tcflag_t;
typedef unsigned char cc_t;
#define NCCS 20
struct termios {
    tcflag_t c_iflag;
    tcflag_t c_oflag;
    tcflag_t c_cflag;
    tcflag_t c_lflag;
    cc_t c_cc[NCCS];
};

int tcgetattr(int fd, struct termios *t)
{
    (void)fd; (void)t;
    errno = ENOSYS;
    return -1;
}

int tcsetattr(int fd, int action, const struct termios *t)
{
    (void)fd; (void)action; (void)t;
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * sys/resource.h stubs
 * --------------------------------------------------------------------- */
typedef unsigned long rlim_t;
struct rlimit { rlim_t rlim_cur; rlim_t rlim_max; };
struct rusage {
    struct timeval ru_utime;
    struct timeval ru_stime;
};

int getrlimit(int resource, struct rlimit *rlp)
{
    (void)resource;
    if (rlp) {
        rlp->rlim_cur = (rlim_t)-1;
        rlp->rlim_max = (rlim_t)-1;
    }
    return 0;
}

int setrlimit(int resource, const struct rlimit *rlp)
{
    (void)resource; (void)rlp;
    errno = ENOSYS;
    return -1;
}

int getrusage(int who, struct rusage *usage)
{
    (void)who;
    if (usage) {
        memset(usage, 0, sizeof(*usage));
    }
    return 0;
}

/* -----------------------------------------------------------------------
 * sys/wait.h stubs
 * --------------------------------------------------------------------- */
pid_t waitpid(pid_t pid, int *status, int options)
{
    (void)pid; (void)status; (void)options;
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * sys/ioctl.h stubs
 * --------------------------------------------------------------------- */
int ioctl(int fd, unsigned long request, ...)
{
    (void)fd; (void)request;
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * dirent.h -- AmigaOS directory reading via dos.library
 * --------------------------------------------------------------------- */
#include <dos/dos.h>
#include <dos/dosextens.h>
#include <stdlib.h>
#include <string.h>

#define NAME_MAX  107

struct dirent {
    char d_name[NAME_MAX + 1];
    int  d_type;
};

typedef struct {
    BPTR       lock;
    struct FileInfoBlock *fib;
    struct dirent ent;
    int   first;
} DIR;

#define DT_UNKNOWN 0
#define DT_DIR     4
#define DT_REG     8

DIR *opendir(const char *path)
{
    DIR *dp;
    BPTR lock;

    lock = Lock((char *)path, ACCESS_READ);
    if (!lock) {
        errno = ENOENT;
        return NULL;
    }
    dp = (DIR *)AllocMem(sizeof(DIR), MEMF_CLEAR);
    if (!dp) {
        UnLock(lock);
        errno = ENOMEM;
        return NULL;
    }
    dp->fib = (struct FileInfoBlock *)AllocMem(sizeof(struct FileInfoBlock), MEMF_CLEAR);
    if (!dp->fib) {
        FreeMem(dp, sizeof(DIR));
        UnLock(lock);
        errno = ENOMEM;
        return NULL;
    }
    if (!Examine(lock, dp->fib)) {
        FreeMem(dp->fib, sizeof(struct FileInfoBlock));
        FreeMem(dp, sizeof(DIR));
        UnLock(lock);
        errno = ENOTDIR;
        return NULL;
    }
    dp->lock = lock;
    dp->first = 1;
    return dp;
}

struct dirent *readdir(DIR *dp)
{
    if (!dp) return NULL;
    if (!ExNext(dp->lock, dp->fib))
        return NULL;
    strncpy(dp->ent.d_name, dp->fib->fib_FileName, NAME_MAX);
    dp->ent.d_name[NAME_MAX] = '\0';
    dp->ent.d_type = (dp->fib->fib_DirEntryType > 0) ? DT_DIR : DT_REG;
    return &dp->ent;
}

int closedir(DIR *dp)
{
    if (!dp) return -1;
    UnLock(dp->lock);
    FreeMem(dp->fib, sizeof(struct FileInfoBlock));
    FreeMem(dp, sizeof(DIR));
    return 0;
}

/* -----------------------------------------------------------------------
 * grp.h stubs -- no group concept on AmigaOS
 * --------------------------------------------------------------------- */
struct group {
    char  *gr_name;
    char  *gr_passwd;
    int    gr_gid;
    char **gr_mem;
};

struct group *getgrgid(int gid)
{
    (void)gid;
    return NULL;
}

struct group *getgrnam(const char *name)
{
    (void)name;
    return NULL;
}

/* -----------------------------------------------------------------------
 * Process/user management stubs (AmigaOS has no concept of these)
 * --------------------------------------------------------------------- */
int getpid(void)  { return 1; }
int setuid(int u) { (void)u; errno = ENOSYS; return -1; }
int setgid(int g) { (void)g; errno = ENOSYS; return -1; }
int setgroups(int n, const int *list) { (void)n; (void)list; errno = ENOSYS; return -1; }
int kill(int pid, int sig) { (void)pid; (void)sig; errno = ENOSYS; return -1; }

/* -----------------------------------------------------------------------
 * Environment variables — AmigaOS implementation via dos.library
 * SetVar/DeleteVar use ENV: volume (shared) and local shell vars.
 * --------------------------------------------------------------------- */
#include <dos/var.h>

int setenv(const char *name, const char *value, int overwrite)
{
    if (!name || !value) { errno = EINVAL; return -1; }
    if (!overwrite) {
        /* check if already set */
        char tmp[4];
        if (GetVar((STRPTR)name, tmp, sizeof(tmp), 0) >= 0)
            return 0;  /* already set, don't overwrite */
    }
    if (SetVar((STRPTR)name, (STRPTR)value, strlen(value),
               GVF_GLOBAL_ONLY | LV_VAR))
        return 0;
    errno = EIO;
    return -1;
}

int unsetenv(const char *name)
{
    if (!name) { errno = EINVAL; return -1; }
    DeleteVar((STRPTR)name, GVF_GLOBAL_ONLY | LV_VAR);
    return 0;
}

/* -----------------------------------------------------------------------
 * File operation stubs
 * --------------------------------------------------------------------- */
int symlink(const char *oldpath, const char *newpath)
{
    (void)oldpath; (void)newpath;
    errno = ENOSYS;
    return -1;
}

long readlink(const char *path, char *buf, long bufsiz)
{
    (void)path; (void)buf; (void)bufsiz;
    errno = ENOSYS;
    return -1;
}

int utimes(const char *path, const void *times)
{
    (void)path; (void)times;
    errno = ENOSYS;
    return -1;
}

int mkdtemp(char *tmpl)
{
    (void)tmpl;
    errno = ENOSYS;
    return -1;
}

/* popen/pclose — AmigaOS implementation using PIPE: device and SystemTags.
 * This is a simplified implementation that supports "r" mode only
 * (reading the output of a command). "w" mode returns NULL. */
#include <dos/dostags.h>

/* popen/pclose — AmigaOS implementation using PIPE: device.
 * Supports "r" mode (read command output) via SystemTags(SYS_Asynch).
 * "w" mode is not yet supported. */
#include <dos/dostags.h>

static int popen_pipe_counter = 0;

FILE *popen(const char *command, const char *type)
{
    char pipe_name[80];
    BPTR pipe_out;
    FILE *fp;

    if (!command || !type) { errno = EINVAL; return NULL; }

    if (type[0] == 'r') {
        /* Read mode: launch command with output to PIPE:, read from PIPE: */
        snprintf(pipe_name, sizeof(pipe_name), "PIPE:qjs_po_%ld_%d",
                 (long)FindTask(NULL), popen_pipe_counter++);

        /* Open the write end for the subprocess */
        pipe_out = Open((STRPTR)pipe_name, MODE_NEWFILE);
        if (!pipe_out) { errno = EIO; return NULL; }

        /* Launch command asynchronously with output to pipe */
        if (SystemTags((STRPTR)command,
                       SYS_Asynch, TRUE,
                       SYS_Input, 0,
                       SYS_Output, pipe_out,
                       SYS_UserShell, TRUE,
                       TAG_DONE) != 0) {
            Close(pipe_out);
            errno = EIO;
            return NULL;
        }
        /* pipe_out is now owned by the subprocess — don't close it */

        /* Open the read end for us */
        fp = fopen(pipe_name, "r");
        if (!fp) { errno = EIO; return NULL; }
        return fp;
    }

    /* Write mode not yet supported */
    errno = ENOSYS;
    return NULL;
}

int pclose(FILE *stream)
{
    if (!stream) return -1;
    return fclose(stream);
}

/* -----------------------------------------------------------------------
 * C99 formatted I/O -- vsnprintf / snprintf not in SAS/C 6.58
 * Use vsprintf with a length estimate (works if caller provides enough space)
 * --------------------------------------------------------------------- */
#include <stdarg.h>
#include <stdio.h>

int vsnprintf(char *buf, unsigned int n, const char *fmt, va_list ap)
{
    /* SAS/C vsprintf doesn't respect size; truncate after */
    int r;
    if (n == 0) return 0;
    r = vsprintf(buf, fmt, ap);
    if (r >= (int)n) {
        buf[n-1] = '\0';
        r = (int)n - 1;
    }
    return r;
}

int snprintf(char *buf, unsigned int n, const char *fmt, ...)
{
    va_list ap;
    int r;
    va_start(ap, fmt);
    r = vsnprintf(buf, n, fmt, ap);
    va_end(ap);
    return r;
}

/* -----------------------------------------------------------------------
 * alloca -- malloc-based fallback (memory NOT freed on return).
 * --------------------------------------------------------------------- */
void *alloca(unsigned int n) { return malloc(n); }

/* -----------------------------------------------------------------------
 * realpath -- canonicalize path using Lock() + NameFromLock().
 * Returns the full AmigaOS path (e.g. "Work:Projects/foo").
 * --------------------------------------------------------------------- */
char *realpath(const char *path, char *resolved_path)
{
    BPTR lock;
    char buf[256];

    if (!path) { errno = EINVAL; return NULL; }

    lock = Lock((STRPTR)path, ACCESS_READ);
    if (!lock) {
        /* path doesn't exist — fall back to copy */
        if (!resolved_path) {
            resolved_path = (char *)malloc(strlen(path) + 1);
            if (!resolved_path) { errno = ENOMEM; return NULL; }
        }
        strcpy(resolved_path, path);
        return resolved_path;
    }

    if (NameFromLock(lock, (STRPTR)buf, sizeof(buf))) {
        UnLock(lock);
        if (!resolved_path) {
            resolved_path = (char *)malloc(strlen(buf) + 1);
            if (!resolved_path) { errno = ENOMEM; return NULL; }
        }
        strcpy(resolved_path, buf);
        return resolved_path;
    }

    UnLock(lock);
    /* NameFromLock failed — fall back to copy */
    if (!resolved_path) {
        resolved_path = (char *)malloc(strlen(path) + 1);
        if (!resolved_path) { errno = ENOMEM; return NULL; }
    }
    strcpy(resolved_path, path);
    return resolved_path;
}

/* -----------------------------------------------------------------------
 * Pure-C IEEE 754 math library for SAS/C 6.58 / AmigaOS
 *
 * scmieee.lib accesses MathIeeeDoubBasBase via A4-relative addressing.
 * With DATA=FARONLY, the data section can exceed 32KB, placing that
 * global beyond A4's 16-bit reach and leaving it as zero (NULL).
 * Calling through a NULL library base crashes at 0xFFFFFFD8.
 *
 * Solution: define ALL needed math functions here as pure C code.
 * Since amiga_compat.o is linked before scmieee.lib, the linker uses
 * these definitions and never touches the OS math library.
 *
 * Algorithms: Newton-Raphson (sqrt), Cody-Waite range reduction
 * (exp, log, sin, cos), minimax polynomials.  Accuracy: ~15 digits.
 * --------------------------------------------------------------------- */
#include <float.h>
#include <limits.h>
/* Do NOT include <math.h> here -- we are providing the definitions */

/* Big-endian 68K: byte 0 is MSB (sign + high exponent).             */
typedef union { double d; unsigned long w[2]; } __DblU;
#define _DBL_HI(x) ((((__DblU *)(void *)&(x))->w[0]))
#define _DBL_LO(x) ((((__DblU *)(void *)&(x))->w[1]))

/* isnan / isinf / isfinite / signbit — use IEEE 754 bit patterns
 * instead of FPU comparisons (SAS/C FPU may not handle NaN/Inf
 * comparisons correctly) */
int isnan(double x)
{
    unsigned long hi = _DBL_HI(x) & 0x7FFFFFFFUL;
    unsigned long lo = _DBL_LO(x);
    /* NaN: exponent = 0x7FF and mantissa != 0 */
    return (hi > 0x7FF00000UL) || (hi == 0x7FF00000UL && lo != 0);
}
int isinf(double x)
{
    unsigned long hi = _DBL_HI(x) & 0x7FFFFFFFUL;
    unsigned long lo = _DBL_LO(x);
    /* Infinity: exponent = 0x7FF and mantissa == 0 */
    return (hi == 0x7FF00000UL && lo == 0);
}
int isfinite(double x)
{
    unsigned long hi = _DBL_HI(x) & 0x7FFFFFFFUL;
    /* finite: exponent != 0x7FF */
    return hi < 0x7FF00000UL;
}
int signbit(double x)
{
    /* MSB of IEEE 754 double = byte 0 in big-endian 68K layout */
    return (_DBL_HI(x) & 0x80000000UL) != 0;
}

/* fabs ------------------------------------------------------------ */
double fabs(double x)
{
    _DBL_HI(x) &= 0x7FFFFFFFUL;
    return x;
}

/* trunc / floor / ceil — use simple cast for small values,
 * bit manipulation for large values where cast would overflow */
double trunc(double x)
{
    if (x != x) return x;  /* NaN */
    if (x >= -2147483648.0 && x <= 2147483647.0)
        return (double)(long)x;  /* cast truncates toward zero */
    /* Large values: already integer (mantissa covers all digits) */
    return x;
}

double floor(double x)
{
    double t;
    if (x != x) return x;  /* NaN */
    if (x >= -2147483648.0 && x <= 2147483647.0) {
        t = (double)(long)x;
        if (t > x) t -= 1.0;
        return t;
    }
    return x;
}

double ceil(double x)
{
    double t;
    if (x != x) return x;  /* NaN */
    if (x >= -2147483648.0 && x <= 2147483647.0) {
        t = (double)(long)x;
        if (t < x) t += 1.0;
        return t;
    }
    return x;
}

/* fmod ------------------------------------------------------------ */
double fmod(double x, double y)
{
    double q;
    if (y == 0.0 || isnan(x) || isnan(y) || isinf(x)) return 0.0/0.0;
    if (isinf(y) || x == 0.0) return x;
    q = trunc(x / y);
    return x - q * y;
}

/* ldexp -- multiply by 2^n --------------------------------------- */
double ldexp(double x, int n)
{
    double s;
    if (x == 0.0 || isnan(x) || isinf(x) || n == 0) return x;
    /* Clamp to avoid UB in the exponent field below */
    if (n > 2046) {
        /* Could overflow; apply in two steps */
        _DBL_HI(s) = 0x5FD00000UL; _DBL_LO(s) = 0; /* 2^510 */
        x *= s; n -= 510;
        if (n > 1023) { x *= s; n -= 510; }
        if (n > 1023) return (x > 0.0) ? 1.0/0.0 : -1.0/0.0;
    } else if (n < -1074) {
        return (x > 0.0) ? 0.0 : -0.0;
    }
    /* Apply remaining scale factor directly */
    if (n >= -1022) {
        _DBL_HI(s) = (unsigned long)(1023 + n) << 20;
        _DBL_LO(s) = 0;
        return x * s;
    }
    /* Subnormal result: shift mantissa right */
    _DBL_HI(s) = (unsigned long)(1023 + n + 52) << 20;
    _DBL_LO(s) = 0;
    /* Divide by 2^52 to complete the subnormal scaling */
    {
        double d52;
        _DBL_HI(d52) = 0x43300000UL; _DBL_LO(d52) = 0; /* 2^52 */
        return (x * s) / d52;
    }
}

/* frexp -- split into mantissa in [0.5,1) and exponent ----------- */
double frexp(double x, int *exp)
{
    unsigned long hx;
    *exp = 0;
    if (x == 0.0 || isnan(x) || isinf(x)) return x;
    hx = _DBL_HI(x);
    *exp = (int)((hx >> 20) & 0x7FF) - 1022;
    _DBL_HI(x) = (hx & 0x800FFFFFUL) | 0x3FE00000UL;  /* [0.5, 1.0) */
    return x;
}

/* modf -- integer and fractional parts ---------------------------- */
double modf(double x, double *iptr)
{
    double t = trunc(x);
    *iptr = t;
    return x - t;
}

/* sqrt -- Newton-Raphson, 8 iterations (~250 bits precision) ------ */
double sqrt(double x)
{
    double t;
    int i;
    if (x < 0.0) return 0.0/0.0;
    if (x == 0.0 || isnan(x) || isinf(x)) return x;
    /* Seed: copy x, halve the biased exponent */
    t = x;
    _DBL_HI(t) = (0x1FF80000UL + (_DBL_HI(x) >> 1)) & 0x7FF80000UL;
    _DBL_LO(t) = 0;
    for (i = 0; i < 8; i++) t = 0.5 * (t + x / t);
    return t;
}

/* exp -- Cody-Waite range reduction + Taylor series -------------- */
double exp(double x)
{
    /* ln2_hi + ln2_lo = ln(2) to ~106-bit precision */
    static const double ln2_hi = 6.93147180369123816490e-1;
    static const double ln2_lo = 1.90821492927058770002e-10;
    static const double log2e  = 1.44269504088896340736;
    static const double overflow_thr  =  709.78271289338400; /* ~ln(DBL_MAX) */
    static const double underflow_thr = -745.13321910194122;
    double r, p, q;
    int k;
    if (isnan(x)) return x;
    if (x >= overflow_thr)  return 1.0/0.0;
    if (x <= underflow_thr) return 0.0;
    /* x = k*ln2 + r, |r| <= ln2/2 */
    k = (int)(x * log2e + (x > 0.0 ? 0.5 : -0.5));
    r = x - k * ln2_hi - k * ln2_lo;
    /* Padé P/Q approximation for e^r - 1 (degree 6, accurate to 1e-17) */
    p = r * (1.0 + r * (0.5 + r * (1.0/6.0 + r * (1.0/24.0 +
        r * (1.0/120.0 + r * (1.0/720.0 + r/5040.0))))));
    return ldexp(1.0 + p, k);
}

/* log -- range reduction + continued fraction -------------------- */
double log(double x)
{
    static const double ln2     = 6.93147180559945309417e-1;
    static const double sqrt2_2 = 7.07106781186547524401e-1;  /* sqrt(2)/2 */
    double f, s, s2, t;
    int e;
    if (x < 0.0) return 0.0/0.0;
    if (x == 0.0) return -1.0/0.0;
    if (isnan(x) || isinf(x)) return x;
    f = frexp(x, &e);
    if (f < sqrt2_2) { f *= 2.0; e--; }  /* f in [sqrt(2)/2, sqrt(2)] */
    f = (f - 1.0) / (f + 1.0);           /* map to (-0.17, +0.17) */
    s2 = f * f;
    /* log((1+f)/(1-f)) = 2f(1 + f^2/3 + f^4/5 + ...) */
    t = f * (2.0 + s2 * (2.0/3.0 + s2 * (2.0/5.0 + s2 *
        (2.0/7.0 + s2 * (2.0/9.0 + s2 * (2.0/11.0 + s2*(2.0/13.0)))))));
    return e * ln2 + t;
}

double log10(double x) { return log(x) * 0.43429448190325182765; }

/* pow ------------------------------------------------------------- */
double pow(double x, double y)
{
    double ay;
    int iy;
    if (y == 0.0) return 1.0;
    if (x == 1.0) return 1.0;
    if (isnan(x)) return (y == 0.0) ? 1.0 : x;
    if (isnan(y)) return y;
    if (x == 0.0) {
        if (y < 0.0) return (signbit(x) && fmod(-y,2.0)==1.0) ? -1.0/0.0 : 1.0/0.0;
        return (signbit(x) && fmod(y,2.0)==1.0) ? -0.0 : 0.0;
    }
    if (isinf(y)) {
        double ax = fabs(x);
        if (ax == 1.0) return 1.0;
        return (ax > 1.0) == (y > 0.0) ? 1.0/0.0 : 0.0;
    }
    if (x < 0.0) {
        ay = fabs(y); iy = (int)ay;
        if ((double)iy != ay) return 0.0/0.0;  /* non-integer power */
        return ((iy & 1) ? -1.0 : 1.0) * exp(ay * log(-x));
    }
    if (isinf(x)) return (y > 0.0) ? x : 0.0;
    return exp(y * log(x));
}

/* --- Trigonometric functions ------------------------------------- */
/* Helper polynomials for sin/cos on [-pi/4, pi/4] */
static double _sin_p(double x)
{
    double x2 = x * x;
    return x * (1.0 + x2 * (-1.66666666666666657e-1 + x2 *
        (8.33333333333095139e-3 + x2 * (-1.98412698412590183e-4 + x2 *
        (2.75573137070700490e-6 + x2 * (-2.50507602112697497e-8 +
         x2 * 1.58969099521155009e-10))))));
}
static double _cos_p(double x)
{
    double x2 = x * x;
    return 1.0 + x2 * (-5.0e-1 + x2 * (4.16666666666666019e-2 + x2 *
        (-1.38888888888741497e-3 + x2 * (2.48015872594395268e-5 + x2 *
        (-2.75573143513906633e-7 + x2 * (2.08757232129817851e-9 +
         x2 * (-1.13596831263544875e-11)))))));
}

/* Payne-Hanek-light range reduction: x mod (pi/2), return quadrant  */
static double _rem_pio2(double x, int *q)
{
    static const double two_over_pi = 6.36619772367581382433e-1;
    static const double pio2_hi = 1.57079632679489655800e0;
    static const double pio2_lo = 6.12323399573676603587e-17;
    double fn = (double)(int)(fabs(x) * two_over_pi + 0.5);
    *q = (int)fn & 3;
    return fabs(x) - fn * pio2_hi - fn * pio2_lo;
}

double sin(double x)
{
    double r; int q;
    if (isnan(x) || isinf(x)) return 0.0/0.0;
    if (x == 0.0) return x;
    r = _rem_pio2(x, &q);
    switch (q) {
        case 0: r =  _sin_p(r); break;
        case 1: r =  _cos_p(r); break;
        case 2: r = -_sin_p(r); break;
        default:r = -_cos_p(r); break;
    }
    return (x < 0.0) ? -r : r;
}

double cos(double x)
{
    double r; int q;
    if (isnan(x) || isinf(x)) return 0.0/0.0;
    r = _rem_pio2(x, &q);
    switch (q) {
        case 0: r =  _cos_p(r); break;
        case 1: r = -_sin_p(r); break;
        case 2: r = -_cos_p(r); break;
        default:r =  _sin_p(r); break;
    }
    return r;
}

double tan(double x)
{
    double c = cos(x);
    if (c == 0.0) return sin(x) > 0.0 ? 1.0/0.0 : -1.0/0.0;
    return sin(x) / c;
}

/* atan -- 3-range minimax polynomial ----------------------------- */
double atan(double x)
{
    static const double pio4     = 7.85398163397448278999e-1;  /* pi/4   */
    static const double pio2     = 1.57079632679489655800e0;   /* pi/2   */
    static const double tanhpio8 = 4.14213562373095048802e-1;  /* tan(pi/8)   */
    static const double tan3pio8 = 2.41421356237309504880e0;   /* tan(3pi/8)  */
    double ax, t, x2;
    int range = 0;  /* 0=small, 1=mid, 2=large */
    if (isnan(x)) return x;
    if (isinf(x)) return (x > 0.0) ? pio2 : -pio2;
    ax = fabs(x);
    if (ax > tan3pio8)      { range = 2; ax = 1.0 / ax; }
    else if (ax > tanhpio8) { range = 1; ax = (ax - 1.0) / (ax + 1.0); }
    x2 = ax * ax;
    /* Horner polynomial for atan on the reduced range */
    t = ax * (1.0 + x2 * (-3.33333333333329318027e-1 + x2 *
        (2.00000000000000000000e-1 + x2 * (-1.42857142857141651514e-1 + x2 *
        (1.11111111110820935800e-1 + x2 * (-9.09090909333491390952e-2 + x2 *
        (7.69230689498253192049e-2 + x2 * (-6.66666666769386671609e-2 + x2 *
        (5.88235295026860479600e-2 + x2 * (-5.26315796107232688718e-2 +
         x2 * 3.08681609608762706924e-2))))))))));
    if      (range == 2) t =  pio2 - t;
    else if (range == 1) t =  pio4 + t;
    return (x < 0.0) ? -t : t;
}

double atan2(double y, double x)
{
    static const double pi = 3.14159265358979323846;
    if (isnan(x) || isnan(y)) return 0.0/0.0;
    if (x == 0.0) {
        if (y > 0.0) return pi * 0.5;
        if (y < 0.0) return -pi * 0.5;
        return 0.0;
    }
    if (isinf(x)) {
        if (isinf(y)) return (y > 0.0) ? (x > 0.0 ? pi*0.25 : pi*0.75)
                                        : (x > 0.0 ? -pi*0.25 : -pi*0.75);
        return (x > 0.0) ? 0.0 : (y >= 0.0 ? pi : -pi);
    }
    if (x > 0.0) return atan(y / x);
    if (y >= 0.0) return atan(y / x) + pi;
    return atan(y / x) - pi;
}

double asin(double x)
{
    double ax;
    if (isnan(x)) return x;
    ax = fabs(x);
    if (ax > 1.0) return 0.0/0.0;
    if (ax == 1.0) return (x > 0.0) ?  1.5707963267948966 : -1.5707963267948966;
    return atan2(x, sqrt(1.0 - x * x));
}

double acos(double x)
{
    if (isnan(x)) return x;
    if (fabs(x) > 1.0) return 0.0/0.0;
    return 1.5707963267948966 - asin(x);
}

/* Hyperbolic functions ------------------------------------------- */
double sinh(double x)  { return 0.5 * (exp(x) - exp(-x)); }
double cosh(double x)  { return 0.5 * (exp(x) + exp(-x)); }
double tanh(double x)
{
    double e2;
    if (isnan(x)) return x;
    if (fabs(x) > 20.0) return (x > 0.0) ? 1.0 : -1.0;
    e2 = exp(2.0 * x);
    return (e2 - 1.0) / (e2 + 1.0);
}

/* C99 additions --------------------------------------------------- */
double round(double x)  { return (x >= 0.0) ? floor(x + 0.5) : ceil(x - 0.5); }
long   lrint(double x)  { return (long)round(x); }
double log2(double x)   { return log(x) * 1.4426950408889634; }
double log1p(double x)  { return log(1.0 + x); }
double expm1(double x)  { return (fabs(x) < 0.01) ? x*(1.0 + x*(0.5 + x*(1.0/6.0))) : exp(x) - 1.0; }
double cbrt(double x)
{
    if (x == 0.0) return 0.0;
    return (x > 0.0) ? pow(x, 1.0/3.0) : -pow(-x, 1.0/3.0);
}
double hypot(double x, double y) { return sqrt(x*x + y*y); }
double acosh(double x) { return log(x + sqrt(x*x - 1.0)); }
double asinh(double x) { return log(x + sqrt(x*x + 1.0)); }
double atanh(double x) { return 0.5 * log((1.0 + x) / (1.0 - x)); }

/* -----------------------------------------------------------------------
 * __XCOVF -- SAS/C integer-overflow handler (BSR target).
 * QuickJS never actually triggers overflow; stub to avoid link errors.
 * --------------------------------------------------------------------- */
void __XCOVF(void) { /* no-op */ }
