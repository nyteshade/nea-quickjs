/* test_qjs_modules.mjs -- exercise the built-in qjs:modules and
 * qjs:extension surfaces using their native file layout.  If this
 * passes, a plugin author using the real `import ... from 'qjs:...'`
 * paths will also work once the engine has those module aliases
 * wired up.
 *
 * Run with host qjs; see amiga/tests/host/README.md.
 */

import { Tiers, Providers, Manifest, ModuleRegistry,
         Extension, Patch, SemVer }
    from '../../../quickjs-master/amiga/extended/builtin/qjs-modules.mjs';

import * as ExtModule
    from '../../../quickjs-master/amiga/extended/builtin/qjs-extension.mjs';

let pass = 0, fail = 0;
const failures = [];
function check(cond, msg) {
    if (cond) pass++;
    else      { fail++; failures.push(msg); }
}

/* =====================================================
 * Tiers + Providers: right values, right methods
 * ===================================================== */
check(Tiers.pureJS && Tiers.bridge && Tiers.libraryCore,
      "Tiers exposes pureJS/bridge/libraryCore");
check([...Tiers.cases()].length === 3,              "Tiers has exactly 3 cases");
check(Tiers.pureJS.value === 'pure-js',             "Tiers.pureJS.value");

check(Providers.upstream && Providers.neaPort && Providers.thirdParty,
      "Providers exposes upstream/neaPort/thirdParty");
check([...Providers.cases()].length === 3,          "Providers has exactly 3 cases");

/* =====================================================
 * qjs:extension re-exports
 * ===================================================== */
check(typeof ExtModule.Extension === 'function',    "qjs:extension re-exports Extension");
check(typeof ExtModule.Patch === 'function',        "qjs:extension re-exports Patch");
check(typeof ExtModule.PatchToggle === 'function',  "qjs:extension re-exports PatchToggle");
check(typeof ExtModule.PatchEntry === 'function',   "qjs:extension re-exports PatchEntry");
check(typeof ExtModule.SemVer === 'function',       "qjs:extension re-exports SemVer");
check(typeof ExtModule.Errors === 'object',         "qjs:extension re-exports Errors");

/* =====================================================
 * Manifest: constructor validation + coercion
 * ===================================================== */
const m1 = new Manifest({
    name:     'example',
    tier:     Tiers.pureJS,
    provider: Providers.neaPort,
});
check(m1.name === 'example',                         "Manifest.name");
check(m1.tier === Tiers.pureJS,                      "Manifest.tier (enum instance)");
check(m1.provider === Providers.neaPort,             "Manifest.provider (enum instance)");
check(m1.version instanceof SemVer,                  "Manifest.version defaults to SemVer");
check(m1.applied === false,                          "Manifest.applied defaults false");

const m2 = new Manifest({
    name:     'example-b',
    tier:     'pure-js',          /* coerce from value string */
    provider: 'third-party',      /* coerce from value string */
    version:  '2.3.4',            /* coerce from string */
});
check(m2.tier === Tiers.pureJS,                      "Manifest.tier coerces from value string");
check(m2.provider === Providers.thirdParty,          "Manifest.provider coerces from value string");
check(m2.version.major === 2 && m2.version.minor === 3 && m2.version.patch === 4,
      "Manifest.version coerces from string");

/* Invalid enum value must throw */
let threw = false;
try { new Manifest({ name: 'x', tier: 'bogus', provider: Providers.neaPort }); }
catch (e) { threw = true; }
check(threw, "Manifest rejects unknown tier value");

/* =====================================================
 * Manifest with Extension: apply/revert cycle
 * ===================================================== */
class Widget { static kind() { return 'widget'; } }

const mWidget = new Manifest({
    name:     'widget-demo',
    tier:     Tiers.pureJS,
    provider: Providers.neaPort,
    description: 'demo',
    globals:  ['Widget'],
    extension: new Extension(Widget),
});

check(typeof globalThis.Widget === 'undefined',      "Widget absent pre-apply");
mWidget.apply();
check(typeof globalThis.Widget === 'function',       "Widget present post-apply");
check(mWidget.applied === true,                      "Manifest.applied tracks");
check(globalThis.Widget.kind() === 'widget',         "Widget works");
mWidget.revert();
check(typeof globalThis.Widget === 'undefined',      "Widget absent post-revert");
check(mWidget.applied === false,                     "Manifest.applied tracks revert");

