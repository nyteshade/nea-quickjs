/*
 * sharedlib_math_pow.c - pow() for the FPU variants.
 *
 * Until 0.231 pow(x, y) was exp(y * log(x)). That is never exact:
 * 2**32 came out as 4294967295.9999967 and 10**15 as
 * 1000000000000005.9 on the 68040/68060 variants, and the special
 * cases of ECMAScript's Math.pow (zeros, infinities, negative bases)
 * were mostly missing.
 *
 * Three parts:
 *
 *  pow()        the special cases, then one of the two below.
 *  pow_int()    y a whole number up to +-1024: repeated squaring in
 *               the FPU's extended precision, rounded once at the end.
 *               Exact whenever the true result fits a double (2**32,
 *               10**15, 3**20, (-2)**3, 10**-5 as the double nearest
 *               1e-5), and correctly rounded in nearly every other
 *               case (the 64-bit intermediate carries 11 spare bits).
 *  pow_kernel() everything else: Sun's fdlibm algorithm, which
 *               computes log2(x) and 2**(y*log2(x)) in pieces so that
 *               the result is within one unit in the last place. It
 *               uses only + - * / on doubles, no library call and no
 *               transcendental FPU instruction, so the 68020, 68040
 *               and 68060 variants return the same value and nothing
 *               traps to an emulation library.
 *
 * Linked into every variant. The soft-float variants (from 0.232) skip
 * pow_int(): see USE_POW_INT below.
 *
 * Tested by amiga/tests/test_fpu_numeric.js and, on the build machine,
 * by perf/mathcheck/run.sh (QJS_HOST_TEST).
 */
#include "sharedlib_dblbits.h"
#ifndef QJS_HOST_TEST
#include "dcmp.h"       /* D_GT, D_LE: plain operators unless soft-float */
#else
#define D_GT(a, b) ((a) > (b))
#define D_LE(a, b) ((a) <= (b))
#endif

#ifdef QJS_HOST_TEST
#include <math.h>
#define fpcr_enter_extended() 0
#define fpcr_leave(old) ((void)(old))
/* The build machine has no 80-bit type, so there pow_int() is only
 * exact while every product fits a double; the host test turns it off
 * to check pow_kernel() over whole-number exponents too. */
static int qjs_host_use_pow_int = 1;
#define USE_POW_INT qjs_host_use_pow_int
#elif !defined(__M68881) && !defined(__M68882)
/* Soft-float variant (from 0.232, with the library's own IEEE
 * arithmetic underneath). There is no extended precision to make
 * pow_int() exact, so whole-number exponents go to pow_int_exact()
 * instead, which only answers when every product it forms is exact,
 * and everything else through pow_kernel(), which needs nothing but
 * correctly rounded + - * /. */
#include <math.h>
#define fpcr_enter_extended() 0
#define fpcr_leave(old) ((void)(old))
#define USE_POW_INT 1
#define QJS_POW_INT_EXACT 1
#else
#include <math.h>
#include "sharedlib_math_fpu.h"

/* The library runs the FPU rounding to double precision (see
 * sharedlib_fpu_mode.c). pow_int() wants the full 64-bit mantissa for
 * its intermediate products, so it switches to extended precision,
 * round to nearest, no exceptions enabled (FPCR = 0) and back. Both
 * are single instructions every FPU executes itself. */
static unsigned long fpcr_enter_extended(void) =
    "\tfmove.l\tfpcr,d0\n"
    "\tfmove.l\t#0,fpcr";
static void fpcr_leave(__reg("d0") unsigned long old) =
    "\tfmove.l\td0,fpcr";
#define USE_POW_INT 1
#endif

/* a double from its two halves */
static double make_double(QJSWord hi, QJSWord lo)
{
    QJSDblBits u;
    u.w.hi = hi; u.w.lo = lo;
    return u.d;
}

#ifndef QJS_POW_INT_EXACT
/*
 * x ** n for an integer n, by repeated squaring. Handles every x:
 * zeros, infinities and NaN come out right from the arithmetic itself
 * (1/0 is an infinity of the right sign, and so on).
 *
 * The error grows with the number of multiplications, about n units
 * of the 64-bit intermediate, which is why pow() only comes here for
 * |n| <= 1024: beyond that the 11 spare bits are used up.
 */
