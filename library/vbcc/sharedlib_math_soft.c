/*
 * sharedlib_math_soft.c - the maths base pointers and the primitive
 * maths functions of the soft-float variants.
 *
 * WHERE THE ARITHMETIC COMES FROM
 *
 * vbcc -amiga-softfloat compiles a + b, a * b, (int)a, (float)a and so
 * on into "jsr -N(a6)" through MathIeeeDoubBasBase and
 * MathIeeeDoubTransBase, which the program must define. They used to
 * hold the operating system's libraries. From 0.232 they point at the
 * library's own IEEE 754 routines in sharedlib_softfp.s, because
 * mathieeedoubbas.library without an FPU has no infinity, no
 * denormals, does not round correctly and gets floor(-0) wrong (the
 * list is at the top of sharedlib_softfp.s).
 *
 * THE FUNCTIONS
 *
 * The soft-float variants no longer call the operating system's maths
 * libraries at all (0.232):
 *   exp, log, log10, sin, cos, tan, atan, asin, acos, sinh, cosh,
 *   tanh, sqrt                              sharedlib_math_prim.c
 *   pow                                     sharedlib_math_pow.c
 *   atan2, hypot, log1p, cbrt, asinh, acosh sharedlib_math.c
 *   expm1, exp2, log2, atanh, modf          sharedlib_math_fpu_aux.c
 *   floor, ceil, trunc, round, nearbyint, lround, fmod, ldexp, frexp
 *                                           sharedlib_math_round.c
 * The last four files are the FPU variants' sources. Here are only the
 * classification functions and fabs, copysign, scalbn.
 *
 * mathieeedoubbas.library and mathieeedoubtrans.library are still
 * opened by the library's init code and handed to
 * sharedlib_math_soft_init(), which ignores them.
 *
 * No .lib dependencies.
 */

#include <exec/types.h>
#include <exec/execbase.h>
#include "sharedlib_dblbits.h"

/* The fake library bases of sharedlib_softfp.s. Only their addresses
 * are used: the code sits below them like a library's jump table. */
extern long qjs_softfp_bas;
extern long qjs_softfp_trans;

/* Referenced by name from the compiler's inline soft-float code.
 * MathIeeeSingBasBase: the compiler negates a float through it in two
 * places; nothing else of single precision is left in the library. */
struct Library *MathIeeeDoubBasBase;
struct Library *MathIeeeDoubTransBase;
struct Library *MathIeeeSingBasBase;

void sharedlib_math_soft_init(struct Library *basBase,
                               struct Library *transBase)
{
    struct ExecBase *sys = *(struct ExecBase **)4;

    (void)basBase;      /* the system's libraries: not used any more */
    (void)transBase;
    MathIeeeDoubBasBase = (struct Library *)&qjs_softfp_bas;
    MathIeeeDoubTransBase = (struct Library *)&qjs_softfp_trans;
    /* mathieeesingbas.library is in ROM from Kickstart 2.0. */
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
    /* MathIeeeDoubBasBase and MathIeeeDoubTransBase stay: they point
     * into this library's own code, and code running during expunge
     * may still do arithmetic. */
}

/* ---- classification, from the bits ---- */

#define HI(x)   (((const QJSDblBits *)&(x))->w.hi)
#define LO(x)   (((const QJSDblBits *)&(x))->w.lo)
#define AHI(x)  (HI(x) & ~QJS_DBL_SIGN)         /* high word of |x| */


int isnan(double x)
{
    return AHI(x) > 0x7ff00000U || (AHI(x) == 0x7ff00000U && LO(x) != 0);
}
int isinf(double x)
{
    return AHI(x) == 0x7ff00000U && LO(x) == 0;
}
int isfinite(double x)
{
    return AHI(x) < 0x7ff00000U;
}
int signbit(double x)
{
    return (int)(HI(x) >> 31);
}

double fabs(double x)
{
    QJSDblBits u;
    u.d = x;
    u.w.hi &= ~QJS_DBL_SIGN;
    return u.d;
}

double copysign(double x, double y)
{
    QJSDblBits u;
    u.d = x;
    u.w.hi = (u.w.hi & ~QJS_DBL_SIGN) | (HI(y) & QJS_DBL_SIGN);
    return u.d;
}

double ldexp(double x, int n);      /* sharedlib_math_round.c */

double scalbn(double x, int n)
{
    return ldexp(x, n);
}
