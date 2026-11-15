/* test_qjsb.js - bytecode files (LIBS:quickjs/*.qjsb) and add-ons.
 *
 * Run:  qjs amiga/tests/test_qjsb.js
 *
 * Since 0.240 the JavaScript delivered with quickjs.library lives in
 * LIBS:quickjs/extended.qjsb, amiga.qjsb and reaction.qjsb, and
 * add-ons are further .qjsb files (docs/QJSB-FORMAT.md,
 * docs/ADDONS.md). This test checks that
 *
 *   - the three files are found and their contents load on first use;
 *   - an add-on's modules can be imported: the test add-on
 *     amiga/tests/addons/hello.qjsb, built on the Mac by
 *     `make -C library/vbcc qjsb` from amiga/tests/addons/hello/;
 *   - a file that is damaged, cut off, not a .qjsb file, or built for
 *     another library or engine is refused with an error that can be
 *     caught and that names the file (and both versions), and that the
 *     name that needed it works once the right file is back.
 *
 * The bad files are made here, as altered copies of hello.qjsb and of
 * the installed extended.qjsb, in T:qjsbtest/, which the local
 * variable QJSB_DIR then names: that directory is searched before
 * LIBS:quickjs/. They are removed at the end.
 *
 * Needs the add-on directory beside this script (addons/hello.qjsb).
 * Prints one PASS or FAIL line per check and a final count.
 */
import * as std from 'qjs:std';
import * as os from 'qjs:os';

let passed = 0;
let failed = 0;

/**
 * Record one check.
 * @param {string} label what was checked
 * @param {boolean} ok whether it held
 * @param {*} [detail] shown after a failure
 * @returns {void}
 */
function check(label, ok, detail) {
    if (ok) {
        passed++;
        print('PASS ' + label);
    } else {
        failed++;
        print('FAIL ' + label + (detail === undefined ? '' : ' (' + detail + ')'));
    }
}

/* Offsets in a .qjsb header; see docs/QJSB-FORMAT.md. */
const H_FLAGS        = 6;    /* check-constants: skip - .qjsb layout, not an OS value */
const H_BUILT_FOR    = 10;   /* check-constants: skip */
const H_ENGINE_STAMP = 12;   /* check-constants: skip */
const H_INDEX_SIZE   = 20;   /* check-constants: skip */
const H_CHECK        = 28;   /* check-constants: skip */
const H_VERSION_TEXT = 32;   /* check-constants: skip */
const VERSION_TEXT_SIZE = 96;   /* check-constants: skip */
const HEADER_SIZE    = 128;  /* check-constants: skip */
const FLAG_EXACT     = 1;    /* check-constants: skip */

const SCRATCH = 'T:qjsbtest';

/**
 * Read a whole file.
 * @param {string} path AmigaDOS path
 * @returns {ArrayBuffer|null} its bytes, or null if it cannot be opened
 */
function readBytes(path) {
    const file = std.open(path, 'rb');

    if (!file) return null;

    file.seek(0, std.SEEK_END);

    const size = file.tell();
    const bytes = new ArrayBuffer(size);

    file.seek(0, std.SEEK_SET);
    file.read(bytes, 0, size);
    file.close();

    return bytes;
}

/**
 * Write a whole file, replacing any existing one.
 * @param {string} path AmigaDOS path
 * @param {ArrayBuffer} bytes file contents
 * @returns {boolean} true when the file was written
 */
function writeBytes(path, bytes) {
    const file = std.open(path, 'wb');

    if (!file) return false;

    file.write(bytes, 0, bytes.byteLength);
    file.close();

    return true;
}

/**
 * The check of the .qjsb format: big-endian 32-bit words, the last
 * padded with zeros; per word, rotate the sum left one bit and add.
 * @param {Uint8Array} bytes what to check
 * @returns {number} the check, as an unsigned 32-bit number
 */
function qjsbCheck(bytes) {
    let sum = 0;

    for (let at = 0; at < bytes.length; at += 4) {
        const word = (((bytes[at] << 24) | ((bytes[at + 1] || 0) << 16) |
                       ((bytes[at + 2] || 0) << 8) | (bytes[at + 3] || 0)) >>> 0);

        sum = ((((sum << 1) | (sum >>> 31)) >>> 0) + word) >>> 0;
    }

    return sum;
}

/**
 * A copy of a .qjsb file with its header changed and the header's
 * check made right again, so that only the change is wrong with it.
 * @param {ArrayBuffer} original a good file
 * @param {function(DataView): void} change alters the header
 * @returns {ArrayBuffer} the altered file
 */
