/*
 * hexdump.js -- diagnostic: show raw hex bytes received from the terminal
 *
 * Run: qjs hexdump.js
 *
 * Press keys and see what bytes the terminal sends.
 * This helps diagnose REPL input issues on AmigaOS (e.g. ViNCEd).
 *
 * Keys to test:
 *   - Normal chars: a b c 1 2 3
 *   - Backspace / Delete key
 *   - Cursor Up / Down / Left / Right arrows
 *   - Ctrl-A through Ctrl-Z
 *   - Press Ctrl-D (0x04) or Ctrl-C to quit
 */
import * as os from "qjs:os";
import * as std from "qjs:std";

var fd = std.in.fileno();

/* Enter raw mode */
if (os.ttySetRaw) {
    os.ttySetRaw(fd);
}

std.puts("Hex dump mode. Press keys to see bytes. Ctrl-D (04) to quit.\r\n");
std.out.flush();

var buf = new Uint8Array(32);
var running = true;

function readHandler() {
    var i, l, hex, b;
    l = os.read(fd, buf.buffer, 0, buf.length);
    if (l <= 0) {
        running = false;
        os.setReadHandler(fd, null);
        return;
    }

    hex = "";
    for (i = 0; i < l; i++) {
        b = buf[i];
        hex += b.toString(16).padStart(2, "0").toUpperCase() + " ";
        if (b === 4) {   /* Ctrl-D = EOF */
            running = false;
        }
    }
    std.puts("  [" + hex.trimEnd() + "]\r\n");
    std.out.flush();

    if (!running) {
        os.setReadHandler(fd, null);
    }
}

os.setReadHandler(fd, readHandler);
