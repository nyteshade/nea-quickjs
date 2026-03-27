/*
 * amiga_ssl.h — AmiSSL integration for QuickJS on AmigaOS
 *
 * Provides HTTP/HTTPS client using AmiSSL + bsdsocket.library.
 * Lazy initialization: AmiSSL is opened on first use.
 */
#ifndef AMIGA_SSL_H
#define AMIGA_SSL_H

/* Initialize AmiSSL (called automatically on first use).
 * Returns 0 on success, -1 on failure. */
int amiga_ssl_init(void);

/* Cleanup AmiSSL (call on program exit). */
void amiga_ssl_cleanup(void);

/* Fetch a URL using AmiSSL's OSSL_HTTP_get().
 * Supports both http:// and https://.
 *
 * url:      the URL to fetch
 * buf_out:  receives malloc'd buffer with response body (caller frees)
 * len_out:  receives length of response body
 * status_out: receives HTTP status code (or 0 on error)
 * headers_out: if non-NULL, receives malloc'd buffer with response headers
 * headers_len_out: if non-NULL, receives length of headers
 *
 * Returns 0 on success, -1 on failure.
 */
int amiga_http_get(const char *url,
                   char **buf_out, int *len_out,
                   int *status_out,
                   char **headers_out, int *headers_len_out);

#endif /* AMIGA_SSL_H */
