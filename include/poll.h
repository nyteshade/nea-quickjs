/*
 * poll.h -- POSIX poll stub for SAS/C 6.58 / AmigaOS
 */
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

/* AmigaOS impl: uses WaitForChar for fd 0; see amiga_compat.c */
int poll(struct pollfd *fds, nfds_t nfds, int timeout);

/* Socket FD registry for poll() -- call these when creating/closing
 * bsdsocket.library sockets so poll() knows to use WaitSelect(). */
void poll_register_socket(int fd);
void poll_unregister_socket(int fd);

#endif /* _AMIGA_POLL_H */
