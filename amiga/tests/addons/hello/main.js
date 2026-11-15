/* amiga/tests/addons/hello/main.js - the main module of the test
 * add-on "hello": what `import ... from 'qjs:hello'` gives.
 *
 * scripts/qjsb.py compiles this and util.js into
 * amiga/tests/addons/hello.qjsb (`make -C library/vbcc qjsb`);
 * amiga/tests/test_qjsb.js imports it. See docs/ADDONS.md.
 */
import { bump, shout } from 'hello:util';

/**
 * Greet someone, loudly.
 *
 * @param {string} who - the name to greet
 * @returns {string} the greeting in capitals
 */
export function greet(who) {
    return shout('hello, ' + who);
}

/**
 * Count calls through the add-on's other module.
 *
 * @returns {number} how often bump() has been called in this context
 */
export function bumpViaMain() {
    return bump();
}

/** The name this module was imported under, as the engine reports it. */
export const metaUrl = import.meta.url;

export default { name: 'hello', version: '1.0' };
