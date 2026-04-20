/*
 * amiga_ffi.c -- Q1 AmigaOS library FFI for QuickJS.
 *
 * Exposes low-level library access to JS via globalThis.__qjs_amiga_*:
 *   openLibrary / closeLibrary  (exec OpenLibrary/CloseLibrary wrappers)
 *   call(lib, lvo, regs)         (generic m68k register-level dispatch via
 *                                 amiga_ffi_call.s)
 *   peek/poke 8/16/32            (direct memory access)
 *   peekString/pokeString        (NUL-terminated ASCII)
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
 * peekString / pokeString — NUL-terminated ASCII.
 * ----------------------------------------------------------------- */

static JSValue js_amiga_peekString(JSContext *ctx, JSValueConst this_val,
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

static JSValue js_amiga_pokeString(JSContext *ctx, JSValueConst this_val,
                                   int argc, JSValueConst *argv)
{
    ULONG addr;
    const char *s;
    size_t slen;
    size_t i;
    volatile UBYTE *p;

    if (argc < 2) return JS_ThrowTypeError(ctx, "pokeString: (addr, str)");
    if (js_to_uint32_strict(ctx, argv[0], &addr)) return JS_EXCEPTION;
    s = JS_ToCStringLen(ctx, &slen, argv[1]);
    if (!s) return JS_EXCEPTION;

    p = (volatile UBYTE*)addr;
    for (i = 0; i < slen; i++) p[i] = (UBYTE)s[i];
    p[slen] = 0;
    JS_FreeCString(ctx, s);
    return JS_NewInt64(ctx, (int64_t)(slen + 1));
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
 * calls class->cl_Dispatcher via the Hook convention (A0=hook,
 * A2=obj, A1=msg). The asm trampoline lives in amiga_boopsi_call.s.
 *
 * JS call: __qjs_amiga_doMethod(objPtr, msgPtr) → result
 *
 * struct IClass layout (intuition/classes.h, 2-byte aligned):
 *   +0   cl_Node (struct Node, 14 bytes)
 *  +14   cl_SuperClass (struct IClass *, 4)
 *  +18   cl_ObjectSize (UWORD, 2)
 *  +20   cl_InstOffset (UWORD, 2)
 *  +22   cl_InstSize   (UWORD, 2)
 *  +24   cl_SubclassCount (UWORD, 2)
 *  +26   cl_ObjectCount   (UWORD, 2)
 *  +28   cl_Flags   (ULONG, 4)
 *  +32   cl_UserData (ULONG, 4)
 *  +36   cl_Dispatcher (struct Hook) — 20 bytes
 *
 * struct Hook layout (utility/hooks.h):
 *   +0   h_MinNode (8 bytes)
 *   +8   h_Entry   (ULONG (*)(), 4)
 *  +12   h_SubEntry (4)
 *  +16   h_Data    (APTR, 4)
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

    /* cl_Dispatcher is a struct Hook at offset +36 into IClass. */
    hook = (APTR)((UBYTE *)cl + 36);

    /* h_Entry (offset +8 into Hook) is the dispatcher fn ptr. */
    h_entry = *((ULONG *)((UBYTE *)hook + 8));
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

void qjs_install_amiga_ffi_global(JSContext *ctx)
{
    JSValue global, fn;
    global = JS_GetGlobalObject(ctx);

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
