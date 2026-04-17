/* sharedlib_fetch.c — HTTP/HTTPS fetch implemented on the QJS_Worker
 * primitive (docs/WORKER_API.md).
 *
 * What this file owns:
 *   - URL parsing, HTTP/1.0 request assembly, response accumulation,
 *     status-line parsing (pure protocol logic).
 *   - Per-request SSL_CTX creation in the worker task (AmiSSL requires
 *     task-local state; see Fina decision decision:w4kd11c0mwdzusbvrjs9).
 *
 * What this file NO LONGER owns (was ~900 lines of plumbing):
 *   - CreateNewProc / MsgPort / Forbid-Permit handoff — now in
 *     library/vbcc/sharedlib_worker.c via QJS_WorkerSpawn & co.
 *   - Per-task library-base opening (bsdsocket, AmiSSL, dos) — now
 *     opened by the Worker framework inside the worker task.
 *   - Main-task polling via custom state fields — now QJS_WorkerPoll.
 *
 * Result: fetch is a straightforward consumer of the Worker primitive.
 * Every async feature we add next (child_process, crypto.subtle.digest,
 * async DNS, etc.) gets the same per-task isolation for free.
 */

#ifdef __VBCC__

#pragma amiga-align
#include <exec/types.h>
#include <exec/libraries.h>
#include <exec/execbase.h>
#include <exec/ports.h>
#include <exec/tasks.h>
#include <dos/dos.h>
#include <utility/tagitem.h>
#pragma default-align

#include <string.h>
#include <stddef.h>
#include "amiga_fetch.h"
#include "amiga_worker.h"

/* Forward OpenSSL opaque types */
typedef struct ssl_ctx_st    SSL_CTX;
typedef struct ssl_st        SSL;
typedef struct ssl_method_st SSL_METHOD;

/* ================================================================
 * bsdsocket.library LVO stubs
 *
 * All take base as __reg("a6"). In the original fetch these used the
 * library's global SocketBase. In the Worker-based fetch, they use
 * the worker task's own base (via QJS_WorkerGetBase). The macros below
 * hand a per-scope `_sb` pointer so the worker's base flows through.
 * ================================================================ */

/* sockaddr / hostent — field layouts MUST match AmigaOS BSD headers.
 *
 *   netinclude/netinet/in.h:
 *     struct sockaddr_in { UBYTE sin_len; UBYTE sin_family;
 *                          in_port_t sin_port; struct in_addr sin_addr;
 *                          UBYTE sin_zero[8]; };
 *   netinclude/netdb.h:
 *     struct hostent { char *h_name; char **h_aliases;
 *                      LONG h_addrtype; LONG h_length;
 *                      char **h_addr_list; };
 *
 * Two gotchas learned the hard way:
 *   - sin_family is a UBYTE preceded by a UBYTE sin_len (BSD 4.3+).
 *     A 'short sin_family' packs wrong: sin_len ends up 0 and bsdsocket
 *     rejects connect() with EADDRNOTAVAIL (errno 49).
 *   - hostent's h_addrtype/h_length are LONG, not short. A 'short'
 *     stub reads the wrong bytes for h_length and fails with
 *     "Unsupported address type". */
#pragma amiga-align
struct sockaddr_in_stub {
    unsigned char   sin_len;
    unsigned char   sin_family;
    unsigned short  sin_port;
    struct { unsigned long s_addr; } sin_addr;
    unsigned char   sin_zero[8];
};
struct hostent_stub {
    char  *h_name;
    char **h_aliases;
    long   h_addrtype;
    long   h_length;
    char **h_addr_list;
};
#pragma default-align

#define AF_INET 2
#define SOCK_STREAM 1
#define FIONBIO 0x8004667E  /* from bsdsocket — unused in blocking path */

/* LVO offsets from sdks/NDK3.2R4/SANA+RoadshowTCP-IP/sfd/bsdsocket_lib.sfd
 * (bias=30, 6-byte entries). These match the values used in the
 * proven-working amiga_ssl_lib.c (urlGet path). Any deviation triggers
 * a call to the wrong function — e.g. connect at -36 is actually bind,
 * producing EADDRNOTAVAIL when you "bind" to a remote IP. */
static long __fc_socket(__reg("a6") struct Library *base,
                        __reg("d0") long domain,
                        __reg("d1") long type,
                        __reg("d2") long protocol)
    = "\tjsr\t-30(a6)";     /* socket */

