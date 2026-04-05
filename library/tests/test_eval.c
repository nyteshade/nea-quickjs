/*
 * test_eval.c — Full C callback test with assembly helpers
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
static volatile int callback_argc = -1;

static JSValue my_print(JSContext *ctx, JSValue this_val,
                         int argc, JSValue *argv) {
    callback_called = 42;
    callback_argc = argc;
    return 0x0000000600000000ULL; /* JS_UNDEFINED */
}

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    JSValue global, func;
    long r;
    const char *c;

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("FAIL\n"); return 1; }

    rt = call_NewRuntime();
    ctx = call_NewContext(rt);
    call_GetGlobalObject(&global, ctx);

    /* Create C function and set on global */
    call_NewCFunction2(&func, ctx, (void*)my_print, "myprint", 0, 0, 0);
    printf("func=%08lx_%08lx\n",
           (unsigned long)(func>>32), (unsigned long)(func & 0xFFFFFFFFUL));

    { int sr = call_SetPropertyStr(ctx, &global, "myprint", &func);
      printf("SetProp=%d\n", sr); }

    /* Check typeof */
    c = "typeof myprint";
    r = call_EvalSimple(ctx, c, strlen(c));
    printf("typeof myprint (as int): %ld\n", r);

    c = "typeof myprint == 'function' ? 1 : 0";
    r = call_EvalSimple(ctx, c, strlen(c));
    printf("is function: %ld\n", r);

    /* Try calling */
    callback_called = 0;
    c = "myprint(123)";
    r = call_EvalSimple(ctx, c, strlen(c));
    printf("myprint(123): eval=%ld callback=%d argc=%d\n",
           r, callback_called, callback_argc);

    /* Cleanup */
    call_FreeValue(ctx, &global);
    call_FreeContext(ctx);
    call_FreeRuntime(rt);
    CloseLibrary(QJSBase);
    printf("Done.\n");
    return 0;
}
