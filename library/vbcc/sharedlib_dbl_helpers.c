/*
 * sharedlib_dbl_helpers.c — opaque double-arithmetic wrappers.
 *
 * VBCC at -O1 (and apparently lower opt levels too) collapses
 * `(double)int32 * literal_double` into "int32 multiply, then convert
 * to double" — observed in 0.191/0.192 where Date.now() returned
 * sec*1000 mod 2^32 ≈ 3.6e9 instead of sec*1000 = 1.78e12. Even with
 * `volatile double thousand = 1000.0;` and a separate `(double)cast`
 * statement, VBCC kept folding.
 *
 * The robust workaround is a cross-translation-unit function call.
 * VBCC has no link-time optimization, so a call into another .c file
 * must be emitted as a real bsr — which forces a true double*double
 * multiply via mathieeedoubbas (verified working: Math.E bit pattern
 * is exact on this build).
 *
 * These wrappers are intentionally tiny so the overhead of the call
 * is bounded; they only need to exist as a compiler firewall.
 */

double qjs_dbl_from_long(long x)
{
    return (double)x;
}

double qjs_dbl_mul(double a, double b)
{
    return a * b;
}

double qjs_dbl_add(double a, double b)
{
    return a + b;
}

#if defined(__M68881) || defined(__M68882)
/*
 * x rounded to single precision, for Math.fround on the FPU variants.
 *
 * "(float)x" alone does nothing there: vbcc keeps the value in an FPU
 * register, which holds 64 mantissa bits whatever the C type, so until
 * 0.231 Math.fround(7.9) returned 7.9 and Math.fround(1e300) returned
 * 1e300. Storing to memory as a single is what rounds (FMOVE.S to
 * memory rounds to the destination format: MC68881UM 2.2.2). The
 * volatile keeps the compiler from removing the store.
 */
double qjs_dbl_fround(double x)
{
    volatile float f;

    f = (float)x;
    return (double)f;
}
#endif
