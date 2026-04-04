/*
 * test_spfl2.c — Test SetPropertyFunctionList with real struct size
 * Uses minimal types to avoid pulling in quickjs.h static inlines.
 */
#include <stdio.h>
#include <string.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

typedef unsigned long long JSValue;
typedef JSValue JSValueConst;
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

/* Must match quickjs.h JSCFunctionType */
typedef union {
    void *generic;
    void *p1; void *p2; void *p3; void *p4;
    void *p5; void *p6; void *p7; void *p8;
    void *p9; void *p10; void *p11;
} JSCFunctionType;

/* Must match quickjs.h JSCFunctionListEntry (non-SASC branch) */
typedef struct JSCFunctionListEntry {
    const char *name;
    unsigned char prop_flags;
    unsigned char def_type;
    short magic;
    union {
        struct {
            unsigned char length;
            unsigned char cproto;
            JSCFunctionType cfunc;
        } func;
        struct {
            JSCFunctionType get;
            JSCFunctionType set;
        } getset;
        struct {
            const char *name;
            int base;
        } alias;
        struct {
            const struct JSCFunctionListEntry *tab;
            int len;
        } prop_list;
        const char *str;
        int i32;
        long long i64;
        unsigned long long u64;
        double f64;
    } u;
} JSCFunctionListEntry;

struct Library *QJSBase = NULL;

#define QLVO(base, off, type) ((type)((char *)(base) - (off)))
#define R6  __reg("a6") void *
#define RA0 __reg("a0")
#define RA1 __reg("a1")
#define RA2 __reg("a2")
#define RD0 __reg("d0")

static JSValue my_gc(JSContext *ctx, JSValueConst this_val,
                      int argc, JSValueConst *argv) {
    return 0x0000000600000000ULL; /* JS_UNDEFINED NAN-boxed */
}

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    JSValue global;
    JSCFunctionListEntry funcs[1];

    printf("sizeof(JSCFunctionListEntry) = %d\n", (int)sizeof(JSCFunctionListEntry));
    printf("sizeof(JSCFunctionType) = %d\n", (int)sizeof(JSCFunctionType));
    printf("offsetof func.cfunc ~ %d\n",
           (int)((char*)&funcs[0].u.func.cfunc - (char*)&funcs[0].u));

    memset(funcs, 0, sizeof(funcs));
    funcs[0].name = "gc";
    funcs[0].prop_flags = 0x01 | 0x04;
    funcs[0].def_type = 0;
    funcs[0].magic = 0;
    funcs[0].u.func.length = 0;
    funcs[0].u.func.cproto = 0;
    funcs[0].u.func.cfunc.generic = (void*)my_gc;

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("Cannot open library\n"); return 1; }

    { typedef JSRuntime *(*F)(R6); rt = QLVO(QJSBase,30,F)((void*)QJSBase); }
    { typedef JSContext *(*F)(R6, RA0 JSRuntime *); ctx = QLVO(QJSBase,42,F)((void*)QJSBase,rt); }
    { typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *); QLVO(QJSBase,462,F)((void*)QJSBase,&global,ctx); }

    printf("rt=%p ctx=%p\n", (void*)rt, (void*)ctx);
    printf("Calling SPFL...\n"); fflush(stdout);
    {
        typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 void *, RD0 int);
        int r = QLVO(QJSBase,900,F)((void*)QJSBase, ctx, &global, (void*)funcs, 1);
        printf("SPFL returned %d\n", r);
    }

    { typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *); QLVO(QJSBase,312,F)((void*)QJSBase,ctx,&global); }
    { typedef void (*F)(R6, RA0 JSContext *); QLVO(QJSBase,54,F)((void*)QJSBase,ctx); }
    { typedef void (*F)(R6, RA0 JSRuntime *); QLVO(QJSBase,36,F)((void*)QJSBase,rt); }
    CloseLibrary(QJSBase);
    printf("DONE\n");
    return 0;
}
