/*
 * sharedlib_math_prim.c - exp, log, log10, sin, cos, tan, atan, asin,
 * acos, sinh, cosh, tanh and sqrt for the soft-float variants,
 * computed with nothing but + - * / on doubles.
 *
 * Until 0.231 these called mathieeedoubtrans.library. Without an FPU
 * that library does its internal arithmetic with mathieeedoubbas,
 * whose multiply drops a carry for some operands, so its results are
 * usually good to a few units in the last place but now and then only
 * to seven digits: Math.atan(0.9999999995) was 0.785398127 where the
 * value is 0.785398163, and Math.pow(2147483647, 3) was wrong in the
 * eighth digit. It also knows nothing of NaN, infinity, signed zero or
 * denormals (IEEEDPSin(Infinity) is 0, IEEEDPLog(NaN) is 710.19).
 *
 * With the library's own IEEE arithmetic underneath (sharedlib_softfp.s)
 * the functions can be computed here instead, and then the soft-float
 * variants do not call the operating system's maths libraries at all.
 *
 * The methods are the plain ones, chosen so that no table of fitted
 * coefficients has to be trusted (vbcc does not convert a long decimal
 * constant to the nearest double, see scripts/check_fp_literals.py; the
 * few constants needed are given as bit patterns):
 *
 *   exp    x = k ln2 + r, |r| <= ln2/2; e^r from its power series;
 *          scaled by 2^k with ldexp, which also rounds a denormal
 *          result and overflows to infinity.
 *   log    x = m 2^e, m in [sqrt(1/2), sqrt(2)); with f = m - 1 and
 *          s = f / (2 + f), log(m) = f - s (f - W), W the series
 *          2 s^2/3 + 2 s^4/5 + ...; plus e ln2 in two pieces.
 *   sin, cos, tan   the nearest multiple n of pi/2 is taken off: up
 *          to 2^20 with pi/2 in three pieces (118 bits), beyond that
 *          by multiplying with as many bits of 2/pi as the size of
 *          the argument calls for (Payne and Hanek); then the power
 *          series on |r| <= pi/4.
 *   atan   the argument is moved towards zero with
 *          atan(x) = atan(c) + atan((x - c) / (1 + x c)) for c = 0.5,
 *          1, 1.5 (or pi/2 - atan(1/x)), then the series.
 *   asin, acos      through atan2 and sqrt.
 *   sinh, cosh, tanh   through exp and expm1.
 *   sqrt   bit by bit on the significand; correctly rounded.
 *
 * Accuracy, measured against the build machine's libm by
 * perf/mathcheck/run.sh (the worst case over a few million arguments
 * is printed there): sqrt exact; exp, log, atan within 1 unit in
 * the last place, sin, cos, log10, asin, acos, tanh within 2, sinh and cosh
 * within 3, tan within 4, at every size of argument.
 *
 * Speed: these are series of 10 to 22 terms in software arithmetic, a
 * few thousand instructions a call. Correct first.
 *
 * QJS_HOST_TEST builds the file on the build machine with the names
 * prefixed (see perf/mathcheck/primcheck.c). Nothing in the library
 * defines it.
 */
#include "sharedlib_dblbits.h"

#ifdef QJS_HOST_TEST
#define D_LT(a, b) ((a) < (b))
#define D_LE(a, b) ((a) <= (b))
#define D_GT(a, b) ((a) > (b))
#define D_GE(a, b) ((a) >= (b))
#define D_EQ(a, b) ((a) == (b))
#else
#include "dcmp.h"       /* NaN-aware comparisons on a soft-float build */
double ldexp(double x, int n);              /* sharedlib_math_round.c */
double frexp(double x, int *eptr);
double nearbyint(double x);
double expm1(double x);                     /* sharedlib_math_fpu_aux.c */
double atan2(double y, double x);           /* sharedlib_math.c */
double pow(double x, double y);             /* sharedlib_math_pow.c */
double fabs(double x);                      /* sharedlib_math_soft.c */
#endif

