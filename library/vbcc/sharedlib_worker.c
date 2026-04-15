/* sharedlib_worker.c -- Native Worker primitive for quickjs.library.
 *
 * Design: docs/WORKER_API.md
 * Rationale: Fina decision decision:qp7wyp93qvzqhmpv7f4y
 *
 * Creates preemptive AmigaOS processes with automatic per-task library
 * base management. Each worker gets its own bsdsocket.library / AmiSSL /
 * dos.library bases opened IN the worker's task — safe against the
 * per-task base constraint that breaks fetch's one-off plumbing.
 *
 * Concurrency: N workers run simultaneously. No global handoff slot;
 * spawn uses Forbid/Permit + tc_UserData for atomic handoff. Each
 * worker is an independent struct allocated from public memory.
 *
 * This file is built into quickjs.library. LVO trampolines live in
 * library/vbcc/qjsfuncs_asm_all.s.
 */

#include <exec/types.h>
#include <exec/memory.h>
#include <exec/libraries.h>
#include <exec/execbase.h>
#include <exec/ports.h>
#include <exec/tasks.h>
#include <dos/dos.h>
#include <dos/dosextens.h>
#include <dos/dostags.h>
#include <utility/tagitem.h>

#include "amiga_worker.h"

/* ================================================================
 * LVO stubs -- exec.library, dos.library
 *
 * bsdsocket / AmiSSL bases are opened inside the worker task via the
 * generic OpenLibrary LVO, not the library globals.
 * ================================================================ */
extern struct ExecBase *SysBase;
extern struct Library *_qjs_DOSBase;   /* set during CustomLibInit */

static void *__w_AllocMem(__reg("a6") struct ExecBase *base,
                          __reg("d0") unsigned long size,
                          __reg("d1") unsigned long flags)
    = "\tjsr\t-198(a6)";
#define w_AllocMem(s, f) __w_AllocMem(SysBase, (s), (f))

static void __w_FreeMem(__reg("a6") struct ExecBase *base,
                        __reg("a1") void *mem,
                        __reg("d0") unsigned long size)
    = "\tjsr\t-210(a6)";
#define w_FreeMem(m, s) __w_FreeMem(SysBase, (m), (s))

static long __w_AllocSignal(__reg("a6") struct ExecBase *base,
                            __reg("d0") long signalNum)
    = "\tjsr\t-330(a6)";
#define w_AllocSignal(n) __w_AllocSignal(SysBase, (n))

static void __w_FreeSignal(__reg("a6") struct ExecBase *base,
                           __reg("d0") long signalNum)
    = "\tjsr\t-336(a6)";
#define w_FreeSignal(n) __w_FreeSignal(SysBase, (n))

static struct MsgPort *__w_CreateMsgPort(__reg("a6") struct ExecBase *base)
    = "\tjsr\t-666(a6)";
#define w_CreateMsgPort() __w_CreateMsgPort(SysBase)

static void __w_DeleteMsgPort(__reg("a6") struct ExecBase *base,
                              __reg("a0") struct MsgPort *port)
    = "\tjsr\t-672(a6)";
#define w_DeleteMsgPort(p) __w_DeleteMsgPort(SysBase, (p))

static void __w_PutMsg(__reg("a6") struct ExecBase *base,
                       __reg("a0") struct MsgPort *port,
                       __reg("a1") struct Message *msg)
    = "\tjsr\t-366(a6)";
#define w_PutMsg(p, m) __w_PutMsg(SysBase, (p), (m))

static struct Message *__w_GetMsg(__reg("a6") struct ExecBase *base,
                                  __reg("a0") struct MsgPort *port)
    = "\tjsr\t-372(a6)";
#define w_GetMsg(p) __w_GetMsg(SysBase, (p))

static unsigned long __w_WaitPort(__reg("a6") struct ExecBase *base,
                                  __reg("a0") struct MsgPort *port)
    = "\tjsr\t-384(a6)";
#define w_WaitPort(p) __w_WaitPort(SysBase, (p))

static struct Task *__w_FindTask(__reg("a6") struct ExecBase *base,
                                 __reg("a1") const char *name)
    = "\tjsr\t-294(a6)";
#define w_FindTask(n) __w_FindTask(SysBase, (n))

