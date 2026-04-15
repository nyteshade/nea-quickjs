/* Compat regression suite: @nejs/enumeration on QuickJS-ng
 *
 * Asserts the ne-enumeration features we rely on in the plugin system
 * continue to work.  Run with the HOST qjs (see README).  If this
 * ever fails after a QuickJS-ng upgrade or ne-enumeration upgrade, we
 * need to investigate before vendoring the new version.
 *
 * Source under test:  /Volumes/Code/JavaScript/ne-enumeration
 */

import Enumeration from
    '/Volumes/Code/JavaScript/ne-enumeration/src/enumeration.mjs';

let pass = 0, fail = 0;
const failures = [];
function check(cond, msg) {
    if (cond) { pass++; }
    else      { fail++; failures.push(msg); }
}

/* ---------- Subclass declaration via static {} block ---------- */
class Tiers extends Enumeration {
    static {
        Tiers.define('pureJS',      'pure-js');
        Tiers.define('bridge',      'bridge');
        Tiers.define('libraryCore', 'library-core');
    }
}

class Providers extends Enumeration {
    static {
        Providers.define('upstream',   'upstream');
        Providers.define('neaPort',    'nea-port');
        Providers.define('thirdParty', 'third-party');
    }
}

check(Tiers.pureJS instanceof Tiers,         "Tiers.pureJS is Tiers instance");
check(Tiers.pureJS.key === 'pureJS',         "Tiers.pureJS.key");
check(Tiers.pureJS.value === 'pure-js',      "Tiers.pureJS.value");
check(Tiers.pureJS.case === 'Tiers.pureJS',  "Tiers.pureJS.case");
check(Providers.neaPort instanceof Providers,     "Providers.neaPort instance");
check(Providers.neaPort.case === 'Providers.neaPort', "Providers.case");

/* ---------- Identity / comparison ---------- */
check(Tiers.pureJS === Tiers.pureJS,              "enum values are stable (===)");
check(Tiers.pureJS.is(Tiers.pureJS),              "Tiers.pureJS.is(self)");
check(!Tiers.pureJS.is(Tiers.bridge),             "pureJS not is bridge");
check(!Tiers.pureJS.is(Providers.upstream),       "cross-enum !is");

/* ---------- Symbol.toPrimitive coercion ---------- */
class Status extends Enumeration {
    static {
        Status.define('ok',       200);
        Status.define('notFound', 404);
    }
}
check(+Status.ok === 200,                         "Symbol.toPrimitive 'number'");
check(String(Status.ok) === 'ok',                 "Symbol.toPrimitive 'string'");
check(`${Status.ok}` === 'ok',                    "Template literal");
check(Number.isNaN(+Tiers.pureJS),                "Non-numeric value -> NaN");

/* ---------- Iteration ---------- */
const tierCases = [...Tiers.cases()];
check(tierCases.length === 3,                     "3 Tier cases");
check(tierCases.includes('pureJS'),               "cases() includes pureJS");
check(tierCases.includes('libraryCore'),          "cases() includes libraryCore");

const tierValues = [...Tiers.values()];
check(tierValues.length === 3,                    "3 Tier values");
check(tierValues.every(v => v instanceof Tiers),  "All values are Tiers");

const pairs = [...Tiers];
check(pairs.length === 3,                         "[Symbol.iterator] yields 3");
check(pairs.every(p => Array.isArray(p) && p.length === 2), "pairs are [k,v]");

/* ---------- match() ---------- */
check(Tiers.match(Tiers.pureJS) === true,         "match(present) === true (default)");
check(Tiers.match(null) === false,                "match(missing) === false (default)");
check(Tiers.match(Tiers.pureJS, (i,b) => b.key) === 'pureJS',
                                                  "match dispatches present");
check(Tiers.match(null, () => 1, () => 'missing') === 'missing',
                                                  "match dispatches missing");
check(Tiers.match(Providers.neaPort) === false,
                                                  "match rejects cross-enum");

/* ---------- Associated values (variants) ---------- */
class Color extends Enumeration {
    static {
        Color.define('rgb', { r: 0, g: 0, b: 0, a: 255 });
    }
}
const red = Color.rgb.associate({ r: 255, g: 0, b: 0, a: 255 });
check(red.key === 'rgb',                          "associate: key preserved");
check(red.r === 255,                              "associate: r via proxy");
check(red.associated('g') === 0,                  "associate: associated('g')");
check(red.hasAssociatedValues,                    "associate: hasAssociatedValues");
check(red instanceof Color,                       "associate: still instanceof");
check(Color.rgb.hasAssociatedValues === false,
                                                  "original unaltered");

/* ---------- Multiple associate() calls merge ---------- */
const v1 = Color.rgb.associate({ x: 1 });
const v2 = v1.associate({ y: 2 });
check(v2 === v1,                                  "second associate mutates");
check(v1.associations.x === 1 && v1.associations.y === 2,
                                                  "associations merged");

/* ---------- Static is() helper ---------- */
check(Enumeration.is(Tiers.pureJS, Tiers.pureJS), "static is() same");
check(!Enumeration.is(Tiers.pureJS, Tiers.bridge),"static is() different");

/* ---------- Symbol.toStringTag ---------- */
check(Object.prototype.toString.call(Tiers.pureJS) === '[object Tiers]',
                                                  "[object Tiers]");
check(Tiers.pureJS[Symbol.toStringTag] === 'Tiers', "Symbol.toStringTag");

/* ---------- Report ---------- */
console.log(`ne-enumeration compat: ${pass} passed, ${fail} failed`);
if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  -', f);
    throw new Error(`${fail} ne-enumeration compat regressions`);
}