function withHeader(original, change) {
    const copy = original.slice(0);
    const view = new DataView(copy);

    change(view);
    view.setUint32(H_CHECK, 0);

    const covered = HEADER_SIZE + view.getUint32(H_INDEX_SIZE);

    view.setUint32(H_CHECK, qjsbCheck(new Uint8Array(copy, 0, covered)));

    return copy;
}

/**
 * Import a module and report what came of it.
 * @param {string} specifier what to import
 * @returns {Promise<{module: object|null, error: Error|null}>}
 */
async function tryImport(specifier) {
    try {
        return { module: await import(specifier), error: null };
    } catch (error) {
        return { module: null, error };
    }
}

/**
 * Check that importing a module fails with a message holding every
 * given piece of text.
 * @param {string} label what is being checked
 * @param {string} specifier what to import
 * @param {Array<string>} pieces texts the message must contain
 * @returns {Promise<void>}
 */
async function expectRefusal(label, specifier, pieces) {
    const { module, error } = await tryImport(specifier);
    const message = error ? String(error.message) : '';
    const missing = pieces.filter((piece) => !message.includes(piece));

    check(label, module === null && error instanceof Error && missing.length === 0,
          error ? message : 'the import succeeded');
}

/* ---- where things are ---- */

const scriptPath = (typeof scriptArgs !== 'undefined' && scriptArgs[0]) || '';
const cut = Math.max(scriptPath.lastIndexOf('/'), scriptPath.lastIndexOf(':'));
const addonDir = scriptPath.substring(0, cut + 1) + 'addons';
const hello = readBytes(addonDir + '/hello.qjsb');

check('the test add-on is beside this script (' + addonDir + '/hello.qjsb)',
      hello !== null,
      'build it on the Mac: make -C library/vbcc qjsb');

/* ---- 1. the library's own files ---- */

check('URL comes from extended.qjsb',
      typeof URL === 'function' && new URL('http://a.example/b?c=1').searchParams.get('c') === '1');
check('the feature registry comes from extended.qjsb',
      qjs.modules.list().length > 20 && qjs.modules.get('url').applied === true);
check('several features load in one go (fetch-abort needs abort and event-target)',
      qjs.modules.apply('fetch-abort') === true && typeof AbortController === 'function' &&
      typeof EventTarget === 'function');
check('Exec comes from amiga.qjsb', typeof Exec === 'function');
check('amiga.boopsi comes from reaction.qjsb',
      typeof amiga.boopsi === 'object' && amiga.boopsi !== null);

/* ---- 2. an add-on ---- */

if (hello !== null) {
    std.setenv('QJSB_DIR', addonDir);

    const main = await tryImport('qjs:hello');

    check("import 'qjs:hello' gives the add-on's main module",
          main.module !== null && main.module.greet('amiga') === 'HELLO, AMIGA' &&
          main.module.default.name === 'hello',
          main.error && main.error.message);
    check('the module knows the name it was imported under',
          main.module !== null && main.module.metaUrl === 'qjs:hello',
          main.module && main.module.metaUrl);

    const util = await tryImport('hello:util');

    check("import 'hello:util' gives its second module",
          util.module !== null && util.module.shout('abc') === 'ABC',
          util.error && util.error.message);
    check('both importers share one instance of it',
          main.module !== null && util.module !== null &&
          util.module.bump() === 1 && main.module.bumpViaMain() === 2 &&
          util.module.bump() === 3);

    const again = await tryImport('qjs:hello');

    check('a second import is the same module', again.module === main.module);

    await expectRefusal('a module the add-on does not have is refused',
                        'hello:nosuch', ['hello.qjsb', 'nosuch']);
    await expectRefusal('qjs:<name> without such an add-on is refused',
                        'qjs:nosuchaddon', ['qjs:nosuchaddon', 'nosuchaddon.qjsb']);

    /* a real path with a volume still loads as a file */
    const plain = std.open('T:qjsbplain.js', 'w');

    plain.puts('export const answer = 42;\n');
    plain.close();

    const file = await tryImport('T:qjsbplain.js');

    check('a path with a volume name is still a file',
          file.module !== null && file.module.answer === 42,
          file.error && file.error.message);
    os.remove('T:qjsbplain.js');
}

/* ---- 3. files that must be refused ---- */

