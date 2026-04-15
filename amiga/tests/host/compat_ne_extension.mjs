/* Compat regression suite: @nejs/extension on QuickJS-ng
 *
 * Asserts the ne-extension features we rely on in the plugin system
 * continue to work.  Run with HOST qjs.  If this ever fails, the
 * plugin/module system will break.
 *
 * Source under test: /Volumes/Code/JavaScript/ne-extension
 */

import { Extension, Patch, PatchEntry, PatchToggle, SemVer, Errors }
    from '/Volumes/Code/JavaScript/ne-extension/src/index.js';

let pass = 0, fail = 0;
const failures = [];
function check(cond, msg) {
    if (cond) { pass++; }
    else      { fail++; failures.push(msg); }
}

/* ========== Extension ========== */

/* --- Basic class extension --- */
class Foo { static hello() { return 'hi'; } }
const fooExt = new Extension(Foo);

check(typeof globalThis.Foo === 'undefined', "Foo not present before apply");
fooExt.apply();
check(typeof globalThis.Foo === 'function',  "Foo present after apply");
check(globalThis.Foo.hello() === 'hi',        "Foo.hello() works");
fooExt.revert();
check(typeof globalThis.Foo === 'undefined', "Foo gone after revert");

/* --- Extension introspection --- */
check(fooExt.key === 'Foo',                  "Extension.key");
check(fooExt.isClass === true,               "Extension.isClass");
check(fooExt.isFunction === false,           "Extension.isFunction false for class");
check(fooExt.isPrimitive === false,          "Extension.isPrimitive false for class");

/* --- Primitive value extension ---
 * Note: For explicit (key, value) extensions, `.value` stays
 * undefined and the real payload lives in `patches[key]`.  The
 * isPrimitive getter only reports on the implicit class/value form.
 * Verify the patches dictionary carries the value and apply/revert
 * affect the owner correctly. */
const numExt = new Extension('MY_CONSTANT', 42);
check(numExt.patches.MY_CONSTANT === 42,     "explicit value tracked in patches");
numExt.apply();
check(globalThis.MY_CONSTANT === 42,         "primitive value installed");
numExt.revert();
check(typeof globalThis.MY_CONSTANT === 'undefined', "primitive value reverted");

/* --- Custom owner --- */
const target = {};
const targetExt = new Extension('myProp', 'myValue', target);
targetExt.apply();
check(target.myProp === 'myValue',           "custom owner apply");
targetExt.revert();
check(!('myProp' in target),                 "custom owner revert");

/* --- createSet --- */
class Bar { static who() { return 'bar'; } }
class Baz { static who() { return 'baz'; } }
const set = Extension.createSet('myset', new Extension(Bar), new Extension(Baz));
set.apply();
check(typeof globalThis.Bar === 'function' && typeof globalThis.Baz === 'function',
      "createSet applies all");
set.revert();
check(typeof globalThis.Bar === 'undefined' && typeof globalThis.Baz === 'undefined',
      "createSet reverts all");

/* ========== Patch ========== */

/* --- Basic patch --- */
const obj = { greet: () => 'hello' };
const p = new Patch(obj, { greet: () => 'hola' });
check(obj.greet() === 'hello',                "before patch apply");
p.apply();
check(obj.greet() === 'hola',                 "after patch apply");
check(p.applied === true,                     "Patch.applied === true");
p.revert();
check(obj.greet() === 'hello',                "after patch revert");
check(p.applied === false,                    "Patch.applied === false after revert");

/* --- Patch with new property (conflict-free) --- */
const obj2 = {};
const p2 = new Patch(obj2, { newProp: 'added' });
p2.apply();
check(obj2.newProp === 'added',               "patch adds new property");
p2.revert();
check(!('newProp' in obj2),                   "patch removes new property on revert");

/* --- Patch with conflict (existing property) --- */
const obj3 = { existing: 'original' };
const p3 = new Patch(obj3, { existing: 'replaced', fresh: 'added' });
p3.apply();
check(obj3.existing === 'replaced' && obj3.fresh === 'added',
                                              "patch with conflict applies");
p3.revert();
check(obj3.existing === 'original' && !('fresh' in obj3),
                                              "patch revert restores conflict + removes new");

/* --- Patch descriptor control via k* symbols --- */
const obj4 = {};
const p4 = new Patch(obj4, {
    visible: 1,
    [Patch.kMutablyHidden]: { hidden: 2 },
});
p4.apply();
check(obj4.visible === 1 && obj4.hidden === 2,    "both keys installed");
check(Object.keys(obj4).includes('visible'),      "visible is enumerable");
check(!Object.keys(obj4).includes('hidden'),      "hidden is not enumerable");
check(Object.getOwnPropertyNames(obj4).includes('hidden'), "hidden is in getOwnPropertyNames");
p4.revert();

/* ========== PatchToggle ========== */

const obj5 = { m: () => 'orig' };
const p5 = new Patch(obj5, { m: () => 'temp' });
const tog = p5.createToggle();

tog.start();
check(obj5.m() === 'temp',                     "toggle.start applies patch");
tog.stop();
check(obj5.m() === 'orig',                     "toggle.stop reverts patch");

const result = tog.perform(() => obj5.m());
check(result === 'temp',                       "toggle.perform applies during task");
check(obj5.m() === 'orig',                     "toggle.perform reverts after task");

/* ========== SemVer ========== */

const v = new SemVer('1.2.3');
check(v.major === 1 && v.minor === 2 && v.patch === 3,   "SemVer parse major.minor.patch");
check(v.prerelease === '' && v.metadata === '',          "SemVer parse no pre/meta");

const vp = new SemVer('2.5.7-beta+build.1');
check(vp.major === 2 && vp.minor === 5 && vp.patch === 7,  "SemVer with pre/meta: numbers");
check(vp.prerelease === 'beta',                            "SemVer prerelease");
check(vp.metadata === 'build.1',                           "SemVer metadata");

/* SemVer.from returns {semVer, range} wrapper */
const extracted = SemVer.from('version 3.1.4 release');
check(extracted && extracted.semVer,                       "SemVer.from returns wrapper");
check(extracted.semVer.major === 3 &&
      extracted.semVer.minor === 1 &&
      extracted.semVer.patch === 4,                        "SemVer.from extracts 3.1.4");
check(Array.isArray(extracted.range) && extracted.range.length === 2,
                                                           "SemVer.from has range [start,end]");

/* Comparison */
check(new SemVer('1.0.0').isEqual(new SemVer('1.0.0')),    "SemVer.isEqual same");
check(!new SemVer('1.0.0').isEqual(new SemVer('1.0.1')),   "SemVer.isEqual different");

/* ========== Errors namespace ========== */

check(typeof Errors.CannotBeExtended === 'function',
                                                           "Errors.CannotBeExtended constructor");
check(typeof Errors.MissingOwnerValue === 'function',
                                                           "Errors.MissingOwnerValue constructor");

/* ========== Report ========== */

console.log(`ne-extension compat: ${pass} passed, ${fail} failed`);
if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  -', f);
    throw new Error(`${fail} ne-extension compat regressions`);
}
