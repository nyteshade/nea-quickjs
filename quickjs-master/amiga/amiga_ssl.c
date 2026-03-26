/*
 * amiga_ssl.c — HTTP/HTTPS client for QuickJS on AmigaOS
 *
 * Uses bsdsocket.library for TCP sockets and AmiSSL shared libraries
 * for TLS/SSL.  No static linking — all runtime shared libraries.
 *
 * SAS/C compile flags: MEMSIZE=HUGE IDLEN=80
 */

#include "amiga_ssl.h"

/* Prevent OpenSSL static inline functions (SAS/C line buffer overflow) */
#define AMISSL_NO_STATIC_FUNCTIONS

#include <exec/types.h>
#include <utility/tagitem.h>
#include <proto/exec.h>
#include <proto/dos.h>

/* AmiSSL tags and version constants — safe for SAS/C */
#include <libraries/amisslmaster.h>
#include <amissl/tags.h>

/* SAS/C pragmas for amisslmaster dispatch */
#include <pragmas/amisslmaster_pragmas.h>

/* -----------------------------------------------------------------------
 * BSD socket types and function declarations.
 * We declare everything manually to avoid the netinclude header chain
 * which pulls in netlib_protos.h → fd_set/select() → SAS/C errors.
 * --------------------------------------------------------------------- */

/* Socket constants */
#define AF_INET     2
#define SOCK_STREAM 1

/* Network types */
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

/* SAS/C pragmas for bsdsocket.library dispatch */
#include <pragmas/socket_pragmas.h>

/* Socket function prototypes */
LONG socket(LONG domain, LONG type, LONG protocol);
LONG connect(LONG s, const struct sockaddr *name, LONG namelen);
LONG send(LONG s, const UBYTE *msg, LONG len, LONG flags);
LONG recv(LONG s, UBYTE *buf, LONG len, LONG flags);
LONG CloseSocket(LONG d);
struct hostent *gethostbyname(const UBYTE *name);

/* AmiSSL function pragmas — gives us SSL_*, BIO_*, etc. */
#include <pragmas/amissl_pragmas.h>

/* Forward declarations for OpenSSL types (avoid full headers) */
typedef struct ssl_ctx_st SSL_CTX;
typedef struct ssl_st SSL;
typedef struct ssl_method_st SSL_METHOD;

/* AmiSSL function prototypes we need (normally from proto/amissl.h
 * but we avoid full OpenSSL headers due to SAS/C limitations) */
SSL_CTX *SSL_CTX_new(const SSL_METHOD *method);
void SSL_CTX_free(SSL_CTX *ctx);
const SSL_METHOD *TLS_client_method(void);
SSL *SSL_new(SSL_CTX *ctx);
void SSL_free(SSL *ssl);
int SSL_set_fd(SSL *ssl, int fd);
int SSL_connect(SSL *ssl);
int SSL_read(SSL *ssl, void *buf, int num);
int SSL_write(SSL *ssl, const void *buf, int num);
int SSL_shutdown(SSL *ssl);

#include <stdlib.h>
#include <stdio.h>
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

    /* Open bsdsocket.library — required for all network I/O */
    SocketBase = OpenLibrary("bsdsocket.library", 4);
    if (!SocketBase)
        return -1;

    /* Open amisslmaster.library — manages AmiSSL versions */
    AmiSSLMasterBase = OpenLibrary("amisslmaster.library",
                                   AMISSLMASTER_MIN_VERSION);
    if (!AmiSSLMasterBase) {
        CloseLibrary(SocketBase);
        SocketBase = NULL;
        return -1;
    }

    /* Initialize AmiSSL — gets library bases */
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

    /* Create SSL context for HTTPS */
    ssl_ctx = SSL_CTX_new(TLS_client_method());
    /* ssl_ctx may be NULL if only HTTP is needed — that's OK */

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

