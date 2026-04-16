/* test_buffer.js — Node-style Buffer API regression test.
 *
 * Covers: construction (alloc, allocUnsafe, from variants, concat),
 * string conversion with all supported encodings (utf-8, ascii,
 * latin1, hex, base64), integer read/write for 8/16/32 bit both
 * LE and BE, comparison (equals, compare, Buffer.compare),
 * search (indexOf, includes), fill, copy, subarray / slice,
 * toJSON, and Buffer.byteLength sizing. */

let pass = 0, fail = 0;
function t(label, cond) {
    if (cond) { pass++; print('  ok  ' + label); }
    else      { fail++; print('  FAIL ' + label); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

print('test_buffer: Node Buffer subset');

/* ---- construction ---------------------------------------- */

const a = Buffer.alloc(4);
t('alloc zero-fills',          a[0] === 0 && a[3] === 0 && a.length === 4);

const b = Buffer.alloc(4, 0xAB);
t('alloc with fill byte',      b[0] === 0xAB && b[3] === 0xAB);

const c = Buffer.alloc(4, 'AB', 'utf8');
t('alloc with fill string',    c[0] === 0x41 && c[1] === 0x42 && c[2] === 0x41 && c[3] === 0x42);

const u = Buffer.allocUnsafe(8);
t('allocUnsafe length',        u.length === 8);

const fa = Buffer.from([1, 2, 3, 4]);
t('from array',                fa[0] === 1 && fa[3] === 4 && fa.length === 4);

const fs = Buffer.from('hello', 'utf8');
t('from utf8 string',          fs.length === 5 && fs[0] === 0x68 && fs[4] === 0x6F);

const fh = Buffer.from('deadbeef', 'hex');
t('from hex string',           fh.length === 4 && fh[0] === 0xDE && fh[3] === 0xEF);

const fb64 = Buffer.from('aGVsbG8=', 'base64');
t('from base64 string',        fb64.toString('utf8') === 'hello');

const fab = Buffer.from(new ArrayBuffer(3));
t('from ArrayBuffer',          fab.length === 3);

const fbuf = Buffer.from(fa);
fa[0] = 99;
t('from Buffer copies',        fbuf[0] === 1);

const cat = Buffer.concat([Buffer.from([1, 2]), Buffer.from([3, 4])]);
t('concat',                    eq(Array.from(cat), [1, 2, 3, 4]));

const catTrunc = Buffer.concat([Buffer.from([1, 2, 3]), Buffer.from([4, 5, 6])], 4);
t('concat with totalLength',   eq(Array.from(catTrunc), [1, 2, 3, 4]));

/* ---- string encodings ------------------------------------ */

const hw = Buffer.from('héllo');  /* é = 2 bytes in UTF-8 */
t('utf8 multibyte length',     hw.length === 6);
t('utf8 roundtrip',            hw.toString('utf8') === 'héllo');

const ascii = Buffer.from('héllo', 'ascii');
t('ascii drops high bits',     ascii.length === 5);

const latin = Buffer.from('héllo', 'latin1');
t('latin1 1 byte per char',    latin.length === 5);
t('latin1 roundtrip preserves', latin.toString('latin1') === 'héllo');

const hex = Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]).toString('hex');
t('toString hex',              hex === 'cafebabe');

const b64 = Buffer.from('foobar').toString('base64');
t('toString base64',           b64 === 'Zm9vYmFy');

t('byteLength utf8',           Buffer.byteLength('héllo', 'utf8') === 6);
t('byteLength ascii',          Buffer.byteLength('héllo', 'ascii') === 5);
t('byteLength hex',            Buffer.byteLength('deadbeef', 'hex') === 4);
t('byteLength base64',         Buffer.byteLength('aGVsbG8=', 'base64') === 5);

/* ---- write ----------------------------------------------- */

const wbuf = Buffer.alloc(8);
const wrote = wbuf.write('abc', 2, 'utf8');
t('write returns bytes',       wrote === 3);
t('write stores at offset',    wbuf[2] === 0x61 && wbuf[4] === 0x63);

/* ---- comparison ------------------------------------------ */

t('equals same',               Buffer.from([1, 2, 3]).equals(Buffer.from([1, 2, 3])));
t('equals differ',             !Buffer.from([1, 2, 3]).equals(Buffer.from([1, 2, 4])));
t('equals diff length',        !Buffer.from([1, 2]).equals(Buffer.from([1, 2, 3])));

