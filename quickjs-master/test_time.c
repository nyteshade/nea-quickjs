#include <sys/time.h>
/* force compile error to show contents */
int x = sizeof(struct timeval);
int y = sizeof(struct timezone);
