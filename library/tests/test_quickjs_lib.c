/*
 * test_quickjs_lib.c — Test application for quickjs.library
 *
 * This program opens quickjs.library via the standard AmigaOS
 * OpenLibrary/CloseLibrary mechanism, and exercises the QJS_ API
 * to verify the library works correctly.
 *
 * Compile: sc MATH=68881 DATA=FARONLY test_quickjs_lib.c
 * Link:    slink c.o test_quickjs_lib.o TO test_quickjs_lib LIB scnb.lib scm881nb.lib amiga.lib
 * Run:     Copy quickjs.library to LIBS: first, then run test_quickjs_lib
 */

#include <stdio.h>
#include <string.h>

#include <exec/types.h>
#include <proto/exec.h>

/* This single include brings in everything needed to use quickjs.library:
 * - Type definitions (JSRuntime, JSContext, JSValue, etc.)
 * - Function prototypes (QJS_NewRuntime, QJS_Eval, etc.)
 * - Pragma syscalls (auto-dispatch through QuickJSBase) */
#include <proto/quickjs.h>

/* The library base pointer — pragmas reference this to dispatch calls */
struct Library *QuickJSBase = NULL;

static const char ver[] = "$VER: test_quickjs_lib 0.49 (27.3.2026)";

/* ---- helpers ---- */

static int tests_run = 0;
static int tests_passed = 0;
static int tests_failed = 0;

static void test_ok(const char *name)
{
    tests_run++;
    tests_passed++;
    printf("  OK: %s\n", name);
}

static void test_fail(const char *name, const char *detail)
{
    tests_run++;
    tests_failed++;
    printf("  FAIL: %s — %s\n", name, detail);
}

/* ---- tests ---- */

static void test_version(void)
{
    const char *v = QJS_GetVersion();
    if (v && strlen(v) > 0)
        test_ok("QJS_GetVersion()");
    else
        test_fail("QJS_GetVersion()", "returned NULL or empty");
}

static void test_runtime_context(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    JSRuntime *rt2;

    rt = QJS_NewRuntime();
    if (!rt) {
        test_fail("QJS_NewRuntime()", "returned NULL");
        return;
    }
    test_ok("QJS_NewRuntime()");

    QJS_SetMemoryLimit(rt, 4 * 1024 * 1024);
    test_ok("QJS_SetMemoryLimit()");

    QJS_SetMaxStackSize(rt, 256 * 1024);
    test_ok("QJS_SetMaxStackSize()");

    ctx = QJS_NewContext(rt);
    if (!ctx) {
        test_fail("QJS_NewContext()", "returned NULL");
        QJS_FreeRuntime(rt);
        return;
    }
    test_ok("QJS_NewContext()");

    rt2 = QJS_GetRuntime(ctx);
    if (rt2 == rt)
        test_ok("QJS_GetRuntime()");
    else
        test_fail("QJS_GetRuntime()", "wrong runtime");

    QJS_FreeContext(ctx);
    test_ok("QJS_FreeContext()");

    QJS_FreeRuntime(rt);
    test_ok("QJS_FreeRuntime()");
}

static void test_eval_integer(JSContext *ctx)
{
    JSValue result;
    QJS_Eval(&result, ctx, "2 + 3", 5, "<test>", 0);

    if (QJS_IsException(&result)) {
        test_fail("QJS_Eval('2+3')", "exception");
        QJS_FreeValue(ctx, &result);
        return;
    }

    if (QJS_IsNumber(&result)) {
        long val = 0;
        QJS_ToInt32(ctx, &val, &result);
        if (val == 5)
            test_ok("QJS_Eval('2+3') == 5");
        else {
            char buf[64];
            sprintf(buf, "expected 5, got %ld", val);
            test_fail("QJS_Eval('2+3')", buf);
        }
    } else {
        test_fail("QJS_Eval('2+3')", "not a number");
    }

    QJS_FreeValue(ctx, &result);
}

