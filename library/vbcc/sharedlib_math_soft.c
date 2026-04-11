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

/* ---- LVO wrappers using VBCC inline assembly syntax ----
 *
 * Uses `function = "asm";` which embeds the jsr directly at the call
 * site, sidestepping the __reg("a6") frame pointer issue that can
 * affect function-pointer dispatch (the MATH_LVO macro pattern).
 * This matches the proven-good pattern in sharedlib_posix.c.
 *
 * __ieeefltud is provided by sharedlib_int64_soft.s (assembly) to
 * avoid recursive softfloat calls that VBCC would generate in C code.
 */

/* ---- mathieeedoubbas.library LVOs ---- */

/* IEEEDPAbs -54 */
static double __sl_Abs(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-54(a6)";
#define sl_Abs(x) __sl_Abs(MathIeeeDoubBasBase, (x))

/* IEEEDPNeg -60 */
static double __sl_Neg(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-60(a6)";
#define sl_Neg(x) __sl_Neg(MathIeeeDoubBasBase, (x))

/* IEEEDPFloor -90 */
static double __sl_Floor(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-90(a6)";
#define sl_Floor(x) __sl_Floor(MathIeeeDoubBasBase, (x))

/* IEEEDPCeil -96 */
static double __sl_Ceil(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-96(a6)";
#define sl_Ceil(x) __sl_Ceil(MathIeeeDoubBasBase, (x))

/* ---- mathieeedoubtrans.library LVOs ---- */

/* IEEEDPAtan -30 */
static double __sl_Atan(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-30(a6)";
#define sl_Atan(x) __sl_Atan(MathIeeeDoubTransBase, (x))

/* IEEEDPSin -36 */
static double __sl_Sin(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-36(a6)";
#define sl_Sin(x) __sl_Sin(MathIeeeDoubTransBase, (x))

/* IEEEDPCos -42 */
static double __sl_Cos(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-42(a6)";
#define sl_Cos(x) __sl_Cos(MathIeeeDoubTransBase, (x))

/* IEEEDPTan -48 */
static double __sl_Tan(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-48(a6)";
#define sl_Tan(x) __sl_Tan(MathIeeeDoubTransBase, (x))

/* IEEEDPSinh -60 */
static double __sl_Sinh(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-60(a6)";
#define sl_Sinh(x) __sl_Sinh(MathIeeeDoubTransBase, (x))

/* IEEEDPCosh -66 */
static double __sl_Cosh(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-66(a6)";
#define sl_Cosh(x) __sl_Cosh(MathIeeeDoubTransBase, (x))

/* IEEEDPTanh -72 */
static double __sl_Tanh(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-72(a6)";
#define sl_Tanh(x) __sl_Tanh(MathIeeeDoubTransBase, (x))

/* IEEEDPExp -78 */
static double __sl_Exp(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-78(a6)";
#define sl_Exp(x) __sl_Exp(MathIeeeDoubTransBase, (x))

/* IEEEDPLog -84 */
static double __sl_Log(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-84(a6)";
#define sl_Log(x) __sl_Log(MathIeeeDoubTransBase, (x))

/* IEEEDPPow -90: IEEEDPPow(exp,arg)(d2/d3,d0/d1) computes arg^exp */
static double __sl_Pow(__reg("a6") struct Library *base,
    __reg("d2/d3") double exponent,
    __reg("d0/d1") double arg) = "\tjsr\t-90(a6)";
#define sl_Pow(base_val, exp_val) __sl_Pow(MathIeeeDoubTransBase, (exp_val), (base_val))

/* IEEEDPSqrt -96 */
static double __sl_Sqrt(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-96(a6)";
#define sl_Sqrt(x) __sl_Sqrt(MathIeeeDoubTransBase, (x))

/* IEEEDPAsin -114 */
static double __sl_Asin(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-114(a6)";
#define sl_Asin(x) __sl_Asin(MathIeeeDoubTransBase, (x))

/* IEEEDPAcos -120 */
static double __sl_Acos(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-120(a6)";
#define sl_Acos(x) __sl_Acos(MathIeeeDoubTransBase, (x))

/* IEEEDPLog10 -126 */
static double __sl_Log10(__reg("a6") struct Library *base,
    __reg("d0/d1") double x) = "\tjsr\t-126(a6)";
#define sl_Log10(x) __sl_Log10(MathIeeeDoubTransBase, (x))

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
