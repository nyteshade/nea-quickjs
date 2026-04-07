/*
 * sharedlib_clib.c — Standard C library functions for shared library context.
 *
 * Provides errno, strerror, strspn, strtol, getenv, setenv, unsetenv,
 * open/close/read/write/lseek (fd-level I/O), sscanf.
 * Uses dos.library for file I/O, exec.library for nothing.
 */

struct Library;
extern struct Library *sl_DOSBase;

#include <stddef.h>
#include <stdarg.h>
#include <string.h>

/* ---- errno ---- */
int errno = 0;

/* ---- strerror ---- */
static const char *_errmsg[] = {
    "Success",                  /* 0 */
    "Operation not permitted",  /* EPERM 1 */
    "No such file or directory",/* ENOENT 2 */
    "No such process",          /* ESRCH 3 */
    "Interrupted system call",  /* EINTR 4 */
    "I/O error",                /* EIO 5 */
    "No such device or address",/* ENXIO 6 */
    "Argument list too long",   /* E2BIG 7 */
    "Exec format error",        /* ENOEXEC 8 */
    "Bad file descriptor",      /* EBADF 9 */
    "No child processes",       /* ECHILD 10 */
    "Resource deadlock avoided",/* EDEADLK 11 */
    "Cannot allocate memory",   /* ENOMEM 12 */
    "Permission denied",        /* EACCES 13 */
    "Bad address",              /* EFAULT 14 */
    "Block device required",    /* ENOTBLK 15 */
    "Device or resource busy",  /* EBUSY 16 */
    "File exists",              /* EEXIST 17 */
    "Cross-device link",        /* EXDEV 18 */
    "No such device",           /* ENODEV 19 */
    "Not a directory",          /* ENOTDIR 20 */
    "Is a directory",           /* EISDIR 21 */
    "Invalid argument",         /* EINVAL 22 */
    "Too many open files in system",/* ENFILE 23 */
    "Too many open files",      /* EMFILE 24 */
    "Inappropriate ioctl",      /* ENOTTY 25 */
    "Text file busy",           /* ETXTBSY 26 */
    "File too large",           /* EFBIG 27 */
    "No space left on device",  /* ENOSPC 28 */
    "Illegal seek",             /* ESPIPE 29 */
    "Read-only file system",    /* EROFS 30 */
    "Too many links",           /* EMLINK 31 */
    "Broken pipe",              /* EPIPE 32 */
    "Math argument out of domain",/* EDOM 33 */
    "Result too large",         /* ERANGE 34 */
};

char *strerror(int errnum)
{
    if (errnum >= 0 && errnum <= 34)
        return (char *)_errmsg[errnum];
    return "Unknown error";
}

/* ---- strspn ---- */
size_t strspn(const char *s, const char *accept)
{
    const char *p;
    const char *a;
    size_t count = 0;

    for (p = s; *p; p++) {
        for (a = accept; *a; a++) {
            if (*p == *a) break;
        }
        if (!*a) break;
        count++;
    }
    return count;
}

/* ---- strtol ---- */
long strtol(const char *nptr, char **endptr, int base)
{
    const char *s = nptr;
    long result = 0;
    int neg = 0;
    int c;

    /* skip whitespace */
    while (*s == ' ' || *s == '\t' || *s == '\n' || *s == '\r') s++;

    /* sign */
    if (*s == '-') { neg = 1; s++; }
    else if (*s == '+') { s++; }

    /* auto-detect base */
    if (base == 0) {
        if (*s == '0') {
            s++;
            if (*s == 'x' || *s == 'X') { base = 16; s++; }
            else { base = 8; }
        } else {
            base = 10;
        }
    } else if (base == 16 && *s == '0' && (s[1] == 'x' || s[1] == 'X')) {
        s += 2;
    }

    while (*s) {
        c = *s;
        if (c >= '0' && c <= '9') c -= '0';
        else if (c >= 'a' && c <= 'z') c = c - 'a' + 10;
        else if (c >= 'A' && c <= 'Z') c = c - 'A' + 10;
        else break;
        if (c >= base) break;
        result = result * base + c;
        s++;
    }

    if (endptr) *endptr = (char *)s;
    return neg ? -result : result;
}

/* ---- getenv / setenv / unsetenv ---- */
/* On AmigaOS, use dos.library GetVar/SetVar via LVO */