if (hello !== null) {
    const text = (version) => Math.floor(version / 1000) + '.' +
                              String(version % 1000).padStart(3, '0');

    os.mkdir(SCRATCH);
    std.setenv('QJSB_DIR', SCRATCH);

    /* a good copy under another name: found, but its modules were
     * compiled as hello:..., so the engine could not know them */
    writeBytes(SCRATCH + '/renamed.qjsb', hello);
    await expectRefusal('a renamed add-on is refused',
                        'renamed:util', ['renamed.qjsb', 'hello:util']);

    writeBytes(SCRATCH + '/tooNew.qjsb', withHeader(hello, (view) => {
        view.setUint16(H_BUILT_FOR, 999);
    }));
    await expectRefusal('an add-on needing a newer library is refused',
                        'tooNew:util', ['tooNew.qjsb', '0.999', 'or newer']);

    writeBytes(SCRATCH + '/exact.qjsb', withHeader(hello, (view) => {
        view.setUint16(H_FLAGS, FLAG_EXACT);
        view.setUint16(H_BUILT_FOR, 7);
    }));
    await expectRefusal('a file for exactly another library version is refused',
                        'exact:util', ['exact.qjsb', 'built for quickjs.library 0.007',
                                       'this is quickjs.library ']);

    writeBytes(SCRATCH + '/engine.qjsb', withHeader(hello, (view) => {
        view.setUint32(H_ENGINE_STAMP, 0x12345678);
    }));
    await expectRefusal('a file for another bytecode format is refused',
                        'engine:util', ['engine.qjsb', '12345678', 'bytecode']);

    /* the header's text is covered by the check too */
    const edited = hello.slice(0);

    new Uint8Array(edited)[H_VERSION_TEXT + 6] = 'X'.charCodeAt(0);
    writeBytes(SCRATCH + '/edited.qjsb', edited);
    await expectRefusal('a header changed without its check is refused',
                        'edited:util', ['edited.qjsb', 'damaged']);

    const flipped = hello.slice(0);

    new Uint8Array(flipped)[flipped.byteLength - 8] ^= 0x40;
    writeBytes(SCRATCH + '/flipped.qjsb', flipped);
    await expectRefusal('a damaged module is refused',
                        'flipped:util', ['flipped.qjsb', 'damaged']);

    writeBytes(SCRATCH + '/short.qjsb', hello.slice(0, hello.byteLength - 40));
    await expectRefusal('a file that is cut off is refused',
                        'short:util', ['short.qjsb', 'damaged']);

    const junk = std.open(SCRATCH + '/junk.qjsb', 'w');

    junk.puts('This is not bytecode. '.repeat(20));
    junk.close();
    await expectRefusal('a file that is not a .qjsb file is refused',
                        'junk:util', ['junk.qjsb', 'not a QuickJS bytecode']);

    /* ---- 4. one of the library's own files, wrong and then right ---- */

    const extended = readBytes('LIBS:quickjs/extended.qjsb');

    if (extended === null) {
        check('LIBS:quickjs/extended.qjsb can be read', false);
    } else {
        /* the text C:Version prints: "$VER: extended.qjsb 0.240 (14.11.2026)" */
        const versionText = String.fromCharCode(
            ...new Uint8Array(extended, H_VERSION_TEXT, VERSION_TEXT_SIZE)).split('\0')[0];
        const number = new DataView(extended).getUint16(H_BUILT_FOR);

        check('the file carries an AmigaDOS version string (' + versionText + ')',
              /^\$VER: extended\.qjsb \d+\.\d+ \(\d+\.\d+\.\d+\)$/.test(versionText));
        check('its text and its binary version field agree',
              versionText.includes(' ' + text(number) + ' '), text(number));

        writeBytes(SCRATCH + '/extended.qjsb', withHeader(extended, (view) => {
            view.setUint16(H_BUILT_FOR, view.getUint16(H_BUILT_FOR) + 1);
        }));

        let caught = null;

        try {
            /* Buffer has not been used yet in this script */
            void Buffer;
        } catch (error) {
            caught = error;
        }

        const own = new DataView(extended).getUint16(H_BUILT_FOR);
        const message = caught ? String(caught.message) : '';

        check('a feature whose file is of another version throws an error',
              caught instanceof Error, 'nothing was thrown');
        check('the error names the file and both versions',
              message.includes('extended.qjsb') && message.includes(text(own + 1)) &&
              message.includes(text(own)), message);

        os.remove(SCRATCH + '/extended.qjsb');

        let recovered = false;

        try {
            recovered = typeof Buffer === 'function' && Buffer.from('ok').toString() === 'ok';
        } catch (error) {
            recovered = false;
        }

        check('the same name works once the right file is found', recovered);
    }

    for (const name of ['renamed', 'tooNew', 'exact', 'engine', 'edited',
                        'flipped', 'short', 'junk']) {
        os.remove(SCRATCH + '/' + name + '.qjsb');
    }
    os.remove(SCRATCH);
    std.unsetenv('QJSB_DIR');
}

print('');
print(passed + ' passed, ' + failed + ' failed');
