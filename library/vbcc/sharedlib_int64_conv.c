/*
 * sharedlib_int64_conv.c — 64-bit integer <-> double conversions
 * for soft-float builds (no FPU).
 *
 * The FPU build uses inline FPU instructions in sharedlib_int64.s.
 * This file provides the same functions using software float.
 *
 * VBCC calling convention for these: args on stack, result in d0:d1.
 * We declare them as normal C functions returning long long / double
 * and VBCC handles the register allocation.
 */

/* These must match the linker symbol names VBCC generates.
 * VBCC prefixes with _ in C, but assembly xdef uses __ prefix.
 * The C function _flt64tosint64 becomes linker symbol __flt64tosint64. */

long long _flt64tosint64(double x)
{
    /* Truncate double to signed 64-bit integer */
    /* For values in 32-bit range, cast directly */
    if (x >= -2147483648.0 && x < 2147483648.0) {
        return (long)(int)x;
    }
    /* For larger values, decompose manually */
    {
        int neg = 0;
        unsigned long hi, lo;
        double rem;
        if (x < 0) { neg = 1; x = -x; }
        hi = (unsigned long)(x / 4294967296.0);
        rem = x - (double)hi * 4294967296.0;
        lo = (unsigned long)rem;
        if (neg) {
            lo = ~lo;
            hi = ~hi;
            lo++;
            if (lo == 0) hi++;
        }
        return ((long long)hi << 32) | lo;
    }
}

unsigned long long _flt64touint64(double x)
{
    if (x < 0.0) return 0;
    if (x < 4294967296.0) {
        return (unsigned long)x;
    }
    {
        unsigned long hi = (unsigned long)(x / 4294967296.0);
        double rem = x - (double)hi * 4294967296.0;
        unsigned long lo = (unsigned long)rem;
        return ((unsigned long long)hi << 32) | lo;
    }
}

double _sint64toflt64(long long x)
{
    int neg = 0;
    unsigned long hi, lo;
    double result;

    if (x == 0) return 0.0;
    if (x < 0) { neg = 1; x = -x; }

    hi = (unsigned long)(x >> 32);
    lo = (unsigned long)x;

    result = (double)hi * 4294967296.0 + (double)lo;
    return neg ? -result : result;
}

double _uint64toflt64(unsigned long long x)
{
    unsigned long hi = (unsigned long)(x >> 32);
    unsigned long lo = (unsigned long)x;
    return (double)hi * 4294967296.0 + (double)lo;
}
