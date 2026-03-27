#!/usr/bin/env bash
# vamos_diag.sh — Backspace crash diagnostic tests, runnable from macOS via vamos.
#
# These tests isolate each component of the backspace code path WITHOUT requiring
# a binary transfer to Amiberry.  Run from the project root after sourcing amiga-env.sh:
#
#   source ./amiga-env.sh && bash quickjs-master/amiga/tests/vamos_diag.sh
#
# What each group tells us:
#   Group O: Output sequences — does fwrite of \r, \x08, spaces crash by themselves?
#   Group S: Stack depth    — how deep can JS call stacks go before crashing?
#   Group U: update() sim   — does the full backspace screen-update logic crash outside REPL?
#   Group L: Large stack    — do stack-sensitive tests pass when vamos -s is larger?
#
# Interpret results:
#   All O pass, S fails at low depth  → stack overflow is the cause
#   All O pass, S passes deeply       → crash is specific to raw-mode event loop
#   O tests crash                     → output/fwrite is the cause
#   U tests crash but O passes        → crash is in the update() logic itself (dupchar, etc)

set -euo pipefail
cd "$(dirname "$0")/../../.."  # project root

source ./amiga-env.sh

PASS=0; FAIL=0; SKIP=0

# Module imports needed in -e mode (registered as "qjs:std" / "qjs:os")
_STD='import * as std from "qjs:std";'
_OS='import * as os from "qjs:os";'

run_test() {
    local id="$1" desc="$2" expr="$3"
    printf "%-6s %-50s ... " "$id" "$desc"
    local out
    if out=$(amiga_run -e "$expr" 2>&1); then
        if echo "$out" | grep -q "PASS"; then
            echo "PASS"
            PASS=$((PASS+1))
        else
            echo "FAIL (no PASS marker in output)"
            echo "       output: $out"
            FAIL=$((FAIL+1))
        fi
    else
        echo "FAIL (non-zero exit or crash)"
        echo "       output: $out"
        FAIL=$((FAIL+1))
    fi
}

run_test_large_stack() {
    local id="$1" desc="$2" expr="$3"
    printf "%-6s %-50s ... " "$id" "$desc"
    local out
    # Note: vamos -s is in KiB, so 64 = 64 KiB stack
    if out=$(amiga_run_stack 64 -e "$expr" 2>&1); then
        if echo "$out" | grep -q "PASS"; then
            echo "PASS (with 64 KiB stack)"
            PASS=$((PASS+1))
        else
            echo "FAIL (no PASS marker)"
            echo "       output: $out"
            FAIL=$((FAIL+1))
        fi
    else
        echo "FAIL (non-zero exit or crash)"
        echo "       output: $out"
        FAIL=$((FAIL+1))
    fi
}

echo "======================================================================"
echo "  QuickJS/AmigaOS backspace crash diagnostics  (vamos)"
echo "  $(date)"
echo "  SC=$SC"
echo "======================================================================"
echo ""

# ---------------------------------------------------------------------------
echo "--- Group O: Output sequences (outside REPL, no raw mode) ---"
# ---------------------------------------------------------------------------

run_test O1 "CR + string to stdout" \
    "${_STD}"'std.puts("\rhello\r"); std.out.flush(); print("PASS")'

run_test O2 "Single backspace char (0x08)" \
    "${_STD}"'std.puts("hello\x08X"); std.out.flush(); print("PASS")'

run_test O3 "Multiple backspaces" \
    "${_STD}"'std.puts("hello\x08\x08\x08\x08\x08world"); std.out.flush(); print("PASS")'

run_test O4 "CR + reprint + space-erase (exact backspace pattern)" \
    "${_STD}"'var p="qjs > "; var cmd="hell"; std.puts("\r"); std.puts(p); std.puts(cmd); std.puts(" "); std.puts("\x08"); std.out.flush(); print("PASS")'

