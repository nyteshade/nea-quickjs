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

/* stub -- always returns 0 (timeout) */
int poll(struct pollfd *fds, nfds_t nfds, int timeout);

#endif /* _AMIGA_POLL_H */
