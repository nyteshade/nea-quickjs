/* quickjs-master/amiga/ffi/structs/TagItem.js
 *
 * Helpers around amiga.makeTags (raw Q1) for the wrapper layer.
 * Not a Struct subclass — TagItem arrays are owned by their builder.
 */

/**
 * Build a TagItem array from JS pairs and return its pointer + size.
 * Caller is responsible for amiga.freeMem(ptr, size) — or use the
 * `withTags` ergonomic helper.
 *
 * @param {Array<[number, number]>} pairs
 * @returns {{ptr: number, size: number}}
 */
export function makeTags(pairs) {
  return {
    ptr: globalThis.amiga.makeTags(pairs),
    size: (pairs.length + 1) * 8,
  };
}

/**
 * Allocate a TagItem array, run fn(ptr), free it whether or not fn
 * throws.
 *
 * @template T
 * @param {Array<[number, number]>} pairs
 * @param {(ptr: number) => T} fn
 * @returns {T}
 */
export function withTags(pairs, fn) {
  let { ptr, size } = makeTags(pairs);

  try {
    return fn(ptr);
  }

  finally {
    globalThis.amiga.freeMem(ptr, size);
  }
}
