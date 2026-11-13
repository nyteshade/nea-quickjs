/*
 * gen.c - host program: writes the test vectors for sftest.c.
 *
 *   cc -O1 -o gen gen.c && ./gen vectors.bin [random-count]
 *
 * Each record is seven big-endian 32-bit words:
 *   op, a_hi, a_lo, b_hi, b_lo, expect_hi, expect_lo
 * The expected values are computed here with the host's own doubles,
 * which are IEEE 754 (the program checks that first). The operands are
 * every pairing of a list of awkward values (zeros, denormals, powers
 * of two and their neighbours, the int32/uint32/2^53 boundaries, the
 * largest numbers, infinities, NaN) followed by random ones of several
 * kinds: any bit pattern, exponents close together (so additions
 * cancel and round), products and quotients near overflow and near the
 * denormal range.
 *
 * Do not build with -ffast-math, and not with a compiler that keeps
 * intermediate results in extended precision.
 */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum { OP_ADD, OP_SUB, OP_MUL, OP_DIV, OP_DCMP, OP_CMP, OP_TST, OP_FIX,
       OP_FLT, OP_FLOOR, OP_CEIL, OP_TIEEE, OP_FIEEE, OP_NEG, OP_ABS,
       OP_COUNT };

static FILE *out;
static unsigned long nrec;

static uint64_t bits(double d) { uint64_t u; memcpy(&u, &d, 8); return u; }
static double dbl(uint64_t u) { double d; memcpy(&d, &u, 8); return d; }

static void w32(uint32_t v)
{
    unsigned char b[4];
    b[0] = v >> 24; b[1] = v >> 16; b[2] = v >> 8; b[3] = v;
    fwrite(b, 1, 4, out);
}

static void rec(int op, uint64_t a, uint64_t b, uint64_t e)
{
    w32(op); w32(a >> 32); w32((uint32_t)a); w32(b >> 32); w32((uint32_t)b);
    w32(e >> 32); w32((uint32_t)e);
    nrec++;
}

/* what sf_fix is specified to return (see sharedlib_softfp.s) */
static uint32_t fix(double x)
{
    if (isnan(x)) return 0;
    if (fabs(x) >= 4294967296.0) return x < 0 ? 0x80000000u : 0x7fffffffu;
    return (uint32_t)(int64_t)x;
}

static void unary(double a)
{
    uint64_t ua = bits(a);
    float f;
    uint32_t uf;
    rec(OP_TST, ua, 0, (uint32_t)(isnan(a) ? 1 : a > 0 ? 1 : a < 0 ? -1 : 0));
    rec(OP_FIX, ua, 0, fix(a));
    rec(OP_FLOOR, ua, 0, bits(floor(a)));
    rec(OP_CEIL, ua, 0, bits(ceil(a)));
    f = (float)a; memcpy(&uf, &f, 4);
    if (isnan(a)) uf = 0x7fc00000u;
    rec(OP_TIEEE, ua, 0, uf);
    rec(OP_NEG, ua, 0, ua ^ 0x8000000000000000ull);
    rec(OP_ABS, ua, 0, ua & 0x7fffffffffffffffull);
    /* the high word of a, read as a float, and as an integer */
    uf = (uint32_t)(ua >> 32);
    memcpy(&f, &uf, 4);
    rec(OP_FIEEE, (uint64_t)uf << 32, 0, bits((double)f));
    rec(OP_FLT, (uint64_t)uf << 32, 0, bits((double)(int32_t)uf));
}

static void binary(double a, double b)
{
    uint64_t ua = bits(a), ub = bits(b);
    int c = (isnan(a) || isnan(b)) ? 2 : a < b ? -1 : a > b ? 1 : 0;
    rec(OP_ADD, ua, ub, bits(a + b));
    rec(OP_SUB, ua, ub, bits(a - b));
    rec(OP_MUL, ua, ub, bits(a * b));
    rec(OP_DIV, ua, ub, bits(a / b));
    rec(OP_DCMP, ua, ub, (uint32_t)c);
    rec(OP_CMP, ua, ub, (uint32_t)(c == 2 ? 1 : c));
}

static uint64_t rs = 0x9E3779B97F4A7C15ull;
static uint64_t rnd(void)
{
    rs ^= rs << 13; rs ^= rs >> 7; rs ^= rs << 17;
    return rs;
}

/* a double with the given biased exponent and random sign and fraction;
   now and then the fraction is all zeros, all ones, or nearly so */
static double with_exp(int e)
{
    uint64_t f = rnd() & 0xfffffffffffffull;
    switch (rnd() % 12) {
    case 0: f = 0; break;
    case 1: f = 0xfffffffffffffull; break;
    case 2: f &= 0xfffff00000000ull; break;
    case 3: f |= 0x00000ffffffffull; break;
    case 4: f = (uint64_t)1 << (rnd() % 52); break;
    case 5: f = 0xfffffffffffffull ^ ((uint64_t)1 << (rnd() % 52)); break;
    }
    return dbl(((rnd() & 1) << 63) | ((uint64_t)(e & 0x7ff) << 52) | f);
}