static long __fc_connect(__reg("a6") struct Library *base,
                         __reg("d0") long s,
                         __reg("a0") struct sockaddr_in_stub *name,
                         __reg("d1") long namelen)
    = "\tjsr\t-54(a6)";     /* connect (was -36=bind, my bug) */

static long __fc_send(__reg("a6") struct Library *base,
                      __reg("d0") long s,
                      __reg("a0") const void *buf,
                      __reg("d1") long len,
                      __reg("d2") long flags)
    = "\tjsr\t-66(a6)";     /* send (was -48=accept) */

static long __fc_recv(__reg("a6") struct Library *base,
                      __reg("d0") long s,
                      __reg("a0") void *buf,
                      __reg("d1") long len,
                      __reg("d2") long flags)
    = "\tjsr\t-78(a6)";     /* recv (was -60=sendto) */

/* setsockopt — bsdsocket LVO -90. Used for SO_RCVTIMEO / SO_SNDTIMEO
 * to bound blocking recv/send so a flaky network or server hang
 * doesn't wedge the worker forever. */
static long __fc_setsockopt(__reg("a6") struct Library *base,
                            __reg("d0") long s,
                            __reg("d1") long level,
                            __reg("d2") long optname,
                            __reg("a0") const void *optval,
                            __reg("d3") long optlen)
    = "\tjsr\t-90(a6)";

static long __fc_CloseSocket(__reg("a6") struct Library *base,
                             __reg("d0") long s)
    = "\tjsr\t-120(a6)";    /* CloseSocket (was -108=getpeername) */

static long __fc_Errno(__reg("a6") struct Library *base)
    = "\tjsr\t-162(a6)";    /* Errno */

static struct hostent_stub *__fc_gethostbyname(__reg("a6") struct Library *base,
                                               __reg("a0") const char *name)
    = "\tjsr\t-210(a6)";    /* gethostbyname */

/* Use a per-scope socket base: `struct Library *_sb` expected in scope */
#define fc_socket(d,t,p)     __fc_socket(_sb, (d), (t), (p))
#define fc_connect(s,a,l)    __fc_connect(_sb, (s), (a), (l))
#define fc_send(s,m,l,f)     __fc_send(_sb, (s), (m), (l), (f))
#define fc_recv(s,b,l,f)     __fc_recv(_sb, (s), (b), (l), (f))
#define fc_setsockopt(s,lvl,n,v,sz)  __fc_setsockopt(_sb, (s), (lvl), (n), (v), (sz))
#define fc_CloseSocket(d)   __fc_CloseSocket(_sb, (d))

/* BSD sockopt constants — values from Roadshow / Miami bsdsocket.h. */
#define QJS_SOL_SOCKET    0xFFFF
#define QJS_SO_RCVTIMEO   0x1006
#define QJS_SO_SNDTIMEO   0x1005

/* BSD timeval — LONG seconds + LONG microseconds (Amiga convention
 * is 32-bit signed for both, matching socket layer expectations). */
struct qjs_timeval { long tv_sec; long tv_usec; };
#define fc_Errno()          __fc_Errno(_sb)
#define fc_gethostbyname(n) __fc_gethostbyname(_sb, (n))

/* ================================================================
 * AmiSSL LVO stubs — offsets MUST match library/vbcc/amiga_ssl_lib.c
 * (the proven-working urlGet path). Values in the AmiSSL fd file vary
 * across SSL builds; we use what's known to work on this port's AmiSSL
 * v5.26 SDK.
 * ================================================================ */
static SSL_CTX *__fc_SSL_CTX_new(__reg("a6") struct Library *base,
                                 __reg("a0") const SSL_METHOD *meth)
    = "\tjsr\t-8208(a6)";
static void __fc_SSL_CTX_free(__reg("a6") struct Library *base,
                              __reg("a0") SSL_CTX *a)
    = "\tjsr\t-8214(a6)";
static int __fc_SSL_set_fd(__reg("a6") struct Library *base,
                           __reg("a0") SSL *s,
                           __reg("d0") int fd)
    = "\tjsr\t-8358(a6)";
static SSL *__fc_SSL_new(__reg("a6") struct Library *base,
                         __reg("a0") SSL_CTX *ctx)
    = "\tjsr\t-8784(a6)";
