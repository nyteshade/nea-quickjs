/*
 * sharedlib_math.c - maths functions of the FPU variants that are
 * built from the primitives (atan, exp, log, sqrt).
 *
 * Where the primitives come from depends on the CPU the variant is
 * built for:
 *   68020  vbcc inlines them as 6888x instructions (math_881.h)
 *   68040, 68060  those FPUs have no transcendental instructions;
 *          vbcc emits calls, answered by sharedlib_math_fpu_aux.c
 *          through mathieeedoubtrans.library
 *
 * Elsewhere: pow() is in sharedlib_math_pow.c; floor, ceil, trunc,
 * round, fmod, ldexp and frexp are in sharedlib_math_round.c.
 *
 * The functions here take care of two things the one-line textbook
 * formulas get wrong: the special values ECMAScript defines (signed
 * zeros, infinities, NaN), which are recognised from the bits, and
 * loss of accuracy for small or huge arguments.
 *
 * The soft-float variants build this file too (from 0.232), for the
 * functions only: their primitives are in sharedlib_math_prim.c and their
 * base pointers in sharedlib_math_soft.c. That is why the comparisons are written with
 * the D_xx macros of dcmp.h: plain operators here, NaN-aware calls in
 * a soft-float build.
 *
 * No .lib dependencies.
 */

#include <math.h>
#include <exec/types.h>
#include "sharedlib_dblbits.h"
#include "dcmp.h"
#if defined(__M68881) || defined(__M68882)
#define QJS_MATH_FPU_BUILD 1
#include "sharedlib_math_fpu.h"
#endif

#define QJS_PI      3.14159265358979323846
/* pi minus the double QJS_PI, 1.2246467991473531772e-16. From its bits:
 * vbcc converts the decimal constant one unit in the last place low. */
#define QJS_PI_LO   dbl_from_bits(0x3ca1a626U, 0x33145c07U)
#define QJS_LN2     0.69314718055994530942

#ifdef QJS_MATH_FPU_BUILD
/* MathIeeeDoubTransBase is used by sharedlib_math_fpu_aux.c (68040 and
 * 68060 variants). It is defined and set here for all FPU variants;
 * on the 68020 one nothing reads it. */
struct Library *MathIeeeDoubTransBase = 0;

void sharedlib_math_soft_init(void *basBase, void *transBase)
{
    (void)basBase;
    MathIeeeDoubTransBase = (struct Library *)transBase;
}
void sharedlib_math_soft_cleanup(void)
{
    MathIeeeDoubTransBase = 0;
}
#endif /* QJS_MATH_FPU_BUILD */

/* classification from the bits: no comparison ever sees a NaN */
static int dbl_is_nan(double x)
{
    QJSDblBits u;
    u.d = x;
    return (u.w.hi & ~QJS_DBL_SIGN) > 0x7ff00000U ||
           ((u.w.hi & ~QJS_DBL_SIGN) == 0x7ff00000U && u.w.lo != 0);
}
static int dbl_is_inf(double x)
{
    QJSDblBits u;
    u.d = x;
    return (u.w.hi & ~QJS_DBL_SIGN) == 0x7ff00000U && u.w.lo == 0;
}
static int dbl_is_zero(double x)
{
    QJSDblBits u;
    u.d = x;
    return ((u.w.hi & ~QJS_DBL_SIGN) | u.w.lo) == 0;
}
static int dbl_is_neg(double x)                 /* the sign bit, also of -0 */
{
    QJSDblBits u;
    u.d = x;
    return (u.w.hi & QJS_DBL_SIGN) != 0;
}
static double dbl_from_bits(QJSWord hi, QJSWord lo)
{
    QJSDblBits u;
    u.w.hi = hi; u.w.lo = lo;
    return u.d;
}
#define QJS_NAN()  dbl_from_bits(0x7ff80000U, 0)
#define QJS_INF()  dbl_from_bits(0x7ff00000U, 0)

/*
 * atan2(y, x): the angle of the point (x, y), in -pi..pi, with every
 * special case of ECMAScript's Math.atan2. The version before 0.231
 * ignored the sign of a zero x or y (atan2(0, -0) must be pi) and gave
 * NaN or 0 for infinite arguments.
 */
double atan2(double y, double x)
{
    double r;
    int yneg = dbl_is_neg(y), xneg = dbl_is_neg(x);

    if (dbl_is_nan(x) || dbl_is_nan(y))
        return QJS_NAN();
    if (dbl_is_zero(y)) {
        r = xneg ? QJS_PI : 0.0;                /* x < 0 or x is -0 */
    } else if (dbl_is_zero(x)) {
        r = QJS_PI / 2.0;
    } else if (dbl_is_inf(x)) {
        if (dbl_is_inf(y))
            r = xneg ? 3.0 * (QJS_PI / 4.0) : QJS_PI / 4.0;
        else
            r = xneg ? QJS_PI : 0.0;
    } else if (dbl_is_inf(y)) {
        r = QJS_PI / 2.0;
    } else {
        r = atan(fabs(y / x));
        if (xneg)
            r = QJS_PI - (r - QJS_PI_LO);       /* second or third quadrant */
    }
    return yneg ? -r : r;
}

/*
 * hypot(x, y) = sqrt(x*x + y*y) without overflow or underflow of the
 * squares, and Infinity when either argument is infinite even if the
 * other is NaN (C99 and ECMAScript).
 */
