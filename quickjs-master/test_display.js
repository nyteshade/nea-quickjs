/*
 * test_display.js -- diagnose VT100 output sequence support on ViNCEd
 *
 * Run: qjs test_display.js
 *
 * Each test line shows a label followed by a result.
 * Compare actual output with the EXPECTED column to diagnose issues.
 *
 *  T1: cursor-left (\x1b[D)
 *      Write "AB", move cursor left 1, write "C" -> overwrites B
 *      EXPECTED: "AC"   BROKEN if cursor-left fails: "ABC"
 *
 *  T2: erase-to-end (\x1b[J)
 *      Write "ABCDE", move left 3, erase to end -> erases CDE
 *      EXPECTED: "AB"   BROKEN if erase fails:    "ABCDE"
 *
 *  T3: REPL simulation (same sequences update() emits for typing p,r,i)
 *      EXPECTED: "pri"  BROKEN if either T1 or T2 broken: "prpirp" etc.
 *
 *  T4: \x1b[K (erase to end of LINE only, narrower than \x1b[J)
 *      Same as T2 but uses CSI K instead of CSI J
 *      EXPECTED: "AB"
 */
import * as os from "qjs:os";
import * as std from "qjs:std";

var fd = std.in.fileno();
if (os.ttySetRaw) {
    os.ttySetRaw(fd);
}

/* T1: cursor-left */
std.puts("T1 cursor-left : AB\x1b[DC\r\n");

/* T2: erase-to-end-of-display (CSI J) */
std.puts("T2 erase-EOD   : ABCDE\x1b[3D\x1b[J\r\n");

/* T3: REPL-style update() simulation (no colors, optimize=false path) */
std.puts("T3 REPL-sim    : ");
std.puts("p\x1b[J");                /* type 'p': output p, erase trailing  */
std.puts("\x1b[Dpr\x1b[J");         /* type 'r': cursor-left 1, rewrite pr  */
std.puts("\x1b[2Dpri\x1b[J");       /* type 'i': cursor-left 2, rewrite pri */
std.puts("\r\n");

/* T4: erase-to-end-of-LINE (CSI K) - alternative to CSI J */
std.puts("T4 erase-EOL   : ABCDE\x1b[3D\x1b[K\r\n");

std.puts("\r\nEXPECTED: T1=AC  T2=AB  T3=pri  T4=AB\r\n");
std.out.flush();
