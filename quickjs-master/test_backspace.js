/* test_backspace.js - simulate REPL backspace to find freeze point */
import * as std from "qjs:std";
import * as os from "qjs:os";

var fd = std.in.fileno();
var buf = new Uint8Array(64);

/* Helper: blocking read of one byte */
function readbyte() {
    var n = os.read(fd, buf.buffer, 0, 1);
    if (n <= 0) return -1;
    return buf[0];
}

/* Enter raw mode */
if (os.ttySetRaw) os.ttySetRaw(fd);

std.puts("T1: type any char to start > ");
std.out.flush();
readbyte();

/* Simulate: user typed "pr", now pressing backspace */
/* Print prompt + "pr" */
std.puts("\r\nqjs > pr");
std.out.flush();

std.puts("\r\n[step1: move_cursor left 2]\r\n");
std.out.flush();
std.puts("\x1b[2D");
std.out.flush();

std.puts("\r\n[step2: puts 'p']\r\n");
std.out.flush();
std.puts("p");
std.out.flush();

std.puts("\r\n[step3: erase to end \\x1b[J]\r\n");
std.out.flush();
std.puts("\x1b[J");
std.out.flush();

std.puts("\r\n[step4: all done, press key] ");
std.out.flush();
var ch = readbyte();
std.puts("\r\ngot: 0x" + ch.toString(16) + "\r\n");
std.out.flush();

/* Now test the exact sequence as one write */
std.puts("[step5: combined sequence as REPL does it]\r\n");
std.out.flush();
std.puts("qjs > pr");
std.out.flush();
/* Backspace: cursor left 2, print "p", erase rest */
std.puts("\x1b[2D" + "p" + "\x1b[J");
std.out.flush();

std.puts("\r\n[step6: press key to exit] ");
std.out.flush();
readbyte();
std.puts("\r\ndone\r\n");
