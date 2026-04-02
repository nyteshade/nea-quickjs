/*
 * flushlibs.c — Force-close and flush test libraries
 *
 * Usage: flushlibs
 */
#define _USEOLDEXEC_ 1
#include <exec/types.h>
#include <exec/memory.h>
#include <exec/execbase.h>
#include <proto/exec.h>
#include <stdio.h>

extern struct ExecBase *SysBase;

static const char ver[] = "$VER: flushlibs 1.1 (29.3.2026)";

static void flush_one(const char *name)
{
    struct Library *lib;

    Forbid();
    lib = (struct Library *)FindName(&SysBase->LibList, (STRPTR)name);
    if (lib) {
        printf("  %s: open count=%ld", name, (long)lib->lib_OpenCnt);
        while (lib->lib_OpenCnt > 0) {
            CloseLibrary(lib);
        }
        RemLibrary(lib);
        printf(" -> removed\n");
    } else {
        printf("  %s: not loaded\n", name);
    }
    Permit();
}

int main(void)
{
    printf("Flushing test libraries...\n");
    flush_one("quickjs.library");
    flush_one("qjs_medium.library");
    flush_one("medium.library");
    flush_one("tiny.library");
    printf("Done. Now copy fresh libraries to LIBS:\n");
    return 0;
}
