/* Standalone Amiga app test — compiled via qjsc */
import * as std from "qjs:std";
import * as os from "qjs:os";

std.puts("Hello from standalone QuickJS!\n");
std.puts("Platform: " + os.platform + "\n");
std.puts("1 + 1 = " + (1+1) + "\n");
std.puts("Math.PI = " + Math.PI + "\n");

var obj = {name: "Amiga", cpu: "68060"};
print(obj);

std.puts("All OK!\n");