t('compare less',              Buffer.from([1, 2]).compare(Buffer.from([1, 3])) === -1);
t('compare greater',           Buffer.from([2]).compare(Buffer.from([1, 2])) === 1);
t('compare equal',             Buffer.from([1, 2]).compare(Buffer.from([1, 2])) === 0);

t('Buffer.compare static',     Buffer.compare(Buffer.from([1]), Buffer.from([1, 0])) === -1);

/* ---- search ---------------------------------------------- */

const needle = Buffer.from('hello world');
t('indexOf byte',              needle.indexOf(0x20) === 5);
t('indexOf needle',            needle.indexOf('world') === 6);
t('indexOf miss',              needle.indexOf('xyz') === -1);
t('indexOf with offset',       needle.indexOf(0x6C, 5) === 9);
t('includes hit',              needle.includes('hello'));
t('includes miss',             !needle.includes('xyz'));

/* ---- fill & copy ----------------------------------------- */

const fill1 = Buffer.alloc(5).fill(0xFF);
t('fill byte',                 fill1.every(v => v === 0xFF));

const fill2 = Buffer.alloc(6).fill('ab');
t('fill string repeats',       fill2[0] === 0x61 && fill2[1] === 0x62 && fill2[4] === 0x61);

const src = Buffer.from([1, 2, 3, 4, 5]);
const dst = Buffer.alloc(5);
const n = src.copy(dst, 1, 1, 4);
t('copy returns bytes',        n === 3);
t('copy places bytes',         eq(Array.from(dst), [0, 2, 3, 4, 0]));

/* ---- subarray / slice ------------------------------------ */

const sliced = Buffer.from([10, 20, 30, 40, 50]).subarray(1, 4);
t('subarray length',           sliced.length === 3);
t('subarray content',          eq(Array.from(sliced), [20, 30, 40]));
t('slice alias',               Buffer.from([1, 2, 3]).slice(0, 2).length === 2);

/* subarray shares memory (Node semantics) */
const parent = Buffer.from([1, 2, 3]);
const kid = parent.subarray(0, 2);
kid[0] = 99;
t('subarray shares memory',    parent[0] === 99);

/* ---- integer reads / writes ------------------------------ */

const iw = Buffer.alloc(12);
iw.writeUInt8(0xAB, 0);
t('writeUInt8/readUInt8',      iw.readUInt8(0) === 0xAB);

iw.writeUInt16LE(0x1234, 0);
t('16LE roundtrip',            iw.readUInt16LE(0) === 0x1234);
iw.writeUInt16BE(0x1234, 2);
t('16BE roundtrip',            iw.readUInt16BE(2) === 0x1234);
t('16BE byte order',           iw[2] === 0x12 && iw[3] === 0x34);

iw.writeInt16LE(-1, 4);
t('Int16 sign roundtrip',      iw.readInt16LE(4) === -1);

iw.writeUInt32LE(0xDEADBEEF, 0);
t('32LE roundtrip',            iw.readUInt32LE(0) === 0xDEADBEEF);
iw.writeUInt32BE(0xDEADBEEF, 4);
t('32BE roundtrip',            iw.readUInt32BE(4) === 0xDEADBEEF);
t('32BE byte order',           iw[4] === 0xDE && iw[7] === 0xEF);

iw.writeInt32LE(-1, 0);
t('Int32 sign roundtrip',      iw.readInt32LE(0) === -1);

/* ---- misc ------------------------------------------------ */

t('isBuffer true',             Buffer.isBuffer(Buffer.alloc(1)));
t('isBuffer false array',      !Buffer.isBuffer([1, 2, 3]));
t('isBuffer false uint8',      !Buffer.isBuffer(new Uint8Array(4)));

const js = Buffer.from([1, 2, 3]).toJSON();
t('toJSON shape',              js.type === 'Buffer' && eq(js.data, [1, 2, 3]));

/* ---- error cases ----------------------------------------- */

let threw = false;
try { Buffer.from('x', 'not-a-real-encoding'); } catch (e) { threw = true; }
t('unknown encoding throws',   threw);

print('test_buffer: ' + pass + ' pass / ' + fail + ' fail');
