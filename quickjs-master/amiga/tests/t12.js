/* T12 - Simulates REPL backspace with full call depth.
 *
 * Same as T11 but with the same nesting as the real REPL:
 *   read_handler -> handle_byte -> handle_char
 *     -> handle_key -> backward_delete -> delete_dir
 *     -> update -> ucs_length / dupchar / std.puts
 *
 * Type characters then press backspace. Ctrl-C to exit.
 * If this crashes but T11 didn't, it's a stack overflow.
 */
var prompt = "qjs > ";
var cmd = "";
var last_cmd = "";
var last_pos = 0;
var cursor_pos = 0;

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
        if (last_cmd.substring(0, last_pos)
            === cmd.substring(0, last_pos)) {
            out += cmd.substring(last_pos);
        } else {
            var old_total = ucs_length(prompt)
                          + ucs_length(last_cmd);
            out += "\r" + prompt + cmd;
            var new_total = ucs_length(prompt)
                          + ucs_length(cmd);
            if (old_total > new_total) {
                var pad = old_total - new_total;
                out += dupchar(" ", pad)
                     + dupchar("\x08", pad);
            }
        }
        last_cmd = cmd;
        last_pos = cmd.length;
    }
    if (cursor_pos < last_pos) {
        out += dupchar("\x08",
            ucs_length(cmd.substring(cursor_pos, last_pos)));
    } else if (cursor_pos > last_pos) {
        out += cmd.substring(last_pos, cursor_pos);
    }
    last_pos = cursor_pos;
    if (out.length > 0) {
        std.puts(out);
        std.out.flush();
    }
}

function is_trailing_surrogate(c) {
    var code = c.charCodeAt(0);
    return (code >= 0xdc00 && code < 0xe000);
}

function delete_char_dir(dir) {
    var start, end;
    start = cursor_pos;
    if (dir < 0) {
        start--;
        while (start > 0
               && is_trailing_surrogate(cmd.charAt(start)))
            start--;
    }
    end = start + 1;
    while (end < cmd.length
           && is_trailing_surrogate(cmd.charAt(end)))
        end++;
    if (start >= 0 && start < cmd.length) {
        cmd = cmd.substring(0, start)
            + cmd.substring(end);
        cursor_pos = start;
    }
}

function backward_delete_char() {
    delete_char_dir(-1);
}

function insert(str) {
    if (str) {
        cmd = cmd.substring(0, cursor_pos)
            + str
            + cmd.substring(cursor_pos);
        cursor_pos += str.length;
    }
}

function handle_key(c) {
    if (c === "\x08" || c === "\x7f") {
        backward_delete_char();
    } else if (c >= " ") {
        insert(c);
    }
    if (cursor_pos < 0) cursor_pos = 0;
    if (cursor_pos > cmd.length)
        cursor_pos = cmd.length;
    do_update();
}

function handle_char(c1) {
    var c = String.fromCodePoint(c1);
    handle_key(c);
}

function handle_byte(c) {
    handle_char(c);
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
    handle_byte(ch);
});
