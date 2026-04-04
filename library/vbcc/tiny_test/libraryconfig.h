/*
 * libraryconfig.h — Minimal library: one function, no dependencies.
 */
#ifndef LIBRARYCONFIG_H
#define LIBRARYCONFIG_H

#include <exec/types.h>
#include <exec/libraries.h>
#include <exec/execbase.h>
#include <dos/dos.h>
#include "../execinline.h"

struct TinyBase {
    struct Library iLibrary;
    UWORD iPadding;
    BPTR iSegmentList;
    struct ExecBase *iSysBase;
};

#define LIBRARY_NAME "tiny_test.library"
#define LIBRARY_VERSION_STRING "\0$VER: tiny_test.library 1.0 (03.4.2026)\r\n"
#define LIBRARY_VERSION_OUTPUT &LIBRARY_VERSION_STRING[7]
#define LIBRARY_VERSION 1
#define LIBRARY_REVISION 0
#define LIBRARY_BASE_TYPE struct TinyBase

/* One function: returns 42 */
LONG TT_GetAnswer(__reg("a6") LIBRARY_BASE_TYPE *base);

#define LIBRARY_FUNCTIONS \
    (APTR) TT_GetAnswer

#endif
