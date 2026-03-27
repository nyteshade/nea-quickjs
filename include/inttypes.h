/*
 * inttypes.h -- C99 printf/scanf format macros for SAS/C 6.58 / AmigaOS
 *
 * SAS/C uses standard printf from the C runtime; long long (%lld) is
 * supported as an extension when targeting 68020+.
 */
#ifndef _AMIGA_INTTYPES_H
#define _AMIGA_INTTYPES_H

#include "stdint.h"

/* Printf format macros -- decimal */
#define PRId8    "d"
#define PRId16   "d"
#define PRId32   "ld"
#define PRId64   "lld"
#define PRIdLEAST8   PRId8
#define PRIdLEAST16  PRId16
#define PRIdLEAST32  PRId32
#define PRIdLEAST64  PRId64
#define PRIdFAST8    PRId32
#define PRIdFAST16   PRId32
#define PRIdFAST32   PRId32
#define PRIdFAST64   PRId64
#define PRIdMAX      PRId64
#define PRIdPTR      PRId32

/* Printf format macros -- unsigned decimal */
#define PRIu8    "u"
#define PRIu16   "u"
#define PRIu32   "lu"
#define PRIu64   "llu"
#define PRIuLEAST8   PRIu8
#define PRIuLEAST16  PRIu16
#define PRIuLEAST32  PRIu32
#define PRIuLEAST64  PRIu64
#define PRIuFAST8    PRIu32
#define PRIuFAST16   PRIu32
#define PRIuFAST32   PRIu32
#define PRIuFAST64   PRIu64
#define PRIuMAX      PRIu64
#define PRIuPTR      PRIu32

/* Printf format macros -- hex */
#define PRIx8    "x"
#define PRIx16   "x"
#define PRIx32   "lx"
#define PRIx64   "llx"
#define PRIX8    "X"
#define PRIX16   "X"
#define PRIX32   "lX"
#define PRIX64   "llX"
#define PRIxLEAST8   PRIx8
#define PRIxLEAST16  PRIx16
#define PRIxLEAST32  PRIx32
#define PRIxLEAST64  PRIx64
#define PRIxFAST8    PRIx32
#define PRIxFAST16   PRIx32
#define PRIxFAST32   PRIx32
#define PRIxFAST64   PRIx64
#define PRIxMAX      PRIx64
#define PRIxPTR      PRIx32

/* Scanf format macros (less critical, included for completeness) */
#define SCNd8    "hhd"
#define SCNd16   "hd"
#define SCNd32   "ld"
#define SCNd64   "lld"
#define SCNu8    "hhu"
#define SCNu16   "hu"
#define SCNu32   "lu"
#define SCNu64   "llu"
#define SCNx8    "hhx"
#define SCNx16   "hx"
#define SCNx32   "lx"
#define SCNx64   "llx"

#endif /* _AMIGA_INTTYPES_H */
