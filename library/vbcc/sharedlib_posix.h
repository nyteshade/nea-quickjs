/*
 * sharedlib_posix.h -- POSIX function declarations for shared library context.
 *
 * Provides the types and function declarations that quickjs-libc.c needs.
 * All implementations use AmigaOS dos.library calls via explicit LVO
 * dispatch (no proto/dos.h, no global DOSBase from amiga.lib).
 *
 * Include this header instead of the standard POSIX headers when building
 * quickjs-libc.c for the shared library.
 */
#ifndef SHAREDLIB_POSIX_H
#define SHAREDLIB_POSIX_H

#include <stddef.h>    /* size_t */

/* ----------------------------------------------------------------
 * Forward declarations for AmigaOS types we use internally.
 * The .c file includes the real AmigaOS headers.
 * ---------------------------------------------------------------- */
struct Library;

/* ----------------------------------------------------------------
 * Initialization -- must be called from CustomLibInit with DOSBase.
 * ---------------------------------------------------------------- */
void sharedlib_posix_init(struct Library *dosBase);
void sharedlib_posix_cleanup(void);

/* ----------------------------------------------------------------
 * POSIX type definitions
 * ---------------------------------------------------------------- */

/* These match VBCC posixlib sys/types.h and sys/stat.h conventions.
 * Each type is individually guarded to avoid conflicts with any
 * standard headers that might be pulled in. */
#ifndef _SHAREDLIB_POSIX_TYPES
#define _SHAREDLIB_POSIX_TYPES

#ifndef _TIME_T_DEFINED
#define _TIME_T_DEFINED
typedef long            time_t;
#endif

#ifndef _OFF_T_DEFINED
#define _OFF_T_DEFINED
typedef long            off_t;
#endif

#ifndef __SSIZE_T
#define __SSIZE_T 1
typedef long            ssize_t;
#endif

#ifndef _MODE_T_DEFINED
#define _MODE_T_DEFINED
typedef unsigned long   mode_t;
#endif

#ifndef _DEV_T_DEFINED
#define _DEV_T_DEFINED
typedef unsigned long   dev_t;
#endif

#ifndef _INO_T_DEFINED
#define _INO_T_DEFINED
typedef unsigned long   ino_t;
#endif

#ifndef _NLINK_T_DEFINED
#define _NLINK_T_DEFINED
typedef unsigned long   nlink_t;
#endif

#ifndef _UID_T_DEFINED
#define _UID_T_DEFINED
typedef unsigned int    uid_t;
typedef unsigned int    gid_t;
#endif

#ifndef _BLKCNT_T_DEFINED
#define _BLKCNT_T_DEFINED
typedef long            blkcnt_t;
typedef unsigned long   blksize_t;
#endif

#ifndef _PID_T_DEFINED
#define _PID_T_DEFINED
typedef int             pid_t;
#endif

#endif /* _SHAREDLIB_POSIX_TYPES */

/* ----------------------------------------------------------------
 * struct stat
 * ---------------------------------------------------------------- */
#ifndef _SYS_STAT_H_
#define _SYS_STAT_H_

struct stat {
    dev_t     st_dev;
    ino_t     st_ino;
    mode_t    st_mode;
    nlink_t   st_nlink;
    uid_t     st_uid;
    gid_t     st_gid;
    dev_t     st_rdev;
    time_t    st_atime;
    time_t    st_mtime;
    time_t    st_ctime;
    off_t     st_size;
    blkcnt_t  st_blocks;
    blksize_t st_blksize;
    unsigned long st_flags;
};

/* st_mode file type bits */
#define _S_IFMT   0170000
#define _S_IFIFO  0010000
#define _S_IFCHR  0020000
#define _S_IFDIR  0040000
#define _S_IFBLK  0060000
#define _S_IFREG  0100000
#define _S_IFLNK  0120000
#define _S_IFSOCK 0140000

#define S_IFMT   _S_IFMT
#define S_IFIFO  _S_IFIFO
#define S_IFCHR  _S_IFCHR
#define S_IFDIR  _S_IFDIR
#define S_IFBLK  _S_IFBLK
#define S_IFREG  _S_IFREG
#define S_IFLNK  _S_IFLNK
#define S_IFSOCK _S_IFSOCK

/* st_mode permission bits */
#define S_ISUID 0004000
#define S_ISGID 0002000

