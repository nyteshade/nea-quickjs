/*
 * sharedlib_math_round.c - floor, ceil, trunc, round, nearbyint,
 * lround, fmod, ldexp and frexp for the FPU variants, done on the bits
 * of the double.
 *
 * Why these exist is in sharedlib_math_fpu.h: vbcc's inline versions
 * are wrong on the 68040 (everything goes through a 32-bit integer)
 * and use instructions a 68040 must trap to emulate (FINTRZ) or that
 * cannot be tested on the build machine (FMOD, FSCALE).
 *
 * Nothing here uses FINT, FINTRZ, FMOD, FSCALE or FGETEXP, reads or
 * writes the FPCR, or compares a NaN. The only floating-point
 * instructions are loads and stores of the argument and result, and
 * the exact subtraction inside fmod.
 *
 * Linked into every variant (the soft-float ones from 0.232).
 *
 * Tested by amiga/tests/test_fpu_numeric.js and, on the build machine,
 * by perf/mathcheck/run.sh.
 */
#include "sharedlib_dblbits.h"
#ifdef QJS_HOST_TEST
#define D_LE(a, b) ((a) <= (b))
#define D_GE(a, b) ((a) >= (b))
#else
#include "dcmp.h"       /* D_LE, D_GE: plain operators unless soft-float */
#endif

/* how round_to_integer() treats the fraction */
#define RND_TRUNC     0     /* toward zero */
#define RND_FLOOR     1     /* toward -Infinity */
#define RND_CEIL      2     /* toward +Infinity */
#define RND_HALF_AWAY 3     /* nearest, halves away from zero (C round) */
#define RND_HALF_EVEN 4     /* nearest, halves to even (IEEE default) */

/*
 * x rounded to an integer in the given way, for every double: NaN and
 * the infinities come back unchanged, as does anything of magnitude
 * 2^52 or more (already an integer), and a zero result keeps the sign
 * of x, which is what C and ECMAScript both require (ceil(-0.5) is
 * -0).
 *
 * With unbiased exponent e in 0..51 the low 52-e bits of the mantissa
 * are the fraction. They are cleared, and if the mode asks for the
 * next integer away from zero one unit is added at the lowest integer
 * bit; a carry out of the mantissa runs into the exponent field, which
 * is exactly the next power of two.
 */
static double round_to_integer(double x, int mode)
{
    QJSDblBits u;
    QJSWord hi, lo, mask_hi, mask_lo, frac_hi, frac_lo, half_hi, half_lo, unit;
    int e, neg, up, odd;

    u.d = x;
    hi = u.w.hi; lo = u.w.lo;
    e = QJS_DBL_EXP(hi) - QJS_DBL_BIAS;
    neg = (hi & QJS_DBL_SIGN) != 0;

    if (e >= 52)
        return x;

    if (e < 0) {
        /* |x| < 1: the result is 0 or 1, with the sign of x */
        int nonzero = ((hi & ~QJS_DBL_SIGN) | lo) != 0;
        switch (mode) {
        case RND_FLOOR:     up = neg && nonzero; break;
        case RND_CEIL:      up = !neg && nonzero; break;
        case RND_HALF_AWAY: up = (e == -1); break;              /* |x| >= 0.5 */
        case RND_HALF_EVEN: up = (e == -1) &&
                                 ((hi & QJS_DBL_MANTMASK) | lo) != 0; break; /* > 0.5 */
        default:            up = 0; break;
        }
        u.w.hi = (hi & QJS_DBL_SIGN) | (up ? 0x3ff00000U : 0);
        u.w.lo = 0;
        return u.d;
    }

    /* masks of the fraction bits, the bit worth one half, and whether
     * the integer part is odd */
    if (e < 20) {
        mask_hi = QJS_DBL_MANTMASK >> e;
        mask_lo = 0xffffffffU;
        half_hi = 0x00080000U >> e;
        half_lo = 0;
        odd = (hi & (QJS_DBL_IMPLICIT >> e)) != 0;
    } else {
        mask_hi = 0;
        mask_lo = 0xffffffffU >> (e - 20);
        half_hi = 0;
        half_lo = 0x80000000U >> (e - 20);
        odd = (e == 20) ? (int)(hi & 1) : (lo & (0x80000000U >> (e - 21))) != 0;
    }
    frac_hi = hi & mask_hi;
    frac_lo = lo & mask_lo;
    if ((frac_hi | frac_lo) == 0)
        return x;                               /* already an integer */
    hi &= ~mask_hi;
    lo &= ~mask_lo;

    switch (mode) {
    case RND_FLOOR: up = neg; break;
    case RND_CEIL:  up = !neg; break;
    case RND_HALF_AWAY:
        up = frac_hi > half_hi || (frac_hi == half_hi && frac_lo >= half_lo);
        break;
    case RND_HALF_EVEN:
        up = frac_hi > half_hi || (frac_hi == half_hi && frac_lo > half_lo) ||
             (frac_hi == half_hi && frac_lo == half_lo && odd);
        break;
    default: up = 0; break;
    }
    if (up) {
        if (e < 20) {
            hi += QJS_DBL_IMPLICIT >> e;
        } else if (e == 20) {
            hi += 1;
        } else {
            unit = 0x80000000U >> (e - 21);
            lo += unit;
            if (lo < unit)
                hi += 1;
        }
    }
    u.w.hi = hi; u.w.lo = lo;
    return u.d;
}

