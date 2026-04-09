/*
 * amiga_ssl_lib.c — AmiSSL HTTP/HTTPS client for quickjs.library (VBCC)
 *
 * Uses VBCC inline assembly stubs from AmiSSL SDK's inline/ headers
 * which embed `jsr -N(a6)` directly at the call site, sidestepping
 * the __reg("a6") frame pointer clobber issue.
 */

#ifdef __VBCC__

#include "amiga_ssl.h"

/* Suppress AMISSL static inline functions to avoid macro conflicts */
#define AMISSL_NO_STATIC_FUNCTIONS

#pragma amiga-align
#include <exec/types.h>
#include <utility/tagitem.h>
#include <proto/exec.h>
#include <proto/dos.h>
#pragma default-align

/* AmiSSL master library — VBCC inline header (safe, no openssl conflicts) */
#include <libraries/amisslmaster.h>
#include <amissl/tags.h>
#include <inline/amisslmaster_protos.h>

/* Forward declare OpenSSL types we use */
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

/* The amissl_protos.h header has many type dependencies. We need just
 * the SSL functions we use. Declare them manually with the same VBCC
 * inline syntax (function = "jsr -N(a6)") that bypasses __reg("a6")
 * frame pointer issues. */

extern struct Library *AmiSSLBase;

/* Manually-declared inline stubs for the SSL functions we use.
 * These embed `jsr -N(a6)` directly via VBCC inline assembly,
 * avoiding the __reg("a6") frame pointer clobber. */

static SSL_CTX * __SSL_CTX_new(__reg("a6") struct Library *base,
                               __reg("a0") const SSL_METHOD *meth)
                               = "\tjsr\t-8208(a6)";

static void __SSL_CTX_free(__reg("a6") struct Library *base,
                           __reg("a0") SSL_CTX *a) = "\tjsr\t-8214(a6)";

static int __SSL_set_fd(__reg("a6") struct Library *base,
                        __reg("a0") SSL *s, __reg("d0") int fd)
                        = "\tjsr\t-8358(a6)";

static SSL * __SSL_new(__reg("a6") struct Library *base,
                       __reg("a0") SSL_CTX *ctx) = "\tjsr\t-8784(a6)";

static void __SSL_free(__reg("a6") struct Library *base,
                       __reg("a0") SSL *ssl) = "\tjsr\t-8820(a6)";

static int __SSL_connect(__reg("a6") struct Library *base,
                         __reg("a0") SSL *ssl) = "\tjsr\t-8832(a6)";

static int __SSL_read(__reg("a6") struct Library *base,
                      __reg("a0") SSL *ssl,
                      __reg("a1") void *buf,
                      __reg("d0") int num) = "\tjsr\t-8838(a6)";

static int __SSL_write(__reg("a6") struct Library *base,
                       __reg("a0") SSL *ssl,
                       __reg("a1") const void *buf,
                       __reg("d0") int num) = "\tjsr\t-8850(a6)";

static long __SSL_ctrl(__reg("a6") struct Library *base,
                       __reg("a0") SSL *ssl,
                       __reg("d0") int cmd,
                       __reg("d1") long larg,
                       __reg("a1") void *parg) = "\tjsr\t-8856(a6)";

static int __SSL_shutdown(__reg("a6") struct Library *base,
                          __reg("a0") SSL *s) = "\tjsr\t-8994(a6)";

static const SSL_METHOD * __TLS_client_method(__reg("a6") struct Library *base)
                                              = "\tjsr\t-26934(a6)";

/* Convenience macros */
#define SSL_CTX_new(m)       __SSL_CTX_new(AmiSSLBase, (m))
#define SSL_CTX_free(a)      __SSL_CTX_free(AmiSSLBase, (a))
#define SSL_set_fd(s,f)      __SSL_set_fd(AmiSSLBase, (s), (f))
#define SSL_new(c)           __SSL_new(AmiSSLBase, (c))
#define SSL_free(s)          __SSL_free(AmiSSLBase, (s))
#define SSL_connect(s)       __SSL_connect(AmiSSLBase, (s))
#define SSL_read(s,b,n)      __SSL_read(AmiSSLBase, (s), (b), (n))
#define SSL_write(s,b,n)     __SSL_write(AmiSSLBase, (s), (b), (n))
#define SSL_ctrl(s,c,l,p)    __SSL_ctrl(AmiSSLBase, (s), (c), (l), (p))
#define SSL_shutdown(s)      __SSL_shutdown(AmiSSLBase, (s))
#define TLS_client_method()  __TLS_client_method(AmiSSLBase)

