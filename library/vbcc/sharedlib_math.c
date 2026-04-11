/*
 * sharedlib_math.c — Higher-level math functions for shared library.
 *
 * VBCC with -fpu=68881 inlines sin, cos, tan, atan, exp, log, sqrt,
 * fabs, floor, ceil as FPU instructions. These higher-level functions
 * build on those primitives.
 *
 * No .lib dependencies. No globals. Pure FPU math.
 */

#include <math.h>
#include <exec/types.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif
#ifndef M_LN2
#define M_LN2 0.69314718055994530942
#endif

/* On 020 FPU: VBCC inlines all transcendentals as 68881 instructions,
 * so we don't need the math library bases. No-op stubs.
 *
 * On 040/060 FPU: VBCC emits external calls (atan, sin, etc.) because
 * the FPU lacks those instructions. sharedlib_math_fpu_aux.c provides
 * the wrappers, which need MathIeeeDoubTransBase as a global. We
 * declare and set it here for ALL FPU builds (it's harmless on 020). */
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

double atan2(double y, double x)
{
    if (x > 0.0)
        return atan(y / x);
    if (x < 0.0)
        return (y >= 0.0) ? atan(y / x) + M_PI : atan(y / x) - M_PI;
    /* x == 0 */
    if (y > 0.0) return M_PI / 2.0;
    if (y < 0.0) return -M_PI / 2.0;
    return 0.0;
}

double pow(double b, double e)
{
    /* Special cases */
    if (e == 0.0) return 1.0;
    if (e == 1.0) return b;
    if (b == 0.0) return (e > 0.0) ? 0.0 : HUGE_VAL;
    if (b == 1.0) return 1.0;

    if (b > 0.0)
        return exp(e * log(b));

    /* Negative base: only valid for integer exponents */
    {
        double ai = floor(e);
        double result;
        if (ai != e)
            return NAN; /* non-integer power of negative = NaN */
        result = exp(e * log(fabs(b)));
        /* Negate if odd integer exponent */
        if (fmod(ai, 2.0) != 0.0)
            result = -result;
        return result;
    }
}

double frexp(double x, int *eptr)
{
    /* Extract mantissa [0.5, 1.0) and exponent: x = m * 2^e */
    union { double d; struct { unsigned long hi, lo; } w; } u;
    int e;

    if (x == 0.0) { *eptr = 0; return 0.0; }

    u.d = x;
    e = (int)((u.w.hi >> 20) & 0x7FF) - 1022;
    *eptr = e;
    /* Set biased exponent to 1022 -> value in [0.5, 1.0) */
    u.w.hi = (u.w.hi & 0x800FFFFFUL) | 0x3FE00000UL;
    return u.d;
}

double log1p(double x)
{
    /* log(1+x), accurate for small x */
    if (x > -0.5 && x < 0.5) {
        double u = 1.0 + x;
        if (u == 1.0) return x;
        return log(u) * (x / (u - 1.0));
    }
    return log(1.0 + x);
}

double acosh(double x)
{
    if (x < 1.0) return NAN;
    return log(x + sqrt(x * x - 1.0));
}

double asinh(double x)
{
    if (x >= 0.0)
        return log(x + sqrt(x * x + 1.0));
    return -log(-x + sqrt(x * x + 1.0));
}

double cbrt(double x)
{
    if (x == 0.0) return 0.0;
    if (x > 0.0) return exp(log(x) / 3.0);
    return -exp(log(-x) / 3.0);
}
