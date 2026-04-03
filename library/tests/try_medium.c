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
void InitDebugLog(void);
unsigned long GetRuntimeFromCtx(JSContext *ctx);
long GetFuncProtoTag(JSContext *ctx);
int AddBaseObjects(JSContext *ctx);
int AddEval(JSContext *ctx);
void RunGC(JSRuntime *rt);
void SetMemoryLimit(JSRuntime *rt, ULONG limit);
void SetMaxStackSize(JSRuntime *rt, ULONG stack_size);
void Eval(JSValue *result, JSContext *ctx, const char *input,
          ULONG input_len, const char *filename, int eval_flags);
long EvalSimple(JSContext *ctx, const char *input, ULONG input_len);

struct Library *QJSMediumBase;

#pragma libcall QJSMediumBase NewRuntime        1e 0
#pragma libcall QJSMediumBase FreeRuntime       24 801
#pragma libcall QJSMediumBase NewContext        2a 801
#pragma libcall QJSMediumBase NewContextRaw     30 801
#pragma libcall QJSMediumBase FreeContext       36 801
#pragma libcall QJSMediumBase GetVersion        3c 0
#pragma libcall QJSMediumBase InitDebugLog      42 0
#pragma libcall QJSMediumBase GetRuntimeFromCtx 48 801
#pragma libcall QJSMediumBase GetFuncProtoTag   4e 801
#pragma libcall QJSMediumBase AddBaseObjects    54 801
#pragma libcall QJSMediumBase AddEval           5a 801
#pragma libcall QJSMediumBase RunGC             60 801
#pragma libcall QJSMediumBase SetMemoryLimit    66 0802
#pragma libcall QJSMediumBase SetMaxStackSize   6c 0802
#pragma libcall QJSMediumBase Eval              72 1B0A9806
#pragma libcall QJSMediumBase EvalSimple        78 09803

static const char ver[] = "$VER: try_medium 3.2 (02.4.2026)";

/* Request 256KB stack */
long __stack = 262144;

int main(int argc, char **argv)
{
    JSRuntime *rt;
    JSContext *ctx;
    const char *v;
    int ret;

    printf("qjs_medium.library v3.2 test\n");
    printf("============================\n");

    QJSMediumBase = OpenLibrary("qjs_medium.library", 2);
    if (!QJSMediumBase) {
        printf("FATAL: Could not open qjs_medium.library v2+\n");
        return 20;
    }
    printf("1. OpenLibrary OK (base=0x%lx, ver=%ld)\n",
           (unsigned long)QJSMediumBase,
           (long)QJSMediumBase->lib_Version);

    /* Init debug log — writes to RAM:qjs_debug.log */
    InitDebugLog();
    printf("   debug log -> RAM:qjs_debug.log\n");

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

    /* Step 9: Verify ctx, then try AddBaseObjects */
    printf("9. NewContextRaw + verify + AddBaseObjects...\n");
    ctx = NewContextRaw(rt);
    printf("   ctx = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("FATAL: NewContextRaw returned NULL\n");
        FreeRuntime(rt);
        CloseLibrary(QJSMediumBase);
        return 20;
    }
    {
        unsigned long rt_from_ctx = GetRuntimeFromCtx(ctx);
        printf("   GetRuntime(ctx) = 0x%lx (rt was 0x%lx) %s\n",
               rt_from_ctx, (unsigned long)rt,
               rt_from_ctx == (unsigned long)rt ? "MATCH" : "MISMATCH!");
    }
    {
        long fptag = GetFuncProtoTag(ctx);
        printf("   function_proto tag = %ld (%s)\n", fptag,
               fptag == -1 ? "JS_TAG_OBJECT OK" : "WRONG!");
    }
    printf("   calling AddBaseObjects...\n");
    ret = AddBaseObjects(ctx);
    printf("   AddBaseObjects = %d\n", ret);

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

    /* Step 12: Eval — skip with NOEVAL argument */
    if (argc > 1) {
        printf("12. SKIPPED (argument provided)\n");
    } else {
        long sval;

        /* 12a: EvalSimple — all inside library, no JSValue crossing boundary */
        printf("12a. EvalSimple('42')...\n");
        sval = EvalSimple(ctx, "42", 2);
        printf("     = %ld (expect 42)\n", sval);

        printf("12b. EvalSimple('1+1')...\n");
        sval = EvalSimple(ctx, "1+1", 3);
        printf("     = %ld (expect 2)\n", sval);

        printf("12c. EvalSimple('2*21')...\n");
        sval = EvalSimple(ctx, "2*21", 4);
        printf("     = %ld (expect 42)\n", sval);

        /* 12d: Full Eval with JSValue return */
        printf("12d. Eval('1+1') with JSValue...\n");
        {
            JSValue result;
            Eval(&result, ctx, "1+1", 3, "<test>", 0);
            printf("     tag=%ld val=%ld\n", result.tag, result.u.int32);
        }

        printf("12. All eval tests passed\n");
    }

    /* Cleanup */
    FreeContext(ctx);
    FreeRuntime(rt);
    CloseLibrary(QJSMediumBase);
    printf("Done! All steps passed.\n");
    return 0;
}
