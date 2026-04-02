/*
 * tiny_lib.c — Minimal test library to verify vamos library loading
 */
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>
#include <string.h>

static const char ver[] = "$VER: tiny.library 1.0 (27.3.2026)";

/* A global variable — tests data segment access */
static int counter = 42;

/* A static string — tests const data access */
static const char hello[] = "Hello from tiny.library!";

/* Library init/cleanup stubs */
int __saveds __asm __UserLibInit(register __a6 struct Library *lb)
{
    return 0;
}
void __saveds __asm __UserLibCleanup(register __a6 struct Library *lb)
{
}

/* Library functions */
__asm const char *LIBGetMessage(void)
{
    return hello;
}

__asm int LIBGetCounter(void)
{
    return counter;
}

__asm void LIBSetCounter(register __d0 int val)
{
    counter = val;
}

__asm int LIBAdd(register __d0 int a, register __d1 int b)
{
    return a + b;
}

__asm void *LIBAllocTest(register __d0 ULONG size)
{
    return AllocMem(size, 0);
}

__asm void LIBFreeTest(register __a0 void *ptr, register __d0 ULONG size)
{
    if (ptr) FreeMem(ptr, size);
}
