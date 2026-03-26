/* T18 - T17 + full delete_char_dir (surrogates + kill_region)
 *
 * T17 works. This adds the REPL's delete_char_dir
 * with is_trailing_surrogate loops and kill_region check.
 *
 * Run: qjs -m amiga/tests/t18.js
 */
import * as std from "qjs:std";
import * as os from "qjs:os";

var prompt = "test> ";
var cmd = "";
var last_cmd = "";
var last_pos = 0;
var cursor_pos = 0;
var term_width = 80;
var quote_flag = false;
var last_fun = null;
var this_fun = null;
var clip_board = "";

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
function is_trailing_surrogate(c) {
    var d;
    if (typeof c !== "string") return false;
    d = c.codePointAt(0);
    return d >= 0xdc00 && d < 0xe000;
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
        out += dupchar("\x08", ucs_length(
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
function insert(str) {
    cmd = cmd.substring(0, cursor_pos)
        + str + cmd.substring(cursor_pos);
    cursor_pos += str.length;
}
function forward_char() {
    if (cursor_pos < cmd.length) {
        cursor_pos++;
        while (is_trailing_surrogate(
                   cmd.charAt(cursor_pos)))
            cursor_pos++;
    }
}
function backward_char() {
    if (cursor_pos > 0) {
        cursor_pos--;
        while (is_trailing_surrogate(
                   cmd.charAt(cursor_pos)))
            cursor_pos--;
    }
}
function beginning_of_line() { cursor_pos = 0; }
function end_of_line() { cursor_pos = cmd.length; }

function kill_region(start, end, dir) {
    var s = cmd.substring(start, end);
    if (dir < 0)
        clip_board = s + clip_board;
    else
        clip_board = clip_board + s;
    cmd = cmd.substring(0, start)
        + cmd.substring(end);
    cursor_pos = start;
}

/* THIS IS THE CHANGE: full delete_char_dir
   with surrogates + kill_region check */
function delete_char_dir(dir) {
    var start, end;
    start = cursor_pos;
    if (dir < 0) {
        start--;
        while (is_trailing_surrogate(
                   cmd.charAt(start)))
            start--;
    }
    end = start + 1;
    while (is_trailing_surrogate(cmd.charAt(end)))
        end++;
    if (start >= 0 && start < cmd.length) {
        if (last_fun === kill_region) {
            kill_region(start, end, dir);
        } else {
            cmd = cmd.substring(0, start)
                + cmd.substring(end);
            cursor_pos = start;
        }
    }
}

function delete_char() { delete_char_dir(1); }
function backward_delete_char() {
    delete_char_dir(-1);
}

function control_c() {
    std.puts("\n"); cmd = ""; cursor_pos = 0;
    return -2;
}
function control_d() {
    if (cmd.length == 0) {
        std.puts("\n"); return -3;
    } else {
        delete_char_dir(1);
    }
}
function accept_line() {
    std.puts("\n");
    if (cmd.length > 0) print("=> " + cmd);
    return -1;
}
function abort() {
    cmd = ""; cursor_pos = 0; return -2;
}
function alert() {}
function kill_line() {}
function backward_kill_line() {}
function kill_word() {}
function backward_kill_word() {}
function yank() { insert(clip_board); }
function transpose_chars() {}
function transpose_words() {}
function upcase_word() {}
function downcase_word() {}
function quoted_insert() { quote_flag = true; }
function previous_history() {}
function next_history() {}
function history_search_backward() {}
function history_search_forward() {}
function completion() {}
function clear_screen() {}
function reset() {
    cmd = ""; cursor_pos = 0; return -2;
}
function forward_word() {}
function backward_word() {}

var commands = {
    "\x01": beginning_of_line,
    "\x02": backward_char,
    "\x03": control_c,
    "\x04": control_d,
    "\x05": end_of_line,
    "\x06": forward_char,
    "\x07": abort,
    "\x08": backward_delete_char,
    "\x09": completion,
    "\x0a": accept_line,
    "\x0b": kill_line,
    "\x0d": accept_line,
    "\x0e": next_history,
    "\x10": previous_history,
    "\x11": quoted_insert,
    "\x12": alert,
    "\x13": alert,
    "\x14": transpose_chars,
    "\x17": backward_kill_word,
    "\x18": reset,
    "\x19": yank,
    "\x1bOA": previous_history,
    "\x1bOB": next_history,
    "\x1bOC": forward_char,
    "\x1bOD": backward_char,
    "\x1bOF": forward_word,
    "\x1bOH": backward_word,
    "\x1b[1;5C": forward_word,
    "\x1b[1;5D": backward_word,
    "\x1b[1~": beginning_of_line,
    "\x1b[3~": delete_char,
    "\x1b[4~": end_of_line,
    "\x1b[5~": history_search_backward,
    "\x1b[6~": history_search_forward,
    "\x1b[A": previous_history,
    "\x1b[B": next_history,
    "\x1b[C": forward_char,
    "\x1b[D": backward_char,
    "\x1b[F": end_of_line,
    "\x1b[H": beginning_of_line,
    "\x1b\x7f": backward_kill_word,
    "\x1bb": backward_word,
    "\x1bd": kill_word,
    "\x1bf": forward_word,
    "\x1bk": backward_kill_line,
    "\x1bl": downcase_word,
    "\x1bt": transpose_words,
    "\x1bu": upcase_word,
    "\x7f": backward_delete_char,
};

function handle_key(keys) {
    var fun;
    if (quote_flag) {
        if (ucs_length(keys) === 1) insert(keys);
        quote_flag = false;
    } else if (fun = commands[keys]) {
        this_fun = fun;
        var ret = fun(keys);
        switch (ret) {
        case -1:
            cmd = ""; cursor_pos = 0;
            last_cmd = ""; last_pos = 0;
            std.puts(prompt); std.out.flush();
            return;
        case -2:
            last_cmd = ""; last_pos = 0;
            std.puts(prompt); std.out.flush();
            return;
        case -3:
            os.setReadHandler(term_fd, null);
            std.puts("\r\n"); std.out.flush();
            return;
        }
        last_fun = this_fun;
    } else if (ucs_length(keys) === 1
               && keys >= " ") {
        insert(keys);
        last_fun = insert;
    } else {
        alert();
    }
    cursor_pos = (cursor_pos < 0) ? 0
        : (cursor_pos > cmd.length)
        ? cmd.length : cursor_pos;
    do_update();
}

var rl_state = 0;
var rl_keys = "";
function handle_char(c1) {
    var c = String.fromCodePoint(c1);
    switch (rl_state) {
    case 0:
        if (c === "\x1b") {
            rl_keys = c; rl_state = 1;
        } else { handle_key(c); }
        break;
    case 1:
        rl_keys += c;
        if (c === "[") { rl_state = 2; }
        else if (c === "O") { rl_state = 3; }
        else { handle_key(rl_keys); rl_state = 0; }
        break;
    case 2:
        rl_keys += c;
        if (!(c === ";" || (c >= "0" && c <= "9"))) {
            handle_key(rl_keys); rl_state = 0;
        }
        break;
    case 3:
        rl_keys += c;
        handle_key(rl_keys); rl_state = 0;
        break;
    }
}

var term_fd = std.in.fileno();
if (os.isatty(term_fd) && os.ttyGetWinSize) {
    var tab = os.ttyGetWinSize(term_fd);
    if (tab) term_width = tab[0];
}
os.ttySetRaw(term_fd);
std.puts(prompt); std.out.flush();

var rbuf = new Uint8Array(64);
os.setReadHandler(term_fd, function () {
    var n = os.read(term_fd, rbuf.buffer,
                    0, rbuf.length);
    for (var i = 0; i < n; i++) {
        if (rbuf[i] === 3) {
            os.setReadHandler(term_fd, null);
            std.puts("\r\n"); std.out.flush();
            return;
        }
        handle_char(rbuf[i]);
    }
});