int main(int argc, char **argv)
{
    static double sp[200];
    int n = 0, i, j;
    long count = argc > 2 ? atol(argv[2]) : 20000;
    volatile double third = 1.0, three = 3.0;

    if (argc < 2) { fprintf(stderr, "usage: gen out.bin [count]\n"); return 2; }
    if (bits(third / three) != 0x3fd5555555555555ull || bits(0.1 + 0.2) != 0x3fd3333333333334ull) {
        fprintf(stderr, "host arithmetic is not plain IEEE 754 double\n");
        return 2;
    }
    out = fopen(argv[1], "wb");
    if (!out) { perror(argv[1]); return 2; }

    {
        static const uint64_t pos[] = {
            0x0000000000000000ull, 0x0000000000000001ull, 0x0000000000000002ull,
            0x0000000080000000ull, 0x00000000ffffffffull, 0x0000000100000000ull,
            0x0008000000000000ull, 0x000fffffffffffffull, 0x0010000000000000ull,
            0x0010000000000001ull, 0x001fffffffffffffull, 0x0020000000000000ull,
            0x01a56e1fc2f8f359ull, 0x3ca0000000000000ull, 0x3cb0000000000000ull,
            0x3e7ad7f29abcaf48ull, 0x3fb999999999999aull, 0x3fd5555555555555ull,
            0x3fdfffffffffffffull, 0x3fe0000000000000ull, 0x3fe0000000000001ull,
            0x3fefffffffffffffull, 0x3ff0000000000000ull, 0x3ff0000000000001ull,
            0x3ff8000000000000ull, 0x3fffffffffffffffull, 0x4000000000000000ull,
            0x4004000000000000ull, 0x4008000000000000ull, 0x400921fb54442d18ull,
            0x401c000000000000ull, 0x4024000000000000ull, 0x406fe00000000000ull,
            0x40dfffc000000000ull, 0x41dfffffffc00000ull, 0x41dfffffffe00000ull,
            0x41e0000000000000ull, 0x41e0000000100000ull, 0x41efffffffe00000ull,
            0x41effffffff00000ull, 0x41f0000000000000ull, 0x41f0000000080000ull,
            0x432fffffffffffffull, 0x433fffffffffffffull, 0x4340000000000000ull,
            0x4340000000000001ull, 0x43e0000000000000ull, 0x43f0000000000000ull,
            0x444b1ae4d6e2ef50ull, 0x47efffffe0000000ull, 0x47efffffefffffffull,
            0x47effffff0000000ull, 0x36a0000000000000ull, 0x3690000000000000ull,
            0x3690000000000001ull, 0x380fffffffffffffull, 0x3810000000000000ull,
            0x7e37e43c8800759cull, 0x7fe0000000000000ull, 0x7fefffffffffffffull,
            0x7ff0000000000000ull, 0x7ff8000000000000ull, 0x7ff0000000000001ull,
        };
        for (i = 0; i < (int)(sizeof pos / sizeof pos[0]); i++) {
            sp[n++] = dbl(pos[i]);
            sp[n++] = dbl(pos[i] | 0x8000000000000000ull);
        }
    }
    for (i = 0; i < n; i++) {
        unary(sp[i]);
        for (j = 0; j < n; j++) binary(sp[i], sp[j]);
    }
    for (i = 0; i < count; i++) {
        double a, b;
        int ea = 1 + (int)(rnd() % 2046);
        switch (i % 10) {
        case 0:  a = dbl(rnd()); b = dbl(rnd()); break;                    /* anything */
        case 1:  a = with_exp(ea); b = with_exp(ea + (int)(rnd() % 5) - 2); break;   /* cancellation */
        case 2:  a = with_exp(ea); b = with_exp(ea + (int)(rnd() % 130) - 65); break; /* alignment */
        case 3:  a = with_exp(ea); b = with_exp(2046 - ea + (int)(rnd() % 9) - 4); break; /* product near 1 */
        case 4:  a = with_exp(1023 + (int)(rnd() % 1023)); b = with_exp(1023 + 1023 - (ea % 1023) + (int)(rnd() % 7) - 3); break; /* overflow edge */
        case 5:  a = with_exp((int)(rnd() % 1100)); b = with_exp((int)(rnd() % 1100)); break;  /* small */
        case 6:  a = with_exp((int)(rnd() % 3)); b = with_exp((int)(rnd() % 60)); break;       /* denormals */
        case 7:  a = with_exp(ea); b = with_exp(ea - 1022 + (int)(rnd() % 120) - 60); break;   /* quotient near denormal */
        case 8:  a = (double)(int32_t)rnd() * (rnd() & 1 ? 1.0 : 0.5); b = (double)(int32_t)(rnd() >> (rnd() % 30)); break; /* integers */
        default: a = with_exp(1023 + (int)(rnd() % 70) - 4); b = with_exp(1023 + (int)(rnd() % 70) - 4); break;  /* around the integer range */
        }
        binary(a, b);
        unary(a);
    }
    fclose(out);
    fprintf(stderr, "%lu records\n", nrec);
    return 0;
}
