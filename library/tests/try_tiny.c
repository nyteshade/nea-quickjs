/*
 * try_tiny.c — Test app for tiny.library
 */
#include <stdio.h>
#include <exec/types.h>
#include <proto/exec.h>

/* Prototypes */
const char *GetMessage(void);
int GetCounter(void);
void SetCounter(int val);
int Add(int a, int b);
void *AllocTest(ULONG size);
void FreeTest(void *ptr, ULONG size);

/* Pragmas */
struct Library *TinyBase;

#pragma libcall TinyBase GetMessage 1e 0
#pragma libcall TinyBase GetCounter 24 0
#pragma libcall TinyBase SetCounter 2a 001
#pragma libcall TinyBase Add 30 1002
#pragma libcall TinyBase AllocTest 36 001
#pragma libcall TinyBase FreeTest 3c 0802

static const char ver[] = "$VER: try_tiny 1.0 (27.3.2026)";

int main(void)
{
    printf("tiny.library test\n");

    TinyBase = OpenLibrary("tiny.library", 0);
    if (!TinyBase) {
        printf("FATAL: Could not open tiny.library\n");
        return 20;
    }
    printf("tiny.library opened at 0x%lx\n", (unsigned long)TinyBase);

    /* Test 1: string from const data */
    {
        const char *msg = GetMessage();
        printf("GetMessage() = '%s'\n", msg ? msg : "(null)");
    }

    /* Test 2: global variable read */
    {
        int c = GetCounter();
        printf("GetCounter() = %d (expect 42)\n", c);
    }

    /* Test 3: global variable write */
    SetCounter(100);
    {
        int c = GetCounter();
        printf("GetCounter() = %d (expect 100)\n", c);
    }

    /* Test 4: arithmetic (pure register, no data) */
    {
        int r = Add(17, 25);
        printf("Add(17,25) = %d (expect 42)\n", r);
    }

    /* Test 5: memory allocation (AllocMem) */
    {
        void *p = AllocTest(256);
        printf("AllocTest(256) = 0x%lx\n", (unsigned long)p);
        if (p) FreeTest(p, 256);
    }

    CloseLibrary(TinyBase);
    printf("Done.\n");
    return 0;
}
