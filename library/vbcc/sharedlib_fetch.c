/*
 * sharedlib_fetch.c -- Non-blocking HTTP/HTTPS fetch state machine
 *
 * Provides async HTTP/HTTPS client for quickjs.library's fetch() API.
 * Uses bsdsocket.library with non-blocking sockets and AmiSSL for TLS.
 *
 * The state machine is driven by the QuickJS event loop via poll().
 * Each call to fetch_step() performs one non-blocking I/O operation
 * and returns what events to wait for next.
 */

#ifdef __VBCC__

#include "amiga_fetch.h"
#include "amiga_ssl.h"
#include <stddef.h>
#include <string.h>
#include <poll.h>

#pragma amiga-align
#include <exec/types.h>
#include <exec/execbase.h>
#include <exec/nodes.h>
#include <exec/lists.h>
#include <exec/ports.h>
#include <exec/tasks.h>
#include <dos/dos.h>
#include <dos/dosextens.h>
#include <dos/dostags.h>
#include <utility/tagitem.h>
#include <proto/exec.h>
#pragma default-align

#include "execinline.h"

/* Forward declare OpenSSL types */
typedef struct ssl_ctx_st SSL_CTX;
typedef struct ssl_st SSL;
typedef struct ssl_method_st SSL_METHOD;
typedef struct OSSL_LIB_CTX_st OSSL_LIB_CTX;
typedef struct evp_pkey_st EVP_PKEY;
typedef struct asn1_string_st ASN1_INTEGER;
typedef struct ssl_session_st SSL_SESSION;
typedef struct x509_st X509;
typedef struct X509_VERIFY_PARAM_st X509_VERIFY_PARAM;
typedef struct X509_NAME_st X509_NAME;
typedef struct X509_STORE_st X509_STORE;
typedef struct stack_st STACK;
typedef int (*pem_password_cb)(char *buf, int size, int rwflag, void *userdata);

/* SSL error constants */
#define SSL_ERROR_NONE       0
#define SSL_ERROR_SSL        1
#define SSL_ERROR_WANT_READ  2
#define SSL_ERROR_WANT_WRITE 3
#define SSL_ERROR_ZERO_RETURN 6

/* Socket constants */
#define AF_INET     2
#define SOCK_STREAM 1
#define SOL_SOCKET  0xffff
#define SO_ERROR    0x1007
#define FIONBIO     0x8004667eUL

/* Socket structures */
struct in_addr { unsigned long s_addr; };
struct sockaddr_in {
    short          sin_family;
    unsigned short sin_port;
    struct in_addr sin_addr;
    char           sin_zero[8];
};
struct sockaddr {
    unsigned short sa_family;
    char           sa_data[14];
};
struct hostent {
    char  *h_name;
    char **h_aliases;
    int    h_addrtype;
    int    h_length;
    char **h_addr_list;
};
#define h_addr h_addr_list[0]

/* ================================================================
 * Library bases -- defined in amiga_ssl_lib.c
 * ================================================================ */
extern struct Library *SocketBase;
extern struct Library *AmiSSLBase;
extern SSL_CTX *ssl_ctx;

/* ================================================================
 * bsdsocket.library LVO inline stubs
 * ================================================================ */
static long __fc_socket(__reg("a6") struct Library *base,
                        __reg("d0") long domain,
                        __reg("d1") long type,
                        __reg("d2") long protocol) = "\tjsr\t-30(a6)";

static long __fc_connect(__reg("a6") struct Library *base,
                         __reg("d0") long s,
                         __reg("a0") const struct sockaddr *name,
                         __reg("d1") long namelen) = "\tjsr\t-54(a6)";

static long __fc_send(__reg("a6") struct Library *base,
                      __reg("d0") long s,
                      __reg("a0") const void *msg,
                      __reg("d1") long len,
                      __reg("d2") long flags) = "\tjsr\t-66(a6)";

static long __fc_recv(__reg("a6") struct Library *base,
                      __reg("d0") long s,
                      __reg("a0") void *buf,
                      __reg("d1") long len,
                      __reg("d2") long flags) = "\tjsr\t-78(a6)";

static long __fc_getsockopt(__reg("a6") struct Library *base,
                            __reg("d0") long sock,
                            __reg("d1") long level,
                            __reg("d2") long optname,
                            __reg("a0") void *optval,
                            __reg("a1") void *optlen) = "\tjsr\t-96(a6)";