double hypot(double x, double y)
{
    QJSDblBits ux, uy;
    double t, scale = 1.0;
    int ex;

    if (dbl_is_inf(x) || dbl_is_inf(y))
        return QJS_INF();
    if (dbl_is_nan(x) || dbl_is_nan(y))
        return QJS_NAN();
    ux.d = x; ux.w.hi &= ~QJS_DBL_SIGN;
    uy.d = y; uy.w.hi &= ~QJS_DBL_SIGN;
    /* the larger one in ux; non-negative doubles order as their bits */
    if (ux.w.hi < uy.w.hi || (ux.w.hi == uy.w.hi && ux.w.lo < uy.w.lo)) {
        t = ux.d; ux.d = uy.d; uy.d = t;
    }
    if ((uy.w.hi | uy.w.lo) == 0)
        return ux.d;
    /* bring the larger one near 1 so that neither square leaves the
     * range of a double */
    ex = QJS_DBL_EXP(ux.w.hi) - QJS_DBL_BIAS;
    if (ex > 500) {
        ux.d = ldexp(ux.d, -600); uy.d = ldexp(uy.d, -600);
        scale = ldexp(1.0, 600);
    } else if (ex < -500) {
        ux.d = ldexp(ux.d, 600); uy.d = ldexp(uy.d, 600);
        scale = ldexp(1.0, -600);
    }
    return sqrt(ux.d * ux.d + uy.d * uy.d) * scale;
}

/* log(1+x), accurate for small x (Kahan's correction of log(1+x) by
 * the rounding error made in forming 1+x) */
double log1p(double x)
{
    double u;

    if (dbl_is_nan(x))
        return QJS_NAN();
    if (dbl_is_zero(x))
        return x;                               /* keeps -0 */
#ifndef QJS_MATH_FPU_BUILD
    /* Soft-float: the system's log() is not accurate enough near 1 for
     * the correction below (see expm1 in sharedlib_math_fpu_aux.c).
     * log(1+x) = 2 atanh(s) with s = x / (2 + x), and atanh's series
     * s + s^3/3 + s^5/5 ... needs 19 terms for |s| <= 1/3. */
    if (D_GT(x, -0.5) && D_LT(x, 0.5)) {
        double s, s2, sum = 0.0;
        QJSDblBits ux;
        ux.d = x;
        if ((ux.w.hi & ~QJS_DBL_SIGN) < 0x3c900000U)
            return x;                   /* |x| < 2^-54: log(1+x) is x; denormals */
        s = x / (2.0 + x); s2 = s * s;
        int k;
        for (k = 37; k >= 3; k -= 2)
            sum = (sum + 1.0 / (double)k) * s2;
        return 2.0 * (s + s * sum);
    }
#else
    if (D_GT(x, -0.5) && D_LT(x, 0.5)) {
        /* u must be the DOUBLE 1+x in both places below. Left in an
         * FPU register it can carry 64 mantissa bits, and log() of a
         * 68040 build receives it rounded to 53 while u - 1.0 would
         * use all 64: the correction then corrects the wrong error
         * (log1p(1e-10) came out as 1.00000008e-10). */
        u = qjs_dbl_round(1.0 + x);
        if (D_EQ(u, 1.0))
            return x;
        return log(u) * (x / (u - 1.0));
    }
#endif
    if (D_LT(x, -1.0))
        return QJS_NAN();
    if (D_EQ(x, -1.0))
        return -QJS_INF();
    return log(1.0 + x);
}

/*
 * acosh(x) = log(x + sqrt(x*x - 1)) for x >= 1. Written through log1p
 * near 1, where x*x - 1 would cancel, and as log(x) + log(2) for large
 * x, where x*x would overflow (acosh(1e300) was Infinity).
 */
double acosh(double x)
{
    double t;

    if (dbl_is_nan(x) || D_LT(x, 1.0))
        return QJS_NAN();
    if (dbl_is_inf(x))
        return x;
    if (D_GT(x, 268435456.0))                        /* 2^28: sqrt(x*x-1) == x */
        return log(x) + QJS_LN2;
    t = x - 1.0;
    return log1p(t + sqrt(t * (x + 1.0)));
}

/*
 * asinh(x) = log(x + sqrt(x*x + 1)), odd in x. Small arguments go
 * through log1p (asinh(1e-10) was 1.00000008e-10), large ones through
 * log(x) + log(2).
 */
double asinh(double x)
{
    double a, r;

    if (dbl_is_nan(x))
        return QJS_NAN();
    if (dbl_is_inf(x) || dbl_is_zero(x))
        return x;
    a = fabs(x);
    if (D_GT(a, 268435456.0))                        /* 2^28 */
        r = log(a) + QJS_LN2;
    else
        r = log1p(a + a * a / (1.0 + sqrt(1.0 + a * a)));
    return dbl_is_neg(x) ? -r : r;
}

/*
 * cbrt(x): an estimate from exp(log(x)/3), then one Newton step, which
 * removes the estimate's error: cbrt(27) is 3, not 3.0000000000000004.
 */
double cbrt(double x)
{
    double a, t;

    if (dbl_is_nan(x))
        return QJS_NAN();
    if (dbl_is_zero(x) || dbl_is_inf(x))
        return x;
    a = fabs(x);
    t = exp(log(a) / 3.0);
    t = t - (t * t * t - a) / (3.0 * t * t);
    return dbl_is_neg(x) ? -t : t;
}
