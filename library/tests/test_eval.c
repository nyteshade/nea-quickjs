/*
 * test_eval.c — Minimal cross-eval persistence test
 * ALL LVO calls via assembly helpers.
 */
#include <stdio.h>
#include <string.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

typedef unsigned long long JSValue;
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

struct Library *QJSBase = NULL;

extern JSRuntime *call_NewRuntime(void);
extern JSContext *call_NewContext(JSRuntime *rt);
extern void call_FreeContext(JSContext *ctx);
extern void call_FreeRuntime(JSRuntime *rt);
extern long call_EvalSimple(JSContext *ctx, const char *input, unsigned long len);

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    long r;

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("FAIL: no library\n"); return 1; }

    rt = call_NewRuntime();
    ctx = call_NewContext(rt);
    printf("ctx=%p\n", (void*)ctx);

    /* Test 1: single-eval expression */
    r = call_EvalSimple(ctx, "1+1", 3);
    printf("Test 1 (1+1): %ld\n", r);

    /* Test 2: single-eval function */
    r = call_EvalSimple(ctx, "function f(){return 42;} f()", 30);
    printf("Test 2 (inline func): %ld\n", r);

    /* Test 3: cross-eval variable */
    call_EvalSimple(ctx, "var crossvar = 99", 17);
    r = call_EvalSimple(ctx, "crossvar", 8);
    printf("Test 3 (cross-eval var): %ld\n", r);

    /* Test 4: cross-eval function */
    call_EvalSimple(ctx, "function crossfunc(){return 88;}", 32);
    r = call_EvalSimple(ctx, "crossfunc()", 11);
    printf("Test 4 (cross-eval func): %ld\n", r);

    /* Test 5: cross-eval globalThis */
    call_EvalSimple(ctx, "globalThis.gvar = 77", 20);
    r = call_EvalSimple(ctx, "gvar", 4);
    printf("Test 5 (globalThis): %ld\n", r);

    call_FreeContext(ctx);
    call_FreeRuntime(rt);
    CloseLibrary(QJSBase);
    printf("Done.\n");
    return 0;
}
