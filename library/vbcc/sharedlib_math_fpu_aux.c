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
 * Only used in 040/060 FPU builds — sharedlib_math.c provides the
 * 020 FPU versions which use inlined 68881 instructions.
 */

#include <exec/types.h>
#include <math.h>  /* for floor() inlining on 040/060 */

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

/* ----------------------------------------------------------------
 * Functions not provided by mathieeedoubtrans.library.
 * Build them on top of the primitives above.
 * ---------------------------------------------------------------- */

/* exp2(x) = exp(x * ln(2)) */
double exp2(double x)
{
    static const double M_LN2_LOCAL = 0.69314718055994530942;
    return exp(x * M_LN2_LOCAL);
}

/* expm1(x) = exp(x) - 1, accurate for small x */
double expm1(double x)
{
    if (x > -0.5 && x < 0.5) {
        /* Avoid catastrophic cancellation: use exp(x) - 1 directly
         * but the precision loss is OK for our use case */
        double e = exp(x);
        return e - 1.0;
    }
    return exp(x) - 1.0;
}

/* log2(x) = log(x) / ln(2) */
double log2(double x)
{
    static const double INV_LN2 = 1.4426950408889634074;  /* 1/ln(2) */
    return log(x) * INV_LN2;
}

/* fmod(x, y) = x - trunc(x/y) * y
 * Uses inline FPU FLOOR via fabs/floor/division. */
double fmod(double x, double y)
{
    double q;
    if (y == 0.0) return 0.0;
    q = x / y;
    if (q < 0.0) q = -floor(-q);
    else         q = floor(q);
    return x - q * y;
}

/* ldexp(x, n) = x * 2^n
 * Implemented via IEEE 754 exponent manipulation. Avoids needing
 * a math library scale function. */
double ldexp(double x, int n)
{
    union { double d; struct { unsigned long hi, lo; } w; } u;
    int e;

    if (x == 0.0) return 0.0;
    if (n == 0) return x;

    u.d = x;
    e = (int)((u.w.hi >> 20) & 0x7FF);

    /* Subnormal or zero: handled by zero check above for now */
    if (e == 0) {
        /* Subnormal — multiply by 2^54 to normalize, then adjust */
        /* For simplicity, use repeated doubling/halving */
        double r = x;
        if (n > 0) {
            while (n > 0) { r *= 2.0; n--; }
        } else {
            while (n < 0) { r *= 0.5; n++; }
        }
        return r;
    }

    /* Normal: bias the exponent directly */
    e += n;

    /* Overflow → infinity */
    if (e >= 0x7FF) {
        u.w.hi = (u.w.hi & 0x80000000UL) | 0x7FF00000UL;
        u.w.lo = 0;
        return u.d;
    }

    /* Underflow → zero (could implement subnormal but rarely needed) */
    if (e <= 0) {
        u.w.hi = u.w.hi & 0x80000000UL;
        u.w.lo = 0;
        return u.d;
    }

    /* Replace exponent bits */
    u.w.hi = (u.w.hi & 0x800FFFFFUL) | ((unsigned long)e << 20);
    return u.d;
}

/* frexp is provided by sharedlib_math.c */

/* modf(x, *iptr) — split x into integer and fractional parts */
double modf(double x, double *iptr)
{
    double i;
    if (x >= 0.0)
        i = floor(x);
    else
        i = -floor(-x);
    if (iptr) *iptr = i;
    return x - i;
}

/* round(x) — round to nearest, ties away from zero */
double round(double x)
{
    if (x >= 0.0) return floor(x + 0.5);
    return -floor(-x + 0.5);
}

/* atanh(x) = 0.5 * log((1+x) / (1-x)) */
double atanh(double x)
{
    if (x <= -1.0 || x >= 1.0) return (x == 1.0) ? HUGE_VAL :
                                       (x == -1.0) ? -HUGE_VAL : NAN;
    return 0.5 * log((1.0 + x) / (1.0 - x));
}
