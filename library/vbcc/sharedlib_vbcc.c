/*
 * sharedlib_vbcc.c — VBCC compiler runtime stubs for shared library context.
 * Provides symbols that the VBCC compiler emits calls to.
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
    for (;;) ;
}

/* ---- SysBase ---- */
/* Some code references SysBase as a global. The library gets it
 * from exec during init and stores in the library base struct.
 * This global is for code that expects a flat SysBase symbol. */
#pragma amiga-align
#include <exec/types.h>
#pragma default-align

struct Library *SysBase = 0;

/* ---- _exit / __exit ---- */
/* In shared library context we can't exit the process. */

void _exit(int code) { (void)code; for(;;); }
void __exit(int code) { (void)code; for(;;); }

/* ---- CTOR/DTOR lists (empty) ---- */

typedef void (*ctor_func)(void);
ctor_func __CTOR_LIST__[1] = { (ctor_func)0 };
ctor_func __DTOR_LIST__[1] = { (ctor_func)0 };

/* ---- main (dummy, never called for library) ---- */

int main(void) { return 0; }

/* ---- SAS/C compat stub ---- */

void __XCEXIT(void) {}