static void test_eval_string(JSContext *ctx)
{
    JSValue result;
    QJS_Eval(&result, ctx, "'hello' + ' ' + 'Amiga'", 22, "<test>", 0);

    if (QJS_IsException(&result)) {
        test_fail("QJS_Eval(string concat)", "exception");
        QJS_FreeValue(ctx, &result);
        return;
    }

    if (QJS_IsString(&result)) {
        const char *s = QJS_ToCString(ctx, &result);
        if (s && strcmp(s, "hello Amiga") == 0)
            test_ok("QJS_Eval('hello' + ' ' + 'Amiga')");
        else {
            char buf[128];
            sprintf(buf, "expected 'hello Amiga', got '%s'",
                    s ? s : "(null)");
            test_fail("QJS_Eval(string concat)", buf);
        }
        if (s) QJS_FreeCString(ctx, s);
    } else {
        test_fail("QJS_Eval(string concat)", "not a string");
    }

    QJS_FreeValue(ctx, &result);
}

static void test_new_values(JSContext *ctx)
{
    JSValue val;

    /* Integer */
    QJS_NewInt32(&val, ctx, 42);
    if (QJS_IsNumber(&val)) {
        long n = 0;
        QJS_ToInt32(ctx, &n, &val);
        if (n == 42)
            test_ok("QJS_NewInt32(42)");
        else
            test_fail("QJS_NewInt32(42)", "wrong value");
    } else {
        test_fail("QJS_NewInt32(42)", "not a number");
    }
    QJS_FreeValue(ctx, &val);

    /* String */
    QJS_NewString(&val, ctx, "test string");
    if (QJS_IsString(&val)) {
        const char *s = QJS_ToCString(ctx, &val);
        if (s && strcmp(s, "test string") == 0)
            test_ok("QJS_NewString('test string')");
        else
            test_fail("QJS_NewString()", "wrong value");
        if (s) QJS_FreeCString(ctx, s);
    } else {
        test_fail("QJS_NewString()", "not a string");
    }
    QJS_FreeValue(ctx, &val);

    /* Bool */
    QJS_NewBool(&val, ctx, 1);
    if (QJS_ToBool(ctx, &val) == 1)
        test_ok("QJS_NewBool(true)");
    else
        test_fail("QJS_NewBool(true)", "not true");
    QJS_FreeValue(ctx, &val);

    /* Float64 */
    {
        double d = 3.14;
        QJS_NewFloat64(&val, ctx, &d);
        if (QJS_IsNumber(&val)) {
            double out = 0.0;
            QJS_ToFloat64(ctx, &out, &val);
            /* rough check — dtoa may not be exact */
            if (out > 3.13 && out < 3.15)
                test_ok("QJS_NewFloat64(3.14)");
            else
                test_fail("QJS_NewFloat64(3.14)", "wrong value");
        } else {
            test_fail("QJS_NewFloat64(3.14)", "not a number");
        }
        QJS_FreeValue(ctx, &val);
    }
}

static void test_object_properties(JSContext *ctx)
{
    JSValue obj;
    QJS_NewObject(&obj, ctx);

    if (!QJS_IsObject(&obj)) {
        test_fail("QJS_NewObject()", "not an object");
        QJS_FreeValue(ctx, &obj);
        return;
    }
    test_ok("QJS_NewObject()");

    /* Set a string property */
    {
        JSValue str;
        QJS_NewString(&str, ctx, "world");
        QJS_SetPropertyStr(ctx, &obj, "hello", &str);
        /* SetPropertyStr consumes str — do NOT free it */
    }

    /* Get the property back */
    {
        JSValue got;
        QJS_GetPropertyStr(&got, ctx, &obj, "hello");
        if (QJS_IsString(&got)) {
            const char *s = QJS_ToCString(ctx, &got);
            if (s && strcmp(s, "world") == 0)
                test_ok("Set/GetPropertyStr('hello')");
            else
                test_fail("GetPropertyStr('hello')", "wrong value");
            if (s) QJS_FreeCString(ctx, s);
        } else {
            test_fail("GetPropertyStr('hello')", "not a string");
        }
        QJS_FreeValue(ctx, &got);
    }

    /* Set an integer property */
    {
        JSValue num;
        QJS_NewInt32(&num, ctx, 99);
        QJS_SetPropertyStr(ctx, &obj, "count", &num);
    }

    /* Has property */
    {
        JSAtom atom = QJS_NewAtom(ctx, "count");
        if (QJS_HasProperty(ctx, &obj, atom))
            test_ok("QJS_HasProperty('count')");
        else
            test_fail("QJS_HasProperty('count')", "not found");
        QJS_FreeAtom(ctx, atom);
    }

    QJS_FreeValue(ctx, &obj);
}

