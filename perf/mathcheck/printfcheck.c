/*
 * printfcheck.c - compare the library's snprintf (sharedlib_printf.c)
 * with the C library of the build machine.
 *
 * Built by run-printf.sh with -DQJS_HOST_TEST, which renames the
 * library's entry points to qjs_test_snprintf / qjs_test_vsnprintf so
 * that both implementations can live in one program. Every conversion
 * specification below is applied to every value; a line is printed for
 * each result that differs, then "N compared, M wrong".
 *
 * What is NOT compared, because the two are allowed to differ:
 *   - %a of subnormal numbers and of zero precision (C leaves the
 *     leading digit to the implementation)
 *   - a precision above 101 for %f / 100 for %e, where the library
 *     prints zeros (see the header of sharedlib_printf.c)
 *   - %a with a precision, for values whose first dropped hexadecimal
 *     digit is 8: the C library of macOS rounds up only when that digit
 *     is above 8, so it prints 1000000.0, which is 0x1.e848p+19, with
 *     "%.1a" as 0x1.ep+19. The library prints 0x1.fp+19, as glibc
 *     does and as the value requires.
 */
#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <math.h>

int qjs_test_snprintf(char *buf, size_t size, const char *fmt, ...);

static const char *const float_formats[] = {
    "%f", "%.0f", "%.1f", "%.2f", "%.3f", "%.6f", "%.10f", "%.15f", "%.17f",
    "%.20f", "%.40f", "%.100f", "%10.2f", "%-10.2f|", "%+.2f", "% .2f",
    "%010.2f", "%+010.3f", "%#.0f", "%F",
    "%e", "%.0e", "%.1e", "%.2e", "%.10e", "%.16e", "%.17e", "%.30e", "%.99e",
    "%E", "%14.3e", "%-14.3e|", "%+e", "% e", "%014.4e", "%#.0e",
    "%g", "%.0g", "%.1g", "%.2g", "%.3g", "%.10g", "%.15g", "%.16g", "%.17g",
    "%.30g", "%#g", "%#.3g", "%G", "%12.4g", "%-12.4g|", "%+g", "% g", "%012g",
    "%a", "%.1a", "%.2a", "%.3a", "%.5a", "%.12a", "%.13a", "%A", "%20a", "%-20a|", "%+a", "%020a",
};

static const double float_values[] = {
    0.0, -0.0, 1.0, -1.0, 0.5, 1.5, 2.5, -2.5, 3.5, 0.125, 0.375, 0.625, 2.13,
    -2.13, 2.125, 2.135, 1.005, 2.675, 0.1, 0.3, 1.0 / 3, 2.0 / 3, 0.05, 0.15,
    0.25, 0.35, 0.045, 9.995, 99.995, 0.9999, 0.99999999, 123456789.125, 1e-5,
    1.5e-7, 1e21, 1e22, 123456789012345680000.0, 1.7976931348623157e308,
    5e-324, 2.2250738585072014e-308, 1e15, 1e16, 1e17, 9007199254740993.0,
    4.35, 4.345, 8.5, 9.5, 0.000123456, 12345.6789, 100.0, 1e5, 1e6, 1e-4,
    0.0001234, 999999.5, 9999995.0, 0.00009999995, 3.141592653589793,
    2.718281828459045, 1e100, 1.23456789e-100, 0.30000000000000004, 1e23, 5e-7,
    4.5, 5.5, 0.5e-10, 255.255, 1024.5, 65535.99, 9007199254740992.0,
    9223372036854775808.0, 18446744073709551616.0, -2147483648.0, 0.75, 0.875,
    0.0625, 25.0, 35.0, 250.0, 350.0, 2500000.0, 0.00025, 1.25, 1.35, 12.5,
    1e-310, 4.9406564584124654e-324, 2.5e-5, 6.25e-2, 0.03125, 1073741824.5,
    4294967296.5, 4503599627370496.5, 4503599627370497.5, 99.5, 999.5, 9.5e20,
    9.9999999999999995e22, 5e22, 15.0, 5.0, 0.5e1, 1e-4 * 0.5, 123456.5,
    1234565.0, 0.000012345649999, 1e300, 1e-300, 7.0, 8.0, 9.999999,
};

static const char *const int_formats[] = {
    "%d", "%5d|", "%-5d|", "%05d", "%+d", "% d", "%.3d", "%8.3d|", "%-8.3d|",
    "%+.3d", "%.0d", "%u", "%x", "%X", "%#x", "%#X", "%o", "%#o", "%08x",
    "%#010x", "%.5x", "%#.5x", "%-#8x|", "%#.3o", "%5o|", "%i", "%+05d", "% 05d",
};

static const int int_values[] = {
    0, 1, -1, 7, 42, -42, 255, 256, 4096, 65535, 2147483647, (-2147483647 - 1),
    1000000, -999, 8, 9, 10, 100,
};

/**
 * Compare one result of the library with the host's.
 * @param fmt the conversion specification
 * @param what the argument, as text for the message
 * @param ours the library's output
 * @param theirs the host C library's output
 * @param pwrong incremented when they differ
 */
