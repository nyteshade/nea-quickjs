/*
 * test_suite.c — Comprehensive quickjs.library test suite
 *
 * Tests every category of JS functionality through the library.
 * ALL LVO calls go through assembly helpers to avoid VBCC A6 bugs.
 * Reports PASS/FAIL for each test.
 *
 * Compile:
 *   vc +aos68k -cpu=68020 -fpu=68881 -I$VBCC/targets/m68k-amigaos/include \
 *      test_suite.c test_eval_asm.s -o test_suite -lamiga -lm881
 */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <exec/types.h>
#include <exec/libraries.h>
#include <proto/exec.h>

typedef unsigned long long JSValue;
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;

struct Library *QJSBase = NULL;

/* Assembly helpers */
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
extern void call_Eval(JSValue *result, JSContext *ctx, const char *input,
                       unsigned long len, const char *filename, int flags);
extern int call_HasException(JSContext *ctx);

/* Test counters */
static int pass_count = 0;
static int fail_count = 0;
static int total_count = 0;

static void test(const char *name, int condition) {
    total_count++;
    if (condition) {
        pass_count++;
        printf("  PASS: %s\n", name);
    } else {
        fail_count++;
        printf("  FAIL: %s\n", name);
    }
}

static long ev(JSContext *ctx, const char *code) {
    return call_EvalSimple(ctx, code, strlen(code));
}

/* Callback tracking */
static volatile int cb_called = 0;
static volatile int cb_argc = 0;

static JSValue test_callback(JSContext *ctx, JSValue this_val,
                              int argc, JSValue *argv) {
    cb_called = 1;
    cb_argc = argc;
    return 0x0000000600000000ULL; /* JS_UNDEFINED */
}

