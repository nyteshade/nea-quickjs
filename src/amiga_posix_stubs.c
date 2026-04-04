/*
 * amiga_posix_stubs.c -- POSIX function stubs for AmigaOS / VBCC
 *
 * Provides stubs for POSIX functions NOT available in VBCC posixlib.
 * Functions that posixlib declares (dup, dup2, getpid, symlink,
 * readlink, lstat, sysconf, ioctl, etc.) are NOT stubbed here to
 * avoid duplicate symbols when linking with posix.lib.
 *
 * Link this into the CLI tool (qjs) alongside posix.lib.
 * The shared library does NOT use quickjs-libc.c.
 */

#ifdef __VBCC__

#include <errno.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

#include "amiga_compat_vbcc.h"

/* -----------------------------------------------------------------------
 * environ — empty environment for AmigaOS
 * getenviron() iterates this; getenv() uses dos.library GetVar().
 * ----------------------------------------------------------------------- */
static char *_empty_environ[] = { NULL };
char **environ = _empty_environ;

/* Color control — set by --color flag in qjs.c */
int amiga_force_color = 0;

/* -----------------------------------------------------------------------
 * Error constant
 * ----------------------------------------------------------------------- */
#ifndef ENOSYS
#define ENOSYS 78
#endif

/* -----------------------------------------------------------------------
 * fork / exec — not available on AmigaOS
 * (quickjs-libc.c uses SystemTags for AmigaOS exec instead)
 * ----------------------------------------------------------------------- */

int fork(void) {
    errno = ENOSYS;
    return -1;
}

int execv(const char *path, char *const argv[]) {
    errno = ENOSYS;
    return -1;
}

int execve(const char *path, char *const argv[], char *const envp[]) {
    errno = ENOSYS;
    return -1;
}

int execvp(const char *file, char *const argv[]) {
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * pipe / waitpid / kill — not in VBCC posixlib
 * ----------------------------------------------------------------------- */

int pipe(int pipefd[2]) {
    errno = ENOSYS;
    return -1;
}

int waitpid(int pid, int *status, int options) {
    errno = ENOSYS;
    return -1;
}

int kill(int pid, int sig) {
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * termios — AmigaOS uses dos.library raw mode instead
 * Not in VBCC posixlib (no termios.h)
 * ----------------------------------------------------------------------- */

int tcgetattr(int fd, void *t) {
    errno = ENOSYS;
    return -1;
}

int tcsetattr(int fd, int action, const void *t) {
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * dlopen / dlsym — AmigaOS uses OpenLibrary() instead
 * Not in VBCC posixlib (no dlfcn.h)
 * ----------------------------------------------------------------------- */

void *dlopen(const char *filename, int flag) {
    return NULL;
}

void *dlsym(void *handle, const char *symbol) {
    return NULL;
}

int dlclose(void *handle) {
    return 0;
}

char *dlerror(void) {
    return "dynamic linking not supported on AmigaOS";
}

/* -----------------------------------------------------------------------
 * Resource limits — not in VBCC posixlib
 * ----------------------------------------------------------------------- */

int getrusage(int who, void *usage) {
    if (usage) memset(usage, 0, 16);
    return -1;
}

int getrlimit(int resource, void *rlp) {
    errno = ENOSYS;
    return -1;
}

int setrlimit(int resource, const void *rlp) {
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * mkdtemp / mkstemp — not in VBCC posixlib
 * ----------------------------------------------------------------------- */

char *mkdtemp(char *templ) {
    errno = ENOSYS;
    return NULL;
}

int mkstemp(char *templ) {
    errno = ENOSYS;
    return -1;
}

/* -----------------------------------------------------------------------
 * utimes — not in VBCC posixlib (only utime with struct utimbuf)
 * ----------------------------------------------------------------------- */

int utimes(const char *filename, const void *times) {
    return 0;
}

/* -----------------------------------------------------------------------
 * poll() — minimal implementation for the event loop
 * VBCC posixlib has select() but NOT poll(). Provide a simple
 * timeout-based implementation sufficient for setTimeout/setInterval.
 * ----------------------------------------------------------------------- */

#include <poll.h>

int poll(struct pollfd *fds, unsigned int nfds, int timeout) {
    if (timeout > 0) {
        /* Delay() takes ticks (1/50s). Convert ms to ticks, min 1. */
        long ticks = (timeout + 19) / 20;
        if (ticks < 1) ticks = 1;
        extern void Delay(long);
        Delay(ticks);
    }
    return 0;
}

/* -----------------------------------------------------------------------
 * popen / pclose — not in VBCC posixlib
 * Guarded out of quickjs-libc.c, but provide stubs for safety.
 * ----------------------------------------------------------------------- */

FILE *popen(const char *command, const char *mode) {
    errno = ENOSYS;
    return NULL;
}

int pclose(FILE *stream) {
    return -1;
}

FILE *fdopen(int fd, const char *mode) {
    errno = ENOSYS;
    return NULL;
}

int fileno(FILE *stream) {
    /* stdin=0, stdout=1, stderr=2; else -1 */
    if (stream == stdin) return 0;
    if (stream == stdout) return 1;
    if (stream == stderr) return 2;
    return -1;
}

#endif /* __VBCC__ */
