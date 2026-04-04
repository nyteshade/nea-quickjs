/*
 * try_stub.c — Minimal test: can we open quickjs.library at all?
 *
 * Tests the VBCC library template init/open/close path
 * without any engine code. Rename quickjs_stub.library to
 * quickjs.library in LIBS: to test.
 */
#include <stdio.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

struct Library *QJSBase;

const char *QJS_GetVersion(void);
#pragma libcall QJSBase QJS_GetVersion 3c 0

static const char ver[] = "$VER: try_stub 0.50 (03.4.2026)";

int main(void)
{
    const char *v;

    printf("Opening quickjs.library...\n");

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) {
        printf("FATAL: Could not open quickjs.library\n");
        return 20;
    }
    printf("OK! base=0x%lx ver=%ld.%ld\n",
           (unsigned long)QJSBase,
           (long)QJSBase->lib_Version,
           (long)QJSBase->lib_Revision);

    v = QJS_GetVersion();
    printf("GetVersion = '%s'\n", v ? v : "(null)");

    CloseLibrary(QJSBase);
    printf("Closed. Done.\n");
    return 0;
}
