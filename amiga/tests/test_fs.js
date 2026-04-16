/* test_fs.js — fs.promises regression test.
 *
 * Uses T: (temp assign on AmigaOS, /tmp-equivalent) for file I/O.
 * On host qjs, T: isn't mapped — test reports skipped if the
 * working dir isn't writable. */

let pass = 0, fail = 0;
function t(label, cond) {
    if (cond) { pass++; print('  ok  ' + label); }
    else      { fail++; print('  FAIL ' + label); }
}

print('test_fs: fs.promises subset');

/* Pick a writable temp path. On AmigaOS T: is the standard.
 * On host qjs it won't exist so the tests should fail cleanly
 * but the suite still validates the API surface. */
const TMP = 'T:' + 'qjs_fs_' + Math.floor(Math.random() * 1000000);
const FILE = TMP + '_file.txt';

async function run() {
    /* ---- API shape ---------------------------------------- */
    t('fs global exists',            typeof fs === 'object');
    t('fs.promises exists',          typeof fs.promises === 'object');
    t('fsPromises mirror',           fs.promises === fsPromises);
    t('writeFile is function',       typeof fs.promises.writeFile === 'function');
    t('readFile is function',        typeof fs.promises.readFile === 'function');
    t('stat is function',            typeof fs.promises.stat === 'function');
    t('unlink is function',          typeof fs.promises.unlink === 'function');

    /* ---- round-trip via writeFile + readFile ------------- */
    const body = 'hello, amiga\n';
    try {
        await fs.promises.writeFile(FILE, body);
        t('writeFile resolves',      true);
    } catch (e) {
        t('writeFile resolves (skipped: ' + (e.message||e) + ')', false);
        print('test_fs: ' + pass + ' pass / ' + fail + ' fail');
        return;
    }

    try {
        const buf = await fs.promises.readFile(FILE);
        t('readFile returns Buffer',  buf instanceof Uint8Array);
        t('readFile bytes match',     buf.length === body.length);

        const text = await fs.promises.readFile(FILE, 'utf8');
        t('readFile utf8 matches',    text === body);
    } catch (e) {
        t('readFile (exception): ' + (e.message||e), false);
    }

    try {
        const st = await fs.promises.stat(FILE);
        t('stat returns object',      typeof st === 'object');
        t('stat.size correct',        st.size === body.length);
        t('stat.isFile() true',       typeof st.isFile === 'function' && st.isFile());
        t('stat.isDirectory() false', !st.isDirectory());
    } catch (e) {
        t('stat (exception): ' + (e.message||e), false);
    }

    /* ---- appendFile --------------------------------------- */
    try {
        await fs.promises.appendFile(FILE, 'appended\n');
        const text = await fs.promises.readFile(FILE, 'utf8');
        t('appendFile appends',       text === body + 'appended\n');
    } catch (e) {
        t('appendFile (exception): ' + (e.message||e), false);
    }

    /* ---- access ------------------------------------------- */
    try {
        await fs.promises.access(FILE);
        t('access resolves for existing', true);
    } catch (e) {
        t('access resolves for existing (failed: ' + (e.message||e) + ')', false);
    }

    let rejected = false;
    try { await fs.promises.access(FILE + '.nosuch'); }
    catch (_) { rejected = true; }
    t('access rejects for missing',   rejected);

    /* ---- unlink ------------------------------------------- */
    try {
        await fs.promises.unlink(FILE);
        t('unlink resolves',           true);
    } catch (e) {
        t('unlink (exception): ' + (e.message||e), false);
    }

    let gone = false;
    try { await fs.promises.stat(FILE); }
    catch (_) { gone = true; }
    t('stat fails after unlink',      gone);

    print('test_fs: ' + pass + ' pass / ' + fail + ' fail');
}

run().catch(err => {
    print('test_fs: unexpected rejection: ' + (err && err.message || err));
    print('test_fs: ' + pass + ' pass / ' + fail + ' fail');
});
