/*
 * sharedlib_math_fpu_aux.c — FPU↔software wrappers for 68040/68060
 *
 * The 68040/68060 FPU dropped 68881 transcendental instructions
 * (FATAN, FSIN, FCOS, etc.). VBCC compiled with -cpu=68040/68060
 * -fpu=68881 emits external function calls (atan, sin, ...) instead
 * of inlining the FPU instructions.
 *
 * This file provides those primitives by:
 *  1. Taking the double argument in FP0 (FPU calling convention)
 *  2. Moving FP0 to d0/d1 (longs) on the stack
 *  3. Calling mathieeedoubtrans.library (which works on d0/d1)
 *  4. Moving the d0/d1 result back to FP0
 *  5. Returning via FP0
 *
 * Each function uses VBCC's inline assembly syntax (function = "asm";)
 * which sidesteps the __reg("a6") frame pointer issue we've fought
 * elsewhere in the library.
 *
 * Only used in 040/060 FPU builds. On the 020 FPU build vbcc inlines
 * all of these as 6888x instructions.
 *
 * fmod, ldexp and round were here until 0.231; they are now in
 * sharedlib_math_round.c, shared with the 020 FPU build.
 */

#include <exec/types.h>
#include <math.h>
#include "sharedlib_dblbits.h"
#include "dcmp.h"

double log1p(double x);         /* sharedlib_math.c */

/* The soft-float variants build this file too (from 0.232), for the
 * functions at the end only (exp2, expm1, log2, atanh, modf): their
 * primitives are in sharedlib_math_prim.c. The comparisons in those
 * functions use the D_xx macros of dcmp.h, plain operators in an FPU
 * build, so that a soft-float build has no compiler-made compare. */
#if defined(__M68881) || defined(__M68882)
#include "sharedlib_math_fpu.h"

/* MathIeeeDoubTransBase global — defined and initialized in
 * sharedlib_math.c (FPU build) by sharedlib_math_soft_init.
 * We just reference it here. */
extern struct Library *MathIeeeDoubTransBase;

/* ----------------------------------------------------------------
 * Inline asm wrappers — one per transcendental function.
 *
 * The pattern for a single-arg function:
 *   1. fmove.d  fp0,-(sp)         ; push FP0 as 8 bytes onto stack
 *   2. move.l   (sp)+,d0          ; pop high word
 *   3. move.l   (sp)+,d1          ; pop low word
 *   4. jsr      -OFFSET(a6)       ; call IEEEDP* function
 *   5. move.l   d1,-(sp)          ; push low word back
 *   6. move.l   d0,-(sp)          ; push high word back
 *   7. fmove.d  (sp)+,fp0         ; pop into FP0 as double
 *
 * VBCC's `function = "asm";` syntax handles A6 setup automatically
 * via the __reg("a6") parameter. We declare it taking the math base
 * (MathIeeeDoubTransBase will be set globally before any call).
 *
 * Stack overhead: 8 bytes per call (push FP0, pop d0/d1, then push
 * d0/d1, pop FP0). Brief — within the call frame.
 * ---------------------------------------------------------------- */