static double pow_int(double x, long n)
{
    unsigned long old = fpcr_enter_extended();
    unsigned long m = (n < 0) ? (unsigned long)(-n) : (unsigned long)n;
#ifdef QJS_HOST_TEST
    long double r = 1.0, b = x;
#else
    double r = 1.0, b = x;      /* held in FPU registers: 80 bits */
#endif

    for (;;) {
        if (m & 1)
            r *= b;
        m >>= 1;
        if (m == 0)
            break;
        b *= b;
    }
    if (n < 0)
        r = 1.0 / r;
    fpcr_leave(old);
    return (double)r;
}
#endif /* !QJS_POW_INT_EXACT */

#ifdef QJS_POW_INT_EXACT
/* how many bits the significand of a normal double really uses:
 * 53 less its trailing zero bits */
static int significant_bits(double d)
{
    QJSDblBits u;
    QJSWord w;
    int n = 53;

    u.d = d;
    w = u.w.lo;
    if (w == 0) {
        n = 21;
        w = (u.w.hi & QJS_DBL_MANTMASK) | QJS_DBL_IMPLICIT;
    }
    while ((w & 1) == 0) {
        w >>= 1;
        n--;
    }
    return n;
}

/*
 * x ** n by repeated squaring in plain doubles, but only while every
 * product is exact: two significands of a and b bits multiply to at
 * most a + b bits, which a double holds when that is 53 or less. Then
 * the power is the true value (2**32, 10**15, 3**20, 1.5**2), and for
 * a negative n one division of 1 by it is the correctly rounded
 * result (10**-5 is the double nearest 0.00001, where the kernel is
 * one unit off). Returns 0, leaving *res alone, as soon as a product
 * would be inexact or leave the range of normal numbers; the caller
 * then uses the kernel. x must be finite, normal and not zero.
 */
static int pow_int_exact(double x, long n, double *res)
{
    unsigned long m = (n < 0) ? (unsigned long)(-n) : (unsigned long)n;
    double r = 1.0, b = x;
    int rbits = 1, bbits = significant_bits(x);
    QJSDblBits u;

    for (;;) {
        if (m & 1) {
            if (rbits + bbits > 53)
                return 0;
            r *= b;
            u.d = r;
            if (QJS_DBL_EXP(u.w.hi) == 0 || QJS_DBL_EXP(u.w.hi) == 0x7ff)
                return 0;
            rbits = significant_bits(r);
        }
        m >>= 1;
        if (m == 0)
            break;
        if (bbits + bbits > 53)
            return 0;
        b *= b;
        u.d = b;
        if (QJS_DBL_EXP(u.w.hi) == 0 || QJS_DBL_EXP(u.w.hi) == 0x7ff)
            return 0;
        bbits = significant_bits(b);
    }
    *res = (n < 0) ? 1.0 / r : r;
    return 1;
}
#endif /* QJS_POW_INT_EXACT */

/* ====================================================================
 * The kernel below is derived from e_pow.c of FreeBSD's msun / fdlibm:
 *
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================================
 *
 * Method (from the original): let x = 2^n * (1+f).
 *  1. Compute and return log2(x) in two pieces: log2(x) = w1 + w2,
 *     where w1 has 53-24 = 29 bit trailing zeros.
 *  2. Perform y*log2(x) = n+y' by simulating multi-precision
 *     arithmetic, where |y'| <= 0.5.
 *  3. Return x**y = 2**n * exp(y'*log2).
 * The computed result has an error below 0.70 units in the last place.
 *
 * Changes from the original: only the general case is kept (the
 * caller has dealt with zeros, infinities, NaN, negative x and
 * y == 0), the words of a double are reached through QJSDblBits, and
 * overflow and underflow return an infinity or a zero built from bits
 * instead of raising exceptions with huge*huge.
 *
 * pow_kernel(ax, y): ax ** y for finite ax > 0 and finite y != 0.
 */
/*
 * The constants are built from their bit patterns, not written as
 * decimal numbers: vbcc's conversion of a decimal constant is not
 * always the nearest double (for 1.35003920212974897128e-08 it gives
 * 0x3E4CFDEB43CFD005 where the value is ...D006, and
 * 1.7976931348623157e+308 comes out 7 units low), and this algorithm
 * depends on its constants to the last bit. Their decimal values are
 * in fdlibm's e_pow.c under the same names (dp_h1 and dp_l1 are
 * dp_h[1] and dp_l[1] there).
 */
