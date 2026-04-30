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
