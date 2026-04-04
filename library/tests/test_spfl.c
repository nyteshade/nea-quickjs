/*
 * test_spfl.c — Test SetPropertyFunctionList via direct LVO
 * Bypasses the bridge entirely to check if the library hangs.
 */
#include <stdio.h>
#include <string.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

typedef unsigned long long JSValue;
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

/* Minimal JSCFunctionListEntry — must match quickjs.h layout */
typedef JSValue (*JSCFunction)(JSContext *ctx, JSValue this_val,
                                int argc, JSValue *argv);

typedef struct {
    const char *name;
    unsigned char prop_flags;
    unsigned char def_type;
    short magic;
    union {
        struct {
            unsigned char length;
            unsigned char cproto;
            union {
                JSCFunction *generic;
            } cfunc;
        } func;
        char pad[16]; /* ensure union is big enough */
    } u;
} MyFuncListEntry;

struct Library *QJSBase = NULL;

#define LVO(base, off, type) ((type)((char *)(base) - (off)))
#define R6  __reg("a6") void *
#define RA0 __reg("a0")
#define RA1 __reg("a1")
#define RA2 __reg("a2")
#define RD0 __reg("d0")

/* A simple test function */
static JSValue my_test_func(JSContext *ctx, JSValue this_val,
                             int argc, JSValue *argv) {
    return 0x0000000600000000ULL; /* JS_UNDEFINED with NAN_BOXING */
}

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    JSValue global;

    /* Func list with 1 entry: JS_DEF_CFUNC=0, JS_CFUNC_generic=0 */
    MyFuncListEntry funcs[1];
    memset(&funcs[0], 0, sizeof(funcs[0]));
    funcs[0].name = "test";
    funcs[0].prop_flags = 0x01 | 0x04; /* writable | configurable */
    funcs[0].def_type = 0; /* JS_DEF_CFUNC */
    funcs[0].magic = 0;
    funcs[0].u.func.length = 0;
    funcs[0].u.func.cproto = 0; /* JS_CFUNC_generic */
    funcs[0].u.func.cfunc.generic = my_test_func;

    printf("sizeof(MyFuncListEntry) = %d\n", (int)sizeof(MyFuncListEntry));

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("Cannot open library\n"); return 1; }
    printf("QJSBase=%p\n", (void*)QJSBase);

    /* NewRuntime */
    {
        typedef JSRuntime *(*F)(R6);
        rt = LVO(QJSBase, 30, F)((void*)QJSBase);
    }
    printf("rt=%p\n", (void*)rt);

    /* NewContext */
    {
        typedef JSContext *(*F)(R6, RA0 JSRuntime *);
        ctx = LVO(QJSBase, 42, F)((void*)QJSBase, rt);
    }
    printf("ctx=%p\n", (void*)ctx);

    /* GetGlobalObject */
    {
        typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
        LVO(QJSBase, 462, F)((void*)QJSBase, &global, ctx);
    }
    printf("global=%08lx_%08lx\n",
           (unsigned long)(global>>32), (unsigned long)global);

    /* SetPropertyFunctionList — THE TEST */
    printf("Calling SetPropertyFunctionList (1 entry)...\n");
    fflush(stdout);
    {
        typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 void *, RD0 int);
        int r = LVO(QJSBase, 900, F)((void*)QJSBase, ctx, &global, (void*)funcs, 1);
        printf("SetPropertyFunctionList returned %d\n", r);
    }

    /* FreeValue global */
    {
        typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
        LVO(QJSBase, 312, F)((void*)QJSBase, ctx, &global);
    }

    printf("SUCCESS\n");

    /* Cleanup */
    {
        typedef void (*F)(R6, RA0 JSContext *);
        LVO(QJSBase, 54, F)((void*)QJSBase, ctx);
    }
    {
        typedef void (*F)(R6, RA0 JSRuntime *);
        LVO(QJSBase, 36, F)((void*)QJSBase, rt);
    }
    CloseLibrary(QJSBase);
    return 0;
}
