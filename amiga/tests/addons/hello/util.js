/* amiga/tests/addons/hello/util.js - a second module of the test
 * add-on "hello": what `import ... from 'hello:util'` gives.
 */

let count = 0;

/**
 * Turn a text into capitals.
 *
 * @param {string} text - any text
 * @returns {string} the text in upper case
 */
export function shout(text) {
    return text.toUpperCase();
}

/**
 * Count a call. The count belongs to the module, so every importer in
 * one context sees the same sequence.
 *
 * @returns {number} the number of calls so far, this one included
 */
export function bump() {
    count += 1;

    return count;
}