static void __fc_SSL_free(__reg("a6") struct Library *base,
                          __reg("a0") SSL *s)
    = "\tjsr\t-8820(a6)";
static int __fc_SSL_connect(__reg("a6") struct Library *base,
                            __reg("a0") SSL *s)
    = "\tjsr\t-8832(a6)";
static int __fc_SSL_read(__reg("a6") struct Library *base,
                         __reg("a0") SSL *s,
                         __reg("a1") void *buf,
                         __reg("d0") int num)
    = "\tjsr\t-8838(a6)";
static int __fc_SSL_write(__reg("a6") struct Library *base,
                          __reg("a0") SSL *s,
                          __reg("a1") const void *buf,
                          __reg("d0") int num)
    = "\tjsr\t-8850(a6)";
static long __fc_SSL_ctrl(__reg("a6") struct Library *base,
                          __reg("a0") SSL *s,
                          __reg("d0") int cmd,
                          __reg("d1") long larg,
                          __reg("a1") void *parg)
    = "\tjsr\t-8856(a6)";
static int __fc_SSL_shutdown(__reg("a6") struct Library *base,
                             __reg("a0") SSL *s)
    = "\tjsr\t-8994(a6)";
static const SSL_METHOD *__fc_TLS_client_method(__reg("a6") struct Library *base)
    = "\tjsr\t-26934(a6)";

/* Per-scope SSL base: `struct Library *_ssl_base` expected in scope */
#define fc_SSL_CTX_new(m)    __fc_SSL_CTX_new(_ssl_base, (m))
#define fc_SSL_CTX_free(c)   __fc_SSL_CTX_free(_ssl_base, (c))
#define fc_SSL_new(c)        __fc_SSL_new(_ssl_base, (c))
#define fc_SSL_free(s)       __fc_SSL_free(_ssl_base, (s))
#define fc_SSL_set_fd(s,f)   __fc_SSL_set_fd(_ssl_base, (s), (f))
#define fc_SSL_connect(s)    __fc_SSL_connect(_ssl_base, (s))
#define fc_SSL_read(s,b,n)   __fc_SSL_read(_ssl_base, (s), (b), (n))
#define fc_SSL_write(s,b,n)  __fc_SSL_write(_ssl_base, (s), (b), (n))
#define fc_SSL_ctrl(s,c,l,p) __fc_SSL_ctrl(_ssl_base, (s), (c), (l), (p))
#define fc_SSL_shutdown(s)   __fc_SSL_shutdown(_ssl_base, (s))
#define fc_TLS_client_method() __fc_TLS_client_method(_ssl_base)

/* SNI ctrl code */
#ifndef SSL_CTRL_SET_TLSEXT_HOSTNAME
#define SSL_CTRL_SET_TLSEXT_HOSTNAME 55
#endif
#ifndef TLSEXT_NAMETYPE_host_name
#define TLSEXT_NAMETYPE_host_name 0
#endif
#define fc_SSL_set_tlsext_host_name(ssl, name) \
    fc_SSL_ctrl((ssl), SSL_CTRL_SET_TLSEXT_HOSTNAME, \
                TLSEXT_NAMETYPE_host_name, (void *)(name))

/* ================================================================
 * Memory (delegated to library's malloc shim)
 * ================================================================ */
extern void *malloc(size_t);
extern void *realloc(void *, size_t);
extern void free(void *);
extern int snprintf(char *, size_t, const char *, ...);

/* ================================================================
 * Small parsing helpers
 * ================================================================ */
static int fc_atoi(const char *s)
{
    int n = 0, neg = 0;
    if (*s == '-') { neg = 1; s++; }
    while (*s >= '0' && *s <= '9') n = n * 10 + (*s++ - '0');
    return neg ? -n : n;
}

static int fc_parse_url(const char *url, int *is_https,
                        char *host, int host_size,
                        int *port, char *path, int path_size)
{
    const char *p = url;
    const char *host_start, *host_end;
    int i;

    *is_https = 0;
    *port = 80;

    if (strncmp(p, "https://", 8) == 0) {
        *is_https = 1;
        *port = 443;
        p += 8;
    } else if (strncmp(p, "http://", 7) == 0) {
        p += 7;
    } else {
        return -1;
    }

    host_start = p;
    host_end = p;
    while (*host_end && *host_end != '/' && *host_end != ':')
        host_end++;

    i = host_end - host_start;
    if (i >= host_size) i = host_size - 1;
    memcpy(host, host_start, i);
    host[i] = '\0';

    if (*host_end == ':') {
        *port = fc_atoi(host_end + 1);
        host_end++;
        while (*host_end >= '0' && *host_end <= '9') host_end++;
    }

    if (*host_end == '/') {
        i = strlen(host_end);
        if (i >= path_size) i = path_size - 1;
        memcpy(path, host_end, i);
        path[i] = '\0';
    } else {
        strcpy(path, "/");
    }
    return 0;
}

