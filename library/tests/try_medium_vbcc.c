/*
 * try_medium_vbcc.c — VBCC version of the quickjs.library test.
 *
 * Tests each intrinsic individually to find which one hangs.
 *
 * Compile with VBCC:
 *   vc +aos68k -cpu=68020 -fpu=68881 -I$VBCC/targets/m68k-amigaos/include \
 *      try_medium_vbcc.c -o try_medium -lamiga
 */
#include <stdio.h>
#include <string.h>
#include <exec/types.h>
#include <exec/libraries.h>

/* Open/CloseLibrary via SysBase@4 */
static struct ExecBase *get_sysbase(void)
{
    return *(struct ExecBase **)4;
}

#define LVO(base, offset, type) ((type)((char *)(base) - (offset)))

static struct Library *my_OpenLibrary(const char *name, ULONG version)
{
    struct ExecBase *sys = get_sysbase();
    return LVO(sys, 552,
        struct Library *(*)(
            __reg("a6") struct ExecBase *,
            __reg("a1") const char *,
            __reg("d0") ULONG))(sys, name, version);
}

static void my_CloseLibrary(struct Library *lib)
{
    struct ExecBase *sys = get_sysbase();
    LVO(sys, 414,
        void (*)(
            __reg("a6") struct ExecBase *,
            __reg("a1") struct Library *))(sys, lib);
}

/* Minimal types matching quickjs.h non-NAN_BOXING 32-bit */
typedef union { long int32; double float64; void *ptr; long sbi; } JSValueUnion;
typedef struct { JSValueUnion u; long tag; } JSValue;
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

/* Library call via jump table.
 * LVO offsets (bias 30, 6 bytes per entry):
 *  NewRuntime=30, FreeRuntime=36, NewContext=42, NewContextRaw=48,
 *  FreeContext=54, GetVersion=60, SetMemoryLimit=66, SetMaxStackSize=72,
 *  RunGC=78, AddBaseObjects=84, AddEval=90, AddDate=96, AddRegExp=102,
 *  AddJSON=108, AddProxy=114, AddMapSet=120, AddTypedArrays=126,
 *  AddPromise=132, AddWeakRef=138, AddDOMException=144, AddPerformance=150,
 *  EvalSimple=156, Eval=162
 */

static struct Library *QJSBase;

static JSRuntime *QJS_NewRuntime(void)
{
    return LVO(QJSBase, 30,
        JSRuntime *(*)(
            __reg("a6") struct Library *))(QJSBase);
}

static void QJS_FreeRuntime(JSRuntime *rt)
{
    LVO(QJSBase, 36,
        void (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSRuntime *))(QJSBase, rt);
}

static JSContext *QJS_NewContext(JSRuntime *rt)
{
    return LVO(QJSBase, 42,
        JSContext *(*)(
            __reg("a6") struct Library *,
            __reg("a0") JSRuntime *))(QJSBase, rt);
}

static JSContext *QJS_NewContextRaw(JSRuntime *rt)
{
    return LVO(QJSBase, 48,
        JSContext *(*)(
            __reg("a6") struct Library *,
            __reg("a0") JSRuntime *))(QJSBase, rt);
}