#define DOS_LVO(base, off, proto) \
    ((proto)(((char *)(base)) - (off)))

/* GetVar - LVO -906 */
static long dos_GetVar(const char *name, char *buf, long size, long flags)
{
    if (!sl_DOSBase) return -1;
    return DOS_LVO(sl_DOSBase, 906,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") const char *,
                 __reg("d2") char *,
                 __reg("d3") long,
                 __reg("d4") long))(sl_DOSBase, name, buf, size, flags);
}

static char _getenv_buf[256];

char *getenv(const char *name)
{
    long r;
    if (!name) return NULL;
    r = dos_GetVar(name, _getenv_buf, sizeof(_getenv_buf), 0);
    if (r < 0) return NULL;
    return _getenv_buf;
}

int setenv(const char *name, const char *value, int overwrite)
{
    /* SetVar - LVO -912 */
    long len;
    if (!sl_DOSBase || !name || !value) return -1;
    if (!overwrite) {
        if (dos_GetVar(name, _getenv_buf, 4, 0) >= 0) return 0;
    }
    len = (long)strlen(value);
    DOS_LVO(sl_DOSBase, 912,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") const char *,
                 __reg("d2") const char *,
                 __reg("d3") long,
                 __reg("d4") long))(sl_DOSBase, name, value, len, 0);
    return 0;
}

int unsetenv(const char *name)
{
    /* DeleteVar - LVO -918 */
    if (!sl_DOSBase || !name) return -1;
    DOS_LVO(sl_DOSBase, 918,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") const char *,
                 __reg("d2") long))(sl_DOSBase, name, 0);
    return 0;
}

/* ---- fd-level I/O (open/close/read/write/lseek) ---- */
/* Minimal implementation mapping fd to dos.library BPTR.
 * Uses a simple fd table. fd 0=stdin, 1=stdout, 2=stderr. */

#define MAX_FDS 64
static long _fd_table[MAX_FDS];
static int _fd_used[MAX_FDS];

/* LVO offsets for dos.library file operations */
static long dos_Open_raw(const char *name, long mode)
{
    return DOS_LVO(sl_DOSBase, 30,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") const char *,
                 __reg("d2") long))(sl_DOSBase, name, mode);
}

static void dos_Close_raw(long fh)
{
    DOS_LVO(sl_DOSBase, 36,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long))(sl_DOSBase, fh);
}

static long dos_Read_raw(long fh, void *buf, long len)
{
    return DOS_LVO(sl_DOSBase, 42,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long,
                 __reg("d2") void *,
                 __reg("d3") long))(sl_DOSBase, fh, buf, len);
}

static long dos_Write_raw(long fh, const void *buf, long len)
{
    return DOS_LVO(sl_DOSBase, 48,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long,
                 __reg("d2") const void *,
                 __reg("d3") long))(sl_DOSBase, fh, buf, len);
}

static long dos_Seek_raw(long fh, long pos, long mode)
{
    return DOS_LVO(sl_DOSBase, 66,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long,
                 __reg("d2") long,
                 __reg("d3") long))(sl_DOSBase, fh, pos, mode);
}

static long dos_Input_raw(void)
{
    return DOS_LVO(sl_DOSBase, 54,
        long (*)(__reg("a6") struct Library *))(sl_DOSBase);
}

static long dos_Output_raw(void)
{
    return DOS_LVO(sl_DOSBase, 60,
        long (*)(__reg("a6") struct Library *))(sl_DOSBase);
}

void sharedlib_clib_init(void)
{
    int i;
    for (i = 0; i < MAX_FDS; i++) {
        _fd_table[i] = 0;
        _fd_used[i] = 0;
    }
    if (sl_DOSBase) {
        _fd_table[0] = dos_Input_raw();  _fd_used[0] = 1;
        _fd_table[1] = dos_Output_raw(); _fd_used[1] = 1;
        _fd_table[2] = dos_Output_raw(); _fd_used[2] = 1;
    }
}

static int alloc_fd(long fh)
{
    int i;
    for (i = 3; i < MAX_FDS; i++) {
        if (!_fd_used[i]) {
            _fd_table[i] = fh;
            _fd_used[i] = 1;
            return i;
        }
    }
    return -1;
}

