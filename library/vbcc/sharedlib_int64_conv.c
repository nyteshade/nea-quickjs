/*
 * sharedlib_int64_conv.c - conversions between double and 64-bit
 * integers, done on the bits with integer instructions only.
 *
 * vbcc calls these helpers for casts between double and (unsigned)
 * long long. A program gets them from vc.lib; the shared library
 * cannot link vc.lib. Linked into every variant:
 *
 *   __flt64tosint64, __flt64touint64   all variants
 *   __sint64toflt64, __uint64toflt64   soft-float variants only (the
 *       FPU variants use the short FPU versions in
 *       sharedlib_int64_fpu.s)
 *
 * Why integer code and no floating point:
 *  - It is exact. The versions up to 0.231 were wrong: the soft-float
 *    one built the low long with (unsigned long)double, which vbcc's
 *    soft-float turns into a SIGNED conversion, so any result whose
 *    low long was 2^31 or more came out as 0x7fffffff (for example
 *    (long long)1794353317748.5); and int64 -> double added two
 *    doubles with mathieeedoubbas, which does not round to nearest, so
 *    2^53+3 became 2^53+2.
 *  - The FPU version used FINTRZ, which a 68040 does not have: every
 *    (int64_t)double trapped into 68040.library.
 *  - The result does not depend on the FPU's rounding mode or
 *    precision, nor on how the maths library treats NaN.
 *
 * Behaviour where C leaves the conversion undefined: NaN gives 0,
 * values too large saturate at the nearest representable integer
 * (negative values give 0 for the unsigned conversion).
 *
 * vbcc's convention for all four: argument on the stack, result in
 * d0 (high) : d1 (low), where a double result is its bit pattern, in
 * an FPU build too. A C function returning double does that only in a
 * soft-float build (in an FPU build it returns in fp0), which is one
 * more reason the two int64 -> double functions below are compiled for
 * soft-float only. The double arguments are read through a pointer so
 * that no FPU register ever holds them (loading a denormal into one
 * traps on the 68040 and 68060).
 *
 * The C names have one underscore; the linker symbols vbcc calls have
 * two (__flt64tosint64, ...).
 *
 * Tested by perf/int64cmp/run.sh against vc.lib and exact values.
 */

/* a 64-bit integer or a double as its two longs; the 68k is big-endian */
typedef union {
    long long v;
    double d;
    struct { unsigned long hi, lo; } w;
} QJSInt64Halves;

/*
 * The integer part of |x| as hi:lo, for a finite x with unbiased
 * exponent e in 0..63. x = mantissa * 2^(e-52) with a 53-bit mantissa
 * mh:ml, so this is a shift of the mantissa by e-52 places.
 */
static void dbl_magnitude(unsigned long mh, unsigned long ml, int e,
                          unsigned long *hi, unsigned long *lo)
{
    int s;

    if (e >= 52) {
        s = e - 52;                         /* left by 0..11 */
        if (s == 0) {
            *hi = mh; *lo = ml;
        } else {
            *hi = (mh << s) | (ml >> (32 - s));
            *lo = ml << s;
        }
    } else {
        s = 52 - e;                         /* right by 1..52 */
        if (s >= 32) {
            *hi = 0;
            *lo = mh >> (s - 32);
        } else {
            *hi = mh >> s;
            *lo = (ml >> s) | (mh << (32 - s));
        }
    }
}

/* (long long)x: truncates toward zero */
long long _flt64tosint64(double x)
{
    const unsigned long *p = (const unsigned long *)&x;
    unsigned long xh = p[0], xl = p[1];
    int e = (int)((xh >> 20) & 0x7ff) - 1023;
    QJSInt64Halves r;

    if (e < 0) {                            /* |x| < 1, zero, denormal */
        r.w.hi = 0; r.w.lo = 0;
        return r.v;
    }
    if (e >= 63) {
        if (e == 1024 && ((xh & 0xfffffUL) | xl) != 0) {
            r.w.hi = 0; r.w.lo = 0;         /* NaN */
        } else if (xh & 0x80000000UL) {
            r.w.hi = 0x80000000UL; r.w.lo = 0;  /* -2^63 itself lands here */
        } else {
            r.w.hi = 0x7fffffffUL; r.w.lo = 0xffffffffUL;
        }
        return r.v;
    }
    dbl_magnitude((xh & 0xfffffUL) | 0x100000UL, xl, e, &r.w.hi, &r.w.lo);
    if (xh & 0x80000000UL) {                /* two's complement */
        r.w.lo = ~r.w.lo + 1;
        r.w.hi = ~r.w.hi + (r.w.lo == 0);
    }
    return r.v;
}

