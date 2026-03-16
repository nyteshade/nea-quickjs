/*
 * stdint.h -- C99 fixed-width integer types for SAS/C 6.58 / AmigaOS
 *
 * SAS/C targets 68000/68020 (big-endian, ILP32):
 *   char  = 8-bit
 *   short = 16-bit
 *   int   = 32-bit
 *   long  = 32-bit
 *   long long not natively supported; use two-word struct or __int64 if avail.
 */
#ifndef _AMIGA_STDINT_H
#define _AMIGA_STDINT_H

/* Exact-width signed */
typedef signed char        int8_t;
typedef short              int16_t;
typedef long               int32_t;
typedef struct { long hi; unsigned long lo; } int64_t_struct; /* see note */

/* Exact-width unsigned */
typedef unsigned char      uint8_t;
typedef unsigned short     uint16_t;
typedef unsigned long      uint32_t;

/* SAS/C 6.58 does support "long long" as an extension on 68020 targets.
 * Use it if the compiler is invoked with CPU=68020 or higher, otherwise
 * fall back to a struct -- but struct won't work for arithmetic so the
 * 64-bit paths in quickjs.c will need further attention. */
#ifdef __SASC__
typedef long long           int64_t;
typedef unsigned long long  uint64_t;
#else
/* fallback -- will cause errors in 64-bit arithmetic paths */
typedef int64_t_struct      int64_t;
typedef int64_t_struct      uint64_t;
#endif

/* Minimum-width */
typedef int8_t    int_least8_t;
typedef int16_t   int_least16_t;
typedef int32_t   int_least32_t;
typedef int64_t   int_least64_t;
typedef uint8_t   uint_least8_t;
typedef uint16_t  uint_least16_t;
typedef uint32_t  uint_least32_t;
typedef uint64_t  uint_least64_t;

/* Fastest minimum-width (use natural register sizes on 68k) */
typedef int32_t   int_fast8_t;
typedef int32_t   int_fast16_t;
typedef int32_t   int_fast32_t;
typedef int64_t   int_fast64_t;
typedef uint32_t  uint_fast8_t;
typedef uint32_t  uint_fast16_t;
typedef uint32_t  uint_fast32_t;
typedef uint64_t  uint_fast64_t;

/* Pointer-sized */
typedef long           intptr_t;
typedef unsigned long  uintptr_t;

/* Maximum-width */
typedef int64_t   intmax_t;
typedef uint64_t  uintmax_t;

/* Limits */
#define INT8_MIN    (-128)
#define INT8_MAX    127
#define INT16_MIN   (-32768)
#define INT16_MAX   32767
#define INT32_MIN   (-2147483648L)
#define INT32_MAX   2147483647L
#define INT64_MIN   (-9223372036854775807LL - 1)
#define INT64_MAX   9223372036854775807LL

#define UINT8_MAX   255U
#define UINT16_MAX  65535U
#define UINT32_MAX  4294967295UL
#define UINT64_MAX  18446744073709551615ULL

#define INTPTR_MIN  INT32_MIN
#define INTPTR_MAX  INT32_MAX
#define UINTPTR_MAX UINT32_MAX

#define INTMAX_MIN  INT64_MIN
#define INTMAX_MAX  INT64_MAX
#define UINTMAX_MAX UINT64_MAX

/* Constant macros */
#define INT8_C(v)   ((int8_t)(v))
#define INT16_C(v)  ((int16_t)(v))
#define INT32_C(v)  ((int32_t)(v ## L))
#define INT64_C(v)  (v ## LL)
#define UINT8_C(v)  ((uint8_t)(v ## U))
#define UINT16_C(v) ((uint16_t)(v ## U))
#define UINT32_C(v) (v ## UL)
#define UINT64_C(v) (v ## ULL)
#define INTMAX_C(v) INT64_C(v)
#define UINTMAX_C(v) UINT64_C(v)

#endif /* _AMIGA_STDINT_H */
