/*
 * quickjs_library.c — QuickJS AmigaOS shared library implementation
 *
 * This is the glue code that wraps QuickJS functions for the
 * AmigaOS shared library mechanism. Each LIBQJS_-prefixed function
 * is exposed through the library's jump table as QJS_*.
 *
 * LIBRARY INITIALIZATION:
 *   This file provides custom __UserLibInit/__UserLibCleanup stubs
 *   that do nothing. The library uses DATA=FARONLY (absolute data
 *   references), so the standard libinit.o data copy/relocation
 *   mechanism is not needed — data stays wherever LoadSeg placed it
 *   and absolute addresses are correct after LoadSeg's own relocations.
 *
 * Compile: sc DATA=FARONLY NOSTACKCHECK NOCHKABORT ABSFP IDLEN=80
 * Link:    slink FROM lib:libent.o lib:libinit.o quickjs_library.o ...
 *          TO quickjs.library LIBPREFIX _LIB LIBFD quickjs_lib.fd
 *
 * NAMING CONVENTION:
 *   Implementation:  LIBQJS_FuncName   (C symbol in this file)
 *   External/pragma: QJS_FuncName      (what library users call)
 *   Upstream:        JS_FuncName       (original quickjs.h name)
 *
 * JSVALUE HANDLING:
 *   JSValue is a 12-byte struct on 68k. It cannot be returned in
 *   registers via the library jump table, so functions that upstream
 *   return JSValue instead take a JSValue *result as their first
 *   parameter. JSValueConst parameters become const JSValue pointers.
 *
 * REGISTER CONVENTION:
 *   __saveds __asm on all functions — __asm for register-based parameter
 *   passing (A0-A3 pointers, D0-D7 integers), __saveds to load A4 with
 *   _LinkerDB so that scnb.lib functions (compiled with DATA=NEAR) can
 *   access their internal near-data tables.  Without __saveds, A4 holds
 *   the CALLER's value and scnb.lib reads garbage, causing Guru 80000004.
 *   See quickjs_lib.fd for the exact register assignment per function.
 */

#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

/* QuickJS headers */
#include "cutils.h"
#include "quickjs.h"
#include "quickjs-libc.h"

/* $VER string for the library */
static const char lib_ver[] = "$VER: quickjs.library 0.51 (29.3.2026)";

/* =====================================================================
 * Library init/cleanup stubs
 * ===================================================================== */

int __saveds __asm __UserLibInit(
    register __a6 struct Library *libbase)
{
    return 0;  /* 0 = success */
}

void __saveds __asm __UserLibCleanup(
    register __a6 struct Library *libbase)
{
}

/* =====================================================================
 * AmigaOS-native memory allocator for QuickJS
 *
 * The C runtime's malloc/free/realloc are NOT available in a shared
 * library context because c.o startup never ran to initialize the
 * heap. Instead, we use exec.library's AllocMem/FreeMem.
 *
 * To support realloc and malloc_usable_size, we prepend each
 * allocation with a small header storing the block size.
 * ===================================================================== */

#include <exec/memory.h>

/* Header stored before each allocation */
typedef struct {
    ULONG size;    /* total allocation size including header */
    ULONG magic;   /* 0x514A5321 = "QJS!" — sanity check    */
} AllocHeader;

#define ALLOC_MAGIC 0x514A5321UL
#define HEADER_SIZE ((sizeof(AllocHeader) + 7) & ~7)  /* 8-byte aligned */

static void *amiga_js_calloc(void *opaque, size_t count, size_t size)
{
    ULONG total;
    AllocHeader *hdr;
    size_t alloc_size = count * size;
    (void)opaque;

    total = (ULONG)(alloc_size + HEADER_SIZE);
    hdr = (AllocHeader *)AllocMem(total, MEMF_PUBLIC | MEMF_CLEAR);
    if (!hdr) return NULL;

    hdr->size = total;
    hdr->magic = ALLOC_MAGIC;
    return (char *)hdr + HEADER_SIZE;
}

static void *amiga_js_malloc(void *opaque, size_t size)
{
    ULONG total;
    AllocHeader *hdr;
    (void)opaque;

    total = (ULONG)(size + HEADER_SIZE);
    hdr = (AllocHeader *)AllocMem(total, MEMF_PUBLIC);
    if (!hdr) return NULL;

    hdr->size = total;
    hdr->magic = ALLOC_MAGIC;
    return (char *)hdr + HEADER_SIZE;
}

static void amiga_js_free(void *opaque, void *ptr)
{
    AllocHeader *hdr;
    (void)opaque;

    if (!ptr) return;
    hdr = (AllocHeader *)((char *)ptr - HEADER_SIZE);
    if (hdr->magic != ALLOC_MAGIC) return;  /* corrupt or double-free */
    hdr->magic = 0;  /* prevent double-free */
    FreeMem(hdr, hdr->size);
}

static void *amiga_js_realloc(void *opaque, void *ptr, size_t new_size)
{
    AllocHeader *old_hdr;
    void *new_ptr;
    ULONG old_data_size;
    ULONG copy_size;

    if (!ptr) return amiga_js_malloc(opaque, new_size);
    if (new_size == 0) {
        amiga_js_free(opaque, ptr);
        return NULL;
    }

    old_hdr = (AllocHeader *)((char *)ptr - HEADER_SIZE);
    if (old_hdr->magic != ALLOC_MAGIC) return NULL;

    old_data_size = old_hdr->size - HEADER_SIZE;

    /* If shrinking and difference is small, just keep the block */
    if (new_size <= old_data_size) {
        /* Only reallocate if we'd save more than 256 bytes */
        if (old_data_size - new_size < 256)
            return ptr;
    }

    new_ptr = amiga_js_malloc(opaque, new_size);
    if (!new_ptr) return NULL;

    copy_size = old_data_size < (ULONG)new_size
                ? old_data_size : (ULONG)new_size;
    memcpy(new_ptr, ptr, copy_size);
    amiga_js_free(opaque, ptr);
    return new_ptr;
}