#define S_IRWXU 0000700
#define S_IRUSR 0000400
#define S_IWUSR 0000200
#define S_IXUSR 0000100

#define S_IRWXG 0000070
#define S_IRGRP 0000040
#define S_IWGRP 0000020
#define S_IXGRP 0000010

#define S_IRWXO 0000007
#define S_IROTH 0000004
#define S_IWOTH 0000002
#define S_IXOTH 0000001

/* Type test macros */
#define S_ISDIR(m)   (((m) & _S_IFMT) == _S_IFDIR)
#define S_ISCHR(m)   (((m) & _S_IFMT) == _S_IFCHR)
#define S_ISBLK(m)   (((m) & _S_IFMT) == _S_IFBLK)
#define S_ISREG(m)   (((m) & _S_IFMT) == _S_IFREG)
#define S_ISFIFO(m)  (((m) & _S_IFMT) == _S_IFIFO)
#define S_ISLNK(m)   (((m) & _S_IFMT) == _S_IFLNK)
#define S_ISSOCK(m)  (((m) & _S_IFMT) == _S_IFSOCK)

#endif /* _SYS_STAT_H_ */

/* ----------------------------------------------------------------
 * Directory types
 * ---------------------------------------------------------------- */
#ifndef _AMIGA_DIRENT_H
#define _AMIGA_DIRENT_H

#define NAME_MAX  107   /* AmigaOS max filename length */

struct dirent {
    char d_name[NAME_MAX + 1];
    int  d_type;
};

#define DT_UNKNOWN  0
#define DT_FIFO     1
#define DT_DIR      4
#define DT_REG      8
#define DT_LNK     10

/* Opaque DIR handle -- actual struct defined in .c file */
typedef struct _AmigaDIR DIR;

#endif /* _AMIGA_DIRENT_H */

/* ----------------------------------------------------------------
 * struct timespec (for nanosleep)
 * ---------------------------------------------------------------- */
#ifndef _STRUCT_TIMESPEC
#define _STRUCT_TIMESPEC
struct timespec {
    long tv_sec;
    long tv_nsec;
};
#endif

/* ----------------------------------------------------------------
 * struct timeval (for utimes)
 * ---------------------------------------------------------------- */
#if !defined(_SYS_TIME_H_) && !defined(_SYS_TIME_H)
#define _SYS_TIME_H_ 1
#define _SYS_TIME_H 1
struct timeval {
    long tv_sec;
    long tv_usec;
};
#endif

/* ----------------------------------------------------------------
 * access() mode flags
 * ---------------------------------------------------------------- */
#ifndef F_OK
#define F_OK  0
#define R_OK  4
#define W_OK  2
#define X_OK  1
#endif

/* ----------------------------------------------------------------
 * errno values (supplement VBCC's errno.h)
 * ---------------------------------------------------------------- */
#include <errno.h>

#ifndef ENOSYS
#define ENOSYS  78
#endif
#ifndef ENOTSUP
#define ENOTSUP 45
#endif

/* ----------------------------------------------------------------
 * Signal constants — use VBCC's <signal.h> values, only define
 * if not already provided (standalone builds without signal.h)
 * ---------------------------------------------------------------- */
#include <signal.h>
#ifndef SIGTERM
#define SIGTERM 15
#endif
#ifndef SIGKILL
#define SIGKILL  9
#endif
#ifndef SIGPIPE
#define SIGPIPE 13
#endif

/* ----------------------------------------------------------------
 * poll types
 * ---------------------------------------------------------------- */
#ifndef _AMIGA_POLL_H
#define _AMIGA_POLL_H

#define POLLIN   0x0001
#define POLLOUT  0x0004
#define POLLERR  0x0008
#define POLLHUP  0x0010
#define POLLNVAL 0x0020

struct pollfd {
    int   fd;
    short events;
    short revents;
};

typedef unsigned int nfds_t;

#endif /* _AMIGA_POLL_H */

/* ----------------------------------------------------------------
 * termios types
 * ---------------------------------------------------------------- */
#ifndef _AMIGA_TERMIOS_H
#define _AMIGA_TERMIOS_H

typedef unsigned int tcflag_t;
typedef unsigned char cc_t;

#define NCCS 20

struct termios {
    tcflag_t c_iflag;
    tcflag_t c_oflag;
    tcflag_t c_cflag;
    tcflag_t c_lflag;
    cc_t     c_cc[NCCS];
};