static void test_array(JSContext *ctx)
{
    JSValue arr;
    QJS_NewArray(&arr, ctx);

    if (!QJS_IsArray(&arr)) {
        test_fail("QJS_NewArray()", "not an array");
        QJS_FreeValue(ctx, &arr);
        return;
    }
    test_ok("QJS_NewArray()");

    /* Push elements */
    {
        JSValue v;
        int i;
        for (i = 0; i < 5; i++) {
            QJS_NewInt32(&v, ctx, i * 10);
            QJS_SetPropertyUint32(ctx, &arr, (ULONG)i, &v);
        }
    }

    /* Read element */
    {
        JSValue elem;
        QJS_GetPropertyUint32(&elem, ctx, &arr, 3);
        if (QJS_IsNumber(&elem)) {
            long n = 0;
            QJS_ToInt32(ctx, &n, &elem);
            if (n == 30)
                test_ok("Array[3] == 30");
            else
                test_fail("Array[3]", "wrong value");
        } else {
            test_fail("Array[3]", "not a number");
        }
        QJS_FreeValue(ctx, &elem);
    }

    QJS_FreeValue(ctx, &arr);
}

static void test_global_object(JSContext *ctx)
{
    JSValue global;
    QJS_GetGlobalObject(&global, ctx);

    if (QJS_IsObject(&global))
        test_ok("QJS_GetGlobalObject()");
    else
        test_fail("QJS_GetGlobalObject()", "not an object");

    QJS_FreeValue(ctx, &global);
}

static void test_type_checks(JSContext *ctx)
{
    JSValue val;

    /* undefined */
    QJS_Eval(&val, ctx, "undefined", 9, "<test>", 0);
    if (QJS_IsUndefined(&val))
        test_ok("IsUndefined(undefined)");
    else
        test_fail("IsUndefined(undefined)", "false");
    QJS_FreeValue(ctx, &val);

    /* null */
    QJS_Eval(&val, ctx, "null", 4, "<test>", 0);
    if (QJS_IsNull(&val))
        test_ok("IsNull(null)");
    else
        test_fail("IsNull(null)", "false");
    QJS_FreeValue(ctx, &val);

    /* exception check */
    QJS_Eval(&val, ctx, "throw 'oops'", 12, "<test>", 0);
    if (QJS_IsException(&val))
        test_ok("IsException(thrown)");
    else
        test_fail("IsException(thrown)", "false");
    QJS_FreeValue(ctx, &val);
    /* clear the exception */
    {
        JSValue exc;
        QJS_GetException(&exc, ctx);
        QJS_FreeValue(ctx, &exc);
    }
}

static void test_json(JSContext *ctx)
{
    JSValue parsed;
    const char *json = "{\"name\":\"Amiga\",\"year\":1985}";
    QJS_ParseJSON(&parsed, ctx, json, (ULONG)strlen(json), "<json>");

    if (QJS_IsObject(&parsed)) {
        JSValue name;
        QJS_GetPropertyStr(&name, ctx, &parsed, "name");
        if (QJS_IsString(&name)) {
            const char *s = QJS_ToCString(ctx, &name);
            if (s && strcmp(s, "Amiga") == 0)
                test_ok("QJS_ParseJSON + GetPropertyStr");
            else
                test_fail("ParseJSON", "wrong name");
            if (s) QJS_FreeCString(ctx, s);
        } else {
            test_fail("ParseJSON", "name not a string");
        }
        QJS_FreeValue(ctx, &name);
    } else {
        test_fail("QJS_ParseJSON()", "not an object");
    }

    QJS_FreeValue(ctx, &parsed);
}

static void test_dup_value(JSContext *ctx)
{
    JSValue original, copy;
    QJS_NewString(&original, ctx, "duplicate me");
    QJS_DupValue(&copy, ctx, &original);

    {
        const char *s1 = QJS_ToCString(ctx, &original);
        const char *s2 = QJS_ToCString(ctx, &copy);
        if (s1 && s2 && strcmp(s1, s2) == 0)
            test_ok("QJS_DupValue()");
        else
            test_fail("QJS_DupValue()", "strings differ");
        if (s1) QJS_FreeCString(ctx, s1);
        if (s2) QJS_FreeCString(ctx, s2);
    }

    QJS_FreeValue(ctx, &original);
    QJS_FreeValue(ctx, &copy);
}