static size_t amiga_js_malloc_usable_size(const void *ptr)
{
    const AllocHeader *hdr;
    if (!ptr) return 0;
    hdr = (const AllocHeader *)((const char *)ptr - HEADER_SIZE);
    if (hdr->magic != ALLOC_MAGIC) return 0;
    return (size_t)(hdr->size - HEADER_SIZE);
}

static const JSMallocFunctions amiga_malloc_funcs = {
    amiga_js_calloc,
    amiga_js_malloc,
    amiga_js_free,
    amiga_js_realloc,
    amiga_js_malloc_usable_size,
};

/* =====================================================================
 * Runtime management
 * ===================================================================== */

__saveds __asm JSRuntime *LIBQJS_NewRuntime(void)
{
    return JS_NewRuntime2(&amiga_malloc_funcs, NULL);
}

__saveds __asm void LIBQJS_FreeRuntime(
    register __a0 JSRuntime *rt)
{
    JS_FreeRuntime(rt);
}

__saveds __asm void LIBQJS_SetMemoryLimit(
    register __a0 JSRuntime *rt,
    register __d0 ULONG limit)
{
    JS_SetMemoryLimit(rt, (size_t)limit);
}

__saveds __asm void LIBQJS_SetMaxStackSize(
    register __a0 JSRuntime *rt,
    register __d0 ULONG stack_size)
{
    JS_SetMaxStackSize(rt, (size_t)stack_size);
}

__saveds __asm void LIBQJS_RunGC(
    register __a0 JSRuntime *rt)
{
    JS_RunGC(rt);
}

__saveds __asm void LIBQJS_SetRuntimeInfo(
    register __a0 JSRuntime *rt,
    register __a1 const char *info)
{
    JS_SetRuntimeInfo(rt, info);
}

__saveds __asm void *LIBQJS_GetRuntimeOpaque(
    register __a0 JSRuntime *rt)
{
    return JS_GetRuntimeOpaque(rt);
}

__saveds __asm void LIBQJS_SetRuntimeOpaque(
    register __a0 JSRuntime *rt,
    register __a1 void *opaque)
{
    JS_SetRuntimeOpaque(rt, opaque);
}

__saveds __asm void LIBQJS_UpdateStackTop(
    register __a0 JSRuntime *rt)
{
    JS_UpdateStackTop(rt);
}

__saveds __asm int LIBQJS_IsLiveObject(
    register __a0 JSRuntime *rt,
    register __a1 const JSValue *obj)
{
    return JS_IsLiveObject(rt, *obj);
}

/* =====================================================================
 * Context management
 * ===================================================================== */

__saveds __asm JSContext *LIBQJS_NewContext(
    register __a0 JSRuntime *rt)
{
    return JS_NewContext(rt);
}

__saveds __asm void LIBQJS_FreeContext(
    register __a0 JSContext *ctx)
{
    JS_FreeContext(ctx);
}

__saveds __asm JSContext *LIBQJS_DupContext(
    register __a0 JSContext *ctx)
{
    return JS_DupContext(ctx);
}

__saveds __asm JSRuntime *LIBQJS_GetRuntime(
    register __a0 JSContext *ctx)
{
    return JS_GetRuntime(ctx);
}

__saveds __asm void *LIBQJS_GetContextOpaque(
    register __a0 JSContext *ctx)
{
    return JS_GetContextOpaque(ctx);
}

__saveds __asm void LIBQJS_SetContextOpaque(
    register __a0 JSContext *ctx,
    register __a1 void *opaque)
{
    JS_SetContextOpaque(ctx, opaque);
}

__saveds __asm JSContext *LIBQJS_NewContextRaw(
    register __a0 JSRuntime *rt)
{
    return JS_NewContextRaw(rt);
}

/* =====================================================================
 * Intrinsics
 * ===================================================================== */

