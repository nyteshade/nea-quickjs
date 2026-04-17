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

extern void crypto_cleanup_ssl(void);

void quickjs_libc_lib_cleanup(void)
{
    /* E1 — close the lazy-opened AmiSSL handle if any. */
    crypto_cleanup_ssl();
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

/* ==================================================================
 * D5 — qjs:child_process module
 *
 * spawnSync(cmdline) -> { stdout, stderr, exitCode, signal }
 *
 * Uses dos.library SystemTagList with SYS_Output/SYS_Error pointed
 * at T:qjs-cp-<task>-{out,err} temp files. After the child exits,
 * the handles are closed (defensively — SystemTagList owns them
 * during execution), the files are reopened for reading, their
 * contents slurped, and the files unlinked.
 *
 * v1 is synchronous only. Async spawn() can be layered on top via
 * the Worker primitive in a follow-up (or via Promise.resolve() in
 * JS if callers want the shape).
 *
 * SYS_Error is V50+. On V47 it's silently ignored — stderr goes
 * wherever the child's default error stream points (usually the
 * console). That's acceptable for a classic-OS port.
 * ================================================================== */

#include <dos/dostags.h>
#include <proto/dos.h>

/* snprintf is provided by sharedlib_printf.c — declare extern like
 * sharedlib_fetch.c does, since VBCC's stdio.h isn't in scope here. */
extern int snprintf(char *, size_t, const char *, ...);

/* errno is in sharedlib_clib.c; AmiSSL's AmiSSL_ErrNoPtr tag wants
 * its address so per-call OpenSSL errors don't touch NULL. Without
 * this the hash call crashes with AN_IntrMem ($81000005). */
extern int errno;

/* Read file contents into a newly-allocated buffer. Returns NULL if the
 * file doesn't exist or is empty; sets *plen to 0 in those cases. */
static char *slurp_temp(JSContext *ctx, const char *path, LONG *plen)
{
    BPTR fh;
    LONG size, got;
    char *buf;

    *plen = 0;
    fh = Open((STRPTR)path, MODE_OLDFILE);
    if (!fh) return NULL;

    /* Seek to END to get size, then back to start. */
    Seek(fh, 0, OFFSET_END);
    size = Seek(fh, 0, OFFSET_BEGINNING);
    if (size <= 0) {
        Close(fh);
        return NULL;
    }

    buf = js_malloc(ctx, size + 1);
    if (!buf) {
        Close(fh);
        return NULL;
    }
    got = Read(fh, buf, size);
    Close(fh);
    if (got < 0) got = 0;
    buf[got] = '\0';
    *plen = got;
    return buf;
}

static JSValue js_child_process_spawnSync(JSContext *ctx, JSValueConst this_val,
                                          int argc, JSValueConst *argv)
{
    const char *cmdline;
    char out_path[64], err_path[64];
    BPTR outfh = 0, errfh = 0;
    struct TagItem tags[3];
    LONG rc;
    char *out_buf, *err_buf;
    LONG out_len = 0, err_len = 0;
    JSValue result;
    struct Task *me;

    if (argc < 1) return JS_ThrowTypeError(ctx, "spawnSync: cmdline required");
    if (!DOSBase) return JS_ThrowInternalError(ctx, "spawnSync: DOSBase not set");

    cmdline = JS_ToCString(ctx, argv[0]);
    if (!cmdline) return JS_EXCEPTION;

    me = FindTask(NULL);
    snprintf(out_path, sizeof(out_path), "T:qjs-cp-%08lx-out", (unsigned long)me);
    snprintf(err_path, sizeof(err_path), "T:qjs-cp-%08lx-err", (unsigned long)me);

    outfh = Open((STRPTR)out_path, MODE_NEWFILE);
    errfh = Open((STRPTR)err_path, MODE_NEWFILE);
    if (!outfh || !errfh) {
        if (outfh) Close(outfh);
        if (errfh) Close(errfh);
        JS_FreeCString(ctx, cmdline);
        return JS_ThrowInternalError(ctx,
            "spawnSync: could not open temp files in T:");
    }

    tags[0].ti_Tag  = SYS_Output; tags[0].ti_Data = (ULONG)outfh;
    tags[1].ti_Tag  = SYS_Error;  tags[1].ti_Data = (ULONG)errfh;
    tags[2].ti_Tag  = TAG_DONE;   tags[2].ti_Data = 0;

    /* Synchronous — blocks the calling task until the child exits. */
    rc = SystemTagList((STRPTR)cmdline, tags);

    /* SystemTagList docs are ambiguous about whether the handles are
     * closed on return for non-Asynch calls. Close defensively; a
     * double-close on Amiga is harmless. */
    Close(outfh);
    Close(errfh);

    out_buf = slurp_temp(ctx, out_path, &out_len);
    err_buf = slurp_temp(ctx, err_path, &err_len);

    DeleteFile((STRPTR)out_path);
    DeleteFile((STRPTR)err_path);

    result = JS_NewObject(ctx);
    if (JS_IsException(result)) {
        if (out_buf) js_free(ctx, out_buf);
        if (err_buf) js_free(ctx, err_buf);
        JS_FreeCString(ctx, cmdline);
        return result;
    }

    JS_SetPropertyStr(ctx, result, "stdout",
        JS_NewStringLen(ctx, out_buf ? out_buf : "", out_len));
    JS_SetPropertyStr(ctx, result, "stderr",
        JS_NewStringLen(ctx, err_buf ? err_buf : "", err_len));
    JS_SetPropertyStr(ctx, result, "exitCode", JS_NewInt32(ctx, rc));
    JS_SetPropertyStr(ctx, result, "signal",   JS_NULL);

    if (out_buf) js_free(ctx, out_buf);
    if (err_buf) js_free(ctx, err_buf);
    JS_FreeCString(ctx, cmdline);
    return result;
}

/* Called by the CLI via QJS_InstallChildProcessGlobal LVO. Attaches the
 * native spawnSync to globalThis.__qjs_spawnSync; extended.js's
 * child-process manifest wraps that in a Node-style API. No qjs:module
 * registration — host qjsc doesn't know this file, so a module import
 * would fail at bytecode-compile time. Global attachment avoids that. */
void qjs_install_child_process_global(JSContext *ctx)
{
    JSValue global, fn;
    global = JS_GetGlobalObject(ctx);
    fn = JS_NewCFunction(ctx, js_child_process_spawnSync, "__qjs_spawnSync", 1);
    JS_SetPropertyStr(ctx, global, "__qjs_spawnSync", fn);
    JS_FreeValue(ctx, global);
}

/* ==================================================================
 * E1 — crypto.subtle.digest via AmiSSL one-shot SHA functions
 *
 * Per-call AmiSSL open/close for v1. Keeps the implementation simple
 * and thread-safe: each call to the native digest function opens
 * amisslmaster + a per-task AmiSSL handle, computes the hash, closes.
 * Overhead is a few ms per call — acceptable for file checksums and
 * auth tokens. Hot-loop users can cache at JS level.
 *
 * Exposed as globalThis.__qjs_cryptoDigest(algName, bytes):
 *   algName -- one of "SHA-1", "SHA-256", "SHA-384", "SHA-512", "MD5"
 *   bytes   -- ArrayBuffer | TypedArray view
 * Returns an ArrayBuffer containing the raw digest bytes.
 *
 * extended.js's crypto manifest wraps this in WebCrypto shape:
 * globalThis.crypto.subtle.digest(algo, data) -> Promise<ArrayBuffer>.
 * Also provides getRandomValues() and randomUUID() using AmigaOS
 * entropy sources (EClock micros, DateStamp) — not CSPRNG-grade,
 * adequate for non-cryptographic IDs.
 * ================================================================== */

/* AmiSSL bases — separate from amiga_ssl_lib.c's globals to avoid
 * clobbering fetch-worker bases. Opened per-call in the calling task. */
#include <libraries/amisslmaster.h>
#include <amissl/tags.h>
#include <inline/amisslmaster_protos.h>

/* DateStamp for getRandomValues seeding (dos.library LVO -192).
 * Matches the pattern used in sharedlib_time.c. */
static struct DateStamp *__sl_DateStamp_lib(__reg("a6") struct Library *base,
    __reg("d1") struct DateStamp *ds) = "\tjsr\t-192(a6)";
#define sl_DateStamp_lib(ds)  __sl_DateStamp_lib((struct Library *)DOSBase, (ds))

/* SHA/MD5 one-shot inline stubs. LVO offsets from AmiSSL SDK's
 * inline/amissl_protos.h. Same __reg("a6") pattern used throughout. */
static unsigned char *__cpy_MD5(__reg("a6") struct Library *base,
    __reg("a0") const unsigned char *d, __reg("d0") size_t n,
    __reg("a1") unsigned char *md) = "\tjsr\t-14508(a6)";
static unsigned char *__cpy_SHA1(__reg("a6") struct Library *base,
    __reg("a0") const unsigned char *d, __reg("d0") size_t n,
    __reg("a1") unsigned char *md) = "\tjsr\t-15030(a6)";
static unsigned char *__cpy_SHA256(__reg("a6") struct Library *base,
    __reg("a0") const unsigned char *d, __reg("d0") size_t n,
    __reg("a1") unsigned char *md) = "\tjsr\t-15876(a6)";
static unsigned char *__cpy_SHA512(__reg("a6") struct Library *base,
    __reg("a0") const unsigned char *d, __reg("d0") size_t n,
    __reg("a1") unsigned char *md) = "\tjsr\t-15882(a6)";
static unsigned char *__cpy_SHA224(__reg("a6") struct Library *base,
    __reg("a0") const unsigned char *d, __reg("d0") size_t n,
    __reg("a1") unsigned char *md) = "\tjsr\t-17514(a6)";
static unsigned char *__cpy_SHA384(__reg("a6") struct Library *base,
    __reg("a0") const unsigned char *d, __reg("d0") size_t n,
    __reg("a1") unsigned char *md) = "\tjsr\t-17922(a6)";

/* Digest lengths (bytes) per WebCrypto / AmiSSL. */
#define DIGEST_LEN_MD5     16
#define DIGEST_LEN_SHA1    20
#define DIGEST_LEN_SHA224  28
#define DIGEST_LEN_SHA256  32
#define DIGEST_LEN_SHA384  48
#define DIGEST_LEN_SHA512  64

/* Map WebCrypto algorithm names to (fn_ptr_selector, digest_length).
 * Returns selector 0-5 on match, -1 unknown. Selector selects the
 * __cpy_SHA* stub below. */
static int crypto_match_alg(const char *name, int *out_digest_len)
{
    if (!name || !out_digest_len) return -1;
    /* Case-insensitive compare of short constants — WebCrypto says
     * the algorithm name "is compared in a case-insensitive manner". */
    if ((name[0]=='S' || name[0]=='s') &&
        (name[1]=='H' || name[1]=='h') &&
        (name[2]=='A' || name[2]=='a')) {
        const char *p = &name[3];
        if (*p == '-') p++;  /* "SHA-256" or "SHA256" both accepted */
        if (p[0]=='1' && p[1]==0)   { *out_digest_len = DIGEST_LEN_SHA1;   return 1; }
        if (p[0]=='2' && p[1]=='5' && p[2]=='6' && p[3]==0)
            { *out_digest_len = DIGEST_LEN_SHA256; return 2; }
        if (p[0]=='5' && p[1]=='1' && p[2]=='2' && p[3]==0)
            { *out_digest_len = DIGEST_LEN_SHA512; return 3; }
        if (p[0]=='2' && p[1]=='2' && p[2]=='4' && p[3]==0)
            { *out_digest_len = DIGEST_LEN_SHA224; return 4; }
        if (p[0]=='3' && p[1]=='8' && p[2]=='4' && p[3]==0)
            { *out_digest_len = DIGEST_LEN_SHA384; return 5; }
    }
    if ((name[0]=='M' || name[0]=='m') &&
        (name[1]=='D' || name[1]=='d') &&
         name[2]=='5' && name[3]==0)
        { *out_digest_len = DIGEST_LEN_MD5; return 0; }
    return -1;
}

/* Lazy-init AmiSSL in the calling task. Opens amisslmaster.library +
 * AmiSSL on first call; subsequent calls reuse. Close happens at
 * qjs_libc_lib_cleanup() (library unload).
 *
 * Task-affinity: we record the task that did the init. If a
 * different task calls in, we refuse rather than risk corrupting
 * AmiSSL's per-task state. v1 assumption: crypto called from main
 * task only. Workers wanting crypto must open their own AmiSSL. */
static struct Library *_crypto_master_base = NULL;
static struct Library *_crypto_ssl_base    = NULL;
static struct Library *_crypto_ssl_ext     = NULL;
static struct Library *_crypto_socket_base = NULL;
static struct Task    *_crypto_owner_task  = NULL;

/* Mirror the tag set that amiga_ssl_lib.c uses for fetch — AmiSSL
 * appears to require SocketBase even when only hash functions are
 * used. Without SocketBase, OpenAmiSSLTags returns non-zero.
 * Opens bsdsocket.library v4 as a dependency. */
static int crypto_ensure_ssl(void)
{
    struct Task *me = FindTask(NULL);

    if (_crypto_ssl_base != NULL) {
        if (_crypto_owner_task == me) return 0;
        return -1;
    }

    _crypto_socket_base = OpenLibrary("bsdsocket.library", 4);
    if (!_crypto_socket_base) return -1;

    _crypto_master_base = OpenLibrary("amisslmaster.library",
                                      AMISSLMASTER_MIN_VERSION);
    if (!_crypto_master_base) {
        CloseLibrary(_crypto_socket_base);
        _crypto_socket_base = NULL;
        return -1;
    }

    {
        struct Library *AmiSSLMasterBase = _crypto_master_base;
        if (OpenAmiSSLTags(AMISSL_CURRENT_VERSION,
                           AmiSSL_UsesOpenSSLStructs, FALSE,
                           AmiSSL_GetAmiSSLBase, &_crypto_ssl_base,
                           AmiSSL_GetAmiSSLExtBase, &_crypto_ssl_ext,
                           AmiSSL_SocketBase, _crypto_socket_base,
                           AmiSSL_ErrNoPtr, &errno,
                           TAG_DONE) != 0) {
            CloseLibrary(_crypto_master_base);
            CloseLibrary(_crypto_socket_base);
            _crypto_master_base = NULL;
            _crypto_socket_base = NULL;
            _crypto_ssl_base = NULL;
            _crypto_ssl_ext  = NULL;
            return -1;
        }
    }

    if (!_crypto_ssl_base) {
        CloseLibrary(_crypto_master_base);
        CloseLibrary(_crypto_socket_base);
        _crypto_master_base = NULL;
        _crypto_socket_base = NULL;
        return -1;
    }

    _crypto_owner_task = me;
    return 0;
}

void crypto_cleanup_ssl(void)
{
    struct Task *me = FindTask(NULL);
    if (_crypto_ssl_base && _crypto_owner_task == me) {
        struct Library *AmiSSLMasterBase = _crypto_master_base;
        CloseAmiSSL();
        _crypto_ssl_base = NULL;
        _crypto_ssl_ext  = NULL;
    }
    if (_crypto_master_base) {
        CloseLibrary(_crypto_master_base);
        _crypto_master_base = NULL;
    }
    if (_crypto_socket_base) {
        CloseLibrary(_crypto_socket_base);
        _crypto_socket_base = NULL;
    }
    _crypto_owner_task = NULL;
}

/* Compute hash in-place. Uses the lazy-initialized main-task AmiSSL.
 * Returns 0 on success, -1 on failure. */
static int crypto_compute_digest(int selector, const unsigned char *data,
                                 size_t data_len, unsigned char *out_md)
{
    struct Library *ssl;

    if (crypto_ensure_ssl() != 0) return -1;
    ssl = _crypto_ssl_base;
    if (!ssl) return -1;

    switch (selector) {
        case 0: __cpy_MD5(ssl, data, data_len, out_md);    return 0;
        case 1: __cpy_SHA1(ssl, data, data_len, out_md);   return 0;
        case 2: __cpy_SHA256(ssl, data, data_len, out_md); return 0;
        case 3: __cpy_SHA512(ssl, data, data_len, out_md); return 0;
        case 4: __cpy_SHA224(ssl, data, data_len, out_md); return 0;
        case 5: __cpy_SHA384(ssl, data, data_len, out_md); return 0;
    }
    return -1;
}

static JSValue js_crypto_digest(JSContext *ctx, JSValueConst this_val,
                                int argc, JSValueConst *argv)
{
    const char *alg_name;
    int selector, digest_len;
    unsigned char hash_buf[64];  /* SHA-512 max */
    size_t data_len;
    uint8_t *data;
    JSValue result;

    if (argc < 2) return JS_ThrowTypeError(ctx, "digest: (algorithm, data) required");

    alg_name = JS_ToCString(ctx, argv[0]);
    if (!alg_name) return JS_EXCEPTION;

    selector = crypto_match_alg(alg_name, &digest_len);
    if (selector < 0) {
        JSValue err = JS_ThrowTypeError(ctx,
            "digest: unsupported algorithm '%s' (expected SHA-1/256/384/512, SHA-224, MD5)",
            alg_name);
        JS_FreeCString(ctx, alg_name);
        return err;
    }
    JS_FreeCString(ctx, alg_name);

    /* Accept ArrayBuffer or any TypedArray view. */
    data = JS_GetArrayBuffer(ctx, &data_len, argv[1]);
    if (!data) {
        /* Try as Uint8Array / typed-array view. */
        size_t byte_offset = 0, byte_length = 0, bytes_per_element = 0;
        JSValue ab = JS_GetTypedArrayBuffer(ctx, argv[1],
            &byte_offset, &byte_length, &bytes_per_element);
        if (JS_IsException(ab))
            return JS_ThrowTypeError(ctx, "digest: data must be ArrayBuffer or typed array");
        data = JS_GetArrayBuffer(ctx, &data_len, ab);
        JS_FreeValue(ctx, ab);
        if (!data)
            return JS_ThrowTypeError(ctx, "digest: couldn't access data bytes");
        data += byte_offset;
        data_len = byte_length;
    }

    if (crypto_compute_digest(selector, data, data_len, hash_buf) != 0)
        return JS_ThrowInternalError(ctx, "digest: AmiSSL open/compute failed");

    /* Return as ArrayBuffer (per WebCrypto spec). */
    result = JS_NewArrayBufferCopy(ctx, hash_buf, digest_len);
    return result;
}

/* Simple entropy source: EClock micros XOR'd with DateStamp. Not
 * CSPRNG-grade — DOCUMENT THIS in the Node-delta doc. Adequate for
 * random IDs, UUIDs, session tokens; NOT for crypto keys. */
static JSValue js_crypto_getRandomValues(JSContext *ctx, JSValueConst this_val,
                                         int argc, JSValueConst *argv)
{
    size_t byte_offset = 0, byte_length = 0, bpe = 0;
    JSValue ab;
    uint8_t *data;
    size_t data_len;
    size_t i;
    struct DateStamp ds;
    ULONG seed;

    if (argc < 1) return JS_ThrowTypeError(ctx, "getRandomValues: view required");

    ab = JS_GetTypedArrayBuffer(ctx, argv[0], &byte_offset, &byte_length, &bpe);
    if (JS_IsException(ab))
        return JS_ThrowTypeError(ctx, "getRandomValues: integer typed array required");
    data = JS_GetArrayBuffer(ctx, &data_len, ab);
    JS_FreeValue(ctx, ab);
    if (!data) return JS_ThrowTypeError(ctx, "getRandomValues: couldn't access bytes");
    if (byte_length > 65536)
        return JS_ThrowTypeError(ctx, "getRandomValues: quota exceeded (max 65536 bytes)");

    data += byte_offset;

    /* Mix DateStamp (3 longs) with a call-counter so successive calls
     * with the same tick get different output. Not CSPRNG — fine for
     * UUIDs and session IDs, NOT for crypto keys. Documented in docs. */
    {
        static ULONG _qjs_rand_counter = 0;
        _qjs_rand_counter = _qjs_rand_counter * 1664525UL + 1013904223UL;
        sl_DateStamp_lib(&ds);
        seed = (ULONG)ds.ds_Days ^ ((ULONG)ds.ds_Minute << 11) ^
               (ULONG)ds.ds_Tick ^ _qjs_rand_counter;
    }

    for (i = 0; i < byte_length; i++) {
        seed = seed * 1103515245UL + 12345UL;  /* glibc LCG constants */
        data[i] = (uint8_t)((seed >> 16) & 0xFF);
    }
    return JS_DupValue(ctx, argv[0]);
}

/* Installs globalThis.__qjs_cryptoDigest and globalThis.__qjs_cryptoRandom
 * so extended.js's crypto manifest can wrap them in WebCrypto shape. */
void qjs_install_crypto_global(JSContext *ctx)
{
    JSValue global, fn;
    global = JS_GetGlobalObject(ctx);
    fn = JS_NewCFunction(ctx, js_crypto_digest, "__qjs_cryptoDigest", 2);
    JS_SetPropertyStr(ctx, global, "__qjs_cryptoDigest", fn);
    fn = JS_NewCFunction(ctx, js_crypto_getRandomValues, "__qjs_cryptoRandom", 1);
    JS_SetPropertyStr(ctx, global, "__qjs_cryptoRandom", fn);
    JS_FreeValue(ctx, global);
}