run_test O5 "CR + reprint + multi space-erase + cursor reposition" \
    "${_STD}"'var p="qjs > "; std.puts("\r"); std.puts(p); std.puts("hel"); std.puts("  "); std.puts("\x08\x08"); std.puts("\x08\x08\x08"); std.out.flush(); print("PASS")'

run_test O6 "Sequential std.puts calls x20" \
    "${_STD}"'for(var i=0;i<20;i++) std.puts("."); std.puts("\n"); print("PASS")'

echo ""

# ---------------------------------------------------------------------------
echo "--- Group S: Stack depth (JS function call recursion) ---"
# ---------------------------------------------------------------------------
# Each test calls a function recursively N levels deep.
# The depth where it fails tells us how much C stack each JS frame consumes.
# 4KB total / bytes_per_frame = max safe depth.
# Expected on 4KB stack: if depth 50 passes, frame < 80 bytes (impossible for QuickJS).
# If depth 10 fails, frames are ~400 bytes each.

run_test S1 "JS recursion depth 20" \
    'function f(n){if(n<=0)return 0;return 1+f(n-1);} f(20); print("PASS")'

run_test S2 "JS recursion depth 50" \
    'function f(n){if(n<=0)return 0;return 1+f(n-1);} try{f(50);print("PASS")}catch(e){print("FAIL depth=50: "+e)}'

run_test S3 "JS recursion depth 100" \
    'function f(n){if(n<=0)return 0;return 1+f(n-1);} try{f(100);print("PASS")}catch(e){print("FAIL depth=100: "+e)}'

run_test S4 "JS recursion depth 200" \
    'function f(n){if(n<=0)return 0;return 1+f(n-1);} try{f(200);print("PASS")}catch(e){print("FAIL depth=200: "+e)}'

run_test S5 "Nested std.puts 6 calls deep (mirrors backspace depth)" \
    "${_STD}"'function f6(){std.puts(".");}
function f5(){f6();}
function f4(){std.puts(".");f5();std.puts(".");}
function f3(){f4();}
function f2(){f3();}
function f1(){f2();}
f1(); std.puts("\n"); print("PASS")'

run_test S6 "ucs_length called 4x from update()-depth frame" \
    'function ucs_length(s){var n=0,i;for(i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<0xdc00||c>=0xe000)n++;}return n;}
function wrap3(){return ucs_length("hello")+ucs_length("world")+ucs_length("qjs > ")+ucs_length("test");}
function wrap2(){return wrap3();}
function wrap1(){return wrap2();}
wrap1(); print("PASS")'

echo ""

# ---------------------------------------------------------------------------
echo "--- Group U: update() full-redraw simulation (backspace on 'hello'->'hell') ---"
# These run outside the REPL event loop.  If they crash, the bug is in the
# output/compute logic itself, not in raw-mode or poll() interaction.
# ---------------------------------------------------------------------------

run_test U1 "dupchar() basic" \
    'function dupchar(ch,n){var s="";while(n-->0)s+=ch;return s;}
var r=dupchar("x",5); if(r==="xxxxx") print("PASS"); else print("FAIL got:"+r)'

run_test U2 "dupchar() with backspace char" \
    'function dupchar(ch,n){var s="";while(n-->0)s+=ch;return s;}
var r=dupchar("\x08",3); if(r.length===3) print("PASS"); else print("FAIL len:"+r.length)'

run_test U3 "Full update() backspace simulation (hello->hell, cursor at end)" \
    "${_STD}"'function ucs_length(s){var n=0,i;for(i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<0xdc00||c>=0xe000)n++;}return n;}
function dupchar(ch,n){var s="";while(n-->0)s+=ch;return s;}
var prompt="qjs > ";
var last_cmd="hello"; var cmd="hell";
var last_cursor_pos=5; var cursor_pos=4;
var old_total=ucs_length(prompt)+ucs_length(last_cmd);
std.puts("\r"); std.puts(prompt); std.puts(cmd);
var new_total=ucs_length(prompt)+ucs_length(cmd);
if(old_total>new_total){var pad=old_total-new_total;std.puts(dupchar(" ",pad));std.puts(dupchar("\x08",pad));}
last_cursor_pos=cmd.length;
if(cursor_pos<last_cursor_pos){std.puts(dupchar("\x08",ucs_length(cmd.substring(cursor_pos,last_cursor_pos))));}
std.out.flush();
print("PASS")'