double exp(double x);
double log(double x);
double sqrt(double x);
double atan(double x);

static double prim_bits(QJSWord hi, QJSWord lo)
{
    QJSDblBits u;
    u.w.hi = hi; u.w.lo = lo;
    return u.d;
}
static QJSWord prim_hi(double x) { QJSDblBits u; u.d = x; return u.w.hi; }
static QJSWord prim_lo(double x) { QJSDblBits u; u.d = x; return u.w.lo; }
/* high word of |x|: 0x7ff00000 and above is infinity or NaN */
#define AHI(x)      (prim_hi(x) & ~QJS_DBL_SIGN)
#define IS_NAN(x)   (AHI(x) > 0x7ff00000U || (AHI(x) == 0x7ff00000U && prim_lo(x) != 0))
#define IS_INF(x)   (AHI(x) == 0x7ff00000U && prim_lo(x) == 0)
#define IS_ZERO(x)  ((AHI(x) | prim_lo(x)) == 0)
#define IS_NEG(x)   ((prim_hi(x) & QJS_DBL_SIGN) != 0)
#define QNAN()      prim_bits(0x7ff80000U, 0)
#define INF()       prim_bits(0x7ff00000U, 0)

/* constants, as bit patterns; the decimal values are for the reader */
#define LN2_HI      prim_bits(0x3fe62e42U, 0xfee00000U)  /* 6.93147180369123816490e-01 */
#define LN2_LO      prim_bits(0x3dea39efU, 0x35793c76U)  /* 1.90821492927058770002e-10 */
#define INV_LN2     prim_bits(0x3ff71547U, 0x652b82feU)  /* 1.44269504088896338700e+00 */
#define INV_LN10    prim_bits(0x3fdbcb7bU, 0x1526e50eU)  /* 4.34294481903251816668e-01 */
#define SQRT_HALF   prim_bits(0x3fe6a09eU, 0x667f3bcdU)  /* 0.70710678118654757 */
#define TWO_OVER_PI prim_bits(0x3fe45f30U, 0x6dc9c883U)  /* 2/pi */
#define PIO2_1      prim_bits(0x3ff921fbU, 0x54400000U)  /* first 33 bits of pi/2 */
#define PIO2_2      prim_bits(0x3dd0b461U, 0x1a600000U)  /* the next 33 bits */
#define PIO2_2T     prim_bits(0x3ba3198aU, 0x2e037073U)  /* pi/2 - (PIO2_1 + PIO2_2) */
#define PIO4        prim_bits(0x3fe921fbU, 0x54442d18U)  /* pi/4 */
#define PIO2_HI     prim_bits(0x3ff921fbU, 0x54442d18U)  /* pi/2 */
#define PIO2_LO     prim_bits(0x3c91a626U, 0x33145c07U)  /* pi/2 - PIO2_HI */
#define ATAN_05_HI  prim_bits(0x3fddac67U, 0x0561bb4fU)  /* atan(0.5) */
#define ATAN_05_LO  prim_bits(0x3c7a2b7fU, 0x222f65e2U)
#define ATAN_10_HI  prim_bits(0x3fe921fbU, 0x54442d18U)  /* atan(1) */
#define ATAN_10_LO  prim_bits(0x3c81a626U, 0x33145c07U)
#define ATAN_15_HI  prim_bits(0x3fef730bU, 0xd281f69bU)  /* atan(1.5) */
#define ATAN_15_LO  prim_bits(0x3c700788U, 0x7af0cbbdU)

/* ------------------------------------------------------------------ */

