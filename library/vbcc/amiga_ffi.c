/*
 * amiga_ffi.c -- Q1 AmigaOS library FFI for QuickJS.
 *
 * Exposes low-level library access to JS via globalThis.__qjs_amiga_*:
 *   openLibrary / closeLibrary  (exec OpenLibrary/CloseLibrary wrappers)
 *   call(lib, lvo, regs)         (generic m68k register-level dispatch via
 *                                 amiga_ffi_call.s)
 *   peek/poke 8/16/32            (direct memory access)
 *   peekString/pokeString        (NUL-terminated Latin-1)
 *   peekStringUTF8/pokeStringUTF8 (NUL-terminated UTF-8)
 *   allocMem/freeMem             (exec MemF_PUBLIC/MEMF_CLEAR)
 *   makeTags                     (TagItem array builder)
 *
 * extended.js wraps these in a `globalThis.amiga` API with LVO
 * constant tables for exec/dos/intuition/graphics/gadtools.
 *
 * Library version: 0.124.  Landing 2026-04-19.  See
 * docs/superpowers/specs/2026-04-19-q1-amiga-ffi-design.md.
 */

#include "amiga_compat_vbcc.h"
#include <exec/types.h>
#include <exec/memory.h>
#include <proto/exec.h>
#include <exec/execbase.h>

#include "quickjs.h"

/* Declared in qjsfuncs.c / provided by the shared library init. */
extern struct Library *DOSBase;

/* The asm trampoline in amiga_ffi_call.s.  One function handles every
 * library call regardless of register signature. */
struct AmigaRegs {
    ULONG d0, d1, d2, d3;
    APTR  a0, a1, a2, a3;
};

extern ULONG qjs_amiga_trampoline(APTR lib, LONG lvo, struct AmigaRegs *regs);

/* The BOOPSI dispatcher trampoline in amiga_boopsi_call.s. Hands the
 * class's Hook off in A0, the object in A2, the message in A1, then
 * JSRs through h_Entry. Powers IDoMethod for the JS amiga.doMethod
 * primitive. */
extern ULONG qjs_boopsi_dispatch(APTR hook, APTR obj, APTR msg);

/* ------------------------------------------------------------------
 * Small helpers.
 * ----------------------------------------------------------------- */

/* Convert a JSValue to an unsigned 32-bit pointer-sized integer.
 * Returns -1 on conversion failure (after throwing).
 *
 * Uses JS_ToInt32 (not JS_ToInt64) to avoid VBCC m68k softfloat quirk
 * where `(uint32_t)(int64_t)` truncation mis-returns 0 for positive
 * int64 values in [2^31, 2^32). Observed at library 0.124 in makeTags
 * with WA_Left = 0x80000064. JS_ToInt32 is spec-defined as mod 2^32
 * with signed interpretation; reinterpreting int32 as uint32 preserves
 * all 32 bits. */
static int js_to_uint32_strict(JSContext *ctx, JSValueConst v, ULONG *out)
{
    int32_t n;
    if (JS_ToInt32(ctx, &n, v)) return -1;
    *out = (ULONG)(uint32_t)n;
    return 0;
}

/* ------------------------------------------------------------------
 * openLibrary / closeLibrary
 * ----------------------------------------------------------------- */

static JSValue js_amiga_openLibrary(JSContext *ctx, JSValueConst this_val,
                                    int argc, JSValueConst *argv)
{
    const char *name;
    int64_t version = 0;
    struct Library *lib;

    if (argc < 1) return JS_ThrowTypeError(ctx, "openLibrary: name required");
    name = JS_ToCString(ctx, argv[0]);
    if (!name) return JS_EXCEPTION;
    if (argc >= 2) {
        if (JS_ToInt64(ctx, &version, argv[1])) {
            JS_FreeCString(ctx, name);
            return JS_EXCEPTION;
        }
    }

    lib = OpenLibrary((STRPTR)name, (ULONG)version);
    JS_FreeCString(ctx, name);
    return JS_NewInt64(ctx, (int64_t)(uint32_t)lib);
}

static JSValue js_amiga_closeLibrary(JSContext *ctx, JSValueConst this_val,
                                     int argc, JSValueConst *argv)
{
    ULONG lib_addr = 0;
    if (argc < 1) return JS_UNDEFINED;
    if (js_to_uint32_strict(ctx, argv[0], &lib_addr)) return JS_EXCEPTION;
    if (lib_addr) CloseLibrary((struct Library *)lib_addr);
    return JS_UNDEFINED;
}

/* ------------------------------------------------------------------
 * Generic library call via the asm trampoline.
 *
 * JS call: __qjs_amiga_call(libPtr, lvo, regsObject)
 *   - regsObject is a plain JS object with optional d0..d3, a0..a3
 *     numeric fields.  Missing fields default to 0.
 * ----------------------------------------------------------------- */

static int fill_reg_from_prop(JSContext *ctx, JSValueConst obj,
                              const char *name, ULONG *out)
{
    JSValue v;
    int32_t n;
    v = JS_GetPropertyStr(ctx, obj, name);
    if (JS_IsException(v)) return -1;
    if (JS_IsUndefined(v) || JS_IsNull(v)) {
        *out = 0;
        JS_FreeValue(ctx, v);
        return 0;
    }
    /* JS_ToInt32 (not Int64) per the note on js_to_uint32_strict. */
    if (JS_ToInt32(ctx, &n, v)) {
        JS_FreeValue(ctx, v);
        return -1;
    }
    JS_FreeValue(ctx, v);
    *out = (ULONG)(uint32_t)n;
    return 0;
}

