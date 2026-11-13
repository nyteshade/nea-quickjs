/*
 * hostcheck.c - run the FPU variants' bit-level maths replacements on
 * the build machine and compare them with the host's libm.
 *
 * library/vbcc/sharedlib_math_round.c and sharedlib_math_pow.c are
 * compiled here with QJS_HOST_TEST (which only swaps the order of a
 * double's two halves for a little-endian machine) and with their
 * public names prefixed q_, so both they and libm can be called.
 * Built and run by run.sh.
 *
 * floor, ceil, trunc, round, nearbyint, fmod, ldexp and frexp must
 * agree with libm bit for bit. pow must agree within one unit in the
 * last place, exactly where libm's result is exact in the cases
 * listed, and in the special cases except (+-1) ** +-Infinity, which
 * is NaN here as ECMAScript requires.
 */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define floor q_floor
#define ceil q_ceil
#define trunc q_trunc
#define round q_round
#define nearbyint q_nearbyint
#define lround q_lround
#define fmod q_fmod
#define ldexp q_ldexp
#define frexp q_frexp
#define pow q_pow
#include "../../library/vbcc/sharedlib_math_round.c"
#include "../../library/vbcc/sharedlib_math_pow.c"
#undef floor
#undef ceil
#undef trunc
#undef round
#undef nearbyint
#undef lround
#undef fmod
#undef ldexp
#undef frexp
#undef pow

static uint64_t bits(double d) { uint64_t u; memcpy(&u, &d, 8); return u; }
static double frombits(uint64_t u) { double d; memcpy(&d, &u, 8); return d; }

/* same value; any NaN equals any NaN */
static int same(double a, double b) { return (a != a && b != b) || bits(a) == bits(b); }

static uint64_t seed = 88172645463325252ULL;
static uint64_t rnd(void) { seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17; return seed; }

/* a random double: any bit pattern, or one near an integer boundary */
static double rnd_double(void)
{
    uint64_t r = rnd();
    switch (r & 7) {
    case 0: return frombits(rnd());
    case 1: return (double)(int64_t)(rnd() >> (rnd() % 64)) + ((rnd() & 3) - 1) * 0.5;
    case 2: return ldexp(1.0, (int)(rnd() % 120) - 60) * ((rnd() & 1) ? 1 : -1) + ((int)(rnd() % 5) - 2) * 0.25;
    case 3: return frombits((rnd() & 0x800fffffffffffffULL) | ((uint64_t)(1023 - 4 + rnd() % 60) << 52));
    default: return ((double)(int64_t)rnd() / 9007199254740992.0) * ldexp(1.0, (int)(rnd() % 80) - 20);
    }
}

static long bad;
static void fail1(const char *f, double x, double got, double want)
{
    if (bad++ < 30)
        printf("WRONG %s(%.17g) = %.17g [%016llx], libm %.17g [%016llx]\n", f, x, got,
               (unsigned long long)bits(got), want, (unsigned long long)bits(want));
}
static void fail2(const char *f, double x, double y, double got, double want)
{
    if (bad++ < 30)
        printf("WRONG %s(%.17g, %.17g) = %.17g [%016llx], libm %.17g [%016llx]\n", f, x, y, got,
               (unsigned long long)bits(got), want, (unsigned long long)bits(want));
}

/* distance in units in the last place between two finite doubles of the same sign */
static uint64_t ulps(double a, double b)
{
    uint64_t x = bits(a), y = bits(b);
    return x > y ? x - y : y - x;
}