static char *fc_build_request(const char *method, const char *host,
                              const char *path,
                              const char *custom_headers,
                              const char *body, int body_len,
                              int *req_len_out)
{
    int size = 2048;
    char *buf;
    int len;

    if (custom_headers) size += strlen(custom_headers);
    if (body) size += body_len;

    buf = malloc(size);
    if (!buf) return NULL;

    len = snprintf(buf, size,
                   "%s %s HTTP/1.0\r\n"
                   "Host: %s\r\n"
                   "User-Agent: qjs/0.070\r\n"
                   "Connection: close\r\n",
                   method, path, host);

    if (body && body_len > 0) {
        len += snprintf(buf + len, size - len,
                        "Content-Length: %d\r\n", body_len);
    }
    if (custom_headers) {
        int hlen = strlen(custom_headers);
        memcpy(buf + len, custom_headers, hlen);
        len += hlen;
    }
    memcpy(buf + len, "\r\n", 2);
    len += 2;
    if (body && body_len > 0) {
        memcpy(buf + len, body, body_len);
        len += body_len;
    }
    *req_len_out = len;
    return buf;
}

/* ================================================================
 * FetchContext — per-request state shared between main and worker
 *
 * Most fields are filled by the worker; main only reads them after
 * QJS_WorkerPoll returns DONE/FAILED. The `worker` pointer is the
 * primitive's handle; we call QJS_WorkerPoll/Destroy on it.
 * ================================================================ */
struct FetchContext {
    int state;
    long sock;
    int is_https;
    SSL *ssl;

    /* URL components */
    char url[1280];
    char host[256];
    char path[1024];
    int port;

    /* Request buffer + metadata */
    char *request_buf;
    int request_len;
    char method_buf[16];
    char *custom_headers_copy;
    char *body_copy;
    int body_copy_len;

    /* Response accumulation */
    char *response_buf;
    int response_len;
    int response_cap;

    /* Parsed response */
    int status_code;
    char status_text[64];
    char *headers_raw;
    int headers_len;
    int body_offset;

    /* Error */
    char error_msg[128];

    /* Worker handle (created by fetch_create, polled/destroyed later) */
    QJSWorker *worker;

    /* Cancellation + timeout support (v2 E3 completion).
     *
     * abort_requested: set to 1 by main task (via fetch_abort or JS
     * AbortSignal handler) to request the worker wind down early.
     * Worker checks between recv iterations, closes socket on set.
     * Volatile so VBCC doesn't cache it across the recv loop.
     *
     * timeout_ms: overall per-call timeout. Currently applied as
     * SO_RCVTIMEO on the socket (each recv call is bounded). 0 =
     * use default (30s). */
    volatile unsigned long abort_requested;
    unsigned long timeout_ms;
};

/* ================================================================
 * Status-line parser
 * ================================================================ */
static void fc_parse_status(struct FetchContext *ctx,
                            const char *data, int len)
{
    const char *sp, *sp2;
    int i;

    ctx->status_code = 0;
    ctx->status_text[0] = '\0';

    sp = memchr(data, ' ', len);
    if (!sp) return;
    sp++;
    ctx->status_code = fc_atoi(sp);

    sp2 = memchr(sp, ' ', len - (sp - data));
    if (sp2) {
        const char *end;
        sp2++;
        end = memchr(sp2, '\r', len - (sp2 - data));
        if (!end) end = memchr(sp2, '\n', len - (sp2 - data));
        if (end) {
            i = end - sp2;
            if (i >= (int)sizeof(ctx->status_text))
                i = sizeof(ctx->status_text) - 1;
            memcpy(ctx->status_text, sp2, i);
            ctx->status_text[i] = '\0';
        }
    }
}

