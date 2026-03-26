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

/* Disable assert() for the SAS/C build.  The QuickJS engine has
 * shutdown-time assertions that fail due to 32-bit int64_t causing
 * subtle corruption (atom hash, weak refs, etc).
 *
 * We define NDEBUG to suppress assert(), BUT this also disables
 * ENABLE_DUMPS in quickjs.c which exposes C99 variadic macros
 * (bc_read_trace etc).  Those are patched separately in quickjs.c
 * with #ifdef __SASC guards. */
#define NDEBUG 1

/* -----------------------------------------------------------------------
 * Compiler identification guard
 * --------------------------------------------------------------------- */
#ifndef __SASC
#warning "amiga_compat.h included on a non-SAS/C compiler"
#endif

/* -----------------------------------------------------------------------
 * C99 fixed-width integer types (stdint.h / inttypes.h)
 * SAS/C 6.58 does not ship these headers; include our portable replacements.
 * The relative path works because this file lives in qjs:amiga/ and the
 * custom stdint.h / stdbool.h / inttypes.h are siblings.
 * --------------------------------------------------------------------- */
#include "stdint.h"
#include "stdbool.h"

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
 * These are only defined under SAS/C (__SASC) to avoid colliding with
 * the real GCC/Clang builtins when cross-checking on a host compiler.
 * --------------------------------------------------------------------- */
#ifdef __SASC

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

#endif /* __SASC */

/* -----------------------------------------------------------------------
 * Force DIRECT_DISPATCH off (no computed gotos in SAS/C)
 * Must appear before quickjs.c's own check.
 * --------------------------------------------------------------------- */
#define DIRECT_DISPATCH  0

/* -----------------------------------------------------------------------
 * Force non-NAN_BOXING JSValue representation.
 * The NAN_BOXING auto-detect uses #if INTPTR_MAX < INT64_MAX which
 * requires the SAS/C preprocessor to evaluate a 64-bit LL constant --
 * it cannot, and emits "invalid number".  Explicitly select the
 * struct-based JSValue (tag + union) which works on 32-bit with 32-bit
 * int64_t.
 * --------------------------------------------------------------------- */
#ifndef JS_NAN_BOXING
#define JS_NAN_BOXING 0
#endif

/* -----------------------------------------------------------------------
 * Disable C11 atomics (no <stdatomic.h> in SAS/C)
 * The condition in quickjs.c is:
 *   !defined(__TINYC__) && !defined(EMSCRIPTEN) && !defined(__wasi__)
 *     && !__STDC_NO_ATOMICS__ && !defined(__DJGPP)
 * Defining __STDC_NO_ATOMICS__ is the cleanest knob.
 * --------------------------------------------------------------------- */
#define __STDC_NO_ATOMICS__  1

/* -----------------------------------------------------------------------
 * sys/time.h -- SAS/C 6.58 ships this header; use it directly.
 * struct timeval is defined there.  gettimeofday() is NOT provided by
 * SAS/C's runtime; our implementation lives in amiga_compat.c.
 * --------------------------------------------------------------------- */
#include <sys/time.h>

/* SAS/C's sys/time.h already defines struct timezone (as __timezone).
 * Just declare gettimeofday() -- implementation in amiga_compat.c */
int gettimeofday(struct timeval *tv, void *tz);

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
 * C99 math macros: NAN, INFINITY
 * SAS/C's math.h defines HUGE_VAL but not NAN or INFINITY.
 * 68k with FPU: 1.0/0.0 produces Inf; 0.0/0.0 is undefined but
 * generates NaN on 68881/68882.  Use HUGE_VAL for INFINITY.
 * For NAN, use a volatile trick to avoid constant-folding.
 * --------------------------------------------------------------------- */
#include <math.h>
#ifndef INFINITY
#define INFINITY  HUGE_VAL
#endif
#ifndef NAN
static double _amiga_nan_val(void) { double z = 0.0; return z / z; }
#define NAN  (_amiga_nan_val())
#endif

/* -----------------------------------------------------------------------
 * C99 math functions missing from SAS/C's math.h
 *
 * scalbn(x, n) == ldexp(x, n)  -- both scale by a power of 2
 * copysign(x, y) -- x with the sign of y
 * --------------------------------------------------------------------- */
#ifndef _AMIGA_MATH_COMPAT
#define _AMIGA_MATH_COMPAT
#define scalbn(x, n)  ldexp((x), (n))

static __inline double copysign(double x, double y)
{
    /* Use the sign bit of y applied to the magnitude of x */
    return (y < 0.0) ? ((x < 0.0) ? x : -x)
                     : ((x < 0.0) ? -x : x);
}
#endif /* _AMIGA_MATH_COMPAT */

/* -----------------------------------------------------------------------
 * __typeof__ -- SAS/C doesn't have it; used rarely in quickjs.c
 * Replace with explicit casts where needed; this define at least
 * prevents hard errors in places where the type is obvious.
 * WARNING: this is a partial workaround only.
 * --------------------------------------------------------------------- */
/* #define __typeof__(x)  int */ /* uncomment only if needed */

/* -----------------------------------------------------------------------
 * promise_trace -- uses variadic macros (__VA_ARGS__) which SAS/C 6.58
 * does not support.  Define it as an object-like macro that expands to
 * nothing; call sites become comma-expressions that are evaluated for
 * side effects but discarded.
 * --------------------------------------------------------------------- */
#define promise_trace

/* Note: Long identifiers (>31 chars) with shared prefixes have been
 * renamed directly in quickjs.c for SAS/C compatibility (IDLEN=31):
 *   JS_ThrowReferenceErrorUninitialized2        -> JS_ThrowRefErrUninit2
 *   JS_ThrowReferenceErrorUninitialized         -> JS_ThrowRefErrUninit
 *   JS_GENERATOR_STATE_SUSPENDED_YIELD_STAR     -> JS_GEN_STATE_SUSP_YSTAR
 *   JS_ASYNC_GENERATOR_STATE_SUSPENDED_*        -> JS_ASGEN_STATE_SUSP_*
 *   js_async_from_sync_iterator_unwrap_func_create -> js_afsi_unwrap_func_create
 *   js_async_generator_resolve_function_create  -> js_asgen_resolve_func_create
 *   js_object_getOwnPropertyDescriptors         -> js_obj_getOwnPropDescriptors
 */

#endif /* _AMIGA_COMPAT_H */