static void __w_Forbid(__reg("a6") struct ExecBase *base)
    = "\tjsr\t-132(a6)";
#define w_Forbid() __w_Forbid(SysBase)

static void __w_Permit(__reg("a6") struct ExecBase *base)
    = "\tjsr\t-138(a6)";
#define w_Permit() __w_Permit(SysBase)

static struct Library *__w_OpenLibrary(__reg("a6") struct ExecBase *base,
                                       __reg("a1") const char *name,
                                       __reg("d0") unsigned long version)
    = "\tjsr\t-552(a6)";
#define w_OpenLibrary(n, v) __w_OpenLibrary(SysBase, (n), (v))

static void __w_CloseLibrary(__reg("a6") struct ExecBase *base,
                             __reg("a1") struct Library *lib)
    = "\tjsr\t-414(a6)";
#define w_CloseLibrary(l) __w_CloseLibrary(SysBase, (l))

static struct Process *__w_CreateNewProc(__reg("a6") struct Library *base,
                                         __reg("d1") struct TagItem *tags)
    = "\tjsr\t-498(a6)";
#define w_CreateNewProc(t) __w_CreateNewProc(_qjs_DOSBase, (t))

/* ================================================================
 * QJSWorker internal struct
 *
 * Lives in MEMF_PUBLIC so both tasks can read/write. The state word
 * is accessed via simple volatile longword; aligned 68k longword
 * reads/writes are atomic (single writer / single reader).
 * ================================================================ */
struct QJSWorker {
    /* Identity & config */
    QJSWorkerJobFn    job_fn;
    void             *user_data;
    unsigned long     flags;

    /* State (volatile — updated by worker, read by main)
     *   QJS_WORKER_PENDING  -> RUNNING -> (DONE | FAILED)
     */
    volatile unsigned long state;
    volatile long            result;   /* job_fn's return value (DONE only) */

    /* Per-worker library bases — opened IN the worker task */
    struct Library *socket_base;
    struct Library *ssl_base;          /* amissl_v*.library (selected by master) */
    struct Library *ssl_ext_base;      /* amissl extended base */
    struct Library *ssl_master_base;   /* amisslmaster.library */
    struct Library *dos_base;
    void           *ssl_ctx;           /* SSL_CTX* opaque; created by job code */

    /* Reply port — main creates, worker PutMsg's on completion.
     * Join uses WaitPort on this; Poll uses state word only. */
    struct MsgPort  *reply_port;
    struct Message   reply_msg;       /* embedded, worker never allocates */

    /* Size of this allocation (for FreeMem) */
    unsigned long    alloc_size;
};

/* ================================================================
 * AmiSSL support — we need SSL_CTX_new / SSL_CTX_free / TLS_client_method
 * inside the worker. These are AmiSSL LVOs. The base we just opened is
 * amissl_v*.library; the actual LVO indices come from the AmiSSL fd file.
 *
 * For V1 we declare only what the framework itself needs (SSL_CTX
 * lifecycle). Worker job code that wants to DO TLS uses the same
 * LVOs via its own stubs (sharedlib_fetch.c already has SSL_new etc.).
 * ================================================================ */
extern int amiga_ssl_init(void);  /* defined in amiga_ssl_lib.c */
extern void *SSL_CTX_new(const void *method);
extern void SSL_CTX_free(void *ctx);
extern const void *TLS_client_method(void);
/* These are declared by amissl/openssl headers — resolved by the
 * worker's own AmiSSL base at call time. */

/* Open bsdsocket.library — required for SSL */
static int worker_open_socket(struct QJSWorker *w)
{
    if (w->socket_base) return 0;
    w->socket_base = w_OpenLibrary("bsdsocket.library", 4);
    return w->socket_base ? 0 : -1;
}

/* OpenAmiSSLTagList LVO — master library's version broker.
 *
 * Takes AMISSL_CURRENT_VERSION (from the SDK we're built against) and
 * returns the AmiSSL base + extended base for whichever sub-library
 * is newest AND installed on the user's system. As new AmiSSL versions
 * ship (OpenSSL 3.0, 3.1, etc.), the user rebuilds with a newer SDK
 * and gets the update for free. No hardcoded amissl_v111.library by
 * name — that'd lock us to OpenSSL 1.1.1 forever.
 *
 * LVO offsets from sdks/AmiSSL-v5.26-SDK/Developer/fd/amisslmaster_lib.fd:
 *   InitAmiSSLMaster    = -30
 *   OpenAmiSSL          = -36
 *   CloseAmiSSL         = -42
 *   OpenAmiSSLCipher    = -48
 *   CloseAmiSSLCipher   = -54
 *   OpenAmiSSLTagList   = -60
 */