static long __fc_IoctlSocket(__reg("a6") struct Library *base,
                             __reg("d0") long sock,
                             __reg("d1") unsigned long req,
                             __reg("a0") void *argp) = "\tjsr\t-114(a6)";

static long __fc_CloseSocket(__reg("a6") struct Library *base,
                             __reg("d0") long d) = "\tjsr\t-120(a6)";

static long __fc_Errno(__reg("a6") struct Library *base) = "\tjsr\t-162(a6)";

static struct hostent *__fc_gethostbyname(__reg("a6") struct Library *base,
                                          __reg("a0") const char *name)
                                          = "\tjsr\t-210(a6)";

static long __fc_WaitSelect(__reg("a6") struct Library *base,
                            __reg("d0") long nfds,
                            __reg("a0") void *read_fds,
                            __reg("a1") void *write_fds,
                            __reg("a2") void *except_fds,
                            __reg("a3") void *timeout,
                            __reg("d1") unsigned long *signals)
                            = "\tjsr\t-126(a6)";

#define fc_socket(d,t,p)      __fc_socket(SocketBase, (d), (t), (p))
#define fc_connect(s,a,l)     __fc_connect(SocketBase, (s), (a), (l))
#define fc_send(s,m,l,f)      __fc_send(SocketBase, (s), (m), (l), (f))
#define fc_recv(s,b,l,f)      __fc_recv(SocketBase, (s), (b), (l), (f))
#define fc_getsockopt(s,l,o,v,n) __fc_getsockopt(SocketBase,(s),(l),(o),(v),(n))
#define fc_IoctlSocket(s,r,a) __fc_IoctlSocket(SocketBase, (s), (r), (a))
#define fc_CloseSocket(d)     __fc_CloseSocket(SocketBase, (d))
#define fc_Errno()            __fc_Errno(SocketBase)
#define fc_gethostbyname(n)   __fc_gethostbyname(SocketBase, (n))
#define fc_WaitSelect(n,r,w,e,t,s) __fc_WaitSelect(SocketBase,(n),(r),(w),(e),(t),(s))

/* Minimal fd_set for WaitSelect */
typedef struct { unsigned long fds_bits[8]; } fc_fd_set;
#define FC_FD_ZERO(set)      memset((set), 0, sizeof(fc_fd_set))
#define FC_FD_SET(fd, set)   ((set)->fds_bits[(fd)/32] |= (1UL << ((fd) % 32)))
#define FC_FD_ISSET(fd, set) ((set)->fds_bits[(fd)/32] & (1UL << ((fd) % 32)))

struct fc_timeval { long tv_sec; long tv_usec; };

/* Check if socket is ready for reading/writing (0 timeout, non-blocking).
 * Returns 1 if ready, 0 if not, -1 on error. */
static int fc_check_ready(long sock, int for_write)
{
    fc_fd_set set;
    struct fc_timeval tv;
    long result;
    FC_FD_ZERO(&set);
    FC_FD_SET(sock, &set);
    tv.tv_sec = 0;
    tv.tv_usec = 0;
    if (for_write)
        result = fc_WaitSelect(sock + 1, NULL, &set, NULL, &tv, NULL);
    else
        result = fc_WaitSelect(sock + 1, &set, NULL, NULL, &tv, NULL);
    if (result < 0) return -1;
    if (result == 0) return 0;
    return FC_FD_ISSET(sock, &set) ? 1 : 0;
}

/* ================================================================
 * AmiSSL LVO inline stubs
 * ================================================================ */
static SSL *__fc_SSL_new(__reg("a6") struct Library *base,
                         __reg("a0") SSL_CTX *ctx) = "\tjsr\t-8784(a6)";

static void __fc_SSL_free(__reg("a6") struct Library *base,
                          __reg("a0") SSL *ssl) = "\tjsr\t-8820(a6)";

static int __fc_SSL_connect(__reg("a6") struct Library *base,
                            __reg("a0") SSL *ssl) = "\tjsr\t-8832(a6)";

static int __fc_SSL_read(__reg("a6") struct Library *base,
                         __reg("a0") SSL *ssl,
                         __reg("a1") void *buf,
                         __reg("d0") int num) = "\tjsr\t-8838(a6)";

static int __fc_SSL_write(__reg("a6") struct Library *base,
                          __reg("a0") SSL *ssl,
                          __reg("a1") const void *buf,
                          __reg("d0") int num) = "\tjsr\t-8850(a6)";

static long __fc_SSL_ctrl(__reg("a6") struct Library *base,
                          __reg("a0") SSL *ssl,
                          __reg("d0") int cmd,
                          __reg("d1") long larg,
                          __reg("a1") void *parg) = "\tjsr\t-8856(a6)";