/* ================================================================
 * Worker job — runs ENTIRELY in the worker task.
 *
 * Uses per-task bases from QJS_WorkerGetBase, creates its own SSL_CTX,
 * does the full HTTP/HTTPS transaction blockingly. Never touches the
 * main task's globals (SocketBase, AmiSSLBase, amiga_ssl_lib's ssl_ctx).
 *
 * On completion, writes result fields into the shared FetchContext.
 * Sets ctx->state to DONE or ERROR; returns 0 on success, -1 on error.
 * ================================================================ */
static int fetch_job(QJSWorker *w, void *user_data)
{
    struct FetchContext *ctx = (struct FetchContext *)user_data;
    struct Library *_sb       = QJS_WorkerGetBase_impl(w, QJS_WORKER_BASE_SOCKET);
    struct Library *_ssl_base = ctx->is_https
                                ? QJS_WorkerGetBase_impl(w, QJS_WORKER_BASE_SSL)
                                : NULL;
    SSL_CTX *ssl_ctx = NULL;
    struct hostent_stub *he;
    struct sockaddr_in_stub addr;
    long rc;
    int n;

    if (!_sb) {
        strcpy(ctx->error_msg, "bsdsocket.library not available in worker");
        ctx->state = FETCH_STATE_ERROR;
        return -1;
    }
    if (ctx->is_https && !_ssl_base) {
        strcpy(ctx->error_msg, "AmiSSL not available in worker");
        ctx->state = FETCH_STATE_ERROR;
        return -1;
    }

    /* Create our own SSL_CTX (per-task — sharing across tasks is unsafe). */
    if (ctx->is_https) {
        ssl_ctx = fc_SSL_CTX_new(fc_TLS_client_method());
        if (!ssl_ctx) {
            strcpy(ctx->error_msg, "SSL_CTX_new failed in worker");
            ctx->state = FETCH_STATE_ERROR;
            return -1;
        }
    }

    /* Build request */
    {
        const char *method = ctx->method_buf[0] ? ctx->method_buf : "GET";
        ctx->request_buf = fc_build_request(
            method, ctx->host, ctx->path,
            ctx->custom_headers_copy,
            ctx->body_copy, ctx->body_copy_len,
            &ctx->request_len);
    }
    if (!ctx->request_buf) {
        strcpy(ctx->error_msg, "Out of memory building request");
        ctx->state = FETCH_STATE_ERROR;
        goto cleanup_ssl;
    }

    /* DNS (blocking in worker — fine, main task unaffected) */
    he = fc_gethostbyname(ctx->host);
    if (!he || !he->h_addr_list || !he->h_addr_list[0]) {
        snprintf(ctx->error_msg, sizeof(ctx->error_msg),
                 "DNS lookup failed: %s", ctx->host);
        ctx->state = FETCH_STATE_ERROR;
        goto cleanup_ssl;
    }
    if (he->h_length != 4) {
        strcpy(ctx->error_msg, "Unsupported address type");
        ctx->state = FETCH_STATE_ERROR;
        goto cleanup_ssl;
    }

    memset(&addr, 0, sizeof(addr));
    addr.sin_len    = sizeof(addr);        /* BSD 4.3+ requires this */
    addr.sin_family = AF_INET;
    addr.sin_port   = (unsigned short)ctx->port;
    memcpy(&addr.sin_addr, he->h_addr_list[0], 4);

    /* Socket */
    ctx->sock = fc_socket(AF_INET, SOCK_STREAM, 0);
    if (ctx->sock < 0) {
        strcpy(ctx->error_msg, "socket() failed");
        ctx->state = FETCH_STATE_ERROR;
        goto cleanup_ssl;
    }

    /* Apply per-call recv/send timeout so a flaky peer can't wedge
     * the worker indefinitely. SO_RCVTIMEO only affects individual
     * recv() calls, so a responsive peer streaming data slowly is
     * still OK — only a complete pause > timeout_ms aborts. */
    {
        unsigned long ms = ctx->timeout_ms ? ctx->timeout_ms : 30000UL;
        struct qjs_timeval tv;
        tv.tv_sec  = (long)(ms / 1000UL);
        tv.tv_usec = (long)((ms % 1000UL) * 1000UL);
        (void)fc_setsockopt(ctx->sock, QJS_SOL_SOCKET, QJS_SO_RCVTIMEO, &tv, sizeof(tv));
        (void)fc_setsockopt(ctx->sock, QJS_SOL_SOCKET, QJS_SO_SNDTIMEO, &tv, sizeof(tv));
    }

    /* Blocking connect */
    rc = fc_connect(ctx->sock, &addr, sizeof(addr));
    if (rc < 0) {
        snprintf(ctx->error_msg, sizeof(ctx->error_msg),
                 "connect() failed (errno=%ld)", fc_Errno());
        ctx->state = FETCH_STATE_ERROR;
        goto cleanup_sock;
    }

    /* TLS handshake */
    if (ctx->is_https) {
        ctx->ssl = fc_SSL_new(ssl_ctx);
        if (!ctx->ssl) {
            strcpy(ctx->error_msg, "SSL_new failed");
            ctx->state = FETCH_STATE_ERROR;
            goto cleanup_sock;
        }
        fc_SSL_set_fd(ctx->ssl, (int)ctx->sock);
        fc_SSL_set_tlsext_host_name(ctx->ssl, ctx->host);
        if (fc_SSL_connect(ctx->ssl) <= 0) {
            strcpy(ctx->error_msg, "TLS handshake failed");
            ctx->state = FETCH_STATE_ERROR;
            goto cleanup_sock;
        }
    }

    /* Send request */
    {
        int total_sent = 0;
        while (total_sent < ctx->request_len) {
            int remaining = ctx->request_len - total_sent;
            if (ctx->is_https)
                n = fc_SSL_write(ctx->ssl,
                                 ctx->request_buf + total_sent, remaining);
            else
                n = fc_send(ctx->sock,
                            ctx->request_buf + total_sent, remaining, 0);
            if (n <= 0) {
                strcpy(ctx->error_msg, "send/SSL_write failed");
                ctx->state = FETCH_STATE_ERROR;
                goto cleanup_sock;
            }
            total_sent += n;
        }
    }

    /* Receive response */
    ctx->response_cap = 8192;
    ctx->response_buf = malloc(ctx->response_cap);
    if (!ctx->response_buf) {
        strcpy(ctx->error_msg, "Out of memory for response buffer");
        ctx->state = FETCH_STATE_ERROR;
        goto cleanup_sock;
    }
    ctx->response_len = 0;
    for (;;) {
        /* Check abort request between each recv iteration. Set by
         * the main task via fetch_abort() (wired to AbortSignal). */
        if (ctx->abort_requested) {
            strcpy(ctx->error_msg, "aborted");
            ctx->state = FETCH_STATE_ERROR;
            goto cleanup_sock;
        }

        if (ctx->response_len + 4096 > ctx->response_cap) {
            int new_cap = ctx->response_cap * 2;
            char *new_buf = realloc(ctx->response_buf, new_cap);
            if (!new_buf) {
                strcpy(ctx->error_msg, "Out of memory (growing)");
                ctx->state = FETCH_STATE_ERROR;
                goto cleanup_sock;
            }
            ctx->response_buf = new_buf;
            ctx->response_cap = new_cap;
        }
        if (ctx->is_https)
            n = fc_SSL_read(ctx->ssl,
                            ctx->response_buf + ctx->response_len,
                            ctx->response_cap - ctx->response_len - 1);
        else
            n = fc_recv(ctx->sock,
                        ctx->response_buf + ctx->response_len,
                        ctx->response_cap - ctx->response_len - 1, 0);
        if (n <= 0) {
            /* EOF (0) is normal HTTP end-of-stream. Negative is
             * error OR timeout (SO_RCVTIMEO fires recv = -1 errno
             * EAGAIN). Treat timeout as abort if no data received. */
            if (n < 0 && ctx->response_len == 0) {
                strcpy(ctx->error_msg, "recv timed out or failed");
                ctx->state = FETCH_STATE_ERROR;
                goto cleanup_sock;
            }
            break;
        }
        ctx->response_len += n;
    }
    ctx->response_buf[ctx->response_len] = '\0';

    /* Parse headers */
    {
        char *header_end = strstr(ctx->response_buf, "\r\n\r\n");
        if (header_end) {
            int hdr_len = header_end - ctx->response_buf;
            ctx->body_offset = hdr_len + 4;
            fc_parse_status(ctx, ctx->response_buf, hdr_len);
            ctx->headers_raw = malloc(hdr_len + 1);
            if (ctx->headers_raw) {
                memcpy(ctx->headers_raw, ctx->response_buf, hdr_len);
                ctx->headers_raw[hdr_len] = '\0';
                ctx->headers_len = hdr_len;
            }
        } else {
            ctx->body_offset = 0;
        }
    }

    ctx->state = FETCH_STATE_DONE;

cleanup_sock:
    if (ctx->ssl) {
        fc_SSL_shutdown(ctx->ssl);
        fc_SSL_free(ctx->ssl);
        ctx->ssl = NULL;
    }
    if (ctx->sock >= 0) {
        fc_CloseSocket(ctx->sock);
        ctx->sock = -1;
    }
cleanup_ssl:
    if (ssl_ctx) fc_SSL_CTX_free(ssl_ctx);

    return (ctx->state == FETCH_STATE_DONE) ? 0 : -1;
}