#define ECHO    0000010
#define ICANON  0000002
#define ISIG    0000001
#define TCSANOW 0

#endif /* _AMIGA_TERMIOS_H */

/* ----------------------------------------------------------------
 * dlopen types
 * ---------------------------------------------------------------- */
#ifndef _AMIGA_DLFCN_H
#define _AMIGA_DLFCN_H

#define RTLD_LAZY    1
#define RTLD_NOW     2
#define RTLD_GLOBAL  4
#define RTLD_LOCAL   0
#define RTLD_DEFAULT ((void *)0)

#endif /* _AMIGA_DLFCN_H */

/* ----------------------------------------------------------------
 * Wait macros
 * ---------------------------------------------------------------- */
#ifndef WNOHANG
#define WNOHANG 1
#endif

#define WIFEXITED(s)    (((s) & 0x7f) == 0)
#define WEXITSTATUS(s)  (((s) >> 8) & 0xff)
#define WIFSIGNALED(s)  (((s) & 0x7f) != 0 && ((s) & 0x7f) != 0x7f)
#define WTERMSIG(s)     ((s) & 0x7f)

/* ----------------------------------------------------------------
 * rusage
 * ---------------------------------------------------------------- */
#ifndef _AMIGA_SYS_RESOURCE_H
#define _AMIGA_SYS_RESOURCE_H

struct rusage {
    struct timeval ru_utime;
    struct timeval ru_stime;
};

#define RUSAGE_SELF 0

#endif /* _AMIGA_SYS_RESOURCE_H */

/* ----------------------------------------------------------------
 * setitimer
 * ---------------------------------------------------------------- */
#define ITIMER_REAL 0

struct itimerval {
    struct timeval it_interval;
    struct timeval it_value;
};

/* ================================================================
 * Function declarations
 * ================================================================ */

/* -- File system -- */
int    stat(const char *path, struct stat *sb);
int    lstat(const char *path, struct stat *sb);
char  *getcwd(char *buf, size_t size);
int    chdir(const char *path);
int    mkdir(const char *path, mode_t mode);
int    rmdir(const char *path);
int    unlink(const char *path);
int    remove(const char *path);
int    rename(const char *oldpath, const char *newpath);
int    access(const char *path, int mode);
char  *realpath(const char *path, char *resolved);
int    utimes(const char *path, const struct timeval times[2]);

/* -- Directory -- */
DIR           *opendir(const char *path);
struct dirent *readdir(DIR *dp);
int            closedir(DIR *dp);

/* -- Sleep -- */
unsigned int sleep(unsigned int seconds);
int          usleep(unsigned long usec);
int          nanosleep(const struct timespec *req, struct timespec *rem);

/* -- Low-level FD I/O (needed by quickjs-libc.c) -- */
int    open(const char *path, int flags, ...);
int    close(int fd);
int    read(int fd, void *buf, size_t count);
int    write(int fd, const void *buf, size_t count);
off_t  lseek(int fd, off_t offset, int whence);

/* -- Terminal / FD -- */
int    isatty(int fd);
int    dup(int fd);
int    dup2(int oldfd, int newfd);

/* -- Temp files -- */
int    mkstemp(char *tmpl);

/* -- Symlinks (stubs) -- */
int    symlink(const char *target, const char *linkpath);
ssize_t readlink(const char *path, char *buf, size_t bufsiz);

/* -- Process (stubs) -- */
pid_t  fork(void);
int    execve(const char *path, char *const argv[], char *const envp[]);
pid_t  waitpid(pid_t pid, int *status, int options);
int    kill(pid_t pid, int sig);
int    pipe(int pipefd[2]);

/* -- Signal (stubs) -- */
void (*signal(int sig, void (*handler)(int)))(int);
int    setitimer(int which, const struct itimerval *nval,
                 struct itimerval *oval);

/* -- Dynamic loading (stubs) -- */
void  *dlopen(const char *filename, int flag);
void  *dlsym(void *handle, const char *symbol);
int    dlclose(void *handle);
char  *dlerror(void);

/* -- Resource (stubs) -- */
int    getrusage(int who, struct rusage *usage);

/* -- Terminal (stubs) -- */
int    tcgetattr(int fd, struct termios *t);
int    tcsetattr(int fd, int action, const struct termios *t);

/* -- Poll -- */
int    poll(struct pollfd *fds, nfds_t nfds, int timeout);

#endif /* SHAREDLIB_POSIX_H */