int main(void)
{
    static const double special[] = { 0.0, -0.0, 0.5, -0.5, 0.49999999999999994, 1.0, -1.0, 1.5, -1.5, 2.5, -2.5,
        3.5, 2147483647.5, -2147483648.5, 3e9, -3e9, 4503599627370495.5, -4503599627370495.5, 4503599627370496.0,
        9007199254740992.0, 1e300, -1e300, 5e-324, -5e-324, 2.2250738585072014e-308, INFINITY, -INFINITY, NAN, 2.0,
        3.0, 10.0, 0.1, 7.0, -2.0, -8.0, 1.1, 0.3, 1e-5, 1024.0, -1024.0, 1025.0, 0.75, 1e22, 308.0, -324.0, 53.0, 0.25 };
    int ns = (int)(sizeof(special) / sizeof(special[0]));
    long i, n_round = 0, n_pow = 0, pow_inexact = 0, pow_1ulp = 0;
    int a, b;

    for (i = 0; i < 3000000 + ns; i++) {
        double x = i < ns ? special[i] : rnd_double();
        int e1, e2, k = (int)(rnd() % 2300) - 1150;
        double m1, m2;
        n_round++;
        if (!same(q_floor(x), floor(x))) fail1("floor", x, q_floor(x), floor(x));
        if (!same(q_ceil(x), ceil(x))) fail1("ceil", x, q_ceil(x), ceil(x));
        if (!same(q_trunc(x), trunc(x))) fail1("trunc", x, q_trunc(x), trunc(x));
        if (!same(q_round(x), round(x))) fail1("round", x, q_round(x), round(x));
        if (!same(q_nearbyint(x), nearbyint(x))) fail1("nearbyint", x, q_nearbyint(x), nearbyint(x));
        if (!same(q_ldexp(x, k), ldexp(x, k))) fail2("ldexp", x, k, q_ldexp(x, k), ldexp(x, k));
        m1 = q_frexp(x, &e1); m2 = frexp(x, &e2);
        if (!same(m1, m2) || (isfinite(x) && x != 0 && e1 != e2)) fail1("frexp", x, m1, m2);
        if (fabs(x) < 2147483000.0 && q_lround(x) != lround(x)) fail1("lround", x, (double)q_lround(x), (double)lround(x));
    }
    for (i = 0; i < 1000000 + ns * ns; i++) {
        double x = i < ns * ns ? special[i / ns] : rnd_double();
        double y = i < ns * ns ? special[i % ns] : rnd_double();
        if (!same(q_fmod(x, y), fmod(x, y))) fail2("fmod", x, y, q_fmod(x, y), fmod(x, y));
    }
    /* pow: special values against each other, then small integers,
     * then random operands whose result is neither 0 nor Infinity */
    qjs_host_use_pow_int = 0;
    for (a = 0; a < ns; a++)
        for (b = 0; b < ns; b++) {
            double x = special[a], y = special[b], got = q_pow(x, y), want = pow(x, y);
            n_pow++;
            /* ECMAScript's choices where C differs: NaN, not 1 */
            if ((fabs(x) == 1.0 && isinf(y)) || (x == 1.0 && y != y)) { if (got == got) fail2("pow", x, y, got, NAN); continue; }
            if (same(got, want)) continue;
            if (isfinite(got) && isfinite(want) && got != 0 && want != 0 && ulps(got, want) <= 1) { pow_1ulp++; continue; }
            fail2("pow", x, y, got, want);
        }
    for (a = -40; a <= 40; a++)
        for (b = -70; b <= 70; b++) {
            double got, want = pow((double)a, (double)b);
            n_pow++;
            /* repeated squaring: exact whenever the result is a whole
             * number below 2^53 (every product on the way is then
             * exact in a double as well) */
            qjs_host_use_pow_int = 1;
            got = q_pow((double)a, (double)b);
            if (b >= 0 && fabs(want) < 9007199254740992.0 && !same(got, want)) fail2("pow_int", a, b, got, want);
            qjs_host_use_pow_int = 0;
            got = q_pow((double)a, (double)b);
            if (same(got, want)) continue;
            if (isfinite(got) && isfinite(want) && got != 0 && ulps(got, want) <= 1) { pow_1ulp++; continue; }
            fail2("pow", a, b, got, want);
        }
    for (i = 0; i < 2000000; i++) {
        double x = fabs(rnd_double()), y, got, want;
        switch (rnd() % 4) {
        case 0: y = (double)((int)(rnd() % 4001) - 2000); break;
        case 1: y = ((double)(int64_t)rnd() / 9223372036854775808.0) * 40.0; break;
        case 2: y = (double)((int)(rnd() % 81) - 40) * 0.5; break;
        default: y = rnd_double(); break;
        }
        if (rnd() % 8 == 0) x = 1.0 + ((double)(int64_t)rnd() / 9223372036854775808.0) * 1e-3;
        want = pow(x, y); got = q_pow(x, y);
        n_pow++;
        if (same(got, want)) continue;
        pow_inexact++;
        if (isfinite(got) && isfinite(want) && want != 0 && got != 0 && ulps(got, want) <= 1) { pow_1ulp++; continue; }
        /* at the very edge of the range a last-place difference is 0 against the smallest number, or the largest against Infinity */
        if ((want == 0 || got == 0) && fabs(want) + fabs(got) <= 1e-323) { pow_1ulp++; continue; }
        if ((isinf(want) || isinf(got)) && (fabs(want) >= 1.797693134862315e308 || fabs(got) >= 1.797693134862315e308) && (want > 0) == (got > 0)) { pow_1ulp++; continue; }
        fail2("pow", x, y, got, want);
    }
    printf("rounding/ldexp/frexp/fmod: %ld operands checked\n", n_round);
    printf("pow: %ld cases, %ld differ from libm by one unit in the last place\n", n_pow, pow_1ulp);
    printf("%ld wrong\n", bad);
    return bad != 0;
}
