/* T9 - Event loop with \r in output.
 * Press any key 3 times. Ctrl-C to exit early.
 * Each keypress overwrites the line from column 0.
 * Expected: line changes to "key1", "key2", "key3".
 */
import * as std from "qjs:std";
import * as os from "qjs:os";

os.ttySetRaw(0);
var buf = new Uint8Array(8);
var count = 0;

os.setReadHandler(0, function () {
    os.read(0, buf.buffer, 0, 8);
    count++;
    std.puts("\rkey" + count + "  ");
    std.out.flush();
    if (count >= 3 || buf[0] === 3) {
        os.setReadHandler(0, null);
        std.puts("\r\n");
        std.out.flush();
    }
});
