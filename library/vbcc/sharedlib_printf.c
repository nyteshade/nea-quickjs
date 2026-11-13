/*
 * sharedlib_printf.c - snprintf/vsnprintf for the shared library.
 *
 * Everything in the library that formats text ends here: the engine's
 * error messages, printf/fprintf (sharedlib_stdio.c), and std.printf,
 * std.sprintf and file.printf from JavaScript, which hand the user's
 * conversion specification straight to snprintf.
 *
 * Conversions: d i u o x X c s p % and f F e E g G a A.
 * Flags:       - + space # 0
 * Width and precision, also as '*'.
 * Length:      l, ll, z, t (h, j and L are accepted and ignored; an
 *              argument is promoted to int or double anyway).
 *
 * The floating point conversions give the digits C99 asks for: the
 * decimal expansion of the exact value, rounded to the requested
 * precision, exact ties to an even digit. The digits come from the
 * engine's own js_dtoa (dtoa.c), which works in integers, so the
 * result is the same on the FPU and the soft-float libraries. Until
 * 0.236 %f cut digits off instead of rounding (%.2f of 2.13 was
 * "2.12"), printed anything above 2^31 as "2147483647" and anything
 * above 1e18 as "inf", %e and %g printed like %f, and + space # %E %G
 * %F %a %o were not understood.
 *
 * One limit: js_dtoa produces at most 101 digits after the point (%f)
 * or 101 significant digits (%e). Digits asked for beyond that print
 * as '0', and the precision itself is capped at FMT_PREC_MAX.
 *
 * QJS_HOST_TEST builds the file for the build machine with the entry
 * points renamed, so that a test can compare it with the host's
 * printf. Nothing in the library defines it.
 *
 * No .lib dependencies. No globals.
 */

#include <stddef.h>
#include <stdarg.h>
#include <stdint.h>
#include "dtoa.h"
#include "sharedlib_dblbits.h"

#ifdef QJS_HOST_TEST
#define vsnprintf qjs_test_vsnprintf
#define snprintf  qjs_test_snprintf
int vsnprintf(char *buf, size_t size, const char *fmt, va_list ap);
int snprintf(char *buf, size_t size, const char *fmt, ...);
#endif

/* largest precision honoured for a floating point conversion */
#define FMT_PREC_MAX 400
/* room for the longest result: 309 integer digits, the point,
   FMT_PREC_MAX fraction digits, an exponent, and slack */
#define FMT_FLOAT_BUF (309 + 1 + FMT_PREC_MAX + 16)

/* Output helper: writes char, respects buffer limit */
typedef struct {
    char *buf;
    size_t pos;
    size_t max;  /* max chars (excluding NUL) */
} FmtBuf;

static void fb_putc(FmtBuf *fb, char c)
{
    if (fb->pos < fb->max)
        fb->buf[fb->pos] = c;
    fb->pos++;
}

static void fb_puts(FmtBuf *fb, const char *s, int len)
{
    int i;
    for (i = 0; i < len; i++)
        fb_putc(fb, s[i]);
}

static void fb_pad(FmtBuf *fb, char c, int count)
{
    while (count-- > 0)
        fb_putc(fb, c);
}

static int my_strlen(const char *s)
{
    const char *p = s;
    while (*p) p++;
    return (int)(p - s);
}

/* Integer to string, returns length */
static int fmt_int(char *tmp, unsigned long long val, int base, int upper)
{
    static const char digits_lower[] = "0123456789abcdef";
    static const char digits_upper[] = "0123456789ABCDEF";
    const char *digits = upper ? digits_upper : digits_lower;
    int len = 0;
    if (val == 0) { tmp[0] = '0'; return 1; }
    while (val) {
        tmp[len++] = digits[val % base];
        val /= base;
    }
    /* Reverse */
    {
        int i;
        for (i = 0; i < len / 2; i++) {
            char t = tmp[i];
            tmp[i] = tmp[len - 1 - i];
            tmp[len - 1 - i] = t;
        }
    }
    return len;
}

/* ---- floating point ------------------------------------------------ */

/* The magnitude of a finite, non-zero double as m * 2^e with m odd. */
static uint64_t dbl_odd_mantissa(const QJSDblBits *b, int *pe)
{
    uint64_t m = ((uint64_t)(b->w.hi & QJS_DBL_MANTMASK) << 32) | b->w.lo;
    int e = QJS_DBL_EXP(b->w.hi);

    if (e == 0) {
        e = -1074;                      /* subnormal */
    } else {
        m |= (uint64_t)QJS_DBL_IMPLICIT << 32;
        e -= 1075;
    }
    while ((m & 1) == 0) {
        m >>= 1;
        e++;
    }
    *pe = e;
    return m;
}

