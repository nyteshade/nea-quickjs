/*
 * try_iface.c — Test app for Option C (interface struct) library
 */
#include <stdio.h>
#include <string.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

#include "qjs_interface.h"

struct Library *QJSMediumBase;

/* Library functions (only 2 jump table entries) */
struct QJSInterface *GetInterface(void);
void FreeInterface(struct QJSInterface *iface);

#pragma libcall QJSMediumBase GetInterface   1e 0
#pragma libcall QJSMediumBase FreeInterface  24 801

static const char ver[] = "$VER: try_iface 3.0 (01.4.2026)";
long __stack = 262144;

int main(void)
{
    struct QJSInterface *qjs;
    JSRuntime *rt;
    JSContext *ctx;
    const char *v;

    printf("qjs_medium.library v3.0 INTERFACE test\n");
    printf("======================================\n");

    QJSMediumBase = OpenLibrary("qjs_medium.library", 3);
    if (!QJSMediumBase) {
        printf("FATAL: Could not open qjs_medium.library v3+\n");
        return 20;
    }
    printf("1. OpenLibrary OK (base=0x%lx, ver=%ld)\n",
           (unsigned long)QJSMediumBase,
           (long)QJSMediumBase->lib_Version);

    /* Step 2: Get the interface struct */
    qjs = GetInterface();
    if (!qjs) {
        printf("FATAL: GetInterface returned NULL\n");
        CloseLibrary(QJSMediumBase);
        return 20;
    }
    printf("2. GetInterface OK (iface=0x%lx, size=%lu)\n",
           (unsigned long)qjs, qjs->struct_size);

    /* Step 3: GetVersion through interface */
    v = qjs->GetVersion();
    printf("3. GetVersion = '%s'\n", v ? v : "(null)");

    /* Step 4: NewRuntime through interface */
    rt = qjs->NewRuntime();
    printf("4. NewRuntime = 0x%lx\n", (unsigned long)rt);
    if (!rt) {
        printf("FATAL: NewRuntime returned NULL\n");
        FreeInterface(qjs);
        CloseLibrary(QJSMediumBase);
        return 20;
    }

    /* Step 5-6 */
    qjs->SetMemoryLimit(rt, 8 * 1024 * 1024);
    printf("5. SetMemoryLimit OK\n");
    qjs->SetMaxStackSize(rt, 256 * 1024);
    printf("6. SetMaxStackSize OK\n");

    /* Step 7: RunGC */
    qjs->RunGC(rt);
    printf("7. RunGC OK\n");

    /* Step 8: NewContextRaw */
    printf("8. NewContextRaw...\n");
    ctx = qjs->NewContextRaw(rt);
    printf("   = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("FATAL\n");
        qjs->FreeRuntime(rt);
        FreeInterface(qjs);
        CloseLibrary(QJSMediumBase);
        return 20;
    }
    qjs->FreeContext(ctx);
    printf("   FreeContext OK\n");

    /* Step 9: THE BIG TEST — Full NewContext (calls AddBaseObjects internally) */
    printf("9. Full NewContext...\n");
    ctx = qjs->NewContext(rt);
    printf("   = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("   NewContext returned NULL!\n");
        qjs->FreeRuntime(rt);
        FreeInterface(qjs);
        CloseLibrary(QJSMediumBase);
        return 20;
    }

    /* Step 10: Eval */
    printf("10. Eval('1+1')...\n");
    {
        JSValue result;
        qjs->Eval(&result, ctx, "1+1", 3, "<test>", 0);
        printf("    tag=%ld val=%ld\n", result.tag, result.u.int32);
        qjs->FreeValue(ctx, &result);
    }

    /* Step 11: String eval */
    printf("11. Eval string...\n");
    {
        JSValue result;
        const char *s;
        qjs->Eval(&result, ctx, "'hello' + ' Amiga'", 18, "<test>", 0);
        if (qjs->IsString(&result)) {
            s = qjs->ToCString(ctx, &result);
            printf("    = '%s'\n", s ? s : "(null)");
            if (s) qjs->FreeCString(ctx, s);
        } else {
            printf("    not a string (tag=%ld)\n", result.tag);
        }
        qjs->FreeValue(ctx, &result);
    }

    /* Step 12: Object property */
    printf("12. Object property...\n");
    {
        JSValue obj, val, got;
        qjs->NewObject(&obj, ctx);
        qjs->NewInt32(&val, ctx, 42);
        qjs->SetPropertyStr(ctx, &obj, "answer", &val);
        qjs->GetPropertyStr(&got, ctx, &obj, "answer");
        if (qjs->IsNumber(&got)) {
            long n = 0;
            qjs->ToInt32(ctx, &n, &got);
            printf("    obj.answer = %ld\n", n);
        }
        qjs->FreeValue(ctx, &got);
        qjs->FreeValue(ctx, &obj);
    }

    /* Cleanup */
    qjs->FreeContext(ctx);
    qjs->FreeRuntime(rt);
    FreeInterface(qjs);
    CloseLibrary(QJSMediumBase);
    printf("Done! All steps passed.\n");
    return 0;
}
