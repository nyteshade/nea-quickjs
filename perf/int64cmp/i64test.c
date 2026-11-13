/*
 * i64test.c - exercise every 64-bit helper vbcc calls for "long long".
 *
 * vbcc has no inline 64-bit arithmetic on the 68k: multiply, divide,
 * modulo, shifts and the conversions to and from double are calls to
 * helpers (__mulint64_020, __divuint64_020, __lshint64,
 * __sint64toflt64, ...). A normal program gets them from vc.lib; the
 * shared library cannot link vc.lib and carries its own in
 * library/vbcc/sharedlib_int64.s (FPU variants) and
 * sharedlib_int64_soft.s + sharedlib_int64_conv.c (soft-float).
 *
 * This program runs each helper over a table of operands and prints
 * one line per operation, everything in hexadecimal so that printing
 * needs no 64-bit helper itself. run.sh links it twice, once with
 * vc.lib's helpers and once with ours, runs both under vamos, and
 * check.py compares both outputs with values computed on the host.
 *
 * Operands reach the operations through volatile function pointers so
 * the compiler cannot fold anything at build time.
 */
#include <stdio.h>

typedef long long s64;
typedef unsigned long long u64;
typedef union { double d; struct { unsigned long hi, lo; } w; } dbits;

static u64 f_mul(u64 a, u64 b)  { return a * b; }
static u64 f_divu(u64 a, u64 b) { return a / b; }
static u64 f_modu(u64 a, u64 b) { return a % b; }
static u64 f_divs(u64 a, u64 b) { return (u64)((s64)a / (s64)b); }
static u64 f_mods(u64 a, u64 b) { return (u64)((s64)a % (s64)b); }
static u64 f_shl(u64 a, int n)  { return a << n; }
static u64 f_shru(u64 a, int n) { return a >> n; }
static u64 f_shrs(u64 a, int n) { return (u64)((s64)a >> n); }
static double f_s2d(u64 a)      { return (double)(s64)a; }
static double f_u2d(u64 a)      { return (double)a; }
static u64 f_d2s(double d)      { return (u64)(s64)d; }
static u64 f_d2u(double d)      { return (u64)d; }

static u64 (* volatile p_mul)(u64, u64)  = f_mul;
static u64 (* volatile p_divu)(u64, u64) = f_divu;
static u64 (* volatile p_modu)(u64, u64) = f_modu;
static u64 (* volatile p_divs)(u64, u64) = f_divs;
static u64 (* volatile p_mods)(u64, u64) = f_mods;
static u64 (* volatile p_shl)(u64, int)  = f_shl;
static u64 (* volatile p_shru)(u64, int) = f_shru;
static u64 (* volatile p_shrs)(u64, int) = f_shrs;
static double (* volatile p_s2d)(u64)    = f_s2d;
static double (* volatile p_u2d)(u64)    = f_u2d;
static u64 (* volatile p_d2s)(double)    = f_d2s;
static u64 (* volatile p_d2u)(double)    = f_d2u;

/* The two halves are taken through a union, not with a shift: the
 * shifts are helpers under test and must not be able to hide their own
 * mistakes in the printout. */
typedef union { u64 v; struct { unsigned long hi, lo; } w; } ubits;
static unsigned long HI(u64 x) { ubits u; u.v = x; return u.w.hi; }
static unsigned long LO(u64 x) { ubits u; u.v = x; return u.w.lo; }
static u64 MK(unsigned long hi, unsigned long lo)
{
    ubits u;
    u.w.hi = hi; u.w.lo = lo;
    return u.v;
}

static const unsigned long edge[][2] = {
    {0,0}, {0,1}, {0,2}, {0,3}, {0,7}, {0,10}, {0,0xffff}, {0,0x10000},
    {0,0x10001}, {0,86400000UL}, {0,0x7fffffffUL}, {0,0x80000000UL},
    {0,0x80000001UL}, {0,0xfffffffeUL}, {0,0xffffffffUL},
    {1,0}, {1,1}, {1,0xffffffffUL}, {2,0}, {2,0x540be400UL} /* 1e10 */,
    {0xffff,0xffffffffUL}, {0x10000,0}, {0x0000ffffUL,0x0000ffffUL},
    {0x001fffffUL,0xffffffffUL} /* 2^53-1 */, {0x00200000UL,0} /* 2^53 */,
    {0x00200000UL,1}, {0x00200000UL,2}, {0x00200000UL,3},
    {0x0de0b6b3UL,0xa7640000UL} /* 1e18 */,
    {0x3fffffffUL,0xffffffffUL}, {0x40000000UL,0},
    {0x7fffffffUL,0}, {0x7fffffffUL,0xfffffc00UL}, {0x7fffffffUL,0xfffffe00UL},
    {0x7fffffffUL,0xffffffffUL},
    {0x80000000UL,0}, {0x80000000UL,1}, {0x80000000UL,0x00000400UL},
    {0x80000000UL,0x00000401UL}, {0x80000000UL,0x00000c00UL},
    {0xfffffffeUL,0}, {0xfffffffeUL,0xffffffffUL},
    {0xffffffffUL,0}, {0xffffffffUL,1}, {0xffffffffUL,0x7fffffffUL},
    {0xffffffffUL,0x80000000UL}, {0xffffffffUL,0xfffffff6UL},
    {0xffffffffUL,0xfffff800UL}, {0xffffffffUL,0xfffffbffUL},
    {0xffffffffUL,0xfffffc00UL},
    {0xffffffffUL,0xfffffffeUL}, {0xffffffffUL,0xffffffffUL},
    {0xfffffffdUL,0xabf41c00UL} /* -1e10 */,
    {0xffe00000UL,0} /* -2^53 */, {0xffdfffffUL,0xffffffffUL}
};
#define NEDGE (sizeof(edge) / sizeof(edge[0]))

