/*
 * amiga_compat_vbcc.h -- AmigaOS / VBCC compatibility layer for QuickJS
 *
 * Include this before any engine headers when compiling with VBCC.
 * Much simpler than the SAS/C layer because VBCC has:
 *   - Real 64-bit long long / int64_t
 *   - C99 variadic macros (__VA_ARGS__)
 *   - No identifier length limit
 *   - Proper stdint.h, stdbool.h, math.h with NAN/INFINITY
 *
 * What it still needs to patch:
 *   - GCC __attribute__ and __builtin_* extensions
 *   - computed gotos (DIRECT_DISPATCH)
 *   - C11 atomics (disabled)
 *   - sys/time.h (provided as stub in include/sys/time.h)
 *   - gettimeofday() (impl in amiga_compat_vbcc.c)
 *   - malloc_usable_size (not on AmigaOS)
 *   - _Static_assert (C11)
 */
#ifndef _AMIGA_COMPAT_VBCC_H
#define _AMIGA_COMPAT_VBCC_H

/* -----------------------------------------------------------------------
 * Compiler identification guard
 * --------------------------------------------------------------------- */
#ifndef __VBCC__
#warning "amiga_compat_vbcc.h included on a non-VBCC compiler"
#endif

/* -----------------------------------------------------------------------
 * Disable assert() — same rationale as SAS/C build: avoid shutdown
 * assertions that may fail due to library teardown ordering.
 * --------------------------------------------------------------------- */
#define NDEBUG 1

/* -----------------------------------------------------------------------
 * Tell AmigaOS timer.h to use TimeVal/TimeRequest instead of timeval,
 * avoiding conflict with our POSIX struct timeval definition.
 * Must be defined before any AmigaOS header that includes devices/timer.h.
 * --------------------------------------------------------------------- */
#define __USE_NEW_TIMEVAL__ 1

/* -----------------------------------------------------------------------
 * GCC __attribute__ -- silently discard all forms
 * VBCC does not support GCC attribute syntax.
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
#define no_inline                 /* empty */
#define __maybe_unused            /* empty */
#define __force_inline  static inline

/* -----------------------------------------------------------------------
 * __builtin_clz / __builtin_ctz  (count leading/trailing zeros)
 *
 * VBCC does not provide GCC builtins. Provide portable C fallbacks.
 * --------------------------------------------------------------------- */
static inline int __builtin_clz(unsigned int x)
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

static inline int __builtin_clzl(unsigned long x)
{
    return __builtin_clz((unsigned int)x);
}

static inline int __builtin_clzll(unsigned long long x)
{
    if ((x >> 32) != 0) return __builtin_clz((unsigned int)(x >> 32));
    return 32 + __builtin_clz((unsigned int)x);
}

static inline int __builtin_ctz(unsigned int x)
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

static inline int __builtin_ctzll(unsigned long long x)
{
    if ((unsigned int)x != 0) return __builtin_ctz((unsigned int)x);
    return 32 + __builtin_ctz((unsigned int)(x >> 32));
}

#define __builtin_ctzl(x)  __builtin_ctz((unsigned int)(x))

/* -----------------------------------------------------------------------
 * DIRECT_DISPATCH — disabled in quickjs.c via __VBCC__ guard.
 * Do NOT define here to avoid redefinition conflict.
 * --------------------------------------------------------------------- */

/* -----------------------------------------------------------------------
 * NAN_BOXING: let quickjs.h auto-detect.
 * VBCC has real 64-bit int64_t, so NAN boxing works on 32-bit m68k.
 * The auto-detect (INTPTR_MAX < INT64_MAX) will enable it.
 * Force JS_NAN_BOXING=0 here if NAN boxing causes issues.
 * --------------------------------------------------------------------- */

/* -----------------------------------------------------------------------
 * Disable C11 atomics (no <stdatomic.h> in VBCC for m68k)
 * --------------------------------------------------------------------- */
#define __STDC_NO_ATOMICS__  1

/* -----------------------------------------------------------------------
 * sys/time.h — provided by VBCC posixlib ($VBCC/posixlib/include/).
 * Include it here so cutils.h and quickjs.c find struct timeval.
 * Compile with -I$VBCC/posixlib/include to find it.
 * --------------------------------------------------------------------- */
#include <sys/time.h>

/* -----------------------------------------------------------------------
 * Stub out malloc_usable_size (not available on AmigaOS)
 * --------------------------------------------------------------------- */
#define malloc_usable_size(p)  0

/* -----------------------------------------------------------------------
 * _Static_assert shim (C11 feature)
 * --------------------------------------------------------------------- */
#ifndef _Static_assert
#define _Static_assert(cond, msg) \
    typedef char _static_assert_[(cond) ? 1 : -1]
#endif

/* -----------------------------------------------------------------------
 * POSIX ssize_t — not provided by VBCC's AmigaOS headers
 * --------------------------------------------------------------------- */
#include <stddef.h>
#ifndef _SSIZE_T_DEFINED
#define _SSIZE_T_DEFINED
typedef long ssize_t;
#endif

/* -----------------------------------------------------------------------
 * alloca() — VBCC does NOT support alloca as a compiler intrinsic.
 * Replaced with AllocVec via SysBase at address 4. These are
 * short-lived allocations freed before the calling function returns.
 * Note: these leak if not explicitly freed — the engine has been
 * patched to free them where needed.
 * --------------------------------------------------------------------- */
void *_vbcc_alloca(unsigned long size);
#define alloca(size) _vbcc_alloca(size)

/* -----------------------------------------------------------------------
 * POSIX time functions — provided by VBCC posixlib.
 * Compile with -I$VBCC/posixlib/include to get declarations.
 * Link with $VBCC/posixlib/AmigaOS3/posix.lib for implementations.
 * --------------------------------------------------------------------- */

/* -----------------------------------------------------------------------
 * Static array parameter syntax [static n] — VBCC may not support it
 * --------------------------------------------------------------------- */
/* Handled in cutils.h via minimum_length() macro */

#endif /* _AMIGA_COMPAT_VBCC_H */
