/*
 * quickjs_libc_lib.c -- Thin wrapper to build quickjs-libc.c inside
 *                       quickjs.library (AmigaOS shared library, VBCC)
 *
 * Instead of maintaining a 5000-line modified copy of quickjs-libc.c,
 * this file provides the necessary pre-definitions and then #includes
 * the upstream source directly.  The upstream already has extensive
 * `#if defined(__VBCC__)` / `#if defined(__SASC) || defined(__VBCC__)`
 * guards that disable unsupported features.
 *
 * What this wrapper does:
 *  1. Pre-includes sharedlib_posix.h to set type guards (_SYS_STAT_H_,
 *     _AMIGA_DIRENT_H, etc.) before VBCC posixlib headers can conflict.
 *  2. Suppresses VBCC posixlib's dirent.h via _DIRENT_H_ guard.
 *  3. Provides DOSBase global for <proto/dos.h> inline calls.
 *  4. Provides popen/pclose stubs (not available in library context).
 *  5. Defines amiga_force_color (upstream declares it extern).
 */

/* === Step 1: VBCC compatibility layer === */
#include "amiga_compat_vbcc.h"
#include <proto/exec.h>

/* === Step 2: Our POSIX shim types (sets _SYS_STAT_H_, etc.) === */
#include "sharedlib_posix.h"

/* === Step 3: Suppress conflicting VBCC posixlib headers ===
 *
 * sharedlib_posix.h already defines _SYS_STAT_H_ which matches
 * VBCC posixlib's guard, so sys/stat.h won't redefine struct stat.
 *
 * For dirent.h, VBCC posixlib uses _DIRENT_H_ and _SYS_DIRENT_H_
 * while our sharedlib_posix.h uses _AMIGA_DIRENT_H.  Set the
 * posixlib guards to prevent their struct dirent / DIR from
 * conflicting with ours.
 *
 * For sys/types.h, VBCC posixlib uses `#ifndef uid_t` / `#define uid_t`
 * pattern.  Since sharedlib_posix.h defines these as typedefs (not macros),
 * we must also set posixlib's macro guards to prevent redefinition.
 */
#ifndef _DIRENT_H_
#define _DIRENT_H_ 1
#endif
#ifndef _SYS_DIRENT_H_
#define _SYS_DIRENT_H_ 1
#endif

/* Suppress posixlib sys/types.h entirely -- it would redefine
 * uid_t, gid_t, mode_t, off_t, pid_t, dev_t, ino_t, etc. that
 * sharedlib_posix.h already provides. */
#ifndef _SYS_TYPES_H_
#define _SYS_TYPES_H_ 1
#endif

/* Also suppress both posixlib and project-include unistd.h --
 * posixlib's pulls in sys/types.h which conflicts with our types,
 * project-include's re-typedefs ssize_t/off_t/pid_t.
 * We provide our own declarations for the POSIX fd functions. */
#ifndef _UNISTD_H_
#define _UNISTD_H_ 1
#endif
#ifndef _AMIGA_UNISTD_H
#define _AMIGA_UNISTD_H 1
#endif

/* Provide compat types that VBCC posixlib headers might reference
 * (e.g. u_int32_t in sys/stat.h -- which we've already suppressed,
 * but define these defensively). */
#include <stdint.h>
typedef uint8_t   u_int8_t;
typedef uint16_t  u_int16_t;
typedef uint32_t  u_int32_t;

/* POSIX fd-level I/O declarations that quickjs-libc.c calls directly.
 * These are normally declared in <unistd.h> which we've suppressed.
 * Implementations must be provided in sharedlib_posix.c or linked
 * from VBCC posix.lib. */
int    close(int fd);
int    read(int fd, void *buf, size_t count);
int    write(int fd, const void *buf, size_t count);
off_t  lseek(int fd, off_t offset, int whence);
long   sysconf(int name);
/* open() is declared in <fcntl.h> which quickjs-libc.c includes */

/* === Step 4: Provide amiga_force_color definition ===
 *
 * The upstream file declares `extern int amiga_force_color` in
 * the __VBCC__ block.  We provide the actual storage here.
 */
int amiga_force_color = 0;

/* === Step 5: environ (POSIX environment) ===
 *
 * quickjs-libc.c references `environ` for os.environ() and
 * os.exec().  On AmigaOS there's no POSIX environ; provide
 * an empty array.
 */
static char *_amiga_environ_empty[] = { NULL };
char **environ = _amiga_environ_empty;

/* === Step 6: DOSBase for <proto/dos.h> inline calls ===
 *
 * The upstream quickjs-libc.c includes <proto/dos.h> in the
 * __SASC||__VBCC__ block (for amiga_read_stdin) and uses
 * Read(), Input() which need DOSBase.  In a shared library
 * there is no C startup code to set globals, so we provide
 * our own.  Call quickjs_libc_lib_init() from CustomLibInit.
 */
#include <dos/dosextens.h>
struct DosLibrary *DOSBase = NULL;

void quickjs_libc_lib_init(struct Library *dosBase)
{
    DOSBase = (struct DosLibrary *)dosBase;
}

void quickjs_libc_lib_cleanup(void)
{
    DOSBase = NULL;
}

/* === Step 7: popen/pclose stubs ===
 *
 * The upstream urlGet code for non-__SASC falls through to a
 * popen("curl ...") path.  In the shared library we don't link
 * with posix.lib so popen is unavailable.  Provide stubs that
 * return failure -- urlGet will report "could not start curl".
 */