/* SNI support */
#ifndef SSL_CTRL_SET_TLSEXT_HOSTNAME
#define SSL_CTRL_SET_TLSEXT_HOSTNAME 55
#define TLSEXT_NAMETYPE_host_name 0
#define SSL_set_tlsext_host_name(ssl, name) \
    SSL_ctrl(ssl, SSL_CTRL_SET_TLSEXT_HOSTNAME, TLSEXT_NAMETYPE_host_name, (void *)name)
#endif

/* BSD socket types — declare manually */
#define AF_INET     2
#define SOCK_STREAM 1

struct in_addr {
    unsigned long s_addr;
};

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

extern struct Library *SocketBase;

/* bsdsocket.library inline stubs */
static long __socket(__reg("a6") struct Library *base,
                     __reg("d0") long domain,
                     __reg("d1") long type,
                     __reg("d2") long protocol) = "\tjsr\t-30(a6)";

static long __connect(__reg("a6") struct Library *base,
                      __reg("d0") long s,
                      __reg("a0") const struct sockaddr *name,
                      __reg("d1") long namelen) = "\tjsr\t-54(a6)";

static long __send(__reg("a6") struct Library *base,
                   __reg("d0") long s,
                   __reg("a0") const void *msg,
                   __reg("d1") long len,
                   __reg("d2") long flags) = "\tjsr\t-66(a6)";

static long __recv(__reg("a6") struct Library *base,
                   __reg("d0") long s,
                   __reg("a0") void *buf,
                   __reg("d1") long len,
                   __reg("d2") long flags) = "\tjsr\t-78(a6)";

static long __CloseSocket(__reg("a6") struct Library *base,
                          __reg("d0") long d) = "\tjsr\t-120(a6)";

static struct hostent * __gethostbyname(__reg("a6") struct Library *base,
                                        __reg("a0") const char *name)
                                        = "\tjsr\t-210(a6)";

#define socket(d,t,p)       __socket(SocketBase, (d), (t), (p))
#define connect(s,a,l)      __connect(SocketBase, (s), (a), (l))
#define send(s,m,l,f)       __send(SocketBase, (s), (m), (l), (f))
#define recv(s,b,l,f)       __recv(SocketBase, (s), (b), (l), (f))
#define CloseSocket(d)      __CloseSocket(SocketBase, (d))
#define gethostbyname(n)    __gethostbyname(SocketBase, (n))

#include <stdlib.h>
#include <string.h>
#include <errno.h>

/* Shared library bases — opened at runtime */
struct Library *AmiSSLMasterBase = NULL;
struct Library *AmiSSLBase = NULL;
struct Library *AmiSSLExtBase = NULL;
struct Library *SocketBase = NULL;

static SSL_CTX *ssl_ctx = NULL;
static int ssl_initialized = 0;

int amiga_ssl_init(void)
{
    if (ssl_initialized)
        return 0;

    SocketBase = OpenLibrary("bsdsocket.library", 4);
    if (!SocketBase)
        return -1;

    AmiSSLMasterBase = OpenLibrary("amisslmaster.library",
                                   AMISSLMASTER_MIN_VERSION);
    if (!AmiSSLMasterBase) {
        CloseLibrary(SocketBase);
        SocketBase = NULL;
        return -1;
    }

    /* OpenAmiSSLTags from inline header — handles the variadic correctly */
    if (OpenAmiSSLTags(AMISSL_CURRENT_VERSION,
                       AmiSSL_UsesOpenSSLStructs, FALSE,
                       AmiSSL_GetAmiSSLBase, &AmiSSLBase,
                       AmiSSL_GetAmiSSLExtBase, &AmiSSLExtBase,
                       AmiSSL_SocketBase, SocketBase,
                       AmiSSL_ErrNoPtr, &errno,
                       TAG_DONE) != 0) {
        CloseLibrary(AmiSSLMasterBase);
        AmiSSLMasterBase = NULL;
        CloseLibrary(SocketBase);
        SocketBase = NULL;
        return -1;
    }

    ssl_ctx = SSL_CTX_new(TLS_client_method());
    ssl_initialized = 1;
    return 0;
}

void amiga_ssl_cleanup(void)
{
    if (!ssl_initialized)
        return;
    if (ssl_ctx) {
        SSL_CTX_free(ssl_ctx);
        ssl_ctx = NULL;
    }
    if (AmiSSLBase) {
        CloseAmiSSL();
        AmiSSLBase = NULL;
        AmiSSLExtBase = NULL;
    }
    if (AmiSSLMasterBase) {
        CloseLibrary(AmiSSLMasterBase);
        AmiSSLMasterBase = NULL;
    }
    if (SocketBase) {
        CloseLibrary(SocketBase);
        SocketBase = NULL;
    }
    ssl_initialized = 0;
}

