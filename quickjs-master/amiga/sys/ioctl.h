/*
 * sys/ioctl.h -- POSIX ioctl stub for SAS/C 6.58 / AmigaOS
 */
#ifndef _AMIGA_SYS_IOCTL_H
#define _AMIGA_SYS_IOCTL_H

#define TIOCGWINSZ  0x5413

struct winsize {
    unsigned short ws_row;
    unsigned short ws_col;
    unsigned short ws_xpixel;
    unsigned short ws_ypixel;
};

int ioctl(int fd, unsigned long request, ...);

#endif /* _AMIGA_SYS_IOCTL_H */