static int __fc_SSL_shutdown(__reg("a6") struct Library *base,
                             __reg("a0") SSL *s) = "\tjsr\t-8994(a6)";

static int __fc_SSL_set_fd(__reg("a6") struct Library *base,
                           __reg("a0") SSL *s, __reg("d0") int fd)
                           = "\tjsr\t-8358(a6)";

static int __fc_SSL_get_error(__reg("a6") struct Library *base,
                              __reg("a0") const SSL *s,
                              __reg("d0") int ret_code)
                              = "\tjsr\t-8880(a6)";

#define fc_SSL_new(c)        __fc_SSL_new(AmiSSLBase, (c))
#define fc_SSL_free(s)       __fc_SSL_free(AmiSSLBase, (s))
#define fc_SSL_connect(s)    __fc_SSL_connect(AmiSSLBase, (s))
#define fc_SSL_read(s,b,n)   __fc_SSL_read(AmiSSLBase, (s), (b), (n))
#define fc_SSL_write(s,b,n)  __fc_SSL_write(AmiSSLBase, (s), (b), (n))
#define fc_SSL_ctrl(s,c,l,p) __fc_SSL_ctrl(AmiSSLBase, (s), (c), (l), (p))
#define fc_SSL_shutdown(s)   __fc_SSL_shutdown(AmiSSLBase, (s))
#define fc_SSL_set_fd(s,f)   __fc_SSL_set_fd(AmiSSLBase, (s), (f))
#define fc_SSL_get_error(s,r) __fc_SSL_get_error(AmiSSLBase, (s), (r))

/* SNI support */
#define SSL_CTRL_SET_TLSEXT_HOSTNAME 55
#define TLSEXT_NAMETYPE_host_name 0
#define fc_SSL_set_tlsext_host_name(ssl, name) \
    fc_SSL_ctrl(ssl, SSL_CTRL_SET_TLSEXT_HOSTNAME, \
                TLSEXT_NAMETYPE_host_name, (void *)(name))

/* ================================================================
 * exec.library LVO stubs for process/port/message/signal
 * ================================================================ */
extern struct ExecBase *SysBase;

static struct MsgPort *__fc_CreateMsgPort(__reg("a6") struct ExecBase *base)
    = "\tjsr\t-666(a6)"; /* -0x29a */
#define fc_CreateMsgPort() __fc_CreateMsgPort(SysBase)

static void __fc_DeleteMsgPort(__reg("a6") struct ExecBase *base,
                               __reg("a0") struct MsgPort *port)
    = "\tjsr\t-672(a6)"; /* -0x2a0 */
#define fc_DeleteMsgPort(p) __fc_DeleteMsgPort(SysBase, (p))

static void __fc_PutMsg(__reg("a6") struct ExecBase *base,
                        __reg("a0") struct MsgPort *port,
                        __reg("a1") struct Message *msg)
    = "\tjsr\t-366(a6)"; /* -0x16e */
#define fc_PutMsg(p, m) __fc_PutMsg(SysBase, (p), (m))

static struct Message *__fc_GetMsg(__reg("a6") struct ExecBase *base,
                                   __reg("a0") struct MsgPort *port)
    = "\tjsr\t-372(a6)"; /* -0x174 */
#define fc_GetMsg(p) __fc_GetMsg(SysBase, (p))

static struct Task *__fc_FindTask(__reg("a6") struct ExecBase *base,
                                  __reg("a1") const char *name)
    = "\tjsr\t-294(a6)"; /* -0x126 */
#define fc_FindTask(n) __fc_FindTask(SysBase, (n))

/* ================================================================
 * dos.library LVO stubs for CreateNewProc
 * ================================================================ */
extern struct Library *_qjs_DOSBase;  /* set during CustomLibInit */

static struct Process *__fc_CreateNewProc(__reg("a6") struct Library *base,
                                          __reg("d1") struct TagItem *tags)
    = "\tjsr\t-498(a6)"; /* -0x1f2 */
#define fc_CreateNewProc(t) __fc_CreateNewProc(_qjs_DOSBase, (t))

/* ================================================================
 * Memory allocation -- use exec.library pool via sharedlib_mem
 * ================================================================ */
extern void *malloc(size_t);
extern void *realloc(void *, size_t);
extern void free(void *);
extern int snprintf(char *, size_t, const char *, ...);