double exp(double x)
{
    double r, hi, lo, u, kd;
    int k, i;

    if (IS_NAN(x)) return QNAN();
    if (IS_INF(x)) return IS_NEG(x) ? 0.0 : x;
    if (AHI(x) >= 0x40900000U)                  /* |x| >= 1024 */
        return IS_NEG(x) ? 0.0 : INF();
    if (AHI(x) < 0x3e300000U)                   /* |x| < 2^-28 */
        return 1.0 + x;
    kd = nearbyint(x * INV_LN2);
    k = (int)kd;
    hi = x - kd * LN2_HI;                       /* exact: LN2_HI has 21 zero low bits */
    lo = kd * LN2_LO;
    r = hi - lo;
    u = 1.0;                                    /* e^r - 1 = r (1 + r/2 (1 + r/3 (...))) */
    for (i = 14; i >= 2; i--)
        u = 1.0 + (r / (double)i) * u;
    u = 1.0 + ((r * u - r) - lo + hi);          /* keeps the bits hi - lo dropped */
    return ldexp(u, k);
}

/* log(m) for m in [sqrt(1/2), sqrt(2)), added to e ln2 */
static double log_reduced(double m, int e)
{
    double f = m - 1.0, s, z, w, ed = (double)e;
    int i;

    if (IS_ZERO(f))
        return ed * LN2_HI + ed * LN2_LO;
    s = f / (2.0 + f);
    z = s * s;
    w = 0.0;                                    /* W = 2 (z/3 + z^2/5 + ...) */
    for (i = 23; i >= 3; i -= 2)
        w = (w + 2.0 / (double)i) * z;
    return ed * LN2_HI - ((s * (f - w) - ed * LN2_LO) - f);
}

double log(double x)
{
    double m;
    int e;

    if (IS_NAN(x)) return QNAN();
    if (IS_ZERO(x)) return -INF();
    if (IS_NEG(x)) return QNAN();
    if (IS_INF(x)) return x;
    m = frexp(x, &e);                           /* [0.5, 1), denormals too */
    if (D_LT(m, SQRT_HALF)) {
        m = m + m;
        e--;
    }
    return log_reduced(m, e);
}

/* log10(x); a power of ten gives its whole-number exponent exactly */
double log10(double x)
{
    double r, n;

    r = log(x);
    if (AHI(r) >= 0x7ff00000U || IS_ZERO(r))    /* NaN, +-Infinity, log10(1) */
        return r;
    r = r * INV_LN10;
    n = nearbyint(r);
    if (D_LT(fabs(r - n), 1e-9) && D_LE(fabs(n), 330.0) && D_EQ(pow(10.0, n), x))
        return n;
    return r;
}

/* ------------------------------------------------------------------ */

/*
 * Take the nearest multiple of pi/2 off x, for pi/4 < x < 2^20:
 * the remainder is y[0] + y[1] with |y[0]| <= pi/4 or a hair more, and
 * the result is that multiple modulo 4. n PIO2_1 is an exact product
 * in this range, which is what makes the subtraction exact.
 */
static int rem_pio2_medium(double x, double *y)
{
    double fn, r, w, t;

    fn = nearbyint(x * TWO_OVER_PI);
    r = x - fn * PIO2_1;
    t = r;
    w = fn * PIO2_2;
    r = t - w;
    w = fn * PIO2_2T - ((t - r) - w);
    y[0] = r - w;
    y[1] = (r - y[0]) - w;
    return (int)fn & 3;
}

/*
 * 2/pi, the first 1280 bits after the binary point, 32 at a time.
 * (Computed with integer arithmetic from Machin's formula; the first
 * words are the familiar A2F9836E 4E441529 FC2757D1.)
 */
