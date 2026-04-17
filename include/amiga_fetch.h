/*
 * amiga_fetch.h -- Non-blocking HTTP/HTTPS fetch for quickjs.library
 *
 * Provides a state-machine-based HTTP client that integrates with
 * QuickJS's event loop via poll()/setReadHandler/setWriteHandler.
 */

#ifndef AMIGA_FETCH_H
#define AMIGA_FETCH_H

/* Opaque fetch context */
typedef struct FetchContext FetchContext;

/* Fetch states (for fetch_get_state) */
#define FETCH_STATE_INIT           0
#define FETCH_STATE_CONNECTING     1
#define FETCH_STATE_SSL_HANDSHAKE  2
#define FETCH_STATE_SENDING        3
#define FETCH_STATE_RECV_HEADERS   4
#define FETCH_STATE_RECV_BODY      5
#define FETCH_STATE_DONE           6
#define FETCH_STATE_ERROR          7

/* Create a new fetch context. Performs DNS lookup (blocking) and
 * initiates non-blocking connect. Returns NULL on immediate failure.
 * custom_headers is a raw string of "Name: Value\r\n" pairs, or NULL.
 */
FetchContext *fetch_create(const char *url, const char *method,
                           const char *custom_headers,
                           const char *body, int body_len);

/* Advance the state machine one step. Call when the socket is ready
 * for I/O (as indicated by poll/WaitSelect).
 * Returns:
 *   0  = still in progress
 *   1  = completed (DONE or ERROR)
 *  -1  = fatal internal error
 * Sets *want_read and *want_write to indicate what events to poll next.
 */
int fetch_step(FetchContext *ctx, int *want_read, int *want_write);

/* Get the socket fd for event loop registration. Returns -1 if none. */
int fetch_get_fd(FetchContext *ctx);

/* Get current state. */
int fetch_get_state(FetchContext *ctx);

/* Get HTTP status code (valid after DONE). */
int fetch_get_status(FetchContext *ctx);

/* Get raw response headers string (valid after RECV_BODY or DONE).
 * Returns pointer to internal buffer; do not free. */
const char *fetch_get_headers(FetchContext *ctx, int *len);

/* Get response body (valid after DONE).
 * Returns pointer to internal buffer; do not free. */
const char *fetch_get_body(FetchContext *ctx, int *len);

/* Get the final URL (for tracking redirects in future). */
const char *fetch_get_url(FetchContext *ctx);

/* Get error message (valid after ERROR). */
const char *fetch_get_error(FetchContext *ctx);

/* Free all resources including closing the socket. */
void fetch_destroy(FetchContext *ctx);

/* Request the worker wind down early. Safe to call from any task
 * while the worker is in its recv loop. Next recv iteration sees
 * the flag, transitions state to ERROR with "aborted" error_msg,
 * closes socket, exits. fetch_destroy afterwards joins cleanly. */
void fetch_abort(FetchContext *ctx);

#endif /* AMIGA_FETCH_H */