static void test_atoms(JSContext *ctx)
{
    JSAtom atom = QJS_NewAtom(ctx, "myProp");
    if (atom != 0) {
        JSAtom dup = QJS_DupAtom(ctx, atom);
        if (dup == atom)
            test_ok("QJS_NewAtom + DupAtom");
        else
            test_fail("DupAtom", "different atom");
        QJS_FreeAtom(ctx, dup);
    } else {
        test_fail("QJS_NewAtom()", "returned 0");
    }
    QJS_FreeAtom(ctx, atom);
}

static void test_error_throw(JSContext *ctx)
{
    JSValue err;
    QJS_ThrowTypeErrorMsg(&err, ctx, "test error message");

    if (QJS_IsException(&err))
        test_ok("QJS_ThrowTypeErrorMsg()");
    else
        test_fail("ThrowTypeErrorMsg", "not an exception");

    QJS_FreeValue(ctx, &err);

    /* Clear the pending exception */
    if (QJS_HasException(ctx)) {
        JSValue exc;
        QJS_GetException(&exc, ctx);
        QJS_FreeValue(ctx, &exc);
        test_ok("QJS_HasException + GetException");
    }
}

/* ---- main ---- */

int main(int argc, char **argv)
{
    JSRuntime *rt;
    JSContext *ctx;

    printf("quickjs.library test suite\n");
    printf("==========================\n\n");

    /* Open the library */
    QuickJSBase = OpenLibrary("quickjs.library", 0);
    if (!QuickJSBase) {
        printf("FATAL: Could not open quickjs.library!\n");
        printf("Make sure quickjs.library is in LIBS:\n");
        return 20;
    }

    printf("quickjs.library opened at 0x%lx\n\n",
           (unsigned long)QuickJSBase);

    /* Test 1: Version */
    printf("[Version]\n");
    test_version();
    printf("\n");

    /* Test 2: Runtime/Context lifecycle */
    printf("[Runtime & Context]\n");
    test_runtime_context();
    printf("\n");

    /* Create a runtime+context for the remaining tests */
    rt = QJS_NewRuntime();
    if (!rt) {
        printf("FATAL: QJS_NewRuntime() failed\n");
        CloseLibrary(QuickJSBase);
        return 20;
    }
    QJS_SetMemoryLimit(rt, 8 * 1024 * 1024);
    QJS_SetMaxStackSize(rt, 256 * 1024);

    ctx = QJS_NewContext(rt);
    if (!ctx) {
        printf("FATAL: QJS_NewContext() failed\n");
        QJS_FreeRuntime(rt);
        CloseLibrary(QuickJSBase);
        return 20;
    }

    /* Test 3: Eval */
    printf("[Eval]\n");
    test_eval_integer(ctx);
    test_eval_string(ctx);
    printf("\n");

    /* Test 4: Value creation */
    printf("[Value Creation]\n");
    test_new_values(ctx);
    printf("\n");

    /* Test 5: Object properties */
    printf("[Object Properties]\n");
    test_object_properties(ctx);
    printf("\n");

    /* Test 6: Arrays */
    printf("[Arrays]\n");
    test_array(ctx);
    printf("\n");

    /* Test 7: Global object */
    printf("[Global Object]\n");
    test_global_object(ctx);
    printf("\n");

    /* Test 8: Type checks */
    printf("[Type Checks]\n");
    test_type_checks(ctx);
    printf("\n");

    /* Test 9: JSON */
    printf("[JSON]\n");
    test_json(ctx);
    printf("\n");

    /* Test 10: DupValue */
    printf("[DupValue]\n");
    test_dup_value(ctx);
    printf("\n");

    /* Test 11: Atoms */
    printf("[Atoms]\n");
    test_atoms(ctx);
    printf("\n");

    /* Test 12: Error throwing */
    printf("[Error Handling]\n");
    test_error_throw(ctx);
    printf("\n");

    /* Cleanup */
    QJS_FreeContext(ctx);
    QJS_FreeRuntime(rt);

    /* Close the library */
    CloseLibrary(QuickJSBase);

    /* Summary */
    printf("==========================\n");
    printf("Results: %d/%d passed, %d failed\n",
           tests_passed, tests_run, tests_failed);

    return tests_failed > 0 ? 5 : 0;
}