static const QJSWord two_over_pi[40] = {
    0xa2f9836eU, 0x4e441529U, 0xfc2757d1U, 0xf534ddc0U, 0xdb629599U,
    0x3c439041U, 0xfe5163abU, 0xdebbc561U, 0xb7246e3aU, 0x424dd2e0U,
    0x06492eeaU, 0x09d1921cU, 0xfe1deb1cU, 0xb129a73eU, 0xe88235f5U,
    0x2ebb4484U, 0xe99c7026U, 0xb45f7e41U, 0x3991d639U, 0x835339f4U,
    0x9c845f8bU, 0xbdf9283bU, 0x1ff897ffU, 0xde05980fU, 0xef2f118bU,
    0x5a0a6d1fU, 0x6d367ecfU, 0x27cb09b7U, 0x4f463f66U, 0x9e5fea2dU,
    0x7527bac7U, 0xebe5f17bU, 0x3d0739f7U, 0x8a5292eaU, 0x6bfb5fb1U,
    0x1f8d5d08U, 0x56033046U, 0xfc7b6babU, 0xf0cfbc20U, 0x9af4361dU
};

/* n (1..32) bits of the little-endian number p, from bit pos upward */
static QJSWord limb_bits(const QJSWord *p, int pos, int n)
{
    int word = pos >> 5, sh = pos & 31;
    QJSWord v = p[word] >> sh;

    if (sh != 0)
        v |= p[word + 1] << (32 - sh);
    if (n < 32)
        v &= (1U << n) - 1;
    return v;
}

/*
 * The same for any x >= 2^20 (Payne and Hanek's method). x is an
 * integer M of 53 bits times 2^e, so x 2/pi = M 2^e (2/pi). The bits
 * of 2/pi that weigh 4 or more after the scaling only add multiples of
 * 4 to the result (M is an integer) and are skipped; M is multiplied
 * by the next 192 bits as integers, which leaves the quotient modulo 4
 * and its fraction to some 130 bits. The fraction, taken to the
 * nearest (so within +-0.5), times pi/2 is the remainder.
 */
static int rem_pio2_large(double x, double *y)
{
    typedef unsigned long long U64;
    QJSWord w[6], p[9], mh, ml, l0, l1, l2;
    U64 t, carry;
    double a, b, c, fhi, flo, fh, fl, p1, p2, y0, y1;
    QJSDblBits u;
    int e, j0, q, s, b0, i, n;

    u.d = x;
    e = QJS_DBL_EXP(u.w.hi) - QJS_DBL_BIAS - 52;        /* x = M 2^e */
    mh = (u.w.hi & QJS_DBL_MANTMASK) | QJS_DBL_IMPLICIT;
    ml = u.w.lo;
    j0 = (e > 2) ? e - 2 : 0;           /* first bit of 2/pi that matters */
    q = j0 >> 5; s = j0 & 31;
    for (i = 0; i < 6; i++) {
        w[i] = two_over_pi[q + i] << s;
        if (s != 0)
            w[i] |= two_over_pi[q + i + 1] >> (32 - s);
    }
    /* p = M * w, least significant word first */
    carry = 0;
    for (i = 0; i < 6; i++) {
        t = (U64)ml * w[5 - i] + carry;
        p[i] = (QJSWord)t; carry = t >> 32;
    }
    p[6] = (QJSWord)carry; p[7] = 0; p[8] = 0;
    carry = 0;
    for (i = 0; i < 6; i++) {
        t = (U64)mh * w[5 - i] + p[i + 1] + carry;
        p[i + 1] = (QJSWord)t; carry = t >> 32;
    }
    p[7] = (QJSWord)carry;
    /* w's lowest bit weighs 2^(e - j0 - 192): the binary point of p */
    b0 = 192 + j0 - e;
    n = (int)limb_bits(p, b0, 2);
    l0 = limb_bits(p, b0 - 32, 32);
    l1 = limb_bits(p, b0 - 64, 32);
    l2 = limb_bits(p, b0 - 96, 32);
    a = (double)l0 * prim_bits(0x3df00000U, 0);         /* 2^-32 */
    b = (double)l1 * prim_bits(0x3bf00000U, 0);         /* 2^-64 */
    c = (double)l2 * prim_bits(0x39f00000U, 0);         /* 2^-96 */
    if (l0 & 0x80000000U) {             /* fraction >= 1/2: the next multiple */
        a -= 1.0;
        n++;
    }
    fhi = a + b;
    flo = ((a - fhi) + b) + c;
    /* (fhi + flo) * pi/2 without losing the low half of the product:
     * fhi and pi/2 are each cut in two pieces whose products are exact */
    u.d = fhi; u.w.lo &= 0xf8000000U; fh = u.d;
    fl = fhi - fh;
    p1 = prim_bits(0x3ff921fbU, 0x50000000U);           /* top 26 bits of pi/2 */
    p2 = PIO2_HI - p1;
    y0 = fh * p1;
    y1 = (fh * p2 + fl * p1) + (fl * p2 + fhi * PIO2_LO + flo * PIO2_HI);
    y[0] = y0 + y1;
    y[1] = (y0 - y[0]) + y1;
    return n & 3;
}

