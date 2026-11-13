/*
 * sharedlib_dblbits.h - a double as its two 32-bit halves.
 *
 * The maths replacements of the FPU variants (sharedlib_math_round.c,
 * sharedlib_math_pow.c, sharedlib_math.c) work on the bits of a double
 * so that their results do not depend on FPU instructions the 68040
 * lacks, on the FPCR, or on how anything orders NaN.
 *
 * QJS_HOST_TEST builds the same sources on the (little-endian, 64-bit)
 * build machine, where perf/mathcheck/ compares them with the host's
 * libm. Nothing in the library defines it.
 */
#ifndef SHAREDLIB_DBLBITS_H
#define SHAREDLIB_DBLBITS_H

#ifdef QJS_HOST_TEST
typedef unsigned int QJSWord;                   /* 32 bits there too */
typedef union { double d; struct { QJSWord lo, hi; } w; } QJSDblBits;
#else
typedef unsigned long QJSWord;                  /* 32 bits on the 68k */
typedef union { double d; struct { QJSWord hi, lo; } w; } QJSDblBits;
#endif

/* fields of the high word */
#define QJS_DBL_SIGN     0x80000000U
#define QJS_DBL_EXPMASK  0x7ff00000U
#define QJS_DBL_MANTMASK 0x000fffffU
#define QJS_DBL_IMPLICIT 0x00100000U            /* the mantissa's leading 1 */
#define QJS_DBL_BIAS     1023

/* the biased exponent, 0..2047 */
#define QJS_DBL_EXP(hi)  ((int)(((hi) >> 20) & 0x7ff))

/*
 * x as a true double: 53 mantissa bits and no more.
 *
 * An FPU register holds 64 mantissa bits whatever the C type, and vbcc
 * keeps a "double" there across statements (it drops a plain or even a
 * volatile store followed by a load). Error-compensating formulas
 * such as Kahan's log1p need the value they compare to be the rounded
 * one. Copying the two halves as integers is a store the compiler
 * cannot remove.
 */
static double qjs_dbl_round(double x)
{
    QJSDblBits a, b;

    a.d = x;
    b.w.hi = a.w.hi;
    b.w.lo = a.w.lo;
    return b.d;
}

#endif /* SHAREDLIB_DBLBITS_H */
