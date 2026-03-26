/* T22 - Test print(object) from module context.
 *
 * The REPL runs as a module. Does print(object)
 * crash when called from a module vs a script?
 *
 * Run: qjs -m amiga/tests/t22.js
 */
import * as std from "qjs:std";
import * as os from "qjs:os";

/* Test 1: print object from module scope */
print("T1:", {x:1});

/* Test 2: print from inside a closure (like REPL) */
(function(g) {
    var r = std.evalScript("({x:1})");
    print("T2:", r);
    print("T3:", g.os);
})(globalThis);

print("ALL OK");