/* -----------------------------------------------------------------------
 * URL parsing
 * --------------------------------------------------------------------- */
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
        return -1;  /* unsupported scheme */
    }

    /* Extract host */
    host_start = p;
    host_end = p;
    while (*host_end && *host_end != '/' && *host_end != ':')
        host_end++;

    i = host_end - host_start;
    if (i >= host_size) i = host_size - 1;
    memcpy(host, host_start, i);
    host[i] = '\0';

    /* Optional port */
    if (*host_end == ':') {
        *port = atoi(host_end + 1);
        host_end++;
        while (*host_end >= '0' && *host_end <= '9')
            host_end++;
    }

    /* Path */
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

/* -----------------------------------------------------------------------
 * HTTP GET implementation
 * --------------------------------------------------------------------- */
int amiga_http_get(const char *url,
                   char **buf_out, int *len_out,
                   int *status_out,
                   char **headers_out, int *headers_len_out)
{
    /* Use static buffers to avoid 3KB+ stack allocation */
    static char host[256];
    static char path[1024];
    static char request[2048];
    int is_https, port;
    LONG sock;
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

    /* Parse URL */
    if (parse_url(url, &is_https, host, sizeof(host),
                  &port, path, sizeof(path)) < 0)
        return -1;

    /* Lazy init of network libraries */
    if (amiga_ssl_init() != 0)
        return -1;

    /* Resolve hostname */
    he = gethostbyname((UBYTE *)host);
    if (!he)
        return -1;

    /* Create socket */
    sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0)
        return -1;

    /* Connect */
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    /* 68k is big-endian: htons is a no-op */
    addr.sin_port = (unsigned short)port;
    memcpy(&addr.sin_addr, he->h_addr, he->h_length);

    if (connect(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        CloseSocket(sock);
        return -1;
    }

    /* Set up SSL for HTTPS */
    if (is_https) {
        if (!ssl_ctx) {
            CloseSocket(sock);
            return -1;
        }
        ssl = SSL_new(ssl_ctx);
        if (!ssl) {
            CloseSocket(sock);
            return -1;
        }
        SSL_set_fd(ssl, (int)sock);
        if (SSL_connect(ssl) <= 0) {
            SSL_free(ssl);
            CloseSocket(sock);
            return -1;
        }
    }

    /* Build HTTP request */
    snprintf(request, sizeof(request),
             "GET %s HTTP/1.0\r\n"
             "Host: %s\r\n"
             "User-Agent: qjs/%s\r\n"
             "Connection: close\r\n"
             "\r\n",
             path, host, "0.22");
    req_len = strlen(request);

    /* Send request */
    if (is_https) {
        n = SSL_write(ssl, request, req_len);
    } else {
        n = send(sock, (UBYTE *)request, req_len, 0);
    }
    if (n <= 0) {
        if (ssl) { SSL_shutdown(ssl); SSL_free(ssl); }
        CloseSocket(sock);
        return -1;
    }

    /* Read response */
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
            n = recv(sock, (UBYTE *)(data + data_len),
                     data_cap - data_len - 1, 0);
        if (n <= 0)
            break;
        data_len += n;
    }
    data[data_len] = '\0';

    /* Cleanup connection */
    if (ssl) {
        SSL_shutdown(ssl);
        SSL_free(ssl);
    }
    CloseSocket(sock);

    /* Parse HTTP response: find header/body boundary */
    header_end = strstr(data, "\r\n\r\n");
    if (header_end) {
        content_start = (header_end - data) + 4;

        /* Extract status code from first line: "HTTP/1.x NNN ..." */
        {
            char *sp = strchr(data, ' ');
            if (sp) *status_out = atoi(sp + 1);
        }

        /* Return headers if requested */
        if (headers_out && headers_len_out) {
            int hlen = header_end - data;
            *headers_out = malloc(hlen + 1);
            if (*headers_out) {
                memcpy(*headers_out, data, hlen);
                (*headers_out)[hlen] = '\0';
                *headers_len_out = hlen;
            }
        }

        /* Return body */
        *len_out = data_len - content_start;
        *buf_out = malloc(*len_out + 1);
        if (*buf_out) {
            memcpy(*buf_out, data + content_start, *len_out);
            (*buf_out)[*len_out] = '\0';
        }
        free(data);
    } else {
        /* No header/body boundary found — return raw data */
        *buf_out = data;
        *len_out = data_len;
        *status_out = 0;
    }

    return (*buf_out) ? 0 : -1;
}
