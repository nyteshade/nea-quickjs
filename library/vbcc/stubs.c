/*
 * stubs.c — Symbols needed by vc.lib but not available in
 * shared library context (no C runtime startup / no startup.o).
 *
 * The vbcc-librarytemplate says "do NOT use .lib files", but
 * we need vc.lib for 64-bit integer helpers, string functions,
 * and math. These stubs satisfy the startup-related dependencies
 * that vc.lib pulls in.
 */

#include <stddef.h>

/* SAS/C runtime (in case old .o files reference it) */
void __XCEXIT(void) {}

/* VBCC C runtime exit — should never be called in library context */
void _exit(int code) { for(;;); }
void __exit(int code) { for(;;); }

/* abort — called by assert failures and fatal errors.
 * In library context, we can't exit the process. Just hang. */
void abort(void) { for(;;); }

/* Dummy main — vc.lib _main.c references _main */
int main(void) { return 0; }

/* C runtime constructor/destructor lists — vc.lib's _main.c
 * references these. Provide empty lists (NULL-terminated).
 * The __main() function in vc.lib walks CTOR_LIST calling each
 * entry; with a NULL first entry it does nothing. */
void (*__CTOR_LIST__[1])(void) = { (void (*)(void))0 };
void (*__DTOR_LIST__[1])(void) = { (void (*)(void))0 };

/* printf/fprintf — QuickJS uses these for debug dumps (ENABLE_DUMPS).
 * Since NDEBUG is defined, most dump paths are compiled out. But some
 * error paths still reference printf. In library context, output goes
 * nowhere. Provide no-op stubs. */
#include <stdarg.h>
int printf(const char *fmt, ...) { return 0; }
int fprintf(void *stream, const char *fmt, ...) { return 0; }

/* stdout — referenced by fprintf calls in the engine */
static int _stdout_dummy;
void *stdout = (void *)&_stdout_dummy;
