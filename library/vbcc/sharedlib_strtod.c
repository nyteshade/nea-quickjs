/*
 * sharedlib_strtod.c — strtod for shared library context.
 *
 * Minimal but correct implementation of string-to-double conversion.
 * Handles integer and fractional parts, exponent notation, sign,
 * infinity, nan, hex floats.
 *
 * No .lib dependencies.
 */

#include <math.h>
#include <ctype.h>

double strtod(const char *nptr, char **endptr)
{
    const char *p = nptr;
    double result = 0.0;
    double sign = 1.0;
    int has_digits = 0;

    /* Skip whitespace */
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r')
        p++;

    /* Sign */
    if (*p == '+') { p++; }
    else if (*p == '-') { sign = -1.0; p++; }

    /* Check for infinity/nan */
    if ((*p == 'i' || *p == 'I') &&
        (p[1] == 'n' || p[1] == 'N') &&
        (p[2] == 'f' || p[2] == 'F')) {
        p += 3;
        if ((*p == 'i' || *p == 'I') &&
            (p[1] == 'n' || p[1] == 'N') &&
            (p[2] == 'i' || p[2] == 'I') &&
            (p[3] == 't' || p[3] == 'T') &&
            (p[4] == 'y' || p[4] == 'Y'))
            p += 5;
        if (endptr) *endptr = (char *)p;
        return sign * HUGE_VAL;
    }
    if ((*p == 'n' || *p == 'N') &&
        (p[1] == 'a' || p[1] == 'A') &&
        (p[2] == 'n' || p[2] == 'N')) {
        p += 3;
        if (*p == '(') {
            while (*p && *p != ')') p++;
            if (*p == ')') p++;
        }
        if (endptr) *endptr = (char *)p;
        return NAN;
    }

    /* Hex float: 0x... */
    if (*p == '0' && (p[1] == 'x' || p[1] == 'X')) {
        p += 2;
        /* Integer part */
        while ((*p >= '0' && *p <= '9') ||
               (*p >= 'a' && *p <= 'f') ||
               (*p >= 'A' && *p <= 'F')) {
            int digit;
            if (*p >= '0' && *p <= '9') digit = *p - '0';
            else if (*p >= 'a' && *p <= 'f') digit = *p - 'a' + 10;
            else digit = *p - 'A' + 10;
            result = result * 16.0 + digit;
            has_digits = 1;
            p++;
        }
        if (*p == '.') {
            double frac = 1.0 / 16.0;
            p++;
            while ((*p >= '0' && *p <= '9') ||
                   (*p >= 'a' && *p <= 'f') ||
                   (*p >= 'A' && *p <= 'F')) {
                int digit;
                if (*p >= '0' && *p <= '9') digit = *p - '0';
                else if (*p >= 'a' && *p <= 'f') digit = *p - 'a' + 10;
                else digit = *p - 'A' + 10;
                result += digit * frac;
                frac /= 16.0;
                has_digits = 1;
                p++;
            }
        }
        /* Binary exponent: p+/-N */
        if (has_digits && (*p == 'p' || *p == 'P')) {
            int esign = 1, eexp = 0;
            p++;
            if (*p == '+') p++;
            else if (*p == '-') { esign = -1; p++; }
            while (*p >= '0' && *p <= '9')
                eexp = eexp * 10 + (*p++ - '0');
            if (esign < 0) {
                while (eexp-- > 0) result /= 2.0;
            } else {
                while (eexp-- > 0) result *= 2.0;
            }
        }
        if (endptr) *endptr = has_digits ? (char *)p : (char *)nptr;
        return sign * result;
    }

    /* Decimal float */
    /* Integer part */
    while (*p >= '0' && *p <= '9') {
        result = result * 10.0 + (*p - '0');
        has_digits = 1;
        p++;
    }

    /* Fractional part */
    if (*p == '.') {
        double frac = 0.1;
        p++;
        while (*p >= '0' && *p <= '9') {
            result += (*p - '0') * frac;
            frac *= 0.1;
            has_digits = 1;
            p++;
        }
    }

    if (!has_digits) {
        if (endptr) *endptr = (char *)nptr;
        return 0.0;
    }

    /* Exponent */
    if (*p == 'e' || *p == 'E') {
        int esign = 1, eexp = 0;
        const char *estart = p;
        p++;
        if (*p == '+') p++;
        else if (*p == '-') { esign = -1; p++; }
        if (*p >= '0' && *p <= '9') {
            while (*p >= '0' && *p <= '9')
                eexp = eexp * 10 + (*p++ - '0');
            if (esign < 0) {
                while (eexp-- > 0) result /= 10.0;
            } else {
                while (eexp-- > 0) result *= 10.0;
            }
        } else {
            p = estart; /* no valid exponent, rewind */
        }
    }

    if (endptr) *endptr = (char *)p;
    return sign * result;
}
