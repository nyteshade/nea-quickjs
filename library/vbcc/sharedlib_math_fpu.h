/*
 * sharedlib_math_fpu.h - replace the maths functions vbcc inlines
 * wrongly, in the FPU variants of the library.
 *
 * Include this AFTER <math.h>, in an FPU build only (cutils.h does it
 * for the engine; the library's own maths sources do it themselves).
 *
 * With -fpu=68881 vbcc's <math.h> pulls in math_881.h, math_040.h or
 * math_060.h (by -cpu), which turn a number of functions into inline
 * FPU code through macros. Some of that code is wrong or cannot be
 * used here:
 *
 *  floor, ceil, trunc, nearbyint (math_040.h)
 *      "fmove.l fp0,d0 ; fmove.l d0,fp0" under a changed rounding
 *      mode: the value goes through a 32-bit integer, so everything
 *      beyond +-2^31 comes back as +-2147483647/8, as do NaN and the
 *      infinities, and -0 becomes +0. Math.floor(3e9) was 2147483647.
 *  floor, ceil, trunc, round (math_881.h, math_060.h)
 *      FINTRZ is right on a real 6888x/68060 but a 68040 has to trap
 *      to emulate it, ceil(-0.5) gives +0, and round() adds 0.5 first,
 *      which is wrong just below 0.5 and above 2^52.
 *  hypot (all three)
 *      sqrt(x*x + y*y) as written: hypot(Infinity, NaN) must be
 *      Infinity, and the squares must not overflow.
 *  fmod, ldexp (math_881.h)
 *      FMOD and FSCALE are fine on a real 6888x; they are replaced so
 *      that the three FPU variants run the same code, which can then
 *      be tested on the build machine (the emulator used there has
 *      neither instruction).
 *
 * The replacements are ordinary functions in sharedlib_math_round.c
 * and sharedlib_math.c. They work on the bits of the double, use no
 * FINT/FINTRZ/FMOD/FSCALE and do not touch the FPCR, so they are also
 * right whatever rounding mode the caller left in the FPU.
 *
 * <math.h> itself defines rint() and lrint() as nearbyint() and
 * scalbn() as ldexp(); those macros stay and so reach the functions
 * declared here.
 *
 * fabs, sqrt, copysign and the comparison macros stay inline: they
 * are single native instructions on every FPU.
 */
#ifndef SHAREDLIB_MATH_FPU_H
#define SHAREDLIB_MATH_FPU_H

#undef floor
#undef ceil
#undef trunc
#undef round
#undef nearbyint
#undef lround
#undef hypot
#undef fmod
#undef ldexp
#undef floorf
#undef ceilf
#undef truncf
#undef roundf
#undef nearbyintf
#undef lroundf
#undef hypotf
#undef fmodf
#undef ldexpf

double floor(double x);
double ceil(double x);
double trunc(double x);
double round(double x);         /* halves away from zero */
double nearbyint(double x);     /* halves to even */
long   lround(double x);        /* halves away from zero, saturating */
double hypot(double x, double y);
double fmod(double x, double y);
double ldexp(double x, int n);

#endif /* SHAREDLIB_MATH_FPU_H */