/* fcntl.h constants */
#ifndef O_RDONLY
#define O_RDONLY 0
#define O_WRONLY 1
#define O_RDWR   2
#define O_CREAT  0x200
#define O_TRUNC  0x400
#define O_APPEND 0x008
#endif

int open(const char *path, int flags, ...)
{
    long fh;
    long mode;

    if (!sl_DOSBase || !path) { errno = 22; return -1; }

    if ((flags & 3) == O_RDONLY) mode = 1005L; /* MODE_OLDFILE */
    else if (flags & O_CREAT)   mode = 1006L; /* MODE_NEWFILE */
    else                        mode = 1004L; /* MODE_READWRITE */

    fh = dos_Open_raw(path, mode);
    if (!fh) { errno = 2; return -1; }

    if (flags & O_APPEND) dos_Seek_raw(fh, 0, 1); /* OFFSET_END */

    return alloc_fd(fh);
}

int close(int fd)
{
    if (fd < 0 || fd >= MAX_FDS || !_fd_used[fd]) { errno = 9; return -1; }
    if (fd >= 3 && _fd_table[fd]) dos_Close_raw(_fd_table[fd]);
    _fd_used[fd] = 0;
    _fd_table[fd] = 0;
    return 0;
}

int read(int fd, void *buf, size_t count)
{
    if (fd < 0 || fd >= MAX_FDS || !_fd_used[fd]) { errno = 9; return -1; }
    return (int)dos_Read_raw(_fd_table[fd], buf, (long)count);
}

int write(int fd, const void *buf, size_t count)
{
    if (fd < 0 || fd >= MAX_FDS || !_fd_used[fd]) { errno = 9; return -1; }
    return (int)dos_Write_raw(_fd_table[fd], buf, (long)count);
}

long lseek(int fd, long offset, int whence)
{
    long old;
    if (fd < 0 || fd >= MAX_FDS || !_fd_used[fd]) { errno = 9; return -1; }
    /* SEEK_SET=-1, SEEK_CUR=0, SEEK_END=1 — matches dos.library */
    old = dos_Seek_raw(_fd_table[fd], offset, (long)whence);
    /* dos.library Seek returns OLD position. To get current, seek again */
    if (whence == 0) return old + offset; /* SEEK_CUR: old + delta */
    return dos_Seek_raw(_fd_table[fd], 0, 0); /* seek 0 from current = get pos */
}

/* sysconf — minimal */
long sysconf(int name)
{
    (void)name;
    return -1;
}

/* ---- sscanf ---- */
/* Minimal sscanf supporting %d, %ld, %x, %s, %c, %n */
int sscanf(const char *str, const char *fmt, ...)
{
    va_list ap;
    int count = 0;
    const char *s = str;
    const char *f = fmt;

    va_start(ap, fmt);

    while (*f && *s) {
        if (*f == '%') {
            f++;
            /* skip width */
            while (*f >= '0' && *f <= '9') f++;
            /* skip 'l' modifier */
            if (*f == 'l') f++;

            switch (*f) {
            case 'd': {
                long *p = va_arg(ap, long *);
                char *end;
                *p = strtol(s, &end, 10);
                if (end == s) goto done;
                s = end;
                count++;
                break;
            }
            case 'x': case 'X': {
                long *p = va_arg(ap, long *);
                char *end;
                *p = strtol(s, &end, 16);
                if (end == s) goto done;
                s = end;
                count++;
                break;
            }
            case 's': {
                char *p = va_arg(ap, char *);
                while (*s && *s != ' ' && *s != '\t' && *s != '\n')
                    *p++ = *s++;
                *p = '\0';
                count++;
                break;
            }
            case 'c': {
                char *p = va_arg(ap, char *);
                *p = *s++;
                count++;
                break;
            }
            case 'n': {
                int *p = va_arg(ap, int *);
                *p = (int)(s - str);
                break;
            }
            default:
                goto done;
            }
            f++;
        } else if (*f == ' ') {
            while (*s == ' ' || *s == '\t') s++;
            f++;
        } else {
            if (*f != *s) goto done;
            f++; s++;
        }
    }

done:
    va_end(ap);
    return count;
}

/* ---- VBCC printf internals ---- */
/* Referenced by VBCC's stdio.h putc/getc macros */
void __v0printf(void) {}
void __v0fprintf(void) {}