/* IEEEDPAtan -30 */
double __ieee_atan(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-30(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPSin -36 */
double __ieee_sin(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-36(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPCos -42 */
double __ieee_cos(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-42(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPTan -48 */
double __ieee_tan(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-48(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPSinh -60 */
double __ieee_sinh(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-60(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPCosh -66 */
double __ieee_cosh(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-66(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPTanh -72 */
double __ieee_tanh(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-72(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPExp -78 */
double __ieee_exp(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-78(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPLog -84 */
double __ieee_log(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-84(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPAsin -114 */
double __ieee_asin(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-114(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPAcos -120 */
double __ieee_acos(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-120(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* IEEEDPLog10 -126 */
double __ieee_log10(__reg("a6") void *base, __reg("fp0") double x) =
    "\tfmove.d\tfp0,-(sp)\n"
    "\tmove.l\t(sp)+,d0\n"
    "\tmove.l\t(sp)+,d1\n"
    "\tjsr\t-126(a6)\n"
    "\tmove.l\td1,-(sp)\n"
    "\tmove.l\td0,-(sp)\n"
    "\tfmove.d\t(sp)+,fp0";

/* ----------------------------------------------------------------
 * Public C functions — wrap the inline asm with the global base.
 * Caller passes only the double (the global is added by the wrapper).
 * ---------------------------------------------------------------- */

double atan(double x) { return __ieee_atan(MathIeeeDoubTransBase, x); }
double sin(double x)  { return __ieee_sin(MathIeeeDoubTransBase, x); }
double cos(double x)  { return __ieee_cos(MathIeeeDoubTransBase, x); }
double tan(double x)  { return __ieee_tan(MathIeeeDoubTransBase, x); }
double sinh(double x) { return __ieee_sinh(MathIeeeDoubTransBase, x); }
double cosh(double x) { return __ieee_cosh(MathIeeeDoubTransBase, x); }
double tanh(double x) { return __ieee_tanh(MathIeeeDoubTransBase, x); }
double exp(double x)  { return __ieee_exp(MathIeeeDoubTransBase, x); }
double log(double x)  { return __ieee_log(MathIeeeDoubTransBase, x); }
double asin(double x) { return __ieee_asin(MathIeeeDoubTransBase, x); }
double acos(double x) { return __ieee_acos(MathIeeeDoubTransBase, x); }
double log10(double x){ return __ieee_log10(MathIeeeDoubTransBase, x); }

#endif /* FPU build */

/* ----------------------------------------------------------------
 * Functions not provided by mathieeedoubtrans.library, built on the
 * primitives above. (On the 68020 variant vbcc inlines these as
 * single 6888x instructions and this file is not linked.)
 * ---------------------------------------------------------------- */

static double aux_from_bits(QJSWord hi, QJSWord lo)
{
    QJSDblBits u;
    u.w.hi = hi; u.w.lo = lo;
    return u.d;
}

/* exp2(x) = 2**x; pow() is exact for whole numbers */
double exp2(double x)
{
    return pow(2.0, x);
}

/*
 * expm1(x) = exp(x) - 1. Near zero exp(x) is 1 plus very little and
 * the subtraction would keep only the few bits of x that survived in
 * exp(x): expm1(1e-10) was 1.00000008274037e-10. Kahan's correction
 * divides out that rounding: with u = exp(x) rounded, (u-1) * x/log(u)
 * is accurate because log(u) is wrong in the same way u-1 is.
 */
double expm1(double x)
{
    double u, um1;

#if !defined(__M68881) && !defined(__M68882)
    /* Soft-float: the correction below needs log() and exp() to agree
     * to the last bit near 1, which the system's mathieeedoubtrans
     * does not manage (expm1(1e-10) came out 1e-10 low in relative
     * terms). The series x + x^2/2! + x^3/3! ... to 16 terms is below
     * 1e-18 of the result for |x| < 0.5; it is summed from the small
     * end, as x(1 + x/2(1 + x/3(...))). */
    if (D_GT(x, -0.5) && D_LT(x, 0.5)) {
        int k;
        u = 1.0;
        for (k = 16; k >= 2; k--)
            u = 1.0 + (x / (double)k) * u;
        return x * u;                   /* keeps -0, and NaN never gets here */
    }
    return exp(x) - 1.0;
#else
    if (D_GT(x, -0.5) && D_LT(x, 0.5)) {
        u = qjs_dbl_round(exp(x));      /* a double, not 64 bits: see log1p */
        if (D_EQ(u, 1.0))
            return x;                   /* also keeps -0 */
        um1 = u - 1.0;
        return um1 * (x / log(u));
    }
    return exp(x) - 1.0;                /* NaN and the infinities too */
#endif
}

/*
 * log2(x). x = m * 2^e with m in [sqrt(1/2), sqrt(2)), so that for a
 * power of two m is exactly 1, log(m) is exactly 0 and the result is
 * the whole number e: log2(8) is 3, not 2.9999999999999996.
 */
double log2(double x)
{
    static const double INV_LN2 = 1.4426950408889634074;  /* 1/ln(2) */
    QJSDblBits u;
    double m;
    int e;

    u.d = x;
    /* zero, negative, infinite or NaN: whatever log() says */
    if ((u.w.hi & QJS_DBL_SIGN) || QJS_DBL_EXP(u.w.hi) == 0x7ff ||
        (u.w.hi | u.w.lo) == 0)
        return log(x);
    m = frexp(x, &e);                   /* m in [0.5, 1) */
    if (D_LT(m, 0.70710678118654752440)) {
        m *= 2.0;
        e--;
    }
    return (double)e + log(m) * INV_LN2;
}

/*
 * atanh(x) = 0.5 * log((1+x) / (1-x)), odd in x, through log1p so
 * that small arguments keep their accuracy.
 */
double atanh(double x)
{
    QJSDblBits u;
    double a, r;

    QJSWord x_hi_sign;                  /* the sign bit of x, in place */

    u.d = x;
    x_hi_sign = u.w.hi & QJS_DBL_SIGN;
    u.w.hi &= ~QJS_DBL_SIGN;
    a = u.d;                            /* |x| */
    if (u.w.hi > 0x3ff00000U || (u.w.hi == 0x3ff00000U && u.w.lo != 0))
        return aux_from_bits(0x7ff80000U, 0);   /* |x| > 1, or NaN */
    if (u.w.hi == 0x3ff00000U)                  /* +-1: +-Infinity */
        return aux_from_bits(0x7ff00000U | (x_hi_sign), 0);
    if ((u.w.hi | u.w.lo) == 0)
        return x;                               /* keeps -0 */
    r = 0.5 * log1p(2.0 * a / (1.0 - a));
    return x_hi_sign ? -r : r;
}

/* modf(x, *iptr): split x into integer and fractional parts */
double modf(double x, double *iptr)
{
    double i = trunc(x);
    if (iptr) *iptr = i;
    return x - i;
}
