/*
 * sharedlib_vbcc.c — VBCC compiler runtime stubs for shared library context.
 * Provides symbols that the VBCC compiler emits calls to, or that vc.lib
 * would normally supply.
 * No .lib dependencies.
 */

/* ---- Float constants (IEEE 754 bit patterns) ---- */

/* VBCC references these as extern const for INFINITY and NAN */
const char __pInf_s[4] = { 0x7F, 0x80, 0x00, 0x00 }; /* +Inf (float) */
const char __qNaN_s[4] = { 0x7F, 0xC0, 0x00, 0x00 }; /* quiet NaN (float) */

/* double-precision versions if needed */
const char __pInf_d[8] = { 0x7F, 0xF0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };

/* ---- abort ---- */

void abort(void)
{
    /* In shared library context we can't exit the process.
     * Spin forever — the caller should never reach here. */
    for (;;) ;
}

/* ---- printf/fprintf stubs ---- */

/* QuickJS references printf/fprintf in debug and error paths.
 * In shared library context there is no stdout. Stub to no-op. */
int printf(const char *fmt, ...) { return 0; }
int fprintf(void *stream, const char *fmt, ...) { return 0; }

/* stdout — referenced by fprintf. Points to a dummy. */
static int _stdout_dummy;
void *stdout = (void *)&_stdout_dummy;

/* VBCC internal printf helpers — referenced if snprintf/vsnprintf
 * are pulled in from vc.lib. Since we'll provide our own, these
 * are stubs in case anything still references them. */
/* VBCC internal printf helpers. C names with double underscore
 * -> triple underscore linker symbols. These are the actual
 * formatting core of VBCC's printf. Our snprintf/vsnprintf in
 * sharedlib_printf.c provides the full implementation, so these
 * are only needed as fallback stubs. */
void __v0printf(void) {}
void __v0fprintf(void) {}
void _putbuf(void) {}

/* ---- _exit / __exit ---- */

void _exit(int code) { for(;;); }
void __exit(int code) { for(;;); }

/* ---- CTOR/DTOR lists (empty) ---- */

typedef void (*ctor_func)(void);
ctor_func __CTOR_LIST__[1] = { (ctor_func)0 };
ctor_func __DTOR_LIST__[1] = { (ctor_func)0 };

/* ---- main (dummy, never called for library) ---- */

int main(void) { return 0; }

/* ---- SAS/C compat stub ---- */

void __XCEXIT(void) {}
