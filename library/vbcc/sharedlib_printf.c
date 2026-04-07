/*
 * sharedlib_printf.c — Minimal snprintf/vsnprintf for shared library.
 *
 * Supports: %d, %u, %x, %X, %ld, %lu, %lx, %lld, %llu, %llx,
 *           %s, %c, %p, %%, %f, %e, %g (basic float)
 *           Width and precision: %10d, %.5s, %08x, etc.
 *           Flags: 0 (zero-pad), - (left-align), + (force sign)
 *
 * No .lib dependencies. No globals.
 */

#include <stddef.h>
#include <stdarg.h>
#include <math.h>

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

/* Float to string — basic implementation */
static int fmt_float(char *tmp, double val, int prec, int fmt_type)
{
    int len = 0;
    int i;
    double frac, intpart;
    unsigned long ipart;

    if (prec < 0) prec = 6;

    /* Handle sign */
    if (val < 0.0) {
        tmp[len++] = '-';
        val = -val;
    }

    /* Handle infinity and NaN */
    if (val != val) { /* NaN */
        tmp[len++]='n'; tmp[len++]='a'; tmp[len++]='n';
        return len;
    }
    if (val > 1e18) { /* infinity or very large */
        tmp[len++]='i'; tmp[len++]='n'; tmp[len++]='f';
        return len;
    }

    /* Split into integer and fractional parts */
    intpart = floor(val);
    frac = val - intpart;

    /* Format integer part */
    ipart = (unsigned long)intpart;
    {
        char ibuf[24];
        int ilen = fmt_int(ibuf, ipart, 10, 0);
        for (i = 0; i < ilen; i++)
            tmp[len++] = ibuf[i];
    }

    if (prec > 0) {
        tmp[len++] = '.';
        /* Format fractional digits */
        for (i = 0; i < prec && i < 17; i++) {
            frac *= 10.0;
            {
                int digit = (int)frac;
                tmp[len++] = '0' + digit;
                frac -= digit;
            }
        }
    }

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
            int width = 0, prec = -1;
            int long_count = 0;
            char tmp[80];
            int len;

            while (*fmt == '0' || *fmt == '-' || *fmt == '+' || *fmt == ' ') {
                if (*fmt == '0') zero_pad = 1;
                if (*fmt == '-') left_align = 1;
                if (*fmt == '+') force_sign = 1;
                fmt++;
            }

            /* Width */
            if (*fmt == '*') {
                width = va_arg(ap, int);
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
                    prec = va_arg(ap, int);
                    fmt++;
                } else {
                    while (*fmt >= '0' && *fmt <= '9')
                        prec = prec * 10 + (*fmt++ - '0');
                }
            }

            /* Length modifier */
            while (*fmt == 'l') { long_count++; fmt++; }
            if (*fmt == 'z' || *fmt == 't') { long_count = 1; fmt++; }

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
                if (neg || force_sign) {
                    len = fmt_int(tmp + 1, (unsigned long long)val, 10, 0);
                    tmp[0] = neg ? '-' : '+';
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
            case 'x': case 'X': {
                unsigned long long val;
                if (long_count >= 2) val = va_arg(ap, unsigned long long);
                else if (long_count == 1) val = va_arg(ap, unsigned long);
                else val = va_arg(ap, unsigned int);
                len = fmt_int(tmp, val, 16, *fmt == 'X');
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
                break;
            case '%':
                fb_putc(&fb, '%');
                fmt++;
                continue;
            case 'f': case 'e': case 'g': {
                double val = va_arg(ap, double);
                len = fmt_float(tmp, val, prec, *fmt);
                break;
            }
            default:
                fb_putc(&fb, '%');
                fb_putc(&fb, *fmt);
                fmt++;
                continue;
            }

            /* Output with padding (for non-string conversions) */
            {
                char padchar = (zero_pad && !left_align) ? '0' : ' ';
                if (!left_align) fb_pad(&fb, padchar, width - len);
                fb_puts(&fb, tmp, len);
                if (left_align) fb_pad(&fb, ' ', width - len);
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