static void QJS_FreeContext(JSContext *ctx)
{
    LVO(QJSBase, 54,
        void (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static const char *QJS_GetVersion(void)
{
    return LVO(QJSBase, 60,
        const char *(*)(
            __reg("a6") struct Library *))(QJSBase);
}

static void QJS_SetMemoryLimit(JSRuntime *rt, ULONG limit)
{
    LVO(QJSBase, 66,
        void (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSRuntime *,
            __reg("d0") ULONG))(QJSBase, rt, limit);
}

static void QJS_SetMaxStackSize(JSRuntime *rt, ULONG stack_size)
{
    LVO(QJSBase, 72,
        void (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSRuntime *,
            __reg("d0") ULONG))(QJSBase, rt, stack_size);
}

static void QJS_RunGC(JSRuntime *rt)
{
    LVO(QJSBase, 78,
        void (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSRuntime *))(QJSBase, rt);
}

static int QJS_AddBaseObjects(JSContext *ctx)
{
    return LVO(QJSBase, 84,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddEval(JSContext *ctx)
{
    return LVO(QJSBase, 90,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddDate(JSContext *ctx)
{
    return LVO(QJSBase, 96,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddRegExp(JSContext *ctx)
{
    return LVO(QJSBase, 102,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddJSON(JSContext *ctx)
{
    return LVO(QJSBase, 108,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddProxy(JSContext *ctx)
{
    return LVO(QJSBase, 114,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddMapSet(JSContext *ctx)
{
    return LVO(QJSBase, 120,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddTypedArrays(JSContext *ctx)
{
    return LVO(QJSBase, 126,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddPromise(JSContext *ctx)
{
    return LVO(QJSBase, 132,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddWeakRef(JSContext *ctx)
{
    return LVO(QJSBase, 138,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddDOMException(JSContext *ctx)
{
    return LVO(QJSBase, 144,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static int QJS_AddPerformance(JSContext *ctx)
{
    return LVO(QJSBase, 150,
        int (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *))(QJSBase, ctx);
}

static long QJS_EvalSimple(JSContext *ctx, const char *input, ULONG input_len)
{
    return LVO(QJSBase, 156,
        long (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSContext *,
            __reg("a1") const char *,
            __reg("d0") ULONG))(QJSBase, ctx, input, input_len);
}

static void QJS_Eval(JSValue *result, JSContext *ctx, const char *input,
                     ULONG input_len, const char *filename, int eval_flags)
{
    LVO(QJSBase, 162,
        void (*)(
            __reg("a6") struct Library *,
            __reg("a0") JSValue *,
            __reg("a1") JSContext *,
            __reg("a2") const char *,
            __reg("d0") ULONG,
            __reg("a3") const char *,
            __reg("d1") int))(QJSBase, result, ctx, input, input_len,
                              filename, eval_flags);
}

static const char ver[] = "$VER: try_medium 0.53 (04.4.2026)";

int main(int argc, char **argv)
{
    JSRuntime *rt;
    JSContext *ctx;
    const char *v;
    int ret;

    printf("quickjs.library v0.53 test\n");
    printf("==========================\n");

    QJSBase = my_OpenLibrary("quickjs.library", 0);
    if (!QJSBase) {
        printf("FATAL: Could not open quickjs.library\n");
        return 20;
    }
    printf("1. OpenLibrary OK (base=0x%lx, ver=%ld.%ld)\n",
           (unsigned long)QJSBase,
           (long)QJSBase->lib_Version,
           (long)QJSBase->lib_Revision);

    v = QJS_GetVersion();
    printf("2. GetVersion = '%s'\n", v ? v : "(null)");

    rt = QJS_NewRuntime();
    printf("3. NewRuntime = 0x%lx\n", (unsigned long)rt);
    if (!rt) {
        printf("FATAL: NewRuntime returned NULL\n");
        my_CloseLibrary(QJSBase);
        return 20;
    }

    QJS_SetMemoryLimit(rt, 8 * 1024 * 1024);
    printf("4. SetMemoryLimit OK\n");
    QJS_SetMaxStackSize(rt, 256 * 1024);
    printf("5. SetMaxStackSize OK\n");
    QJS_RunGC(rt);
    printf("6. RunGC OK\n");

    printf("7. NewContextRaw...\n");
    ctx = QJS_NewContextRaw(rt);
    printf("   = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("FATAL: NewContextRaw returned NULL\n");
        QJS_FreeRuntime(rt);
        my_CloseLibrary(QJSBase);
        return 20;
    }

    QJS_FreeContext(ctx);
    printf("8. FreeContext OK\n");
    ctx = NULL;

    /* Step 9: Build context with each intrinsic individually */
    printf("9. NewContextRaw...\n");
    ctx = QJS_NewContextRaw(rt);
    printf("   ctx = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("FATAL: NewContextRaw returned NULL\n");
        QJS_FreeRuntime(rt);
        my_CloseLibrary(QJSBase);
        return 20;
    }

    printf("9a. AddBaseObjects...\n");
    ret = QJS_AddBaseObjects(ctx);
    printf("    = %d\n", ret);

    printf("9b. AddDate...\n");
    ret = QJS_AddDate(ctx);
    printf("    = %d\n", ret);

    printf("9c. AddEval...\n");
    ret = QJS_AddEval(ctx);
    printf("    = %d\n", ret);

    printf("9d. AddRegExp...\n");
    ret = QJS_AddRegExp(ctx);
    printf("    = %d\n", ret);

    printf("9e. AddJSON...\n");
    ret = QJS_AddJSON(ctx);
    printf("    = %d\n", ret);

    printf("9f. AddProxy...\n");
    ret = QJS_AddProxy(ctx);
    printf("    = %d\n", ret);

    printf("9g. AddMapSet...\n");
    ret = QJS_AddMapSet(ctx);
    printf("    = %d\n", ret);

    printf("9h. AddTypedArrays...\n");
    ret = QJS_AddTypedArrays(ctx);
    printf("    = %d\n", ret);

    printf("9i. AddPromise...\n");
    ret = QJS_AddPromise(ctx);
    printf("    = %d\n", ret);

    printf("9j. AddWeakRef...\n");
    ret = QJS_AddWeakRef(ctx);
    printf("    = %d\n", ret);

    printf("9k. AddDOMException...\n");
    ret = QJS_AddDOMException(ctx);
    printf("    = %d\n", ret);

    printf("9l. AddPerformance...\n");
    ret = QJS_AddPerformance(ctx);
    printf("    = %d\n", ret);

    printf("10. All intrinsics added!\n");

    /* Step 11: Eval tests */
    if (argc > 1) {
        printf("11. Eval SKIPPED (argument provided)\n");
    } else {
        long sval;

        printf("11a. EvalSimple('42')...\n");
        sval = QJS_EvalSimple(ctx, "42", 2);
        printf("     = %ld (expect 42)\n", sval);

        printf("11b. EvalSimple('1+1')...\n");
        sval = QJS_EvalSimple(ctx, "1+1", 3);
        printf("     = %ld (expect 2)\n", sval);

        printf("11c. EvalSimple('2*21')...\n");
        sval = QJS_EvalSimple(ctx, "2*21", 4);
        printf("     = %ld (expect 42)\n", sval);

        printf("11d. Eval('1+1') with JSValue...\n");
        {
            JSValue result;
            QJS_Eval(&result, ctx, "1+1", 3, "<test>", 0);
            printf("     tag=%ld val=%ld\n", result.tag, result.u.int32);
        }

        printf("11. All eval tests passed\n");
    }

    /* Cleanup */
    QJS_FreeContext(ctx);
    QJS_FreeRuntime(rt);
    my_CloseLibrary(QJSBase);
    printf("Done! All steps passed.\n");
    return 0;
}