/* ================================================================
 * Public API (amiga_fetch.h)
 * ================================================================ */

/* QJS_Worker impl functions — we call them directly since this code
 * lives INSIDE the library. External consumers use the LVO entries. */
extern QJSWorker *QJS_WorkerSpawn_impl(QJSWorkerJobFn, void *, unsigned long);
extern long QJS_WorkerPoll_impl(QJSWorker *);
extern long QJS_WorkerJoin_impl(QJSWorker *);
extern void QJS_WorkerDestroy_impl(QJSWorker *);
extern const char *QJS_WorkerGetError_impl(QJSWorker *);

FetchContext *fetch_create(const char *url, const char *method,
                           const char *custom_headers,
                           const char *body, int body_len)
{
    struct FetchContext *ctx;
    unsigned long flags;

    ctx = malloc(sizeof(struct FetchContext));
    if (!ctx) return NULL;
    memset(ctx, 0, sizeof(*ctx));
    ctx->sock = -1;
    ctx->state = FETCH_STATE_INIT;

    /* Save URL and parse immediately — fail fast on bad URLs so the
     * consumer gets a synchronous error without spawning a worker. */
    strncpy(ctx->url, url, sizeof(ctx->url) - 1);
    if (fc_parse_url(url, &ctx->is_https, ctx->host, sizeof(ctx->host),
                     &ctx->port, ctx->path, sizeof(ctx->path)) < 0) {
        snprintf(ctx->error_msg, sizeof(ctx->error_msg),
                 "Invalid URL: %s", url);
        ctx->state = FETCH_STATE_ERROR;
        return ctx;
    }

    /* Copy method/headers/body so the worker doesn't depend on the
     * caller's storage lifetime. */
    if (method) strncpy(ctx->method_buf, method, sizeof(ctx->method_buf) - 1);
    if (custom_headers) {
        int n = strlen(custom_headers);
        ctx->custom_headers_copy = malloc(n + 1);
        if (ctx->custom_headers_copy) {
            memcpy(ctx->custom_headers_copy, custom_headers, n);
            ctx->custom_headers_copy[n] = '\0';
        }
    }
    if (body && body_len > 0) {
        ctx->body_copy = malloc(body_len);
        if (ctx->body_copy) {
            memcpy(ctx->body_copy, body, body_len);
            ctx->body_copy_len = body_len;
        }
    }

    /* Spawn worker — framework opens its own bsdsocket and AmiSSL bases. */
    flags = QJS_WORKER_WANT_SOCKET;
    if (ctx->is_https) flags |= QJS_WORKER_WANT_SSL;
    ctx->worker = QJS_WorkerSpawn_impl(fetch_job, ctx, flags);
    if (!ctx->worker) {
        strcpy(ctx->error_msg, "Failed to spawn worker task");
        ctx->state = FETCH_STATE_ERROR;
        return ctx;
    }

    ctx->state = FETCH_STATE_CONNECTING; /* "in flight" */
    return ctx;
}

