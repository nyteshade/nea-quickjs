/*
 * flushlibs.c — Force-close and flush libraries related to quickjs.
 *
 * Removes each resident copy from exec's LibList. Intended for the
 * development workflow: after rebuilding quickjs.library (or its
 * networking deps), run `flushlibs` to evict the stale in-memory
 * copies so the fresh disk versions get picked up on next OpenLibrary.
 *
 * BLUNT: forces lib_OpenCnt to 0 and RemLibrary()s regardless of
 * other holders. Do NOT run this on a system where other apps may
 * be holding AmiSSL (e.g., a web browser or mail client with an
 * active HTTPS connection). Safe in a dedicated dev session.
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

static const char ver[] = "$VER: flushlibs 1.2 (15.4.2026)";

static void flush_one(const char *name)
{
    struct Library *lib;

    Forbid();
    lib = (struct Library *)FindName(&SysBase->LibList, (STRPTR)name);
    if (lib) {
        printf("  %-28s open=%ld", name, (long)lib->lib_OpenCnt);
        while (lib->lib_OpenCnt > 0) {
            CloseLibrary(lib);
        }
        RemLibrary(lib);
        printf(" -> removed\n");
    } else {
        printf("  %-28s not loaded\n", name);
    }
    Permit();
}

int main(void)
{
    printf("Flushing libraries related to quickjs...\n");

    flush_one("quickjs.library");

    /* AmiSSL master — version broker for all amissl_v*.library */
    flush_one("amisslmaster.library");

    /* AmiSSL sub-libraries — enumerate known variants. OpenAmiSSLTagList
     * opens exactly one of these based on AMISSL_CURRENT_VERSION at
     * build time. Flushing all known names is safe: missing ones just
     * print "not loaded". As new AmiSSL sub-libraries ship, add their
     * names here.
     *   v111 = OpenSSL 1.1.1
     *   v30  = OpenSSL 3.0
     *   v32  = OpenSSL 3.2 */
    flush_one("amissl_v111.library");
    flush_one("amissl_v30.library");
    flush_one("amissl_v32.library");

    /* NOTE: do NOT flush bsdsocket.library — it's provided by the TCP
     * stack (Roadshow / AmiTCP / Miami) and flushing it breaks every
     * networking app on the system. */

    printf("Done. Now copy fresh libraries to LIBS:\n");
    return 0;
}
