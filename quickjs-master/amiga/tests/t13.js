/* T13 - T12 + ttyGetWinSize + arrow keys + cursor movement.
 *
 * This adds what T12 was missing vs the real REPL:
 *   - ttyGetWinSize call before ttySetRaw
 *   - ESC sequence parsing for arrow keys
 *   - Left/right cursor movement
 *   - Processing all bytes from a read (not just first)
 *
 * Type chars, use left/right arrows, backspace. Ctrl-C exits.
 * If this crashes, one of these features is the culprit.
 */
var prompt = "test> ";
var cmd = "";
var last_cmd = "";
var last_pos = 0;
var cursor_pos = 0;
var term_width = 80;

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
            ucs_length(
                cmd.substring(cursor_pos, last_pos)));
    } else if (cursor_pos > last_pos) {
        out += cmd.substring(last_pos, cursor_pos);
    }
    last_pos = cursor_pos;
    if (out.length > 0) {
        std.puts(out);
        std.out.flush();
    }
}

function backward_delete_char() {
    if (cursor_pos > 0) {
        var start = cursor_pos - 1;
        cmd = cmd.substring(0, start)
            + cmd.substring(cursor_pos);
        cursor_pos = start;
    }
}

function forward_char() {
    if (cursor_pos < cmd.length)
        cursor_pos++;
}

function backward_char() {
    if (cursor_pos > 0)
        cursor_pos--;
}

function insert(str) {
    cmd = cmd.substring(0, cursor_pos)
        + str
        + cmd.substring(cursor_pos);
    cursor_pos += str.length;
}

/* Key bindings (subset of REPL) */
var commands = {};
commands["\x08"] = backward_delete_char;
commands["\x7f"] = backward_delete_char;
commands["\x1b[C"] = forward_char;
commands["\x1b[D"] = backward_char;

/* ESC sequence state machine (same as REPL) */
var rl_state = 0;
var rl_keys = "";

function handle_key(keys) {
    var fun = commands[keys];
    if (fun) {
        fun(keys);
    } else if (ucs_length(keys) === 1
               && keys >= " ") {
        insert(keys);
    }
    if (cursor_pos < 0) cursor_pos = 0;
    if (cursor_pos > cmd.length)
        cursor_pos = cmd.length;
    do_update();
}

function handle_char(c1) {
    var c = String.fromCodePoint(c1);
    switch (rl_state) {
    case 0:
        if (c === "\x1b") {
            rl_keys = c;
            rl_state = 1;
        } else {
            handle_key(c);
        }
        break;
    case 1:
        rl_keys += c;
        if (c === "[") {
            rl_state = 2;
        } else {
            handle_key(rl_keys);
            rl_state = 0;
        }
        break;
    case 2:
        rl_keys += c;
        if (!(c === ";" || (c >= "0" && c <= "9"))) {
            handle_key(rl_keys);
            rl_state = 0;
        }
        break;
    }
}

/* --- init (same order as REPL) --- */

var term_fd = std.in.fileno();

/* call ttyGetWinSize like the REPL does */
if (os.isatty(term_fd) && os.ttyGetWinSize) {
    var tab = os.ttyGetWinSize(term_fd);
    if (tab) term_width = tab[0];
}

/* enter raw mode */
os.ttySetRaw(term_fd);

/* show prompt */
std.puts(prompt);
std.out.flush();

/* read handler — processes all bytes */
var rbuf = new Uint8Array(64);
os.setReadHandler(term_fd, function () {
    var n = os.read(term_fd, rbuf.buffer,
                    0, rbuf.length);
    for (var i = 0; i < n; i++) {
        if (rbuf[i] === 3) {
            os.setReadHandler(term_fd, null);
            std.puts("\r\n");
            std.out.flush();
            return;
        }
        handle_char(rbuf[i]);
    }
});