/* sin(y + t) for |y| <= pi/4 and a tiny t */
static double sin_kernel(double y, double t)
{
    double z = y * y, u = 0.0;
    int i;

    /* u = z/6 (1 - z/20 (1 - z/42 (...))); sin y = y - y u */
    for (i = 21; i >= 3; i -= 2)
        u = (1.0 - u) * (z / (double)(i * (i - 1)));
    return y - (y * u - t);
}

/* cos(y + t) for |y| <= pi/4 and a tiny t */
static double cos_kernel(double y, double t)
{
    double z = y * y, u = 0.0;
    int i;

    /* u = z/2 (1 - z/12 (1 - z/30 (...))); cos y = 1 - u */
    for (i = 22; i >= 2; i -= 2)
        u = (1.0 - u) * (z / (double)(i * (i - 1)));
    return 1.0 - (u + y * t);
}

/* which: 0 sin, 1 cos, 2 tan. sin and tan are odd, cos is even, so the
 * work is done on |x|. */
static double trig(double x, int which)
{
    double y[2], s, c, r, a;
    int n;

    if (AHI(x) >= 0x7ff00000U)
        return QNAN();                          /* NaN or infinite */
    if (which != 1 && AHI(x) < 0x3e400000U)     /* |x| < 2^-27: sin x = tan x = x, */
        return x;                               /*   which also keeps -0 */
    a = fabs(x);
    if (D_LE(a, PIO4)) {
        y[0] = a; y[1] = 0.0; n = 0;
    } else if (AHI(x) < 0x41300000U) {          /* below 2^20 */
        n = rem_pio2_medium(a, y);
    } else {
        n = rem_pio2_large(a, y);
    }
    if (which == 2) {
        s = sin_kernel(y[0], y[1]);
        c = cos_kernel(y[0], y[1]);
        r = (n & 1) ? -(c / s) : s / c;
    } else {
        if (which == 1)
            n++;                                /* cos x = sin(x + pi/2) */
        switch (n & 3) {
        case 0:  r = sin_kernel(y[0], y[1]); break;
        case 1:  r = cos_kernel(y[0], y[1]); break;
        case 2:  r = -sin_kernel(y[0], y[1]); break;
        default: r = -cos_kernel(y[0], y[1]); break;
        }
    }
    return (which != 1 && IS_NEG(x)) ? -r : r;
}

double sin(double x) { return trig(x, 0); }
double cos(double x) { return trig(x, 1); }
double tan(double x) { return trig(x, 2); }

/* ------------------------------------------------------------------ */