/* Is the value exactly half way between two neighbours when it is
   rounded to a multiple of 10^-k (k may be negative)? That is the case
   when value * 2 * 10^k is an odd integer. js_dtoa rounds such a tie
   upwards as JavaScript requires; C rounds it to the even neighbour,
   so the caller then takes the upward step back if it gave an odd
   digit. */
static int dbl_is_tie(const QJSDblBits *b, int k)
{
    uint64_t m, p;
    int e, j;

    m = dbl_odd_mantissa(b, &e);
    if (k >= 0)
        return e == -(k + 1);
    /* value * 2 / 10^j = m * 2^(e + 1 - j) / 5^j */
    j = -k;
    if (e != j - 1 || j > 22)           /* 5^23 exceeds 53 bits */
        return 0;
    p = 1;
    while (j-- > 0)
        p *= 5;
    return m % p == 0;
}

/* After a tie that js_dtoa rounded up: make the last digit before
   'end' even again. It is odd only when the step up produced it, so
   there is never a borrow. */
static void fmt_tie_to_even(char *s, int end)
{
    int i = end - 1;
    if (i >= 0 && s[i] >= '0' && s[i] <= '9' && ((s[i] - '0') & 1))
        s[i]--;
}

/* %f of a finite magnitude: digits, point, 'prec' fraction digits.
   Returns the length. */
static int fmt_fixed(char *out, const QJSDblBits *b, int prec, int alt)
{
    JSDTOATempMem mem;
    int n = prec > JS_DTOA_MAX_DIGITS ? JS_DTOA_MAX_DIGITS : prec;
    int len, i;

    len = js_dtoa(out, b->d, 10, n,
                  JS_DTOA_FORMAT_FRAC | JS_DTOA_EXP_DISABLED, &mem);
    if (n == prec && (b->w.hi | b->w.lo) != 0 && dbl_is_tie(b, prec))
        fmt_tie_to_even(out, len);
    if (prec > n) {
        if (n == 0)
            out[len++] = '.';
        for (i = n; i < prec; i++)
            out[len++] = '0';
    } else if (prec == 0 && alt) {
        out[len++] = '.';
    }
    return len;
}

/* %e of a finite magnitude: d.ddd with 'prec' fraction digits, then
   e+XX. Returns the length and stores the decimal exponent. */
static int fmt_exp(char *out, const QJSDblBits *b, int prec, int alt,
                   int upper, int *pexp)
{
    JSDTOATempMem mem;
    char num[JS_DTOA_MAX_DIGITS + 16];
    int n = prec + 1 > JS_DTOA_MAX_DIGITS ? JS_DTOA_MAX_DIGITS : prec + 1;
    int len, mant_len, i, e, neg, o;

    len = js_dtoa(num, b->d, 10, n,
                  JS_DTOA_FORMAT_FIXED | JS_DTOA_EXP_ENABLED, &mem);
    /* num is d[.ddd]e[+-]X */
    for (mant_len = 0; mant_len < len && num[mant_len] != 'e'; mant_len++)
        ;
    e = 0;
    neg = 0;
    i = mant_len + 1;
    if (i < len && (num[i] == '+' || num[i] == '-'))
        neg = num[i++] == '-';
    for (; i < len; i++)
        e = e * 10 + (num[i] - '0');
    if (neg)
        e = -e;
    if (n == prec + 1 && (b->w.hi | b->w.lo) != 0 && dbl_is_tie(b, prec - e))
        fmt_tie_to_even(num, mant_len);

    o = 0;
    for (i = 0; i < mant_len; i++)
        out[o++] = num[i];
    if (prec + 1 > n) {
        if (n == 1)
            out[o++] = '.';
        for (i = n; i < prec + 1; i++)
            out[o++] = '0';
    } else if (prec == 0 && alt) {
        out[o++] = '.';
    }
    out[o++] = upper ? 'E' : 'e';
    out[o++] = e < 0 ? '-' : '+';
    if (e < 0)
        e = -e;
    if (e >= 100)
        out[o++] = '0' + e / 100;
    out[o++] = '0' + (e / 10) % 10;
    out[o++] = '0' + e % 10;
    *pexp = neg ? -e : e;
    return o;
}

/* %g without '#': drop the zeros that end the fraction of s[0..end),
   and the point if nothing is left after it. Returns the new end. */
static int fmt_strip_zeros(const char *s, int end)
{
    int i, has_point = 0;

    for (i = 0; i < end; i++)
        if (s[i] == '.')
            has_point = 1;
    if (!has_point)
        return end;
    while (end > 0 && s[end - 1] == '0')
        end--;
    if (end > 0 && s[end - 1] == '.')
        end--;
    return end;
}

