/*
 * unistd.h -- POSIX stub for SAS/C 6.58 / AmigaOS
 * Provides the minimum definitions needed by quickjs-libc.c.
 * Function declarations that SAS/C already provides are omitted.
 */
#ifndef _AMIGA_UNISTD_H
#define _AMIGA_UNISTD_H

#include <stddef.h>

/* Standard file descriptors */
#define STDIN_FILENO   0
#define STDOUT_FILENO  1
#define STDERR_FILENO  2

/* sysconf constants */
#define _SC_NPROCESSORS_ONLN  1
#define _SC_PAGE_SIZE         2
#define _SC_OPEN_MAX          3

/* access() mode flags */
#define F_OK  0
#define R_OK  4
#define W_OK  2
#define X_OK  1

/* lseek whence values (also in <stdio.h>) */
#ifndef SEEK_SET
#define SEEK_SET  0
#define SEEK_CUR  1
#define SEEK_END  2
#endif

typedef long    ssize_t;
typedef long    off_t;
typedef int     pid_t;
typedef unsigned int uid_t;
typedef unsigned int gid_t;

/*
 * SAS/C 6.58 provides many of these via its own POSIX emulation layer.
 * Only declare functions SAS/C definitely does not provide.
 */
int    access(const char *path, int mode);
int    dup(int fd);
int    dup2(int oldfd, int newfd);
int    pipe(int pipefd[2]);
int    isatty(int fd);
long   sysconf(int name);

/* fork/exec -- not available on AmigaOS; all return -1/ENOSYS */
pid_t  fork(void);
int    execv(const char *path, char *const argv[]);
int    execve(const char *path, char *const argv[], char *const envp[]);
int    execvp(const char *file, char *const argv[]);

/* environ */
extern char **environ;

#endif /* _AMIGA_UNISTD_H */