run_test U4 "Full update() backspace simulation (cursor in middle: ab->b, pos=0)" \
    "${_STD}"'function ucs_length(s){var n=0,i;for(i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<0xdc00||c>=0xe000)n++;}return n;}
function dupchar(ch,n){var s="";while(n-->0)s+=ch;return s;}
var prompt="qjs > "; var last_cmd="ab"; var cmd="b";
var last_cursor_pos=1; var cursor_pos=0;
var old_total=ucs_length(prompt)+ucs_length(last_cmd);
std.puts("\r"); std.puts(prompt); std.puts(cmd);
var new_total=ucs_length(prompt)+ucs_length(cmd);
if(old_total>new_total){var pad=old_total-new_total;std.puts(dupchar(" ",pad));std.puts(dupchar("\x08",pad));}
last_cursor_pos=cmd.length;
if(cursor_pos<last_cursor_pos){std.puts(dupchar("\x08",ucs_length(cmd.substring(cursor_pos,last_cursor_pos))));}
std.out.flush();
print("PASS")'

run_test U5 "delete_char_dir logic: cmd substring on backspace" \
    'var cmd="hello"; var cursor_pos=5;
var start=cursor_pos-1; var end=start+1;
cmd=cmd.substring(0,start)+cmd.substring(end);
cursor_pos=start;
if(cmd==="hell" && cursor_pos===4) print("PASS"); else print("FAIL cmd:"+cmd+" pos:"+cursor_pos)'

echo ""

# ---------------------------------------------------------------------------
echo "--- Group L: Large-stack variants of the failing tests ---"
# These repeat the most likely-to-fail tests with 65536 byte stack.
# If they pass here but fail above, it's definitively a stack overflow.
# ---------------------------------------------------------------------------

run_test_large_stack L1 "Recursion depth 200 (large stack)" \
    'function f(n){if(n<=0)return 0;return 1+f(n-1);} try{f(200);print("PASS")}catch(e){print("FAIL: "+e)}'

run_test_large_stack L2 "Full update() sim (large stack)" \
    "${_STD}"'function ucs_length(s){var n=0,i;for(i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<0xdc00||c>=0xe000)n++;}return n;}
function dupchar(ch,n){var s="";while(n-->0)s+=ch;return s;}
var prompt="qjs > "; var last_cmd="hello"; var cmd="hell";
var old_total=ucs_length(prompt)+ucs_length(last_cmd);
std.puts("\r"); std.puts(prompt); std.puts(cmd);
var new_total=ucs_length(prompt)+ucs_length(cmd);
var pad=old_total-new_total; if(pad>0){std.puts(dupchar(" ",pad));std.puts(dupchar("\x08",pad));}
std.out.flush(); print("PASS")'

run_test_large_stack L3 "Nested std.puts 6 deep (large stack)" \
    "${_STD}"'function f6(){std.puts(".");}
function f5(){f6();}
function f4(){std.puts(".");f5();std.puts(".");}
function f3(){f4();}
function f2(){f3();}
function f1(){f2();}
f1(); std.puts("\n"); print("PASS")'

echo ""
echo "======================================================================"
echo "  Results: PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
echo "======================================================================"
echo ""
echo "Interpretation guide:"
echo "  If S2/S3/S4 fail but L1 passes        → stack overflow confirmed"
echo "  If O tests fail                        → fwrite/output is the cause"
echo "  If U tests fail but O tests pass       → bug in update() logic"
echo "  If all pass in vamos but crash Amiberry → stack overflow (4KB CLI limit)"
echo "  If all pass everywhere                 → crash is raw-mode specific (poll interaction)"
