/*
 * qjsb_modules.c -- importing modules from add-ons.
 *
 * The runtime's module loader (installed by QJS_SetModuleLoader). A
 * module specifier of the form "<scheme>:<name>" is looked for in the
 * add-on directory before it is taken as an AmigaDOS path:
 *
 *   import fs from 'node:fs'      module "fs" of LIBS:quickjs/node.qjsb
 *   import h from 'qjs:hello'     module "@main" of LIBS:quickjs/hello.qjsb
 *                                 (qjs:std, qjs:os, qjs:bjson and qjs:net
 *                                 are built in and never get here)
 *
 * and everything else goes to the loader for files, as before.
 * docs/ADDONS.md describes add-ons for their authors.
 *
 * The add-on is asked first because "node:fs" is also a well-formed
 * AmigaDOS path, and opening it would make AmigaDOS ask the user to
 * insert volume "node:". The price is one failed Open in LIBS:quickjs/
 * for an import that really is "Volume:path" (the scheme has to look
 * like a file name for it to be tried at all, and a specifier ending
 * in .js, .mjs or .json is always a path). A specifier whose
 * scheme names an installed add-on belongs to the add-on: a module it
 * does not have is an error, not a path.
 *
 * The specifier is the module's name in the engine, and the bytecode
 * records the name it was compiled under, so an entry must have been
 * compiled under the specifier that finds it (scripts/qjsb.py compile
 * does that). An entry recorded under another name is refused: the
 * engine would load it again for every import.
 */
#include "amiga_compat_vbcc.h"
#include <stddef.h>
#include <string.h>

#include "quickjs.h"
#include "qjsb_format.h"
#include "qjsb_loader.h"

/* quickjs-libc.c: the loader for files, and import.meta */
extern JSModuleDef *js_module_loader(JSContext *ctx, const char *module_name,
                                     void *opaque, JSValueConst attributes);
extern int js_module_set_import_meta(JSContext *ctx, JSValueConst func_val,
                                     bool use_realpath, bool is_main);

#define QJSB_BUILTIN_SCHEME   "qjs"

/* Read module `entry` of an open add-on as the module `specifier`. */
static JSModuleDef *qjsb_load_module(JSContext *ctx, QJSBFile *file,
                                     const char *entry, const char *specifier)
{
    JSValue module = qjsb_read_entry(ctx, file, entry, QJSB_KIND_MODULE);
    JSModuleDef *definition;
    const char *recorded;
    JSAtom name;
    int same;

    if (JS_IsException(module))
        return NULL;

    if (JS_VALUE_GET_TAG(module) != JS_TAG_MODULE) {
        JS_FreeValue(ctx, module);
        JS_ThrowPlainError(ctx, "%s: '%s' is not a module", qjsb_path(file),
                           entry);
        return NULL;
    }

    definition = (JSModuleDef *)JS_VALUE_GET_PTR(module);

    name = JS_GetModuleName(ctx, definition);
    recorded = JS_AtomToCString(ctx, name);
    JS_FreeAtom(ctx, name);
    same = recorded && strcmp(recorded, specifier) == 0;
    if (!same) {
        JS_ThrowPlainError(ctx,
            "%s: module '%s' was compiled as '%s', not as '%s' "
            "(build it with scripts/qjsb.py compile)",
            qjsb_path(file), entry, recorded ? recorded : "?", specifier);
        JS_FreeCString(ctx, recorded);
        JS_FreeValue(ctx, module);
        return NULL;
    }
    JS_FreeCString(ctx, recorded);

    if (js_module_set_import_meta(ctx, module, false, false) < 0) {
        JS_FreeValue(ctx, module);
        return NULL;
    }

    /* the context's list of modules keeps it, as for a compiled file */
    JS_FreeValue(ctx, module);
    return definition;
}

static int has_suffix(const char *text, const char *suffix)
{
    size_t length = strlen(text), tail = strlen(suffix);

    return length >= tail && strcmp(text + length - tail, suffix) == 0;
}

JSModuleDef *qjsb_module_loader(JSContext *ctx, const char *module_name,
                                void *opaque, JSValueConst attributes)
{
    const char *colon = strchr(module_name, ':');
    const char *container, *entry;
    size_t container_length;
    char name[32];
    QJSBFile *file;
    JSModuleDef *module;
    int builtin, opened;

    if (!colon || colon == module_name || colon[1] == '\0' ||
        has_suffix(module_name, ".js") || has_suffix(module_name, ".mjs") ||
        has_suffix(module_name, ".json"))
        return js_module_loader(ctx, module_name, opaque, attributes);

    builtin = (size_t)(colon - module_name) == sizeof(QJSB_BUILTIN_SCHEME) - 1
              && memcmp(module_name, QJSB_BUILTIN_SCHEME,
                        sizeof(QJSB_BUILTIN_SCHEME) - 1) == 0;

    if (builtin) {
        container = colon + 1;
        container_length = strlen(container);
        entry = QJSB_MAIN_ENTRY;
    } else {
        container = module_name;
        container_length = (size_t)(colon - module_name);
        entry = colon + 1;
    }

    if (!qjsb_valid_container_name(container, container_length) ||
        container_length >= sizeof(name)) {
        if (builtin) {
            JS_ThrowReferenceError(ctx, "could not load module '%s'",
                                   module_name);
            return NULL;
        }
        return js_module_loader(ctx, module_name, opaque, attributes);
    }
    memcpy(name, container, container_length);
    name[container_length] = '\0';

    opened = qjsb_open(ctx, name, 1, NULL, &file);
    if (opened < 0)
        return NULL;

    if (opened == 0) {
        if (builtin) {
            /* never a path: "qjs:" is not a volume */
            JS_ThrowReferenceError(ctx,
                "could not load module '%s': it is not built in and there "
                "is no %s/%s.qjsb", module_name, QJSB_DEFAULT_DIR, name);
            return NULL;
        }
        return js_module_loader(ctx, module_name, opaque, attributes);
    }

    module = qjsb_load_module(ctx, file, entry, module_name);
    qjsb_close(ctx, file);
    return module;
}