#include <stdio.h>
FILE *popen(const char *command, const char *mode)
{
    (void)command;
    (void)mode;
    return NULL;
}

int pclose(FILE *stream)
{
    (void)stream;
    return -1;
}

/* === Step 8: fdopen/fileno ===
 *
 * fileno: map FILE* back to fd number.
 * stdin=0, stdout=1, stderr=2, others via sharedlib_clib fd table.
 */
extern FILE *stdin, *stdout, *stderr;

FILE *fdopen(int fd, const char *mode)
{
    (void)fd;
    (void)mode;
    return NULL;
}

int fileno(FILE *stream)
{
    if (!stream) return -1;
    if (stream == stdin) return 0;
    if (stream == stdout) return 1;
    if (stream == stderr) return 2;
    return -1;
}

/* === Step 9: Include the actual quickjs-libc.c ===
 *
 * The upstream file's __VBCC__ guards handle:
 *  - Including amiga_compat_vbcc.h and proto/exec.h (skipped: already done)
 *  - Stub headers for sys/ioctl.h, poll.h, dlfcn.h, termios.h, etc.
 *  - sighandler_t typedef and environ declaration
 *  - Disabling popen, tmpfile, fork/exec, signal handlers, workers
 *  - AmigaOS-specific stdin reading (amiga_read_stdin with CSI translation)
 *  - AmigaOS SystemTags for os.exec
 *
 * Because we've already included amiga_compat_vbcc.h above, the
 * __VBCC__ block at the top of quickjs-libc.c will include it again
 * but the header guard (_AMIGA_COMPAT_VBCC_H) prevents double inclusion.
 */
#include "../../quickjs-master/quickjs-libc.c"

/* ==================================================================
 * W7 — qjs:net module
 *
 * Exposes the networking capability probe (done once at library
 * load in qjsfuncs.c:qjs_probe_net_caps) to JS, plus a reprobe()
 * for picking up newly-installed libraries at runtime.
 *
 *   import * as Networking from "qjs:net";
 *   Networking.hasTCP()   -> boolean
 *   Networking.hasTLS()   -> boolean
 *   Networking.status()   -> { tcp, tls }
 *   Networking.reprobe()  -> { tcp, tls }  (also updates cached caps)
 *
 * fetch() consults the cached caps before attempting any request
 * and throws a clear TypeError naming the missing library.
 * ================================================================== */

#include "libraryconfig.h"

extern LIBRARY_BASE_TYPE *_qjs_lib_base;
extern ULONG qjs_reprobe_net_caps(LIBRARY_BASE_TYPE *aBase);

/* Non-static: js_fetch (inside the upstream include above) declares
 * this extern and calls it before fetch_create on VBCC builds. */
ULONG qjs_net_caps_current(void)
{
    return _qjs_lib_base ? _qjs_lib_base->iNetCaps : 0;
}

static JSValue js_net_hasTCP(JSContext *ctx, JSValueConst this_val,
                             int argc, JSValueConst *argv)
{
    return JS_NewBool(ctx, (qjs_net_caps_current() & QJS_NET_TCP) ? 1 : 0);
}

static JSValue js_net_hasTLS(JSContext *ctx, JSValueConst this_val,
                             int argc, JSValueConst *argv)
{
    return JS_NewBool(ctx, (qjs_net_caps_current() & QJS_NET_TLS) ? 1 : 0);
}

static JSValue js_net_build_status(JSContext *ctx, ULONG caps)
{
    JSValue obj = JS_NewObject(ctx);
    if (JS_IsException(obj)) return obj;
    JS_SetPropertyStr(ctx, obj, "tcp",
                      JS_NewBool(ctx, (caps & QJS_NET_TCP) ? 1 : 0));
    JS_SetPropertyStr(ctx, obj, "tls",
                      JS_NewBool(ctx, (caps & QJS_NET_TLS) ? 1 : 0));
    return obj;
}

static JSValue js_net_status(JSContext *ctx, JSValueConst this_val,
                             int argc, JSValueConst *argv)
{
    return js_net_build_status(ctx, qjs_net_caps_current());
}

static JSValue js_net_reprobe(JSContext *ctx, JSValueConst this_val,
                              int argc, JSValueConst *argv)
{
    ULONG caps = 0;
    if (_qjs_lib_base)
        caps = qjs_reprobe_net_caps(_qjs_lib_base);
    return js_net_build_status(ctx, caps);
}

static const JSCFunctionListEntry js_net_funcs[] = {
    JS_CFUNC_DEF("hasTCP",  0, js_net_hasTCP),
    JS_CFUNC_DEF("hasTLS",  0, js_net_hasTLS),
    JS_CFUNC_DEF("status",  0, js_net_status),
    JS_CFUNC_DEF("reprobe", 0, js_net_reprobe),
};

static int js_net_init(JSContext *ctx, JSModuleDef *m)
{
    return JS_SetModuleExportList(ctx, m, js_net_funcs,
                                  countof(js_net_funcs));
}

JSModuleDef *js_init_module_net(JSContext *ctx, const char *module_name)
{
    JSModuleDef *m;
    m = JS_NewCModule(ctx, module_name, js_net_init);
    if (!m) return NULL;
    JS_AddModuleExportList(ctx, m, js_net_funcs, countof(js_net_funcs));
    return m;
}
