/*
 * sharedlib_stdio.c — Minimal stdio implementation using dos.library
 *
 * For use inside quickjs.library (shared library, no C startup).
 * Provides fopen/fclose/fread/fwrite/fseek/ftell/fflush/feof/
 * fgetc/fputc/fputs/fprintf/printf and stdin/stdout/stderr.
 *
 * All I/O goes through dos.library LVO calls via sl_DOSBase
 * (set by sharedlib_posix_init).
 */

/* Forward declare Library struct — no AmigaOS headers needed */
struct Library;

#include <stddef.h>
#include <stdarg.h>
#include <string.h>

/* Get VBCC's FILE struct and flag definitions */
#include <stdio.h>

/* DOSBase from sharedlib_posix.c */
extern struct Library *sl_DOSBase;

/* dos.library LVO macro */
#define DOS_LVO(base, off, proto) \
    ((proto)(((char *)(base)) - (off)))

/* dos.library file mode constants */
#define MODE_OLDFILE   1005L
#define MODE_NEWFILE   1006L
#define MODE_READWRITE 1004L

/* dos.library seek offsets */
#define OFFSET_BEGINNING -1L
#define OFFSET_CURRENT    0L
#define OFFSET_END        1L

/* ---- dos.library call wrappers ---- */

static long dos_Open(const char *name, long mode)
{
    return DOS_LVO(sl_DOSBase, 30,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") const char *,
                 __reg("d2") long))(sl_DOSBase, name, mode);
}

static void dos_Close(long file)
{
    DOS_LVO(sl_DOSBase, 36,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long))(sl_DOSBase, file);
}

static long dos_Read(long file, void *buf, long len)
{
    return DOS_LVO(sl_DOSBase, 42,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long,
                 __reg("d2") void *,
                 __reg("d3") long))(sl_DOSBase, file, buf, len);
}

static long dos_Write(long file, const void *buf, long len)
{
    return DOS_LVO(sl_DOSBase, 48,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long,
                 __reg("d2") const void *,
                 __reg("d3") long))(sl_DOSBase, file, buf, len);
}

static long dos_Seek(long file, long pos, long mode)
{
    return DOS_LVO(sl_DOSBase, 66,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long,
                 __reg("d2") long,
                 __reg("d3") long))(sl_DOSBase, file, pos, mode);
}

static long dos_Input(void)
{
    return DOS_LVO(sl_DOSBase, 54,
        long (*)(__reg("a6") struct Library *))(sl_DOSBase);
}

static long dos_Output(void)
{
    return DOS_LVO(sl_DOSBase, 60,
        long (*)(__reg("a6") struct Library *))(sl_DOSBase);
}

static void dos_Flush(long file)
{
    DOS_LVO(sl_DOSBase, 360,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long))(sl_DOSBase, file);
}

static long dos_FGetC(long file)
{
    return DOS_LVO(sl_DOSBase, 306,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long))(sl_DOSBase, file);
}

static long dos_FPutC(long file, long ch)
{
    return DOS_LVO(sl_DOSBase, 312,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long,
                 __reg("d2") long))(sl_DOSBase, file, ch);
}

/* ---- FILE pool (static allocation, no malloc needed) ---- */

#define MAX_OPEN_FILES 32

static FILE _file_pool[MAX_OPEN_FILES];
static int _file_pool_used[MAX_OPEN_FILES];

/* stdin/stdout/stderr — the first 3 slots */
static FILE _stdin_file;
static FILE _stdout_file;
static FILE _stderr_file;

FILE *stdin  = &_stdin_file;
FILE *stdout = &_stdout_file;
FILE *stderr = &_stderr_file;

/* Linked list head/tail for vc.lib compat */
FILE *__firstfile = NULL;
FILE *__lastfile = NULL;

static FILE *alloc_file(void)
{
    int i;
    for (i = 0; i < MAX_OPEN_FILES; i++) {
        if (!_file_pool_used[i]) {
            _file_pool_used[i] = 1;
            memset(&_file_pool[i], 0, sizeof(FILE));
            return &_file_pool[i];
        }
    }
    return NULL;
}

static void free_file(FILE *f)
{
    int i;
    for (i = 0; i < MAX_OPEN_FILES; i++) {
        if (&_file_pool[i] == f) {
            _file_pool_used[i] = 0;
            return;
        }
    }
}

/* ---- Init/Cleanup ---- */

void sharedlib_stdio_init(void)
{
    long in, out;

    if (!sl_DOSBase) return;

    in = dos_Input();
    out = dos_Output();

    memset(&_stdin_file, 0, sizeof(FILE));
    _stdin_file.filehandle = (char *)in;
    _stdin_file.flags = _READ | _READABLE;

    memset(&_stdout_file, 0, sizeof(FILE));
    _stdout_file.filehandle = (char *)out;
    _stdout_file.flags = _WRITE | _WRITEABLE;

    memset(&_stderr_file, 0, sizeof(FILE));
    _stderr_file.filehandle = (char *)out; /* stderr = stdout on AmigaOS */
    _stderr_file.flags = _WRITE | _WRITEABLE;

    memset(_file_pool_used, 0, sizeof(_file_pool_used));

    /* Debug: verify dos_Write works directly */
    if (out) {
        dos_Write(out, "[stdio] init OK, out=", 21);
        /* write hex of out handle */
        {
            char hexbuf[12];
            unsigned long v = (unsigned long)out;
            int i;
            hexbuf[0] = '0'; hexbuf[1] = 'x';
            for (i = 0; i < 8; i++) {
                int d = (v >> (28 - i*4)) & 0xF;
                hexbuf[2+i] = (d < 10) ? '0'+d : 'a'+d-10;
            }
            hexbuf[10] = '\n'; hexbuf[11] = 0;
            dos_Write(out, hexbuf, 11);
        }
    }
}