static long __w_OpenAmiSSLTagList(__reg("a6") struct Library *base,
                                  __reg("d0") long version,
                                  __reg("a0") struct TagItem *tags)
    = "\tjsr\t-60(a6)";
#define w_OpenAmiSSLTagList(v, t) __w_OpenAmiSSLTagList(w->ssl_master_base, (v), (t))

static void __w_CloseAmiSSL(__reg("a6") struct Library *base)
    = "\tjsr\t-42(a6)";
#define w_CloseAmiSSL() __w_CloseAmiSSL(w->ssl_master_base)

/* AmiSSL tag IDs — MUST match sdks/AmiSSL-v5.26-SDK/Developer/include/amissl/tags.h.
 * Defined here to avoid pulling the full header's type web into this file.
 * Base is TAG_USER (from utility/tagitem.h), not some bespoke TAG_USER_BASE. */
#define AmiSSL_SocketBase           (TAG_USER + 0x01)
#define AmiSSL_ErrNoPtr             (TAG_USER + 0x0b)
#define AmiSSL_UsesOpenSSLStructs   (TAG_USER + 0x0c)
#define AmiSSL_GetAmiSSLBase        (TAG_USER + 0x0d)
#define AmiSSL_GetAmiSSLExtBase     (TAG_USER + 0x0e)

/* AMISSL_CURRENT_VERSION resolves to whatever the installed SDK's
 * headers declare — for AmiSSL-v5.26-SDK this is the latest OpenSSL
 * binding the SDK targets (currently OpenSSL 1.1.1w; will become 3.x
 * when rebuilt against a newer SDK). */
#include <libraries/amisslmaster.h>
#ifndef AMISSL_CURRENT_VERSION
#define AMISSL_CURRENT_VERSION AMISSLMASTER_VERSION
#endif

/* Open AmiSSL correctly — use the master library's version broker
 * so we automatically pick up whatever the installed SDK targets.
 * Matches the main-task path in amiga_ssl_lib.c. */
static int worker_open_ssl(struct QJSWorker *w)
{
    struct TagItem ssl_tags[6];
    static int worker_errno;  /* per-task errno for AmiSSL; simple for now */

    if (worker_open_socket(w) != 0) return -1;

    /* Open master — AMISSLMASTER_MIN_VERSION is 5 per the v5.26 SDK
     * (libraries/amisslmaster.h). Must match amiga_ssl_lib.c's main-task
     * path for consistent behavior. */
    w->ssl_master_base = w_OpenLibrary("amisslmaster.library",
                                       AMISSLMASTER_MIN_VERSION);
    if (!w->ssl_master_base) return -1;

    /* Let the master pick the newest installed sub-library that
     * satisfies AMISSL_CURRENT_VERSION. Populates &w->ssl_base and
     * &w->ssl_ext_base in return. */
    ssl_tags[0].ti_Tag = AmiSSL_UsesOpenSSLStructs;
    ssl_tags[0].ti_Data = (ULONG)FALSE;
    ssl_tags[1].ti_Tag = AmiSSL_GetAmiSSLBase;
    ssl_tags[1].ti_Data = (ULONG)&w->ssl_base;
    ssl_tags[2].ti_Tag = AmiSSL_GetAmiSSLExtBase;
    ssl_tags[2].ti_Data = (ULONG)&w->ssl_ext_base;
    ssl_tags[3].ti_Tag = AmiSSL_SocketBase;
    ssl_tags[3].ti_Data = (ULONG)w->socket_base;
    ssl_tags[4].ti_Tag = AmiSSL_ErrNoPtr;
    ssl_tags[4].ti_Data = (ULONG)&worker_errno;
    ssl_tags[5].ti_Tag = TAG_DONE;
    ssl_tags[5].ti_Data = 0;

    if (w_OpenAmiSSLTagList(AMISSL_CURRENT_VERSION, ssl_tags) != 0) {
        w_CloseLibrary(w->ssl_master_base);
        w->ssl_master_base = NULL;
        return -1;
    }

    /* SSL_CTX creation is left to the worker job — the framework
     * is agnostic to TLS_client_method vs TLS_server_method etc. */
    return 0;
}

