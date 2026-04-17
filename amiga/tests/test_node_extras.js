/*
 * test_node_extras.js -- Regression test for 0.099 additions.
 *
 * Covers: util.parseArgs/deprecate/debuglog, EventEmitter.once (static),
 * stream.pipeline, querystring, StringDecoder, console.count/timeLog,
 * fs.promises.copyFile/truncate, Buffer.swap16/32 + Float read/write.
 */

import * as std from 'qjs:std';

let pass = 0, fail = 0;
function ok(cond, msg) {
    if (cond) { print("  PASS: " + msg); pass++; }
    else      { print("  FAIL: " + msg); fail++; }
}

print("=== Node extras (0.099) smoke test ===");

(async () => {
    /* -------- util.parseArgs -------- */
    try {
        const r = util.parseArgs({
            args: ['--name', 'alice', '-v', '--flag', 'positional1'],
            options: {
                name: { type: 'string' },
                verbose: { type: 'boolean', short: 'v' },
                flag: { type: 'boolean' },
            },
            allowPositionals: true,
        });
        ok(r.values.name === 'alice',     "parseArgs --name");
        ok(r.values.verbose === true,     "parseArgs -v short alias");
        ok(r.values.flag === true,        "parseArgs --flag bool");
        ok(r.positionals.length === 1,    "parseArgs one positional");
        ok(r.positionals[0] === 'positional1', "parseArgs positional value");

        const r2 = util.parseArgs({
            args: ['--host=example.com'],
            options: { host: { type: 'string' } },
        });
        ok(r2.values.host === 'example.com', "parseArgs --key=value");
    } catch (e) { print("  FAIL: parseArgs threw " + e); fail += 3; }

    /* -------- util.deprecate -------- */
    try {
        const fn = util.deprecate((x) => x * 2, 'test-dep');
        ok(fn(5) === 10, "deprecate wrapper returns value");
    } catch (e) { print("  FAIL: deprecate " + e); fail++; }

    /* -------- util.debuglog -------- */
    try {
        const log = util.debuglog('myproto');
        log('hello');
        ok(typeof log === 'function', "debuglog returns function");
    } catch (e) { print("  FAIL: debuglog " + e); fail++; }

    /* -------- EventEmitter.once (static) -------- */
    try {
        const ee = new EventEmitter();
        setTimeout(() => ee.emit('ready', 42, 'foo'), 0);
        const [a, b] = await EventEmitter.once(ee, 'ready');
        ok(a === 42 && b === 'foo', "EventEmitter.once resolves with args");
    } catch (e) { print("  FAIL: EventEmitter.once " + e); fail++; }

    /* -------- stream.pipeline -------- */
    try {
        const { Readable, Writable, pipeline } = globalThis.stream;
        const got = [];
        const src = Readable.from(['x', 'y', 'z']);
        const sink = new Writable({ write(c, cb) { got.push(c); cb(); } });
        await pipeline(src, sink);
        ok(got.join('') === 'xyz', "stream.pipeline runs chain");
    } catch (e) { print("  FAIL: pipeline " + e); fail++; }

    /* -------- querystring -------- */
    try {
        const parsed = querystring.parse('a=1&b=two+words&a=2');
        ok(Array.isArray(parsed.a) && parsed.a[0] === '1' && parsed.a[1] === '2',
           "querystring.parse multi-value");
        ok(parsed.b === 'two words', "querystring.parse decodes + as space");

        const str = querystring.stringify({ a: [1, 2], b: 'hi there' });
        ok(str === 'a=1&a=2&b=hi+there', "querystring.stringify: " + str);
    } catch (e) { print("  FAIL: querystring " + e); fail += 3; }

    /* -------- StringDecoder -------- */
    try {
        const sd = new StringDecoder('utf-8');
        const s1 = sd.write(new Uint8Array([0x48, 0x65, 0x6c]));   /* "Hel" */
        const s2 = sd.write(new Uint8Array([0x6c, 0x6f]));          /* "lo" */
        const end = sd.end();
        ok((s1 + s2 + end) === 'Hello', "StringDecoder incremental decode");

        const sd2 = new StringDecoder('utf-8');
        /* 0xC3 0xA9 is 'é' — split across two writes */
        const p1 = sd2.write(new Uint8Array([0xC3]));
        const p2 = sd2.write(new Uint8Array([0xA9]));
        ok((p1 + p2) === 'é', "StringDecoder handles partial multibyte");
    } catch (e) { print("  FAIL: StringDecoder " + e); fail += 2; }

    /* -------- console extensions -------- */
    try {
        console.time('t1');
        console.timeLog('t1');
        console.timeEnd('t1');
        console.count('x');
        console.count('x');
        console.countReset('x');
        ok(true, "console.timeLog/count/countReset don't throw");
    } catch (e) { print("  FAIL: console extras " + e); fail++; }

    /* -------- Buffer extensions -------- */
    try {
        const b = Buffer.from([0x01, 0x02, 0x03, 0x04]);
        b.swap16();
        ok(b[0] === 0x02 && b[1] === 0x01 && b[2] === 0x04 && b[3] === 0x03,
           "Buffer.swap16");

        const c = Buffer.from([0x01, 0x02, 0x03, 0x04]);
        c.swap32();
        ok(c[0] === 0x04 && c[1] === 0x03 && c[2] === 0x02 && c[3] === 0x01,
           "Buffer.swap32");

        try {
            Buffer.from([1, 2, 3]).swap16();
            ok(false, "swap16 on odd-length should throw");
        } catch (_) { ok(true, "swap16 throws on odd length"); }

        const f = Buffer.alloc(8);
        f.writeFloatLE(1.5, 0);
        ok(Math.abs(f.readFloatLE(0) - 1.5) < 1e-6, "Buffer.readFloatLE/writeFloatLE");

        f.writeDoubleLE(3.14159265358979, 0);
        ok(Math.abs(f.readDoubleLE(0) - 3.14159265358979) < 1e-12,
           "Buffer.readDoubleLE/writeDoubleLE");
    } catch (e) { print("  FAIL: Buffer extras " + e); fail += 4; }

    /* -------- fs.promises extensions -------- */
    try {
        await fs.promises.writeFile('T:qjs-test-src', 'hello world');
        await fs.promises.copyFile('T:qjs-test-src', 'T:qjs-test-dest');
        const content = await fs.promises.readFile('T:qjs-test-dest', 'utf8');
        ok(content === 'hello world', "fs.promises.copyFile");
        await fs.promises.unlink('T:qjs-test-src');
        await fs.promises.unlink('T:qjs-test-dest');
    } catch (e) { print("  FAIL: copyFile " + e); fail++; }

    try {
        await fs.promises.writeFile('T:qjs-test-truncate', 'abcdefghij');
        await fs.promises.truncate('T:qjs-test-truncate', 5);
        const content = await fs.promises.readFile('T:qjs-test-truncate', 'utf8');
        ok(content === 'abcde', "fs.promises.truncate: " + content);
        await fs.promises.unlink('T:qjs-test-truncate');
    } catch (e) { print("  FAIL: truncate " + e); fail++; }

    try {
        ok(typeof fs.constants === 'object', "fs.constants exists");
        ok(fs.constants.F_OK === 0, "fs.constants.F_OK");
    } catch (e) { print("  FAIL: fs.constants " + e); fail++; }

    print("");
    print("=== Results: " + pass + " passed, " + fail + " failed ===");
    if (fail > 0) std.exit(1);
})();
