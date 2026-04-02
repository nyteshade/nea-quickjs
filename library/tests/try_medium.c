/*
 * try_medium.c — Incremental test for qjs_medium.library
 *
 * Tests each step individually so the last printed line
 * tells us exactly where it crashed.
 */
#include <stdio.h>
#include <string.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

/* Minimal types matching quickjs.h non-NAN_BOXING 32-bit */
typedef union { long int32; double float64; void *ptr; long sbi; } JSValueUnion;
typedef struct { JSValueUnion u; long tag; } JSValue;
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

/* Prototypes */
JSRuntime *NewRuntime(void);
void FreeRuntime(JSRuntime *rt);
JSContext *NewContext(JSRuntime *rt);
JSContext *NewContextRaw(JSRuntime *rt);
void FreeContext(JSContext *ctx);
const char *GetVersion(void);
int AddBaseObjects(JSContext *ctx);
int AddEval(JSContext *ctx);
void RunGC(JSRuntime *rt);
void SetMemoryLimit(JSRuntime *rt, ULONG limit);
void SetMaxStackSize(JSRuntime *rt, ULONG stack_size);
void Eval(JSValue *result, JSContext *ctx, const char *input,
          ULONG input_len, const char *filename, int eval_flags);

struct Library *QJSMediumBase;

#pragma libcall QJSMediumBase NewRuntime    1e 0
#pragma libcall QJSMediumBase FreeRuntime   24 801
#pragma libcall QJSMediumBase NewContext    2a 801
#pragma libcall QJSMediumBase NewContextRaw 30 801
#pragma libcall QJSMediumBase FreeContext   36 801
#pragma libcall QJSMediumBase GetVersion    3c 0
#pragma libcall QJSMediumBase AddBaseObjects 42 801
#pragma libcall QJSMediumBase AddEval       48 801
#pragma libcall QJSMediumBase RunGC         4e 801
#pragma libcall QJSMediumBase SetMemoryLimit 54 0802
#pragma libcall QJSMediumBase SetMaxStackSize 5a 0802
#pragma libcall QJSMediumBase Eval          60 1B0A9806

static const char ver[] = "$VER: try_medium 2.7 (31.3.2026)";

/* Request 256KB stack */
long __stack = 262144;

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    const char *v;
    int ret;

    printf("qjs_medium.library v2.12 test\n");
    printf("============================\n");

    QJSMediumBase = OpenLibrary("qjs_medium.library", 2);
    if (!QJSMediumBase) {
        printf("FATAL: Could not open qjs_medium.library v2+\n");
        return 20;
    }
    printf("1. OpenLibrary OK (base=0x%lx, ver=%ld)\n",
           (unsigned long)QJSMediumBase,
           (long)QJSMediumBase->lib_Version);

    /* Step 2: GetVersion */
    v = GetVersion();
    printf("2. GetVersion = '%s'\n", v ? v : "(null)");

    /* Step 3: NewRuntime */
    rt = NewRuntime();
    printf("3. NewRuntime = 0x%lx\n", (unsigned long)rt);
    if (!rt) {
        printf("FATAL: NewRuntime returned NULL\n");
        CloseLibrary(QJSMediumBase);
        return 20;
    }

    /* Step 4-6: Simple operations */
    SetMemoryLimit(rt, 8 * 1024 * 1024);
    printf("4. SetMemoryLimit OK\n");
    SetMaxStackSize(rt, 256 * 1024);
    printf("5. SetMaxStackSize OK\n");
    RunGC(rt);
    printf("6. RunGC OK\n");

    /* Step 7: NewContextRaw */
    printf("7. NewContextRaw...\n");
    ctx = NewContextRaw(rt);
    printf("   = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("FATAL: NewContextRaw returned NULL\n");
        FreeRuntime(rt);
        CloseLibrary(QJSMediumBase);
        return 20;
    }

    /* Step 8: Free it */
    FreeContext(ctx);
    printf("8. FreeContext OK\n");
    ctx = NULL;

    /* Step 9: Full NewContext (calls AddBaseObjects INTERNALLY in quickjs.o) */
    printf("9. Full NewContext (AddBase called inside engine)...\n");
    ctx = NewContext(rt);
    printf("   NewContext = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("   NewContext returned NULL (AddBase failed internally)\n");
    }
    ret = ctx ? 0 : -1;

    /* Step 10: AddEval */
    printf("10. AddEval...\n");
    ret = AddEval(ctx);
    printf("    AddEval = %d\n", ret);

    /* Step 11: Full NewContext */
    FreeContext(ctx);
    ctx = NULL;
    printf("11. Full NewContext...\n");
    ctx = NewContext(rt);
    printf("    = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("FATAL: NewContext returned NULL\n");
        FreeRuntime(rt);
        CloseLibrary(QJSMediumBase);
        return 20;
    }

    /* Step 12: Eval */
    printf("12. Eval('1+1')...\n");
    {
        JSValue result;
        Eval(&result, ctx, "1+1", 3, "<test>", 0);
        printf("    tag=%ld val=%ld\n", result.tag, result.u.int32);
    }

    /* Cleanup */
    FreeContext(ctx);
    FreeRuntime(rt);
    CloseLibrary(QJSMediumBase);
    printf("Done! All steps passed.\n");
    return 0;
}