static int fc_atoi(const char *s)
{
    int n = 0, neg = 0;
    if (*s == '-') { neg = 1; s++; }
    while (*s >= '0' && *s <= '9') n = n * 10 + (*s++ - '0');
    return neg ? -n : n;
}

/* ================================================================
 * FetchContext structure
 *
 * Shared between the main task (library client) and the worker
 * process that performs the blocking HTTP transaction. Fields are
 * either "main only" or "worker only" during active work; only
 * `worker_done` and the output result fields cross the boundary
 * after the worker signals completion.
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

    /* Request */
    char *request_buf;
    int request_len;
    int request_sent;

    /* Request metadata (copied, so worker doesn't need external refs) */
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
    int body_offset;    /* offset into response_buf where body starts */

    /* Error info */
    int error_code;
    char error_msg[128];

    /* Worker process support (for async fetch) */
    struct MsgPort *reply_port;   /* main task creates; worker PutMsg here */
    struct Message *reply_msg;    /* static message buffer inside ctx */
    struct Message _reply_msg_storage; /* actual storage (avoid malloc in worker) */
    volatile int worker_done;     /* set to 1 by worker when finished */
    volatile int worker_started;  /* set by worker on entry; main waits briefly */
};

/* ================================================================
 * URL parsing -- reuses pattern from amiga_ssl_lib.c
 * ================================================================ */
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
        while (*host_end >= '0' && *host_end <= '9')
            host_end++;
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

/* ================================================================
 * Build HTTP request string
 * ================================================================ */
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
                   "User-Agent: qjs/0.65\r\n"
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

    /* End of headers */
    memcpy(buf + len, "\r\n", 2);
    len += 2;

    /* Append body if present */
    if (body && body_len > 0) {
        memcpy(buf + len, body, body_len);
        len += body_len;
    }

    *req_len_out = len;
    return buf;
}

/* ================================================================
 * Parse HTTP status line from response
 * ================================================================ */