double floor(double x)     { return round_to_integer(x, RND_FLOOR); }
double ceil(double x)      { return round_to_integer(x, RND_CEIL); }
double trunc(double x)     { return round_to_integer(x, RND_TRUNC); }
double round(double x)     { return round_to_integer(x, RND_HALF_AWAY); }
double nearbyint(double x) { return round_to_integer(x, RND_HALF_EVEN); }

/* round(x) as a long; out of range saturates, NaN gives 0 */
long lround(double x)
{
    QJSDblBits u;
    QJSWord m;
    int e;

    u.d = round_to_integer(x, RND_HALF_AWAY);
    e = QJS_DBL_EXP(u.w.hi) - QJS_DBL_BIAS;
    if (e < 0)
        return 0;
    if (e >= 31) {
        if (e == 1024 && ((u.w.hi & QJS_DBL_MANTMASK) | u.w.lo) != 0)
            return 0;
        return (u.w.hi & QJS_DBL_SIGN) ? (long)(-2147483647L - 1) : 2147483647L;
    }
    /* the top 32 mantissa bits, leading 1 in bit 31, moved down */
    m = (((u.w.hi & QJS_DBL_MANTMASK) | QJS_DBL_IMPLICIT) << 11) | (u.w.lo >> 21);
    m >>= 31 - e;
    return (u.w.hi & QJS_DBL_SIGN) ? -(long)m : (long)m;
}

/* fmod(x, y): the remainder of x / y with the sign of x, exact.
 *
 * This is shift-and-subtract. t is |y| scaled by a power of two to
 * the largest |y|*2^k not above r; it is then halved back down to
 * |y|, and subtracted from r whenever it fits. r < 2t holds
 * throughout, so every r - t is exact whatever the rounding mode.
 * Positive doubles order the same way as their bit patterns, so the
 * comparisons, the scaling and the halving are integer operations on
 * the two halves; the only floating-point operation in the loop is the
 * subtraction.
 *
 * NaN and infinity are recognised from the exponent bits, not by
 * comparing, so the result does not depend on how anything orders NaN.
 *
 * (Until 0.231 this lived in sharedlib_math_fpu_aux.c and the 68020
 * FPU variant used the 6888x FMOD instruction instead.) */
double fmod(double x, double y)
{
    QJSDblBits ux, uy, ur, ua, ut;
    QJSWord ex, ey;

/* a >= b for two non-negative doubles, on their bits */
#define FMOD_GE(a, b) ((a).w.hi > (b).w.hi || \
                       ((a).w.hi == (b).w.hi && (a).w.lo >= (b).w.lo))

    ux.d = x; uy.d = y;
    ex = (ux.w.hi >> 20) & 0x7ff;
    ey = (uy.w.hi >> 20) & 0x7ff;

    /* y is NaN, x is NaN or infinite, or y is zero: NaN */
    if ((ey == 0x7ff && ((uy.w.hi & QJS_DBL_MANTMASK) | uy.w.lo) != 0) ||
        ex == 0x7ff ||
        (((uy.w.hi & ~QJS_DBL_SIGN) | uy.w.lo) == 0)) {
        ux.w.hi = 0x7ff80000U; ux.w.lo = 0;
        return ux.d;
    }
    /* y infinite, or x zero (keeps -0): x */
    if (ey == 0x7ff || ((ux.w.hi & ~QJS_DBL_SIGN) | ux.w.lo) == 0)
        return x;

    ur = ux; ur.w.hi &= ~QJS_DBL_SIGN;      /* r = |x| */
    ua = uy; ua.w.hi &= ~QJS_DBL_SIGN;      /* |y| */

    if (FMOD_GE(ur, ua)) {
        ut = ua;
        if (ey != 0) {
            /* |y| is a normal number: give t the exponent of r, which
             * multiplies it by a power of two, then halve once if that
             * overshot. From here t stays normal, so halving it is
             * taking one from its exponent. */
            ut.w.hi = (ut.w.hi & QJS_DBL_MANTMASK) | (ex << 20);
            if (!FMOD_GE(ur, ut))
                ut.w.hi -= QJS_DBL_IMPLICIT;
            for (;;) {
                if (FMOD_GE(ur, ut))
                    ur.d -= ut.d;
                if (ut.w.hi == ua.w.hi)     /* same exponent: t is |y| */
                    break;
                ut.w.hi -= QJS_DBL_IMPLICIT;
            }
        } else {
            /* |y| is denormal (below about 2.2e-308): rare, so plain
             * arithmetic */
            while (D_LE(ut.d, ur.d * 0.5))
                ut.d += ut.d;
            for (;;) {
                if (D_GE(ur.d, ut.d))
                    ur.d -= ut.d;
                if (D_LE(ut.d, ua.d))
                    break;
                ut.d *= 0.5;
            }
        }
    }
