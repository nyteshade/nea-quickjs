/* test_dynamic_import.js - import() and import.meta.
 *
 * Run:  qjs amiga/tests/test_dynamic_import.js
 *
 * Until 0.231 every import() was rejected with "no function filename
 * for import()" and import.meta was empty in the file given on the
 * command line. This test writes a small tree of modules under T:,
 * imports them every way a script can, and removes them again.
 *
 *   T:qjsdi_root.js          imports ./qjsdi/a.js (a file at a volume root)
 *   T:qjsdi/a.js             a leaf module; reports its import.meta
 *   T:qjsdi/sub/b.js         imports ../a.js statically, ./c.js dynamically
 *   T:qjsdi/sub/c.js         imports ./b.js (a module importing a module)
 *   T:qjsdi/circ1.js, circ2.js   import each other
 *   T:qjsdi/data.json        a JSON module
 *   T:qjsdi/classic.js       a classic script that calls import()
 *
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

/**
 * Write a text file, replacing any existing one.
 * @param {string} path AmigaDOS path
 * @param {string} text file contents
 * @returns {boolean} true when the file was written
 */
function writeFile(path, text) {
    const file = std.open(path, 'w');
    if (!file)
        return false;
    file.puts(text);
    file.close();
    return true;
}

/**
 * The outcome of a promise that is expected to be rejected.
 * @param {Promise<*>} promise the promise to wait for
 * @returns {Promise<Error|null>} the rejection, or null if it resolved
 */
async function rejection(promise) {
    try {
        await promise;
        return null;
    } catch (error) {
        return error;
    }
}

const DIR = 'T:qjsdi';
const FILES = [
    'T:qjsdi_root.js',
    DIR + '/a.js',
    DIR + '/sub/b.js',
    DIR + '/sub/c.js',
    DIR + '/circ1.js',
    DIR + '/circ2.js',
    DIR + '/data.json',
    DIR + '/classic.js',
    DIR + '/broken.js',
];

/**
 * Remove everything this test creates. Safe to call when nothing exists.
 * @returns {void}
 */
function cleanUp() {
    for (const path of FILES)
        os.remove(path);
    os.remove(DIR + '/sub');
    os.remove(DIR);
}

cleanUp();
os.mkdir(DIR);
os.mkdir(DIR + '/sub');

let written = true;
written = writeFile('T:qjsdi_root.js',
    "import { a } from './qjsdi/a.js';\n" +
    "export const fromRoot = a;\n" +
    "export const later = () => import('./qjsdi/a.js');\n") && written;
written = writeFile(DIR + '/a.js',
    "globalThis.__qjsdi_a_runs = (globalThis.__qjsdi_a_runs || 0) + 1;\n" +
    "export const a = 1;\n" +
    "export const url = import.meta.url;\n" +
    "export const main = import.meta.main;\n") && written;
written = writeFile(DIR + '/sub/b.js',
    "import { a } from '../a.js';\n" +
    "export const b = a + 1;\n" +
    "export const loadC = () => import('./c.js');\n" +
    "export const loadA = () => import('../a.js');\n" +
    "export const url = import.meta.url;\n") && written;
written = writeFile(DIR + '/sub/c.js',
    "import { b } from './b.js';\n" +
    "export const c = b + 1;\n") && written;
written = writeFile(DIR + '/circ1.js',
    "import { two } from './circ2.js';\n" +
    "export function one() { return 1; }\n" +
    "export function three() { return one() + two(); }\n") && written;
written = writeFile(DIR + '/circ2.js',
    "import { one } from './circ1.js';\n" +
    "export function two() { return one() + 1; }\n") && written;
written = writeFile(DIR + '/data.json',
    '{ "name": "amiga", "list": [1, 2, 3] }\n') && written;
written = writeFile(DIR + '/classic.js',
    "globalThis.__qjsdi_classic = import('./a.js');\n") && written;
written = writeFile(DIR + '/broken.js',
    "export const x = ;\n") && written;

check('module files written to T:', written);