/* URL parsing */
static int parse_url(const char *url, int *is_https,
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
        *port = atoi(host_end + 1);
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

/* HTTP GET */
int amiga_http_get(const char *url,
                   char **buf_out, int *len_out,
                   int *status_out,
                   char **headers_out, int *headers_len_out)
{
    static char host[256];
    static char path[1024];
    static char request[2048];
    int is_https, port;
    long sock;
    struct hostent *he;
    struct sockaddr_in addr;
    SSL *ssl = NULL;
    char *data = NULL;
    int data_len = 0, data_cap = 0;
    int n, req_len;
    char *header_end;
    int content_start = 0;

    *buf_out = NULL;
    *len_out = 0;
    *status_out = 0;
    if (headers_out) *headers_out = NULL;
    if (headers_len_out) *headers_len_out = 0;

    if (parse_url(url, &is_https, host, sizeof(host),
                  &port, path, sizeof(path)) < 0)
        return -1;

    if (amiga_ssl_init() != 0)
        return -1;

    if (is_https && !ssl_ctx)
        return -2;

    he = gethostbyname(host);
    if (!he)
        return -3;

    sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0)
        return -4;

    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = (unsigned short)port;
    memcpy(&addr.sin_addr, he->h_addr, he->h_length);

    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        CloseSocket(sock);
        return -4;
    }

    if (is_https) {
        ssl = SSL_new(ssl_ctx);
        if (!ssl) {
            CloseSocket(sock);
            return -2;
        }
        SSL_set_fd(ssl, (int)sock);
        SSL_set_tlsext_host_name(ssl, host);
        if (SSL_connect(ssl) <= 0) {
            SSL_free(ssl);
            CloseSocket(sock);
            return -5;
        }
    }

    snprintf(request, sizeof(request),
             "GET %s HTTP/1.0\r\n"
             "Host: %s\r\n"
             "User-Agent: qjs/0.58\r\n"
             "Connection: close\r\n"
             "\r\n",
             path, host);
    req_len = strlen(request);

    if (is_https)
        n = SSL_write(ssl, request, req_len);
    else
        n = send(sock, request, req_len, 0);

    if (n <= 0) {
        if (ssl) { SSL_shutdown(ssl); SSL_free(ssl); }
        CloseSocket(sock);
        return -1;
    }

    data_cap = 8192;
    data = malloc(data_cap);
    if (!data) {
        if (ssl) { SSL_shutdown(ssl); SSL_free(ssl); }
        CloseSocket(sock);
        return -1;
    }

    for (;;) {
        if (data_len + 4096 > data_cap) {
            data_cap *= 2;
            data = realloc(data, data_cap);
            if (!data) {
                if (ssl) { SSL_shutdown(ssl); SSL_free(ssl); }
                CloseSocket(sock);
                return -1;
            }
        }
        if (is_https)
            n = SSL_read(ssl, data + data_len, data_cap - data_len - 1);
        else
            n = recv(sock, data + data_len, data_cap - data_len - 1, 0);
        if (n <= 0)
            break;
        data_len += n;
    }
    data[data_len] = '\0';

    if (ssl) {
        SSL_shutdown(ssl);
        SSL_free(ssl);
    }
    CloseSocket(sock);

    header_end = strstr(data, "\r\n\r\n");
    if (header_end) {
        content_start = (header_end - data) + 4;
        {
            char *sp = strchr(data, ' ');
            if (sp) *status_out = atoi(sp + 1);
        }
        if (headers_out && headers_len_out) {
            int hlen = header_end - data;
            *headers_out = malloc(hlen + 1);
            if (*headers_out) {
                memcpy(*headers_out, data, hlen);
                (*headers_out)[hlen] = '\0';
                *headers_len_out = hlen;
            }
        }
        *len_out = data_len - content_start;
        *buf_out = malloc(*len_out + 1);
        if (*buf_out) {
            memcpy(*buf_out, data + content_start, *len_out);
            (*buf_out)[*len_out] = '\0';
        }
        free(data);
    } else {
        *buf_out = data;
        *len_out = data_len;
        *status_out = 0;
    }

    return (*buf_out) ? 0 : -1;
}

#endif /* __VBCC__ */