double atan(double x)
{
    double a, t, z, u, hi, lo;
    int i, n;

    if (IS_NAN(x)) return QNAN();
    if (AHI(x) < 0x3e400000U) return x;         /* |x| < 2^-27, and +-0 */
    a = fabs(x);
    if (AHI(x) >= 0x44100000U) {                /* |x| >= 2^66, infinity */
        t = PIO2_HI + PIO2_LO;
        return IS_NEG(x) ? -t : t;
    }
    if (D_LT(a, 0.4375)) {                      /* 7/16 */
        t = a; hi = 0.0; lo = 0.0;
    } else if (D_LT(a, 0.6875)) {               /* 11/16 */
        t = (2.0 * a - 1.0) / (2.0 + a); hi = ATAN_05_HI; lo = ATAN_05_LO;
    } else if (D_LT(a, 1.1875)) {               /* 19/16 */
        t = (a - 1.0) / (a + 1.0); hi = ATAN_10_HI; lo = ATAN_10_LO;
    } else if (D_LT(a, 2.4375)) {               /* 39/16 */
        t = (a - 1.5) / (1.0 + 1.5 * a); hi = ATAN_15_HI; lo = ATAN_15_LO;
    } else {
        t = -1.0 / a; hi = PIO2_HI; lo = PIO2_LO;
    }
    /* atan t = t - t^3/3 + t^5/5 - ... = t - t (z/3 - z^2/5 + ...).
     * |t| is below 0.4375, and well below it outside the first range;
     * the number of terms follows from how small t is. */
    z = t * t;
    n = D_LT(z, 0.0625) ? 31 : 47;
    u = 0.0;
    for (i = n; i >= 3; i -= 2)
        u = (1.0 / (double)i - u) * z;
    t = hi - ((t * u - lo) - t);
    return IS_NEG(x) ? -t : t;
}

double asin(double x)
{
    if (IS_NAN(x) || AHI(x) > 0x3ff00000U || (AHI(x) == 0x3ff00000U && prim_lo(x) != 0))
        return QNAN();                          /* |x| > 1 */
    if (AHI(x) < 0x3e400000U) return x;         /* |x| < 2^-27, and +-0 */
    return atan2(x, sqrt((1.0 - x) * (1.0 + x)));
}

double acos(double x)
{
    if (IS_NAN(x) || AHI(x) > 0x3ff00000U || (AHI(x) == 0x3ff00000U && prim_lo(x) != 0))
        return QNAN();
    if (prim_hi(x) == 0x3ff00000U && prim_lo(x) == 0)
        return 0.0;                             /* acos(1) is +0 */
    return atan2(sqrt((1.0 - x) * (1.0 + x)), x);
}

/* ------------------------------------------------------------------ */

double sinh(double x)
{
    double a, t, r;

    if (IS_NAN(x)) return QNAN();
    if (IS_INF(x) || AHI(x) < 0x3e300000U) return x;    /* |x| < 2^-28: sinh x = x */
    a = fabs(x);
    if (D_LT(a, 22.0)) {
        t = expm1(a);
        if (D_LT(a, 1.0))
            r = 0.5 * (2.0 * t - t * t / (t + 1.0));
        else
            r = 0.5 * (t + t / (t + 1.0));
    } else {
        t = exp(0.5 * a);                       /* e^a alone overflows too soon */
        r = (0.5 * t) * t;
    }
    return IS_NEG(x) ? -r : r;
}

double cosh(double x)
{
    double a, t;

    if (IS_NAN(x)) return QNAN();
    if (IS_INF(x)) return INF();
    a = fabs(x);
    if (D_LT(a, 0.34657359027997264)) {         /* ln2 / 2 */
        t = expm1(a);
        return 1.0 + (t * t) / (2.0 * (1.0 + t));
    }
    if (D_LT(a, 22.0)) {
        t = exp(a);
        return 0.5 * t + 0.5 / t;
    }
    t = exp(0.5 * a);
    return (0.5 * t) * t;
}

double tanh(double x)
{
    double a, t, r;

    if (IS_NAN(x)) return QNAN();
    if (AHI(x) < 0x3e300000U) return x;         /* |x| < 2^-28, and +-0 */
    a = fabs(x);
    if (D_GE(a, 22.0)) {
        r = 1.0;                                /* to the last bit; also infinity */
    } else if (D_GE(a, 1.0)) {
        t = expm1(2.0 * a);
        r = 1.0 - 2.0 / (t + 2.0);
    } else {
        t = expm1(-2.0 * a);
        r = -t / (t + 2.0);
    }
    return IS_NEG(x) ? -r : r;
}

