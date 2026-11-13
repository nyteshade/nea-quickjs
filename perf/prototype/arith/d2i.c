/* integer-only double -> int32 truncation and int32-ness test from the two 32-bit halves (big-endian: hi first).
   No FPU instruction, no library call, no 64-bit helper. Valid for |d| < 2^31 (caller checks exponent, as JS_ToInt32Free does). */
typedef unsigned long u32;
long d2i_bits(const u32 *p)
{
    u32 hi = p[0], lo = p[1], m;
    long e = (long)((hi >> 20) & 0x7ff) - 1023;
    long r;
    if (e < 0) return 0;
    m = (hi & 0xfffffUL) | 0x100000UL;
    if (e <= 20) r = (long)(m >> (20 - e));
    else r = (long)((m << (e - 20)) | (lo >> (52 - e)));
    return (long)hi < 0 ? -r : r;
}
/* double_is_int32 without 64-bit shifts: returns 1 and *out if d is an int32 (and not -0) */
int dbl_is_i32(const u32 *p, long *out)
{
    u32 hi = p[0], lo = p[1], m;
    long e = (long)((hi >> 20) & 0x7ff) - 1023;
    if (e < 0) { if ((hi | lo) == 0) { *out = 0; return 1; } return 0; }
    if (e > 30) { if (hi == 0xc1e00000UL && lo == 0) { *out = (long)0x80000000UL; return 1; } return 0; }
    m = (hi & 0xfffffUL) | 0x100000UL;
    if (e <= 20) {
        if (lo != 0 || (m << (12 + e)) != 0) return 0;      /* fraction bits below the binary point */
        m >>= (20 - e);
    } else {
        if ((lo << (e - 20)) != 0) return 0;
        m = (m << (e - 20)) | (lo >> (52 - e));
    }
    *out = (long)hi < 0 ? -(long)m : (long)m;
    return 1;
}
