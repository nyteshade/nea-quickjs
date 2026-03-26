/*
 * amiga_ssl.c — AmiSSL integration for QuickJS on AmigaOS
 *
 * Uses AmiSSL shared library (amisslmaster.library + amissl.library)
 * and bsdsocket.library for native HTTP/HTTPS support.
 *
 * SAS/C 6.58 cannot process the full OpenSSL headers (line buffer
 * overflow in safestack.h).  We use pragmas + minimal forward
 * declarations instead.
 */

#include "amiga_ssl.h"

#include <exec/types.h>
#include <utility/tagitem.h>
#include <proto/exec.h>
#include <proto/dos.h>

/* AmiSSL library tags and version constants — safe for SAS/C */
#include <libraries/amisslmaster.h>
#include <amissl/tags.h>

/* SAS/C pragmas for library function dispatch — no OpenSSL headers needed */
#include <pragmas/amisslmaster_pragmas.h>

/* Forward declarations — avoids including full OpenSSL headers */
typedef struct ssl_ctx_st SSL_CTX;
typedef struct ssl_method_st SSL_METHOD;
typedef struct bio_st BIO;
typedef struct bio_method_st BIO_METHOD;
typedef struct stack_st OPENSSL_STACK;

/* amisslmaster.library function prototypes */
extern struct Library *AmiSSLMasterBase;
LONG OpenAmiSSLTagList(LONG APIVersion, struct TagItem *tags);
void CloseAmiSSL(void);

#include <stdlib.h>
#include <string.h>
#include <errno.h>

/* Shared library bases — opened at runtime */
struct Library *AmiSSLMasterBase = NULL;
struct Library *AmiSSLBase = NULL;
struct Library *AmiSSLExtBase = NULL;
struct Library *SocketBase = NULL;

static int ssl_initialized = 0;

int amiga_ssl_init(void)
{
    if (ssl_initialized)
        return 0;

    /* Open bsdsocket.library — required for network I/O */
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

    ssl_initialized = 1;
    return 0;
}

void amiga_ssl_cleanup(void)
{
    if (!ssl_initialized)
        return;

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

/*
 * HTTP GET using bsdsocket.library directly.
 *
 * For now this implements plain HTTP only (no SSL/TLS).
 * HTTPS support requires calling AmiSSL's SSL_* functions which
 * need the amissl pragmas — TODO for a future update.
 *
 * The AmiSSL initialization above is still done so that the
 * infrastructure is ready when HTTPS is added.
 */

/* bsdsocket.library function prototypes */
/* These are accessed via the shared library, declared here to
 * avoid needing full BSD headers which SAS/C may not have */
extern struct Library *SocketBase;

/* We'll use the socket functions through direct library calls.
 * For now, implement a minimal HTTP client. */

/* TODO: implement amiga_http_get using bsdsocket.library recv/send
 * and AmiSSL for HTTPS.  For now, return an error directing the
 * user to use os.exec with an HTTP tool. */

int amiga_http_get(const char *url,
                   char **buf_out, int *len_out,
                   int *status_out,
                   char **headers_out, int *headers_len_out)
{
    (void)url;
    *buf_out = NULL;
    *len_out = 0;
    *status_out = 0;
    if (headers_out) *headers_out = NULL;
    if (headers_len_out) *headers_len_out = 0;

    /* Not yet implemented — AmiSSL is initialized but the HTTP
     * client using bsdsocket + SSL needs the amissl pragmas
     * which require further SAS/C header work.
     * Use os.exec(["curl", url]) as a workaround. */
    return -1;
}
