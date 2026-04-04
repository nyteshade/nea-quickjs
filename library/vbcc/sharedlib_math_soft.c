/*
 * sharedlib_math_soft.c — Software float math for no-FPU builds.
 *
 * Replaces sharedlib_math.c (which uses inline 68881 FPU instructions).
 * All transcendental functions call mathieeedoubtrans.library LVOs.
 * Floor/ceil/abs call mathieeedoubbas.library LVOs.
 *
 * The VBCC compiler with -amiga-softfloat already inlines LVO calls
 * for basic operations (add, sub, mul, div, cmp, fix, flt) via
 * MathIeeeDoubBasBase. This file provides the higher-level functions
 * and the required global base pointers.
 *
 * No .lib dependencies. All math via direct LVO calls.
 */

#include <exec/types.h>
#include <exec/execbase.h>

/* Avoid pulling in math.h macros that redefine scalbn→ldexp etc.
 * We define all functions ourselves. */
#define HUGE_VAL (__builtin_huge_val())

/* We can't use __builtin_huge_val with VBCC — use IEEE bit pattern */
static double sl_huge_val(void)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    u.w.hi = 0x7FF00000UL;
    u.w.lo = 0;
    return u.d;
}

static double sl_nan_val(void)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    u.w.hi = 0x7FF80000UL;
    u.w.lo = 0;
    return u.d;
}

#undef HUGE_VAL
#define HUGE_VAL sl_huge_val()
#define MY_NAN sl_nan_val()

#define M_PI   3.14159265358979323846
#define M_LN2  0.69314718055994530942
#define M_LN10 2.30258509299404568402

/* ---- Math library base pointers ----
 * MathIeeeDoubBasBase is referenced by VBCC's -amiga-softfloat inline
 * code for basic float operations. Must be a global with this exact name. */

/* These globals are referenced by VBCC's -amiga-softfloat codegen.
 * MathIeeeDoubBasBase: basic double ops (add, sub, mul, div, cmp)
 * MathIeeeDoubTransBase: some double conversions in dtoa/regex code
 * MathIeeeSingBasBase: float→double promotions */
struct Library *MathIeeeDoubBasBase;
struct Library *MathIeeeDoubTransBase;
struct Library *MathIeeeSingBasBase;

void sharedlib_math_soft_init(struct Library *basBase,
                               struct Library *transBase)
{
    struct ExecBase *sys = *(struct ExecBase **)4;
    MathIeeeDoubBasBase = basBase;
    MathIeeeDoubTransBase = transBase;
    /* mathieeesingbas.library needed for float→double promotions.
     * Available on all Amigas with Kickstart 1.2+. */
    MathIeeeSingBasBase = ((struct Library *(*)(
        __reg("a6") struct ExecBase *,
        __reg("a1") const char *,
        __reg("d0") ULONG))((char *)sys - 552))
        (sys, "mathieeesingbas.library", 34);
}

void sharedlib_math_soft_cleanup(void)
{
    if (MathIeeeSingBasBase) {
        struct ExecBase *sys = *(struct ExecBase **)4;
        ((void (*)(__reg("a6") struct ExecBase *,
                   __reg("a1") struct Library *))
         ((char *)sys - 414))(sys, MathIeeeSingBasBase);
        MathIeeeSingBasBase = (void *)0;
    }
    MathIeeeDoubBasBase = (void *)0;
    MathIeeeDoubTransBase = (void *)0;
}

/* ---- LVO call macro ---- */
#define MATH_LVO(base, offset, type) ((type)((char *)(base) - (offset)))

/* __ieeefltud is provided by sharedlib_int64_soft.s (assembly) to avoid
 * recursive softfloat calls that VBCC would generate in C code. */

/* ---- mathieeedoubbas.library LVOs ---- */

static double sl_Floor(double x)
{
    return MATH_LVO(MathIeeeDoubBasBase, 90,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubBasBase, x);
}

static double sl_Ceil(double x)
{
    return MATH_LVO(MathIeeeDoubBasBase, 96,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubBasBase, x);
}

static double sl_Abs(double x)
{
    return MATH_LVO(MathIeeeDoubBasBase, 54,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubBasBase, x);
}

static double sl_Neg(double x)
{
    return MATH_LVO(MathIeeeDoubBasBase, 60,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubBasBase, x);
}

/* ---- mathieeedoubtrans.library LVOs ---- */

