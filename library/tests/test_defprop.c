/*
 * test_defprop.c — Test property operations via direct LVO
 * Tests DefinePropertyValueStr, SetPropertyStr, NewCFunction2
 * to isolate whether SPFL-specific or general property issue.
 */
#include <stdio.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

typedef unsigned long long JSValue;
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

struct Library *QJSBase = NULL;

#define LVO(base, off, type) ((type)((char *)(base) - (off)))
#define R6  __reg("a6") void *
#define RA0 __reg("a0")
#define RA1 __reg("a1")
#define RA2 __reg("a2")
#define RA3 __reg("a3")
#define RD0 __reg("d0")
#define RD1 __reg("d1")
#define RD2 __reg("d2")

/* JS_UNDEFINED with NAN_BOXING: tag=6 in upper 32 bits */
#define MY_JS_UNDEFINED 0x0000000600000000ULL

static JSValue my_func(JSContext *ctx, JSValue this_val,
                        int argc, JSValue *argv) {
    printf("  my_func called!\n");
    return MY_JS_UNDEFINED;
}

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    JSValue global, val, func;

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("Cannot open library\n"); return 1; }

    /* NewRuntime + NewContext */
    { typedef JSRuntime *(*F)(R6); rt = LVO(QJSBase,30,F)((void*)QJSBase); }
    { typedef JSContext *(*F)(R6, RA0 JSRuntime *); ctx = LVO(QJSBase,42,F)((void*)QJSBase,rt); }
    { typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *);
      LVO(QJSBase,462,F)((void*)QJSBase,&global,ctx); }
    printf("ctx=%p\n", (void*)ctx);

    /* Test 1: NewAtom for "test" */
    printf("Test 1: NewAtom...\n"); fflush(stdout);
    {
        typedef unsigned long (*F)(R6, RA0 JSContext *, RA1 const char *);
        unsigned long atom = LVO(QJSBase,714,F)((void*)QJSBase, ctx, "test");
        printf("  atom=%lu\n", atom);
        /* FreeAtom */
        { typedef void (*F2)(R6, RA0 JSContext *, RD0 unsigned long);
          LVO(QJSBase,732,F2)((void*)QJSBase, ctx, atom); }
    }
    printf("  OK\n");

    /* Test 2: SetPropertyStr (int value) */
    printf("Test 2: SetPropertyStr...\n"); fflush(stdout);
    {
        /* NewInt32: tag=0 in upper, value in lower */
        JSValue intval = 42; /* simplified — real NAN box is different */
        /* Actually, let's use NewObject since we know it works */
        typedef void (*FNO)(R6, RA0 JSValue *, RA1 JSContext *);
        LVO(QJSBase,420,FNO)((void*)QJSBase, &val, ctx);
        printf("  created object val\n");

        /* SetPropertyStr: LVO -588 */
        typedef int (*F)(R6, RA0 JSContext *, RA1 JSValue *, RA2 const char *, RA3 JSValue *);
        int r = LVO(QJSBase,588,F)((void*)QJSBase, ctx, &global, "myobj", &val);
        printf("  SetPropertyStr returned %d\n", r);
    }

    /* Test 3: NewCFunction2 */
    printf("Test 3: NewCFunction2...\n"); fflush(stdout);
    {
        /* LVO -888: NewCFunction2(result,ctx,func,name,length,cproto,magic)(a0/a1/a2/a3/d0/d1/d2) */
        typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 void *,
                          RA3 const char *, RD0 int, RD1 int, RD2 int);
        LVO(QJSBase,888,F)((void*)QJSBase, &func, ctx, (void*)my_func, "myfunc", 0, 0, 0);
        printf("  func=%08lx_%08lx\n",
               (unsigned long)(func>>32), (unsigned long)func);

        /* SetPropertyStr to assign func to global */
        typedef int (*FS)(R6, RA0 JSContext *, RA1 JSValue *, RA2 const char *, RA3 JSValue *);
        int r = LVO(QJSBase,588,FS)((void*)QJSBase, ctx, &global, "myfunc", &func);
        printf("  assigned, r=%d\n", r);
    }

    /* Test 4: EvalSimple to call the function */
    printf("Test 4: EvalSimple myfunc()...\n"); fflush(stdout);
    {
        const char *code = "myfunc()";
        typedef long (*F)(R6, RA0 JSContext *, RA1 const char *, RD0 unsigned long);
        long r = LVO(QJSBase,156,F)((void*)QJSBase, ctx, code, 8);
        printf("  eval returned %ld\n", r);
    }

    /* Test 5: EvalSimple typeof */
    printf("Test 5: EvalSimple typeof myfunc...\n"); fflush(stdout);
    {
        const char *code = "typeof myfunc";
        typedef long (*F)(R6, RA0 JSContext *, RA1 const char *, RD0 unsigned long);
        long r = LVO(QJSBase,156,F)((void*)QJSBase, ctx, code, 13);
        printf("  eval returned %ld\n", r);
    }

    /* Test 6: Full JS_Eval (not EvalSimple) to call myfunc */
    printf("Test 6: JS_Eval myfunc()...\n"); fflush(stdout);
    {
        JSValue result;
        const char *code = "myfunc()";
        /* QJS_Eval(result,ctx,input,input_len,filename,eval_flags)(a0/a1/a2/d0/a3/d1) */
        typedef void (*F)(R6, RA0 JSValue *, RA1 JSContext *, RA2 const char *,
                          RD0 unsigned long, RA3 const char *, RD1 int);
        LVO(QJSBase,162,F)((void*)QJSBase, &result, ctx, code, 8, "<test>", 0);
        printf("  result = %08lx_%08lx\n",
               (unsigned long)(result >> 32),
               (unsigned long)(result & 0xFFFFFFFFUL));
        /* Check if exception */
        {
            typedef int (*F2)(R6, RA0 JSContext *);
            int exc = LVO(QJSBase,486,F2)((void*)QJSBase, ctx);
            printf("  HasException = %d\n", exc);
        }
        /* Free result */
        {
            typedef void (*F3)(R6, RA0 JSContext *, RA1 JSValue *);
            LVO(QJSBase,312,F3)((void*)QJSBase, ctx, &result);
        }
    }

    /* Cleanup */
    { typedef void (*F)(R6, RA0 JSContext *, RA1 JSValue *);
      LVO(QJSBase,312,F)((void*)QJSBase,ctx,&global); }
    { typedef void (*F)(R6, RA0 JSContext *);
      LVO(QJSBase,54,F)((void*)QJSBase,ctx); }
    { typedef void (*F)(R6, RA0 JSRuntime *);
      LVO(QJSBase,36,F)((void*)QJSBase,rt); }
    CloseLibrary(QJSBase);
    printf("ALL DONE\n");
    return 0;
}