/* ====================================================================
 * sqrt, correctly rounded. Derived from e_sqrt.c of FreeBSD's msun /
 * fdlibm:
 *
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================================
 *
 * The square root is developed one bit at a time with integer
 * arithmetic on the two halves of the significand (54 steps), and the
 * remainder decides the rounding. Changes from the original: the
 * words are reached through QJSDblBits, the special cases are decided
 * on the bits, and the rounding is fixed at round-to-nearest instead
 * of being probed with floating-point additions.
 */
double sqrt(double x)
{
    const QJSWord sign = 0x80000000U;
    QJSWord r, t1, s1, ix1, q1;
    int ix0, s0, q, m, t, i;                    /* 32 bits on the 68k and the host */

    ix0 = (int)prim_hi(x);
    ix1 = prim_lo(x);

    if ((ix0 & 0x7ff00000) == 0x7ff00000) {
        if (IS_NAN(x)) return QNAN();
        return ix0 < 0 ? QNAN() : x;            /* sqrt(-Infinity), sqrt(Infinity) */
    }
    if (ix0 <= 0) {
        if (((ix0 & 0x7fffffff) | (int)ix1) == 0) return x;     /* +-0 */
        if (ix0 < 0) return QNAN();
    }
    /* normalise x */
    m = ix0 >> 20;
    if (m == 0) {                               /* denormal */
        while (ix0 == 0) {
            m -= 21;
            ix0 |= (int)(ix1 >> 11); ix1 <<= 21;
        }
        for (i = 0; (ix0 & 0x00100000) == 0; i++) ix0 <<= 1;
        m -= i - 1;
        if (i != 0)
            ix0 |= (int)(ix1 >> (32 - i));
        ix1 <<= i;
    }
    m -= 1023;                                  /* unbias the exponent */
    ix0 = (ix0 & 0x000fffff) | 0x00100000;
    if (m & 1) {                                /* odd m: double x to make it even */
        ix0 += ix0 + (int)((ix1 & sign) >> 31);
        ix1 += ix1;
    }
    m >>= 1;                                    /* m = [m/2] */

    /* generate sqrt(x) bit by bit */
    ix0 += ix0 + (int)((ix1 & sign) >> 31);
    ix1 += ix1;
    q = s0 = 0;                                 /* [q,q1] = sqrt(x) */
    q1 = s1 = 0;
    r = 0x00200000U;                            /* moving bit, right to left */

    while (r != 0) {
        t = s0 + (int)r;
        if (t <= ix0) {
            s0 = t + (int)r;
            ix0 -= t;
            q += (int)r;
        }
        ix0 += ix0 + (int)((ix1 & sign) >> 31);
        ix1 += ix1;
        r >>= 1;
    }

    r = sign;
    while (r != 0) {
        t1 = s1 + r;
        t = s0;
        if (t < ix0 || (t == ix0 && t1 <= ix1)) {
            s1 = t1 + r;
            if ((t1 & sign) == sign && (s1 & sign) == 0) s0 += 1;
            ix0 -= t;
            if (ix1 < t1) ix0 -= 1;
            ix1 -= t1;
            q1 += r;
        }
        ix0 += ix0 + (int)((ix1 & sign) >> 31);
        ix1 += ix1;
        r >>= 1;
    }

    /* a remainder means the true root lies above [q,q1]: round to nearest */
    if (((QJSWord)ix0 | ix1) != 0) {
        if (q1 == 0xffffffffU) { q1 = 0; q += 1; }
        else q1 += (q1 & 1);
    }
    ix0 = (q >> 1) + 0x3fe00000;
    ix1 = q1 >> 1;
    if (q & 1) ix1 |= sign;
    ix0 += (m << 20);
    return prim_bits((QJSWord)ix0, ix1);
}