/* Non-blocking: asks the Worker primitive if the job is done.
 * Returns 1 if complete (ctx->state is DONE or ERROR), 0 if still running. */
int fetch_step(FetchContext *ctx, int *want_read, int *want_write)
{
    long s;

    if (want_read)  *want_read = 0;
    if (want_write) *want_write = 0;

    if (!ctx) return 1;
    if (ctx->state == FETCH_STATE_DONE || ctx->state == FETCH_STATE_ERROR)
        return 1;
    if (!ctx->worker) {
        ctx->state = FETCH_STATE_ERROR;
        strcpy(ctx->error_msg, "No worker");
        return 1;
    }

    s = QJS_WorkerPoll_impl(ctx->worker);
    if (s == QJS_WORKER_DONE || s == QJS_WORKER_FAILED) {
        /* Job filled ctx->state already. If the Worker framework
         * reported FAILED, upgrade our state to ERROR in case the
         * job never got far enough to set it. Pull the framework's
         * specific error message so the caller sees WHY (e.g.
         * "OpenLibrary(bsdsocket.library, 4) failed" rather than
         * an opaque "Worker failed"). */
        if (s == QJS_WORKER_FAILED &&
            ctx->state != FETCH_STATE_ERROR &&
            ctx->state != FETCH_STATE_DONE) {
            const char *fw = QJS_WorkerGetError_impl(ctx->worker);
            ctx->state = FETCH_STATE_ERROR;
            if (!ctx->error_msg[0]) {
                if (fw && fw[0]) {
                    int n = strlen(fw);
                    if (n > (int)sizeof(ctx->error_msg) - 1)
                        n = sizeof(ctx->error_msg) - 1;
                    memcpy(ctx->error_msg, fw, n);
                    ctx->error_msg[n] = '\0';
                } else {
                    strcpy(ctx->error_msg, "Worker failed (no reason)");
                }
            }
        }
        return 1;
    }
    return 0;
}