static JSValue js_amiga_call(JSContext *ctx, JSValueConst this_val,
                             int argc, JSValueConst *argv)
{
    ULONG lib_addr = 0;
    int64_t lvo = 0;
    struct AmigaRegs regs;
    ULONG result;

    if (argc < 2) return JS_ThrowTypeError(ctx,
                    "call: (lib, lvo, regs?) required");

    if (js_to_uint32_strict(ctx, argv[0], &lib_addr)) return JS_EXCEPTION;
    if (JS_ToInt64(ctx, &lvo, argv[1])) return JS_EXCEPTION;
    if (lib_addr == 0) return JS_ThrowTypeError(ctx,
                    "call: lib pointer is 0 (did openLibrary fail?)");

    /* Zero-init: JS caller may pass only a subset of registers. */
    regs.d0 = regs.d1 = regs.d2 = regs.d3 = 0;
    regs.a0 = regs.a1 = regs.a2 = regs.a3 = NULL;

    if (argc >= 3 && JS_IsObject(argv[2])) {
        if (fill_reg_from_prop(ctx, argv[2], "d0", &regs.d0)) return JS_EXCEPTION;
        if (fill_reg_from_prop(ctx, argv[2], "d1", &regs.d1)) return JS_EXCEPTION;
        if (fill_reg_from_prop(ctx, argv[2], "d2", &regs.d2)) return JS_EXCEPTION;
        if (fill_reg_from_prop(ctx, argv[2], "d3", &regs.d3)) return JS_EXCEPTION;
        if (fill_reg_from_prop(ctx, argv[2], "a0", (ULONG*)&regs.a0)) return JS_EXCEPTION;
        if (fill_reg_from_prop(ctx, argv[2], "a1", (ULONG*)&regs.a1)) return JS_EXCEPTION;
        if (fill_reg_from_prop(ctx, argv[2], "a2", (ULONG*)&regs.a2)) return JS_EXCEPTION;
        if (fill_reg_from_prop(ctx, argv[2], "a3", (ULONG*)&regs.a3)) return JS_EXCEPTION;
    }

    result = qjs_amiga_trampoline((APTR)lib_addr, (LONG)lvo, &regs);
    return JS_NewInt64(ctx, (int64_t)(uint32_t)result);
}

/* ------------------------------------------------------------------
 * peek / poke 8/16/32.
 *
 * These are unchecked — bad addresses crash the Amiga.  Documented
 * risk per the roadmap; matches NodeAmiga convention.
 * ----------------------------------------------------------------- */

