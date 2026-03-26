/* T23 - print(object) from event loop handler.
 *
 * Press any key. On each keypress, evaluates an
 * expression with std.evalScript and prints the
 * result — exactly like the REPL does.
 *
 * Press 1-5 to test different result types:
 *   1 = number (42)
 *   2 = string ("hello")
 *   3 = array ([1,2,3])
 *   4 = empty object ({})
 *   5 = object with property ({x:1})
 *   6 = os module
 *   q = quit
 *
 * Run: qjs -m amiga/tests/t23.js
 */
import * as std from "qjs:std";
import * as os from "qjs:os";

var exprs = {
    "1": "42",
    "2": "'hello'",
    "3": "[1,2,3]",
    "4": "({})",
    "5": "({x:1})",
    "6": "os",
};

os.ttySetRaw(0);
std.puts("Press 1-6 to test, q to quit:\r\n");
std.out.flush();

var buf = new Uint8Array(8);
os.setReadHandler(0, function() {
    var n = os.read(0, buf.buffer, 0, 8);
    if (n <= 0) return;
    var ch = String.fromCharCode(buf[0]);

    if (ch === "q" || buf[0] === 3) {
        os.setReadHandler(0, null);
        std.puts("\r\nbye\r\n");
        std.out.flush();
        return;
    }

    var expr = exprs[ch];
    if (!expr) return;

    std.puts("eval: " + expr + "\r\n");
    std.out.flush();

    try {
        var result = std.evalScript(expr);
        std.puts("type: " + typeof result + "\r\n");
        std.out.flush();
        print(result);
        std.out.flush();
        std.puts("OK\r\n");
        std.out.flush();
    } catch(e) {
        std.puts("ERROR: " + e + "\r\n");
        std.out.flush();
    }
});