int fetch_get_fd(FetchContext *ctx)
{
    return (ctx && ctx->sock >= 0) ? (int)ctx->sock : -1;
}

int fetch_get_state(FetchContext *ctx)
{
    return ctx ? ctx->state : FETCH_STATE_ERROR;
}

int fetch_get_status(FetchContext *ctx)
{
    return ctx ? ctx->status_code : 0;
}

const char *fetch_get_headers(FetchContext *ctx, int *len)
{
    if (!ctx || !ctx->headers_raw) {
        if (len) *len = 0;
        return NULL;
    }
    if (len) *len = ctx->headers_len;
    return ctx->headers_raw;
}

const char *fetch_get_body(FetchContext *ctx, int *len)
{
    if (!ctx || !ctx->response_buf || ctx->state != FETCH_STATE_DONE) {
        if (len) *len = 0;
        return NULL;
    }
    if (len) *len = ctx->response_len - ctx->body_offset;
    return ctx->response_buf + ctx->body_offset;
}

const char *fetch_get_url(FetchContext *ctx)
{
    return ctx ? ctx->url : NULL;
}

const char *fetch_get_error(FetchContext *ctx)
{
    return (ctx && ctx->error_msg[0]) ? ctx->error_msg : NULL;
}

/* E3 completion — request early termination of an in-flight fetch.
 * Safe to call from any task (notably the main task from a JS
 * AbortSignal handler). Sets a volatile flag the worker checks
 * between recv iterations. Worker sees the flag on the next cycle,
 * sets ctx->state = ERROR with "aborted" error_msg, closes socket,
 * exits. fetch_destroy then joins cleanly. */
void fetch_abort(FetchContext *ctx)
{
    if (ctx) ctx->abort_requested = 1;
}

/* Set per-fetch timeout (milliseconds). Takes effect on the next
 * socket creation inside fetch_job; for an already-in-flight fetch
 * this is a no-op (the SO_RCVTIMEO is set once after socket()).
 * Pass 0 to use the default (30s). */
void fetch_set_timeout(FetchContext *ctx, unsigned long ms)
{
    if (ctx) ctx->timeout_ms = ms;
}

void fetch_destroy(FetchContext *ctx)
{
    if (!ctx) return;

    /* Ensure the worker has finished before we free memory it may
     * still be writing to. Join is a kernel WaitPort — zero CPU
     * while waiting, wakes exactly when the worker posts completion.
     * If already DONE/FAILED, Join returns immediately. */
    if (ctx->worker) {
        QJS_WorkerJoin_impl(ctx->worker);
        QJS_WorkerDestroy_impl(ctx->worker);
        ctx->worker = NULL;
    }

    /* Socket/SSL cleanup happened inside fetch_job (worker closed
     * its own bases). Main task just frees the buffers. */
    if (ctx->request_buf)          free(ctx->request_buf);
    if (ctx->response_buf)         free(ctx->response_buf);
    if (ctx->headers_raw)          free(ctx->headers_raw);
    if (ctx->custom_headers_copy)  free(ctx->custom_headers_copy);
    if (ctx->body_copy)            free(ctx->body_copy);
    free(ctx);
}

#endif /* __VBCC__ */