/* Open dos.library — cheap, always succeeds when DOS is loaded */
static int worker_open_dos(struct QJSWorker *w)
{
    if (w->dos_base) return 0;
    w->dos_base = w_OpenLibrary("dos.library", 36);
    return w->dos_base ? 0 : -1;
}

static void worker_close_bases(struct QJSWorker *w)
{
    /* AmiSSL cleanup goes through the master's CloseAmiSSL call — this
     * releases whichever amissl_v*.library the master opened for us,
     * plus the extended base. Don't CloseLibrary ssl_base directly. */
    if (w->ssl_master_base && w->ssl_base) {
        w_CloseAmiSSL();
        w->ssl_base = NULL;
        w->ssl_ext_base = NULL;
    }
    if (w->ssl_master_base) {
        w_CloseLibrary(w->ssl_master_base);
        w->ssl_master_base = NULL;
    }
    if (w->socket_base) {
        w_CloseLibrary(w->socket_base);
        w->socket_base = NULL;
    }
    if (w->dos_base) {
        w_CloseLibrary(w->dos_base);
        w->dos_base = NULL;
    }
}

/* ================================================================
 * Worker entry trampoline
 *
 * Runs in the spawned worker task. Retrieves its QJSWorker pointer
 * from tc_UserData (set by main under Forbid before Permit), opens
 * requested bases, calls job_fn, cleans up, signals completion.
 * ================================================================ */
static void worker_entry(void)
{
    struct Task *me = w_FindTask(NULL);
    struct QJSWorker *w = (struct QJSWorker *)me->tc_UserData;
    int rc = 0;

    if (!w) {
        /* Should never happen — main task set this under Forbid
         * before Permit, so we can't observe it as NULL. If it does,
         * just exit; caller sees PENDING forever, which is caught by
         * a watchdog or by the consumer's own timeout. */
        return;
    }

    w->state = QJS_WORKER_RUNNING;

    /* Open requested per-task bases. If any requested base fails to
     * open, mark FAILED and skip job_fn. */
    if (w->flags & QJS_WORKER_WANT_SOCKET) {
        if (worker_open_socket(w) != 0) {
            w->state = QJS_WORKER_FAILED;
            goto signal_done;
        }
    }
    if (w->flags & QJS_WORKER_WANT_SSL) {
        if (worker_open_ssl(w) != 0) {
            w->state = QJS_WORKER_FAILED;
            goto signal_done;
        }
    }
    if (w->flags & QJS_WORKER_WANT_DOS) {
        if (worker_open_dos(w) != 0) {
            w->state = QJS_WORKER_FAILED;
            goto signal_done;
        }
    }

    /* Run the consumer's job. */
    rc = w->job_fn(w, w->user_data);
    w->result = rc;
    w->state = QJS_WORKER_DONE;

signal_done:
    worker_close_bases(w);

    /* PutMsg on reply port — wakes a joiner blocked in WaitPort. */
    if (w->reply_port) {
        w->reply_msg.mn_Node.ln_Type = NT_MESSAGE;
        w->reply_msg.mn_Length = sizeof(w->reply_msg);
        w->reply_msg.mn_ReplyPort = NULL;  /* no reply needed */
        w_PutMsg(w->reply_port, &w->reply_msg);
    }
    /* Worker process exits when this function returns. */
}

/* ================================================================
 * Public API — called from LVO trampolines in qjsfuncs_asm_all.s
 * (which already strip the __reg("a6") base arg).
 * ================================================================ */