static double sl_Sin(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 36,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Cos(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 42,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Tan(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 48,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Atan(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 30,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Asin(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 114,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Acos(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 120,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Sinh(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 60,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Cosh(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 66,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Tanh(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 72,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Exp(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 78,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Log(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 84,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Log10(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 126,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

static double sl_Sqrt(double x)
{
    return MATH_LVO(MathIeeeDoubTransBase, 96,
        double (*)(__reg("a6") struct Library *,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, x);
}

/* IEEEDPPow: d2/d3=base, d0/d1=exponent */
static double sl_Pow(double base, double exponent)
{
    return MATH_LVO(MathIeeeDoubTransBase, 90,
        double (*)(__reg("a6") struct Library *,
                   __reg("d2/d3") double,
                   __reg("d0/d1") double))(MathIeeeDoubTransBase, base, exponent);
}

/* Forward declarations for functions used before definition */
double fmod(double x, double y);

/* ---- Public math functions ---- */

double sin(double x)   { return sl_Sin(x); }
double cos(double x)   { return sl_Cos(x); }
double tan(double x)   { return sl_Tan(x); }
double atan(double x)  { return sl_Atan(x); }
double asin(double x)  { return sl_Asin(x); }
double acos(double x)  { return sl_Acos(x); }
double sinh(double x)  { return sl_Sinh(x); }
double cosh(double x)  { return sl_Cosh(x); }
double tanh(double x)  { return sl_Tanh(x); }
double exp(double x)   { return sl_Exp(x); }
double log(double x)   { return sl_Log(x); }
double log10(double x) { return sl_Log10(x); }
double sqrt(double x)  { return sl_Sqrt(x); }
double floor(double x) { return sl_Floor(x); }
double ceil(double x)  { return sl_Ceil(x); }
double fabs(double x)  { return sl_Abs(x); }

double pow(double base, double exponent)
{
    if (exponent == 0.0) return 1.0;
    if (exponent == 1.0) return base;
    if (base == 0.0) return (exponent > 0.0) ? 0.0 : HUGE_VAL;
    if (base == 1.0) return 1.0;
    if (base > 0.0)
        return sl_Pow(base, exponent);
    /* Negative base: only valid for integer exponents */
    {
        double ai = sl_Floor(exponent);
        double result;
        if (ai != exponent) return MY_NAN;
        result = sl_Pow(sl_Abs(base), exponent);
        if (fmod(ai, 2.0) != 0.0)
            result = sl_Neg(result);
        return result;
    }
}

double atan2(double y, double x)
{
    if (x > 0.0)
        return sl_Atan(y / x);
    if (x < 0.0)
        return (y >= 0.0) ? sl_Atan(y / x) + M_PI
                          : sl_Atan(y / x) - M_PI;
    if (y > 0.0) return M_PI / 2.0;
    if (y < 0.0) return -M_PI / 2.0;
    return 0.0;
}

double log2(double x)  { return sl_Log(x) / M_LN2; }

double log1p(double x)
{
    if (x > -0.5 && x < 0.5) {
        double u = 1.0 + x;
        if (u == 1.0) return x;
        return sl_Log(u) * (x / (u - 1.0));
    }
    return sl_Log(1.0 + x);
}

double expm1(double x)
{
    if (x > -0.5 && x < 0.5) {
        double x2 = x * x;
        return x + x2 * 0.5 + x2 * x / 6.0 + x2 * x2 / 24.0;
    }
    return sl_Exp(x) - 1.0;
}

double acosh(double x)
{
    if (x < 1.0) return MY_NAN;
    return sl_Log(x + sl_Sqrt(x * x - 1.0));
}

double asinh(double x)
{
    if (x >= 0.0)
        return sl_Log(x + sl_Sqrt(x * x + 1.0));
    return -sl_Log(-x + sl_Sqrt(x * x + 1.0));
}

double cbrt(double x)
{
    if (x == 0.0) return 0.0;
    if (x > 0.0) return sl_Exp(sl_Log(x) / 3.0);
    return -sl_Exp(sl_Log(-x) / 3.0);
}

double hypot(double x, double y)
{
    return sl_Sqrt(x * x + y * y);
}

double fmod(double x, double y)
{
    double q;
    if (y == 0.0) return MY_NAN;
    q = sl_Floor(x / y);
    return x - q * y;
}

double modf(double x, double *iptr)
{
    double i = (x >= 0.0) ? sl_Floor(x) : sl_Ceil(x);
    if (iptr) *iptr = i;
    return x - i;
}

double trunc(double x)
{
    return (x >= 0.0) ? sl_Floor(x) : sl_Ceil(x);
}

double round(double x)
{
    return sl_Floor(x + 0.5);
}

double frexp(double x, int *eptr)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    int e;
    if (x == 0.0) { *eptr = 0; return 0.0; }
    u.d = x;
    e = (int)((u.w.hi >> 20) & 0x7FF) - 1022;
    *eptr = e;
    u.w.hi = (u.w.hi & 0x800FFFFFUL) | 0x3FE00000UL;
    return u.d;
}

double ldexp(double x, int n)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    int e;
    if (x == 0.0 || n == 0) return x;
    u.d = x;
    e = (int)((u.w.hi >> 20) & 0x7FF) + n;
    if (e <= 0) return 0.0;
    if (e >= 0x7FF) return x > 0 ? HUGE_VAL : sl_Neg(HUGE_VAL);
    u.w.hi = (u.w.hi & 0x800FFFFFUL) | ((unsigned long)e << 20);
    return u.d;
}

double scalbn(double x, int n)
{
    return ldexp(x, n);
}

double copysign(double x, double y)
{
    union { double d; struct { unsigned long hi, lo; } w; } ux, uy;
    ux.d = x;
    uy.d = y;
    ux.w.hi = (ux.w.hi & 0x7FFFFFFFUL) | (uy.w.hi & 0x80000000UL);
    return ux.d;
}

int isnan(double x)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    u.d = x;
    return ((u.w.hi & 0x7FF00000UL) == 0x7FF00000UL) &&
           ((u.w.hi & 0x000FFFFFUL) || u.w.lo);
}

int isinf(double x)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    u.d = x;
    return ((u.w.hi & 0x7FFFFFFFUL) == 0x7FF00000UL) && (u.w.lo == 0);
}

int isfinite(double x)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    u.d = x;
    return (u.w.hi & 0x7FF00000UL) != 0x7FF00000UL;
}

int signbit(double x)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    u.d = x;
    return (u.w.hi >> 31) & 1;
}

double nearbyint(double x)
{
    return sl_Floor(x + 0.5);
}

double atanh(double x)
{
    /* atanh(x) = 0.5 * ln((1+x)/(1-x)) */
    if (x <= -1.0 || x >= 1.0) return MY_NAN;
    return 0.5 * sl_Log((1.0 + x) / (1.0 - x));
}
