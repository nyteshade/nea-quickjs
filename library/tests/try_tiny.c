/*
 * try_tiny.c — Test app for tiny_test.library (VBCC template test)
 *
 * Compile with SAS/C:
 *   sc try_tiny.c NOSTACKCHECK NOCHKABORT ABSFP IDIR=sc:include NOICONS
 *   slink lib:c.o try_tiny.o TO try_tiny LIB lib:scnb.lib lib:amiga.lib
 */
#include <stdio.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

struct Library *TinyBase;

LONG TT_GetAnswer(void);
#pragma libcall TinyBase TT_GetAnswer 1e 0

static const char ver[] = "$VER: try_tiny 1.0 (03.4.2026)";

int main(void)
{
    LONG answer;

    printf("Opening tiny_test.library...\n");
    TinyBase = OpenLibrary("tiny_test.library", 0);
    if (!TinyBase) {
        printf("FATAL: Could not open tiny_test.library\n");
        return 20;
    }
    printf("OK! base=0x%lx ver=%ld.%ld\n",
           (unsigned long)TinyBase,
           (long)TinyBase->lib_Version,
           (long)TinyBase->lib_Revision);

    answer = TT_GetAnswer();
    printf("TT_GetAnswer = %ld (expect 42)\n", (long)answer);

    CloseLibrary(TinyBase);
    printf("Done.\n");
    return 0;
}
