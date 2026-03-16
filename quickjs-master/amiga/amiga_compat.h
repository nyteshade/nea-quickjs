/*
 * amiga_compat.h -- AmigaOS / SAS-C 6.58 compatibility layer for QuickJS
 *
 * Include this via IDIR in the SAS/C invocation so it is found before
 * any system headers.  It patches over:
 *
 *   - GCC __attribute__ and __builtin_* extensions
 *   - C99 inline / restrict keywords
 *   - likely() / unlikely() branch hints
 *   - DIRECT_DISPATCH (computed gotos) disabled
 *   - CONFIG_ATOMICS disabled
 *   - gettimeofday() emulated via AmigaOS timer.device
 *   - sys/time.h stub (included here so quickjs.c's #include resolves)
 *   - Basic POSIX errno values missing from SAS/C
 */
#ifndef _AMIGA_COMPAT_H
#define _AMIGA_COMPAT_H

/* -----------------------------------------------------------------------
 * Compiler identification guard
 * --------------------------------------------------------------------- */
#ifndef __SASC__
#warning "amiga_compat.h included on a non-SAS/C compiler"
#endif

/* -----------------------------------------------------------------------
 * C99 keywords not in C89 SAS/C
 * --------------------------------------------------------------------- */
#define inline    __inline
#define restrict  /* empty */

/* -----------------------------------------------------------------------
 * GCC __attribute__ -- silently discard all forms
 * --------------------------------------------------------------------- */
#define __attribute__(x)          /* empty */
#define __attribute(x)            /* empty */
#define __extension__             /* empty */

/* -----------------------------------------------------------------------
 * GCC branch prediction hints
 * --------------------------------------------------------------------- */
#define likely(x)    (x)
#define unlikely(x)  (x)

/* -----------------------------------------------------------------------
 * no_inline / __maybe_unused helpers (used in cutils.h)
 * --------------------------------------------------------------------- */
#define no_inline                 /* empty -- SAS/C inlines conservatively */
#define __maybe_unused            /* empty */
#define __force_inline  __inline

/* -----------------------------------------------------------------------
 * __builtin_clz / __builtin_ctz  (count leading/trailing zeros)
 *
 * 68020 has BFFFO (bit-field find first one) but SAS/C doesn't expose it
 * as a builtin.  Provide portable C89 fallbacks; performance is acceptable
 * since these are only used in hash/allocation hot paths.
 *
 * These are only defined under SAS/C (__SASC__) to avoid colliding with
 * the real GCC/Clang builtins when cross-checking on a host compiler.
 * --------------------------------------------------------------------- */
#ifdef __SASC__

static __inline int __builtin_clz(unsigned int x)
{
    int n = 0;
    if (x == 0) return 32;
    if ((x & 0xFFFF0000UL) == 0) { n += 16; x <<= 16; }
    if ((x & 0xFF000000UL) == 0) { n +=  8; x <<=  8; }
    if ((x & 0xF0000000UL) == 0) { n +=  4; x <<=  4; }
    if ((x & 0xC0000000UL) == 0) { n +=  2; x <<=  2; }
    if ((x & 0x80000000UL) == 0) { n +=  1; }
    return n;
}

static __inline int __builtin_clzl(unsigned long x)
{
    return __builtin_clz((unsigned int)x);
}

static __inline int __builtin_clzll(unsigned long long x)
{
    if ((x >> 32) != 0) return __builtin_clz((unsigned int)(x >> 32));
    return 32 + __builtin_clz((unsigned int)x);
}

static __inline int __builtin_ctz(unsigned int x)
{
    int n = 0;
    if (x == 0) return 32;
    if ((x & 0x0000FFFFUL) == 0) { n += 16; x >>= 16; }
    if ((x & 0x000000FFUL) == 0) { n +=  8; x >>=  8; }
    if ((x & 0x0000000FUL) == 0) { n +=  4; x >>=  4; }
    if ((x & 0x00000003UL) == 0) { n +=  2; x >>=  2; }
    if ((x & 0x00000001UL) == 0) { n +=  1; }
    return n;
}

static __inline int __builtin_ctzll(unsigned long long x)
{
    if ((unsigned int)x != 0) return __builtin_ctz((unsigned int)x);
    return 32 + __builtin_ctz((unsigned int)(x >> 32));
}

#define __builtin_ctzl(x)  __builtin_ctz((unsigned int)(x))

#endif /* __SASC__ */

/* -----------------------------------------------------------------------
 * Force DIRECT_DISPATCH off (no computed gotos in SAS/C)
 * Must appear before quickjs.c's own check.
 * --------------------------------------------------------------------- */
#define DIRECT_DISPATCH  0

/* -----------------------------------------------------------------------
 * Disable C11 atomics (no <stdatomic.h> in SAS/C)
 * The condition in quickjs.c is:
 *   !defined(__TINYC__) && !defined(EMSCRIPTEN) && !defined(__wasi__)
 *     && !__STDC_NO_ATOMICS__ && !defined(__DJGPP)
 * Defining __STDC_NO_ATOMICS__ is the cleanest knob.
 * --------------------------------------------------------------------- */
#define __STDC_NO_ATOMICS__  1

/* -----------------------------------------------------------------------
 * sys/time.h stub -- define struct timeval and gettimeofday()
 *
 * AmigaOS provides timer.device; we open it once and cache the result.
 * For a minimal first build we use dos.library DateStamp which gives
 * 1/50s resolution, sufficient for JS timing.
 * --------------------------------------------------------------------- */
#ifndef _SYS_TIME_H
#define _SYS_TIME_H

struct timeval {
    long tv_sec;
    long tv_usec;
};

struct timezone {
    int tz_minuteswest;
    int tz_dsttime;
};

/* Implemented in amiga_compat.c */
int gettimeofday(struct timeval *tv, struct timezone *tz);

#endif /* _SYS_TIME_H */

/* -----------------------------------------------------------------------
 * Stub out malloc_usable_size (not available on AmigaOS)
 * --------------------------------------------------------------------- */
#define malloc_usable_size(p)  0

/* -----------------------------------------------------------------------
 * POSIX errno values that SAS/C may not define
 * (SAS/C does define most standard ones; fill gaps as needed)
 * --------------------------------------------------------------------- */
#ifndef ENOSYS
#define ENOSYS  89
#endif
#ifndef EINTR
#define EINTR   4
#endif
#ifndef EAGAIN
#define EAGAIN  11
#endif
#ifndef ENOTSUP
#define ENOTSUP 45
#endif

/* -----------------------------------------------------------------------
 * _Static_assert shim (C11 feature)
 * --------------------------------------------------------------------- */
#ifndef _Static_assert
#define _Static_assert(cond, msg) \
    typedef char _static_assert_[(cond) ? 1 : -1]
#endif

/* -----------------------------------------------------------------------
 * __typeof__ -- SAS/C doesn't have it; used rarely in quickjs.c
 * Replace with explicit casts where needed; this define at least
 * prevents hard errors in places where the type is obvious.
 * WARNING: this is a partial workaround only.
 * --------------------------------------------------------------------- */
/* #define __typeof__(x)  int */ /* uncomment only if needed */

#endif /* _AMIGA_COMPAT_H */