__saveds __asm int LIBQJS_AddIntrinsicBaseObjects(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicBaseObjects(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicDate(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicDate(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicEval(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicEval(ctx);
}

__saveds __asm void LIBQJS_AddIntrinsicRegExpCompiler(
    register __a0 JSContext *ctx)
{
    JS_AddIntrinsicRegExpCompiler(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicRegExp(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicRegExp(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicJSON(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicJSON(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicProxy(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicProxy(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicMapSet(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicMapSet(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicTypedArrays(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicTypedArrays(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicPromise(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicPromise(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicBigInt(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicBigInt(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicWeakRef(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicWeakRef(ctx);
}

__saveds __asm int LIBQJS_AddPerformance(
    register __a0 JSContext *ctx)
{
    return JS_AddPerformance(ctx);
}

__saveds __asm int LIBQJS_AddIntrinsicDOMException(
    register __a0 JSContext *ctx)
{
    return JS_AddIntrinsicDOMException(ctx);
}

/* =====================================================================
 * Eval
 * ===================================================================== */

__saveds __asm void LIBQJS_Eval(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *input,
    register __d0 ULONG input_len,
    register __a3 const char *filename,
    register __d1 int eval_flags)
{
    *result = JS_Eval(ctx, input, (size_t)input_len, filename, eval_flags);
}

__saveds __asm void LIBQJS_EvalThis(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *this_obj,
    register __a3 const char *input,
    register __d0 ULONG input_len,
    register __d1 const char *filename,
    register __d2 int eval_flags)
{
    *result = JS_EvalThis(ctx, *this_obj, (const char *)input,
                          (size_t)input_len, (const char *)filename,
                          eval_flags);
}

__saveds __asm void LIBQJS_EvalFunction(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 JSValue *fun_obj)
{
    *result = JS_EvalFunction(ctx, *fun_obj);
}

__saveds __asm int LIBQJS_DetectModule(
    register __a0 const char *input,
    register __d0 ULONG input_len)
{
    return JS_DetectModule(input, (size_t)input_len);
}

__saveds __asm int LIBQJS_ResolveModule(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj)
{
    return JS_ResolveModule(ctx, *obj);
}

/* =====================================================================
 * Value creation
 * ===================================================================== */

__saveds __asm void LIBQJS_NewInt32(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 int val)
{
    *result = JS_NewInt32(ctx, val);
}

__saveds __asm void LIBQJS_NewFloat64(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const double *dval)
{
    *result = JS_NewFloat64(ctx, *dval);
}

__saveds __asm void LIBQJS_NewString(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *str)
{
    *result = JS_NewString(ctx, str);
}

__saveds __asm void LIBQJS_NewStringLen(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *str,
    register __d0 ULONG len)
{
    *result = JS_NewStringLen(ctx, str, (size_t)len);
}

__saveds __asm void LIBQJS_NewBool(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 int val)
{
    *result = JS_NewBool(ctx, val);
}

__saveds __asm void LIBQJS_NewObject(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx)
{
    *result = JS_NewObject(ctx);
}

__saveds __asm void LIBQJS_NewArray(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx)
{
    *result = JS_NewArray(ctx);
}

__saveds __asm void LIBQJS_NewNumber(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const double *dval)
{
    *result = JS_NewNumber(ctx, *dval);
}

__saveds __asm void LIBQJS_NewAtomString(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *str)
{
    *result = JS_NewAtomString(ctx, str);
}

__saveds __asm void LIBQJS_NewObjectProto(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *proto)
{
    *result = JS_NewObjectProto(ctx, *proto);
}

__saveds __asm void LIBQJS_NewObjectClass(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 JSClassID class_id)
{
    *result = JS_NewObjectClass(ctx, class_id);
}

__saveds __asm void LIBQJS_NewObjectProtoClass(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *proto,
    register __d0 JSClassID class_id)
{
    *result = JS_NewObjectProtoClass(ctx, *proto, class_id);
}

__saveds __asm void LIBQJS_NewError(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx)
{
    *result = JS_NewError(ctx);
}

__saveds __asm void LIBQJS_NewDate(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const double *epoch_ms)
{
    *result = JS_NewDate(ctx, *epoch_ms);
}

__saveds __asm void LIBQJS_NewSymbol(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *description,
    register __d0 int is_global)
{
    *result = JS_NewSymbol(ctx, description, is_global);
}

/* =====================================================================
 * Value extraction
 * ===================================================================== */

__saveds __asm const char *LIBQJS_ToCString(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *val)
{
    return JS_ToCString(ctx, *val);
}

__saveds __asm void LIBQJS_FreeCString(
    register __a0 JSContext *ctx,
    register __a1 const char *str)
{
    JS_FreeCString(ctx, str);
}

__saveds __asm const char *LIBQJS_ToCStringLen2(
    register __a0 JSContext *ctx,
    register __a1 ULONG *plen,
    register __a2 const JSValue *val,
    register __d0 int cesu8)
{
    size_t len;
    const char *s = JS_ToCStringLen2(ctx, &len, *val, cesu8);
    if (plen) *plen = (ULONG)len;
    return s;
}

__saveds __asm int LIBQJS_ToInt32(
    register __a0 JSContext *ctx,
    register __a1 long *pres,
    register __a2 const JSValue *val)
{
    int32_t res;
    int ret = JS_ToInt32(ctx, &res, *val);
    if (pres) *pres = (long)res;
    return ret;
}

__saveds __asm int LIBQJS_ToFloat64(
    register __a0 JSContext *ctx,
    register __a1 double *pres,
    register __a2 const JSValue *val)
{
    return JS_ToFloat64(ctx, pres, *val);
}

__saveds __asm int LIBQJS_ToBool(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *val)
{
    return JS_ToBool(ctx, *val);
}

__saveds __asm void LIBQJS_ToNumber(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *val)
{
    *result = JS_ToNumber(ctx, *val);
}

__saveds __asm void LIBQJS_ToString(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *val)
{
    *result = JS_ToString(ctx, *val);
}

__saveds __asm void LIBQJS_ToPropertyKey(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *val)
{
    *result = JS_ToPropertyKey(ctx, *val);
}

__saveds __asm void LIBQJS_ToObject(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *val)
{
    *result = JS_ToObject(ctx, *val);
}

/* =====================================================================
 * Type checking
 * ===================================================================== */

__saveds __asm int LIBQJS_IsNumber(
    register __a0 const JSValue *val)
{
    return JS_IsNumber(*val);
}

__saveds __asm int LIBQJS_IsString(
    register __a0 const JSValue *val)
{
    return JS_IsString(*val);
}

__saveds __asm int LIBQJS_IsObject(
    register __a0 const JSValue *val)
{
    return JS_IsObject(*val);
}

__saveds __asm int LIBQJS_IsUndefined(
    register __a0 const JSValue *val)
{
    return JS_IsUndefined(*val);
}

__saveds __asm int LIBQJS_IsNull(
    register __a0 const JSValue *val)
{
    return JS_IsNull(*val);
}

__saveds __asm int LIBQJS_IsException(
    register __a0 const JSValue *val)
{
    return JS_IsException(*val);
}

__saveds __asm int LIBQJS_IsError(
    register __a0 const JSValue *val)
{
    return JS_IsError(*val);
}

__saveds __asm int LIBQJS_IsFunction(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *val)
{
    return JS_IsFunction(ctx, *val);
}

__saveds __asm int LIBQJS_IsConstructor(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *val)
{
    return JS_IsConstructor(ctx, *val);
}

__saveds __asm int LIBQJS_IsArray(
    register __a0 const JSValue *val)
{
    return JS_IsArray(*val);
}

__saveds __asm int LIBQJS_IsProxy(
    register __a0 const JSValue *val)
{
    return JS_IsProxy(*val);
}

__saveds __asm int LIBQJS_IsPromise(
    register __a0 const JSValue *val)
{
    return JS_IsPromise(*val);
}

__saveds __asm int LIBQJS_IsDate(
    register __a0 const JSValue *val)
{
    return JS_IsDate(*val);
}

__saveds __asm int LIBQJS_IsRegExp(
    register __a0 const JSValue *val)
{
    return JS_IsRegExp(*val);
}

__saveds __asm int LIBQJS_IsMap(
    register __a0 const JSValue *val)
{
    return JS_IsMap(*val);
}

__saveds __asm int LIBQJS_IsSet(
    register __a0 const JSValue *val)
{
    return JS_IsSet(*val);
}

__saveds __asm int LIBQJS_IsDataView(
    register __a0 const JSValue *val)
{
    return JS_IsDataView(*val);
}

__saveds __asm int LIBQJS_IsArrayBuffer(
    register __a0 const JSValue *obj)
{
    return JS_IsArrayBuffer(*obj);
}

/* =====================================================================
 * Value lifecycle
 * ===================================================================== */

__saveds __asm void LIBQJS_FreeValue(
    register __a0 JSContext *ctx,
    register __a1 JSValue *val)
{
    JS_FreeValue(ctx, *val);
}

__saveds __asm void LIBQJS_FreeValueRT(
    register __a0 JSRuntime *rt,
    register __a1 JSValue *val)
{
    JS_FreeValueRT(rt, *val);
}

__saveds __asm void LIBQJS_DupValue(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *val)
{
    *result = JS_DupValue(ctx, *val);
}

__saveds __asm void LIBQJS_DupValueRT(
    register __a0 JSValue *result,
    register __a1 JSRuntime *rt,
    register __a2 const JSValue *val)
{
    *result = JS_DupValueRT(rt, *val);
}

/* =====================================================================
 * Properties
 * ===================================================================== */

__saveds __asm void LIBQJS_GetPropertyStr(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *this_obj,
    register __a3 const char *prop)
{
    *result = JS_GetPropertyStr(ctx, *this_obj, prop);
}

__saveds __asm int LIBQJS_SetPropertyStr(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __a2 const char *prop,
    register __a3 JSValue *val)
{
    return JS_SetPropertyStr(ctx, *this_obj, prop, *val);
}

__saveds __asm void LIBQJS_GetProperty(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *this_obj,
    register __d0 JSAtom prop)
{
    *result = JS_GetProperty(ctx, *this_obj, prop);
}

__saveds __asm int LIBQJS_SetProperty(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __d0 JSAtom prop,
    register __a2 JSValue *val)
{
    return JS_SetProperty(ctx, *this_obj, prop, *val);
}

__saveds __asm void LIBQJS_GetPropertyUint32(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *this_obj,
    register __d0 ULONG idx)
{
    *result = JS_GetPropertyUint32(ctx, *this_obj, (uint32_t)idx);
}

__saveds __asm int LIBQJS_SetPropertyUint32(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __d0 ULONG idx,
    register __a2 JSValue *val)
{
    return JS_SetPropertyUint32(ctx, *this_obj, (uint32_t)idx, *val);
}

__saveds __asm int LIBQJS_HasProperty(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __d0 JSAtom prop)
{
    return JS_HasProperty(ctx, *this_obj, prop);
}

__saveds __asm int LIBQJS_DeleteProperty(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj,
    register __d0 JSAtom prop,
    register __d1 int flags)
{
    return JS_DeleteProperty(ctx, *obj, prop, flags);
}

__saveds __asm int LIBQJS_GetOwnPropertyNames(
    register __a0 JSContext *ctx,
    register __a1 JSPropertyEnum **ptab,
    register __a2 ULONG *plen,
    register __a3 const JSValue *obj,
    register __d0 int flags)
{
    uint32_t len;
    int ret = JS_GetOwnPropertyNames(ctx, ptab, &len, *obj, flags);
    if (plen) *plen = (ULONG)len;
    return ret;
}

__saveds __asm void LIBQJS_FreePropertyEnum(
    register __a0 JSContext *ctx,
    register __a1 JSPropertyEnum *tab,
    register __d0 ULONG len)
{
    JS_FreePropertyEnum(ctx, tab, (uint32_t)len);
}

__saveds __asm int LIBQJS_DefinePropertyValue(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __d0 JSAtom prop,
    register __a2 JSValue *val,
    register __d1 int flags)
{
    return JS_DefinePropertyValue(ctx, *this_obj, prop, *val, flags);
}

__saveds __asm int LIBQJS_DefinePropertyValueStr(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __a2 const char *prop,
    register __a3 JSValue *val,
    register __d0 int flags)
{
    return JS_DefinePropertyValueStr(ctx, *this_obj, prop, *val, flags);
}

__saveds __asm int LIBQJS_DefinePropertyValueUint32(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __d0 ULONG idx,
    register __a2 JSValue *val,
    register __d1 int flags)
{
    return JS_DefinePropertyValueUint32(ctx, *this_obj, (uint32_t)idx,
                                        *val, flags);
}

__saveds __asm int LIBQJS_DefinePropertyGetSet(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __d0 JSAtom prop,
    register __a2 JSValue *getter,
    register __a3 JSValue *setter,
    register __d1 int flags)
{
    return JS_DefinePropertyGetSet(ctx, *this_obj, prop,
                                    *getter, *setter, flags);
}

__saveds __asm int LIBQJS_GetOwnProperty(
    register __a0 JSContext *ctx,
    register __a1 JSPropertyDescriptor *desc,
    register __a2 const JSValue *obj,
    register __d0 JSAtom prop)
{
    return JS_GetOwnProperty(ctx, desc, *obj, prop);
}

__saveds __asm int LIBQJS_DefineProperty(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *this_obj,
    register __d0 JSAtom prop,
    register __a2 const JSValue *val,
    register __a3 const JSValue *getter,
    register __d1 const JSValue *setter,
    register __d2 int flags)
{
    return JS_DefineProperty(ctx, *this_obj, prop,
                              *val, *getter,
                              *((const JSValue *)setter), flags);
}

/* =====================================================================
 * Object operations
 * ===================================================================== */

__saveds __asm int LIBQJS_SetPrototype(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj,
    register __a2 const JSValue *proto_val)
{
    return JS_SetPrototype(ctx, *obj, *proto_val);
}

__saveds __asm void LIBQJS_GetPrototype(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *val)
{
    *result = JS_GetPrototype(ctx, *val);
}

__saveds __asm int LIBQJS_IsExtensible(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj)
{
    return JS_IsExtensible(ctx, *obj);
}

__saveds __asm int LIBQJS_PreventExtensions(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj)
{
    return JS_PreventExtensions(ctx, *obj);
}

__saveds __asm int LIBQJS_SealObject(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj)
{
    return JS_SealObject(ctx, *obj);
}

__saveds __asm int LIBQJS_FreezeObject(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj)
{
    return JS_FreezeObject(ctx, *obj);
}

__saveds __asm int LIBQJS_SetConstructorBit(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *func_obj,
    register __d0 int val)
{
    return JS_SetConstructorBit(ctx, *func_obj, val);
}

__saveds __asm int LIBQJS_SetConstructor(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *func_obj,
    register __a2 const JSValue *proto)
{
    return JS_SetConstructor(ctx, *func_obj, *proto);
}

/* =====================================================================
 * Function calls
 * ===================================================================== */

__saveds __asm void LIBQJS_Call(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *func_obj,
    register __a3 const JSValue *this_obj,
    register __d0 int argc,
    register __d1 JSValueConst *argv)
{
    *result = JS_Call(ctx, *func_obj, *this_obj, argc, argv);
}

__saveds __asm void LIBQJS_CallConstructor(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *func_obj,
    register __d0 int argc,
    register __d1 JSValueConst *argv)
{
    *result = JS_CallConstructor(ctx, *func_obj, argc, argv);
}

__saveds __asm void LIBQJS_Invoke(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *this_val,
    register __d0 JSAtom atom,
    register __d1 int argc,
    register __d2 JSValueConst *argv)
{
    *result = JS_Invoke(ctx, *this_val, atom, argc, argv);
}

/* =====================================================================
 * Error handling
 * ===================================================================== */

__saveds __asm void LIBQJS_Throw(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 JSValue *obj)
{
    *result = JS_Throw(ctx, *obj);
}

__saveds __asm void LIBQJS_GetException(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx)
{
    *result = JS_GetException(ctx);
}

__saveds __asm int LIBQJS_HasException(
    register __a0 JSContext *ctx)
{
    return JS_HasException(ctx);
}

__saveds __asm int LIBQJS_IsUncatchableError(
    register __a0 const JSValue *val)
{
    return JS_IsUncatchableError(*val);
}

__saveds __asm void LIBQJS_SetUncatchableError(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *val)
{
    JS_SetUncatchableError(ctx, *val);
}

__saveds __asm void LIBQJS_ClearUncatchableError(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *val)
{
    JS_ClearUncatchableError(ctx, *val);
}

__saveds __asm void LIBQJS_ResetUncatchableError(
    register __a0 JSContext *ctx)
{
    JS_ResetUncatchableError(ctx);
}

__saveds __asm void LIBQJS_ThrowOutOfMemory(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx)
{
    *result = JS_ThrowOutOfMemory(ctx);
}

/* Non-variadic error throwers — wrap the variadic upstream functions
 * with a single message string (no printf formatting). */

__saveds __asm void LIBQJS_ThrowTypeErrorMsg(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *msg)
{
    *result = JS_ThrowTypeError(ctx, "%s", msg);
}

__saveds __asm void LIBQJS_ThrowRangeErrorMsg(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *msg)
{
    *result = JS_ThrowRangeError(ctx, "%s", msg);
}

__saveds __asm void LIBQJS_ThrowReferenceErrorMsg(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *msg)
{
    *result = JS_ThrowReferenceError(ctx, "%s", msg);
}

__saveds __asm void LIBQJS_ThrowSyntaxErrorMsg(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *msg)
{
    *result = JS_ThrowSyntaxError(ctx, "%s", msg);
}

__saveds __asm void LIBQJS_ThrowInternalErrorMsg(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *msg)
{
    *result = JS_ThrowInternalError(ctx, "%s", msg);
}

/* =====================================================================
 * Atoms
 * ===================================================================== */

__saveds __asm JSAtom LIBQJS_NewAtom(
    register __a0 JSContext *ctx,
    register __a1 const char *str)
{
    return JS_NewAtom(ctx, str);
}

__saveds __asm JSAtom LIBQJS_NewAtomLen(
    register __a0 JSContext *ctx,
    register __a1 const char *str,
    register __d0 ULONG len)
{
    return JS_NewAtomLen(ctx, str, (size_t)len);
}

__saveds __asm JSAtom LIBQJS_NewAtomUInt32(
    register __a0 JSContext *ctx,
    register __d0 ULONG n)
{
    return JS_NewAtomUInt32(ctx, (uint32_t)n);
}

__saveds __asm JSAtom LIBQJS_DupAtom(
    register __a0 JSContext *ctx,
    register __d0 JSAtom v)
{
    return JS_DupAtom(ctx, v);
}

__saveds __asm void LIBQJS_FreeAtom(
    register __a0 JSContext *ctx,
    register __d0 JSAtom v)
{
    JS_FreeAtom(ctx, v);
}

__saveds __asm void LIBQJS_AtomToValue(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 JSAtom atom)
{
    *result = JS_AtomToValue(ctx, atom);
}

__saveds __asm void LIBQJS_AtomToString(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 JSAtom atom)
{
    *result = JS_AtomToString(ctx, atom);
}

__saveds __asm JSAtom LIBQJS_ValueToAtom(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *val)
{
    return JS_ValueToAtom(ctx, *val);
}

/* =====================================================================
 * Global object
 * ===================================================================== */

__saveds __asm void LIBQJS_GetGlobalObject(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx)
{
    *result = JS_GetGlobalObject(ctx);
}

/* =====================================================================
 * JSON
 * ===================================================================== */

__saveds __asm void LIBQJS_ParseJSON(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *buf,
    register __d0 ULONG buf_len,
    register __a3 const char *filename)
{
    *result = JS_ParseJSON(ctx, buf, (size_t)buf_len, filename);
}

__saveds __asm void LIBQJS_JSONStringify(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *obj,
    register __a3 const JSValue *replacer,
    register __d0 const JSValue *space)
{
    *result = JS_JSONStringify(ctx, *obj, *replacer,
                                *((const JSValue *)space));
}

/* =====================================================================
 * ArrayBuffer and TypedArray
 * ===================================================================== */

__saveds __asm void LIBQJS_NewArrayBufferCopy(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const UBYTE *buf,
    register __d0 ULONG len)
{
    *result = JS_NewArrayBufferCopy(ctx, buf, (size_t)len);
}

__saveds __asm UBYTE *LIBQJS_GetArrayBuffer(
    register __a0 JSContext *ctx,
    register __a1 ULONG *psize,
    register __a2 const JSValue *obj)
{
    size_t sz;
    UBYTE *p = (UBYTE *)JS_GetArrayBuffer(ctx, &sz, *obj);
    if (psize) *psize = (ULONG)sz;
    return p;
}

__saveds __asm void LIBQJS_DetachArrayBuffer(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj)
{
    JS_DetachArrayBuffer(ctx, *obj);
}

__saveds __asm UBYTE *LIBQJS_GetUint8Array(
    register __a0 JSContext *ctx,
    register __a1 ULONG *psize,
    register __a2 const JSValue *obj)
{
    size_t sz;
    UBYTE *p = (UBYTE *)JS_GetUint8Array(ctx, &sz, *obj);
    if (psize) *psize = (ULONG)sz;
    return p;
}

__saveds __asm void LIBQJS_NewUint8ArrayCopy(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const UBYTE *buf,
    register __d0 ULONG len)
{
    *result = JS_NewUint8ArrayCopy(ctx, buf, (size_t)len);
}

__saveds __asm void LIBQJS_NewTypedArray(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 int argc,
    register __a2 JSValueConst *argv,
    register __d1 int array_type)
{
    *result = JS_NewTypedArray(ctx, argc, argv,
                                (JSTypedArrayEnum)array_type);
}

__saveds __asm void LIBQJS_GetTypedArrayBuffer(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *obj,
    register __a3 ULONG *pbyte_offset,
    register __d0 ULONG *pbyte_length,
    register __d1 ULONG *pbytes_per_element)
{
    size_t off, len, bpe;
    *result = JS_GetTypedArrayBuffer(ctx, *obj, &off, &len, &bpe);
    if (pbyte_offset) *pbyte_offset = (ULONG)off;
    if (pbyte_length) *pbyte_length = (ULONG)len;
    if (pbytes_per_element) *pbytes_per_element = (ULONG)bpe;
}

__saveds __asm int LIBQJS_GetTypedArrayType(
    register __a0 const JSValue *obj)
{
    return JS_GetTypedArrayType(*obj);
}

/* =====================================================================
 * Promise
 * ===================================================================== */

__saveds __asm void LIBQJS_NewPromiseCapability(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 JSValue *resolving_funcs)
{
    *result = JS_NewPromiseCapability(ctx, resolving_funcs);
}

__saveds __asm int LIBQJS_PromiseState(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *promise)
{
    return (int)JS_PromiseState(ctx, *promise);
}

__saveds __asm void LIBQJS_PromiseResult(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *promise)
{
    *result = JS_PromiseResult(ctx, *promise);
}

__saveds __asm void LIBQJS_NewSettledPromise(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 int is_reject,
    register __a2 const JSValue *value)
{
    *result = JS_NewSettledPromise(ctx, is_reject, *value);
}

/* =====================================================================
 * Module system
 * ===================================================================== */

__saveds __asm JSModuleDef *LIBQJS_NewCModule(
    register __a0 JSContext *ctx,
    register __a1 const char *name_str,
    register __a2 JSModuleInitFunc *func)
{
    return JS_NewCModule(ctx, name_str, func);
}

__saveds __asm int LIBQJS_AddModuleExport(
    register __a0 JSContext *ctx,
    register __a1 JSModuleDef *m,
    register __a2 const char *name_str)
{
    return JS_AddModuleExport(ctx, m, name_str);
}

__saveds __asm int LIBQJS_SetModuleExport(
    register __a0 JSContext *ctx,
    register __a1 JSModuleDef *m,
    register __a2 const char *export_name,
    register __a3 JSValue *val)
{
    return JS_SetModuleExport(ctx, m, export_name, *val);
}

__saveds __asm JSAtom LIBQJS_GetModuleName(
    register __a0 JSContext *ctx,
    register __a1 JSModuleDef *m)
{
    return JS_GetModuleName(ctx, m);
}

__saveds __asm void LIBQJS_GetImportMeta(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 JSModuleDef *m)
{
    *result = JS_GetImportMeta(ctx, m);
}

__saveds __asm void LIBQJS_GetModuleNamespace(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 JSModuleDef *m)
{
    *result = JS_GetModuleNamespace(ctx, m);
}

__saveds __asm void LIBQJS_LoadModule(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *basename,
    register __a3 const char *filename)
{
    *result = JS_LoadModule(ctx, basename, filename);
}

/* =====================================================================
 * C function creation
 * ===================================================================== */

__saveds __asm void LIBQJS_NewCFunction2(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 JSCFunction *func,
    register __a3 const char *name,
    register __d0 int length,
    register __d1 int cproto,
    register __d2 int magic)
{
    *result = JS_NewCFunction2(ctx, func, name, length,
                                (JSCFunctionEnum)cproto, magic);
}

__saveds __asm void LIBQJS_NewCFunctionData(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 JSCFunctionData *func,
    register __d0 int length,
    register __d1 int magic,
    register __d2 int data_len,
    register __d3 JSValueConst *data)
{
    *result = JS_NewCFunctionData(ctx, func, length, magic,
                                   data_len, data);
}

__saveds __asm int LIBQJS_SetPropertyFunctionList(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj,
    register __a2 const JSCFunctionListEntry *tab,
    register __d0 int len)
{
    return JS_SetPropertyFunctionList(ctx, *obj, tab, len);
}

/* =====================================================================
 * Class system
 * ===================================================================== */

__saveds __asm JSClassID LIBQJS_NewClassID(
    register __a0 JSRuntime *rt,
    register __a1 JSClassID *pclass_id)
{
    return JS_NewClassID(rt, pclass_id);
}

__saveds __asm int LIBQJS_NewClass(
    register __a0 JSRuntime *rt,
    register __d0 JSClassID class_id,
    register __a1 const JSClassDef *class_def)
{
    return JS_NewClass(rt, class_id, class_def);
}

__saveds __asm JSClassID LIBQJS_GetClassID(
    register __a0 const JSValue *val)
{
    return JS_GetClassID(*val);
}

__saveds __asm int LIBQJS_IsRegisteredClass(
    register __a0 JSRuntime *rt,
    register __d0 JSClassID class_id)
{
    return JS_IsRegisteredClass(rt, class_id);
}

__saveds __asm void LIBQJS_SetClassProto(
    register __a0 JSContext *ctx,
    register __d0 JSClassID class_id,
    register __a1 JSValue *obj)
{
    JS_SetClassProto(ctx, class_id, *obj);
}

__saveds __asm void LIBQJS_GetClassProto(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 JSClassID class_id)
{
    *result = JS_GetClassProto(ctx, class_id);
}

__saveds __asm int LIBQJS_SetOpaque(
    register __a0 const JSValue *obj,
    register __a1 void *opaque)
{
    return JS_SetOpaque(*obj, opaque);
}

__saveds __asm void *LIBQJS_GetOpaque(
    register __a0 const JSValue *obj,
    register __d0 JSClassID class_id)
{
    return JS_GetOpaque(*obj, class_id);
}

__saveds __asm void *LIBQJS_GetOpaque2(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj,
    register __d0 JSClassID class_id)
{
    return JS_GetOpaque2(ctx, *obj, class_id);
}

__saveds __asm JSAtom LIBQJS_GetClassName(
    register __a0 JSRuntime *rt,
    register __d0 JSClassID class_id)
{
    return JS_GetClassName(rt, class_id);
}

/* =====================================================================
 * Memory management
 * ===================================================================== */

__saveds __asm void *LIBQJS_Malloc(
    register __a0 JSContext *ctx,
    register __d0 ULONG size)
{
    return js_malloc(ctx, (size_t)size);
}

__saveds __asm void LIBQJS_Free(
    register __a0 JSContext *ctx,
    register __a1 void *ptr)
{
    js_free(ctx, ptr);
}

__saveds __asm void *LIBQJS_Realloc(
    register __a0 JSContext *ctx,
    register __a1 void *ptr,
    register __d0 ULONG size)
{
    return js_realloc(ctx, ptr, (size_t)size);
}

__saveds __asm void *LIBQJS_Mallocz(
    register __a0 JSContext *ctx,
    register __d0 ULONG size)
{
    return js_mallocz(ctx, (size_t)size);
}

__saveds __asm char *LIBQJS_Strdup(
    register __a0 JSContext *ctx,
    register __a1 const char *str)
{
    return js_strdup(ctx, str);
}

__saveds __asm void LIBQJS_FreeCStringRT(
    register __a0 JSRuntime *rt,
    register __a1 const char *ptr)
{
    JS_FreeCStringRT(rt, ptr);
}

/* =====================================================================
 * Serialization (binary JSON)
 * ===================================================================== */

__saveds __asm UBYTE *LIBQJS_WriteObject(
    register __a0 JSContext *ctx,
    register __a1 ULONG *psize,
    register __a2 const JSValue *obj,
    register __d0 int flags)
{
    size_t sz;
    UBYTE *p = (UBYTE *)JS_WriteObject(ctx, &sz, *obj, flags);
    if (psize) *psize = (ULONG)sz;
    return p;
}

__saveds __asm void LIBQJS_ReadObject(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const UBYTE *buf,
    register __d0 ULONG buf_len,
    register __d1 int flags)
{
    *result = JS_ReadObject(ctx, buf, (size_t)buf_len, flags);
}

/* =====================================================================
 * Job queue
 * ===================================================================== */

__saveds __asm int LIBQJS_IsJobPending(
    register __a0 JSRuntime *rt)
{
    return JS_IsJobPending(rt);
}

__saveds __asm int LIBQJS_ExecutePendingJob(
    register __a0 JSRuntime *rt,
    register __a1 JSContext **pctx)
{
    return JS_ExecutePendingJob(rt, pctx);
}

/* =====================================================================
 * Comparison
 * ===================================================================== */

__saveds __asm int LIBQJS_IsEqual(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *op1,
    register __a2 const JSValue *op2)
{
    return JS_IsEqual(ctx, *op1, *op2);
}

__saveds __asm int LIBQJS_IsStrictEqual(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *op1,
    register __a2 const JSValue *op2)
{
    return JS_IsStrictEqual(ctx, *op1, *op2);
}

__saveds __asm int LIBQJS_IsSameValue(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *op1,
    register __a2 const JSValue *op2)
{
    return JS_IsSameValue(ctx, *op1, *op2);
}

__saveds __asm int LIBQJS_IsInstanceOf(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *val,
    register __a2 const JSValue *obj)
{
    return JS_IsInstanceOf(ctx, *val, *obj);
}

/* =====================================================================
 * std/os library helpers
 * ===================================================================== */

__saveds __asm void *LIBQJS_InitModuleStd(
    register __a0 JSContext *ctx,
    register __a1 const char *name)
{
    return (void *)js_init_module_std(ctx, name);
}

__saveds __asm void *LIBQJS_InitModuleOs(
    register __a0 JSContext *ctx,
    register __a1 const char *name)
{
    return (void *)js_init_module_os(ctx, name);
}

__saveds __asm void LIBQJS_StdAddHelpers(
    register __a0 JSContext *ctx,
    register __d0 int argc,
    register __a1 char **argv)
{
    js_std_add_helpers(ctx, argc, argv);
}

__saveds __asm void LIBQJS_StdInitHandlers(
    register __a0 JSRuntime *rt)
{
    js_std_init_handlers(rt);
}

__saveds __asm void LIBQJS_StdFreeHandlers(
    register __a0 JSRuntime *rt)
{
    js_std_free_handlers(rt);
}

__saveds __asm int LIBQJS_StdLoop(
    register __a0 JSContext *ctx)
{
    return js_std_loop(ctx);
}

__saveds __asm void LIBQJS_StdDumpError(
    register __a0 JSContext *ctx)
{
    js_std_dump_error(ctx);
}

__saveds __asm void LIBQJS_StdEvalBinary(
    register __a0 JSContext *ctx,
    register __a1 const UBYTE *buf,
    register __d0 ULONG buf_len,
    register __d1 int load_only)
{
    js_std_eval_binary(ctx, buf, (size_t)buf_len, load_only);
}

/* =====================================================================
 * Miscellaneous
 * ===================================================================== */

__saveds __asm const char *LIBQJS_GetVersion(void)
{
    return JS_GetVersion();
}

__saveds __asm void LIBQJS_ComputeMemoryUsage(
    register __a0 JSRuntime *rt,
    register __a1 JSMemoryUsage *s)
{
    JS_ComputeMemoryUsage(rt, s);
}

__saveds __asm JSAtom LIBQJS_GetScriptOrModuleName(
    register __a0 JSContext *ctx,
    register __d0 int n_stack_levels)
{
    return JS_GetScriptOrModuleName(ctx, n_stack_levels);
}

__saveds __asm void LIBQJS_SetDumpFlags(
    register __a0 JSRuntime *rt,
    register __d0 ULONG flags)
{
    JS_SetDumpFlags(rt, (uint64_t)flags);
}

__saveds __asm ULONG LIBQJS_GetGCThreshold(
    register __a0 JSRuntime *rt)
{
    return (ULONG)JS_GetGCThreshold(rt);
}

__saveds __asm void LIBQJS_SetGCThreshold(
    register __a0 JSRuntime *rt,
    register __d0 ULONG gc_threshold)
{
    JS_SetGCThreshold(rt, (size_t)gc_threshold);
}

/* =====================================================================
 * Additional value operations
 * ===================================================================== */

__saveds __asm void LIBQJS_NewProxy(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *target,
    register __a3 const JSValue *handler)
{
    *result = JS_NewProxy(ctx, *target, *handler);
}

__saveds __asm void LIBQJS_GetProxyTarget(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *proxy)
{
    *result = JS_GetProxyTarget(ctx, *proxy);
}

__saveds __asm void LIBQJS_GetProxyHandler(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const JSValue *proxy)
{
    *result = JS_GetProxyHandler(ctx, *proxy);
}

__saveds __asm void LIBQJS_SetIsHTMLDDA(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj)
{
    JS_SetIsHTMLDDA(ctx, *obj);
}

/* =====================================================================
 * Callbacks
 * ===================================================================== */

__saveds __asm void LIBQJS_SetInterruptHandler(
    register __a0 JSRuntime *rt,
    register __a1 JSInterruptHandler *cb,
    register __a2 void *opaque)
{
    JS_SetInterruptHandler(rt, cb, opaque);
}

__saveds __asm void LIBQJS_SetModuleLoaderFunc(
    register __a0 JSRuntime *rt,
    register __a1 JSModuleNormalizeFunc *module_normalize,
    register __a2 JSModuleLoaderFunc *module_loader,
    register __a3 void *opaque)
{
    JS_SetModuleLoaderFunc(rt, module_normalize, module_loader, opaque);
}

__saveds __asm void LIBQJS_SetCanBlock(
    register __a0 JSRuntime *rt,
    register __d0 int can_block)
{
    JS_SetCanBlock(rt, can_block);
}

__saveds __asm int LIBQJS_EnqueueJob(
    register __a0 JSContext *ctx,
    register __a1 JSJobFunc *job_func,
    register __d0 int argc,
    register __a2 JSValueConst *argv)
{
    return JS_EnqueueJob(ctx, job_func, argc, argv);
}

/* =====================================================================
 * Additional functions
 * ===================================================================== */

__saveds __asm void LIBQJS_MarkValue(
    register __a0 JSRuntime *rt,
    register __a1 const JSValue *val,
    register __a2 JS_MarkFunc *mark_func)
{
    JS_MarkValue(rt, *val, mark_func);
}

__saveds __asm int LIBQJS_AddRuntimeFinalizer(
    register __a0 JSRuntime *rt,
    register __a1 JSRuntimeFinalizer *finalizer,
    register __a2 void *arg)
{
    return JS_AddRuntimeFinalizer(rt, finalizer, arg);
}

__saveds __asm void LIBQJS_NewObjectFrom(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 int count,
    register __a2 const JSAtom *props,
    register __a3 const JSValue *values)
{
    *result = JS_NewObjectFrom(ctx, count, props, values);
}

__saveds __asm void LIBQJS_NewObjectFromStr(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 int count,
    register __a2 const char **props,
    register __a3 const JSValue *values)
{
    *result = JS_NewObjectFromStr(ctx, count, props, values);
}

__saveds __asm void LIBQJS_NewArrayFrom(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __d0 int count,
    register __a2 const JSValue *values)
{
    *result = JS_NewArrayFrom(ctx, count, values);
}

__saveds __asm int LIBQJS_SetLength(
    register __a0 JSContext *ctx,
    register __a1 const JSValue *obj,
    register __d0 long len)
{
    return JS_SetLength(ctx, *obj, (int64_t)len);
}

__saveds __asm void LIBQJS_PrintValue(
    register __a0 JSContext *ctx,
    register __a1 JSPrintValueWrite *write_func,
    register __a2 void *write_opaque,
    register __a3 const JSValue *val,
    register __d0 const JSPrintValueOptions *options)
{
    JS_PrintValue(ctx, write_func, write_opaque, *val, options);
}

__saveds __asm void LIBQJS_Eval2(
    register __a0 JSValue *result,
    register __a1 JSContext *ctx,
    register __a2 const char *input,
    register __d0 ULONG input_len,
    register __a3 JSEvalOptions *options)
{
    *result = JS_Eval2(ctx, input, (size_t)input_len, options);
}

__saveds __asm int LIBQJS_IsImmutableArrayBuffer(
    register __a0 const JSValue *obj)
{
    return JS_IsImmutableArrayBuffer(*obj);
}

__saveds __asm int LIBQJS_SetImmutableArrayBuffer(
    register __a0 const JSValue *obj,
    register __d0 int immutable)
{
    return JS_SetImmutableArrayBuffer(*obj, immutable);
}