static JSValue js_amiga_peek8(JSContext *ctx, JSValueConst this_val,
                              int argc, JSValueConst *argv)
{
    ULONG addr;
    if (argc < 1 || js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    return JS_NewInt32(ctx, (int32_t)(*(volatile UBYTE*)addr));
}

static JSValue js_amiga_peek16(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    ULONG addr;
    if (argc < 1 || js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    return JS_NewInt32(ctx, (int32_t)(*(volatile UWORD*)addr));
}

static JSValue js_amiga_peek32(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    ULONG addr;
    if (argc < 1 || js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    return JS_NewInt64(ctx, (int64_t)(uint32_t)(*(volatile ULONG*)addr));
}

static JSValue js_amiga_poke8(JSContext *ctx, JSValueConst this_val,
                              int argc, JSValueConst *argv)
{
    ULONG addr, val;
    if (argc < 2) return JS_ThrowTypeError(ctx, "poke8: (addr, val)");
    if (js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    if (js_to_uint32_strict(ctx, argv[1], &val))  return JS_EXCEPTION;
    *(volatile UBYTE*)addr = (UBYTE)val;
    return JS_UNDEFINED;
}

static JSValue js_amiga_poke16(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    ULONG addr, val;
    if (argc < 2) return JS_ThrowTypeError(ctx, "poke16: (addr, val)");
    if (js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    if (js_to_uint32_strict(ctx, argv[1], &val))  return JS_EXCEPTION;
    *(volatile UWORD*)addr = (UWORD)val;
    return JS_UNDEFINED;
}

static JSValue js_amiga_poke32(JSContext *ctx, JSValueConst this_val,
                               int argc, JSValueConst *argv)
{
    ULONG addr, val;
    if (argc < 2) return JS_ThrowTypeError(ctx, "poke32: (addr, val)");
    if (js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    if (js_to_uint32_strict(ctx, argv[1], &val))  return JS_EXCEPTION;
    *(volatile ULONG*)addr = val;
    return JS_UNDEFINED;
}

/* ------------------------------------------------------------------
 * Strings.
 *
 * AmigaOS text is one byte per character (ISO 8859-1, "Latin-1").
 * JavaScript strings are UTF-16, and QuickJS hands them to C as UTF-8,
 * where any character above 127 takes two or more bytes.
 *
 *   peekString / pokeString          Latin-1. One byte per JS string
 *                                    unit, always, so a string of
 *                                    str.length units needs exactly
 *                                    str.length + 1 bytes. A character
 *                                    above 255 is written as '?'.
 *   peekStringUTF8 / pokeStringUTF8  UTF-8, for libraries that want
 *                                    it. Size the buffer with the
 *                                    JS-side amiga.utf8Length(str) + 1.
 *
 * Until 0.216 pokeString wrote the UTF-8 bytes while every caller
 * allocated str.length + 1, so one non-ASCII character overran the
 * buffer.
 * ----------------------------------------------------------------- */

/* Decode one UTF-8 sequence starting at s[*pi] (i < slen). Advances
 * *pi. Returns the code point, or 0xFFFD for a malformed sequence
 * (consuming one byte). */
static ULONG utf8_next(const UBYTE *s, size_t slen, size_t *pi)
{
    size_t i = *pi;
    ULONG c = s[i];
    int need, k;

    if (c < 0x80)       { *pi = i + 1; return c; }
    else if (c >= 0xF0 && c < 0xF8) { need = 3; c &= 0x07; }
    else if (c >= 0xE0) { need = 2; c &= 0x0F; }
    else if (c >= 0xC0) { need = 1; c &= 0x1F; }
    else                { *pi = i + 1; return 0xFFFD; }

    /* i < slen, so slen - 1 - i cannot wrap. */
    if ((size_t)need > slen - 1 - i) { *pi = i + 1; return 0xFFFD; }
    for (k = 1; k <= need; k++) {
        ULONG cc = s[i + k];
        if ((cc & 0xC0) != 0x80) { *pi = i + 1; return 0xFFFD; }
        c = (c << 6) | (cc & 0x3F);
    }
    *pi = i + need + 1;
    return c;
}

/* peekString(addr, maxLen) — read NUL-terminated Latin-1. */
static JSValue js_amiga_peekString(JSContext *ctx, JSValueConst this_val,
                                   int argc, JSValueConst *argv)
{
    ULONG addr;
    int64_t maxLen = 4096;
    const volatile UBYTE *p;
    ULONG len, i, j;
    char *buf;
    JSValue result;

    if (argc < 1 || js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    if (argc >= 2 && JS_ToInt64(ctx, &maxLen, argv[1])) return JS_EXCEPTION;
    if (maxLen < 0) maxLen = 0;
    if (addr == 0) return JS_NewStringLen(ctx, "", 0);

    p = (const volatile UBYTE*)addr;
    len = 0;
    while (len < (ULONG)maxLen && p[len] != 0) len++;
    if (len == 0) return JS_NewStringLen(ctx, "", 0);

    /* Latin-1 -> UTF-8: a byte above 127 becomes two bytes. */
    buf = (char *)js_malloc(ctx, (size_t)len * 2 + 1);
    if (!buf) return JS_EXCEPTION;
    j = 0;
    for (i = 0; i < len; i++) {
        UBYTE c = p[i];
        if (c < 0x80) {
            buf[j++] = (char)c;
        } else {
            buf[j++] = (char)(0xC0 | (c >> 6));
            buf[j++] = (char)(0x80 | (c & 0x3F));
        }
    }
    result = JS_NewStringLen(ctx, buf, j);
    js_free(ctx, buf);
    return result;
}

/* pokeString(addr, str) — write Latin-1 plus a NUL. Writes exactly
 * str.length + 1 bytes and returns that count. */
static JSValue js_amiga_pokeString(JSContext *ctx, JSValueConst this_val,
                                   int argc, JSValueConst *argv)
{
    ULONG addr;
    const char *s;
    size_t slen;
    size_t i;
    ULONG out;
    volatile UBYTE *p;

    if (argc < 2) return JS_ThrowTypeError(ctx, "pokeString: (addr, str)");
    if (js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    if (addr == 0) return JS_ThrowTypeError(ctx, "pokeString: addr is 0");
    s = JS_ToCStringLen(ctx, &slen, argv[1]);
    if (!s) return JS_EXCEPTION;

    p = (volatile UBYTE*)addr;
    i = 0;
    out = 0;
    while (i < slen) {
        ULONG c = utf8_next((const UBYTE *)s, slen, &i);
        if (c <= 0xFF) {
            p[out++] = (UBYTE)c;
        } else if (c > 0xFFFF) {
            /* Two UTF-16 units in the JS string: keep the byte count
             * equal to str.length. */
            p[out++] = '?';
            p[out++] = '?';
        } else {
            p[out++] = '?';
        }
    }
    p[out] = 0;
    JS_FreeCString(ctx, s);
    return JS_NewInt32(ctx, (int32_t)(out + 1));
}

/* peekStringUTF8(addr, maxLen) — read NUL-terminated UTF-8 bytes. */
static JSValue js_amiga_peekStringUTF8(JSContext *ctx, JSValueConst this_val,
                                       int argc, JSValueConst *argv)
{
    ULONG addr;
    int64_t maxLen = 4096;
    const volatile UBYTE *p;
    ULONG len;

    if (argc < 1 || js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    if (argc >= 2 && JS_ToInt64(ctx, &maxLen, argv[1])) return JS_EXCEPTION;
    if (maxLen < 0) maxLen = 0;
    if (addr == 0) return JS_NewStringLen(ctx, "", 0);

    p = (const volatile UBYTE*)addr;
    len = 0;
    while (len < (ULONG)maxLen && p[len] != 0) len++;
    return JS_NewStringLen(ctx, (const char*)addr, len);
}

/* pokeStringUTF8(addr, str, capacity) — write UTF-8 plus a NUL into a
 * buffer of `capacity` bytes. Throws RangeError, writing nothing, if
 * the bytes and the NUL do not fit. Returns the bytes written,
 * including the NUL. */
static JSValue js_amiga_pokeStringUTF8(JSContext *ctx, JSValueConst this_val,
                                       int argc, JSValueConst *argv)
{
    ULONG addr;
    int32_t capacity;
    const char *s;
    size_t slen;
    size_t i;
    volatile UBYTE *p;

    if (argc < 3) return JS_ThrowTypeError(ctx,
                    "pokeStringUTF8: (addr, str, capacity)");
    if (js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    if (addr == 0) return JS_ThrowTypeError(ctx, "pokeStringUTF8: addr is 0");
    if (JS_ToInt32(ctx, &capacity, argv[2])) return JS_EXCEPTION;
    s = JS_ToCStringLen(ctx, &slen, argv[1]);
    if (!s) return JS_EXCEPTION;

    if (capacity < 1 || slen + 1 > (size_t)capacity) {
        JS_FreeCString(ctx, s);
        return JS_ThrowRangeError(ctx,
            "pokeStringUTF8: string does not fit the buffer");
    }

    p = (volatile UBYTE*)addr;
    for (i = 0; i < slen; i++) p[i] = (UBYTE)s[i];
    p[slen] = 0;
    JS_FreeCString(ctx, s);
    return JS_NewInt32(ctx, (int32_t)(slen + 1));
}

/* ------------------------------------------------------------------
 * allocMem / freeMem (exec library).
 * ----------------------------------------------------------------- */

static JSValue js_amiga_allocMem(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    int64_t size;
    int64_t flags = MEMF_PUBLIC | MEMF_CLEAR;
    APTR mem;

    if (argc < 1) return JS_ThrowTypeError(ctx, "allocMem: size required");
    if (JS_ToInt64(ctx, &size, argv[0])) return JS_EXCEPTION;
    if (argc >= 2 && JS_ToInt64(ctx, &flags, argv[1])) return JS_EXCEPTION;
    if (size <= 0) return JS_NewInt64(ctx, 0);

    mem = AllocMem((ULONG)size, (ULONG)flags);
    return JS_NewInt64(ctx, (int64_t)(uint32_t)mem);
}

static JSValue js_amiga_freeMem(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    ULONG addr;
    int64_t size;

    if (argc < 2) return JS_UNDEFINED;
    if (js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    if (JS_ToInt64(ctx, &size, argv[1])) return JS_EXCEPTION;
    if (addr != 0 && size > 0) FreeMem((APTR)addr, (ULONG)size);
    return JS_UNDEFINED;
}

/* ------------------------------------------------------------------
 * makeTags — allocates and populates a TagItem array.
 *
 * JS call: __qjs_amiga_makeTags([[tag, data], [tag, data], ...])
 *   - Terminator (TAG_DONE = 0) auto-appended.
 *   - Allocation size = (pairs.length + 1) * 8 bytes.
 *   - Caller is responsible for freeMem() with the same size
 *     (extended.js's amiga.withTags wraps this automatically).
 *
 * Returns 0 on allocation failure.
 * ----------------------------------------------------------------- */

static JSValue js_amiga_makeTags(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    JSValue arr_len_v;
    uint32_t arr_len, i;
    ULONG bytes;
    volatile ULONG *p;
    APTR mem;

    if (argc < 1 || !JS_IsArray(argv[0]))
        return JS_ThrowTypeError(ctx, "makeTags: array of [tag,data] pairs required");

    arr_len_v = JS_GetPropertyStr(ctx, argv[0], "length");
    if (JS_IsException(arr_len_v)) return JS_EXCEPTION;
    if (JS_ToUint32(ctx, &arr_len, arr_len_v)) {
        JS_FreeValue(ctx, arr_len_v);
        return JS_EXCEPTION;
    }
    JS_FreeValue(ctx, arr_len_v);

    bytes = (arr_len + 1) * 8;  /* each TagItem = 8 bytes; +1 for terminator */
    mem = AllocMem(bytes, MEMF_PUBLIC | MEMF_CLEAR);
    if (!mem) return JS_NewInt64(ctx, 0);

    p = (volatile ULONG*)mem;
    for (i = 0; i < arr_len; i++) {
        JSValue pair, tag_v, data_v;
        int32_t tag32, data32;

        pair = JS_GetPropertyUint32(ctx, argv[0], i);
        if (JS_IsException(pair)) goto fail;
        tag_v  = JS_GetPropertyUint32(ctx, pair, 0);
        data_v = JS_GetPropertyUint32(ctx, pair, 1);
        JS_FreeValue(ctx, pair);
        if (JS_IsException(tag_v) || JS_IsException(data_v)) {
            JS_FreeValue(ctx, tag_v);
            JS_FreeValue(ctx, data_v);
            goto fail;
        }
        /* Use JS_ToInt32 (not JS_ToInt64 + truncate). VBCC m68k softfloat
         * mis-truncates `(uint32_t)(int64_t)` for positive int64 values in
         * [2^31, 2^32) which caused 0.124 test fails on WA_* tags with the
         * high bit set. JS_ToInt32 is spec-defined to do mod 2^32 with
         * signed interpretation; reinterpreting as uint32 preserves bits. */
        if (JS_ToInt32(ctx, &tag32, tag_v) || JS_ToInt32(ctx, &data32, data_v)) {
            JS_FreeValue(ctx, tag_v);
            JS_FreeValue(ctx, data_v);
            goto fail;
        }
        JS_FreeValue(ctx, tag_v);
        JS_FreeValue(ctx, data_v);

        p[i * 2]     = (ULONG)(uint32_t)tag32;
        p[i * 2 + 1] = (ULONG)(uint32_t)data32;
    }
    /* TAG_DONE terminator (AllocMem MEMF_CLEAR already zeroed, but be explicit). */
    p[arr_len * 2]     = 0;
    p[arr_len * 2 + 1] = 0;

    return JS_NewInt64(ctx, (int64_t)(uint32_t)mem);

fail:
    FreeMem(mem, bytes);
    return JS_EXCEPTION;
}

/* ------------------------------------------------------------------
 * doMethod — expand the IDoMethod macro so BOOPSI dispatch works
 * from JS. Reads the object's Class pointer from (obj - 4), then
 * dispatches via the Class's cl_Dispatcher Hook.
 *
 * struct IClass layout (intuition/classes.h:31-42, NDK 3.2R4):
 *   +0   cl_Dispatcher (struct Hook) — 20 bytes (FIRST field)
 *  +20   cl_Reserved   (ULONG, 4)
 *  +24   cl_Super      (struct IClass *, 4)
 *  +28   cl_ID         (STRPTR, 4)
 *  +32   cl_InstOffset (UWORD, 2)
 *  +34   cl_InstSize   (UWORD, 2)
 *  +36   cl_UserData   (ULONG, 4)
 *  ...
 *
 * struct Hook layout (utility/hooks.h):
 *   +0   h_MinNode (struct MinNode, 8 bytes)
 *   +8   h_Entry   (ULONG (*)(), 4) — the dispatcher function
 *  +12   h_SubEntry (ULONG (*)(), 4)
 *  +16   h_Data    (APTR, 4)
 *
 * The Hook address is therefore `cl` itself (first field — same address
 * as the struct). h_Entry lives at cl+8.
 *
 * NOTE: this function had a bug (fixed 0.144) where it computed
 * `hook = cl + 36` and then `h_entry = *(hook + 8)` = *(cl + 44),
 * reading garbage past cl_UserData. Jumping to that garbage address
 * produced a CPU Address Error (Guru 80000003) as soon as any BOOPSI
 * doMethod fired — typically WM_OPEN, since object *construction*
 * goes through Intuition.NewObjectA (library LVO), bypassing this path.
 *
 * Hook convention passed to the asm trampoline: A0=hook, A2=obj, A1=msg.
 *
 * JS call: __qjs_amiga_doMethod(objPtr, msgPtr) → result
 * ----------------------------------------------------------------- */
static JSValue js_amiga_doMethod(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValueConst *argv)
{
    ULONG obj_addr = 0, msg_addr = 0;
    APTR  cl, hook;
    ULONG h_entry, result;

    if (argc < 2) return JS_ThrowTypeError(ctx,
                    "doMethod: (obj, msg) required");

    if (js_to_uint32_strict(ctx, argv[0], &obj_addr)) return JS_EXCEPTION;
    if (js_to_uint32_strict(ctx, argv[1], &msg_addr)) return JS_EXCEPTION;
    if (obj_addr == 0) return JS_NewInt64(ctx, 0);

    /* o_Class = *((APTR *)(obj - 4)); the struct _Object header sits
     * immediately before the exposed object pointer. */
    cl = *((APTR *)(obj_addr - 4));
    if (!cl) return JS_NewInt64(ctx, 0);

    /* cl_Dispatcher is the FIRST field of struct IClass (offset 0), so
     * the Hook and the Class share the same address. h_Entry lives at
     * offset +8 inside the Hook. */
    hook = cl;
    h_entry = *((ULONG *)((UBYTE *)cl + 8));
    if (!h_entry) return JS_NewInt64(ctx, 0);

    result = qjs_boopsi_dispatch(hook, (APTR)obj_addr, (APTR)msg_addr);
    return JS_NewInt64(ctx, (int64_t)(uint32_t)result);
}

/* ------------------------------------------------------------------
 * Install globals.  Called from QJS_InstallAmigaFFIGlobal (asm LVO
 * bridge in qjsfuncs_asm_all.s).
 *
 * We also store the tag-memory size separately: JS callers pass the
 * returned pointer to freeMem(ptr, size).  extended.js's amiga.withTags
 * handles this.
 * ----------------------------------------------------------------- */

extern const unsigned char qjsc_ffi_core[];
extern const unsigned long qjsc_ffi_core_size;
extern const unsigned char qjsc_ffi_boopsi[];
extern const unsigned long qjsc_ffi_boopsi_size;
extern void js_std_eval_binary(JSContext *ctx, const unsigned char *buf,
                               unsigned long buf_len, int flags);

/* __qjs_loadBundle(group) - evaluate one of the FFI bundles in this
 * context. Called once per group by amiga/ffi/lazy.js, which keeps
 * the "already loaded" state.
 *   0  core: enumerations, structs, library wrappers
 *   1  BOOPSI / Reaction classes (lazy.js loads group 0 first) */
static JSValue qjs_load_ffi_bundle(JSContext *ctx, JSValueConst this_val,
                                   int argc, JSValueConst *argv)
{
    int32_t group = -1;

    if (argc < 1 || JS_ToInt32(ctx, &group, argv[0]))
        return JS_EXCEPTION;

    if (group == 0)
        js_std_eval_binary(ctx, qjsc_ffi_core, qjsc_ffi_core_size, 0);
    else if (group == 1)
        js_std_eval_binary(ctx, qjsc_ffi_boopsi, qjsc_ffi_boopsi_size, 0);
    else
        return JS_ThrowRangeError(ctx, "no FFI bundle %d", (int)group);

    return JS_UNDEFINED;
}

/* __qjs_loadFeature(index) - evaluate the install() body of one
 * extended.js feature. The bodies are separate bytecode blobs (see
 * scripts/bundle_extended.py); the script leaves a function in
 * globalThis.__qjs_extInstall, which extended.js collects and calls. */
extern const unsigned char *const qjsc_ext_features[];
extern const unsigned long qjsc_ext_feature_sizes[];
extern const unsigned long qjsc_ext_feature_count;

static JSValue qjs_load_extended_feature(JSContext *ctx, JSValueConst this_val,
                                         int argc, JSValueConst *argv)
{
    int32_t index = -1;

    if (argc < 1 || JS_ToInt32(ctx, &index, argv[0]))
        return JS_EXCEPTION;

    if (index < 0 || (unsigned long)index >= qjsc_ext_feature_count)
        return JS_ThrowRangeError(ctx, "no extended feature %d", (int)index);

    js_std_eval_binary(ctx, qjsc_ext_features[index],
                       qjsc_ext_feature_sizes[index], 0);
    return JS_UNDEFINED;
}

/* ------------------------------------------------------------------
 * Lazy globals
 *
 * Every global of the extended.js features (URL, Buffer, process,
 * console.error, amiga, ...) and of the FFI wrappers (Intuition, Exec,
 * the struct classes, amiga.boopsi, ...) is registered here as a HOST
 * LAZY PROPERTY (JS_DefineHostLazyProperty in quickjs.c): one property
 * slot each, from tables written at build time by
 * scripts/bundle_extended.py and scripts/bundle_ffi.py. No JavaScript
 * runs when a context starts.
 *
 * The first use of such a name makes the engine call qjs_host_lazy
 * with the name's tag:
 *   tag < 1000    an extended.js feature index; handled by the module
 *                 qjsc_extended, evaluated the first time it is needed
 *   tag >= 1000   1000 + an FFI bundle group; handled by the script
 *                 qjsc_ffi_lazy, likewise
 * Each of the two registers a JavaScript handler with
 * __qjs_lazyHandler(slot, fn); the handler gives the name its value.
 *
 * Until 0.230 the same thing was done by evaluating both of those at
 * start-up and putting an accessor on every name, which was half of
 * all start-up work on a 68020.
 *
 * State is kept in a hidden object, globalThis.__qjs_lazy:
 *   handlers    [extended's handler, the FFI stub's handler]
 *   loading     [bool, bool]: a handler's code is being evaluated
 *   originals   what a lazy name replaced, by name: the native fetch,
 *               performance and queueMicrotask, which their features
 *               wrap
 *   attached    true once the FFI names on `amiga` are registered
 * ------------------------------------------------------------------ */
#define LAZY_STATE_NAME  "__qjs_lazy"
#define LAZY_FFI_TAG     1000
#define LAZY_SLOT_EXT    0
#define LAZY_SLOT_FFI    1

extern const unsigned char qjsc_extended[];
extern const unsigned long qjsc_extended_size;
extern const unsigned char qjsc_ffi_lazy[];
extern const unsigned long qjsc_ffi_lazy_size;

extern const char *const qjsc_ext_lazy_names[];
extern const unsigned short qjsc_ext_lazy_tags[];
extern const unsigned long qjsc_ext_lazy_count;

extern const char *const qjsc_ffi_lazy_globals[];
extern const unsigned short qjsc_ffi_lazy_global_tags[];
extern const unsigned long qjsc_ffi_lazy_global_count;

extern const char *const qjsc_ffi_lazy_amiga_paths[];
extern const char *const qjsc_ffi_lazy_amiga_names[];
extern const unsigned short qjsc_ffi_lazy_amiga_tags[];
extern const unsigned long qjsc_ffi_lazy_amiga_count;

/* The hidden state object; a new reference, or an exception. */
static JSValue lazy_state(JSContext *ctx)
{
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue state = JS_GetPropertyStr(ctx, global, LAZY_STATE_NAME);

    JS_FreeValue(ctx, global);
    return state;
}

/* One element of a two-element array member of the state. */
static JSValue lazy_state_slot(JSContext *ctx, const char *member, int slot)
{
    JSValue state = lazy_state(ctx);
    JSValue array = JS_GetPropertyStr(ctx, state, member);
    JSValue value = JS_GetPropertyUint32(ctx, array, (uint32_t)slot);

    JS_FreeValue(ctx, array);
    JS_FreeValue(ctx, state);
    return value;
}

static void lazy_state_set_slot(JSContext *ctx, const char *member, int slot,
                                JSValue value)
{
    JSValue state = lazy_state(ctx);
    JSValue array = JS_GetPropertyStr(ctx, state, member);

    JS_SetPropertyUint32(ctx, array, (uint32_t)slot, value);
    JS_FreeValue(ctx, array);
    JS_FreeValue(ctx, state);
}

/* The object a dotted name lives on and the atom of its last part:
 * "URL" is a property of the global object, "console.error" one of
 * globalThis.console. Returns the object (a new reference), or
 * JS_UNDEFINED if the first part does not name an object. */
static JSValue lazy_target(JSContext *ctx, JSValueConst global,
                           const char *name, JSAtom *atom)
{
    const char *dot = strchr(name, '.');
    JSValue object;
    JSAtom first;

    if (!dot) {
        *atom = JS_NewAtom(ctx, name);
        return JS_DupValue(ctx, global);
    }

    first = JS_NewAtomLen(ctx, name, (size_t)(dot - name));
    object = JS_GetProperty(ctx, global, first);
    JS_FreeAtom(ctx, first);

    if (!JS_IsObject(object)) {
        JS_FreeValue(ctx, object);
        *atom = JS_ATOM_NULL;
        return JS_UNDEFINED;
    }

    *atom = JS_NewAtom(ctx, dot + 1);
    return object;
}

/* The engine calls this when a lazy name is first used. The property
 * already holds undefined; the handler replaces or removes it. */
static int qjs_host_lazy(JSContext *ctx, JSValueConst object, JSAtom prop,
                         uint32_t tag)
{
    int slot = tag >= LAZY_FFI_TAG ? LAZY_SLOT_FFI : LAZY_SLOT_EXT;
    JSValue handler, result, loading;
    JSValue arguments[3];

    handler = lazy_state_slot(ctx, "handlers", slot);

    if (!JS_IsFunction(ctx, handler)) {
        JS_FreeValue(ctx, handler);

        /* A name used by the handler's own code while that is being
         * evaluated (extended.js sets globalThis.qjs, for one): leave
         * the placeholder to it. */
        loading = lazy_state_slot(ctx, "loading", slot);
        if (JS_ToBool(ctx, loading)) {
            JS_FreeValue(ctx, loading);
            return 0;
        }
        JS_FreeValue(ctx, loading);

        lazy_state_set_slot(ctx, "loading", slot, JS_TRUE);
        if (slot == LAZY_SLOT_EXT)
            js_std_eval_binary(ctx, qjsc_extended, qjsc_extended_size, 0);
        else
            js_std_eval_binary(ctx, qjsc_ffi_lazy, qjsc_ffi_lazy_size, 0);
        lazy_state_set_slot(ctx, "loading", slot, JS_FALSE);

        handler = lazy_state_slot(ctx, "handlers", slot);
        if (!JS_IsFunction(ctx, handler)) {
            JS_FreeValue(ctx, handler);
            return 0;
        }
    }

    arguments[0] = JS_NewInt32(ctx, (int32_t)(slot == LAZY_SLOT_FFI
                                              ? tag - LAZY_FFI_TAG : tag));
    arguments[1] = JS_DupValue(ctx, object);
    arguments[2] = JS_AtomToString(ctx, prop);

    result = JS_Call(ctx, handler, JS_UNDEFINED, 3, (JSValueConst *)arguments);

    JS_FreeValue(ctx, arguments[1]);
    JS_FreeValue(ctx, arguments[2]);
    JS_FreeValue(ctx, handler);

    if (JS_IsException(result))
        return -1;

    JS_FreeValue(ctx, result);
    return 0;
}

/* __qjs_lazyHandler(slot, fn) - register the JavaScript handler for
 * the extended features (slot 0) or the FFI bundles (slot 1). It is
 * called as fn(index, object, key). */
static JSValue qjs_lazy_handler(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    int32_t slot = -1;

    if (argc < 2 || JS_ToInt32(ctx, &slot, argv[0]) ||
        slot < 0 || slot > 1 || !JS_IsFunction(ctx, argv[1]))
        return JS_ThrowTypeError(ctx, "__qjs_lazyHandler(slot, function)");

    lazy_state_set_slot(ctx, "handlers", slot, JS_DupValue(ctx, argv[1]));
    return JS_UNDEFINED;
}

/* __qjs_lazyOriginals() - the values lazy names replaced, by name. */
static JSValue qjs_lazy_originals(JSContext *ctx, JSValueConst this_val,
                                  int argc, JSValueConst *argv)
{
    JSValue state = lazy_state(ctx);
    JSValue originals = JS_GetPropertyStr(ctx, state, "originals");

    JS_FreeValue(ctx, state);
    return originals;
}

/* Register the FFI names that live on `amiga` and its per-library
 * tables. Names that already exist are left alone. */
static void lazy_attach_amiga(JSContext *ctx, JSValueConst amiga)
{
    unsigned long index;

    for (index = 0; index < qjsc_ffi_lazy_amiga_count; index++) {
        const char *path = qjsc_ffi_lazy_amiga_paths[index];
        JSValue table;
        JSAtom atom;

        if (path[0] == '\0') {
            table = JS_DupValue(ctx, amiga);
        } else {
            table = JS_GetPropertyStr(ctx, amiga, path);
            if (!JS_IsObject(table)) {
                JS_FreeValue(ctx, table);
                table = JS_NewObject(ctx);
                JS_SetPropertyStr(ctx, amiga, path, JS_DupValue(ctx, table));
            }
        }

        atom = JS_NewAtom(ctx, qjsc_ffi_lazy_amiga_names[index]);
        JS_DefineHostLazyProperty(ctx, table, atom,
                                  qjsc_ffi_lazy_amiga_tags[index]);
        JS_FreeAtom(ctx, atom);
        JS_FreeValue(ctx, table);
    }
}

/* __qjs_lazyAttachFFI() - called by extended.js once its amiga feature
 * has created globalThis.amiga. */
static JSValue qjs_lazy_attach_ffi(JSContext *ctx, JSValueConst this_val,
                                   int argc, JSValueConst *argv)
{
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue amiga = JS_GetPropertyStr(ctx, global, "amiga");
    JSValue state = lazy_state(ctx);

    if (JS_IsObject(amiga)) {
        lazy_attach_amiga(ctx, amiga);
        JS_SetPropertyStr(ctx, state, "attached", JS_TRUE);
    }

    JS_FreeValue(ctx, state);
    JS_FreeValue(ctx, amiga);
    JS_FreeValue(ctx, global);
    return JS_UNDEFINED;
}

/* __qjs_lazyClear(tag) - remove every name that is STILL lazy and has
 * this tag (a feature index, or 1000 + an FFI group), so that the code
 * about to define those names finds them free. Names a script has
 * already used or assigned are no longer lazy and are not touched. */
static JSValue qjs_lazy_clear(JSContext *ctx, JSValueConst this_val,
                              int argc, JSValueConst *argv)
{
    JSValue global, state, attached, amiga, object;
    unsigned long index;
    int32_t tag = -1;
    JSAtom atom;

    if (argc < 1 || JS_ToInt32(ctx, &tag, argv[0]))
        return JS_EXCEPTION;

    global = JS_GetGlobalObject(ctx);

    if (tag < LAZY_FFI_TAG) {
        for (index = 0; index < qjsc_ext_lazy_count; index++) {
            if (qjsc_ext_lazy_tags[index] != tag) continue;

            object = lazy_target(ctx, global, qjsc_ext_lazy_names[index], &atom);
            if (atom != JS_ATOM_NULL) {
                JS_DeleteHostLazyProperty(ctx, object, atom, (uint32_t)tag);
                JS_FreeAtom(ctx, atom);
            }
            JS_FreeValue(ctx, object);
        }
    } else {
        for (index = 0; index < qjsc_ffi_lazy_global_count; index++) {
            if (qjsc_ffi_lazy_global_tags[index] != tag) continue;

            atom = JS_NewAtom(ctx, qjsc_ffi_lazy_globals[index]);
            JS_DeleteHostLazyProperty(ctx, global, atom, (uint32_t)tag);
            JS_FreeAtom(ctx, atom);
        }

        /* `amiga` is only looked at once the names on it have been
         * registered: reading it earlier would itself be a first use
         * of the lazy name `amiga`. */
        state = lazy_state(ctx);
        attached = JS_GetPropertyStr(ctx, state, "attached");
        JS_FreeValue(ctx, state);

        if (JS_ToBool(ctx, attached)) {
            amiga = JS_GetPropertyStr(ctx, global, "amiga");

            for (index = 0; JS_IsObject(amiga) &&
                            index < qjsc_ffi_lazy_amiga_count; index++) {
                const char *path = qjsc_ffi_lazy_amiga_paths[index];

                if (qjsc_ffi_lazy_amiga_tags[index] != tag) continue;

                object = path[0] == '\0' ? JS_DupValue(ctx, amiga)
                                         : JS_GetPropertyStr(ctx, amiga, path);
                if (JS_IsObject(object)) {
                    atom = JS_NewAtom(ctx, qjsc_ffi_lazy_amiga_names[index]);
                    JS_DeleteHostLazyProperty(ctx, object, atom, (uint32_t)tag);
                    JS_FreeAtom(ctx, atom);
                }
                JS_FreeValue(ctx, object);
            }

            JS_FreeValue(ctx, amiga);
        }
        JS_FreeValue(ctx, attached);
    }

    JS_FreeValue(ctx, global);
    return JS_UNDEFINED;
}

/* Date.now(): the clock as a decimal string of milliseconds
 * (__qjs_now_ms_str), converted with the engine's string-to-number
 * code. The engine's own Date.now divides and multiplies 64-bit
 * integers, which VBCC miscompiles; extended.js used to install this
 * replacement in JavaScript at start-up. */
static JSValue qjs_date_now(JSContext *ctx, JSValueConst this_val,
                            int argc, JSValueConst *argv)
{
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue reader = JS_GetPropertyStr(ctx, global, "__qjs_now_ms_str");
    JSValue text, number;

    JS_FreeValue(ctx, global);

    text = JS_Call(ctx, reader, JS_UNDEFINED, 0, NULL);
    JS_FreeValue(ctx, reader);
    if (JS_IsException(text))
        return text;

    number = JS_ToNumber(ctx, text);
    JS_FreeValue(ctx, text);
    return number;
}

/* Called once per context, where extended.js and the FFI stub used to
 * be evaluated. Registers the lazy names and replaces Date.now. */
void qjs_install_lazy_globals(JSContext *ctx)
{
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue state, originals, value, object, date, reader;
    unsigned long index;
    JSAtom atom;

    JS_SetHostLazyPropertyFunc(JS_GetRuntime(ctx), qjs_host_lazy);

    state     = JS_NewObject(ctx);
    originals = JS_NewObject(ctx);

    value = JS_NewArray(ctx);
    JS_SetPropertyUint32(ctx, value, 0, JS_UNDEFINED);
    JS_SetPropertyUint32(ctx, value, 1, JS_UNDEFINED);
    JS_SetPropertyStr(ctx, state, "handlers", value);

    value = JS_NewArray(ctx);
    JS_SetPropertyUint32(ctx, value, 0, JS_FALSE);
    JS_SetPropertyUint32(ctx, value, 1, JS_FALSE);
    JS_SetPropertyStr(ctx, state, "loading", value);

    JS_SetPropertyStr(ctx, state, "originals", JS_DupValue(ctx, originals));
    JS_SetPropertyStr(ctx, state, "attached", JS_FALSE);

    /* hidden: not enumerable, not writable, not configurable */
    JS_DefinePropertyValueStr(ctx, global, LAZY_STATE_NAME, state, 0);

    /* The extended features' names. One that already exists (a native
     * fetch) is remembered and replaced: its feature wraps it. */
    for (index = 0; index < qjsc_ext_lazy_count; index++) {
        const char *name = qjsc_ext_lazy_names[index];

        object = lazy_target(ctx, global, name, &atom);
        if (atom == JS_ATOM_NULL) {
            JS_FreeValue(ctx, object);
            continue;
        }

        if (JS_HasProperty(ctx, object, atom) > 0) {
            value = JS_GetProperty(ctx, object, atom);
            JS_SetPropertyStr(ctx, originals, name, value);
            JS_DeleteProperty(ctx, object, atom, 0);
        }

        JS_DefineHostLazyProperty(ctx, object, atom, qjsc_ext_lazy_tags[index]);
        JS_FreeAtom(ctx, atom);
        JS_FreeValue(ctx, object);
    }

    /* The FFI wrappers' globals. One that already exists is left to
     * whoever defined it, as the bundles themselves do. */
    for (index = 0; index < qjsc_ffi_lazy_global_count; index++) {
        atom = JS_NewAtom(ctx, qjsc_ffi_lazy_globals[index]);
        JS_DefineHostLazyProperty(ctx, global, atom,
                                  qjsc_ffi_lazy_global_tags[index]);
        JS_FreeAtom(ctx, atom);
    }

    reader = JS_GetPropertyStr(ctx, global, "__qjs_now_ms_str");
    if (JS_IsFunction(ctx, reader)) {
        date = JS_GetPropertyStr(ctx, global, "Date");
        JS_SetPropertyStr(ctx, date, "now",
                          JS_NewCFunction(ctx, qjs_date_now, "now", 0));
        JS_FreeValue(ctx, date);
    }
    JS_FreeValue(ctx, reader);

    JS_FreeValue(ctx, originals);
    JS_FreeValue(ctx, global);
}

/* __qjs_memoryUsage() - what this runtime has allocated, as counted by
 * the engine (JS_ComputeMemoryUsage). Sizes are bytes. Used by
 * process.memoryUsage() in extended.js, and by the perf/ scripts to
 * measure heap use per invocation.
 *   mallocSize    bytes obtained from the allocator, with its overhead
 *   mallocCount   live allocations
 *   usedSize      bytes in use by engine data
 *   objects, atoms, strings, shapes, functions   live counts
 *   bytecodeSize  bytes of function bytecode */
static JSValue qjs_memory_usage(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    JSMemoryUsage stats;
    JSValue result;

    JS_ComputeMemoryUsage(JS_GetRuntime(ctx), &stats);

    result = JS_NewObject(ctx);
    if (JS_IsException(result))
        return result;

    /* the fields are int64_t; none can reach 2 GB on this machine */
    JS_SetPropertyStr(ctx, result, "mallocSize",
                      JS_NewInt32(ctx, (int32_t)stats.malloc_size));
    JS_SetPropertyStr(ctx, result, "mallocCount",
                      JS_NewInt32(ctx, (int32_t)stats.malloc_count));
    JS_SetPropertyStr(ctx, result, "usedSize",
                      JS_NewInt32(ctx, (int32_t)stats.memory_used_size));
    JS_SetPropertyStr(ctx, result, "objects",
                      JS_NewInt32(ctx, (int32_t)stats.obj_count));
    JS_SetPropertyStr(ctx, result, "atoms",
                      JS_NewInt32(ctx, (int32_t)stats.atom_count));
    JS_SetPropertyStr(ctx, result, "strings",
                      JS_NewInt32(ctx, (int32_t)stats.str_count));
    JS_SetPropertyStr(ctx, result, "shapes",
                      JS_NewInt32(ctx, (int32_t)stats.shape_count));
    JS_SetPropertyStr(ctx, result, "functions",
                      JS_NewInt32(ctx, (int32_t)stats.js_func_count));
    JS_SetPropertyStr(ctx, result, "bytecodeSize",
                      JS_NewInt32(ctx, (int32_t)stats.js_func_code_size));
    return result;
}

void qjs_install_amiga_ffi_global(JSContext *ctx)
{
    JSValue global, fn;
    global = JS_GetGlobalObject(ctx);

    fn = JS_NewCFunction(ctx, qjs_load_extended_feature, "__qjs_loadFeature",    1);
    JS_SetPropertyStr(ctx, global, "__qjs_loadFeature", fn);
    fn = JS_NewCFunction(ctx, qjs_lazy_handler,      "__qjs_lazyHandler",        2);
    JS_SetPropertyStr(ctx, global, "__qjs_lazyHandler", fn);
    fn = JS_NewCFunction(ctx, qjs_lazy_clear,        "__qjs_lazyClear",          1);
    JS_SetPropertyStr(ctx, global, "__qjs_lazyClear", fn);
    fn = JS_NewCFunction(ctx, qjs_lazy_originals,    "__qjs_lazyOriginals",      0);
    JS_SetPropertyStr(ctx, global, "__qjs_lazyOriginals", fn);
    fn = JS_NewCFunction(ctx, qjs_lazy_attach_ffi,   "__qjs_lazyAttachFFI",      0);
    JS_SetPropertyStr(ctx, global, "__qjs_lazyAttachFFI", fn);
    fn = JS_NewCFunction(ctx, qjs_memory_usage,      "__qjs_memoryUsage",        0);
    JS_SetPropertyStr(ctx, global, "__qjs_memoryUsage", fn);
    fn = JS_NewCFunction(ctx, qjs_load_ffi_bundle,   "__qjs_loadBundle",         1);
    JS_SetPropertyStr(ctx, global, "__qjs_loadBundle", fn);
    fn = JS_NewCFunction(ctx, js_amiga_openLibrary,  "__qjs_amiga_openLibrary",  2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_openLibrary", fn);
    fn = JS_NewCFunction(ctx, js_amiga_closeLibrary, "__qjs_amiga_closeLibrary", 1);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_closeLibrary", fn);
    fn = JS_NewCFunction(ctx, js_amiga_call,         "__qjs_amiga_call",         3);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_call", fn);
    fn = JS_NewCFunction(ctx, js_amiga_peek8,        "__qjs_amiga_peek8",        1);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_peek8",  fn);
    fn = JS_NewCFunction(ctx, js_amiga_peek16,       "__qjs_amiga_peek16",       1);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_peek16", fn);
    fn = JS_NewCFunction(ctx, js_amiga_peek32,       "__qjs_amiga_peek32",       1);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_peek32", fn);
    fn = JS_NewCFunction(ctx, js_amiga_poke8,        "__qjs_amiga_poke8",        2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_poke8",  fn);
    fn = JS_NewCFunction(ctx, js_amiga_poke16,       "__qjs_amiga_poke16",       2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_poke16", fn);
    fn = JS_NewCFunction(ctx, js_amiga_poke32,       "__qjs_amiga_poke32",       2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_poke32", fn);
    fn = JS_NewCFunction(ctx, js_amiga_peekString,   "__qjs_amiga_peekString",   2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_peekString", fn);
    fn = JS_NewCFunction(ctx, js_amiga_pokeString,   "__qjs_amiga_pokeString",   2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_pokeString", fn);
    fn = JS_NewCFunction(ctx, js_amiga_peekStringUTF8, "__qjs_amiga_peekStringUTF8", 2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_peekStringUTF8", fn);
    fn = JS_NewCFunction(ctx, js_amiga_pokeStringUTF8, "__qjs_amiga_pokeStringUTF8", 3);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_pokeStringUTF8", fn);
    fn = JS_NewCFunction(ctx, js_amiga_allocMem,     "__qjs_amiga_allocMem",     2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_allocMem", fn);
    fn = JS_NewCFunction(ctx, js_amiga_freeMem,      "__qjs_amiga_freeMem",      2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_freeMem",  fn);
    fn = JS_NewCFunction(ctx, js_amiga_makeTags,     "__qjs_amiga_makeTags",     1);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_makeTags", fn);
    fn = JS_NewCFunction(ctx, js_amiga_doMethod,     "__qjs_amiga_doMethod",     2);
    JS_SetPropertyStr(ctx, global, "__qjs_amiga_doMethod", fn);

    JS_FreeValue(ctx, global);
}