#define POW_CONSTANTS \
    const double dp_h1 = make_double(0x3FE2B803U, 0x40000000U);  /* log2(1.5), high part */ \
    const double dp_l1 = make_double(0x3E4CFDEBU, 0x43CFD006U);  /* log2(1.5), low part */ \
    const double L1 = make_double(0x3FE33333U, 0x33333303U);  /* L1..L6: polynomial for log */ \
    const double L2 = make_double(0x3FDB6DB6U, 0xDB6FABFFU); \
    const double L3 = make_double(0x3FD55555U, 0x518F264DU); \
    const double L4 = make_double(0x3FD17460U, 0xA91D4101U); \
    const double L5 = make_double(0x3FCD864AU, 0x93C9DB65U); \
    const double L6 = make_double(0x3FCA7E28U, 0x4A454EEFU); \
    const double P1 = make_double(0x3FC55555U, 0x5555553EU);  /* P1..P5: polynomial for exp */ \
    const double P2 = make_double(0xBF66C16CU, 0x16BEBD93U); \
    const double P3 = make_double(0x3F11566AU, 0xAF25DE2CU); \
    const double P4 = make_double(0xBEBBBD41U, 0xC5D26BF1U); \
    const double P5 = make_double(0x3E663769U, 0x72BEA4D0U); \
    const double lg2 = make_double(0x3FE62E42U, 0xFEFA39EFU);  /* ln 2 */ \
    const double lg2_h = make_double(0x3FE62E43U, 0x00000000U);  /* ln 2, high part */ \
    const double lg2_l = make_double(0xBE205C61U, 0x0CA86C39U);  /* ln 2, low part */ \
    const double cp = make_double(0x3FEEC709U, 0xDC3A03FDU);  /* 2/(3 ln 2) */ \
    const double cp_h = make_double(0x3FEEC709U, 0xE0000000U);  /* its high part */ \
    const double cp_l = make_double(0xBE3E2FE0U, 0x145B01F5U);  /* its low part */ \
    const double ivln2 = make_double(0x3FF71547U, 0x652B82FEU);  /* 1/ln 2 */ \
    const double ivln2_h = make_double(0x3FF71547U, 0x60000000U);  /* its high 24 bits */ \
    const double ivln2_l = make_double(0x3E54AE0BU, 0xF85DDF44U);  /* its low part */ \
    const double two53 = make_double(0x43400000U, 0);  /* 2^53 */ \
    const double ovt = make_double(0x3C971547U, 0x652B82FEU);  /* -(1024-log2(ovfl+.5ulp)) */

