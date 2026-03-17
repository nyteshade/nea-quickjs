/*
 * sys/wait.h -- POSIX process wait stub for SAS/C 6.58 / AmigaOS
 */
#ifndef _AMIGA_SYS_WAIT_H
#define _AMIGA_SYS_WAIT_H

#include <unistd.h>

#define WNOHANG    1
#define WUNTRACED  2

#define WIFEXITED(s)    (((s) & 0x7f) == 0)
#define WEXITSTATUS(s)  (((s) >> 8) & 0xff)
#define WIFSIGNALED(s)  (((s) & 0x7f) != 0 && ((s) & 0x7f) != 0x7f)
#define WTERMSIG(s)     ((s) & 0x7f)

pid_t waitpid(pid_t pid, int *status, int options);

#endif /* _AMIGA_SYS_WAIT_H */