#undef FMOD_GE
    /* the sign of x, also on a zero result */
    ur.w.hi |= ux.w.hi & QJS_DBL_SIGN;
    return ur.d;
}

/*
 * Shift a denormal's mantissa up until its leading 1 is where a normal
 * number's implicit 1 sits (bit 20 of the high word). Returns the
 * biased exponent the number then has, which is 1 minus the shift.
 */
static int normalise_denormal(QJSWord *mh, QJSWord *ml)
{
    int e = 1;

    while (!(*mh & QJS_DBL_IMPLICIT)) {
        *mh = (*mh << 1) | (*ml >> 31);
        *ml <<= 1;
        e--;
    }
    return e;
}

/*
 * ldexp(x, n) = x * 2^n, exact unless the result is denormal, in which
 * case it is rounded to nearest (halves to even) as a multiplication
 * would. Overflow gives an infinity. (math.h maps scalbn to this.)
 *
 * The version before 0.231 returned 0 for every denormal result and
 * lost the sign of a zero.
 */
double ldexp(double x, int n)
{
    QJSDblBits u;
    QJSWord sign, mh, ml, rem, sticky;
    int e, s;

    u.d = x;
    sign = u.w.hi & QJS_DBL_SIGN;
    e = QJS_DBL_EXP(u.w.hi);
    mh = u.w.hi & QJS_DBL_MANTMASK;
    ml = u.w.lo;

    if (e == 0x7ff)
        return x;                           /* infinity or NaN */
    if (e == 0) {
        if ((mh | ml) == 0)
            return x;                       /* zero, sign kept */
        e = normalise_denormal(&mh, &ml);
    } else {
        mh |= QJS_DBL_IMPLICIT;
    }
    /* beyond these the result is an infinity or zero anyway; clamping
     * keeps e + n from overflowing an int */
    if (n > 5000) n = 5000;
    if (n < -5000) n = -5000;
    e += n;

    if (e >= 0x7ff) {
        u.w.hi = sign | QJS_DBL_EXPMASK;
        u.w.lo = 0;
        return u.d;
    }
    if (e > 0) {
        u.w.hi = sign | ((QJSWord)e << 20) | (mh & QJS_DBL_MANTMASK);
        u.w.lo = ml;
        return u.d;
    }
    /* Denormal or zero: the 53-bit mantissa moves right by s places.
     * rem collects what falls off, highest bit first. */
    s = 1 - e;
    if (s > 53) {
        u.w.hi = sign; u.w.lo = 0;          /* below half the smallest */
        return u.d;
    }
    sticky = 0;
    if (s < 32) {
        rem = ml << (32 - s);
        ml = (ml >> s) | (mh << (32 - s));
        mh >>= s;
    } else if (s == 32) {
        rem = ml;
        ml = mh;
        mh = 0;
    } else {
        sticky = ml;
        rem = mh << (64 - s);
        ml = mh >> (s - 32);
        mh = 0;
    }
    if ((rem & 0x80000000U) && (((rem << 1) | sticky) != 0 || (ml & 1))) {
        ml++;
        if (ml == 0)
            mh++;                           /* up to the smallest normal */
    }
    u.w.hi = sign | mh;
    u.w.lo = ml;
    return u.d;
}

/*
 * frexp(x, &e): x = m * 2^e with 0.5 <= |m| < 1. Zero, infinity and
 * NaN come back unchanged with e = 0.
 *
 * The version before 0.231 gave a wrong exponent for denormals and
 * turned an infinity into 0.5.
 */
double frexp(double x, int *eptr)
{
    QJSDblBits u;
    QJSWord mh, ml;
    int e;

    u.d = x;
    e = QJS_DBL_EXP(u.w.hi);
    mh = u.w.hi & QJS_DBL_MANTMASK;
    ml = u.w.lo;
    *eptr = 0;
    if (e == 0x7ff || (e == 0 && (mh | ml) == 0))
        return x;
    if (e == 0)
        e = normalise_denormal(&mh, &ml);
    *eptr = e - (QJS_DBL_BIAS - 1);
    /* biased exponent 1022 puts the value in [0.5, 1) */
    u.w.hi = (u.w.hi & QJS_DBL_SIGN) | 0x3fe00000U | (mh & QJS_DBL_MANTMASK);
    u.w.lo = ml;
    return u.d;
}
