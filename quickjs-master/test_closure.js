/* test_closure.js — test closure variable persistence on 32-bit AmigaOS */

/* Test 1: simple integer counter via closures */
function make_counter() {
    var n = 0;
    return {
        inc: function() { n = n + 1; },
        get: function() { return n; }
    };
}

var c = make_counter();
c.inc();
print("T1a expect 1: " + c.get());
c.inc();
print("T1b expect 2: " + c.get());
c.inc();
print("T1c expect 3: " + c.get());

/* Test 2: simulate insert() exactly as repl.js does it */
function make_inserter() {
    var pos = 0;
    var cmd = "";
    return {
        insert: function(str) {
            print("  before: pos=" + pos + " cmd='" + cmd + "'");
            cmd = cmd.substring(0, pos) + str + cmd.substring(pos);
            pos += str.length;
            print("  after:  pos=" + pos + " cmd='" + cmd + "'");
        },
        get_cmd: function() { return cmd; },
        get_pos: function() { return pos; }
    };
}

var ins = make_inserter();
print("--- T2: inserting H,e,l,l,o ---");
ins.insert("H");
ins.insert("e");
ins.insert("l");
ins.insert("l");
ins.insert("o");
print("T2 result: '" + ins.get_cmd() + "' (expect 'Hello')");
print("T2 pos: " + ins.get_pos() + " (expect 5)");

/* Test 3: multiple closure vars, called from event-loop-like dispatch */
function make_readline() {
    var cursor_pos = 0;
    var cmd = "";
    var last_cursor_pos = 0;

    function insert(str) {
        cmd = cmd.substring(0, cursor_pos) + str + cmd.substring(cursor_pos);
        cursor_pos += str.length;
    }

    function update() {
        last_cursor_pos = cursor_pos;
    }

    function handle_key(ch) {
        print("  handle_key: ch='" + ch + "' cursor_pos=" + cursor_pos + " cmd='" + cmd + "'");
        insert(ch);
        print("  after insert: cursor_pos=" + cursor_pos + " cmd='" + cmd + "'");
        update();
    }

    return { handle_key: handle_key, get_cmd: function() { return cmd; } };
}

var rl = make_readline();
print("--- T3: simulated REPL keystrokes ---");
rl.handle_key("p");
rl.handle_key("r");
rl.handle_key("i");
print("T3 result: '" + rl.get_cmd() + "' (expect 'pri')");
