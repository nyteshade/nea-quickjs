/* T14 - Check NO_COLOR and show_colors state.
 * This verifies that our getenv override is working.
 */
var nc = std.getenv("NO_COLOR");
print("NO_COLOR env = " + JSON.stringify(nc));
print("type = " + typeof nc);
if (nc && +nc[0] !== 0) {
    print("show_colors would be FALSE (good)");
} else {
    print("show_colors would be TRUE (BAD!)");
    print("This means the REPL uses VT100 CSI");
    print("sequences which crash the console.");
}
