/* T11 - Simulates the REPL backspace update pattern.
 *
 * Type any 5 characters, then press backspace 3 times.
 * Ctrl-C to exit.
 *
 * This replicates the exact output that update() produces
 * when you press backspace in the REPL.
 */
var prompt = "qjs > ";
var cmd = "";
var last_cmd = "";
var last_pos = 0;

function dupchar(ch, n) {
    var s = "";
    while (n-- > 0) s += ch;
    return s;
}

function ucs_length(s) {
    var n = 0, i;
    for (i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c < 0xdc00 || c >= 0xe000) n++;
    }
    return n;
}

function do_update() {
    var out = "";
    if (cmd !== last_cmd) {
        var old_total = ucs_length(prompt) + ucs_length(last_cmd);
        out += "\r" + prompt + cmd;
        var new_total = ucs_length(prompt) + ucs_length(cmd);
        if (old_total > new_total) {
            var pad = old_total - new_total;
            out += dupchar(" ", pad) + dupchar("\x08", pad);
        }
    }
    last_cmd = cmd;
    last_pos = cmd.length;
    if (out.length > 0) {
        std.puts(out);
        std.out.flush();
    }
}

os.ttySetRaw(0);
std.puts(prompt);
std.out.flush();

var buf = new Uint8Array(8);

os.setReadHandler(0, function () {
    var n = os.read(0, buf.buffer, 0, 8);
    if (n <= 0) return;
    var ch = buf[0];

    if (ch === 3) {
        os.setReadHandler(0, null);
        std.puts("\r\n");
        std.out.flush();
        return;
    }

    if (ch === 8 || ch === 127) {
        /* backspace */
        if (cmd.length > 0) {
            cmd = cmd.substring(0, cmd.length - 1);
        }
    } else if (ch >= 32) {
        /* printable */
        cmd += String.fromCharCode(ch);
    }

    do_update();
});