void sharedlib_stdio_cleanup(void)
{
    int i;
    /* Close any files still open (but not stdin/stdout/stderr) */
    for (i = 0; i < MAX_OPEN_FILES; i++) {
        if (_file_pool_used[i] && _file_pool[i].filehandle) {
            dos_Close((long)_file_pool[i].filehandle);
            _file_pool_used[i] = 0;
        }
    }
}

/* ---- stdio functions ---- */

FILE *fopen(const char *path, const char *mode)
{
    FILE *f;
    long fh;
    long dosmode;
    int flags;

    if (!sl_DOSBase || !path || !mode) return NULL;

    if (mode[0] == 'r') {
        dosmode = MODE_OLDFILE;
        flags = _READ | _READABLE;
        if (mode[1] == '+') flags |= _WRITE | _WRITEABLE;
    } else if (mode[0] == 'w') {
        dosmode = MODE_NEWFILE;
        flags = _WRITE | _WRITEABLE;
        if (mode[1] == '+') flags |= _READ | _READABLE;
    } else if (mode[0] == 'a') {
        dosmode = MODE_READWRITE;
        flags = _WRITE | _WRITEABLE;
        if (mode[1] == '+') flags |= _READ | _READABLE;
    } else {
        return NULL;
    }

    fh = dos_Open(path, dosmode);
    if (!fh) return NULL;

    /* For append mode, seek to end */
    if (mode[0] == 'a') {
        dos_Seek(fh, 0, OFFSET_END);
    }

    f = alloc_file();
    if (!f) {
        dos_Close(fh);
        return NULL;
    }

    f->filehandle = (char *)fh;
    f->flags = flags;
    f->pointer = NULL;
    f->base = NULL;
    f->count = 0;
    f->bufsize = 0;

    return f;
}

int fclose(FILE *f)
{
    if (!f) return EOF;

    /* Don't close stdin/stdout/stderr */
    if (f == stdin || f == stdout || f == stderr) return 0;

    if (f->filehandle) {
        dos_Close((long)f->filehandle);
        f->filehandle = NULL;
    }
    free_file(f);
    return 0;
}

/* For stdout/stderr, always use the CURRENT process's Output() handle.
 * Library init runs once but multiple processes may use the library. */
static long get_filehandle(FILE *f)
{
    if (f == stdout || f == stderr) return dos_Output();
    if (f == stdin) return dos_Input();
    return (long)f->filehandle;
}

size_t fread(void *ptr, size_t size, size_t nmemb, FILE *f)
{
    long total, got, fh;

    if (!f || !ptr || size == 0 || nmemb == 0)
        return 0;

    fh = get_filehandle(f);
    if (!fh) return 0;

    total = (long)(size * nmemb);
    got = dos_Read(fh, ptr, total);

    if (got <= 0) {
        if (got == 0) f->flags |= _EOF;
        else f->flags |= _ERR;
        return 0;
    }

    if (got < total) f->flags |= _EOF;

    return (size_t)got / size;
}

size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *f)
{
    long total, wrote, fh;

    if (!f || !ptr || size == 0 || nmemb == 0)
        return 0;

    fh = get_filehandle(f);
    if (!fh) return 0;

    total = (long)(size * nmemb);
    wrote = dos_Write(fh, ptr, total);

    if (wrote < 0) {
        f->flags |= _ERR;
        return 0;
    }

    return (size_t)wrote / size;
}

int fseek(FILE *f, long offset, int whence)
{
    long doswhence, fh;

    if (!f) return -1;
    fh = get_filehandle(f);
    if (!fh) return -1;

    /* VBCC's stdio.h: SEEK_SET=-1, SEEK_CUR=0, SEEK_END=1
     * dos.library: OFFSET_BEGINNING=-1, OFFSET_CURRENT=0, OFFSET_END=1
     * They match! */
    doswhence = (long)whence;

    dos_Seek(fh, (long)offset, doswhence);
    f->flags &= ~_EOF;
    return 0;
}

long ftell(FILE *f)
{
    long pos, fh;
    if (!f) return -1L;
    fh = get_filehandle(f);
    if (!fh) return -1L;
    pos = dos_Seek(fh, 0, OFFSET_CURRENT);
    return (long)pos;
}

int fflush(FILE *f)
{
    long fh;
    if (!f) {
        /* fflush(NULL) = flush all */
        fh = dos_Output();
        if (fh) dos_Flush(fh);
        return 0;
    }
    fh = get_filehandle(f);
    if (fh) dos_Flush(fh);
    return 0;
}

