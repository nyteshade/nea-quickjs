/*
 * stdbool.h -- C99 boolean type for SAS/C 6.58 / AmigaOS
 */
#ifndef _AMIGA_STDBOOL_H
#define _AMIGA_STDBOOL_H

typedef unsigned char _Bool;

#ifndef __cplusplus
#define bool  _Bool
#define true  1
#define false 0
#endif

#define __bool_true_false_are_defined 1

#endif /* _AMIGA_STDBOOL_H */