/* (unsigned long long)x: truncates toward zero */
unsigned long long _flt64touint64(double x)
{
    const unsigned long *p = (const unsigned long *)&x;
    unsigned long xh = p[0], xl = p[1];
    int e = (int)((xh >> 20) & 0x7ff) - 1023;
    QJSInt64Halves r;

    r.w.hi = 0; r.w.lo = 0;
    if (e < 0)                              /* |x| < 1, zero, denormal */
        return (unsigned long long)r.v;
    if (e == 1024 && ((xh & 0xfffffUL) | xl) != 0)
        return (unsigned long long)r.v;     /* NaN */
    if (xh & 0x80000000UL)
        return (unsigned long long)r.v;     /* negative */
    if (e >= 64) {
        r.w.hi = 0xffffffffUL; r.w.lo = 0xffffffffUL;
        return (unsigned long long)r.v;
    }
    if (e == 63) {                          /* left by 11, bit 63 set */
        r.w.hi = (((xh & 0xfffffUL) | 0x100000UL) << 11) | (xl >> 21);
        r.w.lo = xl << 11;
        return (unsigned long long)r.v;
    }
    dbl_magnitude((xh & 0xfffffUL) | 0x100000UL, xl, e, &r.w.hi, &r.w.lo);
    return (unsigned long long)r.v;
}

#if !defined(__M68881) && !defined(__M68882)

/*
 * The double nearest to the unsigned value hi:lo, with the given sign
 * bit. Ties go to the even mantissa, as IEEE 754 round-to-nearest
 * requires. Returning r.d moves two longs; it is not arithmetic.
 */
static double u64_to_dbl(unsigned long hi, unsigned long lo,
                         unsigned long sign)
{
    QJSInt64Halves r;
    unsigned long mh, ml, rest;
    int n = 0;                              /* places shifted left */

    if ((hi | lo) == 0) {
        r.w.hi = 0; r.w.lo = 0;
        return r.d;
    }
    /* normalise: bring the highest set bit to bit 63 */
    if (hi == 0) { hi = lo; lo = 0; n = 32; }
    if (!(hi & 0xffff0000UL)) { hi = (hi << 16) | (lo >> 16); lo <<= 16; n += 16; }
    if (!(hi & 0xff000000UL)) { hi = (hi << 8) | (lo >> 24); lo <<= 8; n += 8; }
    if (!(hi & 0xf0000000UL)) { hi = (hi << 4) | (lo >> 28); lo <<= 4; n += 4; }
    if (!(hi & 0xc0000000UL)) { hi = (hi << 2) | (lo >> 30); lo <<= 2; n += 2; }
    if (!(hi & 0x80000000UL)) { hi = (hi << 1) | (lo >> 31); lo <<= 1; n += 1; }

    /* the top 53 bits are the mantissa, the 11 below decide rounding */
    rest = lo & 0x7ffUL;
    ml = (lo >> 11) | (hi << 21);
    mh = hi >> 11;                          /* bit 20 = the leading 1 */
    if (rest > 0x400UL || (rest == 0x400UL && (ml & 1))) {
        ml++;
        if (ml == 0)
            mh++;                           /* may reach 0x200000 */
    }
    /* Adding the mantissa, less its leading 1, to the exponent field
     * also handles a mantissa that rounded up to 2^53: the carry
     * raises the exponent by one and leaves a zero mantissa. */
    r.w.hi = sign + ((unsigned long)(1023 + 63 - n) << 20) + (mh - 0x100000UL);
    r.w.lo = ml;
    return r.d;
}

/* (double)(long long) */
double _sint64toflt64(long long x)
{
    const unsigned long *p = (const unsigned long *)&x;
    unsigned long hi = p[0], lo = p[1];

    if (hi & 0x80000000UL) {
        /* magnitude; the most negative value keeps its bits, which
         * read as unsigned are its magnitude 2^63 */
        lo = ~lo + 1;
        hi = ~hi + (lo == 0);
        return u64_to_dbl(hi, lo, 0x80000000UL);
    }
    return u64_to_dbl(hi, lo, 0);
}

/* (double)(unsigned long long) */
double _uint64toflt64(unsigned long long x)
{
    const unsigned long *p = (const unsigned long *)&x;

    return u64_to_dbl(p[0], p[1], 0);
}

#endif /* no FPU */