static void fc_parse_status(FetchContext *ctx, const char *data, int len)
{
    const char *sp;
    const char *sp2;
    int i;

    ctx->status_code = 0;
    ctx->status_text[0] = '\0';

    /* "HTTP/1.x NNN Reason\r\n" */
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
 * Public API
 * ================================================================ */

/* exec.library OpenLibrary via safe inline asm (no frame pointer issue) */
static struct Library *__fc_OpenLibrary(
    __reg("a6") struct ExecBase *base,
    __reg("a1") const char *name,
    __reg("d0") unsigned long version) = "\tjsr\t-552(a6)";

/* Ensure bsdsocket.library is open.
 * Uses direct exec.library LVO to avoid amiga_ssl_init()
 * dependency (AmiSSL may not be available for plain HTTP). */
static int fc_ensure_socket_lib(void)
{
    extern struct ExecBase *SysBase;
    if (SocketBase) return 0;
    SocketBase = __fc_OpenLibrary(SysBase, "bsdsocket.library", 4);
    return SocketBase ? 0 : -1;
}

/* Do the entire HTTP transaction synchronously (blocking).
 * Called from the worker process -- main task is unaffected. */
static void fetch_do_sync(FetchContext *ctx)
{
    struct hostent *he;
    struct sockaddr_in addr;
    long rc;
    int n;
    long one = 1;

    if (fc_ensure_socket_lib() < 0) {
        strcpy(ctx->error_msg, "bsdsocket.library unavailable");
        ctx->state = FETCH_STATE_ERROR;
        return;
    }

    /* Check HTTPS prerequisites */
    if (ctx->is_https) {
        if (amiga_ssl_init() != 0 || !ssl_ctx) {
            strcpy(ctx->error_msg, "Failed to initialize AmiSSL");
            ctx->state = FETCH_STATE_ERROR;
            return;
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
        strcpy(ctx->error_msg, "Failed to allocate request buffer");
        ctx->state = FETCH_STATE_ERROR;
        return;
    }
    ctx->request_sent = 0;

    /* DNS lookup (blocking) */
    he = fc_gethostbyname(ctx->host);
    if (!he || !he->h_addr_list || !he->h_addr_list[0]) {
        snprintf(ctx->error_msg, sizeof(ctx->error_msg),
                 "DNS lookup failed: %s", ctx->host);
        ctx->state = FETCH_STATE_ERROR;
        return;
    }

    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = (unsigned short)ctx->port;
    if (he->h_length != 4) {
        strcpy(ctx->error_msg, "Unsupported address type");
        ctx->state = FETCH_STATE_ERROR;
        return;
    }
    memcpy(&addr.sin_addr, he->h_addr_list[0], 4);

    /* Socket */
    ctx->sock = fc_socket(AF_INET, SOCK_STREAM, 0);
    if (ctx->sock < 0) {
        strcpy(ctx->error_msg, "Failed to create socket");
        ctx->state = FETCH_STATE_ERROR;
        return;
    }

    /* Blocking connect */
    rc = fc_connect(ctx->sock, (struct sockaddr *)&addr, sizeof(addr));
    if (rc < 0) {
        snprintf(ctx->error_msg, sizeof(ctx->error_msg),
                 "Connection failed (errno=%ld)", fc_Errno());
        ctx->state = FETCH_STATE_ERROR;
        return;
    }

    /* TLS handshake (blocking) */
    if (ctx->is_https) {
        ctx->ssl = fc_SSL_new(ssl_ctx);
        if (!ctx->ssl) {
            strcpy(ctx->error_msg, "SSL_new failed");
            ctx->state = FETCH_STATE_ERROR;
            return;
        }
        fc_SSL_set_fd(ctx->ssl, (int)ctx->sock);
        fc_SSL_set_tlsext_host_name(ctx->ssl, ctx->host);
        if (fc_SSL_connect(ctx->ssl) <= 0) {
            strcpy(ctx->error_msg, "SSL handshake failed");
            ctx->state = FETCH_STATE_ERROR;
            return;
        }
    }

    /* Send request */
    {
        int total_sent = 0;
        while (total_sent < ctx->request_len) {
            int remaining = ctx->request_len - total_sent;
            if (ctx->is_https)
                n = fc_SSL_write(ctx->ssl, ctx->request_buf + total_sent, remaining);
            else
                n = fc_send(ctx->sock, ctx->request_buf + total_sent, remaining, 0);
            if (n <= 0) {
                strcpy(ctx->error_msg, "Send failed");
                ctx->state = FETCH_STATE_ERROR;
                return;
            }
            total_sent += n;
        }
    }

    /* Receive response */
    ctx->response_cap = 8192;
    ctx->response_buf = malloc(ctx->response_cap);
    if (!ctx->response_buf) {
        strcpy(ctx->error_msg, "Failed to allocate response buffer");
        ctx->state = FETCH_STATE_ERROR;
        return;
    }
    ctx->response_len = 0;

    for (;;) {
        if (ctx->response_len + 4096 > ctx->response_cap) {
            int new_cap = ctx->response_cap * 2;
            char *new_buf = realloc(ctx->response_buf, new_cap);
            if (!new_buf) {
                strcpy(ctx->error_msg, "Out of memory");
                ctx->state = FETCH_STATE_ERROR;
                return;
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
        if (n <= 0) break;
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
    (void)one;
}

/* ================================================================
 * Worker process entry point
 *
 * Spawned by fetch_create() via CreateNewProc. Picks up the
 * FetchContext from a global handoff slot, does the full
 * synchronous HTTP transaction, then posts a completion message
 * to the main task's reply port.
 *
 * The worker process shares the library's data segment but runs
 * on its own stack with its own Task context. The main task can
 * continue servicing its event loop while the worker blocks on
 * DNS, TLS, and socket I/O.
 * ================================================================ */
static volatile FetchContext *fc_pending_worker_ctx = NULL;

static void fetch_worker_entry(void)
{
    FetchContext *ctx = (FetchContext *)fc_pending_worker_ctx;
    fc_pending_worker_ctx = NULL;
    if (!ctx) return;

    ctx->worker_started = 1;

    /* Perform the full HTTP transaction synchronously */
    fetch_do_sync(ctx);

    /* Mark done and notify main task */
    ctx->worker_done = 1;
    if (ctx->reply_port) {
        ctx->reply_msg = &ctx->_reply_msg_storage;
        ctx->reply_msg->mn_Node.ln_Type = NT_MESSAGE;
        ctx->reply_msg->mn_Length = sizeof(struct Message);
        ctx->reply_msg->mn_ReplyPort = NULL;
        fc_PutMsg(ctx->reply_port, ctx->reply_msg);
    }
    /* Worker exits when this function returns */
}

FetchContext *fetch_create(const char *url, const char *method,
                           const char *custom_headers,
                           const char *body, int body_len)
{
    FetchContext *ctx;
    struct TagItem tags[6];

    if (fc_ensure_socket_lib() < 0) return NULL;

    ctx = malloc(sizeof(FetchContext));
    if (!ctx) return NULL;
    memset(ctx, 0, sizeof(FetchContext));

    ctx->sock = -1;
    ctx->state = FETCH_STATE_INIT;

    /* Save URL + parse */
    strncpy(ctx->url, url, sizeof(ctx->url) - 1);
    if (fc_parse_url(url, &ctx->is_https, ctx->host, sizeof(ctx->host),
                     &ctx->port, ctx->path, sizeof(ctx->path)) < 0) {
        snprintf(ctx->error_msg, sizeof(ctx->error_msg),
                 "Invalid URL: %s", url);
        ctx->state = FETCH_STATE_ERROR;
        return ctx;
    }

    /* Copy method, custom_headers, body into ctx so the worker
     * doesn't need to touch caller's memory. */
    if (method) {
        strncpy(ctx->method_buf, method, sizeof(ctx->method_buf) - 1);
    }
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

    /* Create reply port for worker-to-main signaling */
    ctx->reply_port = fc_CreateMsgPort();
    if (!ctx->reply_port) {
        strcpy(ctx->error_msg, "Failed to create MsgPort");
        ctx->state = FETCH_STATE_ERROR;
        return ctx;
    }

    /* Hand off context to worker via global slot */
    fc_pending_worker_ctx = ctx;

    /* Spawn worker process */
    tags[0].ti_Tag = NP_Entry;
    tags[0].ti_Data = (ULONG)fetch_worker_entry;
    tags[1].ti_Tag = NP_Name;
    tags[1].ti_Data = (ULONG)"qjs_fetch_worker";
    tags[2].ti_Tag = NP_StackSize;
    tags[2].ti_Data = 32768;
    tags[3].ti_Tag = NP_Priority;
    tags[3].ti_Data = 0;
    tags[4].ti_Tag = NP_CopyVars;
    tags[4].ti_Data = FALSE;
    tags[5].ti_Tag = TAG_END;
    tags[5].ti_Data = 0;

    if (!fc_CreateNewProc(tags)) {
        fc_pending_worker_ctx = NULL;
        fc_DeleteMsgPort(ctx->reply_port);
        ctx->reply_port = NULL;
        strcpy(ctx->error_msg, "Failed to spawn worker process");
        ctx->state = FETCH_STATE_ERROR;
        return ctx;
    }

    /* Worker is running; state stays INIT until it finishes.
     * fetch_step() will poll the reply port. */
    ctx->state = FETCH_STATE_CONNECTING; /* reuse as "in flight" */
    return ctx;
}

/* fetch_step -- main task's non-blocking check for worker completion.
 * Polled by the JS timer callback. */
int fetch_step(FetchContext *ctx, int *want_read, int *want_write)
{
    struct Message *msg;

    *want_read = 0;
    *want_write = 0;

    if (!ctx) return 1;

    /* Already finished? */
    if (ctx->state == FETCH_STATE_DONE || ctx->state == FETCH_STATE_ERROR)
        return 1;

    /* Check if worker posted its completion message */
    if (!ctx->reply_port) {
        /* Shouldn't happen -- no worker was spawned */
        ctx->state = FETCH_STATE_ERROR;
        strcpy(ctx->error_msg, "No reply port");
        return 1;
    }

    msg = fc_GetMsg(ctx->reply_port);
    if (!msg) {
        /* Worker still running -- caller should reschedule */
        return 0;
    }

    /* Worker posted its message. The message is storage inside ctx;
     * we don't need to free it separately. The worker has already set
     * ctx->state to DONE or ERROR. */
    return 1;
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

void fetch_destroy(FetchContext *ctx)
{
    if (!ctx) return;

    /* Worker is responsible for its own socket/SSL cleanup once it
     * posts its completion message. Main task only closes the reply
     * port after the worker's message has been received (indicated
     * by worker_done == 1). */

    if (ctx->ssl) {
        fc_SSL_shutdown(ctx->ssl);
        fc_SSL_free(ctx->ssl);
    }
    if (ctx->sock >= 0) {
        fc_CloseSocket(ctx->sock);
    }
    if (ctx->reply_port) fc_DeleteMsgPort(ctx->reply_port);
    if (ctx->request_buf) free(ctx->request_buf);
    if (ctx->response_buf) free(ctx->response_buf);
    if (ctx->headers_raw) free(ctx->headers_raw);
    if (ctx->custom_headers_copy) free(ctx->custom_headers_copy);
    if (ctx->body_copy) free(ctx->body_copy);
    free(ctx);
}

#endif /* __VBCC__ */