/* Idempotency */
mWidget.apply();
mWidget.apply();
check(typeof globalThis.Widget === 'function',       "apply() is idempotent");
mWidget.revert();
mWidget.revert();
check(typeof globalThis.Widget === 'undefined',      "revert() is idempotent");

/* Custom install/uninstall hooks */
let hookCount = 0;
const mHook = new Manifest({
    name:     'hook-demo',
    tier:     Tiers.pureJS,
    provider: Providers.neaPort,
    install:    () => hookCount++,
    uninstall:  () => hookCount--,
});
mHook.apply();
check(hookCount === 1,                               "install hook fired");
mHook.revert();
check(hookCount === 0,                               "uninstall hook fired");

/* =====================================================
 * Manifest.toJSON round-trip
 * ===================================================== */
const json = mWidget.toJSON();
check(json.name === 'widget-demo',                   "toJSON.name");
check(json.tier === 'pure-js',                       "toJSON.tier is the value string");
check(json.provider === 'nea-port',                  "toJSON.provider is the value string");
check(typeof json.version === 'string',              "toJSON.version is a string");
check(Array.isArray(json.globals) && json.globals.length === 1,
      "toJSON.globals preserved");
check(json.applied === false,                        "toJSON.applied accurate");

/* =====================================================
 * ModuleRegistry
 * ===================================================== */
const reg = new ModuleRegistry();

reg.register(new Manifest({
    name: 'base',
    tier: Tiers.pureJS,
    provider: Providers.neaPort,
}));
check(reg.has('base'),                               "registry.has after register");
check(reg.list().length === 1,                       "registry.list size 1");
check(reg.get('base').name === 'base',               "registry.get by name");

/* Duplicate registration rejected */
let dupThrew = false;
try {
    reg.register(new Manifest({
        name: 'base',
        tier: Tiers.pureJS,
        provider: Providers.neaPort,
    }));
} catch (e) { dupThrew = true; }
check(dupThrew,                                      "registry rejects duplicate name");

/* Missing dependency rejected */
let depThrew = false;
try {
    reg.register(new Manifest({
        name: 'needs-missing',
        tier: Tiers.pureJS,
        provider: Providers.neaPort,
        requires: ['does-not-exist'],
    }));
} catch (e) { depThrew = true; }
check(depThrew,                                      "registry rejects missing dep");

/* Satisfied dependency passes */
reg.register(new Manifest({
    name: 'child',
    tier: Tiers.pureJS,
    provider: Providers.neaPort,
    requires: ['base'],
}));
check(reg.has('child'),                              "registry accepts satisfied dep");

/* Unregister reverts too */
class GlobalExtDemo { static tag() { return 'demo'; } }
const withExt = new Manifest({
    name: 'demo-module',
    tier: Tiers.pureJS,
    provider: Providers.neaPort,
    extension: new Extension(GlobalExtDemo),
});
reg.register(withExt);
check(typeof globalThis.GlobalExtDemo === 'function', "registered + applied");
reg.unregister('demo-module');
check(typeof globalThis.GlobalExtDemo === 'undefined',"unregister reverts");
check(!reg.has('demo-module'),                       "unregister removes");

/* revertAll / applyAll */
class A { } class B { }
const mA = new Manifest({ name: 'A', tier: Tiers.pureJS, provider: Providers.neaPort,
                          extension: new Extension(A) });
const mB = new Manifest({ name: 'B', tier: Tiers.pureJS, provider: Providers.neaPort,
                          extension: new Extension(B) });
reg.register(mA); reg.register(mB);
check(typeof globalThis.A === 'function' && typeof globalThis.B === 'function',
      "applyAll via register");
reg.revertAll();
check(typeof globalThis.A === 'undefined' && typeof globalThis.B === 'undefined',
      "revertAll reverts all");
reg.applyAll();
check(typeof globalThis.A === 'function' && typeof globalThis.B === 'function',
      "applyAll reinstates");
reg.unregister('A'); reg.unregister('B');

/* =====================================================
 * Report
 * ===================================================== */
console.log(`qjs:modules test: ${pass} passed, ${fail} failed`);
if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  -', f);
    throw new Error(`${fail} qjs:modules regressions`);
}