static double pow_kernel(double ax, double y)
{
    POW_CONSTANTS
    QJSDblBits w;
    double z, z_h, z_l, p_h, p_l;
    double y1, t1, t2, r, t, u, v, ww;
    int i, j, k, n, ix, iy, hy;

    w.d = ax; ix = (int)(w.w.hi & 0x7fffffffU);
    w.d = y;  hy = (int)w.w.hi; iy = hy & 0x7fffffff;

    if (iy > 0x41e00000) {             /* |y| > 2**31 */
        if (iy > 0x43f00000) {         /* |y| > 2**64: must over/underflow */
            if (ix <= 0x3fefffff)
                return (hy < 0) ? make_double(0x7ff00000U, 0) : 0.0;
            if (ix >= 0x3ff00000)
                return (hy > 0) ? make_double(0x7ff00000U, 0) : 0.0;
        }
        /* over/underflow if x is not close to one */
        if (ix < 0x3fefffff)
            return (hy < 0) ? make_double(0x7ff00000U, 0) : 0.0;
        if (ix > 0x3ff00000)
            return (hy > 0) ? make_double(0x7ff00000U, 0) : 0.0;
        /* now |1-x| is tiny <= 2**-20, suffice to compute
         * log(x) by x-x^2/2+x^3/3-x^4/4 */
        t = ax - 1.0;                   /* t has 20 trailing zeros */
        ww = (t * t) * (0.5 - t * (0.3333333333333333333333 - t * 0.25));
        u = ivln2_h * t;                /* ivln2_h has 21 sig. bits */
        v = t * ivln2_l - ww * ivln2;
        w.d = u + v; w.w.lo = 0; t1 = w.d;
        t2 = v - (t1 - u);
    } else {
        double ss, s2, s_h, s_l, t_h, t_l, kd, bp_k, dp_h_k, dp_l_k;
        n = 0;
        /* take care of a subnormal number */
        if (ix < 0x00100000) {
            ax *= two53; n -= 53;
            w.d = ax; ix = (int)w.w.hi;
        }
        n += (ix >> 20) - 0x3ff;
        j = ix & 0x000fffff;
        /* determine interval */
        ix = j | 0x3ff00000;           /* normalize ix */
        if (j <= 0x3988E) k = 0;       /* |x|<sqrt(3/2) */
        else if (j < 0xBB67A) k = 1;   /* |x|<sqrt(3)   */
        else { k = 0; n += 1; ix -= 0x00100000; }
        w.d = ax; w.w.hi = (QJSWord)ix; ax = w.d;
        /* k is 0 or 1, so these products are exact. (Selecting the
         * constants with "k ? 1.5 : 1.0" or an if makes vbcc emit
         * "fmove.d d4,fp6", which does not assemble.) */
        kd = (double)k;
        bp_k = 1.0 + 0.5 * kd;
        dp_h_k = dp_h1 * kd;
        dp_l_k = dp_l1 * kd;

        /* compute ss = s_h+s_l = (x-1)/(x+1) or (x-1.5)/(x+1.5) */
        u = ax - bp_k;                 /* 1.0 or 1.5 */
        v = 1.0 / (ax + bp_k);
        ss = u * v;
        w.d = ss; w.w.lo = 0; s_h = w.d;
        /* t_h=ax+bp_k High */
        w.w.hi = (QJSWord)(((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18));
        w.w.lo = 0; t_h = w.d;
        t_l = ax - (t_h - bp_k);
        s_l = v * ((u - s_h * t_h) - s_h * t_l);
        /* compute log(ax) */
        s2 = ss * ss;
        r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
        r += s_l * (s_h + ss);
        s2 = s_h * s_h;
        w.d = 3.0 + s2 + r; w.w.lo = 0; t_h = w.d;
        t_l = r - ((t_h - 3.0) - s2);
        /* u+v = ss*(1+...) */
        u = s_h * t_h;
        v = s_l * t_h + t_l * ss;
        /* 2/(3log2)*(ss+...) */
        w.d = u + v; w.w.lo = 0; p_h = w.d;
        p_l = v - (p_h - u);
        z_h = cp_h * p_h;               /* cp_h+cp_l = 2/(3*log2) */
        z_l = cp_l * p_h + p_l * cp + dp_l_k;
        /* log2(ax) = (ss+..)*2/(3*log2) = n + dp_h + z_h + z_l */
        t = (double)n;
        w.d = (((z_h + z_l) + dp_h_k) + t); w.w.lo = 0; t1 = w.d;
        t2 = z_l - (((t1 - t) - dp_h_k) - z_h);
    }

    /* split up y into y1+y2 and compute (y1+y2)*(t1+t2) */
    w.d = y; w.w.lo = 0; y1 = w.d;
    p_l = (y - y1) * t1 + y * t2;
    p_h = y1 * t1;
    w.d = p_l + p_h; z = w.d;
    j = (int)w.w.hi; i = (int)w.w.lo;
    if (j >= 0x40900000) {                         /* z >= 1024 */
        if (((j - 0x40900000) | i) != 0)           /* if z > 1024 */
            return make_double(0x7ff00000U, 0);     /* overflow */
        if (D_GT(p_l + ovt, z - p_h))
            return make_double(0x7ff00000U, 0);     /* overflow */
    } else if ((j & 0x7fffffff) >= 0x4090cc00) {  /* z <= -1075 */
        if ((((QJSWord)j - 0xc090cc00U) | (QJSWord)i) != 0) /* z < -1075 */
            return 0.0;                             /* underflow */
        if (D_LE(p_l, z - p_h))
            return 0.0;                             /* underflow */
    }
    /*
     * compute 2**(p_h+p_l)
     */
    i = j & 0x7fffffff;
    k = (i >> 20) - 0x3ff;
    n = 0;
    if (i > 0x3fe00000) {              /* if |z| > 0.5, set n = [z+0.5] */
        n = j + (0x00100000 >> (k + 1));
        k = ((n & 0x7fffffff) >> 20) - 0x3ff;  /* new k for n */
        w.w.hi = (QJSWord)(n & ~(0x000fffff >> k)); w.w.lo = 0; t = w.d;
        n = ((n & 0x000fffff) | 0x00100000) >> (20 - k);
        if (j < 0) n = -n;
        p_h -= t;
    }
    w.d = p_l + p_h; w.w.lo = 0; t = w.d;
    u = t * lg2_h;
    v = (p_l - (t - p_h)) * lg2 + t * lg2_l;
    z = u + v;
    ww = v - (z - u);
    t = z * z;
    t1 = z - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    r = (z * t1) / (t1 - 2.0) - (ww + z * ww);
    z = 1.0 - (r - z);
    w.d = z;
    j = (int)w.w.hi + (n << 20);
    if ((j >> 20) <= 0)
        return ldexp(z, (int)n);        /* subnormal output */
    w.w.hi = (QJSWord)j;
    return w.d;
}

/*
 * pow(x, y) with the results C99 and ECMAScript agree on, and
 * ECMAScript's choice where they differ: (+-1) ** +-Infinity is NaN
 * (C says 1). NaN ** 0 is 1 in both.
 */
double pow(double x, double y)
{
    QJSDblBits ux, uy;
    QJSWord hx, lx, hy, ly, ix, iy;
    int x_nan, y_nan, y_int, y_odd, ey, neg_result;
    double r;

    ux.d = x; hx = ux.w.hi; lx = ux.w.lo; ix = hx & ~QJS_DBL_SIGN;
    uy.d = y; hy = uy.w.hi; ly = uy.w.lo; iy = hy & ~QJS_DBL_SIGN;

    if ((iy | ly) == 0)
        return 1.0;                             /* anything ** +-0 */
    x_nan = ix > 0x7ff00000U || (ix == 0x7ff00000U && lx != 0);
    y_nan = iy > 0x7ff00000U || (iy == 0x7ff00000U && ly != 0);
    if (x_nan || y_nan)
        return make_double(0x7ff80000U, 0);

    /* is y a whole number, and an odd one? */
    ey = QJS_DBL_EXP(hy) - QJS_DBL_BIAS;
    y_int = 0; y_odd = 0;
    if (ey >= 53) {
        y_int = (ey != 1024);                   /* huge and even; not Infinity */
    } else if (ey >= 0) {
        if (ey > 20) {
            QJSWord frac_mask = (ey == 52) ? 0 : (0xffffffffU >> (ey - 20));
            if ((ly & frac_mask) == 0) {
                y_int = 1;
                y_odd = (int)((ly >> (52 - ey)) & 1);
            }
        } else if (ly == 0 && (iy & (QJS_DBL_MANTMASK >> ey)) == 0) {
            y_int = 1;
            y_odd = (int)((iy >> (20 - ey)) & 1);
        }
    }

    /* whole-number exponents of ordinary size: exact where possible */
    if (USE_POW_INT && y_int && ey <= 10) {
        long n = (long)((((iy & QJS_DBL_MANTMASK) | QJS_DBL_IMPLICIT) >> (20 - ey)));
#ifdef QJS_POW_INT_EXACT
        /* zeros, infinities and denormals take the general path below */
        if (QJS_DBL_EXP(hx) != 0 && QJS_DBL_EXP(hx) != 0x7ff &&
            pow_int_exact(x, (hy & QJS_DBL_SIGN) ? -n : n, &r))
            return r;
#else
        return pow_int(x, (hy & QJS_DBL_SIGN) ? -n : n);
#endif
    }

    if (iy == 0x7ff00000U) {                    /* y is +-Infinity */
        if (ix == 0x3ff00000U && lx == 0)
            return make_double(0x7ff80000U, 0); /* |x| == 1 */
        if ((ix >= 0x3ff00000U) == !(hy & QJS_DBL_SIGN))
            return make_double(0x7ff00000U, 0); /* grows without bound */
        return 0.0;
    }

    /* the sign of the result: negative only for negative x, odd y */
    neg_result = (hx & QJS_DBL_SIGN) && y_odd;

    if ((ix | lx) == 0 || ix == 0x7ff00000U) {
        /* x is +-0 or +-Infinity: the result is 0 or Infinity */
        int to_inf = ((ix | lx) == 0) == ((hy & QJS_DBL_SIGN) != 0);
        return make_double((neg_result ? QJS_DBL_SIGN : 0) |
                           (to_inf ? 0x7ff00000U : 0), 0);
    }
    if ((hx & QJS_DBL_SIGN) && !y_int)
        return make_double(0x7ff80000U, 0);     /* negative ** fraction */

    ux.w.hi = ix;                               /* |x| */
    if (ix == 0x3ff00000U && lx == 0)
        r = 1.0;                                /* (+-1) ** anything finite */
    else if (hy == 0x3fe00000U && ly == 0)
        r = sqrt(ux.d);                         /* y == 0.5: correctly rounded */
    else
        r = pow_kernel(ux.d, y);
    return neg_result ? -r : r;
}
