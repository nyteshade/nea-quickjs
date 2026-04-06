/*
 * test_eval.c — Replicate exact qjs flow to isolate print issue
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
extern void call_GetGlobalObject(JSValue *result, JSContext *ctx);
extern void call_NewCFunction2(JSValue *result, JSContext *ctx,
                                void *func, const char *name,
                                int length, int cproto, int magic);
extern int call_SetPropertyStr(JSContext *ctx, JSValue *this_ptr,
                                const char *prop, JSValue *val_ptr);
extern void call_FreeValue(JSContext *ctx, JSValue *val_ptr);
extern void call_FreeContext(JSContext *ctx);
extern void call_FreeRuntime(JSRuntime *rt);
extern long call_EvalSimple(JSContext *ctx, const char *input, unsigned long len);

static volatile int callback_called = 0;

static JSValue my_print(JSContext *ctx, JSValue this_val,
                         int argc, JSValue *argv) {
    callback_called = argc + 100;
    return 0x0000000600000000ULL;
}

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    JSValue global, console_obj, func, args;
    long r;
    const char *c;

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("FAIL\n"); return 1; }

    rt = call_NewRuntime();
    ctx = call_NewContext(rt);
    printf("ctx=%p\n", (void*)ctx);

    /* Replicate js_std_add_helpers flow */
    call_GetGlobalObject(&global, ctx);

    /* console.log (skip for now) */

    /* scriptArgs (skip for now) */

    /* print — THE KEY TEST */
    call_NewCFunction2(&func, ctx, (void*)my_print, "print", 1, 0, 0);
    printf("print func=%08lx_%08lx\n",
           (unsigned long)(func>>32), (unsigned long)(func & 0xFFFFFFFFUL));

    { int sr = call_SetPropertyStr(ctx, &global, "print", &func);
      printf("SetProp(print)=%d\n", sr); }

    call_FreeValue(ctx, &global);

    /* Now test — same as qjs -e "print(1+1)" */
    c = "typeof print == 'function' ? 1 : 0";
    r = call_EvalSimple(ctx, c, strlen(c));
    printf("typeof print is function: %ld\n", r);

    callback_called = 0;
    c = "print(1+1)";
    r = call_EvalSimple(ctx, c, strlen(c));
    printf("print(1+1): eval=%ld callback=%d\n", r, callback_called);
    fflush(stdout);

    call_FreeContext(ctx);
    call_FreeRuntime(rt);
    CloseLibrary(QJSBase);
    printf("Done.\n");
    return 0;
}