int fgetc(FILE *f)
{
    long ch, fh;
    if (!f) return EOF;
    fh = get_filehandle(f);
    if (!fh) return EOF;
    ch = dos_FGetC(fh);
    if (ch < 0) {
        f->flags |= _EOF;
        return EOF;
    }
    return (int)ch;
}

int fputc(int c, FILE *f)
{
    long r, fh;
    if (!f) return EOF;
    fh = get_filehandle(f);
    if (!fh) return EOF;
    r = dos_FPutC(fh, (long)c);
    if (r < 0) {
        f->flags |= _ERR;
        return EOF;
    }
    return (unsigned char)c;
}

int fputs(const char *s, FILE *f)
{
    size_t len;
    long fh;
    if (!f || !s) return EOF;
    fh = get_filehandle(f);
    if (!fh) return EOF;
    len = strlen(s);
    if (len == 0) return 0;
    if (dos_Write(fh, s, (long)len) < 0)
        return EOF;
    return 0;
}

char *fgets(char *buf, int size, FILE *f)
{
    int i;
    long ch, fh;

    if (!f || !buf || size <= 0) return NULL;
    fh = get_filehandle(f);
    if (!fh) return NULL;

    for (i = 0; i < size - 1; i++) {
        ch = dos_FGetC(fh);
        if (ch < 0) {
            if (i == 0) {
                f->flags |= _EOF;
                return NULL;
            }
            break;
        }
        buf[i] = (char)ch;
        if (ch == '\n') { i++; break; }
    }
    buf[i] = '\0';
    return buf;
}

/* printf/fprintf use vsnprintf (from sharedlib_printf.c) then fwrite */
extern int vsnprintf(char *buf, size_t size, const char *fmt, va_list ap);

int fprintf(FILE *f, const char *fmt, ...)
{
    char buf[1024];
    va_list ap;
    int len;
    long fh;

    va_start(ap, fmt);
    len = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);

    if (len > 0 && f) {
        fh = get_filehandle(f);
        if (fh) {
            if (len > (int)sizeof(buf) - 1) len = (int)sizeof(buf) - 1;
            dos_Write(fh, buf, (long)len);
        }
    }
    return len;
}

int printf(const char *fmt, ...)
{
    char buf[1024];
    va_list ap;
    int len;
    long fh;

    va_start(ap, fmt);
    len = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);

    fh = dos_Output();
    if (len > 0 && fh) {
        if (len > (int)sizeof(buf) - 1) len = (int)sizeof(buf) - 1;
        dos_Write(fh, buf, (long)len);
    }
    return len;
}

int puts(const char *s)
{
    if (!s) return EOF;
    fputs(s, stdout);
    fputc('\n', stdout);
    return 0;
}

/* getchar/putchar are macros in VBCC's stdio.h — no need to define here */

/* perror */
extern char *strerror(int errnum);
void perror(const char *s)
{
    if (s && *s) {
        fputs(s, stderr);
        fputs(": ", stderr);
    }
    fputs(strerror(0), stderr);
    fputc('\n', stderr);
}

/* freopen — minimal, just for stdout/stderr redirect */
FILE *freopen(const char *path, const char *mode, FILE *f)
{
    /* Not supported in shared library context */
    (void)path; (void)mode; (void)f;
    return NULL;
}

/* tmpfile — not available */
FILE *tmpfile(void)
{
    return NULL;
}

/* setvbuf — no-op (we do unbuffered I/O) */
int setvbuf(FILE *f, char *buf, int mode, size_t size)
{
    (void)f; (void)buf; (void)mode; (void)size;
    return 0;
}

/* setbuf — no-op */
void setbuf(FILE *f, char *buf)
{
    (void)f; (void)buf;
}

/* ungetc — minimal single-char pushback */
int ungetc(int c, FILE *f)
{
    long fh;
    if (!f || c == EOF) return EOF;
    fh = get_filehandle(f);
    if (!fh) return EOF;

    DOS_LVO(sl_DOSBase, 318,
        long (*)(__reg("a6") struct Library *,
                 __reg("d1") long,
                 __reg("d2") long))(sl_DOSBase, fh, (long)c);

    f->flags &= ~_EOF;
    return c;
}

/* _fillbuf / _putbuf — referenced by VBCC's stdio.h macros */
int _fillbuf(FILE *f)
{
    return fgetc(f);
}

int _putbuf(int c, FILE *f)
{
    return fputc(c, f);
}

/* exit/atexit — minimal for shared library */
static void (*_atexit_funcs[16])(void);
static int _atexit_count = 0;

int atexit(void (*func)(void))
{
    if (_atexit_count >= 16) return -1;
    _atexit_funcs[_atexit_count++] = func;
    return 0;
}

void exit(int code)
{
    int i;
    for (i = _atexit_count - 1; i >= 0; i--) {
        if (_atexit_funcs[i]) _atexit_funcs[i]();
    }
    /* In shared library, we can't actually exit. Loop forever. */
    (void)code;
    for (;;) ;
}