int main(void)
{
    JSRuntime *rt;
    JSContext *ctx;
    JSValue global, func;
    long r;

    QJSBase = OpenLibrary("quickjs.library", 0);
    if (!QJSBase) { printf("FATAL: Cannot open quickjs.library\n"); return 1; }

    rt = call_NewRuntime();
    ctx = call_NewContext(rt);
    if (!ctx) { printf("FATAL: Cannot create context\n"); return 1; }

    printf("=== QuickJS Library Test Suite ===\n");
    printf("QJSBase=%p ctx=%p\n\n", (void*)QJSBase, (void*)ctx);

    /* ---- 1. Basic Arithmetic ---- */
    printf("[1] Basic Arithmetic\n");
    test("1+1 == 2", ev(ctx, "1+1") == 2);
    test("3*7 == 21", ev(ctx, "3*7") == 21);
    test("100-58 == 42", ev(ctx, "100-58") == 42);
    test("10/2 == 5", ev(ctx, "10/2") == 5);
    test("2**10 == 1024", ev(ctx, "2**10") == 1024);
    test("-5+10 == 5", ev(ctx, "-5+10") == 5);

    /* ---- 2. Variables & Scope ---- */
    printf("\n[2] Variables & Scope\n");
    ev(ctx, "var gv1 = 42");
    test("var persists across eval", ev(ctx, "gv1") == 42);
    ev(ctx, "let gv2 = 99");
    test("let persists across eval", ev(ctx, "gv2") == 99);
    test("const in same eval", ev(ctx, "const c=77; c") == 77);
    ev(ctx, "gv1 = gv1 + 1");
    test("var mutation", ev(ctx, "gv1") == 43);

    /* ---- 3. Functions (JS) ---- */
    printf("\n[3] Functions (JS)\n");
    ev(ctx, "function add(a,b) { return a+b; }");
    test("function declaration", ev(ctx, "add(3,4)") == 7);
    ev(ctx, "var mul = function(a,b) { return a*b; }");
    test("function expression", ev(ctx, "mul(5,6)") == 30);
    ev(ctx, "var arrow = (x) => x*x");
    test("arrow function", ev(ctx, "arrow(8)") == 64);
    test("closure", ev(ctx, "function mk(n){return ()=>n;} mk(55)()") == 55);
    test("recursion", ev(ctx, "function fib(n){return n<2?n:fib(n-1)+fib(n-2);} fib(10)") == 55);

    /* ---- 4. C Function Callbacks ---- */
    printf("\n[4] C Function Callbacks\n");
    call_GetGlobalObject(&global, ctx);
    call_NewCFunction2(&func, ctx, (void*)test_callback, "testcb", 0, 0, 0);
    call_SetPropertyStr(ctx, &global, "testcb", &func);
    cb_called = 0; cb_argc = 0;
    ev(ctx, "testcb(1,2,3)");
    test("C callback called", cb_called == 1);
    test("C callback argc", cb_argc == 3);
    call_FreeValue(ctx, &global);

    /* ---- 5. Strings ---- */
    printf("\n[5] Strings\n");
    test("string length", ev(ctx, "'hello'.length") == 5);
    test("string concat length", ev(ctx, "('foo'+'bar').length") == 6);
    test("charAt", ev(ctx, "'abc'.charCodeAt(1)") == 98);
    test("indexOf", ev(ctx, "'hello world'.indexOf('world')") == 6);
    test("template literal", ev(ctx, "var x=42; `${x}` == '42' ? 1 : 0") == 1);

    /* ---- 6. Arrays ---- */
    printf("\n[6] Arrays\n");
    test("array literal", ev(ctx, "[1,2,3].length") == 3);
    test("array push", ev(ctx, "var a=[]; a.push(1); a.push(2); a.length") == 2);
    test("array map", ev(ctx, "[1,2,3].map(x=>x*2)[2]") == 6);
    test("array reduce", ev(ctx, "[1,2,3,4].reduce((a,b)=>a+b, 0)") == 10);
    test("array filter", ev(ctx, "[1,2,3,4,5].filter(x=>x>3).length") == 2);
    test("spread", ev(ctx, "Math.max(...[3,1,4,1,5])") == 5);

    /* ---- 7. Objects ---- */
    printf("\n[7] Objects\n");
    test("object literal", ev(ctx, "var o={a:1,b:2}; o.a+o.b") == 3);
    test("object keys", ev(ctx, "Object.keys({x:1,y:2,z:3}).length") == 3);
    test("object assign", ev(ctx, "var t={}; Object.assign(t,{a:1},{b:2}); t.a+t.b") == 3);
    test("computed prop", ev(ctx, "var k='foo'; var o={[k]:42}; o.foo") == 42);
    test("destructuring", ev(ctx, "var {a,b} = {a:10,b:20}; a+b") == 30);

    /* ---- 8. Control Flow ---- */
    printf("\n[8] Control Flow\n");
    test("if/else", ev(ctx, "var r=0; if(true) r=1; else r=2; r") == 1);
    test("ternary", ev(ctx, "true ? 11 : 22") == 11);
    test("for loop", ev(ctx, "var s=0; for(var i=0;i<10;i++) s+=i; s") == 45);
    test("while loop", ev(ctx, "var n=0,i=0; while(i<5){n+=i;i++} n") == 10);
    test("for..of", ev(ctx, "var s=0; for(var x of [1,2,3]) s+=x; s") == 6);
    test("switch", ev(ctx, "var x=2,r=0; switch(x){case 1:r=10;break;case 2:r=20;break;} r") == 20);

    /* ---- 9. Error Handling ---- */
    printf("\n[9] Error Handling\n");
    test("try/catch", ev(ctx, "try { throw 42; } catch(e) { e }") == 42);
    test("try/finally", ev(ctx, "var r=0; try{r=1}finally{r+=10} r") == 11);
    test("TypeError caught", ev(ctx, "try{null.x}catch(e){1}") == 1);

    /* ---- 10. Math ---- */
    printf("\n[10] Math\n");
    test("Math.abs", ev(ctx, "Math.abs(-42)") == 42);
    test("Math.min", ev(ctx, "Math.min(3,1,4)") == 1);
    test("Math.max", ev(ctx, "Math.max(3,1,4)") == 4);
    test("Math.floor", ev(ctx, "Math.floor(3.7)") == 3);
    test("Math.ceil", ev(ctx, "Math.ceil(3.2)") == 4);
    test("Math.round", ev(ctx, "Math.round(3.5)") == 4);

    /* ---- 11. RegExp ---- */
    printf("\n[11] RegExp\n");
    test("regex test", ev(ctx, "/^hello/.test('hello world') ? 1 : 0") == 1);
    test("regex match", ev(ctx, "'abc123'.match(/\\d+/)[0] == '123' ? 1 : 0") == 1);
    test("regex replace", ev(ctx, "'hello'.replace(/l/g, 'r') == 'herro' ? 1 : 0") == 1);

    /* ---- 12. JSON ---- */
    printf("\n[12] JSON\n");
    test("JSON.parse", ev(ctx, "JSON.parse('{\"a\":42}').a") == 42);
    test("JSON.stringify", ev(ctx, "JSON.stringify({b:99}) == '{\"b\":99}' ? 1 : 0") == 1);
    test("JSON roundtrip", ev(ctx, "JSON.parse(JSON.stringify({x:7})).x") == 7);

    /* ---- 13. Promises ---- */
    printf("\n[13] Promises\n");
    test("Promise.resolve", ev(ctx, "var pr=0; Promise.resolve(42).then(v=>{pr=v}); pr") == 0);
    /* Note: pr=0 because promise handlers run asynchronously */

    /* ---- 14. Map & Set ---- */
    printf("\n[14] Map & Set\n");
    test("Map set/get", ev(ctx, "var m=new Map(); m.set('a',1); m.get('a')") == 1);
    test("Map size", ev(ctx, "var m=new Map(); m.set(1,1); m.set(2,2); m.size") == 2);
    test("Set size", ev(ctx, "var s=new Set([1,2,3,2,1]); s.size") == 3);
    test("Set has", ev(ctx, "var s=new Set([10,20]); s.has(10) ? 1 : 0") == 1);

    /* ---- 15. TypedArrays ---- */
    printf("\n[15] TypedArrays\n");
    test("Uint8Array", ev(ctx, "var a=new Uint8Array(4); a[0]=255; a[0]") == 255);
    test("Int32Array", ev(ctx, "var a=new Int32Array([1,2,3]); a[1]") == 2);
    test("ArrayBuffer", ev(ctx, "var ab=new ArrayBuffer(8); ab.byteLength") == 8);

    /* ---- 16. Symbols ---- */
    printf("\n[16] Symbols\n");
    test("Symbol()", ev(ctx, "typeof Symbol() == 'symbol' ? 1 : 0") == 1);
    test("Symbol.for", ev(ctx, "Symbol.for('x') === Symbol.for('x') ? 1 : 0") == 1);

    /* ---- 17. Classes ---- */
    printf("\n[17] Classes\n");
    test("class def", ev(ctx, "class C{constructor(n){this.n=n}} new C(42).n") == 42);
    test("class extend", ev(ctx, "class A{v(){return 1}} class B extends A{v(){return super.v()+1}} new B().v()") == 2);
    test("getter", ev(ctx, "class G{get x(){return 99}} new G().x") == 99);

    /* ---- 18. Generators ---- */
    printf("\n[18] Generators\n");
    test("generator", ev(ctx, "function* g(){yield 1;yield 2;yield 3} var it=g(); it.next().value") == 1);

    /* ---- 19. Destructuring & Spread ---- */
    printf("\n[19] Destructuring & Spread\n");
    test("array destructure", ev(ctx, "var [a,b,c]=[10,20,30]; b") == 20);
    test("rest params", ev(ctx, "function f(...a){return a.length} f(1,2,3,4)") == 4);
    test("object spread", ev(ctx, "var o={...{a:1},...{b:2}}; o.a+o.b") == 3);

    /* ---- 20. Modules & globalThis ---- */
    printf("\n[20] globalThis\n");
    test("globalThis exists", ev(ctx, "typeof globalThis == 'object' ? 1 : 0") == 1);
    ev(ctx, "globalThis.testGlobal = 123");
    test("globalThis set", ev(ctx, "testGlobal") == 123);

    /* ---- Summary ---- */
    printf("\n=== Results: %d/%d passed", pass_count, total_count);
    if (fail_count > 0)
        printf(", %d FAILED", fail_count);
    printf(" ===\n");

    call_FreeContext(ctx);
    call_FreeRuntime(rt);
    CloseLibrary(QJSBase);
    return fail_count > 0 ? 1 : 0;
}
