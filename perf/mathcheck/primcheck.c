/*
 * primcheck.c - run the soft-float variants' primitive maths functions
 * (library/vbcc/sharedlib_math_prim.c) on the build machine and compare
 * them with the host's libm. Built and run by run.sh.
 *
 * The file is compiled here with QJS_HOST_TEST and its public names
 * prefixed q_. What it needs from elsewhere in the library (ldexp,
 * frexp, nearbyint, expm1, atan2, pow) comes from libm here.
 *
 * sqrt must agree bit for bit. For the others the largest difference
 * in units in the last place is printed per function and must not
 * exceed the limit given in the table; the special values (NaN,
 * infinities, zeros and their signs) must agree exactly.
 */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define exp q_exp
#define log q_log
#define log10 q_log10
#define sin q_sin
#define cos q_cos
#define tan q_tan
#define atan q_atan
#define asin q_asin
#define acos q_acos
#define sinh q_sinh
#define cosh q_cosh
#define tanh q_tanh
#define sqrt q_sqrt
#include "../../library/vbcc/sharedlib_math_prim.c"
#undef exp
#undef log
#undef log10
#undef sin
#undef cos
#undef tan
#undef atan
#undef asin
#undef acos
#undef sinh
#undef cosh
#undef tanh
#undef sqrt

static uint64_t bits(double d) { uint64_t u; memcpy(&u, &d, 8); return u; }
static double frombits(uint64_t u) { double d; memcpy(&d, &u, 8); return d; }

static uint64_t seed = 88172645463325252ULL;
static uint64_t rnd(void) { seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17; return seed; }
static double unit(void) { return (double)(rnd() >> 11) / 9007199254740992.0; }   /* [0,1) */

/* distance in units in the last place; 0 for equal or both NaN, huge
 * for a sign, zero or finiteness mismatch */
static double ulps(double got, double want)
{
    uint64_t a = bits(got), b = bits(want);
    if (got != got && want != want) return 0;
    if (a == b) return 0;
    if (got != got || want != want || isinf(got) || isinf(want)) return 1e30;
    if ((a ^ b) >> 63) return (got == 0 && want == 0) ? 1e30 : fabs(got - want) / 4.9e-324;
    return (double)(a > b ? a - b : b - a);
}

typedef struct {
    const char *name;
    double (*mine)(double);
    double (*ref)(double);
    double lo, hi;          /* random arguments: sign * 10^[lo,hi] */
    int negative;           /* also negative arguments */
    double limit;           /* allowed difference, units in the last place */
} Fn;

static const Fn fns[] = {
    { "sqrt",  q_sqrt,  sqrt,  -320, 308, 0, 0 },
    { "exp",   q_exp,   exp,   -10, 2.85, 1, 2 },
    { "log",   q_log,   log,   -320, 308, 0, 2 },
    { "log10", q_log10, log10, -320, 308, 0, 3 },
    { "sin",   q_sin,   sin,   -10, 308, 1, 2 },
    { "cos",   q_cos,   cos,   -10, 308, 1, 2 },
    { "tan",   q_tan,   tan,   -10, 308, 1, 4 },
    { "atan",  q_atan,  atan,  -10, 20, 1, 2 },
    { "asin",  q_asin,  asin,  -10, 0, 1, 4 },
    { "acos",  q_acos,  acos,  -10, 0, 1, 4 },
    { "sinh",  q_sinh,  sinh,  -10, 2.85, 1, 3 },
    { "cosh",  q_cosh,  cosh,  -10, 2.85, 1, 3 },
    { "tanh",  q_tanh,  tanh,  -10, 1.5, 1, 3 },
};

int main(void)
{
    static const uint64_t special[] = {
        0x0000000000000000ull, 0x8000000000000000ull, 0x7ff0000000000000ull,
        0xfff0000000000000ull, 0x7ff8000000000000ull, 0x3ff0000000000000ull,
        0xbff0000000000000ull, 0x0000000000000001ull, 0x8000000000000001ull,
        0x0010000000000000ull, 0x7fefffffffffffffull, 0xffefffffffffffffull,
        0x3fe0000000000000ull, 0x4000000000000000ull, 0x400921fb54442d18ull,
        0x3ff921fb54442d18ull, 0x3fe921fb54442d18ull, 0x4024000000000000ull,
        0x408f400000000000ull, 0x40862e42fefa39efull, 0xc0874910d52d3052ull,
        0x3fefffffffffffffull, 0x3ff0000000000001ull, 0x3e45798ee2308c3aull,
    };
    int f, i, bad = 0;

    for (f = 0; f < (int)(sizeof fns / sizeof fns[0]); f++) {
        const Fn *fn = &fns[f];
        double worst = 0, worst_x = 0;
        int special_bad = 0;

        for (i = 0; i < (int)(sizeof special / sizeof special[0]); i++) {
            double x = frombits(special[i]);
            double got = fn->mine(x), want = fn->ref(x);
            double d = ulps(got, want);
            if (d > fn->limit) {
                special_bad++;
                printf("  %s(%016llx) = %016llx, libm %016llx\n", fn->name,
                       (unsigned long long)special[i], (unsigned long long)bits(got),
                       (unsigned long long)bits(want));
            }
        }
        for (i = 0; i < 2000000; i++) {
            double x, got, want, d;
            if (i % 8 == 0)             /* near 1, where log and acos are delicate */
                x = 1.0 + (unit() - 0.5) * pow(10.0, -15.0 * unit());
            else
                x = pow(10.0, fn->lo + (fn->hi - fn->lo) * unit()) * (1.0 + unit());
            if (fn->negative && (rnd() & 1)) x = -x;
            got = fn->mine(x); want = fn->ref(x);
            d = ulps(got, want);
            if (d > worst) { worst = d; worst_x = x; }
        }
        printf("%-6s worst %.0f ulp at %.17g (limit %.0f)%s\n", fn->name, worst, worst_x,
               fn->limit, (worst > fn->limit || special_bad) ? "  FAIL" : "");
        if (worst > fn->limit || special_bad) bad = 1;
    }
    printf(bad ? "FAIL\n" : "PASS\n");
    return bad;
}
