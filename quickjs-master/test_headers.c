#include <sys/time.h>
struct timeval tv;
int gettimeofday(struct timeval *tv, void *tz);
int x = sizeof(tv.tv_sec);