if (written) {
    /* --- import.meta of this file, the main module --- */
    check('import.meta.main is true in the main module',
          import.meta.main === true, String(import.meta.main));
    check('import.meta.url of the main module is a file: URL naming this file',
          typeof import.meta.url === 'string' &&
          import.meta.url.startsWith('file://') &&
          import.meta.url.endsWith('test_dynamic_import.js'),
          String(import.meta.url));

    /* --- an AmigaOS path, from a module --- */
    const a = await import('T:qjsdi/a.js');
    check('import() of Volume:dir/file.js resolves', a.a === 1);
    check('imported module: import.meta.main is false', a.main === false,
          String(a.main));
    check('imported module: import.meta.url is file:/// + full path',
          typeof a.url === 'string' && a.url.startsWith('file:///') &&
          a.url.endsWith('qjsdi/a.js') && a.url.includes(':', 8), String(a.url));

    /* --- relative to the importing file, not the current directory --- */
    const b = await import('T:qjsdi/sub/b.js');
    check('static ../a.js inside T:qjsdi/sub/b.js', b.b === 2);
    const c = await b.loadC();
    check('import("./c.js") from T:qjsdi/sub/b.js finds sub/c.js', c.c === 3);
    const aAgain = await b.loadA();
    check('"../a.js" from sub/ and "T:qjsdi/a.js" are one module',
          aAgain === a && globalThis.__qjsdi_a_runs === 1,
          'runs=' + globalThis.__qjsdi_a_runs);

    /* --- a file directly at a volume root: its directory is "T:" --- */
    const root = await import('T:qjsdi_root.js');
    check('static ./qjsdi/a.js inside T:qjsdi_root.js', root.fromRoot === 1);
    check('import("./qjsdi/a.js") from T:qjsdi_root.js is the same module',
          (await root.later()) === a);

    /* --- circular imports --- */
    const circ = await import('T:qjsdi/circ1.js');
    check('circular imports link and run', circ.three() === 3);

    /* --- built-in modules --- */
    const dynStd = await import('qjs:std');
    const dynOs = await import('qjs:os');
    check('import("qjs:std")', typeof dynStd.open === 'function' &&
          dynStd.open === std.open);
    check('import("qjs:os")', typeof dynOs.remove === 'function');

    /* --- JSON modules --- */
    const json = await import('T:qjsdi/data.json');
    check('import() of a .json file', json.default &&
          json.default.name === 'amiga' && json.default.list.length === 3);
    const typed = await import('T:qjsdi/data.json', { with: { type: 'json' } });
    check('import() with { type: "json" }',
          typed.default && typed.default.name === 'amiga');
    const badAttribute = await rejection(
        import('T:qjsdi/a.js', { with: { colour: 'red' } }));
    check('an unsupported import attribute is rejected',
          badAttribute instanceof TypeError,
          badAttribute && badAttribute.message);

    /* --- failures reject; they do not throw or crash --- */
    const missing = await rejection(import('T:qjsdi/nope.js'));
    check('a missing file rejects with a ReferenceError naming it',
          missing instanceof ReferenceError &&
          missing.message.includes('T:qjsdi/nope.js'),
          missing && missing.message);
    const missingRelative = await rejection(import('./qjsdi_no_such_module.js'));
    check('a missing relative file rejects',
          missingRelative instanceof ReferenceError,
          missingRelative && missingRelative.message);
    const broken = await rejection(import('T:qjsdi/broken.js'));
    check('a module with a syntax error rejects with a SyntaxError',
          broken instanceof SyntaxError, broken && broken.message);
    check('import() still works after the failures',
          (await import('T:qjsdi/a.js')) === a);

    /* --- from a classic script (std.loadScript runs one) --- */
    std.loadScript(DIR + '/classic.js');
    const fromClassic = await globalThis.__qjsdi_classic;
    check('import("./a.js") from a classic script in T:qjsdi/',
          fromClassic === a);

    /* --- from evaluated code: what the REPL and qjs -e do --- */
    const fromEval = await std.evalScript("import('T:qjsdi/sub/c.js')");
    check('import() from std.evalScript code (the REPL path)',
          fromEval === c);
    const fromAsyncEval = await std.evalScript(
        "(await import('T:qjsdi/a.js')).a + 41", { async: true });
    check('await import() in async evalScript code',
          fromAsyncEval && fromAsyncEval.value === 42,
          JSON.stringify(fromAsyncEval));
    const fromFunction = await (new Function("return import('T:qjsdi/a.js')"))();
    check('import() inside new Function()', fromFunction === a);
}

cleanUp();
check('module files removed', std.open(DIR + '/a.js', 'r') === null);
delete globalThis.__qjsdi_a_runs;
delete globalThis.__qjsdi_classic;

print(passed + ' passed, ' + failed + ' failed');
