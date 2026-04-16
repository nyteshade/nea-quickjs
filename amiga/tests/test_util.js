/* test_util.js — util regression test. */

let pass = 0, fail = 0;
function t(label, cond) {
    if (cond) { pass++; print('  ok  ' + label); }
    else      { fail++; print('  FAIL ' + label); }
}

print('test_util: util subset');

/* ---- format ---------------------------------------------- */

t('format plain string',    util.format('hello') === 'hello');
t('format %s',              util.format('hi %s', 'world') === 'hi world');
t('format %d',              util.format('%d + %d', 2, 3) === '2 + 3');
t('format %j',              util.format('%j', { a: 1 }) === '{"a":1}');
t('format %%',              util.format('50%% off') === '50% off');
t('format extra args',      util.format('%s', 'a', 'b', 'c') === 'a b c');
t('format non-string first', typeof util.format({ a: 1 }) === 'string');

/* ---- inspect primitives --------------------------------- */

t('inspect null',           util.inspect(null) === 'null');
t('inspect undefined',      util.inspect(undefined) === 'undefined');
t('inspect number',         util.inspect(42) === '42');
t('inspect boolean',        util.inspect(true) === 'true');
t('inspect string quoted',  util.inspect('hi') === "'hi'");
t('inspect string escapes', util.inspect("a'b") === "'a\\'b'");

/* ---- inspect composites --------------------------------- */

t('inspect empty array',    util.inspect([]) === '[]');
t('inspect array',          util.inspect([1, 2, 3]) === '[ 1, 2, 3 ]');
t('inspect empty object',   util.inspect({}) === '{}');
t('inspect object',         util.inspect({ a: 1 }) === '{ a: 1 }');
t('inspect nested',         util.inspect({ a: [1, 2] }) === '{ a: [ 1, 2 ] }');
t('inspect quoted key',     util.inspect({ 'weird key': 1 }) === '{ "weird key": 1 }');
t('inspect regex',          util.inspect(/foo/g) === '/foo/g');

/* ---- promisify ------------------------------------------- */

/* Node-style callback: fn(...args, (err, result) => ...) */
function asyncAdd(a, b, cb) {
    Promise.resolve().then(() => cb(null, a + b));
}
async function runPromisify() {
    const pAdd = util.promisify(asyncAdd);
    const r = await pAdd(3, 4);
    t('promisify resolves',    r === 7);

    /* Error path */
    function asyncFail(cb) { cb(new Error('boom')); }
    const pFail = util.promisify(asyncFail);
    try { await pFail(); t('promisify rejects', false); }
    catch (e) { t('promisify rejects', e.message === 'boom'); }
}

/* ---- callbackify ---------------------------------------- */

async function runCallbackify() {
    const cbAdd = util.callbackify((a, b) => Promise.resolve(a + b));
    await new Promise((resolve) => {
        cbAdd(2, 3, (err, r) => {
            t('callbackify result',  err == null && r === 5);
            resolve();
        });
    });

    const cbFail = util.callbackify(() => Promise.reject(new Error('nope')));
    await new Promise((resolve) => {
        cbFail((err, r) => {
            t('callbackify error', err && err.message === 'nope');
            resolve();
        });
    });
}

/* ---- types ----------------------------------------------- */

t('types.isArray',          util.types.isArray([]));
t('types.isDate',           util.types.isDate(new Date()));
t('types.isRegExp',         util.types.isRegExp(/x/));
t('types.isError',          util.types.isError(new Error()));
t('types.isPromise',        util.types.isPromise(Promise.resolve()));
t('types.isMap',            util.types.isMap(new Map()));
t('types.isSet',            util.types.isSet(new Set()));
t('types.isUint8Array',     util.types.isUint8Array(new Uint8Array()));
t('types.isTypedArray',     util.types.isTypedArray(new Int16Array()));
t('types.isArrayBuffer',    util.types.isArrayBuffer(new ArrayBuffer(1)));
t('types.isFunction',       util.types.isFunction(() => 0));

/* Promise chain: run async tests then print summary. */
Promise.resolve()
    .then(runPromisify)
    .then(runCallbackify)
    .then(() => print('test_util: ' + pass + ' pass / ' + fail + ' fail'));
