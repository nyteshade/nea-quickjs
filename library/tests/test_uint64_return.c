/*
 * test_uint64_return.c — Isolate the uint64_t return issue
 */
#include <stdio.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

typedef unsigned long long uint64;

struct Library *QJSBase = NULL;

#define LVO(base, off, type) ((type)((char *)(base) - (off)))
#define R6  __reg("a6") void *
#define RA0 __reg("a0")
#define RA1 __reg("a1")

typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

/* Test 1: plain uint64 return (no library involved) */
static uint64 return_uint64(void)
{
    uint64 v = 0xDEADBEEF12345678ULL;
    return v;
}

/* Test 2: void function with out-pointer (no library) */
static void fill_uint64(uint64 *out)
{
    *out = 0xCAFEBABE87654321ULL;
}

/* Test 3: LVO call in a function, result via out-pointer (no uint64 return) */
static void wrapped_NewObject_out(JSContext *ctx, uint64 *out)
{
    typedef void (*F)(R6, RA0 uint64 *, RA1 JSContext *);
    LVO(QJSBase, 420, F)((void *)QJSBase, out, ctx);
}

/* Test 4: LVO call in a function, returning uint64 (the failing pattern) */
static uint64 wrapped_NewObject_ret(JSContext *ctx)
{
    uint64 result;
    typedef void (*F)(R6, RA0 uint64 *, RA1 JSContext *);
    LVO(QJSBase, 420, F)((void *)QJSBase, &result, ctx);
    return result;
}

/* Test 5: Same but with static result (not on stack) */
static uint64 _static_result;
static uint64 wrapped_NewObject_static(JSContext *ctx)
{
    typedef void (*F)(R6, RA0 uint64 *, RA1 JSContext *);
    LVO(QJSBase, 420, F)((void *)QJSBase, &_static_result, ctx);
    return _static_result;
}

/* Test 6: SA6/RA6 with uint64 return */
extern void bridge_save_a6(void);
extern void bridge_restore_a6(void);
#define SA6 bridge_save_a6()
#define RA6 bridge_restore_a6()

static uint64 wrapped_NewObject_sa6(JSContext *ctx)
{
    uint64 result;
    typedef void (*F)(R6, RA0 uint64 *, RA1 JSContext *);
    SA6;
    LVO(QJSBase, 420, F)((void *)QJSBase, &result, ctx);
    RA6;
    return result;
}

/* Test 7: SA6/RA6 with STATIC result */
static uint64 _sa6_static_result;
static uint64 wrapped_NewObject_sa6_static(JSContext *ctx)
{
    typedef void (*F)(R6, RA0 uint64 *, RA1 JSContext *);
    SA6;
    LVO(QJSBase, 420, F)((void *)QJSBase, &_sa6_static_result, ctx);
    RA6;
    return _sa6_static_result;
}

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    uint64 val;

    /* Test 1: plain uint64 return */
    printf("Test 1: plain uint64 return...\n");
    val = return_uint64();
    printf("  result = %08lx_%08lx\n",
           (unsigned long)(val >> 32), (unsigned long)(val & 0xFFFFFFFFUL));

    /* Test 2: out-pointer */
    printf("Test 2: out-pointer...\n");
    fill_uint64(&val);
    printf("  result = %08lx_%08lx\n",
           (unsigned long)(val >> 32), (unsigned long)(val & 0xFFFFFFFFUL));

    /* Open library for remaining tests */
    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("Cannot open library\n"); return 1; }

    {
        typedef JSRuntime *(*F)(R6);
        rt = LVO(QJSBase, 30, F)((void *)QJSBase);
    }
    {
        typedef JSContext *(*F)(R6, RA0 JSRuntime *);
        ctx = LVO(QJSBase, 42, F)((void *)QJSBase, rt);
    }
    printf("rt=%p ctx=%p\n", (void *)rt, (void *)ctx);

    /* Test 3: LVO via wrapper, out-pointer (no uint64 return) */
    printf("Test 3: wrapped LVO, out-pointer...\n");
    wrapped_NewObject_out(ctx, &val);
    printf("  result = %08lx_%08lx\n",
           (unsigned long)(val >> 32), (unsigned long)(val & 0xFFFFFFFFUL));
    /* free it */
    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 uint64 *);
        LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &val);
    }
    printf("  freed OK\n");

    /* Test 5: static result variable */
    printf("Test 5: wrapped LVO, static result...\n");
    val = wrapped_NewObject_static(ctx);
    printf("  result = %08lx_%08lx\n",
           (unsigned long)(val >> 32), (unsigned long)(val & 0xFFFFFFFFUL));
    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 uint64 *);
        LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &val);
    }
    printf("  freed OK\n");

    /* Test 6: SA6/RA6 + stack-local uint64 return */
    printf("Test 6: SA6/RA6 + stack-local return...\n");
    val = wrapped_NewObject_sa6(ctx);
    printf("  result = %08lx_%08lx\n",
           (unsigned long)(val >> 32), (unsigned long)(val & 0xFFFFFFFFUL));
    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 uint64 *);
        LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &val);
    }
    printf("  freed OK\n");

    /* Test 7: SA6/RA6 + static result */
    printf("Test 7: SA6/RA6 + static result...\n");
    val = wrapped_NewObject_sa6_static(ctx);
    printf("  result = %08lx_%08lx\n",
           (unsigned long)(val >> 32), (unsigned long)(val & 0xFFFFFFFFUL));
    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 uint64 *);
        LVO(QJSBase, 312, F)((void *)QJSBase, ctx, &val);
    }
    printf("  freed OK\n");

    printf("ALL TESTS PASSED\n");

    {
        typedef void (*F)(R6, RA0 JSContext *);
        LVO(QJSBase, 54, F)((void *)QJSBase, ctx);
    }
    {
        typedef void (*F)(R6, RA0 JSRuntime *);
        LVO(QJSBase, 36, F)((void *)QJSBase, rt);
    }
    CloseLibrary(QJSBase);
    return 0;
}