/* %a of a finite magnitude: 0x1.hhhp+d, the mantissa in hexadecimal.
   prec < 0 means as many digits as the value has. */
static int fmt_hex(char *out, const QJSDblBits *b, int prec, int alt, int upper)
{
    static const char lower_digits[] = "0123456789abcdef";
    static const char upper_digits[] = "0123456789ABCDEF";
    const char *digits = upper ? upper_digits : lower_digits;
    uint64_t m = ((uint64_t)(b->w.hi & QJS_DBL_MANTMASK) << 32) | b->w.lo;
    int e = QJS_DBL_EXP(b->w.hi);
    int lead = 1, o = 0, i, ndig, tmp_len;
    char etmp[8];

    if (e == 0) {
        if (m == 0) {
            lead = 0;
        } else {
            /* subnormal: shift the leading one up to the implicit place */
            e = -1022;
            while (!(m & ((uint64_t)QJS_DBL_IMPLICIT << 32))) {
                m <<= 1;
                e--;
            }
            m &= ((uint64_t)QJS_DBL_IMPLICIT << 32) - 1;
        }
    } else {
        e -= QJS_DBL_BIAS;
    }
    /* m: 52 bits, 13 hexadecimal digits after the point */
    if (prec >= 0 && prec < 13) {
        int drop = (13 - prec) * 4;
        uint64_t unit = (uint64_t)1 << drop;
        uint64_t rest = m & (unit - 1);
        m >>= drop;
        if (rest > unit / 2 || (rest == unit / 2 && ((m & 1) || (prec == 0 && lead))))
            m++;
        if (m >> (prec * 4)) {          /* carried into the leading digit */
            m &= ((uint64_t)1 << (prec * 4)) - 1;
            lead++;
        }
        ndig = prec;
    } else {
        ndig = 13;
        if (prec < 0) {
            while (ndig > 0 && (m & 0xf) == 0) {
                m >>= 4;
                ndig--;
            }
        }
    }
    out[o++] = '0';
    out[o++] = upper ? 'X' : 'x';
    out[o++] = '0' + lead;
    if (ndig > 0 || alt || prec > 13)
        out[o++] = '.';
    for (i = ndig - 1; i >= 0; i--)
        out[o++] = digits[(int)((m >> (i * 4)) & 0xf)];
    for (i = 13; i < prec && i < FMT_PREC_MAX; i++)
        out[o++] = '0';
    out[o++] = upper ? 'P' : 'p';
    out[o++] = e < 0 ? '-' : '+';
    tmp_len = fmt_int(etmp, (unsigned long long)(e < 0 ? -e : e), 10, 0);
    for (i = 0; i < tmp_len; i++)
        out[o++] = etmp[i];
    return o;
}

/* One floating point conversion, without sign and padding. 'out' has
   FMT_FLOAT_BUF bytes. *pfinite is cleared for inf and nan, which take
   no zero padding. */
static int fmt_double(char *out, const QJSDblBits *b, int prec, char conv,
                      int alt, int *pfinite)
{
    int upper = conv >= 'A' && conv <= 'Z';
    char kind = upper ? conv + ('a' - 'A') : conv;
    int len, e;

    *pfinite = 1;
    if (QJS_DBL_EXP(b->w.hi) == 0x7ff) {
        const char *s = ((b->w.hi & QJS_DBL_MANTMASK) | b->w.lo)
            ? (upper ? "NAN" : "nan") : (upper ? "INF" : "inf");
        out[0] = s[0]; out[1] = s[1]; out[2] = s[2];
        *pfinite = 0;
        return 3;
    }
    if (kind == 'a')
        return fmt_hex(out, b, prec > FMT_PREC_MAX ? FMT_PREC_MAX : prec, alt, upper);
    if (prec < 0)
        prec = 6;
    if (prec > FMT_PREC_MAX)
        prec = FMT_PREC_MAX;
    if (kind == 'f')
        return fmt_fixed(out, b, prec, alt);
    if (kind == 'e')
        return fmt_exp(out, b, prec, alt, upper, &e);

    /* %g: P significant digits; the style depends on the exponent X
       the value has once rounded to P digits */
    if (prec == 0)
        prec = 1;
    len = fmt_exp(out, b, prec - 1, alt, upper, &e);
    if (e < -4 || e >= prec) {
        if (!alt) {
            /* strip the mantissa's zeros, keep the exponent */
            int mant_end = 0, new_end, i;
            while (mant_end < len && out[mant_end] != 'e' && out[mant_end] != 'E')
                mant_end++;
            new_end = fmt_strip_zeros(out, mant_end);
            if (new_end != mant_end) {
                for (i = mant_end; i < len; i++)
                    out[new_end + (i - mant_end)] = out[i];
                len -= mant_end - new_end;
            }
        }
        return len;
    }
    len = fmt_fixed(out, b, prec - 1 - e, alt);
    if (!alt)
        len = fmt_strip_zeros(out, len);
    return len;
}

