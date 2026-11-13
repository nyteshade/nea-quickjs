/*
 * dcmp.h - comparing two doubles so that NaN compares the way IEEE 754
 * and JavaScript require: every relation with a NaN operand is false,
 * except "not equal", which is true.
 *
 * Why this exists. On the soft-float builds of the Amiga library (vbcc
 * without -fpu) the compiler turns "a < b" on doubles into a call that
 * returns -1, 0 or +1 and then branches on that number. Three values
 * cannot express a fourth outcome, "unordered", so whatever the callee
 * answers for a NaN, at least one of <, >, <=, >=, == comes out true.
 * Until 0.231 that made 0 < NaN, NaN > 0, NaN == NaN and NaN === NaN
 * true in JavaScript, [NaN].indexOf(NaN) found it, switch (NaN) matched
 * case NaN, and "do { } while (n < NaN)" never ended.
 *
 * The rule in the engine is therefore: a comparison of doubles is
 * written with one of the six macros below, never with the bare
 * operator. On the soft-float builds they call qjs_dcmp(), which works
 * on the bit patterns and knows about NaN. On every other build (the
 * FPU variants, the host tools) they are the plain operator, so nothing
 * changes there and nothing gets slower.
 *
 * To check that no bare comparison has crept back in, compile the file
 * to assembly with the soft flags and look for the compiler's own
 * compare calls, "jsr -42(a6)" (compare) and "jsr -48(a6)" (test
 * against zero) after loading MathIeeeDoubBasBase: there must be none.
 * scripts/check_dcmp.sh does that for every C file of the library.
 */
#ifndef DCMP_H
#define DCMP_H

#if defined(__VBCC__) && !defined(__M68881) && !defined(__M68882)

/* Three-way comparison with a fourth answer.
 * Returns -1 if a < b, 0 if a == b (+0 and -0 are equal), 1 if a > b,
 * and 2 if either is a NaN. Defined in library/vbcc/sharedlib_softfp.s. */
int qjs_dcmp(double a, double b);

#define D_LT(a, b) (qjs_dcmp((a), (b)) < 0)
#define D_LE(a, b) (qjs_dcmp((a), (b)) <= 0)
#define D_GT(a, b) (qjs_dcmp((a), (b)) == 1)
#define D_GE(a, b) ((unsigned int)qjs_dcmp((a), (b)) <= 1U)
#define D_EQ(a, b) (qjs_dcmp((a), (b)) == 0)
#define D_NE(a, b) (qjs_dcmp((a), (b)) != 0)

#else

#define D_LT(a, b) ((a) < (b))
#define D_LE(a, b) ((a) <= (b))
#define D_GT(a, b) ((a) > (b))
#define D_GE(a, b) ((a) >= (b))
#define D_EQ(a, b) ((a) == (b))
#define D_NE(a, b) ((a) != (b))

#endif

#endif /* DCMP_H */