static void compare(const char *fmt, const char *what, const char *ours,
                    const char *theirs, int *pwrong)
{
    if (strcmp(ours, theirs) != 0) {
        (*pwrong)++;
        if (*pwrong <= 60)
            printf("WRONG %-10s of %-26s ours [%s] host [%s]\n", fmt, what, ours, theirs);
    }
}

int main(void)
{
    char ours[1024], theirs[1024], what[64];
    int total = 0, wrong = 0, lens_wrong = 0;
    size_t f, v;

    for (f = 0; f < sizeof(float_formats) / sizeof(float_formats[0]); f++) {
        const char *fmt = float_formats[f];
        int is_hex = strchr(fmt, 'a') != NULL || strchr(fmt, 'A') != NULL;
        for (v = 0; v < sizeof(float_values) / sizeof(float_values[0]); v++) {
            double d = float_values[v];
            double specials[3];
            int n1, n2;
            if (is_hex && d != 0 && fabs(d) < 2.2250738585072014e-308)
                continue;                   /* subnormal: see the header */
            if (is_hex && strchr(fmt, '.') != NULL) {
                /* first dropped digit 8: see the header */
                int prec = fmt[2] - '0', exp2;
                uint64_t mant;
                if (fmt[3] >= '0' && fmt[3] <= '9') prec = prec * 10 + (fmt[3] - '0');
                mant = (uint64_t)ldexp(frexp(fabs(d), &exp2), 53);
                if (prec < 13 && ((mant >> (4 * (12 - prec))) & 0xf) == 8)
                    continue;
            }
            n1 = qjs_test_snprintf(ours, sizeof(ours), fmt, d);
            n2 = snprintf(theirs, sizeof(theirs), fmt, d);
            snprintf(what, sizeof(what), "%.17g", d);
            compare(fmt, what, ours, theirs, &wrong);
            if (n1 != n2) lens_wrong++;
            total++;
            if (v == 0) {
                int s;
                specials[0] = INFINITY; specials[1] = -INFINITY; specials[2] = NAN;
                for (s = 0; s < 3; s++) {
                    qjs_test_snprintf(ours, sizeof(ours), fmt, specials[s]);
                    snprintf(theirs, sizeof(theirs), fmt, specials[s]);
                    compare(fmt, s == 0 ? "inf" : s == 1 ? "-inf" : "nan", ours, theirs, &wrong);
                    total++;
                }
            }
        }
    }
    for (f = 0; f < sizeof(int_formats) / sizeof(int_formats[0]); f++) {
        for (v = 0; v < sizeof(int_values) / sizeof(int_values[0]); v++) {
            qjs_test_snprintf(ours, sizeof(ours), int_formats[f], int_values[v]);
            snprintf(theirs, sizeof(theirs), int_formats[f], int_values[v]);
            snprintf(what, sizeof(what), "%d", int_values[v]);
            compare(int_formats[f], what, ours, theirs, &wrong);
            total++;
        }
    }
    /* mixed arguments, '*' width and precision, strings, long long, truncation */
    qjs_test_snprintf(ours, sizeof(ours), "%s|%10s|%-10s|%.2s|%c|%%|%5c|", "ab", "cd", "ef", "ghij", 'x', 'y');
    snprintf(theirs, sizeof(theirs), "%s|%10s|%-10s|%.2s|%c|%%|%5c|", "ab", "cd", "ef", "ghij", 'x', 'y');
    compare("strings", "", ours, theirs, &wrong); total++;
    qjs_test_snprintf(ours, sizeof(ours), "%*d|%-*d|%.*f|%*.*f|%*.*e", 6, 42, 6, 42, 3, 3.14159, 10, 2, -2.13, -12, 3, 1234.5);
    snprintf(theirs, sizeof(theirs), "%*d|%-*d|%.*f|%*.*f|%*.*e", 6, 42, 6, 42, 3, 3.14159, 10, 2, -2.13, -12, 3, 1234.5);
    compare("stars", "", ours, theirs, &wrong); total++;
    qjs_test_snprintf(ours, sizeof(ours), "%lld %llu %llx %ld %lu %#llx %+lld", -9223372036854775807LL - 1, 18446744073709551615ULL, 0x8000000000000000ULL, -5L, 5UL, 255ULL, 7LL);
    snprintf(theirs, sizeof(theirs), "%lld %llu %llx %ld %lu %#llx %+lld", -9223372036854775807LL - 1, 18446744073709551615ULL, 0x8000000000000000ULL, -5L, 5UL, 255ULL, 7LL);
    compare("long long", "", ours, theirs, &wrong); total++;
    {
        int n1 = qjs_test_snprintf(ours, 8, "%f and more", 1234.5678);
        int n2 = snprintf(theirs, 8, "%f and more", 1234.5678);
        compare("truncation", "", ours, theirs, &wrong); total++;
        if (n1 != n2) lens_wrong++;
    }
    printf("%d compared, %d wrong, %d lengths wrong\n", total, wrong, lens_wrong);
    return wrong || lens_wrong;
}