/* doubles for the double -> integer direction, as bit patterns.
 * Third field: 1 = in range for signed, 2 = in range for unsigned,
 * 3 = both. Out-of-range conversions are undefined in C; they are
 * printed with a '!' so check.py does not judge them. */
static const unsigned long dtab[][3] = {
    {0x00000000UL,0,3}, {0x80000000UL,0,3},                 /* 0, -0 */
    {0x3fe00000UL,0,3}, {0xbfe00000UL,0,3},                 /* +-0.5 */
    {0x3fefffffUL,0xffffffffUL,3}, {0xbfefffffUL,0xffffffffUL,3},
    {0x3ff00000UL,0,3}, {0xbff00000UL,0,1},                 /* +-1 */
    {0x3ff80000UL,0,3}, {0xbff80000UL,0,1},                 /* +-1.5 */
    {0x40040000UL,0,3}, {0xc0040000UL,0,1},                 /* +-2.5 */
    {0x41dfffffUL,0xffc00000UL,3},                          /* 2^31-1 */
    {0x41dfffffUL,0xffe00000UL,3},                          /* 2^31-0.5 */
    {0x41e00000UL,0,3},                                     /* 2^31 */
    {0x41e00000UL,0x00100000UL,3},                          /* 2^31+0.5 */
    {0xc1e00000UL,0,1},                                     /* -2^31 */
    {0xc1e00000UL,0x00100000UL,1},                          /* -2^31-0.5 */
    {0xc1e00000UL,0x00200000UL,1},                          /* -2^31-1 */
    {0x41efffffUL,0xffe00000UL,3},                          /* 2^32-1 */
    {0x41efffffUL,0xfff00000UL,3},                          /* 2^32-0.5 */
    {0x41f00000UL,0,3},                                     /* 2^32 */
    {0x41f00000UL,0x00180000UL,3},                          /* 2^32+1.5 */
    {0xc1f00000UL,0,1},                                     /* -2^32 */
    {0xc1f00000UL,0x00180000UL,1},
    {0x41e65a0bUL,0xc0000000UL,3},                          /* 3e9 */
    {0xc1e65a0bUL,0xc0000000UL,1},                          /* -3e9 */
    {0x427a1c7dUL,0x4a8b4800UL,3},                          /* 1794353317748.5 */
    {0x42a00000UL,0,3},                                     /* 2^43 */
    {0x432fffffUL,0xffffffffUL,3},                          /* 2^52-0.5 */
    {0x43300000UL,0,3},                                     /* 2^52 */
    {0x433fffffUL,0xffffffffUL,3},                          /* 2^53-1 */
    {0x43400000UL,0,3}, {0x43400000UL,1,3},                 /* 2^53, 2^53+2 */
    {0xc3400000UL,1,1},
    {0x43abc16dUL,0x674ec800UL,3},                          /* 1e18 */
    {0xc3abc16dUL,0x674ec800UL,1},
    {0x43d00000UL,0,3},                                     /* 2^62 */
    {0x43dfffffUL,0xffffffffUL,3},                          /* 2^63-1024 */
    {0xc3dfffffUL,0xffffffffUL,1},
    {0xc3e00000UL,0,1},                                     /* -2^63 */
    {0x43e00000UL,0,2},                                     /* 2^63 */
    {0x43e00000UL,1,2},                                     /* 2^63+2048 */
    {0x43efffffUL,0xffffffffUL,2},                          /* 2^64-2048 */
    {0x43f00000UL,0,0},                                     /* 2^64 */
    {0xc3e00000UL,1,0},                                     /* -2^63-2048 */
    {0x46293e59UL,0x39a08ceaUL,0},                          /* 1e30 */
    {0xc6293e59UL,0x39a08ceaUL,0},
    {0x7ff00000UL,0,0}, {0xfff00000UL,0,0},                 /* +-inf */
    {0x7ff80000UL,0,0}                                      /* NaN */
};
#define NDTAB (sizeof(dtab) / sizeof(dtab[0]))

static unsigned long seed = 20261113UL;
static unsigned long rnd(void)
{
    seed = seed * 1103515245UL + 12345UL;
    return seed ^ (seed >> 13);
}