int vsnprintf(char *buf, size_t size, const char *fmt, va_list ap)
{
    FmtBuf fb;
    fb.buf = buf;
    fb.pos = 0;
    fb.max = (size > 0) ? size - 1 : 0;

    while (*fmt) {
        if (*fmt != '%') {
            fb_putc(&fb, *fmt++);
            continue;
        }
        fmt++; /* skip '%' */

        /* Parse flags */
        {
            int zero_pad = 0, left_align = 0, force_sign = 0;
            int space_sign = 0, alt = 0;
            int width = 0, prec = -1;
            int long_count = 0;
            char tmp[80];
            const char *prefix = "";    /* "0x" of %#x */
            int len;

            while (*fmt == '0' || *fmt == '-' || *fmt == '+' || *fmt == ' ' ||
                   *fmt == '#' || *fmt == '\'') {
                if (*fmt == '0') zero_pad = 1;
                if (*fmt == '-') left_align = 1;
                if (*fmt == '+') force_sign = 1;
                if (*fmt == ' ') space_sign = 1;
                if (*fmt == '#') alt = 1;
                fmt++;
            }

            /* Width */
            if (*fmt == '*') {
                width = va_arg(ap, int);
                if (width < 0) {        /* a negative width means '-' */
                    left_align = 1;
                    width = -width;
                }
                fmt++;
            } else {
                while (*fmt >= '0' && *fmt <= '9')
                    width = width * 10 + (*fmt++ - '0');
            }

            /* Precision */
            if (*fmt == '.') {
                fmt++;
                prec = 0;
                if (*fmt == '*') {
                    prec = va_arg(ap, int); /* negative: as if absent */
                    fmt++;
                } else {
                    while (*fmt >= '0' && *fmt <= '9')
                        prec = prec * 10 + (*fmt++ - '0');
                }
            }

            /* Length modifier */
            while (*fmt == 'l') { long_count++; fmt++; }
            if (*fmt == 'z' || *fmt == 't') { long_count = 1; fmt++; }
            while (*fmt == 'h' || *fmt == 'j' || *fmt == 'L') fmt++;

            /* Conversion */
            len = 0;
            switch (*fmt) {
            case 'd': case 'i': {
                long long val;
                int neg = 0;
                if (long_count >= 2) val = va_arg(ap, long long);
                else if (long_count == 1) val = va_arg(ap, long);
                else val = va_arg(ap, int);
                if (val < 0) { neg = 1; val = -val; }
                if (neg || force_sign || space_sign) {
                    len = fmt_int(tmp + 1, (unsigned long long)val, 10, 0);
                    tmp[0] = neg ? '-' : force_sign ? '+' : ' ';
                    len++;
                } else {
                    len = fmt_int(tmp, (unsigned long long)val, 10, 0);
                }
                break;
            }
            case 'u': {
                unsigned long long val;
                if (long_count >= 2) val = va_arg(ap, unsigned long long);
                else if (long_count == 1) val = va_arg(ap, unsigned long);
                else val = va_arg(ap, unsigned int);
                len = fmt_int(tmp, val, 10, 0);
                break;
            }
            case 'o': {
                unsigned long long val;
                if (long_count >= 2) val = va_arg(ap, unsigned long long);
                else if (long_count == 1) val = va_arg(ap, unsigned long);
                else val = va_arg(ap, unsigned int);
                len = fmt_int(tmp, val, 8, 0);
                if (alt && val != 0)
                    prefix = "0";
                break;
            }
            case 'x': case 'X': {
                unsigned long long val;
                if (long_count >= 2) val = va_arg(ap, unsigned long long);
                else if (long_count == 1) val = va_arg(ap, unsigned long);
                else val = va_arg(ap, unsigned int);
                len = fmt_int(tmp, val, 16, *fmt == 'X');
                if (alt && val != 0)
                    prefix = *fmt == 'X' ? "0X" : "0x";
                break;
            }
            case 'p': {
                unsigned long val = (unsigned long)va_arg(ap, void *);
                tmp[0] = '0'; tmp[1] = 'x';
                len = fmt_int(tmp + 2, val, 16, 0) + 2;
                break;
            }
            case 's': {
                const char *s = va_arg(ap, const char *);
                int slen;
                if (!s) s = "(null)";
                slen = my_strlen(s);
                if (prec >= 0 && slen > prec) slen = prec;
                if (!left_align) fb_pad(&fb, ' ', width - slen);
                fb_puts(&fb, s, slen);
                if (left_align) fb_pad(&fb, ' ', width - slen);
                fmt++;
                continue;
            }
            case 'c':
                tmp[0] = (char)va_arg(ap, int);
                len = 1;
                prec = -1;
                break;
            case '%':
                fb_putc(&fb, '%');
                fmt++;
                continue;
            case 'f': case 'F': case 'e': case 'E':
            case 'g': case 'G': case 'a': case 'A': {
                char num[FMT_FLOAT_BUF];
                QJSDblBits b;
                char sign = 0;
                int finite, nlen, total;

                b.d = va_arg(ap, double);
                if (b.w.hi & QJS_DBL_SIGN) {    /* also -0 and -nan */
                    sign = '-';
                    b.w.hi &= ~QJS_DBL_SIGN;
                } else if (force_sign) {
                    sign = '+';
                } else if (space_sign) {
                    sign = ' ';
                }
                nlen = fmt_double(num, &b, prec, *fmt, alt, &finite);
                if (num[0] == 'n' || num[0] == 'N')
                    sign = 0;           /* a NaN is shown without a sign */
                total = nlen + (sign != 0);
                if (left_align) {
                    if (sign) fb_putc(&fb, sign);
                    fb_puts(&fb, num, nlen);
                    fb_pad(&fb, ' ', width - total);
                } else if (zero_pad && finite) {
                    /* zeros go after the sign, and after the 0x of %a */
                    int skip = (*fmt == 'a' || *fmt == 'A') ? 2 : 0;
                    if (sign) fb_putc(&fb, sign);
                    fb_puts(&fb, num, skip);
                    fb_pad(&fb, '0', width - total);
                    fb_puts(&fb, num + skip, nlen - skip);
                } else {
                    fb_pad(&fb, ' ', width - total);
                    if (sign) fb_putc(&fb, sign);
                    fb_puts(&fb, num, nlen);
                }
                fmt++;
                continue;
            }
            default:
                fb_putc(&fb, '%');
                if (*fmt == '\0')       /* a lone '%' ends the format */
                    continue;
                fb_putc(&fb, *fmt);
                fmt++;
                continue;
            }

            /* Output with padding (integer conversions, %c and %p).
             * An integer precision is a minimum number of digits, and
             * with one given the 0 flag is ignored. Zero padding goes
             * between the sign or prefix and the digits: "%+07d" of -1
             * is "-000001", not "00000-1" (which is what
             * Date.prototype.toISOString printed for the year -1). */
            {
                int skip = 0, digits, zeros = 0, plen, total;
                int is_int = (*fmt != 'c' && *fmt != 'p');

                if (is_int && len > 0 &&
                    (tmp[0] == '-' || tmp[0] == '+' || tmp[0] == ' '))
                    skip = 1;
                digits = len - skip;
                if (is_int && prec == 0 && digits == 1 && tmp[skip] == '0')
                    digits = 0;         /* "%.0d" of 0 prints nothing */
                plen = my_strlen(prefix);
                if (is_int && prec >= 0) {
                    if (prec > digits + (*fmt == 'o' ? plen : 0))
                        zeros = prec - digits - (*fmt == 'o' ? plen : 0);
                } else if (zero_pad && !left_align && is_int) {
                    if (width > skip + plen + digits)
                        zeros = width - skip - plen - digits;
                }
                total = skip + plen + zeros + digits;
                if (!left_align) fb_pad(&fb, ' ', width - total);
                fb_puts(&fb, tmp, skip);
                fb_puts(&fb, prefix, plen);
                fb_pad(&fb, '0', zeros);
                fb_puts(&fb, tmp + skip, digits);
                if (left_align) fb_pad(&fb, ' ', width - total);
            }
        }
        fmt++;
    }

    /* NUL terminate */
    if (size > 0) {
        if (fb.pos < size)
            fb.buf[fb.pos] = '\0';
        else
            fb.buf[size - 1] = '\0';
    }

    return (int)fb.pos;
}

int snprintf(char *buf, size_t size, const char *fmt, ...)
{
    va_list ap;
    int ret;
    va_start(ap, fmt);
    ret = vsnprintf(buf, size, fmt, ap);
    va_end(ap);
    return ret;
}

/* _putbuf defined in sharedlib_vbcc.c */
