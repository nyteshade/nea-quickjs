/* T8 - Event loop with printable output only.
 * Press any key 3 times. Ctrl-C to exit early.
 * Expected: prints "key1 key2 key3" then exits.
 */
import * as std from "qjs:std";
import * as os from "qjs:os";

os.ttySetRaw(0);
var buf = new Uint8Array(8);
var count = 0;

os.setReadHandler(0, function () {
    os.read(0, buf.buffer, 0, 8);
    count++;
    std.puts("key" + count + " ");
    std.out.flush();
    if (count >= 3 || buf[0] === 3) {
        os.setReadHandler(0, null);
        std.puts("\r\n");
        std.out.flush();
    }
});