QJSWorker *QJS_WorkerSpawn_impl(QJSWorkerJobFn job_fn,
                                void *user_data,
                                unsigned long flags)
{
    struct QJSWorker *w;
    struct Process *proc;
    struct TagItem tags[7];
    unsigned long size = sizeof(struct QJSWorker);

    if (!job_fn) return NULL;

    /* Allocate from MEMF_PUBLIC so both tasks can access. */
    w = (struct QJSWorker *)w_AllocMem(size, MEMF_PUBLIC | MEMF_CLEAR);
    if (!w) return NULL;

    w->job_fn     = job_fn;
    w->user_data  = user_data;
    w->flags      = flags;
    w->state      = QJS_WORKER_PENDING;
    w->alloc_size = size;

    /* Create reply port (used by Join's WaitPort; also keeps the
     * embedded reply_msg routable). */
    w->reply_port = w_CreateMsgPort();
    if (!w->reply_port) {
        w_FreeMem(w, size);
        return NULL;
    }

    /* Fill NP_* tags for CreateNewProc. */
    tags[0].ti_Tag = NP_Entry;       tags[0].ti_Data = (ULONG)worker_entry;
    tags[1].ti_Tag = NP_Name;        tags[1].ti_Data = (ULONG)"qjs_worker";
    tags[2].ti_Tag = NP_StackSize;   tags[2].ti_Data = 32768;
    tags[3].ti_Tag = NP_Priority;    tags[3].ti_Data = 0;
    tags[4].ti_Tag = NP_CopyVars;    tags[4].ti_Data = FALSE;
    tags[5].ti_Tag = NP_CurrentDir;  tags[5].ti_Data = 0;    /* none */
    tags[6].ti_Tag = TAG_END;        tags[6].ti_Data = 0;

    /* Atomic handoff: the spawned task won't run until Permit(),
     * so setting tc_UserData between CreateNewProc and Permit is
     * guaranteed to be visible to the worker before worker_entry
     * executes. This is the standard AmigaOS idiom for passing
     * user data to a new process when NP_UserData isn't supported
     * on this OS version. */
    w_Forbid();
    proc = w_CreateNewProc(tags);
    if (proc) {
        proc->pr_Task.tc_UserData = w;
    }
    w_Permit();

    if (!proc) {
        w_DeleteMsgPort(w->reply_port);
        w_FreeMem(w, size);
        return NULL;
    }

    return w;
}

long QJS_WorkerPoll_impl(QJSWorker *worker)
{
    if (!worker) return QJS_WORKER_FAILED;
    return (long)worker->state;
}

long QJS_WorkerJoin_impl(QJSWorker *worker)
{
    if (!worker) return -1;

    /* Fast path: already done */
    if (worker->state == QJS_WORKER_DONE)   return worker->result;
    if (worker->state == QJS_WORKER_FAILED) return -1;

    /* Kernel-blocking wait. WaitPort suspends this task entirely
     * until worker PutMsg's the reply port. Zero CPU while waiting;
     * other workers keep running. */
    (void)w_WaitPort(worker->reply_port);
    (void)w_GetMsg(worker->reply_port);  /* dequeue our msg */

    if (worker->state == QJS_WORKER_DONE)   return worker->result;
    return -1;
}

void QJS_WorkerDestroy_impl(QJSWorker *worker)
{
    if (!worker) return;

    /* Safety: if the worker is still RUNNING/PENDING, destroying would
     * leave the worker task writing to freed memory. Refuse to destroy
     * in-flight workers — caller must Join or Poll until DONE/FAILED
     * first. We can't assert-abort from a library, so: drain the
     * reply port just in case, then free. */
    if (worker->state == QJS_WORKER_PENDING ||
        worker->state == QJS_WORKER_RUNNING) {
        /* This is a programming error by the consumer. Block-join to
         * prevent corruption. */
        (void)QJS_WorkerJoin_impl(worker);
    }

    if (worker->reply_port) {
        /* Drain any pending messages (should be just our own). */
        while (w_GetMsg(worker->reply_port)) { /* discard */ }
        w_DeleteMsgPort(worker->reply_port);
        worker->reply_port = NULL;
    }

    w_FreeMem(worker, worker->alloc_size);
}

struct Library *QJS_WorkerGetBase_impl(QJSWorker *worker, unsigned long which)
{
    if (!worker) return NULL;
    switch (which) {
        case QJS_WORKER_BASE_SOCKET: return worker->socket_base;
        case QJS_WORKER_BASE_SSL:    return worker->ssl_base;
        case QJS_WORKER_BASE_DOS:    return worker->dos_base;
        default:                     return NULL;
    }
}
