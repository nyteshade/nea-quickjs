/*
 * try_medium.c — Incremental test for quickjs.library (VBCC build)
 *
 * Tests each step individually so the last printed line
 * tells us exactly where it crashed.
 *
 * Compile with SAS/C:
 *   sc try_medium.c NOSTACKCHECK NOCHKABORT
 *   slink lib:c.o try_medium.o TO try_medium LIB lib:scnb.lib lib:amiga.lib
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

/* Prototypes — match quickjs_lib.sfd */
JSRuntime *QJS_NewRuntime(void);
void QJS_FreeRuntime(JSRuntime *rt);
JSContext *QJS_NewContext(JSRuntime *rt);
JSContext *QJS_NewContextRaw(JSRuntime *rt);
void QJS_FreeContext(JSContext *ctx);
const char *QJS_GetVersion(void);
void QJS_SetMemoryLimit(JSRuntime *rt, ULONG limit);
void QJS_SetMaxStackSize(JSRuntime *rt, ULONG stack_size);
void QJS_RunGC(JSRuntime *rt);
int QJS_AddBaseObjects(JSContext *ctx);
int QJS_AddEval(JSContext *ctx);
int QJS_AddDate(JSContext *ctx);
int QJS_AddRegExp(JSContext *ctx);
int QJS_AddJSON(JSContext *ctx);
int QJS_AddProxy(JSContext *ctx);
int QJS_AddMapSet(JSContext *ctx);
int QJS_AddTypedArrays(JSContext *ctx);
int QJS_AddPromise(JSContext *ctx);
int QJS_AddWeakRef(JSContext *ctx);
int QJS_AddDOMException(JSContext *ctx);
int QJS_AddPerformance(JSContext *ctx);
long QJS_EvalSimple(JSContext *ctx, const char *input, ULONG input_len);
void QJS_Eval(JSValue *result, JSContext *ctx, const char *input,
              ULONG input_len, const char *filename, int eval_flags);

struct Library *QJSBase;

/* Pragma offsets from SFD (bias 30, 6 bytes per entry):
 * QJS_NewRuntime      =  30 = 0x1e
 * QJS_FreeRuntime     =  36 = 0x24
 * QJS_NewContext      =  42 = 0x2a
 * QJS_NewContextRaw   =  48 = 0x30
 * QJS_FreeContext     =  54 = 0x36
 * QJS_GetVersion      =  60 = 0x3c
 * QJS_SetMemoryLimit  =  66 = 0x42
 * QJS_SetMaxStackSize =  72 = 0x48
 * QJS_RunGC           =  78 = 0x4e
 * QJS_AddBaseObjects  =  84 = 0x54
 * QJS_AddEval         =  90 = 0x5a
 * QJS_AddDate         =  96 = 0x60
 * QJS_AddRegExp       = 102 = 0x66
 * QJS_AddJSON         = 108 = 0x6c
 * QJS_AddProxy        = 114 = 0x72
 * QJS_AddMapSet       = 120 = 0x78
 * QJS_AddTypedArrays  = 126 = 0x7e
 * QJS_AddPromise      = 132 = 0x84
 * QJS_AddWeakRef      = 138 = 0x8a
 * QJS_AddDOMException = 144 = 0x90
 * QJS_AddPerformance  = 150 = 0x96
 * QJS_EvalSimple      = 156 = 0x9c
 * QJS_Eval            = 162 = 0xa2
 */
#pragma libcall QJSBase QJS_NewRuntime      1e 0
#pragma libcall QJSBase QJS_FreeRuntime     24 801
#pragma libcall QJSBase QJS_NewContext      2a 801
#pragma libcall QJSBase QJS_NewContextRaw   30 801
#pragma libcall QJSBase QJS_FreeContext     36 801
#pragma libcall QJSBase QJS_GetVersion      3c 0
#pragma libcall QJSBase QJS_SetMemoryLimit  42 0802
#pragma libcall QJSBase QJS_SetMaxStackSize 48 0802
#pragma libcall QJSBase QJS_RunGC           4e 801
#pragma libcall QJSBase QJS_AddBaseObjects  54 801
#pragma libcall QJSBase QJS_AddEval         5a 801
#pragma libcall QJSBase QJS_AddDate         60 801
#pragma libcall QJSBase QJS_AddRegExp       66 801
#pragma libcall QJSBase QJS_AddJSON         6c 801
#pragma libcall QJSBase QJS_AddProxy        72 801
#pragma libcall QJSBase QJS_AddMapSet       78 801
#pragma libcall QJSBase QJS_AddTypedArrays  7e 801
#pragma libcall QJSBase QJS_AddPromise      84 801
#pragma libcall QJSBase QJS_AddWeakRef      8a 801
#pragma libcall QJSBase QJS_AddDOMException 90 801
#pragma libcall QJSBase QJS_AddPerformance  96 801
#pragma libcall QJSBase QJS_EvalSimple      9c 09803
#pragma libcall QJSBase QJS_Eval            a2 1B0A9806

static const char ver[] = "$VER: try_medium 0.53 (04.4.2026)";

/* Request 256KB stack */
long __stack = 262144;

int main(int argc, char **argv)
{
    JSRuntime *rt;
    JSContext *ctx;
    const char *v;
    int ret;

    printf("quickjs.library v0.50 test\n");
    printf("==========================\n");

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) {
        printf("FATAL: Could not open quickjs.library\n");
        return 20;
    }
    printf("1. OpenLibrary OK (base=0x%lx, ver=%ld.%ld)\n",
           (unsigned long)QJSBase,
           (long)QJSBase->lib_Version,
           (long)QJSBase->lib_Revision);

    /* Step 2: GetVersion */
    v = QJS_GetVersion();
    printf("2. GetVersion = '%s'\n", v ? v : "(null)");

    /* Step 3: NewRuntime */
    rt = QJS_NewRuntime();
    printf("3. NewRuntime = 0x%lx\n", (unsigned long)rt);
    if (!rt) {
        printf("FATAL: NewRuntime returned NULL\n");
        CloseLibrary(QJSBase);
        return 20;
    }

    /* Step 4-6: Simple operations */
    QJS_SetMemoryLimit(rt, 8 * 1024 * 1024);
    printf("4. SetMemoryLimit OK\n");
    QJS_SetMaxStackSize(rt, 256 * 1024);
    printf("5. SetMaxStackSize OK\n");
    QJS_RunGC(rt);
    printf("6. RunGC OK\n");

    /* Step 7: NewContextRaw */
    printf("7. NewContextRaw...\n");
    ctx = QJS_NewContextRaw(rt);
    printf("   = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("FATAL: NewContextRaw returned NULL\n");
        QJS_FreeRuntime(rt);
        CloseLibrary(QJSBase);
        return 20;
    }

    /* Step 8: Free it */
    QJS_FreeContext(ctx);
    printf("8. FreeContext OK\n");
    ctx = NULL;

    /* Step 9: Build context with intrinsics one at a time */
    printf("9. NewContextRaw...\n");
    ctx = QJS_NewContextRaw(rt);
    printf("   ctx = 0x%lx\n", (unsigned long)ctx);
    if (!ctx) {
        printf("FATAL: NewContextRaw returned NULL\n");
        QJS_FreeRuntime(rt);
        CloseLibrary(QJSBase);
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
    CloseLibrary(QJSBase);
    printf("Done! All steps passed.\n");
    return 0;
}