/* a random 64-bit value whose magnitude is itself random, so that
 * small, 32-bit and full-width operands all occur. Built from the two
 * halves without any 64-bit helper. */
static u64 rnd64(void)
{
    unsigned long hi = rnd(), lo = rnd(), sh = rnd() % 64;
    if (sh >= 32) { lo = hi >> (sh - 32); hi = 0; }
    else if (sh) { lo = (lo >> sh) | (hi << (32 - sh)); hi >>= sh; }
    if (rnd() & 1) { lo = ~lo + 1; hi = ~hi + (lo == 0); }
    return MK(hi, lo);
}

static void binops(u64 a, u64 b)
{
    u64 r;
    r = p_mul(a, b);
    printf("mul %08lx%08lx %08lx%08lx %08lx%08lx\n", HI(a), LO(a), HI(b), LO(b), HI(r), LO(r));
    if (HI(b) == 0 && LO(b) == 0) return;
    r = p_divu(a, b);
    printf("divu %08lx%08lx %08lx%08lx %08lx%08lx\n", HI(a), LO(a), HI(b), LO(b), HI(r), LO(r));
    r = p_modu(a, b);
    printf("modu %08lx%08lx %08lx%08lx %08lx%08lx\n", HI(a), LO(a), HI(b), LO(b), HI(r), LO(r));
    /* INT64_MIN / -1 overflows: undefined, skip */
    if (HI(a) == 0x80000000UL && LO(a) == 0 && HI(b) == 0xffffffffUL && LO(b) == 0xffffffffUL)
        return;
    r = p_divs(a, b);
    printf("divs %08lx%08lx %08lx%08lx %08lx%08lx\n", HI(a), LO(a), HI(b), LO(b), HI(r), LO(r));
    r = p_mods(a, b);
    printf("mods %08lx%08lx %08lx%08lx %08lx%08lx\n", HI(a), LO(a), HI(b), LO(b), HI(r), LO(r));
}

static void unops(u64 a)
{
    int n;
    u64 r;
    dbits u;
    for (n = 0; n < 64; n++) {
        r = p_shl(a, n);
        printf("shl %08lx%08lx %d %08lx%08lx\n", HI(a), LO(a), n, HI(r), LO(r));
        r = p_shru(a, n);
        printf("shru %08lx%08lx %d %08lx%08lx\n", HI(a), LO(a), n, HI(r), LO(r));
        r = p_shrs(a, n);
        printf("shrs %08lx%08lx %d %08lx%08lx\n", HI(a), LO(a), n, HI(r), LO(r));
    }
    u.d = p_s2d(a);
    printf("s2d %08lx%08lx - %08lx%08lx\n", HI(a), LO(a), u.w.hi, u.w.lo);
    u.d = p_u2d(a);
    printf("u2d %08lx%08lx - %08lx%08lx\n", HI(a), LO(a), u.w.hi, u.w.lo);
}

static void dconv(unsigned long hi, unsigned long lo, int ok)
{
    dbits u;
    u64 r;
    u.w.hi = hi; u.w.lo = lo;
    r = p_d2s(u.d);
    printf("d2s%s %08lx%08lx - %08lx%08lx\n", (ok & 1) ? "" : "!", hi, lo, HI(r), LO(r));
    r = p_d2u(u.d);
    printf("d2u%s %08lx%08lx - %08lx%08lx\n", (ok & 2) ? "" : "!", hi, lo, HI(r), LO(r));
}

int main(void)
{
    unsigned long i, j;

    for (i = 0; i < NEDGE; i++) {
        unops(MK(edge[i][0], edge[i][1]));
        for (j = 0; j < NEDGE; j++)
            binops(MK(edge[i][0], edge[i][1]), MK(edge[j][0], edge[j][1]));
    }
    for (i = 0; i < 3000; i++) {
        u64 a = rnd64(), b = rnd64();
        binops(a, b);
        if (i < 200) unops(a);
        if (i < 600) {
            /* integers round-tripped through double, and random
             * doubles of every magnitude from 1/8 to 2^65 */
            dbits u;
            u.d = p_s2d(a);
            dconv(u.w.hi, u.w.lo, (HI(a) & 0x80000000UL) ? 1 : 3);
            j = 1023UL - 3 + rnd() % 68;
            u.w.hi = (rnd() & 0x800fffffUL) | (j << 20);
            u.w.lo = rnd();
            if (u.w.hi & 0x80000000UL)
                dconv(u.w.hi, u.w.lo, (j < 1023 + 63) ? ((j < 1023) ? 3 : 1) : 0);
            else
                dconv(u.w.hi, u.w.lo, (j < 1023 + 63) ? 3 : ((j < 1023 + 64) ? 2 : 0));
        }
    }
    for (i = 0; i < NDTAB; i++)
        dconv(dtab[i][0], dtab[i][1], (int)dtab[i][2]);
    printf("done\n");
    return 0;
}
