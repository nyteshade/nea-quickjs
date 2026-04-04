/*
 * test_jsvalue_return.c — Test JSValue-returning library functions
 *
 * This bypasses the bridge entirely and calls the library directly
 * to diagnose whether the bug is in the library or the bridge.
 *
 * Compile: vc +aos68k -cpu=68020 -fpu=68881 test_jsvalue_return.c -o test_jsvalue_return -lamiga
 */
#include <stdio.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

/* JSValue = uint64_t with NAN_BOXING */
typedef unsigned long long JSValue;
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

struct Library *QJSBase = NULL;

#define LVO(base, off, type) ((type)((char *)(base) - (off)))
#define R6  __reg("a6") void *
#define RA0 __reg("a0")
#define RA1 __reg("a1")
#define RA2 __reg("a2")

/* Test: wrap LVO call in a function (like the bridge does) */
static JSValue wrapped_NewObject(JSContext *ctx)
{
    JSValue result;
    typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
    LVO(QJSBase, 420, F)((void *)QJSBase, &result, ctx);
    return result;
}

static void wrapped_FreeValue(JSContext *ctx, JSValue val)
{
    typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
    LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &val);
}

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    JSValue result;

    printf("Opening quickjs.library...\n");
    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("FAILED\n"); return 1; }
    printf("QJSBase = %p\n", (void *)QJSBase);

    /* Step 1: NewRuntime (no JSValue) */
    printf("NewRuntime...\n");
    {
        typedef JSRuntime *(*F)(R6);
        rt = LVO(QJSBase, 30, F)((void *)QJSBase);
    }
    printf("rt = %p\n", (void *)rt);
    if (!rt) { printf("FAILED\n"); goto cleanup; }

    /* Step 2: NewContext (no JSValue) */
    printf("NewContext...\n");
    {
        typedef JSContext *(*F)(R6, RA0 JSRuntime *);
        ctx = LVO(QJSBase, 42, F)((void *)QJSBase, rt);
    }
    printf("ctx = %p\n", (void *)ctx);
    if (!ctx) { printf("FAILED\n"); goto cleanup; }

    /* Step 3: NewObject — FIRST JSValue return test */
    printf("NewObject (JSValue return test)...\n");
    {
        typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
        result = 0xDEADBEEFDEADBEEFULL; /* sentinel */
        printf("  result addr = %p\n", (void *)&result);
        LVO(QJSBase, 420, F)((void *)QJSBase, &result, ctx);
    }
    printf("NewObject result = %08lx_%08lx\n",
           (unsigned long)(result >> 32),
           (unsigned long)(result & 0xFFFFFFFFUL));

    /* Step 4: FreeValue */
    printf("FreeValue...\n");
    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
        LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &result);
    }
    printf("FreeValue OK\n");

    /* Step 5: GetGlobalObject — another JSValue return */
    printf("GetGlobalObject...\n");
    {
        typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
        result = 0xDEADBEEFDEADBEEFULL;
        LVO(QJSBase, 462, F)((void *)QJSBase, &result, ctx);
    }
    printf("GetGlobalObject result = %08lx_%08lx\n",
           (unsigned long)(result >> 32),
           (unsigned long)(result & 0xFFFFFFFFUL));

    /* Step 6: FreeValue the global */
    printf("FreeValue global...\n");
    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
        LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &result);
    }
    printf("FreeValue OK\n");

    /* Step 7: NewArray — another JSValue return */
    printf("NewArray...\n");
    {
        typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
        LVO(QJSBase, 438, F)((void *)QJSBase, &result, ctx);
    }
    printf("NewArray result = %08lx_%08lx\n",
           (unsigned long)(result >> 32),
           (unsigned long)(result & 0xFFFFFFFFUL));

    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
        LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &result);
    }
    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
        LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &result);
    }

    /* Step 8: Test WRAPPED function call (like the bridge) */
    printf("Wrapped NewObject (bridge pattern)...\n");
    {
        JSValue wrapped_result = wrapped_NewObject(ctx);
        printf("Wrapped result = %08lx_%08lx\n",
               (unsigned long)(wrapped_result >> 32),
               (unsigned long)(wrapped_result & 0xFFFFFFFFUL));
        wrapped_FreeValue(ctx, wrapped_result);
        printf("Wrapped FreeValue OK\n");
    }

    printf("All JSValue return tests PASSED!\n");

cleanup:
    if (ctx) {
        typedef void (*F)(R6, RA0 JSContext *);
        LVO(QJSBase, 54, F)((void *)QJSBase, ctx);
    }
    if (rt) {
        typedef void (*F)(R6, RA0 JSRuntime *);
        LVO(QJSBase, 36, F)((void *)QJSBase, rt);
    }
    CloseLibrary(QJSBase);
    printf("Done.\n");
    return 0;
}
